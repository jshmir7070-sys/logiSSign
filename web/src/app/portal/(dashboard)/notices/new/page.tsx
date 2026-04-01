'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewNoticePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    category: 'notice',
    content: '',
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">공지 작성</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">소속 기사에게 전달할 공지사항을 작성합니다</p>
        </div>
        <button
          onClick={() => router.back()}
          className="h-10 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm font-medium hover:bg-surface-container-highest transition-colors font-korean"
        >
          취소
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">카테고리</label>
          <div className="flex gap-2">
            {[
              { id: 'notice', label: '공지' },
              { id: 'guide', label: '안내' },
              { id: 'update', label: '업데이트' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setForm({ ...form, category: cat.id })}
                className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
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

        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">제목</label>
          <input
            type="text"
            placeholder="공지 제목을 입력하세요"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">내용</label>
          <textarea
            placeholder="공지 내용을 작성하세요"
            rows={12}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">첨부파일</label>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-low">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant/40">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
            </svg>
            <span className="text-sm text-on-surface-variant/60 font-korean">파일을 드래그하거나 클릭하여 업로드</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label font-medium text-sm hover:bg-surface-container-highest transition-colors font-korean">
          임시저장
        </button>
        <button className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all font-korean">
          게시하기
        </button>
      </div>
    </div>
  );
}
