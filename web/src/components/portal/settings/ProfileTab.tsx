'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import AddressSearch, { type AddressValue } from '@/components/shared/AddressSearch';

export default function ProfileTab() {
  const [form, setForm] = useState({
    name: '', owner_name: '', phone: '',
    address: '', address_detail: '',
    business_number: '', email: '',
    invite_code: '',
    privacy_officer_name: '',
    privacy_officer_phone: '',
    privacy_officer_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const aid = user?.app_metadata?.agency_id as string | undefined;
      if (!aid) { setLoading(false); return; }
      setAgencyId(aid);

      const { data } = await supabase
        .from('agencies')
        .select('name, owner_name, phone, address, address_detail, business_number, email, invite_code, privacy_officer_name, privacy_officer_phone, privacy_officer_email, logo_url')
        .eq('id', aid)
        .single();

      if (data) {
        setLogoUrl((data as Record<string, string>).logo_url ?? null);
        let inviteCode = (data as Record<string, string>).invite_code ?? '';
        
        if (!inviteCode) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          for (let i = 0; i < 6; i++) inviteCode += chars[Math.floor(Math.random() * chars.length)];
          await supabase.from('agencies').update({ invite_code: inviteCode }).eq('id', aid);
        }

        setForm({
          name: (data as Record<string, string>).name ?? '',
          owner_name: (data as Record<string, string>).owner_name ?? '',
          phone: (data as Record<string, string>).phone ?? '',
          address: (data as Record<string, string>).address ?? '',
          address_detail: (data as Record<string, string>).address_detail ?? '',
          business_number: (data as Record<string, string>).business_number ?? '',
          email: (data as Record<string, string>).email ?? '',
          invite_code: inviteCode,
          privacy_officer_name: (data as Record<string, string>).privacy_officer_name ?? '',
          privacy_officer_phone: (data as Record<string, string>).privacy_officer_phone ?? '',
          privacy_officer_email: (data as Record<string, string>).privacy_officer_email ?? '',
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!agencyId) return;
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({
      name: form.name,
      owner_name: form.owner_name,
      phone: form.phone,
      address: form.address,
      address_detail: form.address_detail,
      privacy_officer_name: form.privacy_officer_name || null,
      privacy_officer_phone: form.privacy_officer_phone || null,
      privacy_officer_email: form.privacy_officer_email || null,
    }).eq('id', agencyId);
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agencyId) return;
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('파일 크기는 2MB 이하만 가능합니다'); return; }

    setLogoUploading(true);
    const supabase = createBrowserSupabaseClient();
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${agencyId}/logo.${ext}`;

    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (uploadErr) { alert('업로드 실패: ' + uploadErr.message); setLogoUploading(false); return; }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
    const url = urlData.publicUrl;

    await supabase.from('agencies').update({ logo_url: url }).eq('id', agencyId);
    setLogoUrl(url);
    setLogoUploading(false);
  };

  const handleLogoDelete = async () => {
    if (!agencyId) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({ logo_url: null }).eq('id', agencyId);
    setLogoUrl(null);
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
          <p className="text-xs text-on-surface-variant font-korean mb-3">
            정산서 PDF와 기사 앱에 표시됩니다 · PNG/JPG · 2MB 이하
          </p>
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

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">대리점명 (상호)</label>
          <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">사업자등록번호</label>
          <input type="text" value={form.business_number} readOnly disabled className="w-full h-11 px-4 rounded-xl bg-surface-container-high text-on-surface/60 text-sm font-data cursor-not-allowed" />
          <p className="text-[11px] text-on-surface-variant/50 mt-1 font-korean">사업자등록번호는 가입 시 등록한 번호로 고정되며 변경할 수 없습니다</p>
        </div>
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">대표자명</label>
          <input type="text" value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">연락처</label>
          <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="col-span-2">
          <AddressSearch
            label="주소"
            value={form.address}
            detailValue={form.address_detail}
            onChange={(addr: AddressValue) => setForm(p => ({ ...p, address: addr.address, address_detail: addr.addressDetail }))}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">이메일</label>
          <input type="email" value={form.email} disabled className="w-full h-11 px-4 rounded-xl bg-surface-container-high text-on-surface-variant text-sm cursor-not-allowed" />
          <p className="text-xs text-on-surface-variant/60 mt-1 font-korean">이메일은 변경할 수 없습니다</p>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">기사 초대코드</label>
          <div className="flex items-center gap-3">
            <input type="text" value={form.invite_code} readOnly className="flex-1 h-11 px-4 rounded-xl bg-surface-container-high text-on-surface text-lg font-data font-bold tracking-widest cursor-default select-all" onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button
              onClick={() => { navigator.clipboard.writeText(form.invite_code); }}
              className="h-11 px-4 rounded-xl bg-primary/10 text-primary text-sm font-label font-semibold hover:bg-primary/20 transition-colors font-korean shrink-0"
            >
              복사
            </button>
          </div>
          <p className="text-xs text-on-surface-variant/60 mt-1 font-korean">기사에게 이 코드를 전달하면 앱에서 가입 시 자동으로 소속이 연결됩니다</p>
        </div>

        <div className="col-span-2 pt-4 border-t border-outline-variant/20">
          <p className="text-xs font-semibold text-on-surface font-korean mb-3 flex items-center gap-1.5">
            🛡️ 개인정보보호 담당자
            <span className="text-on-surface-variant/50 font-normal">(개인정보보호법 제31조)</span>
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">담당자 이름</label>
              <input type="text" value={form.privacy_officer_name} onChange={e => setForm(f => ({ ...f, privacy_officer_name: e.target.value }))}
                placeholder="홍길동" className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">연락처</label>
              <input type="tel" value={form.privacy_officer_phone} onChange={e => setForm(f => ({ ...f, privacy_officer_phone: e.target.value }))}
                placeholder="010-0000-0000" className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">이메일</label>
              <input type="email" value={form.privacy_officer_email} onChange={e => setForm(f => ({ ...f, privacy_officer_email: e.target.value }))}
                placeholder="privacy@company.com" className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant/50 mt-2 font-korean">기사 앱 개인정보처리방침에 표시됩니다</p>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving} className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all font-korean disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
