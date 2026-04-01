'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getPrincipals,
  createPrincipal,
  updatePrincipal,
  deletePrincipal,
  type Principal,
} from '@/services/principal.service';
import { getPlanLimits, isPaidPlan, PLAN_LABELS, type PlanType } from '@/lib/plan-limits';
import AddressSearch, { type AddressValue } from '@/components/shared/AddressSearch';
import SealGenerator from '@/components/shared/SealGenerator';
import {
  type SealRecord,
  type SealCategory,
  type SealScript,
  type DocumentFile,
  getSeals,
  saveSealRecord,
  uploadSealImage,
  deleteSeal,
  setDefaultSeal,
  getDocumentFiles,
  uploadDocumentFile,
  saveDocumentFile,
} from '@/services/seal.service';
import {
  sendDocuments,
  getDocumentDeliveries,
  type SendMethod,
  type DocumentSendType,
  type DocumentDelivery,
  SEND_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
} from '@/services/document-send.service';

type SettingsTab = 'profile' | 'category' | 'seal' | 'billing' | 'notification' | 'admins';
const VALID_TABS: SettingsTab[] = ['profile', 'category', 'seal', 'billing', 'notification', 'admins'];

export default function PortalSettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isWelcome = searchParams.get('welcome') === '1';
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    VALID_TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : 'profile'
  );
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAgencyId(user.app_metadata?.agency_id as string ?? null);
        setUserPlan(user.user_metadata?.plan as string ?? 'free');
      }
    }
    init();
  }, []);

  const tabs = [
    { id: 'profile' as const, label: '프로필' },
    { id: 'admins' as const, label: '관리자 계정' },
    { id: 'category' as const, label: '카테고리 관리' },
    { id: 'seal' as const, label: '도장/서명' },
    { id: 'billing' as const, label: '구독/결제' },
    { id: 'notification' as const, label: '알림 설정' },
  ];

  return (
    <div className="space-y-8">
      {isWelcome && (
        <div className="bg-primary/[0.06] border border-primary/20 rounded-2xl p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-on-surface font-korean">가입이 완료되었습니다!</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              계약서에 사용할 도장을 지금 만들어보세요. 일반 도장, 법인 도장, 또는 실물 도장을 업로드할 수 있습니다.
            </p>
            <button
              onClick={() => setActiveTab('seal')}
              className="mt-2 text-xs text-primary font-semibold font-korean hover:underline"
            >
              도장 만들기 →
            </button>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">설정</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">대리점 정보 및 서비스 설정을 관리합니다</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'admins' && agencyId && <AdminsTab agencyId={agencyId} plan={userPlan} />}
      {activeTab === 'category' && agencyId && <CategoryTab agencyId={agencyId} />}
      {activeTab === 'seal' && agencyId && <SealTab agencyId={agencyId} />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'notification' && <NotificationTab />}
    </div>
  );
}

/* ════════════════════════════════════════════
   카테고리 관리 탭
   ════════════════════════════════════════════ */
function CategoryTab({ agencyId }: { agencyId: string }) {
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    async function load() {
      const result = await getPrincipals(agencyId);
      if (result.data) setPrincipals(result.data);
      setLoading(false);
    }
    load();
  }, [agencyId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const result = await createPrincipal({ agency_id: agencyId, name: newName.trim(), delivery_area: '', rate_type: 'fixed' as const });
    if (result.data) {
      setPrincipals((prev) => [...prev, result.data!]);
      setShowForm(false);
      setNewName('');
    }
    setSaving(false);
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    await updatePrincipal(id, { name: editName });
    setPrincipals((prev) => prev.map((p) => p.id === id ? { ...p, name: editName } : p));
    setEditingId(null);
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) return;
    const result = await deletePrincipal(id);
    if (!result.error) setPrincipals((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">카테고리 관리</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              거래처(본사) 대분류를 관리합니다. 기사 등록 시 드롭다운으로 선택합니다.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-label font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-korean"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            추가
          </button>
        </div>

        {/* 추가 폼 */}
        {showForm && (
          <div className="mb-4 p-4 rounded-xl bg-surface-container-low flex items-center gap-3">
            <input
              type="text"
              placeholder="카테고리명 입력"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 h-10 px-3 rounded-lg bg-surface-container-lowest text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40"
            />
            <button onClick={() => { setShowForm(false); setNewName(''); }} className="h-9 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors font-korean">취소</button>
            <button onClick={handleCreate} disabled={saving || !newName.trim()} className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-label font-semibold disabled:opacity-50 font-korean">
              {saving ? '저장 중...' : '등록'}
            </button>
          </div>
        )}

        {/* 목록 */}
        {loading ? (
          <p className="text-sm text-on-surface-variant text-center py-6 font-korean">불러오는 중...</p>
        ) : principals.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6 font-korean">
            등록된 카테고리가 없습니다. &quot;추가&quot; 버튼으로 거래처를 등록하세요.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {principals.map((p) => (
              <div key={p.id} className="py-3 flex items-center gap-4">
                {editingId === p.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(p.id)}
                    className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm font-body font-semibold text-on-surface font-korean">{p.name}</span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === p.id ? (
                    <>
                      <button onClick={() => setEditingId(null)} className="h-8 px-3 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-high font-korean">취소</button>
                      <button onClick={() => handleUpdate(p.id)} disabled={saving} className="h-8 px-3 rounded-lg text-xs bg-primary text-white font-korean disabled:opacity-50">저장</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(p.id); setEditName(p.name); }} className="h-8 px-3 rounded-lg text-xs text-primary hover:bg-primary/10 font-korean">수정</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="h-8 px-3 rounded-lg text-xs text-error hover:bg-error/10 font-korean">삭제</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <h3 className="text-sm font-headline font-semibold text-on-surface font-korean mb-2">사용 안내</h3>
        <ul className="space-y-1.5 text-xs text-on-surface-variant font-korean">
          <li>• 카테고리는 거래처(본사) 대분류입니다.</li>
          <li>• 기사 등록 시 카테고리를 드롭다운으로 선택합니다.</li>
          <li>• 배송구역, 배송단가, 차감항목 등은 기사 개인별로 설정합니다.</li>
        </ul>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   대리점 정보 탭
   ════════════════════════════════════════════ */
function ProfileTab() {
  const [form, setForm] = useState({
    name: '', owner_name: '', phone: '',
    address: '', address_detail: '',
    business_number: '', email: '',
    invite_code: '',
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
        .select('name, owner_name, phone, address, address_detail, business_number, email, invite_code')
        .eq('id', aid)
        .single();

      if (data) {
        let inviteCode = (data as Record<string, string>).invite_code ?? '';
        
        // 초대코드가 없으면 자동 생성
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
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving} className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all font-korean disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   도장/서명 관리 탭
   ════════════════════════════════════════════ */
function SealTab({ agencyId }: { agencyId: string }) {
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

  useEffect(() => { loadSeals(); }, [agencyId]);

  const handleSealComplete = async (
    dataUri: string,
    meta: { category: SealCategory; script: SealScript; nameText: string }
  ) => {
    setSaving(true);
    // Upload to storage
    const { url, error: uploadErr } = await uploadSealImage('agency', agencyId, dataUri);
    if (uploadErr) {
      alert('도장 이미지 저장 실패: ' + uploadErr + '\n\nSupabase Storage에 "seals" 버킷이 생성되어 있는지 확인하세요.');
      setSaving(false);
      return;
    }
    // Save record
    const { error: saveErr } = await saveSealRecord({
      owner_type: 'agency',
      owner_id: agencyId,
      category: meta.category,
      script: meta.script,
      seal_image_url: url,
      seal_data_uri: dataUri,
      name_text: meta.nameText,
      is_default: seals.length === 0, // 첫 도장은 자동 기본
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

/* ════════════════════════════════════════════
   문서 관리 탭
   ════════════════════════════════════════════ */
function DocumentsTab({ agencyId }: { agencyId: string }) {
  const [docs, setDocs] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 전송 모달 상태
  const [sendingDoc, setSendingDoc] = useState<DocumentFile | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [sendMethod, setSendMethod] = useState<SendMethod>('both');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // 전송 내역 보기
  const [viewDeliveriesDocId, setViewDeliveriesDocId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const loadDocs = async () => {
    setLoading(true);
    const data = await getDocumentFiles(agencyId);
    setDocs(data);
    setLoading(false);
  };

  const loadDrivers = async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from('drivers').select('id, name, phone').eq('agency_id', agencyId).eq('status', 'active').order('name');
    setDrivers((data ?? []) as { id: string; name: string; phone: string }[]);
  };

  useEffect(() => { loadDocs(); loadDrivers(); }, [agencyId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { url, error } = await uploadDocumentFile(agencyId, file);
    if (!error && url) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const fileType = ext === 'pdf' ? 'pdf' : ext === 'docx' || ext === 'doc' ? 'docx' : 'image';
      await saveDocumentFile({
        agency_id: agencyId,
        title: file.name,
        file_url: url,
        file_type: fileType,
        file_size: file.size,
        status: 'uploaded',
      });
      loadDocs();
    }
    setUploading(false);
    e.target.value = '';
  };

  // 전송 모달 열기
  const openSendModal = (doc: DocumentFile) => {
    setSendingDoc(doc);
    setSelectedDriverIds(new Set());
    setSendMethod('both');
    setSendMessage('');
    setSendResult(null);
  };

  // 전송 실행
  const handleSend = async () => {
    if (!sendingDoc || selectedDriverIds.size === 0) return;
    setSending(true);
    setSendResult(null);

    const result = await sendDocuments({
      agencyId,
      driverIds: Array.from(selectedDriverIds),
      sendType: 'general',
      sendMethod,
      title: sendingDoc.title,
      message: sendMessage || undefined,
      documentFileId: sendingDoc.id,
    });

    if (result.error) {
      setSendResult(`전송 실패: ${result.error}`);
    } else {
      setSendResult(`${result.total}명에게 전송 완료 (푸시 ${result.pushSent}건, SMS ${result.smsSent}건)`);
      loadDocs();
    }
    setSending(false);
  };

  // 전송 내역 보기
  const viewDeliveries = async (docId: string) => {
    setViewDeliveriesDocId(docId);
    setLoadingDeliveries(true);
    const res = await getDocumentDeliveries(agencyId, { documentFileId: docId });
    setDeliveries(res.data ?? []);
    setLoadingDeliveries(false);
  };

  // 전체 선택/해제
  const toggleAllDrivers = () => {
    if (selectedDriverIds.size === drivers.length) {
      setSelectedDriverIds(new Set());
    } else {
      setSelectedDriverIds(new Set(drivers.map((d) => d.id)));
    }
  };

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    uploaded: { label: '업로드됨', color: 'bg-surface-container-high text-on-surface-variant' },
    sealed: { label: '도장완료', color: 'bg-tertiary/10 text-tertiary' },
    signed: { label: '서명완료', color: 'bg-primary/10 text-primary' },
    sent: { label: '전송완료', color: 'bg-secondary/10 text-secondary' },
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-6">
      {/* 문서 목록 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">문서 관리</h2>
            <p className="text-sm text-on-surface-variant font-korean mt-1">내 컴퓨터에서 문서를 업로드하고 기사에게 전송할 수 있습니다</p>
          </div>
          <label className={`h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {uploading ? '업로드 중...' : '문서 업로드'}
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        {/* 전송 방법 안내 */}
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs font-semibold text-primary font-korean mb-2">문서 전송 안내</p>
          <div className="space-y-1 text-xs text-on-surface-variant font-korean">
            <p><span className="font-semibold">기사 등록시</span> — 카테고리 계약서 템플릿이 자동 전송됩니다</p>
            <p><span className="font-semibold">재계약시</span> — 계약 변경 메뉴에서 재계약 유형 선택 후 서류를 전송합니다</p>
            <p><span className="font-semibold">상시 전송</span> — 아래 문서를 업로드 후 [전송] 버튼으로 선택한 기사에게 전송합니다</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-on-surface-variant font-korean">불러오는 중...</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p className="text-sm text-on-surface-variant font-korean">업로드된 문서가 없습니다</p>
            <p className="text-xs text-on-surface-variant/50 font-korean mt-1">PDF, Word, 이미지 파일을 업로드하세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.uploaded;
              return (
                <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/15 hover:bg-surface-container-low/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {doc.file_type === 'pdf' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface font-korean truncate">{doc.title}</p>
                    <p className="text-[11px] text-on-surface-variant/60 font-data mt-0.5">
                      {formatFileSize(doc.file_size ?? 0)} · {new Date(doc.created_at ?? '').toLocaleDateString('ko-KR')}
                      {(doc as any).recipients && (doc as any).recipients.length > 0 && ` · ${(doc as any).recipients.length}명 전송`}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-korean ${st.color}`}>
                    {st.label}
                  </span>
                  <div className="flex gap-2">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="h-8 px-3 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant font-korean hover:bg-surface-container-high transition-colors flex items-center">보기</a>
                    <button onClick={() => openSendModal(doc)} className="h-8 px-3 rounded-lg bg-primary/10 text-[11px] text-primary font-semibold font-korean hover:bg-primary/20 transition-colors flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      전송
                    </button>
                    {doc.status === 'sent' && (
                      <button onClick={() => viewDeliveries(doc.id)} className="h-8 px-3 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant font-korean hover:bg-surface-container-high transition-colors flex items-center">내역</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 전송 모달 ── */}
      {sendingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !sending && setSendingDoc(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="p-6 border-b border-outline-variant/15">
              <h3 className="text-lg font-headline font-bold text-on-surface font-korean">문서 전송</h3>
              <p className="text-sm text-on-surface-variant font-korean mt-1 truncate">{sendingDoc.title}</p>
            </div>

            {/* 본문 */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {/* 전송 방법 */}
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">전송 방법</label>
                <div className="flex gap-2">
                  {(['push', 'sms', 'both'] as SendMethod[]).map((m) => (
                    <button key={m} onClick={() => setSendMethod(m)}
                      className={`h-9 px-4 rounded-lg text-xs font-semibold font-korean transition-colors ${sendMethod === m ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
                    >{SEND_METHOD_LABELS[m]}</button>
                  ))}
                </div>
              </div>

              {/* 메시지 */}
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">전송 메시지 (선택)</label>
                <textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} placeholder="기사에게 함께 전달할 메시지를 입력하세요" rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40 resize-none font-korean" />
              </div>

              {/* 수신 기사 선택 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-label font-medium text-on-surface-variant font-korean">수신 기사 선택</label>
                  <button onClick={toggleAllDrivers} className="text-[11px] text-primary font-korean hover:underline">
                    {selectedDriverIds.size === drivers.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                {drivers.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/60 font-korean py-4 text-center">등록된 기사가 없습니다</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-outline-variant/15">
                    {drivers.map((d) => {
                      const checked = selectedDriverIds.has(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low/50 cursor-pointer border-b border-outline-variant/5 last:border-b-0">
                          <input type="checkbox" checked={checked} onChange={() => {
                            const next = new Set(selectedDriverIds);
                            if (checked) next.delete(d.id); else next.add(d.id);
                            setSelectedDriverIds(next);
                          }} className="w-4 h-4 rounded accent-primary" />
                          <span className="text-sm text-on-surface font-korean">{d.name}</span>
                          <span className="text-[11px] text-on-surface-variant/60 font-data ml-auto">{d.phone}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-on-surface-variant/60 font-korean mt-1">{selectedDriverIds.size}명 선택됨</p>
              </div>

              {/* 결과 메시지 */}
              {sendResult && (
                <div className={`p-3 rounded-xl text-sm font-korean ${sendResult.startsWith('전송 실패') ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                  {sendResult}
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="p-6 border-t border-outline-variant/15 flex justify-end gap-3">
              <button onClick={() => setSendingDoc(null)} disabled={sending} className="h-10 px-5 rounded-xl bg-surface-container-low text-on-surface-variant text-sm font-korean hover:bg-surface-container-high transition-colors">취소</button>
              <button onClick={handleSend} disabled={sending || selectedDriverIds.size === 0}
                className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {sending ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg> 전송 중...</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> {selectedDriverIds.size}명에게 전송</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 전송 내역 모달 ── */}
      {viewDeliveriesDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewDeliveriesDocId(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/15 flex items-center justify-between">
              <h3 className="text-lg font-headline font-bold text-on-surface font-korean">전송 내역</h3>
              <button onClick={() => setViewDeliveriesDocId(null)} className="text-on-surface-variant hover:text-on-surface">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {loadingDeliveries ? (
                <p className="text-sm text-on-surface-variant font-korean text-center py-8">불러오는 중...</p>
              ) : deliveries.length === 0 ? (
                <p className="text-sm text-on-surface-variant font-korean text-center py-8">전송 내역이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((del) => {
                    const statusLabel = DELIVERY_STATUS_LABELS[del.status] ?? del.status;
                    const statusColor = DELIVERY_STATUS_COLORS[del.status] ?? 'gray';
                    const colorMap: Record<string, string> = {
                      blue: 'bg-blue-100 text-blue-700',
                      cyan: 'bg-cyan-100 text-cyan-700',
                      orange: 'bg-orange-100 text-orange-700',
                      green: 'bg-green-100 text-green-700',
                      red: 'bg-red-100 text-red-700',
                      gray: 'bg-gray-100 text-gray-600',
                    };
                    const driverInfo = (del as unknown as { drivers?: { name: string; phone: string } }).drivers;
                    return (
                      <div key={del.id} className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface font-korean">{driverInfo?.name ?? '기사'}</p>
                          <p className="text-[11px] text-on-surface-variant/60 font-data">{driverInfo?.phone ?? ''} · {new Date(del.sent_at).toLocaleDateString('ko-KR')}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-korean ${colorMap[statusColor] ?? colorMap.gray}`}>
                          {statusLabel}
                        </span>
                        {del.viewed_at && <span className="text-[10px] text-on-surface-variant/50 font-data">열람 {new Date(del.viewed_at).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   구독/결제 탭
   ════════════════════════════════════════════ */
function BillingTab() {
  const [plan, setPlan] = useState('free');
  const [cardInfo, setCardInfo] = useState<{ cardName: string; cardNumber: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const aid = user.app_metadata?.agency_id as string;
      setPlan(user.app_metadata?.plan as string ?? 'free');

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('card_name, card_number_masked, status')
        .eq('agency_id', aid)
        .single();

      if (sub && (sub as Record<string, unknown>).status === 'active') {
        setCardInfo({
          cardName: (sub as Record<string, string>).card_name ?? '',
          cardNumber: (sub as Record<string, string>).card_number_masked ?? '',
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  // 포트원 빌링키 발급 (카드 등록)
  const handleRegisterCard = async () => {
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      alert('결제 시스템이 설정되지 않았습니다.');
      return;
    }

    setProcessing(true);
    try {
      // 포트원 SDK 동적 로드
      const PortOne = await import('@portone/browser-sdk/v2');

      const result = await PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        billingKeyMethod: 'CARD',
        issueId: `billing_${Date.now()}`,
        issueName: 'logiSSign 정기결제 카드 등록',
        customer: { customerId: 'agency' },
      });

      if (!result || result.code) {
        alert('카드 등록 실패: ' + (result?.message ?? result?.code ?? '알 수 없는 오류'));
        setProcessing(false);
        return;
      }

      // 서버에 빌링키 저장
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-billing-key',
          billingKey: result.billingKey ?? '',
          cardName: '',
          cardNumber: '',
        }),
      });

      if (res.ok) {
        setCardInfo({ cardName: '신용카드', cardNumber: '등록 완료' });
        alert('카드가 등록되었습니다.');
      } else {
        alert('카드 정보 저장 실패');
      }
    } catch (err) {
      alert('카드 등록 중 오류: ' + (err instanceof Error ? err.message : ''));
    }
    setProcessing(false);
  };

  const planLabels: Record<string, string> = { free: 'Free', basic: 'Basic', standard: 'Standard', enterprise: 'Enterprise' };
  const planPrices: Record<string, string> = { free: '₩0', basic: '₩49,900', standard: '₩99,000', enterprise: '별도 상담' };

  if (loading) return <p className="text-center text-on-surface-variant py-12 font-korean">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">현재 구독</h2>
        <div className="flex items-center justify-between p-5 rounded-xl bg-surface-container-low">
          <div>
            <p className="text-sm text-on-surface-variant font-label font-korean">현재 플랜</p>
            <p className="text-2xl font-data font-bold text-primary mt-1">{planLabels[plan] ?? plan}</p>
            <p className="text-sm text-on-surface-variant font-data mt-1">{planPrices[plan] ?? ''} / 월</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">결제 수단</h2>
        {cardInfo ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface font-korean">{cardInfo.cardName}</p>
              <p className="text-xs text-on-surface-variant font-data">{cardInfo.cardNumber}</p>
            </div>
            <button
              onClick={handleRegisterCard}
              disabled={processing}
              className="h-9 px-4 rounded-lg bg-surface-container-high text-on-surface-variant text-sm font-korean hover:bg-surface-container-highest"
            >
              변경
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface font-korean">카드 등록 필요</p>
              <p className="text-xs text-on-surface-variant font-korean">정기결제를 위해 카드를 등록하세요</p>
            </div>
            <button
              onClick={handleRegisterCard}
              disabled={processing}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-korean hover:bg-primary/90 disabled:opacity-50"
            >
              {processing ? '처리중...' : '카드 등록'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   알림 설정 탭
   ════════════════════════════════════════════ */
function NotificationTab() {
  const [settings, setSettings] = useState({
    settlement: true,
    contract: true,
    notice: true,
    sms: false,
    email: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  const items = [
    { key: 'settlement' as const, label: '정산서 알림', desc: '정산서 생성/변경 시 알림' },
    { key: 'contract' as const, label: '계약서 알림', desc: '전자계약 서명 요청/완료 알림' },
    { key: 'notice' as const, label: '공지사항', desc: '새 공지사항 등록 시 알림' },
    { key: 'sms' as const, label: 'SMS 알림', desc: '문자메시지로 알림 수신' },
    { key: 'email' as const, label: '이메일 알림', desc: '이메일로 알림 수신' },
  ];

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
      <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">알림 설정</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/15">
            <div>
              <p className="text-sm font-semibold text-on-surface font-korean">{item.label}</p>
              <p className="text-xs text-on-surface-variant font-korean mt-0.5">{item.desc}</p>
            </div>
            <button
              onClick={() => toggleSetting(item.key)}
              className={`relative w-12 h-7 rounded-full transition-colors ${settings[item.key] ? 'bg-primary' : 'bg-outline-variant/30'}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   관리자 계정 탭
   ════════════════════════════════════════════ */
interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

function AdminsTab({ agencyId, plan }: { agencyId: string; plan: string }) {
  const limits = getPlanLimits(plan);
  const paid = isPaidPlan(plan as PlanType);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAdmins() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true });
      if (data) setAdmins(data as AdminAccount[]);
    }
    if (paid) loadAdmins();
  }, [agencyId, paid]);

  const handleAdd = async () => {
    if (!formName.trim() || !formEmail.trim()) return;
    if (admins.length >= limits.maxAdminAccounts) return;
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from('admin_accounts')
      .insert({ agency_id: agencyId, name: formName.trim(), email: formEmail.trim(), role: 'admin' })
      .select()
      .single();
    if (!error && data) {
      setAdmins((prev) => [...prev, data as AdminAccount]);
      setFormName('');
      setFormEmail('');
      setShowForm(false);
    }
    setSaving(false);
  };

  const handleRemove = async (id: string) => {
    const supabase = createBrowserSupabaseClient();
    await supabase.from('admin_accounts').delete().eq('id', id);
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  };

  const inputCls = 'w-full h-11 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 font-korean';

  if (!paid) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-container-high/50 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant/40">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-2">유료 플랜 전용 기능</h2>
        <p className="text-sm text-on-surface-variant font-korean mb-4">
          관리자 계정 추가는 Basic 이상 유료 플랜에서 사용할 수 있습니다.
        </p>
        <p className="text-xs text-on-surface-variant/60 font-korean">
          유료 플랜에서는 대표가입자 외 최대 3명의 관리자 계정을 추가할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">관리자 계정</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-korean">
            대표가입자 외 최대 {limits.maxAdminAccounts}명의 관리자를 추가할 수 있습니다 ({PLAN_LABELS[plan as PlanType] || plan} 플랜)
          </p>
        </div>
        {admins.length < limits.maxAdminAccounts && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 rounded-xl bg-primary text-on-primary font-label text-sm hover:bg-primary/90 transition-colors font-korean flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            관리자 추가
          </button>
        )}
      </div>

      {/* 현재 관리자 목록 */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-on-surface-variant font-korean">
          등록된 관리자 ({admins.length}/{limits.maxAdminAccounts})
        </p>
        {admins.length === 0 && (
          <p className="text-sm text-on-surface-variant/50 text-center py-6 font-korean">등록된 관리자가 없습니다</p>
        )}
        {admins.map((admin) => (
          <div key={admin.id} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xs font-bold">{admin.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface font-korean">{admin.name}</p>
                <p className="text-xs text-on-surface-variant">{admin.email}</p>
              </div>
            </div>
            <button
              onClick={() => handleRemove(admin.id)}
              className="h-8 px-3 rounded-lg text-error text-xs font-semibold hover:bg-error/10 transition-colors font-korean"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.02] space-y-4">
          <p className="text-sm font-semibold text-on-surface font-korean">새 관리자 추가</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">이름 *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="관리자 이름" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">이메일 *</label>
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setFormName(''); setFormEmail(''); }}
              className="h-9 px-4 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-korean hover:bg-surface-container-high/50 transition-colors">
              취소
            </button>
            <button onClick={handleAdd} disabled={saving || !formName.trim() || !formEmail.trim()}
              className="h-9 px-4 rounded-xl bg-primary text-on-primary text-sm font-korean hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}