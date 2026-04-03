'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface ServiceHealth {
  name: string;
  icon: string;
  status: 'normal' | 'warning' | 'error';
  detail: string;
}

interface RecentIncident {
  id: string;
  event_type: string;
  severity: string;
  resource: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  normal: 'text-tertiary',
  warning: 'text-amber-600',
  error: 'text-error',
};

const STATUS_LABEL: Record<string, string> = {
  normal: '정상',
  warning: '지연',
  error: '장애',
};

export default function ServerPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [incidents, setIncidents] = useState<RecentIncident[]>([]);
  const [dbStats, setDbStats] = useState<{ tables: number; totalRows: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const startTime = Date.now();

      // 1. DB connectivity check — measure latency
      const { count: agencyCount, error: dbError } = await supabase
        .from('agencies')
        .select('id', { count: 'exact', head: true });
      const dbLatency = Date.now() - startTime;

      // 2. Storage check
      const storageStart = Date.now();
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      const storageLatency = Date.now() - storageStart;

      // 3. Auth check
      const authStart = Date.now();
      const { data: session } = await supabase.auth.getSession();
      const authLatency = Date.now() - authStart;

      // 4. Recent critical/warning security events
      const { data: recentEvents } = await supabase
        .from('security_logs')
        .select('id, event_type, severity, resource, created_at')
        .in('severity', ['warning', 'critical'])
        .order('created_at', { ascending: false })
        .limit(20);

      // 5. Table counts for stats
      const counts = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('settlements').select('id', { count: 'exact', head: true }),
      ]);
      const totalRows = (agencyCount ?? 0) + counts.reduce((s, c) => s + (c.count ?? 0), 0);

      // Build service health from actual checks
      const svcList: ServiceHealth[] = [
        {
          name: 'Database',
          icon: 'storage',
          status: dbError ? 'error' : dbLatency > 2000 ? 'warning' : 'normal',
          detail: dbError ? `연결 실패: ${dbError.message}` : `응답: ${dbLatency}ms · 구독사 ${agencyCount ?? 0}개`,
        },
        {
          name: 'Storage',
          icon: 'cloud_upload',
          status: storageError ? 'error' : storageLatency > 3000 ? 'warning' : 'normal',
          detail: storageError ? `연결 실패` : `응답: ${storageLatency}ms · 버킷 ${buckets?.length ?? 0}개`,
        },
        {
          name: 'Auth',
          icon: 'lock',
          status: authLatency > 3000 ? 'warning' : 'normal',
          detail: `응답: ${authLatency}ms · 세션: ${session?.session ? '활성' : '없음'}`,
        },
        {
          name: 'Supabase 전체',
          icon: 'dns',
          status: dbError || storageError ? 'error' : (dbLatency > 2000 || storageLatency > 3000) ? 'warning' : 'normal',
          detail: dbError || storageError ? '일부 서비스 장애' : '전체 정상',
        },
      ];

      setServices(svcList);
      setIncidents((recentEvents ?? []) as unknown as RecentIncident[]);
      setDbStats({ tables: 4, totalRows }); // 4 main tables checked
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">서버 상태</h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">핵심 서비스 가동 현황 및 장애 이력</p>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-4 gap-5">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 h-[120px] animate-pulse" />
          ))
        ) : services.map((svc) => (
          <div key={svc.name} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant">{svc.icon}</span>
              <span className="font-headline text-on-surface text-[15px] font-bold">{svc.name}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${svc.status === 'normal' ? 'bg-tertiary' : svc.status === 'warning' ? 'bg-amber-500' : 'bg-error'}`} />
              <span className={`text-[14px] font-semibold ${STATUS_COLOR[svc.status]}`}>
                {STATUS_LABEL[svc.status]}
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant mt-1">{svc.detail}</p>
          </div>
        ))}
      </div>

      {/* DB Stats */}
      {dbStats && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-2">데이터베이스 현황</h3>
          <p className="text-sm text-on-surface-variant">주요 테이블 총 레코드: <span className="font-semibold text-on-surface">{dbStats.totalRows.toLocaleString()}건</span></p>
        </div>
      )}

      {/* Incident History */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <h3 className="font-headline text-on-surface text-[16px] font-bold mb-4">최근 보안 이벤트</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">시각</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">이벤트</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">심각도</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">대상</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-on-surface-variant">불러오는 중...</td></tr>
              ) : incidents.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-on-surface-variant">최근 보안 이벤트가 없습니다</td></tr>
              ) : incidents.map(inc => (
                <tr key={inc.id} className="hover:bg-surface-container-low/50">
                  <td className="px-4 py-3 text-xs font-data text-on-surface-variant whitespace-nowrap">
                    {new Date(inc.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface">{inc.event_type}</td>
                  <td className="px-4 py-3">
                    <Badge label={inc.severity} variant={inc.severity === 'critical' ? 'error' : 'warning'} />
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{inc.resource ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
