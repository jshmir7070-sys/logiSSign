'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getNotices, type NoticeListItem } from '@/services/notice.service';

const categoryLabel: Record<string, string> = {
  notice: '공지',
  update: '업데이트',
  guide: '안내',
  important: '중요',
};

const categoryVariant: Record<string, 'error' | 'info' | 'default'> = {
  important: 'error',
  update: 'info',
  notice: 'default',
  guide: 'default',
};

export default function NoticesPage() {
  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const agencyId = user.app_metadata?.agency_id as string | undefined;
      if (!agencyId) return;

      const result = await getNotices(agencyId);
      if (result.data) setNotices(result.data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">
            <span className="font-korean">공지사항</span>
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            대리점 운영 관련 공지사항을 확인하세요
          </p>
        </div>
        <Link
          href="/portal/notices/new"
          className="bg-power-gradient text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          <span className="font-korean">공지 작성</span>
        </Link>
      </div>

      {/* Notice Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 text-center">
            <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 text-center">
            <span className="text-sm text-on-surface-variant font-korean">등록된 공지사항이 없습니다</span>
          </div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 hover:bg-surface-container-low/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Badge
                      label={notice.category ? (categoryLabel[notice.category] ?? notice.category) : '공지'}
                      variant={notice.category ? (categoryVariant[notice.category] ?? 'default') : 'default'}
                    />
                    {notice.created_by_type === 'provider' && (
                      <Badge label="본사" variant="info" />
                    )}
                    <h3 className="text-base font-body font-semibold text-on-surface font-korean">
                      {notice.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-on-surface-variant font-korean leading-relaxed line-clamp-2">
                    {notice.content}
                  </p>
                </div>
                <span className="text-xs font-data text-on-surface-variant whitespace-nowrap">
                  {notice.published_at
                    ? new Date(notice.published_at).toLocaleDateString('ko-KR')
                    : new Date(notice.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
