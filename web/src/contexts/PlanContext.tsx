'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  type PlanType,
  type PlanFeature,
  type PlanLimits,
  getPlanLimits,
  hasFeature as _hasFeature,
  PLAN_LABELS,
} from '@/lib/plan-limits';

interface PlanContextValue {
  plan: PlanType;
  planLabel: string;
  agencyId: string | null;
  ownerName: string;
  companyName: string;
  email: string;
  limits: PlanLimits;
  hasFeature: (feature: PlanFeature) => boolean;
  /** 플랜 변경 후 UI 즉시 갱신 */
  refreshPlan: () => Promise<void>;
  loading: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanType>('free');
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const p = (user.app_metadata?.plan || 'free') as PlanType;
      setPlan(p);
      setAgencyId(user.app_metadata?.agency_id as string ?? null);
      setOwnerName(user.user_metadata?.owner_name || '');
      setCompanyName(user.user_metadata?.company_name || '대리점');
      setEmail(user.email || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const refreshPlan = useCallback(async () => {
    setLoading(true);
    await loadUser();
  }, [loadUser]);

  const limits = getPlanLimits(plan);
  const hasFeature = useCallback((feature: PlanFeature) => _hasFeature(plan, feature), [plan]);

  return (
    <PlanContext.Provider value={{
      plan,
      planLabel: PLAN_LABELS[plan] || 'Free',
      agencyId,
      ownerName,
      companyName,
      email,
      limits,
      hasFeature,
      refreshPlan,
      loading,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
