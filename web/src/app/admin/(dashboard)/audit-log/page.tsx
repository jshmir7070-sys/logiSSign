'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface LogEntry {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_ip: string | null;
  resource: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const EVENT_LABELS: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  auth_success: { label: '로그인 성공', variant: 'success' },
  auth_failure: { label: '로그인 실패', variant: 'error' },
  permission_denied: { label: '권한 거부', variant: 'error' },
  data_modification: { label: '데이터 변경', variant: 'warning' },
  rate_limit_hit: { label: 'Rate Limit', variant: 'warning' },
  integrity_failure: { label: '무결성 실패', variant: 'error' },
  suspicious_activity: { label: '의심 활동', variant: 'error' },
  cron_access: { label: 'CRON 실행', variant: 'info' },
};

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      let query = supabase
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter !== 'all') {
        query = query.eq('event_type', filter);
      }

      const { data } = await query;
      setLogs((data ?? []) as LogEntry[]);
      setLoading(false);
    }
    load();
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">감사 로그</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">시스템 보안 이벤트 및 관리자 활동 기록</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: '전체' },
          { key: 'auth_success', label: '로그인' },
          { key: 'auth_failure', label: '로그인 실패' },
          { key: 'permission_denied', label: '권한 거부' },
          { key: 'data_modification', label: '데이터 변경' },
          { key: 'rate_limit_hit', label: 'Rate Limit' },
          { key: 'integrity_failure', label: '무결성' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
              filter === f.key ? 'bg-primary text-white' : 'bg-surface-container-lowest shadow-ambient text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 로그 테이블 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">시각</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">이벤트</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">IP</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">리소스</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-on-surface-variant font-korean">불러오는 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-on-surface-variant font-korean">기록된 로그가 없습니다</td></tr>
              ) : logs.map(log => {
                const meta = EVENT_LABELS[log.event_type] ?? { label: log.event_type, variant: 'default' as const };
                return (
                  <tr key={log.id} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 text-xs font-data text-on-surface-variant whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3"><Badge label={meta.label} variant={meta.variant} /></td>
                    <td className="px-4 py-3 text-xs font-data text-on-surface-variant">{log.actor_ip ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-on-surface font-korean">{log.resource ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant font-data max-w-[200px] truncate">
                      {JSON.stringify(log.details).slice(0, 80)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
