'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import Badge from '@/components/shared/Badge';
import { getPlanLimits, PLAN_LABELS, type PlanType } from '@/lib/plan-limits';
import { getContractTemplates, type ContractTemplate } from '@/services/contract.service';

interface DocFile {
  id: string;
  title: string;
  status: string;
  created_at: string;
  field_count?: number;
}

export default function DocumentLibraryPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const aid = user.app_metadata?.agency_id as string;
    const plan = user.app_metadata?.plan as string ?? 'free';
    setAgencyId(aid);
    setUserPlan(plan);

    // 계약서 양식 (기본 + 업로드)
    const tplResult = await getContractTemplates(aid);
    if (tplResult.data) setTemplates(tplResult.data);

    // 외부문서
    const { data: docs } = await supabase
      .from('document_files')
      .select('id, title, status, created_at')
      .eq('agency_id', aid)
      .order('created_at', { ascending: false });
    if (docs) setUploadedDocs(docs as DocFile[]);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const limits = getPlanLimits(userPlan);
  const planLabel = PLAN_LABELS[userPlan as PlanType] ?? userPlan;
  const systemTemplates = templates.filter(t => t.is_system);
  const userTemplates = templates.filter(t => !t.is_system);
  const activeSystemCount = systemTemplates.filter(t => t.is_active).length;

  const totalUsed = activeSystemCount + userTemplates.length + uploadedDocs.length;
  const totalLimit = limits.maxDefaultTemplates + limits.maxUploadTemplates * 2; // 업로드 양식 + 외부문서 각각

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-sm text-on-surface-variant font-korean">불러오는 중...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">내 문서함</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            계약서 양식과 외부문서를 한눈에 관리합니다
          </p>
        </div>
      </div>

      {/* Plan Usage */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-on-surface font-korean">📦 {planLabel} 플랜 문서 현황</h2>
          <Link href="/portal/settings?tab=billing" className="text-xs text-primary hover:underline font-korean">플랜 업그레이드 →</Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-xs text-on-surface-variant mb-1 font-korean">기본 양식</p>
            <p className="text-xl font-bold text-primary">{activeSystemCount}<span className="text-sm text-on-surface-variant font-normal">/{limits.maxDefaultTemplates}</span></p>
            <p className="text-[10px] text-on-surface-variant mt-1 font-korean">시스템 제공 양식 선택</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-xs text-on-surface-variant mb-1 font-korean">업로드 양식</p>
            <p className="text-xl font-bold text-amber-600">{userTemplates.length}<span className="text-sm text-on-surface-variant font-normal">/{limits.maxUploadTemplates}</span></p>
            <p className="text-[10px] text-on-surface-variant mt-1 font-korean">직접 작성한 계약서</p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4 text-center">
            <p className="text-xs text-on-surface-variant mb-1 font-korean">외부문서 (PDF)</p>
            <p className="text-xl font-bold text-emerald-600">{uploadedDocs.length}<span className="text-sm text-on-surface-variant font-normal">/{limits.maxUploadTemplates}</span></p>
            <p className="text-[10px] text-on-surface-variant mt-1 font-korean">PDF 업로드 + 서명필드</p>
          </div>
        </div>
      </div>

      {/* 기본 양식 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-on-surface font-korean">📋 기본 양식 ({activeSystemCount}/{limits.maxDefaultTemplates})</h2>
          <Link href="/portal/contracts/templates" className="text-xs text-primary hover:underline font-korean">관리 →</Link>
        </div>
        {systemTemplates.length === 0 ? (
          <p className="text-sm text-on-surface-variant font-korean">시스템 양식이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {systemTemplates.map(t => (
              <div key={t.id} className={`rounded-xl border p-4 ${t.is_active ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/15 opacity-50'}`}>
                <p className="text-sm font-medium text-on-surface font-korean truncate">{t.title}</p>
                <Badge label={t.is_active ? '사용중' : '미사용'} variant={t.is_active ? 'success' : 'default'} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 업로드 양식 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-on-surface font-korean">✏️ 업로드 양식 ({userTemplates.length}/{limits.maxUploadTemplates})</h2>
          <Link href="/portal/contracts/templates" className="text-xs text-primary hover:underline font-korean">관리 →</Link>
        </div>
        {userTemplates.length === 0 ? (
          <p className="text-sm text-on-surface-variant font-korean">직접 작성한 양식이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {userTemplates.map(t => (
              <div key={t.id} className="rounded-xl border border-outline-variant/15 p-4">
                <p className="text-sm font-medium text-on-surface font-korean truncate">{t.title}</p>
                <p className="text-xs text-on-surface-variant mt-1 font-korean">{new Date(t.created_at).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 외부문서 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-on-surface font-korean">📄 외부문서 PDF ({uploadedDocs.length}/{limits.maxUploadTemplates})</h2>
          <Link href="/portal/documents" className="text-xs text-primary hover:underline font-korean">관리 →</Link>
        </div>
        {uploadedDocs.length === 0 ? (
          <p className="text-sm text-on-surface-variant font-korean">업로드한 외부문서가 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {uploadedDocs.map(d => (
              <div key={d.id} className="rounded-xl border border-outline-variant/15 p-4">
                <p className="text-sm font-medium text-on-surface font-korean truncate">{d.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge label={d.status === 'draft' ? '작성중' : d.status === 'ready' ? '준비완료' : '발송됨'} variant={d.status === 'ready' ? 'success' : d.status === 'sent' ? 'info' : 'warning'} />
                  <span className="text-xs text-on-surface-variant">{new Date(d.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
