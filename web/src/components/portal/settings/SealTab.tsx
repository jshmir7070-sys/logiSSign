'use client';

import { useEffect, useState } from 'react';
import SealGenerator from '@/components/shared/SealGenerator';
import {
  type SealRecord,
  type SealCategory,
  type SealScript,
  getSeals,
  saveSealRecord,
  uploadSealImage,
  deleteSeal,
  setDefaultSeal,
} from '@/services/seal.service';

export default function SealTab({ agencyId }: { agencyId: string }) {
  const [seals, setSeals] = useState<SealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSeals = async () => {
    setLoading(true);
    const data = await getSeals('agency', agencyId);
    setSeals(data);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadSeals(); }, [agencyId]);

  const handleSealComplete = async (
    dataUri: string,
    meta: { category: SealCategory; script: SealScript; nameText: string }
  ) => {
    setSaving(true);
    const { url, error: uploadErr } = await uploadSealImage('agency', agencyId, dataUri);
    if (uploadErr) {
      alert('도장 이미지 저장 실패: ' + uploadErr + '\n\nSupabase Storage에 "seals" 버킷이 생성되어 있는지 확인하세요.');
      setSaving(false);
      return;
    }
    const { error: saveErr } = await saveSealRecord({
      owner_type: 'agency',
      owner_id: agencyId,
      category: meta.category,
      script: meta.script,
      seal_image_url: url,
      seal_data_uri: dataUri,
      name_text: meta.nameText,
      is_default: seals.length === 0,
    });
    if (saveErr) {
      alert('도장 정보 저장 실패: ' + saveErr);
    }
    setSaving(false);
    setShowGenerator(false);
    loadSeals();
  };

  const handleDelete = async (sealId: string) => {
    if (!confirm('이 도장을 삭제하시겠습니까?')) return;
    await deleteSeal(sealId);
    loadSeals();
  };

  const handleSetDefault = async (sealId: string) => {
    await setDefaultSeal(sealId, 'agency', agencyId);
    loadSeals();
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">도장 관리</h2>
            <p className="text-sm text-on-surface-variant font-korean mt-1">계약서에 사용할 도장을 생성하거나 업로드하세요</p>
          </div>
          {!showGenerator && (
            <button
              onClick={() => setShowGenerator(true)}
              className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
              새 도장 만들기
            </button>
          )}
        </div>

        {showGenerator ? (
          <div className="border border-outline-variant/20 rounded-2xl p-6 bg-surface-container-low/50">
            <SealGenerator
              onComplete={handleSealComplete}
              onCancel={() => setShowGenerator(false)}
            />
            {saving && (
              <div className="mt-4 text-center text-sm text-primary font-korean">저장 중...</div>
            )}
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-sm text-on-surface-variant font-korean">불러오는 중...</div>
        ) : seals.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v3m0 0v1"/></svg>
            </div>
            <p className="text-sm text-on-surface-variant font-korean">등록된 도장이 없습니다</p>
            <p className="text-xs text-on-surface-variant/50 font-korean mt-1">&apos;새 도장 만들기&apos;를 클릭하여 도장을 생성하세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {seals.map((seal) => (
              <div key={seal.id} className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                seal.is_default ? 'border-primary bg-primary/[0.03]' : 'border-outline-variant/15'
              }`}>
                {seal.is_default && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold font-korean">기본</div>
                )}
                <div className="w-20 h-20 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={seal.seal_data_uri || seal.seal_image_url}
                    alt={seal.name_text}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <p className="text-xs text-on-surface font-semibold font-korean">{seal.name_text}</p>
                <div className="flex gap-2">
                  {!seal.is_default && (
                    <button
                      onClick={() => handleSetDefault(seal.id)}
                      className="text-[11px] text-primary font-korean hover:underline"
                    >
                      기본 설정
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(seal.id)}
                    className="text-[11px] text-error font-korean hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
