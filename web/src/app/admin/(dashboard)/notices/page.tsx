'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database';

type NoticeRow = Database['public']['Tables']['notices']['Row'];

const categoryLabel: Record<string, string> = {
  notice: '공지',
  update: '업데이트',
  guide: '안내',
  etc: '기타',
};

const statusBadgeVariant: Record<string, 'success' | 'warning' | 'default'> = {
  published: 'success',
  draft: 'warning',
};

const statusLabel: Record<string, string> = {
  published: '게시중',
  draft: '임시저장',
};

const targetLabel: Record<string, string> = {
  all: '전체',
  agency: '대리점',
};

const targetBadgeVariant: Record<string, 'info' | 'success' | 'default'> = {
  all: 'default',
  agency: 'info',
};

const createdByLabel: Record<string, string> = {
  provider: '본사',
  agency: '대리점',
};

export default function NoticesPage() {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setNotices(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
            공지 관리
          </h2>
          <p className="font-body text-on-surface-variant text-[14px] mt-1">
            구독사 대상 공지사항 관리
          </p>
        </div>
        <Link
          href="/admin/notices/new"
          className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            edit_note
          </span>
          공지 작성
        </Link>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        {loading ? (
          <div className="text-center py-12">
            <span className="text-sm text-on-surface-variant">불러오는 중...</span>
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-sm text-on-surface-variant">등록된 공지사항이 없습니다</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-l-xl w-[40%]">
                    제목
                  </th>
                  <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                    작성자
                  </th>
                  <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                    대상
                  </th>
                  <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                    카테고리
                  </th>
                  <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                    작성일
                  </th>
                  <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-r-xl">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {notices.map((notice) => (
                  <tr
                    key={notice.id}
                    className="group hover:bg-surface-container-lowest/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-body text-on-surface text-[14px] font-medium group-hover:text-primary transition-colors">
                        {notice.title}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        label={notice.created_by_type ? (createdByLabel[notice.created_by_type] ?? notice.created_by_type) : '-'}
                        variant={notice.created_by_type === 'provider' ? 'info' : 'default'}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        label={targetLabel[notice.target_type] ?? notice.target_type}
                        variant={targetBadgeVariant[notice.target_type] ?? 'default'}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-body text-on-surface-variant text-[13px]">
                        {notice.category ? (categoryLabel[notice.category] ?? notice.category) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-data text-on-surface-variant text-[13px]">
                        {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        label={statusLabel[notice.status] ?? notice.status}
                        variant={statusBadgeVariant[notice.status] ?? 'default'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
