import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
import type { Row } from '../types/database';

type Contract = Row<'contracts'>;

export interface ContractListItem {
  id: string;
  title: string;
  status: Contract['status'];
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
}

export async function getDriverContracts(driverId: string): Promise<{
  data: ContractListItem[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('id, title, status, sent_at, signed_at, created_at')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data as ContractListItem[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '계약서 조회 실패' };
  }
}

export async function getContractDetail(contractId: string, driverId?: string): Promise<{
  data: Contract | null;
  error: string | null;
}> {
  try {
    let query = supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId);
    // 본인 계약서만 조회 (driver_id 필터)
    if (driverId) {
      query = query.eq('driver_id', driverId);
    }
    const { data, error } = await query.single();
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '계약서 상세 조회 실패' };
  }
}

export interface ConsentData {
  consent_contract: boolean;
  consent_privacy_collect: boolean;
  consent_privacy_id: boolean;
  consent_privacy_3rd: boolean;
  consent_privacy_3rd_id: boolean;
}

/** 실제 클라이언트 IP 조회 */
async function getClientIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data.ip ?? '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}

export async function signContract(
  contractId: string,
  driverId: string,
  signatureBase64: string,
  _signerIp: string,
  _signerUserAgent: string,
  consentData?: ConsentData,
  certId?: string,
): Promise<{ error: string | null }> {
  try {
    // Supabase 세션에서 JWT 토큰 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return { error: '로그인이 필요합니다. 다시 로그인해주세요.' };
    }

    const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';

    const res = await fetch(`${APP_URL}/api/contracts/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contractId,
        driverId,
        signatureBase64,
        certId,
        consentData,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      return { error: result.error || '서명 처리 실패' };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '서명 처리 실패' };
  }
}

export function contractStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '작성중',
    sent: '서명대기',
    viewed: '열람중',
    signed: '서명완료',
    expired: '만료',
  };
  return map[status] ?? status;
}

export function contractStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    signed: 'success',
    sent: 'warning',
    viewed: 'info',
    expired: 'error',
    draft: 'default',
  };
  return map[status] ?? 'default';
}
