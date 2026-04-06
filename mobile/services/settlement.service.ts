import { supabase } from '../lib/supabase'
import type { Row } from '../types/database'

type Settlement = Row<'settlements'>

export interface SettlementWithPrincipal extends Settlement {
  principals: { name: string } | null
}

export async function getDriverSettlements(driverId: string): Promise<{
  data: SettlementWithPrincipal[] | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase
      .from('settlements')
      .select('*, principals(name)')
      .eq('driver_id', driverId)
      .neq('status', 'draft')
      .order('year_month', { ascending: false })

    if (error) throw error
    return { data: data as SettlementWithPrincipal[], error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '정산 목록을 불러오지 못했습니다.',
    }
  }
}

export async function getSettlementDetail(settlementId: string): Promise<{
  data: SettlementWithPrincipal | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase
      .from('settlements')
      .select('*, principals(name)')
      .eq('id', settlementId)
      .neq('status', 'draft')
      .single()

    if (error) throw error
    return { data: data as SettlementWithPrincipal, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '정산 상세를 불러오지 못했습니다.',
    }
  }
}

export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '작성 중',
    sent: '발송 완료',
    confirmed: '확인 완료',
  }

  return map[status] ?? status
}

export function statusVariant(status: string): 'success' | 'warning' | 'default' {
  const map: Record<string, 'success' | 'warning' | 'default'> = {
    confirmed: 'success',
    sent: 'warning',
    draft: 'default',
  }

  return map[status] ?? 'default'
}
