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

export async function getContractDetail(contractId: string): Promise<{
  data: Contract | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();
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
  signerIp: string,
  signerUserAgent: string,
  consentData?: ConsentData,
): Promise<{ error: string | null }> {
  try {
    // 실제 IP 가져오기 (전달받은 값이 placeholder면 조회)
    const actualIp = signerIp === '0.0.0.0' ? await getClientIp() : signerIp;
    const actualUserAgent = signerUserAgent || `DeliSign-Mobile/${Platform.OS}/${Platform.Version}`;

    // 1. Insert signature record
    const { error: sigError } = await supabase
      .from('contract_signatures')
      .insert({
        contract_id: contractId,
        driver_id: driverId,
        phone_verified: 'app_auth',
        signature_image_base64: signatureBase64,
        signer_ip: actualIp,
        signer_user_agent: actualUserAgent,
        signed_at: new Date().toISOString(),
        consent_contract: consentData?.consent_contract ?? false,
        consent_privacy_collect: consentData?.consent_privacy_collect ?? false,
        consent_privacy_id: consentData?.consent_privacy_id ?? false,
        consent_privacy_3rd: consentData?.consent_privacy_3rd ?? false,
        consent_privacy_3rd_id: consentData?.consent_privacy_3rd_id ?? false,
        audit_log: {
          action: 'signed',
          method: 'in_app',
          timestamp: new Date().toISOString(),
          consents: consentData ?? {},
        },
      });
    if (sigError) throw sigError;

    // 2. Update contract status
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'signed' as const,
        signed_at: new Date().toISOString(),
      })
      .eq('id', contractId);
    if (updateError) throw updateError;

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
