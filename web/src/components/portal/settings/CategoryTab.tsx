'use client';

import { useEffect, useState } from 'react';
import {
  getPrincipals,
  createPrincipal,
  updatePrincipal,
  deletePrincipal,
  type Principal,
} from '@/services/principal.service';

export default function CategoryTab({ agencyId }: { agencyId: string }) {
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
