'use client';

import { useEffect, useRef, useState } from 'react';

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
  logo_url?: string | null;
}

const EMPTY: AgencyData = {
  name: '',
  owner_name: '',
  phone: '',
  address: '',
  address_detail: '',
  business_number: '',
  email: '',
  invite_code: '',
  owner_birth_date: '',
  business_type: '',
  business_category: '',
  privacy_officer_name: '',
  privacy_officer_phone: '',
  privacy_officer_email: '',
  logo_url: null,
};

type EditableField =
  | 'name'
  | 'owner_name'
  | 'phone'
  | 'owner_birth_date'
  | 'business_type'
  | 'business_category';

export default function ProfileTab() {
  const [data, setData] = useState<AgencyData>(EMPTY);
  const [editData, setEditData] = useState<AgencyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/agency/profile', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || result.error || !result.data) {
          console.error('[ProfileTab] load failed:', result.error);
          setLoading(false);
          return;
        }

        const loaded: AgencyData = {
          name: result.data.name ?? '',
          owner_name: result.data.owner_name ?? '',
          phone: result.data.phone ?? '',
          address: result.data.address ?? '',
          address_detail: result.data.address_detail ?? '',
          business_number: result.data.business_number ?? '',
          email: result.data.email ?? '',
          invite_code: result.data.invite_code ?? '',
          owner_birth_date: result.data.owner_birth_date ?? '',
          business_type: result.data.business_type ?? '',
          business_category: result.data.business_category ?? '',
          privacy_officer_name: result.data.privacy_officer_name ?? '',
          privacy_officer_phone: result.data.privacy_officer_phone ?? '',
          privacy_officer_email: result.data.privacy_officer_email ?? '',
          logo_url: result.data.logo_url ?? null,
        };

        setData(loaded);
        setEditData(loaded);
        setLogoUrl(loaded.logo_url ?? null);
        setProfileReady(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    const changed = (Object.keys(data) as (keyof AgencyData)[]).some((key) => data[key] !== editData[key]);
    setHasChanges(changed);
  }, [data, editData]);

  const toggleEdit = (field: EditableField) => {
    setEditingFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        setEditData((current) => ({ ...current, [field]: data[field] }));
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!profileReady) return;
    setSaving(true);

    try {
      const response = await fetch('/api/agency/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          owner_name: editData.owner_name,
          phone: editData.phone,
          owner_birth_date: editData.owner_birth_date || null,
          business_type: editData.business_type || null,
          business_category: editData.business_category || null,
          privacy_officer_name: editData.privacy_officer_name || null,
          privacy_officer_phone: editData.privacy_officer_phone || null,
          privacy_officer_email: editData.privacy_officer_email || null,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        setSaveMessage({ type: 'error', text: '저장 실패: ' + (result.error || 'unknown') });
      } else {
        setData(editData);
        setEditingFields(new Set());
        setSaveMessage({ type: 'success', text: '저장되었습니다.' });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profileReady) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('파일 크기는 2MB 이하여야 합니다.');
      return;
    }

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/agency/logo', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert('업로드 실패: ' + (result.error || 'unknown'));
      } else {
        setLogoUrl(result.logoUrl ?? null);
      }
    } catch {
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!profileReady) return;
    await fetch('/api/agency/logo', { method: 'DELETE' });
    setLogoUrl(null);
  };

  const FixedField = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <div>
      <p className="text-xs font-medium text-on-surface-variant mb-1 font-korean">{label}</p>
      <p className="h-11 flex items-center px-4 rounded-xl bg-surface-container-high/50 text-on-surface/70 text-sm font-data">
        {value || <span className="text-on-surface-variant/40">-</span>}
      </p>
      {note && <p className="text-[11px] text-on-surface-variant/50 mt-1 font-korean">{note}</p>}
    </div>
  );

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
            onChange={(event) => setEditData((current) => ({ ...current, [field]: event.target.value }))}
            placeholder={placeholder}
            autoFocus
            className={`w-full h-11 px-4 rounded-xl bg-white border-2 border-primary/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${dataFont ? 'font-data' : 'font-korean'}`}
          />
        ) : (
          <p className={`h-11 flex items-center px-4 rounded-xl bg-surface-container-low/50 text-on-surface text-sm ${dataFont ? 'font-data' : 'font-korean'}`}>
            {data[field] || <span className="text-on-surface-variant/40">-</span>}
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
          <p className="text-xs text-on-surface-variant font-korean mb-3">정산서와 문서 화면에 표시됩니다. PNG/JPG, 2MB 이하</p>
          <div className="flex items-center gap-2">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="h-9 px-4 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors font-korean disabled:opacity-50"
            >
              {logoUploading ? '업로드 중...' : logoUrl ? '로고 변경' : '로고 업로드'}
            </button>
            {logoUrl && (
              <button
                onClick={handleLogoDelete}
                className="h-9 px-4 rounded-lg bg-error/10 text-error text-xs font-semibold hover:bg-error/20 transition-colors font-korean"
              >
                삭제
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 p-5 rounded-xl bg-primary/5 border border-primary/15">
        <div className="flex-1">
          <p className="text-xs font-semibold text-on-surface font-korean mb-1">기사 초대코드</p>
          {data.invite_code ? (
            <p
              className="text-2xl font-data font-bold text-primary tracking-[0.3em] select-all cursor-pointer"
              onClick={(event) => {
                event.currentTarget.ownerDocument.defaultView?.getSelection()?.selectAllChildren(event.currentTarget);
              }}
            >
              {data.invite_code}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant font-korean">코드가 생성되지 않았습니다.</p>
          )}
          <p className="text-[11px] text-on-surface-variant mt-1 font-korean">기사에게 이 코드를 전달하면 앱에서 자동으로 소속이 연결됩니다.</p>
        </div>
        <button
          onClick={() => {
            if (!data.invite_code) return;
            navigator.clipboard.writeText(data.invite_code);
            setSaveMessage({ type: 'success', text: '초대코드를 복사했습니다.' });
            setTimeout(() => setSaveMessage(null), 2000);
          }}
          className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-label font-semibold hover:bg-primary/90 transition-colors font-korean shrink-0"
        >
          복사
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Field label="대리점명(상호)" field="name" />
        <FixedField label="사업자등록번호" value={data.business_number} note="관리자만 변경 가능합니다." />
        <Field label="대표자명" field="owner_name" />
        <Field label="대표자 생년월일" field="owner_birth_date" placeholder="1990-01-01" dataFont />
        <Field label="연락처" field="phone" dataFont />
        <FixedField label="이메일" value={data.email} note="변경 불가" />
        <Field label="업태" field="business_type" placeholder="운수보관업" />
        <Field label="종목" field="business_category" placeholder="택배 운송업" />

        <div className="col-span-2">
          <p className="text-xs font-medium text-on-surface-variant mb-1 font-korean">주소</p>
          <p className="h-11 flex items-center px-4 rounded-xl bg-surface-container-low/50 text-on-surface text-sm font-korean">
            {data.address
              ? <>{data.address}{data.address_detail ? ` ${data.address_detail}` : ''}</>
              : <span className="text-on-surface-variant/40">등록된 주소가 없습니다.</span>}
          </p>
        </div>

        <div className="col-span-2 pt-4 border-t border-outline-variant/20">
          <p className="text-xs font-semibold text-on-surface font-korean mb-3 flex items-center gap-1.5">
            개인정보보호 담당자
            <span className="text-on-surface-variant/50 font-normal">(개인정보보호법 제31조)</span>
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1 font-korean">담당자 이름</label>
              <input
                type="text"
                value={editData.privacy_officer_name}
                onChange={(event) => setEditData((current) => ({ ...current, privacy_officer_name: event.target.value }))}
                placeholder="홍길동"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1 font-korean">연락처</label>
              <input
                type="tel"
                value={editData.privacy_officer_phone}
                onChange={(event) => setEditData((current) => ({ ...current, privacy_officer_phone: event.target.value }))}
                placeholder="010-0000-0000"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1 font-korean">이메일</label>
              <input
                type="email"
                value={editData.privacy_officer_email}
                onChange={(event) => setEditData((current) => ({ ...current, privacy_officer_email: event.target.value }))}
                placeholder="privacy@company.com"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant/50 mt-2 font-korean">기사 및 개인정보처리 관련 문의가 표시됩니다.</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-4 border-t border-outline-variant/10">
        {saveMessage && (
          <p className={`text-sm font-korean ${saveMessage.type === 'success' ? 'text-tertiary' : 'text-error'}`}>
            {saveMessage.text}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="h-11 px-6 rounded-xl bg-power-gradient text-white text-sm font-label font-semibold hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed font-korean"
        >
          {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>
    </div>
  );
}
