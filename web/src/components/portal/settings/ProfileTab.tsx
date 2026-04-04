'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface AgencyData {
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  address_detail: string;
  business_number: string;
  email: string;
  invite_code: string;
  owner_birth_date: string;
  business_type: string;
  business_category: string;
  privacy_officer_name: string;
  privacy_officer_phone: string;
  privacy_officer_email: string;
}

const EMPTY: AgencyData = {
  name: '', owner_name: '', phone: '', address: '', address_detail: '',
  business_number: '', email: '', invite_code: '', owner_birth_date: '',
  business_type: '', business_category: '',
  privacy_officer_name: '', privacy_officer_phone: '', privacy_officer_email: '',
};

// 수정 가능한 필드 목록 (사업자번호, 이메일, 주소는 제외)
type EditableField = 'name' | 'owner_name' | 'phone' | 'owner_birth_date' | 'business_type' | 'business_category';

export default function ProfileTab() {
  const [data, setData] = useState<AgencyData>(EMPTY);
  const [editData, setEditData] = useState<AgencyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // 각 필드별 수정 모드
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const aid = user?.app_metadata?.agency_id as string | undefined;
      if (!aid) { setLoading(false); return; }
      setAgencyId(aid);

      const { data: row, error } = await supabase
        .from('agencies')
        .select('name, owner_name, phone, address, address_detail, business_number, email, invite_code, owner_birth_date, business_type, business_category, privacy_officer_name, privacy_officer_phone, privacy_officer_email')
        .eq('id', aid)
        .single();

      if (error || !row) {
        console.error('[ProfileTab] 조회 실패:', error?.message);
        setLoading(false);
        return;
      }

      // logo_url 별도 조회 (컬럼 미존재 방어)
      try {
        const { data: logoRow } = await supabase.from('agencies').select('logo_url').eq('id', aid).single();
        if (logoRow) setLogoUrl((logoRow as Record<string, string>).logo_url ?? null);
      } catch { /* 무시 */ }

      const d = row as Record<string, string>;
      const loaded: AgencyData = {
        name: d.name ?? '', owner_name: d.owner_name ?? '', phone: d.phone ?? '',
        address: d.address ?? '', address_detail: d.address_detail ?? '',
        business_number: d.business_number ?? '', email: d.email ?? '',
        invite_code: d.invite_code ?? '', owner_birth_date: d.owner_birth_date ?? '',
        business_type: d.business_type ?? '', business_category: d.business_category ?? '',
        privacy_officer_name: d.privacy_officer_name ?? '',
        privacy_officer_phone: d.privacy_officer_phone ?? '',
        privacy_officer_email: d.privacy_officer_email ?? '',
      };
      setData(loaded);
      setEditData(loaded);
      setLoading(false);
    }
    load();
  }, []);

  // 변경 감지
  useEffect(() => {
    const changed = (Object.keys(data) as (keyof AgencyData)[]).some(k => data[k] !== editData[k]);
    setHasChanges(changed);
  }, [data, editData]);

  // ── 필드별 수정 토글 ──
  const toggleEdit = (field: EditableField) => {
    setEditingFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        // 취소 — 원래 값 복원
        next.delete(field);
        setEditData(p => ({ ...p, [field]: data[field] }));
      } else {
        next.add(field);
      }
      return next;
    });
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!agencyId) return;
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('agencies').update({
      name: editData.name,
      owner_name: editData.owner_name,
      phone: editData.phone,
      owner_birth_date: editData.owner_birth_date || null,
      business_type: editData.business_type || null,
      business_category: editData.business_category || null,
      privacy_officer_name: editData.privacy_officer_name || null,
      privacy_officer_phone: editData.privacy_officer_phone || null,
      privacy_officer_email: editData.privacy_officer_email || null,
    }).eq('id', agencyId);
    setSaving(false);

    if (error) {
      setSaveMessage({ type: 'error', text: '저장 실패: ' + error.message });
    } else {
      setData(editData);
      setEditingFields(new Set());
      setSaveMessage({ type: 'success', text: '저장되었습니다.' });
    }
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // ── 로고 ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agencyId) return;
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('파일 크기는 2MB 이하만 가능합니다'); return; }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/agency/logo', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok || result.error) alert('업로드 실패: ' + (result.error ?? ''));
      else setLogoUrl(result.logoUrl);
    } catch { alert('업로드 중 오류'); }
    setLogoUploading(false);
  };

  const handleLogoDelete = async () => {
    if (!agencyId) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({ logo_url: null }).eq('id', agencyId);
    setLogoUrl(null);
  };

  // ── 필드 렌더러 ──

  /** 읽기 전용 (수정 불가) */
  const FixedField = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <div>
      <p className="text-xs font-medium text-on-surface-variant mb-1 font-korean">{label}</p>
      <p className="h-11 flex items-center px-4 rounded-xl bg-surface-container-high/50 text-on-surface/70 text-sm font-data">
        {value || <span className="text-on-surface-variant/40">—</span>}
      </p>
      {note && <p className="text-[11px] text-on-surface-variant/50 mt-1 font-korean">{note}</p>}
    </div>
  );

  /** 수정 가능 필드 (개별 수정 버튼) */
  const Field = ({ label, field, placeholder, dataFont }: { label: string; field: EditableField; placeholder?: string; dataFont?: boolean }) => {
    const isEditing = editingFields.has(field);
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-on-surface-variant font-korean">{label}</p>
          <button
            type="button"
            onClick={() => toggleEdit(field)}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
              isEditing
                ? 'text-error bg-error/10 hover:bg-error/20'
                : 'text-primary bg-primary/10 hover:bg-primary/20'
            }`}
          >
            {isEditing ? '취소' : '수정'}
          </button>
        </div>
        {isEditing ? (
          <input
            type="text"
            value={editData[field]}
            onChange={e => setEditData(p => ({ ...p, [field]: e.target.value }))}
            placeholder={placeholder}
            autoFocus
            className={`w-full h-11 px-4 rounded-xl bg-white border-2 border-primary/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${dataFont ? 'font-data' : 'font-korean'}`}
          />
        ) : (
          <p className={`h-11 flex items-center px-4 rounded-xl bg-surface-container-low/50 text-on-surface text-sm ${dataFont ? 'font-data' : 'font-korean'}`}>
            {data[field] || <span className="text-on-surface-variant/40">—</span>}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 flex items-center justify-center h-48">
        <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
      <h2 className="text-lg font-headline font-bold text-on-surface font-korean">대리점 정보</h2>

      {/* 로고 업로드 */}
      <div className="flex items-start gap-6 p-5 rounded-xl bg-surface-container-low/50 border border-outline-variant/15">
        <div className="flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="로고" className="w-24 h-24 object-contain rounded-xl border border-outline-variant/20 bg-white p-1" />
          ) : (
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-outline-variant/30 flex items-center justify-center bg-surface-container-lowest">
              <span className="text-2xl">🏢</span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-on-surface font-korean mb-1">회사 로고</p>
          <p className="text-xs text-on-surface-variant font-korean mb-3">정산서 PDF와 기사 앱에 표시됩니다 · PNG/JPG · 2MB 이하</p>
          <div className="flex items-center gap-2">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
              className="h-9 px-4 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors font-korean disabled:opacity-50">
              {logoUploading ? '업로드 중...' : logoUrl ? '로고 변경' : '로고 업로드'}
            </button>
            {logoUrl && (
              <button onClick={handleLogoDelete} className="h-9 px-4 rounded-lg bg-error/10 text-error text-xs font-semibold hover:bg-error/20 transition-colors font-korean">삭제</button>
            )}
          </div>
        </div>
      </div>

      {/* 초대코드 */}
      <div className="flex items-center gap-4 p-5 rounded-xl bg-primary/5 border border-primary/15">
        <div className="flex-1">
          <p className="text-xs font-semibold text-on-surface font-korean mb-1">📨 기사 초대코드</p>
          {data.invite_code ? (
            <p className="text-2xl font-data font-bold text-primary tracking-[0.3em] select-all cursor-pointer"
              onClick={(e) => { (e.target as HTMLElement).ownerDocument.defaultView?.getSelection()?.selectAllChildren(e.target as HTMLElement); }}>
              {data.invite_code}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant font-korean">코드가 생성되지 않았습니다.</p>
          )}
          <p className="text-[11px] text-on-surface-variant mt-1 font-korean">기사에게 이 코드를 전달하면 앱에서 가입 시 자동으로 소속이 연결됩니다</p>
        </div>
        <button
          onClick={() => {
            if (data.invite_code) {
              navigator.clipboard.writeText(data.invite_code);
              setSaveMessage({ type: 'success', text: '초대코드가 복사되었습니다.' });
              setTimeout(() => setSaveMessage(null), 2000);
            }
          }}
          className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-label font-semibold hover:bg-primary/90 transition-colors font-korean shrink-0"
        >복사</button>
      </div>

      {/* 사업자 정보 */}
      <div className="grid grid-cols-2 gap-5">
        <Field label="대리점명 (상호)" field="name" />
        <FixedField label="사업자등록번호" value={data.business_number} note="슈퍼관리자만 변경 가능" />
        <Field label="대표자명" field="owner_name" />
        <Field label="대표자 생년월일" field="owner_birth_date" placeholder="1990-01-01" dataFont />
        <Field label="연락처" field="phone" dataFont />
        <FixedField label="이메일" value={data.email} note="변경 불가" />
        <Field label="업태" field="business_type" placeholder="운수및창고업" />
        <Field label="종목" field="business_category" placeholder="기타육상운송서비스업" />

        {/* 주소 — 출력 전용 */}
        <div className="col-span-2">
          <p className="text-xs font-medium text-on-surface-variant mb-1 font-korean">주소</p>
          <p className="h-11 flex items-center px-4 rounded-xl bg-surface-container-low/50 text-on-surface text-sm font-korean">
            {data.address
              ? <>{data.address}{data.address_detail ? ` ${data.address_detail}` : ''}</>
              : <span className="text-on-surface-variant/40">등록된 주소 없음</span>}
          </p>
        </div>

        {/* 개인정보보호 담당자 */}
        <div className="col-span-2 pt-4 border-t border-outline-variant/20">
          <p className="text-xs font-semibold text-on-surface font-korean mb-3 flex items-center gap-1.5">
            🛡️ 개인정보보호 담당자
            <span className="text-on-surface-variant/50 font-normal">(개인정보보호법 제31조)</span>
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1 font-korean">담당자 이름</label>
              <input type="text" value={editData.privacy_officer_name}
                onChange={e => setEditData(f => ({ ...f, privacy_officer_name: e.target.value }))}
                placeholder="홍길동"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1 font-korean">연락처</label>
              <input type="tel" value={editData.privacy_officer_phone}
                onChange={e => setEditData(f => ({ ...f, privacy_officer_phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1 font-korean">이메일</label>
              <input type="email" value={editData.privacy_officer_email}
                onChange={e => setEditData(f => ({ ...f, privacy_officer_email: e.target.value }))}
                placeholder="privacy@company.com"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant/50 mt-2 font-korean">기사 앱 개인정보처리방침에 표시됩니다</p>
        </div>
      </div>

      {/* 하단 저장 버튼 */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-outline-variant/10">
        {saveMessage && (
          <p className={`text-sm font-korean ${saveMessage.type === 'success' ? 'text-tertiary' : 'text-error'}`}>
            {saveMessage.type === 'success' ? '✅' : '❌'} {saveMessage.text}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all font-korean disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
