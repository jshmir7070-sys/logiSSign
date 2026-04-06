'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  type PlanType,
  type PlanFeature,
  type PlanLimits,
  getPlanLimits,
  hasFeature as hasPlanFeature,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setPlan((user.app_metadata?.plan || 'free') as PlanType);
      setAgencyId((user.app_metadata?.agency_id as string) ?? null);
      setOwnerName(user.user_metadata?.owner_name || '');
      setCompanyName(user.user_metadata?.company_name || '대리점');
      setEmail(user.email || '');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const refreshPlan = useCallback(async () => {
    setLoading(true);
    await loadUser();
  }, [loadUser]);

  const limits = getPlanLimits(plan);
  const hasFeature = useCallback((feature: PlanFeature) => hasPlanFeature(plan, feature), [plan]);

  return (
    <PlanContext.Provider
      value={{
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
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
