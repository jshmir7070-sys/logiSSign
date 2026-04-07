/**
 * POST /api/settlement/generate-bulk
 * 대량 정산서 PDF 일괄 생성 → ZIP → Supabase Storage 업로드
 *
 * 요청: { jobId, templateConfig, drivers[], meta }
 * 응답: { downloadUrl, fileCount, processingTimeMs }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { generateSettlementPdf } from '@/services/settlement-pdf.service'
import { updateSettlementJob } from '@/services/settlement-template.service'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'
import type {
  SettlementTemplate,
  SettlementDriverData,
  SettlementMeta,
} from '@/types/settlement-template'

// JSZip는 서버에서만 사용
async function createZip(files: Array<{ name: string; data: Uint8Array }>): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.data)
  }
  const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return blob
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/settlement/generate-bulk')
  if (limited) return limited

  const authResult = await authenticateRequest(request)
  if (authResult.error || !authResult.auth) {
    return authResult.error ?? NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }
  const { agencyId } = authResult.auth

  const startTime = Date.now()

  let parsedBody: { jobId?: string } | undefined

  try {
    const body = await request.json()
    parsedBody = body
    const {
      jobId,
      templateConfig,
      drivers,
      meta,
      filenamePattern = '정산서_{{driver_name}}_{{month}}월',
    } = body as {
      jobId?: string
      templateConfig: SettlementTemplate
      drivers: SettlementDriverData[]
      meta: SettlementMeta
      filenamePattern?: string
    }

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ error: '기사 데이터가 필요합니다' }, { status: 400 })
    }

    if (drivers.length > 1000) {
      return NextResponse.json({ error: '최대 1,000명까지 처리 가능합니다' }, { status: 400 })
    }

    // 작업 상태 업데이트 (시작)
    if (jobId) {
      await updateSettlementJob(jobId, { status: 'processing', completed_drivers: 0 })
    }

    const pdfFiles: Array<{ name: string; data: Uint8Array }> = []
    const errors: Array<{ driverIndex: number; driverName: string; error: string }> = []
    const CHUNK_SIZE = 50

    // 청크별 처리
    for (let i = 0; i < drivers.length; i += CHUNK_SIZE) {
      const chunk = drivers.slice(i, i + CHUNK_SIZE)

      const results = await Promise.allSettled(
        chunk.map(async (driver, idx) => {
          const pdfBytes = await generateSettlementPdf(templateConfig, driver, meta)
          const filename = filenamePattern
            .replace('{{driver_name}}', driver.name)
            .replace('{{driver_id}}', driver.id || '')
            .replace('{{month}}', String(meta.month))
            .replace('{{year}}', String(meta.year))
          return { name: `${filename}.pdf`, data: pdfBytes, globalIdx: i + idx }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          pdfFiles.push(result.value)
        } else {
          const failIdx = pdfFiles.length + errors.length
          errors.push({
            driverIndex: failIdx,
            driverName: drivers[failIdx]?.name ?? `기사 ${failIdx}`,
            error: result.reason?.message ?? '알 수 없는 오류',
          })
        }
      }

      // 진행 상태 업데이트
      if (jobId) {
        await updateSettlementJob(jobId, {
          completed_drivers: pdfFiles.length,
          failed_drivers: errors.length,
        })
      }
    }

    // 개별 PDF를 Storage에 업로드 + settlements.pdf_url 저장
    const supabase = createAdminSupabaseClient()
    for (const pdfFile of pdfFiles) {
      const driverData = drivers.find((d) => pdfFile.name.includes(d.name))
      if (!driverData?.id) continue

      const pdfPath = `settlements/${agencyId}/${meta.year}_${String(meta.month).padStart(2, '0')}/${pdfFile.name}`
      const { error: pdfUpErr } = await supabase.storage
        .from('documents')
        .upload(pdfPath, pdfFile.data, {
          contentType: 'application/pdf',
          cacheControl: '86400',
          upsert: true,
        })
      if (!pdfUpErr) {
        const { data: pdfUrlData } = await supabase.storage
          .from('documents')
          .createSignedUrl(pdfPath, 86400 * 365) // 1년
        if (pdfUrlData?.signedUrl) {
          await supabase
            .from('settlements')
            .update({ pdf_url: pdfUrlData.signedUrl })
            .eq('agency_id', agencyId)
            .eq('driver_id', driverData.id)
            .eq('year_month', `${meta.year}-${String(meta.month).padStart(2, '0')}`)
        }
      }
    }

    // ZIP 생성
    const zipBytes = await createZip(pdfFiles)
    const zipFilename = `settlement_${meta.year}_${String(meta.month).padStart(2, '0')}_${Date.now()}.zip`
    const storagePath = `settlements/${agencyId}/${zipFilename}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, zipBytes, {
        contentType: 'application/zip',
        cacheControl: '86400',
      })

    let downloadUrl = ''
    if (!uploadError) {
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 86400) // 24시간

      downloadUrl = signedData?.signedUrl ?? ''
    }

    const processingTimeMs = Date.now() - startTime

    // 작업 완료
    if (jobId) {
      await updateSettlementJob(jobId, {
        status: errors.length > 0 ? 'completed' : 'completed',
        completed_drivers: pdfFiles.length,
        failed_drivers: errors.length,
        output_url: downloadUrl,
        processing_time_ms: processingTimeMs,
        completed_at: new Date().toISOString(),
        error_log: errors.length > 0 ? { errors } as Record<string, unknown> : null,
      })
    }

    return NextResponse.json({
      downloadUrl,
      fileCount: pdfFiles.length,
      failedCount: errors.length,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
      // Storage 업로드 실패 시 fallback
      ...(uploadError ? { storageError: uploadError.message } : {}),
    })
  } catch (err) {
    const processingTimeMs = Date.now() - startTime
    if (parsedBody?.jobId) {
      await updateSettlementJob(parsedBody.jobId, {
        status: 'failed',
        processing_time_ms: processingTimeMs,
        error_log: { error: err instanceof Error ? err.message : 'unknown' } as Record<string, unknown>,
      }).catch(err => console.error('Settlement job update failed:', err))
    }
    console.error('[SettlementBulk] 예외 발생:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: '정산서 일괄 생성 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
