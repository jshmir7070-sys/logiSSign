'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const aid = user?.app_metadata?.agency_id as string | undefined;
      if (!aid) { setLoading(false); return; }
      setAgencyId(aid);

      const { data } = await supabase
        .from('agencies')
        .select('name, owner_name, phone, address, address_detail, business_number, email, invite_code, privacy_officer_name, privacy_officer_phone, privacy_officer_email')
        .eq('id', aid)
        .single();

      if (data) {
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
