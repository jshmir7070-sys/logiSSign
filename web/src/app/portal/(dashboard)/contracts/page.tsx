'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import { toastError } from '@/components/shared/Toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getContracts, type ContractWithDriver } from '@/services/contract.service';

const statusLabel: Record<string, string> = {
  draft: '작성중',
  sent: '서명대기',
  viewed: '열람중',
  signed: '서명완료',
  expired: '만료',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  draft: 'default',
  sent: 'warning',
  viewed: 'info',
  signed: 'success',
  expired: 'error',
};

const tabs = [
  { key: 'all', label: '전체' },
  { key: 'signed', label: '서명완료' },
  { key: 'sent', label: '서명대기' },
  { key: 'expired', label: '만료' },
] as const;

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractWithDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const agencyId = user.app_metadata?.agency_id as string | undefined;
      if (!agencyId) {
        setLoading(false);
        return;
      }

      const result = await getContracts(agencyId);
      if (result.data) setContracts(result.data);
      setLoading(false);
    }

    load();
  }, []);

  async function reloadContracts() {
    const supabase = createBrowserSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const agencyId = user?.app_metadata?.agency_id as string | undefined;
    if (!agencyId) return;

    const result = await getContracts(agencyId);
    if (result.data) setContracts(result.data);
  }

  async function openSignedPdf(contractId: string) {
    const response = await fetch('/api/contracts/file-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId, fileType: 'signed_pdf' }),
    });
    const result = await response.json();

    if (!response.ok || result.error) {
      toastError(result.error || 'PDF를 열 수 없습니다.');
      return;
    }

    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  }

  const filtered = activeTab === 'all'
    ? contracts
    : contracts.filter((contract) => contract.status === activeTab);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">
            <span className="font-korean">계약서 관리</span>
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            기사에게 보낸 계약서와 문서의 서명 상태를 관리하세요.
          </p>
        </div>
        <Link
          href="/portal/contracts/new"
          className="bg-power-gradient text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          <span className="font-korean">계약·문서 전송</span>
        </Link>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'bg-surface-container-lowest shadow-ambient text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  기사명
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  계약서명
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  상태
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  발송일
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  서명일
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  계약서 PDF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    데이터를 불러오는 중입니다.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="space-y-2">
                      <p className="text-2xl">📄</p>
                      <p className="text-sm text-on-surface-variant font-korean">
                        {activeTab === 'all' ? '발송된 계약서가 없습니다.' : '해당 상태의 계약서가 없습니다.'}
                      </p>
                      <p className="text-xs text-on-surface-variant/60 font-korean">
                        오른쪽 상단의 &quot;계약·문서 전송&quot; 버튼으로 기사에게 계약서나 문서를 보낼 수 있습니다.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((contract) => (
                  <tr key={contract.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-body text-on-surface font-korean">
                      {contract.drivers?.name ?? '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-on-surface font-korean">
                      {contract.title}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        label={statusLabel[contract.status] ?? contract.status}
                        variant={statusVariant[contract.status] ?? 'default'}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-data text-on-surface-variant">
                      {contract.sent_at ? new Date(contract.sent_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-data text-on-surface-variant">
                      {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {contract.status === 'signed' && (
                        contract.signed_pdf_url ? (
                          <button
                            onClick={() => openSignedPdf(contract.id)}
                            className="text-xs text-primary hover:underline font-label font-semibold font-korean"
                          >
                            PDF 다운로드
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const response = await fetch('/api/contracts/signed-pdf', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ contractId: contract.id }),
                              });
                              const result = await response.json();
                              if (result.error) {
                                toastError(`PDF 생성 실패: ${result.error}`);
                                return;
                              }
                              if (result.url) {
                                window.open(result.url, '_blank', 'noopener,noreferrer');
                              }
                              await reloadContracts();
                            }}
                            className="text-xs text-tertiary hover:underline font-label font-semibold font-korean"
                          >
                            PDF 생성
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
