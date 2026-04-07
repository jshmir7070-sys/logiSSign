'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { NoticeCategory, NoticeTargetType } from '@/types/database';

export default function AdminNewNoticePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    target: 'all' as NoticeTargetType,
    category: 'notice' as NoticeCategory,
    content: '',
    scheduledAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (status: 'published' | 'draft') => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('제목과 내용을 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');

    const supabase = createBrowserSupabaseClient();

    const insertData = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      target_type: form.target,
      created_by_type: 'provider' as const,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    };

    const { error: insertError } = await supabase
      .from('notices')
      .insert(insertData);

    if (insertError) {
      setError('공지 저장 실패: ' + insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push('/admin/notices');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">공지 작성</h2>
          <p className="font-body text-on-surface-variant text-[14px] mt-1">구독사에게 전달할 공지를 작성합니다</p>
        </div>
        <button
          onClick={() => router.back()}
          className="h-10 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm font-medium hover:bg-surface-container-highest transition-colors"
        >
          취소
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">대상</label>
            <div className="flex gap-2">
              {[
                { id: 'all' as NoticeTargetType, label: '전체' },
                { id: 'agency' as NoticeTargetType, label: '고객사' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setForm({ ...form, target: t.id })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-label font-medium transition-colors ${
                    form.target === t.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">카테고리</label>
            <div className="flex gap-2">
              {[
                { id: 'notice' as NoticeCategory, label: '공지' },
                { id: 'update' as NoticeCategory, label: '업데이트' },
                { id: 'guide' as NoticeCategory, label: '가이드' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setForm({ ...form, category: cat.id })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-label font-medium transition-colors ${
                    form.category === cat.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">제목</label>
          <input
            type="text"
            placeholder="공지 제목"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-body placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">내용</label>
          <textarea
            placeholder="공지 내용을 작성하세요"
            rows={10}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-body placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">예약 게시 (선택)</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            className="w-64 h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => handleSave('draft')}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label font-medium text-sm hover:bg-surface-container-highest transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '임시저장'}
        </button>
        <button
          onClick={() => handleSave('published')}
          disabled={saving || !form.title.trim() || !form.content.trim()}
          className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-50"
        >
          {saving ? '게시 중...' : '게시하기'}
        </button>
      </div>
    </div>
  );
}
