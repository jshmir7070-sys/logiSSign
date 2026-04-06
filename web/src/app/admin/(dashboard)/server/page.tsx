'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';

interface ServiceHealth {
  name: string;
  status: 'normal' | 'warning' | 'error';
  detail: string;
}

interface SentryIssueSummary {
  id: string;
  title: string;
  level: string;
  count: number;
  lastSeen: string;
  permalink: string;
  project: string;
}

interface ServerStatusResponse {
  services: ServiceHealth[];
  dbStats: { tables: number; totalRows: number };
  incidents: { id: string; event_type: string; severity: string; resource: string | null; created_at: string }[];
  opsSummary: {
    failedPayments: number;
    pendingVirtualAccounts: number;
    pendingContracts: number;
    pendingDocuments: number;
  };
  recentPaymentFailures: { id: string; title: string; created_at: string; agency_name: string }[];
  recentSentryIssues: SentryIssueSummary[];
  sentryConfigured: boolean;
}

const STATUS_COLOR: Record<ServiceHealth['status'], string> = {
  normal: 'text-tertiary',
  warning: 'text-amber-600',
  error: 'text-error',
};

const STATUS_LABEL: Record<ServiceHealth['status'], string> = {
  normal: '정상',
  warning: '주의',
  error: '장애',
};

export default function ServerPage() {
  const [data, setData] = useState<ServerStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/server-status');
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || '서버 상태를 불러오지 못했습니다.');
        }
        setData(payload);
      } catch (error) {
        alert(error instanceof Error ? error.message : '서버 상태를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">서버 상태</h2>
        <p className="mt-1 text-[14px] text-on-surface-variant">
          핵심 서비스 운영 상태와 최근 장애 징후, 보안 이벤트를 한 화면에서 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? [1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-[120px] animate-pulse rounded-2xl bg-surface-container-lowest p-6 shadow-ambient"
              />
            ))
          : (data?.services ?? []).map((service) => (
              <div key={service.name} className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-headline text-[15px] font-bold text-on-surface">{service.name}</span>
                  <span className={`text-[13px] font-semibold ${STATUS_COLOR[service.status]}`}>
                    {STATUS_LABEL[service.status]}
                  </span>
                </div>
                <p className="text-[12px] leading-5 text-on-surface-variant">{service.detail}</p>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="mb-4 font-headline text-[16px] font-bold text-on-surface">운영 위험 요약</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">결제 실패</p>
              <p className="mt-1 text-2xl font-bold text-error">{data?.opsSummary.failedPayments ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">가상계좌 입금 대기</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {data?.opsSummary.pendingVirtualAccounts ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">미서명 계약</p>
              <p className="mt-1 text-2xl font-bold text-primary">{data?.opsSummary.pendingContracts ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">미완료 문서</p>
              <p className="mt-1 text-2xl font-bold text-primary">{data?.opsSummary.pendingDocuments ?? 0}</p>
            </div>
          </div>
          {data?.dbStats ? (
            <p className="mt-4 text-sm text-on-surface-variant">
              집계 기준 테이블 {data.dbStats.tables}개, 총 레코드 {data.dbStats.totalRows.toLocaleString()}건
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-4">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 Sentry 이슈</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {data?.sentryConfigured
                ? '최근 미해결 오류를 기준으로 확인합니다.'
                : 'Sentry 설정이 연결되지 않았습니다.'}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-on-surface-variant">불러오는 중입니다...</p>
          ) : !data?.sentryConfigured ? (
            <p className="text-sm text-on-surface-variant">
              Sentry 환경 변수를 설정하면 실제 오류 이슈를 이 화면에서 바로 확인할 수 있습니다.
            </p>
          ) : (data?.recentSentryIssues ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">현재 열려 있는 최근 오류 이슈가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {(data?.recentSentryIssues ?? []).map((issue) => (
                <div key={issue.id} className="rounded-xl border border-outline-variant/15 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface">{issue.title}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {issue.project} · {issue.count.toLocaleString()}회 발생
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        마지막 발생 {new Date(issue.lastSeen).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <Badge
                      label={issue.level}
                      variant={issue.level === 'error' || issue.level === 'fatal' ? 'error' : 'warning'}
                    />
                  </div>
                  {issue.permalink ? (
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Sentry에서 보기
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
