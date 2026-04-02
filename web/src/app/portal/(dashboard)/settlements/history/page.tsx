'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getSettlementJobs, type SettlementJobRow } from '@/services/settlement-template.service';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued: { label: '대기중', color: 'bg-surface-container-high text-on-surface-variant' },
  processing: { label: '처리중', color: 'bg-primary/10 text-primary' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  failed: { label: '실패', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', color: 'bg-gray-100 text-gray-600' },
};

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export default function SettlementHistoryPage() {
  const [jobs, setJobs] = useState<SettlementJobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const agencyId = user.app_metadata?.agency_id as string;
      if (!agencyId) { setLoading(false); return; }
      const result = await getSettlementJobs(agencyId);
      setJobs(result);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">정산 생성 이력</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">정산서 일괄 생성 작업 이력을 관리합니다</p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
        {loading ? (
          <div className="p-12 text-center text-sm text-on-surface-variant font-korean">불러오는 중...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-surface-container-high flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-on-surface-variant/40">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-sm text-on-surface-variant font-korean">생성 이력이 없습니다</p>
            <p className="text-xs text-on-surface-variant/50 font-korean mt-1">정산서 빌더에서 일괄 생성을 실행하세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/15">
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">생성일시</th>
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">정산월</th>
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">기사수</th>
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">상태</th>
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">처리시간</th>
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">파일</th>
                  <th className="px-6 py-4 text-xs font-label font-semibold text-on-surface-variant font-korean">다운로드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {jobs.map(job => {
                  const st = STATUS_LABELS[job.status] ?? STATUS_LABELS.queued;
                  return (
                    <tr key={job.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-data text-on-surface">
                        {new Date(job.created_at).toLocaleDateString('ko-KR')}
                        <span className="text-on-surface-variant/60 ml-1">
                          {new Date(job.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-data text-on-surface">{job.year_month ?? '-'}</td>
                      <td className="px-6 py-4 text-sm font-data text-on-surface">
                        {job.completed_drivers}/{job.total_drivers}명
                        {job.failed_drivers > 0 && (
                          <span className="text-error ml-1">({job.failed_drivers} 실패)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-korean ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-data text-on-surface-variant">
                        {job.processing_time_ms
                          ? job.processing_time_ms < 1000
                            ? `${job.processing_time_ms}ms`
                            : `${(job.processing_time_ms / 1000).toFixed(1)}초`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant font-korean truncate max-w-[150px]">
                        {job.original_filename ?? '-'}
                      </td>
                      <td className="px-6 py-4">
                        {job.output_url ? (
                          <a href={job.output_url} target="_blank" rel="noopener noreferrer"
                            className="h-8 px-4 rounded-lg bg-primary/10 text-primary text-xs font-semibold font-korean hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            ZIP
                          </a>
                        ) : (
                          <span className="text-xs text-on-surface-variant/40 font-korean">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
