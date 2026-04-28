'use client';

import { useEffect, useMemo, useState } from 'react';
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

type TabKey = 'all' | 'signed' | 'sent' | 'expired';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'signed', label: '서명완료' },
  { key: 'sent', label: '서명대기' },
  { key: 'expired', label: '만료' },
];

const tabAccent: Record<TabKey, { dot: string; ring: string; label: string }> = {
  all: { dot: 'bg-primary', ring: 'ring-primary/15', label: 'text-primary' },
  signed: { dot: 'bg-tertiary', ring: 'ring-tertiary/15', label: 'text-tertiary' },
  sent: { dot: 'bg-amber-500', ring: 'ring-amber-300/30', label: 'text-amber-600' },
  expired: { dot: 'bg-error', ring: 'ring-error/15', label: 'text-error' },
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractWithDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  const counts = useMemo(() => ({
    all: contracts.length,
    signed: contracts.filter((c) => c.status === 'signed').length,
    sent: contracts.filter((c) => c.status === 'sent' || c.status === 'viewed').length,
    expired: contracts.filter((c) => c.status === 'expired').length,
  }), [contracts]);

  const filtered = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    return contracts.filter((contract) => {
      const matchesTab = activeTab === 'all'
        ? true
        : activeTab === 'sent'
          ? contract.status === 'sent' || contract.status === 'viewed'
          : contract.status === activeTab;

      if (!matchesTab) return false;
      if (!trimmed) return true;

      const driverName = (contract.drivers?.name ?? '').toLowerCase();
      const title = (contract.title ?? '').toLowerCase();
      return driverName.includes(trimmed) || title.includes(trimmed);
    });
  }, [contracts, activeTab, searchTerm]);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-label uppercase tracking-[0.18em] text-primary/70 font-korean">
            계약 · 문서
          </p>
          <h1 className="mt-2 text-[28px] leading-tight font-headline font-bold text-on-surface font-korean">
            계약·문서 전송 내역
          </h1>
          <p className="mt-2 max-w-[640px] text-sm text-on-surface-variant font-korean">
            기사에게 보낸 계약서와 문서의 서명 진행 상태를 한눈에 확인하고, 필요한 PDF를 즉시 다운로드하세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reloadContracts}
            className="flex h-11 items-center gap-2 rounded-xl bg-surface-container-lowest px-4 text-sm font-label font-semibold text-on-surface-variant shadow-ambient transition-colors hover:bg-surface-container-low font-korean"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            새로고침
          </button>
          <Link
            href="/portal/contracts/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-power-gradient px-5 text-sm font-label font-semibold text-white shadow-card transition-shadow hover:shadow-float font-korean"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            계약·문서 전송
          </Link>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const accent = tabAccent[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`group relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 text-left shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-float ${
                active ? `ring-2 ${accent.ring}` : 'ring-1 ring-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                <span className={`text-xs font-label font-semibold uppercase tracking-wider ${accent.label} font-korean`}>
                  {tab.label}
                </span>
              </div>
              <p className="mt-4 text-[32px] leading-none font-data font-bold tracking-tight text-on-surface">
                {counts[tab.key]}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant font-korean">
                {tab.key === 'all'
                  ? '전체 발송 건'
                  : tab.key === 'signed'
                    ? '서명이 완료된 건'
                    : tab.key === 'sent'
                      ? '서명 대기 또는 열람 중'
                      : '서명 만료된 건'}
              </p>
              <div
                className={`absolute inset-x-0 bottom-0 h-1 origin-left transform transition-transform ${
                  active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                } ${accent.dot}`}
              />
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-ambient lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-label font-semibold transition-colors font-korean ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`min-w-[1.5rem] rounded-full px-1.5 text-[11px] font-data font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-white/70 text-on-surface-variant'
                  }`}
                >
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-[280px]">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="기사명 또는 계약서명으로 검색"
              className="h-11 w-full rounded-xl bg-surface-container-low pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/30 font-korean"
            />
          </div>
        </div>
      </div>

      {/* Data card */}
      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient">
        <div className="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">전송 목록</h2>
            <span className="text-xs text-on-surface-variant font-korean">
              {filtered.length}건 표시 / 전체 {counts.all}건
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/60">
                <th className="px-6 py-3 text-[11px] font-label font-semibold uppercase tracking-wider text-on-surface-variant font-korean">
                  기사명
                </th>
                <th className="px-6 py-3 text-[11px] font-label font-semibold uppercase tracking-wider text-on-surface-variant font-korean">
                  계약서명
                </th>
                <th className="px-6 py-3 text-[11px] font-label font-semibold uppercase tracking-wider text-on-surface-variant font-korean">
                  상태
                </th>
                <th className="px-6 py-3 text-[11px] font-label font-semibold uppercase tracking-wider text-on-surface-variant font-korean">
                  발송일
                </th>
                <th className="px-6 py-3 text-[11px] font-label font-semibold uppercase tracking-wider text-on-surface-variant font-korean">
                  서명일
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-label font-semibold uppercase tracking-wider text-on-surface-variant font-korean">
                  계약·문서 PDF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex w-fit items-center gap-3 text-sm text-on-surface-variant font-korean">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                      데이터를 불러오는 중입니다.
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M9 13h6" />
                          <path d="M9 17h4" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-on-surface font-korean">
                        {searchTerm
                          ? '검색 결과가 없습니다.'
                          : activeTab === 'all'
                            ? '발송된 계약서가 없습니다.'
                            : `${tabs.find((tab) => tab.key === activeTab)?.label} 상태의 계약서가 없습니다.`}
                      </p>
                      <p className="text-xs text-on-surface-variant font-korean">
                        오른쪽 상단의 <span className="font-semibold text-primary">계약·문서 전송</span> 버튼으로
                        기사에게 계약서를 보낼 수 있습니다.
                      </p>
                      <Link
                        href="/portal/contracts/new"
                        className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-label font-semibold text-white transition-colors hover:bg-primary/90 font-korean"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        새 계약서 발송
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((contract) => (
                  <tr key={contract.id} className="transition-colors hover:bg-surface-container-low/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary font-korean">
                          {getInitial(contract.drivers?.name)}
                        </span>
                        <span className="text-sm font-body font-semibold text-on-surface font-korean">
                          {contract.drivers?.name ?? '-'}
                        </span>
                      </div>
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
                      {formatDate(contract.sent_at)}
                    </td>
                    <td className="px-6 py-4 text-sm font-data text-on-surface-variant">
                      {formatDate(contract.signed_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {contract.status === 'signed' ? (
                        contract.signed_pdf_url ? (
                          <button
                            onClick={() => openSignedPdf(contract.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-label font-semibold text-primary transition-colors hover:bg-primary/20 font-korean"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
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
                            className="inline-flex items-center gap-1.5 rounded-lg bg-tertiary/10 px-3 py-1.5 text-xs font-label font-semibold text-tertiary transition-colors hover:bg-tertiary/20 font-korean"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <path d="M12 18v-6" />
                              <path d="M9 15h6" />
                            </svg>
                            PDF 생성
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-on-surface-variant/60 font-korean">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Helper card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link
          href="/portal/contracts/new"
          className="group flex items-start gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-headline font-semibold text-on-surface font-korean">계약·문서 전송</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant font-korean">
              기사에게 계약 템플릿이나 일반 문서를 한 번에 전송합니다.
            </p>
          </div>
          <span className="mt-1 text-on-surface-variant transition-transform group-hover:translate-x-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </Link>

        <Link
          href="/portal/contracts/templates"
          className="group flex items-start gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-headline font-semibold text-on-surface font-korean">템플릿 만들기</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant font-korean">
              자주 사용하는 계약서를 템플릿으로 등록해 빠르게 발송할 수 있습니다.
            </p>
          </div>
          <span className="mt-1 text-on-surface-variant transition-transform group-hover:translate-x-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </Link>

        <Link
          href="/portal/amendments"
          className="group flex items-start gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-headline font-semibold text-on-surface font-korean">변경 이력</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant font-korean">
              계약 수정·재발송·해지 등 변경 이력을 시간 순으로 확인합니다.
            </p>
          </div>
          <span className="mt-1 text-on-surface-variant transition-transform group-hover:translate-x-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}
