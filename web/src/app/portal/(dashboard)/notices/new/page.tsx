'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { createNotice } from '@/services/notice.service';
import { notifyNewNotice } from '@/services/push.service';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 800;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CATEGORIES = [
  { id: 'notice', label: '공지' },
  { id: 'guide', label: '안내' },
  { id: 'update', label: '업데이트' },
] as const;

export default function NewNoticePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('notice');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // agency_id 로드
  useState(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      setAgencyId(data.user?.app_metadata?.agency_id as string ?? null);
    });
  });

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');

    // 타입 체크
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('JPG, PNG, WebP 이미지만 업로드 가능합니다.');
      return;
    }

    // 용량 체크
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError(`이미지 크기는 ${MAX_IMAGE_SIZE / 1024 / 1024}MB 이하만 가능합니다. (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    // 해상도 체크
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
        setImageError(`이미지 해상도는 ${MAX_IMAGE_WIDTH}×${MAX_IMAGE_HEIGHT}px 이하만 가능합니다. (현재: ${img.width}×${img.height}px)`);
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    };
    img.onerror = () => {
      setImageError('이미지 파일을 읽을 수 없습니다.');
    };
    img.src = URL.createObjectURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // 게시
  const handlePublish = async () => {
    if (!agencyId || !title.trim() || !content.trim()) {
      setError('제목과 내용을 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');

    let attachmentUrl: string | null = null;

    // 이미지 업로드
    if (imageFile) {
      const supabase = createBrowserSupabaseClient();
      const fileName = `notices/${agencyId}/${Date.now()}_${imageFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(fileName, imageFile, { contentType: imageFile.type });

      if (uploadErr) {
        setError('이미지 업로드 실패: ' + uploadErr.message);
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      attachmentUrl = urlData?.publicUrl ?? null;
    }

    // 공지 생성
    const result = await createNotice({
      agency_id: agencyId,
      title: title.trim(),
      content: content.trim(),
      category: category as 'notice' | 'guide' | 'update',
    });

    if (result.error) {
      setError('공지 등록 실패: ' + result.error);
      setSaving(false);
      return;
    }

    // attachment_url 업데이트
    if (attachmentUrl && result.data) {
      const supabase = createBrowserSupabaseClient();
      await supabase.from('notices').update({ attachment_url: attachmentUrl }).eq('id', result.data.id);
    }

    // 소속 기사들에게 푸시 알림
    try {
      await notifyNewNotice(agencyId, title.trim());
    } catch { /* 푸시 실패 무시 */ }

    setSaving(false);
    router.push('/portal/notices');
  };

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30';

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
        {/* 카테고리 */}
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">카테고리</label>
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
                  category === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">제목 *</label>
          <input
            type="text"
            placeholder="공지 제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">내용 *</label>
          <textarea
            placeholder="공지 내용을 작성하세요"
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* 이미지 업로드 */}
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
            이미지 첨부 <span className="text-on-surface-variant/50">(선택)</span>
          </label>

          {/* 규칙 안내 */}
          <div className="flex items-center gap-4 mb-3 text-[11px] text-on-surface-variant/60 font-korean">
            <span>📏 최대 {MAX_IMAGE_WIDTH}×{MAX_IMAGE_HEIGHT}px</span>
            <span>📦 최대 {MAX_IMAGE_SIZE / 1024 / 1024}MB</span>
            <span>🖼️ JPG, PNG, WebP</span>
          </div>

          {imagePreview ? (
            <div className="relative inline-block">
              <Image
                src={imagePreview}
                alt="미리보기"
                width={400}
                height={300}
                className="rounded-xl border border-outline-variant/20 object-contain max-h-[300px] w-auto"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-error text-white flex items-center justify-center text-sm shadow-md hover:bg-error/80"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="block cursor-pointer">
              <div className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-colors ${
                imageError ? 'border-error/40 bg-error/5' : 'border-outline-variant/30 hover:border-primary/40 hover:bg-primary/[0.02]'
              }`}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={imageError ? '#dc2626' : '#94a3b8'} strokeWidth="1.5" className="mb-2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <p className="text-sm text-on-surface-variant font-korean">클릭하여 이미지를 선택하세요</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
          )}

          {imageError && (
            <p className="mt-2 text-xs text-error font-korean flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              {imageError}
            </p>
          )}
        </div>

        {/* 안내 */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
          <p className="text-xs text-primary font-korean font-semibold mb-1">📢 공지 발송 안내</p>
          <p className="text-xs text-on-surface-variant font-korean">
            게시하기를 누르면 소속 기사들의 앱에 푸시 알림이 발송됩니다. 기사 앱의 공지사항 탭에서 확인할 수 있습니다.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-error font-korean">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={handlePublish}
          disabled={saving || !title.trim() || !content.trim()}
          className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all font-korean disabled:opacity-50"
        >
          {saving ? '게시 중...' : '게시하기'}
        </button>
      </div>
    </div>
  );
}
