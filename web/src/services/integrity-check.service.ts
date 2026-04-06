import { createAdminSupabaseClient } from '@/lib/supabase'
import { extractStoragePath } from '@/lib/storage-reference'
import {
  generateTimestampHash,
  sha256,
  sha256Binary,
  verifyAuditTrail,
  type AuditTrailEntry,
} from './verification.service'

export interface IntegrityFailure {
  contractId: string
  documentNumber: string | null
  title: string
  reasons: string[]
}

export interface IntegrityCheckResult {
  checkedAt: string
  totalContracts: number
  passed: number
  failed: number
  failures: IntegrityFailure[]
  durationMs: number
}

interface ContractRow {
  id: string
  title: string
  content: string
  content_hash: string | null
  signed_pdf_hash: string | null
  signed_pdf_url: string | null
  document_number: string | null
  verification_code: string | null
  signed_at: string | null
}

interface SignatureAuditRow {
  contract_id: string
  audit_log: unknown
}

async function collectIntegrityReasons(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  row: ContractRow,
  auditLog: unknown
): Promise<string[]> {
  const reasons: string[] = []

  if (row.content && row.content_hash) {
    const expectedContentHash = await sha256(row.content)
    if (expectedContentHash !== row.content_hash) {
      reasons.push(
        `content_hash 불일치: DB=${row.content_hash.slice(0, 16)}... 계산=${expectedContentHash.slice(0, 16)}...`
      )
    }
  } else if (!row.content_hash) {
    reasons.push('content_hash 누락')
  }

  if (row.signed_pdf_url && row.signed_pdf_hash) {
    try {
      const filePath = extractStoragePath(row.signed_pdf_url, 'contracts')
      if (!filePath) {
        reasons.push('signed_pdf_url storage path 추출 실패')
      } else {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('contracts')
          .download(filePath)

        if (downloadError || !fileData) {
          reasons.push(`PDF 다운로드 실패: ${downloadError?.message ?? 'unknown'}`)
        } else {
          const pdfBuffer = await fileData.arrayBuffer()
          const actualPdfHash = await sha256Binary(pdfBuffer)
          if (actualPdfHash !== row.signed_pdf_hash) {
            reasons.push(
              `signed_pdf_hash 불일치: DB=${row.signed_pdf_hash.slice(0, 16)}... Storage=${actualPdfHash.slice(0, 16)}...`
            )
          }
        }
      }
    } catch (error) {
      reasons.push(`PDF 해시 검증 오류: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }

  if (row.document_number && row.content_hash && row.signed_at) {
    const timestampHash = await generateTimestampHash(
      row.document_number,
      row.content_hash,
      row.signed_at
    )
    if (!timestampHash) {
      reasons.push('timestamp_hash 계산 실패')
    }
  }

  try {
    if (auditLog) {
      const entries: AuditTrailEntry[] = Array.isArray(auditLog)
        ? (auditLog as AuditTrailEntry[])
        : [auditLog as AuditTrailEntry]

      if (entries.length > 0) {
        const auditValid = await verifyAuditTrail(entries)
        if (!auditValid) {
          reasons.push('감사추적 해시 체인 무결성 깨짐')
        }
      }
    }
  } catch {
    reasons.push('감사추적 검증 실패')
  }

  return reasons
}

export async function runIntegrityCheck(
  triggeredBy: 'cron' | 'manual' = 'cron',
  checkedByUserId?: string
): Promise<IntegrityCheckResult> {
  const supabase = createAdminSupabaseClient()
  const startTime = Date.now()

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, title, content, content_hash, signed_pdf_hash, signed_pdf_url, document_number, verification_code, signed_at')
    .eq('status', 'signed')
    .order('signed_at', { ascending: false })

  if (error || !contracts) {
    const result: IntegrityCheckResult = {
      checkedAt: new Date().toISOString(),
      totalContracts: 0,
      passed: 0,
      failed: 0,
      failures: [],
      durationMs: Date.now() - startTime,
    }
    await saveCheckResult(result, triggeredBy, checkedByUserId)
    return result
  }

  const contractRows = contracts as ContractRow[]
  const contractIds = contractRows.map(contract => contract.id)
  const { data: signatures } = await supabase
    .from('contract_signatures')
    .select('contract_id, audit_log')
    .in('contract_id', contractIds)
    .order('signed_at', { ascending: false })

  const latestAuditMap = new Map<string, unknown>()
  for (const signature of (signatures ?? []) as SignatureAuditRow[]) {
    if (!latestAuditMap.has(signature.contract_id)) {
      latestAuditMap.set(signature.contract_id, signature.audit_log)
    }
  }

  const failures: IntegrityFailure[] = []
  let passed = 0

  for (const contract of contractRows) {
    const reasons = await collectIntegrityReasons(
      supabase,
      contract,
      latestAuditMap.get(contract.id)
    )

    if (reasons.length > 0) {
      failures.push({
        contractId: contract.id,
        documentNumber: contract.document_number,
        title: contract.title,
        reasons,
      })
    } else {
      passed++
    }
  }

  const result: IntegrityCheckResult = {
    checkedAt: new Date().toISOString(),
    totalContracts: contractRows.length,
    passed,
    failed: failures.length,
    failures,
    durationMs: Date.now() - startTime,
  }

  await saveCheckResult(result, triggeredBy, checkedByUserId)
  return result
}

export async function checkSingleContract(contractId: string): Promise<IntegrityFailure | null> {
  const supabase = createAdminSupabaseClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, title, content, content_hash, signed_pdf_hash, signed_pdf_url, document_number, verification_code, signed_at, status')
    .eq('id', contractId)
    .single()

  if (!contract) return null

  const { data: signature } = await supabase
    .from('contract_signatures')
    .select('audit_log')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = contract as ContractRow
  const reasons = await collectIntegrityReasons(
    supabase,
    row,
    (signature as { audit_log?: unknown } | null)?.audit_log
  )

  return reasons.length > 0
    ? {
        contractId: row.id,
        documentNumber: row.document_number,
        title: row.title,
        reasons,
      }
    : null
}

async function saveCheckResult(
  result: IntegrityCheckResult,
  triggeredBy: string,
  checkedByUserId?: string
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('integrity_check_results').insert({
      checked_at: result.checkedAt,
      triggered_by: triggeredBy,
      checked_by_user_id: checkedByUserId ?? null,
      total_contracts: result.totalContracts,
      passed_count: result.passed,
      failed_count: result.failed,
      failures: result.failures,
    })
  } catch (error) {
    console.error('[INTEGRITY CHECK] Failed to save results:', error)
  }
}
