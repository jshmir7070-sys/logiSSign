/**
 * 정산서 템플릿 CRUD 서비스
 * settlement_templates 테이블 연동
 */

import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { SettlementTemplate } from '@/types/settlement-template'
import { PRESET_TEMPLATES } from '@/types/settlement-template'

/* ── Types ── */

export interface SettlementTemplateRow {
  id: string
  agency_id: string
  name: string
  description: string | null
  template_config: SettlementTemplate
  column_mapping: Record<string, unknown> | null
  is_default: boolean
  created_at: string
  updated_at: string
}

/* ── CRUD ── */

/** 대리점의 템플릿 목록 조회 (프리셋 포함) */
export async function getSettlementTemplates(agencyId: string): Promise<{
  custom: SettlementTemplateRow[]
  presets: typeof PRESET_TEMPLATES
}> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('settlement_templates')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  return {
    custom: (data ?? []) as SettlementTemplateRow[],
    presets: PRESET_TEMPLATES,
  }
}

/** 템플릿 저장 (신규) */
export async function createSettlementTemplate(input: {
  agency_id: string
  name: string
  description?: string
  template_config: SettlementTemplate
  column_mapping?: Record<string, unknown>
}): Promise<{ data: SettlementTemplateRow | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('settlement_templates')
    .insert({
      agency_id: input.agency_id,
      name: input.name,
      description: input.description || null,
      template_config: input.template_config as unknown as Record<string, unknown>,
      column_mapping: input.column_mapping || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as SettlementTemplateRow, error: null }
}

/** 템플릿 수정 */
export async function updateSettlementTemplate(
  id: string,
  updates: {
    name?: string
    description?: string
    template_config?: SettlementTemplate
    column_mapping?: Record<string, unknown>
    is_default?: boolean
  }
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('settlement_templates')
    .update({
      ...updates,
      template_config: updates.template_config
        ? (updates.template_config as unknown as Record<string, unknown>)
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return { error: error?.message ?? null }
}

/** 템플릿 삭제 */
export async function deleteSettlementTemplate(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('settlement_templates')
    .delete()
    .eq('id', id)

  return { error: error?.message ?? null }
}

/** 기본 템플릿 설정 (기존 기본 해제 → 새로 설정) */
export async function setDefaultSettlementTemplate(
  id: string,
  agencyId: string
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  // 기존 기본 해제
  await supabase
    .from('settlement_templates')
    .update({ is_default: false })
    .eq('agency_id', agencyId)
    .eq('is_default', true)

  // 새로 설정
  const { error } = await supabase
    .from('settlement_templates')
    .update({ is_default: true })
    .eq('id', id)

  return { error: error?.message ?? null }
}

/* ── Job 관련 ── */

export interface SettlementJobRow {
  id: string
  agency_id: string
  template_id: string | null
  uploaded_file_url: string
  original_filename: string | null
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_drivers: number
  completed_drivers: number
  failed_drivers: number
  output_url: string | null
  error_log: Record<string, unknown> | null
  processing_time_ms: number | null
  year_month: string | null
  created_at: string
  completed_at: string | null
}

/** 작업 이력 조회 */
export async function getSettlementJobs(agencyId: string): Promise<SettlementJobRow[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('settlement_jobs')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []) as SettlementJobRow[]
}

/** 작업 생성 */
export async function createSettlementJob(input: {
  agency_id: string
  template_id?: string
  uploaded_file_url: string
  original_filename?: string
  total_drivers: number
  year_month?: string
}): Promise<{ data: SettlementJobRow | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('settlement_jobs')
    .insert({
      agency_id: input.agency_id,
      template_id: input.template_id || null,
      uploaded_file_url: input.uploaded_file_url,
      original_filename: input.original_filename || null,
      total_drivers: input.total_drivers,
      year_month: input.year_month || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as SettlementJobRow, error: null }
}

/** 작업 상태 업데이트 */
export async function updateSettlementJob(
  id: string,
  updates: Partial<Pick<SettlementJobRow, 'status' | 'completed_drivers' | 'failed_drivers' | 'output_url' | 'error_log' | 'processing_time_ms' | 'completed_at'>>
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('settlement_jobs')
    .update(updates)
    .eq('id', id)

  return { error: error?.message ?? null }
}
