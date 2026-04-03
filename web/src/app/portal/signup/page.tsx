"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import AddressSearch, { type AddressValue } from "@/components/shared/AddressSearch";
import { formatBusinessNumber, formatPhoneNumber, formatBirthDate } from "@/lib/formatters";

/* ───────────────────────── 타입 & 상수 ───────────────────────── */

type PlanType = "free" | "basic" | "standard" | "enterprise";
type BillingCycle = "monthly" | "1year" | "2year" | "3year";

interface PlanPricing {
  monthly: number;
  discountYear1: number;
  discountYear2: number;
  discountYear3: number;
}

interface Plan {
  id: PlanType;
  name: string;
  pricing: PlanPricing | null;
  maxDrivers: number | null;
  features: string[];
  disabled: string[];
  popular?: boolean;
  contactOnly?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    pricing: { monthly: 0, discountYear1: 0, discountYear2: 0, discountYear3: 0 },
    maxDrivers: 10,
    features: ["기사 10명까지", "기본 정산 관리", "엑셀 업로드 정산"],
    disabled: ["관리자 추가 ✕", "기본 템플릿 ✕", "템플릿 업로드 ✕", "기사 모바일 앱 ✕", "전자계약서 ✕", "세금계산서 ✕", "리포트 ✕"],
  },
  {
    id: "basic",
    name: "Basic",
    pricing: { monthly: 49900, discountYear1: 20, discountYear2: 30, discountYear3: 40 },
    maxDrivers: 50,
    features: ["기사 50명까지", "관리자 3명 추가", "기본 템플릿 3개", "업로드 템플릿 3개", "기사 모바일 앱", "정산서 발송", "전자계약서 발송/서명", "세금계산서 발행", "이메일 지원"],
    disabled: [],
    popular: true,
  },
  {
    id: "standard",
    name: "Standard",
    pricing: { monthly: 99000, discountYear1: 20, discountYear2: 30, discountYear3: 40 },
    maxDrivers: 100,
    features: ["기사 100명까지", "관리자 3명 추가", "기본 템플릿 6개", "업로드 템플릿 6개", "Basic 전체 기능 포함", "매출 리포트", "푸시 알림", "전화 지원", "API 연동"],
    disabled: [],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricing: null,
    maxDrivers: null,
    features: ["기사 무제한", "관리자 3명 추가", "기본 템플릿 10개", "업로드 템플릿 10개", "Standard 전체 기능 포함", "맞춤형 정산 규칙", "전담 매니저 배정", "SLA 99.9%", "커스텀 계약서"],
    disabled: [],
    contactOnly: true,
  },
];

const CYCLE_OPTIONS: { value: BillingCycle; label: string; badge: string }[] = [
  { value: "monthly", label: "월결제", badge: "" },
  { value: "1year", label: "1년", badge: "20% 할인" },
  { value: "2year", label: "2년", badge: "30% 할인" },
  { value: "3year", label: "3년", badge: "40% 할인" },
];

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "월결제",
  "1year": "1년 일시불",
  "2year": "2년 일시불",
  "3year": "3년 일시불",
};

/* ───────────────────────── 유틸 ───────────────────────── */

function formatPrice(n: number): string {
  if (n === 0) return "0";
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

function getDiscountRate(plan: Plan, cycle: BillingCycle): number {
  if (!plan.pricing) return 0;
  switch (cycle) {
    case "monthly": return 0;
    case "1year": return plan.pricing.discountYear1;
    case "2year": return plan.pricing.discountYear2;
    case "3year": return plan.pricing.discountYear3;
  }
}

function getMonths(cycle: BillingCycle): number {
  switch (cycle) {
    case "monthly": return 1;
    case "1year": return 12;
    case "2year": return 24;
    case "3year": return 36;
  }
}

function getMonthlyEquivalent(plan: Plan, cycle: BillingCycle): number {
  if (!plan.pricing) return 0;
  const discount = getDiscountRate(plan, cycle);
  return plan.pricing.monthly * (1 - discount / 100);
}

function getTotalPrice(plan: Plan, cycle: BillingCycle): number {
  return getMonthlyEquivalent(plan, cycle) * getMonths(cycle);
}

function getSaving(plan: Plan, cycle: BillingCycle): number {
  if (!plan.pricing || cycle === "monthly") return 0;
  const months = getMonths(cycle);
  return plan.pricing.monthly * months - getTotalPrice(plan, cycle);
}

/* ───────────────────────── 폼 타입 ───────────────────────── */

type StepType = 1 | 2 | 3 | 4;

interface SignupForm {
  step: StepType;
  plan: PlanType;
  billingCycle: BillingCycle;
  companyName: string;
  businessNumber: string;
  ownerName: string;
  ownerBirthDate: string;
  phone: string;
  email: string;
  address: string;
  addressDetail: string;
  businessType: string;
  businessCategory: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  password: string;
  passwordConfirm: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeDataProcessing: boolean;  // 개인정보처리 서약
  /* 본인인증 */
  identityVerified: boolean;
  identityName: string;
  identityPhone: string;
  /* 결제 */
  paymentMethod: "card" | "transfer" | "free_trial";
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  cardHolder: string;
  isLoading: boolean;
  error: string | null;
}

/* ───────────────────────── 페이지 ───────────────────────── */

export default function PortalSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="text-on-surface-variant">로딩 중...</span></div>}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const _router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<SignupForm>({
    step: 1,
    plan: "basic",
    billingCycle: "monthly",
    companyName: "",
    businessNumber: "",
    ownerName: "",
    ownerBirthDate: "",
    phone: "",
    email: "",
    address: "",
    addressDetail: "",
    businessType: "",
    businessCategory: "",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    password: "",
    passwordConfirm: "",
    agreeTerms: false,
    agreePrivacy: false,
    agreeDataProcessing: false,
    identityVerified: false,
    identityName: '',
    identityPhone: '',
    paymentMethod: "free_trial",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardHolder: "",
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    const planParam = searchParams.get("plan");
    const billingParam = searchParams.get("billing");
    const updates: Partial<SignupForm> = {};
    if (planParam && ["free", "basic", "standard", "enterprise"].includes(planParam)) {
      updates.plan = planParam as PlanType;
    }
    if (billingParam && ["monthly", "1year", "2year", "3year"].includes(billingParam)) {
      updates.billingCycle = billingParam as BillingCycle;
    }
    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }));
    }
  }, [searchParams]);

  const updateForm = (updates: Partial<SignupForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const selectedPlan = PLANS.find((p) => p.id === form.plan)!;
  const isPaidPlan = selectedPlan.pricing !== null && selectedPlan.pricing.monthly > 0;
  const totalSteps = isPaidPlan ? 4 : 3;
  const monthlyEq = getMonthlyEquivalent(selectedPlan, form.billingCycle);
  const totalPrice = getTotalPrice(selectedPlan, form.billingCycle);
  const saving = getSaving(selectedPlan, form.billingCycle);

  const stepLabels = isPaidPlan
    ? ["플랜 선택", "사업자 정보", "계정 생성", "결제"]
    : ["플랜 선택", "사업자 정보", "계정 생성"];

  /* ── 회원가입 처리 (Step 3 완료 후) ── */
  const doSignup = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          companyName: form.companyName.trim(),
          ownerName: form.ownerName.trim(),
          businessNumber: form.businessNumber.trim() || undefined,
          ownerBirthDate: form.ownerBirthDate.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          addressDetail: form.addressDetail.trim() || undefined,
          businessType: form.businessType.trim() || undefined,
          businessCategory: form.businessCategory.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
          bankHolder: form.bankHolder.trim() || undefined,
          plan: form.plan,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        updateForm({ isLoading: false, error: result.error || '회원가입 실패' });
        return false;
      }

      // 서버에서 계정 생성 완료 → 자동 로그인
      const supabase = createBrowserSupabaseClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (loginError) {
        // 계정은 생성됐지만 로그인 실패 → 로그인 페이지로 유도
        updateForm({ isLoading: false, error: '계정이 생성되었습니다. 로그인 페이지에서 로그인해주세요.' });
        return false;
      }

      return true;
    } catch {
      updateForm({ isLoading: false, error: "회원가입 중 오류가 발생했습니다." });
      return false;
    }
  };

  /* ── Step 3 → 다음 ── */
  const handleStep3Next = async () => {
    if (!form.email.trim()) { updateForm({ error: "이메일을 입력해주세요." }); return; }
    if (form.password.length < 8) { updateForm({ error: "비밀번호는 8자 이상이어야 합니다." }); return; }
    if (!/[a-z]/.test(form.password)) { updateForm({ error: "비밀번호에 소문자를 포함해주세요." }); return; }
    if (!/[A-Z]/.test(form.password)) { updateForm({ error: "비밀번호에 대문자를 포함해주세요." }); return; }
    if (!/[0-9]/.test(form.password)) { updateForm({ error: "비밀번호에 숫자를 포함해주세요." }); return; }
    if (!/[^a-zA-Z0-9]/.test(form.password)) { updateForm({ error: "비밀번호에 특수문자를 포함해주세요. (예: !@#$%)" }); return; }
    if (form.password !== form.passwordConfirm) { updateForm({ error: "비밀번호가 일치하지 않습니다." }); return; }
    if (!form.agreeTerms || !form.agreePrivacy || !form.agreeDataProcessing) { updateForm({ error: "필수 약관에 모두 동의해주세요." }); return; }
    if (!form.identityVerified) { updateForm({ error: "본인인증을 완료해주세요." }); return; }

    // 유효성 통과
    if (!isPaidPlan) {
      // Free 플랜 → 결제 없이 바로 가입 완료
      updateForm({ isLoading: true, error: null });
      const ok = await doSignup();
      if (ok) window.location.replace("/portal/settings?tab=seal&welcome=1");
    } else {
      // 유료 플랜 → Step 4 결제로 이동
      updateForm({ step: 4, error: null });
    }
  };

  /* ── Step 4 결제 처리 ── */
  const handlePayment = async () => {
    if (form.paymentMethod === "card") {
      if (!form.cardNumber.trim() || !form.cardExpiry.trim() || !form.cardCvc.trim() || !form.cardHolder.trim()) {
        updateForm({ error: "카드 정보를 모두 입력해주세요." });
        return;
      }
      if (!/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(form.cardNumber.replace(/\s/g, "").replace(/-/g, ""))) {
        // 간단한 16자리 체크
        if (form.cardNumber.replace(/[\s-]/g, "").length !== 16) {
          updateForm({ error: "카드번호 16자리를 정확히 입력해주세요." });
          return;
        }
      }
    }

    updateForm({ isLoading: true, error: null });

    // 1. 먼저 회원가입 처리
    const signupOk = await doSignup();
    if (!signupOk) return;

    // 2. 결제 처리 (PG 연동 시 여기서 처리)
    if (form.paymentMethod === "free_trial") {
      // 14일 무료 체험 → Free 플랜으로 시작, 선택 플랜은 대기
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.app_metadata?.agency_id) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 14);
          await supabase.from("subscriptions").insert({
            agency_id: user.app_metadata.agency_id,
            plan: "free",
            billing_cycle: form.billingCycle,
            status: "trialing",
            monthly_amount: 0,
            total_amount: 0,
            payment_method: "free_trial",
            started_at: new Date().toISOString(),
            trial_ends_at: trialEnd.toISOString(),
            pending_plan: form.plan, // 체험 후 업그레이드할 플랜
          } as never);
          // agency 플랜을 free로 설정 (체험 중)
          await supabase.from("agencies").update({
            plan: "free",
            max_drivers: 10,
            monthly_fee: 0,
          } as never).eq("id", user.app_metadata.agency_id);
        }
      } catch {
        // 구독 기록 실패해도 가입은 완료
      }
      window.location.replace("/portal/settings?tab=seal&welcome=1");
    } else if (form.paymentMethod === "card") {
      // TODO: PG사 결제 API 연동 (토스페이먼츠, 아임포트 등)
      // 현재는 결제 정보 저장 후 대시보드로 이동
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.app_metadata?.agency_id) {
          await supabase.from("subscriptions").insert({
            agency_id: user.app_metadata.agency_id,
            plan: form.plan,
            billing_cycle: form.billingCycle,
            status: "active",
            monthly_amount: Math.round(monthlyEq),
            total_amount: Math.round(totalPrice),
            payment_method: "card",
            started_at: new Date().toISOString(),
            trial_ends_at: null,
          } as never);
        }
      } catch {
        // 구독 기록 실패해도 가입은 완료
      }
      window.location.replace("/portal/settings?tab=seal&welcome=1");
    } else if (form.paymentMethod === "transfer") {
      // 계좌이체 → 입금 확인 후 활성화
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.app_metadata?.agency_id) {
          await supabase.from("subscriptions").insert({
            agency_id: user.app_metadata.agency_id,
            plan: form.plan,
            billing_cycle: form.billingCycle,
            status: "pending_payment",
            monthly_amount: Math.round(monthlyEq),
            total_amount: Math.round(totalPrice),
            payment_method: "transfer",
            started_at: new Date().toISOString(),
          } as never);
        }
      } catch {
        // 구독 기록 실패해도 가입은 완료
      }
      window.location.replace("/portal/settings?tab=seal&welcome=1");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[720px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="logiSSign" className="w-12 h-12 object-contain mb-4" />
          <h1 className="font-headline text-xl font-bold text-on-surface">회원가입</h1>
          <p className="font-korean text-sm text-on-surface-variant mt-1">대리점 관리 서비스를 시작하세요</p>
        </div>

        {/* Step Indicator — 동적 (Free=3단계, 유료=4단계) */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                form.step >= s ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
              }`}>
                {form.step > s ? "✓" : s}
              </div>
              {s < totalSteps && (
                <div className={`w-12 h-0.5 rounded-full ${form.step > s ? "bg-primary" : "bg-surface-container-high"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-on-surface-variant mb-6 font-label">
          {stepLabels[(form.step - 1)] ?? ""}
        </div>

        {/* ═══════════ Step 1: 플랜 & 결제주기 ═══════════ */}
        {form.step === 1 && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
              {CYCLE_OPTIONS.map((opt) => {
                const isActive = form.billingCycle === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => updateForm({ billingCycle: opt.value })}
                    className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive ? "bg-power-gradient text-white shadow-md" : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/15 hover:border-primary/30"
                    }`}>
                    {opt.label}
                    {opt.badge && (
                      <span className={`ml-1.5 text-[10px] font-bold ${isActive ? "text-blue-200" : "text-tertiary"}`}>{opt.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => {
                const isSelected = form.plan === plan.id;
                const mEq = getMonthlyEquivalent(plan, form.billingCycle);
                const discount = getDiscountRate(plan, form.billingCycle);
                const total = getTotalPrice(plan, form.billingCycle);
                const sv = getSaving(plan, form.billingCycle);
                const isFree = plan.pricing?.monthly === 0;
                const isEnt = !plan.pricing;

                return (
                  <button key={plan.id} type="button"
                    onClick={() => !plan.contactOnly && updateForm({ plan: plan.id })}
                    className={`relative bg-surface-container-lowest rounded-2xl p-5 text-left transition-all ${
                      isSelected ? "shadow-float ring-2 ring-primary" : "shadow-card hover:shadow-ambient"
                    } ${plan.contactOnly ? "cursor-default" : ""}`}>
                    {plan.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-power-gradient text-white text-[10px] font-bold">추천</span>
                    )}
                    <h3 className="font-headline text-base font-bold text-on-surface">{plan.name}</h3>

                    {isEnt ? (
                      <p className="font-data text-xl font-bold mt-2 text-on-surface-variant">상담문의</p>
                    ) : isFree ? (
                      <>
                        <p className="font-data text-xl font-bold mt-2 text-primary">₩0</p>
                        <p className="text-[11px] text-on-surface-variant">/ 월 · 영구 무료</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="font-data text-xl font-bold text-primary">₩{formatPrice(mEq)}</span>
                          <span className="text-[11px] text-on-surface-variant">/ 월</span>
                        </div>
                        {discount > 0 && (
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            <span className="line-through mr-1">₩{formatPrice(plan.pricing!.monthly)}</span>
                            <span className="text-tertiary font-bold">-{discount}%</span>
                          </p>
                        )}
                        {form.billingCycle !== "monthly" && (
                          <div className="mt-1.5 p-2 rounded-lg bg-primary/[0.04] border border-primary/10">
                            <p className="text-[11px] text-on-surface font-medium font-data">총 ₩{formatPrice(total)} 일시불</p>
                            {sv > 0 && <p className="text-[10px] text-tertiary font-bold mt-0.5">₩{formatPrice(sv)} 절약</p>}
                          </div>
                        )}
                      </>
                    )}

                    {plan.maxDrivers && <p className="text-[11px] text-on-surface-variant mt-1.5 font-data">최대 {plan.maxDrivers}명</p>}
                    {!plan.maxDrivers && !plan.contactOnly && <p className="text-[11px] text-on-surface-variant mt-1.5">무제한</p>}

                    <ul className="mt-3 space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs text-on-surface-variant flex items-start gap-1.5">
                          <span className="text-tertiary mt-0.5 shrink-0">✓</span>
                          <span className="font-korean">{f}</span>
                        </li>
                      ))}
                      {plan.disabled.map((f) => (
                        <li key={f} className="text-xs text-on-surface-variant/40 flex items-start gap-1.5 line-through">
                          <span className="mt-0.5 shrink-0">—</span>
                          <span className="font-korean">{f}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.contactOnly && (
                      <a href="mailto:contact@logissign.com" onClick={(e) => e.stopPropagation()}
                        className="mt-4 block w-full h-9 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-xs font-medium text-center leading-9 hover:bg-surface-container-highest transition-colors font-korean">
                        상담 문의
                      </a>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 선택 요약 */}
            {selectedPlan.pricing && selectedPlan.pricing.monthly > 0 && (
              <div className="mt-6 p-4 rounded-2xl bg-surface-container-lowest shadow-card">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-sm font-bold text-on-surface">{selectedPlan.name}</span>
                    <span className="text-on-surface-variant text-sm ml-2">· {CYCLE_LABEL[form.billingCycle]}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary font-data">₩{formatPrice(monthlyEq)}</span>
                    <span className="text-sm text-on-surface-variant"> /월</span>
                  </div>
                </div>
                {form.billingCycle !== "monthly" && (
                  <div className="mt-2 pt-2 border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant">
                    <span>일시불 결제 금액</span>
                    <span className="font-data font-bold text-on-surface">₩{formatPrice(totalPrice)}</span>
                  </div>
                )}
                {saving > 0 && (
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-on-surface-variant">월결제 대비 절약</span>
                    <span className="font-data font-bold text-tertiary">₩{formatPrice(saving)}</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-outline-variant/10">
                  <p className="text-[11px] text-on-surface-variant mb-2 font-medium">결제주기별 비교</p>
                  <div className="grid grid-cols-4 gap-2">
                    {CYCLE_OPTIONS.map((opt) => {
                      const mE = getMonthlyEquivalent(selectedPlan, opt.value);
                      const d = getDiscountRate(selectedPlan, opt.value);
                      const isThis = form.billingCycle === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => updateForm({ billingCycle: opt.value })}
                          className={`p-2 rounded-lg text-center transition-all ${
                            isThis ? "bg-primary/10 border border-primary/20" : "bg-surface-container-low border border-transparent hover:border-outline-variant/20"
                          }`}>
                          <p className={`text-[10px] font-bold ${isThis ? "text-primary" : "text-on-surface-variant"}`}>{opt.label}</p>
                          <p className={`text-xs font-bold font-data mt-0.5 ${isThis ? "text-primary" : "text-on-surface"}`}>₩{formatPrice(mE)}</p>
                          <p className="text-[10px] text-on-surface-variant">/월</p>
                          {d > 0 && <p className="text-[10px] font-bold text-tertiary mt-0.5">-{d}%</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <button type="button" onClick={() => updateForm({ step: 2 })}
              disabled={PLANS.find((p) => p.id === form.plan)?.contactOnly}
              className="w-full h-11 mt-6 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              다음
            </button>
          </div>
        )}

        {/* ═══════════ Step 2: 사업자 정보 ═══════════ */}
        {form.step === 2 && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 max-w-[560px] mx-auto">
            <h3 className="font-headline text-base font-bold text-on-surface mb-5 font-korean">사업자 정보</h3>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">대리점명 (상호) *</label>
                  <input type="text" placeholder="예: 강남 제1 대리점" value={form.companyName} onChange={(e) => updateForm({ companyName: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">사업자등록번호 *</label>
                  <input type="text" placeholder="000-00-00000" value={form.businessNumber} onChange={(e) => updateForm({ businessNumber: formatBusinessNumber(e.target.value) })} maxLength={12}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">대표자명 *</label>
                  <input type="text" placeholder="홍길동" value={form.ownerName} onChange={(e) => updateForm({ ownerName: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">대표자 생년월일</label>
                  <input type="text" placeholder="1980-01-15" value={form.ownerBirthDate} onChange={(e) => updateForm({ ownerBirthDate: formatBirthDate(e.target.value) })} maxLength={10}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">연락처 *</label>
                  <input type="tel" placeholder="010-0000-0000" value={form.phone} onChange={(e) => updateForm({ phone: formatPhoneNumber(e.target.value) })} maxLength={13}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">이메일 *</label>
                  <input type="email" placeholder="example@company.com" value={form.email} onChange={(e) => updateForm({ email: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data" />
                </div>
              </div>
              <div className="pt-3 border-t border-outline-variant/20"><p className="text-xs font-medium text-on-surface-variant mb-3 font-korean">사업장 정보</p></div>
              <div>
                <AddressSearch value={form.address} detailValue={form.addressDetail} label="사업장 주소" required
                  onChange={(addr: AddressValue) => updateForm({ address: addr.address, addressDetail: addr.addressDetail })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">업태 *</label>
                  <input type="text" placeholder="운수업" value={form.businessType} onChange={(e) => updateForm({ businessType: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">종목 *</label>
                  <input type="text" placeholder="택배, 화물운송" value={form.businessCategory} onChange={(e) => updateForm({ businessCategory: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean" />
                </div>
              </div>
            </div>
            {form.error && <p className="text-error text-xs mt-2">{form.error}</p>}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => updateForm({ step: 1, error: null })}
                className="flex-1 h-11 rounded-xl bg-surface-container-high text-on-surface-variant font-medium text-sm hover:bg-surface-container-highest transition-colors">이전</button>
              <button type="button"
                onClick={() => {
                  if (!form.companyName.trim()) { updateForm({ error: "대리점명(상호)을 입력해주세요." }); return; }
                  if (!form.businessNumber.trim()) { updateForm({ error: "사업자등록번호를 입력해주세요." }); return; }
                  if (!/^\d{3}-\d{2}-\d{5}$/.test(form.businessNumber.trim())) { updateForm({ error: "사업자등록번호 형식: 000-00-00000" }); return; }
                  if (!form.ownerName.trim()) { updateForm({ error: "대표자명을 입력해주세요." }); return; }
                  if (!form.phone.trim()) { updateForm({ error: "연락처를 입력해주세요." }); return; }
                  if (!form.email.trim()) { updateForm({ error: "이메일을 입력해주세요." }); return; }
                  if (!form.address.trim()) { updateForm({ error: "사업장 주소를 입력해주세요." }); return; }
                  if (!form.businessType.trim() || !form.businessCategory.trim()) { updateForm({ error: "업태와 종목을 입력해주세요." }); return; }
                  updateForm({ step: 3, error: null });
                }}
                className="flex-[2] h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all">다음</button>
            </div>
          </div>
        )}

        {/* ═══════════ Step 3: 계정 생성 ═══════════ */}
        {form.step === 3 && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 max-w-[460px] mx-auto">
            <h3 className="font-headline text-base font-bold text-on-surface mb-5 font-korean">계정 생성</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">이메일 (로그인 ID)</label>
                <input type="email" value={form.email} disabled
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-high text-on-surface/60 text-sm cursor-not-allowed font-data" />
                <p className="text-[11px] text-on-surface-variant/50 mt-1 font-korean">Step 2에서 입력한 이메일로 로그인합니다</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">비밀번호</label>
                <input type="password" placeholder="8자 이상 (대소문자+숫자+특수문자)" value={form.password} onChange={(e) => updateForm({ password: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                <p className="text-xs text-on-surface-variant/50 mt-1">예: MyPass1! (대문자+소문자+숫자+특수문자 포함)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">비밀번호 확인</label>
                <input type="password" placeholder="비밀번호 재입력" value={form.passwordConfirm} onChange={(e) => updateForm({ passwordConfirm: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
              </div>

              {/* 선택 요약 */}
              <div className="p-4 rounded-xl bg-surface-container-low">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">선택 플랜</span>
                  <span className="text-sm font-bold text-primary font-data">
                    {selectedPlan.name} — {isPaidPlan ? `₩${formatPrice(monthlyEq)}/월` : "무료"}
                  </span>
                </div>
                {isPaidPlan && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-on-surface-variant">결제주기</span>
                    <span className="text-xs font-medium text-on-surface">
                      {CYCLE_LABEL[form.billingCycle]}
                      {getDiscountRate(selectedPlan, form.billingCycle) > 0 && (
                        <span className="text-tertiary ml-1">(-{getDiscountRate(selectedPlan, form.billingCycle)}%)</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-on-surface-variant">기사 제한</span>
                  <span className="text-xs font-medium text-on-surface font-data">
                    {selectedPlan.maxDrivers ? `최대 ${selectedPlan.maxDrivers}명` : "무제한"}
                  </span>
                </div>
              </div>

              {/* 본인인증 */}
              <div className="p-4 rounded-xl border-2 border-outline-variant/15 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface font-korean flex items-center gap-2">
                      🔐 본인인증
                      {form.identityVerified && <span className="text-xs text-tertiary font-normal">✓ 인증 완료</span>}
                    </p>
                    <p className="text-xs text-on-surface-variant font-korean mt-0.5">
                      {form.identityVerified
                        ? `${form.identityName} (${form.identityPhone})`
                        : '가입을 위해 본인인증이 필요합니다'}
                    </p>
                  </div>
                  {!form.identityVerified ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
                        if (!storeId) {
                          alert('본인인증 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.');
                          return;
                        }
                        try {
                          const PortOne = await import('@portone/browser-sdk/v2');
                          const verificationId = `identity_${Date.now()}`;
                          const result = await PortOne.requestIdentityVerification({
                            storeId,
                            identityVerificationId: verificationId,
                            channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '',
                          });
                          if (!result || result.code) {
                            alert('본인인증 실패: ' + (result?.message ?? ''));
                            return;
                          }
                          // 서버에서 결과 조회
                          const res = await fetch('/api/payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'verify-identity', identityVerificationId: verificationId }),
                          });
                          const data = await res.json();
                          if (data.verified) {
                            updateForm({
                              identityVerified: true,
                              identityName: data.name,
                              identityPhone: data.phone,
                              ownerName: data.name || form.ownerName,
                              phone: data.phone || form.phone,
                            });
                          } else {
                            alert('본인인증 확인 실패: ' + (data.error ?? ''));
                          }
                        } catch (err) {
                          alert('본인인증 오류: ' + (err instanceof Error ? err.message : ''));
                        }
                      }}
                      className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white text-sm font-semibold hover:shadow-lg transition-all font-korean"
                    >
                      본인인증 하기
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg bg-tertiary/10 text-tertiary text-xs font-semibold">인증됨 ✓</span>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 mt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.agreeTerms} onChange={(e) => updateForm({ agreeTerms: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-xs text-on-surface-variant"><a href="/terms" target="_blank" className="text-primary underline">이용약관</a>에 동의합니다 (필수)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.agreePrivacy} onChange={(e) => updateForm({ agreePrivacy: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-xs text-on-surface-variant"><a href="/privacy" target="_blank" className="text-primary underline">개인정보처리방침</a>에 동의합니다 (필수)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.agreeDataProcessing} onChange={(e) => updateForm({ agreeDataProcessing: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-xs text-on-surface-variant">[필수] <strong className="text-on-surface">개인정보처리 서약</strong> — 소속 기사의 개인정보를 관련 법령에 따라 안전하게 관리하며, 목적 외 이용·제3자 제공·유출 시 법적 책임을 부담할 것을 서약합니다</span>
                </label>
              </div>

              {form.error && <p className="text-error text-xs">{form.error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => updateForm({ step: 2 })}
                className="flex-1 h-11 rounded-xl bg-surface-container-high text-on-surface-variant font-medium text-sm hover:bg-surface-container-highest transition-colors">이전</button>
              <button type="button" onClick={handleStep3Next} disabled={form.isLoading}
                className="flex-[2] h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60">
                {form.isLoading ? "처리 중..." : isPaidPlan ? "다음 — 결제" : "가입 완료"}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Step 4: 결제 (유료 플랜만) ═══════════ */}
        {form.step === 4 && isPaidPlan && (
          <div className="max-w-[520px] mx-auto">
            {/* 주문 요약 */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 mb-5">
              <h3 className="font-headline text-base font-bold text-on-surface mb-4 font-korean">주문 요약</h3>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">플랜</span>
                  <span className="font-bold text-on-surface">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">결제주기</span>
                  <span className="font-medium text-on-surface">{CYCLE_LABEL[form.billingCycle]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">정가</span>
                  <span className="text-on-surface-variant font-data">
                    ₩{formatPrice(selectedPlan.pricing!.monthly)} × {getMonths(form.billingCycle)}개월 = ₩{formatPrice(selectedPlan.pricing!.monthly * getMonths(form.billingCycle))}
                  </span>
                </div>
                {saving > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">할인 ({getDiscountRate(selectedPlan, form.billingCycle)}%)</span>
                    <span className="text-tertiary font-bold font-data">-₩{formatPrice(saving)}</span>
                  </div>
                )}
                <div className="border-t border-outline-variant/15 pt-2.5 mt-2.5">
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-on-surface">결제 금액</span>
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-primary font-data">
                        {form.billingCycle === "monthly"
                          ? `₩${formatPrice(monthlyEq)}`
                          : `₩${formatPrice(totalPrice)}`
                        }
                      </span>
                      {form.billingCycle !== "monthly" && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5">월 ₩{formatPrice(monthlyEq)} 환산</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">기사 제한</span>
                  <span className="font-medium text-on-surface font-data">최대 {selectedPlan.maxDrivers}명</span>
                </div>
              </div>
            </div>

            {/* 결제 방법 선택 */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
              <h3 className="font-headline text-base font-bold text-on-surface mb-4 font-korean">결제 방법</h3>

              <div className="space-y-3 mb-5">
                {/* 14일 무료 체험 */}
                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  form.paymentMethod === "free_trial" ? "border-primary bg-primary/[0.03]" : "border-outline-variant/15 hover:border-outline-variant/30"
                }`}>
                  <input type="radio" name="payment" value="free_trial" checked={form.paymentMethod === "free_trial"}
                    onChange={() => updateForm({ paymentMethod: "free_trial" })} className="mt-0.5 accent-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-on-surface">14일 무료 체험</span>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[10px] font-bold">추천</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      카드 등록 없이 14일간 Free 플랜(기본 정산 관리, 기사 10명)으로 서비스를 체험해보세요.
                      체험 기간 중 유료 결제하시면 즉시 {selectedPlan.name} 플랜으로 업그레이드됩니다.
                    </p>
                  </div>
                </label>

                {/* 카드 결제 */}
                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  form.paymentMethod === "card" ? "border-primary bg-primary/[0.03]" : "border-outline-variant/15 hover:border-outline-variant/30"
                }`}>
                  <input type="radio" name="payment" value="card" checked={form.paymentMethod === "card"}
                    onChange={() => updateForm({ paymentMethod: "card" })} className="mt-0.5 accent-primary" />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-on-surface">신용/체크카드</span>
                    <p className="text-xs text-on-surface-variant mt-1">즉시 결제 후 바로 시작</p>
                  </div>
                </label>

                {/* 계좌이체 */}
                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  form.paymentMethod === "transfer" ? "border-primary bg-primary/[0.03]" : "border-outline-variant/15 hover:border-outline-variant/30"
                }`}>
                  <input type="radio" name="payment" value="transfer" checked={form.paymentMethod === "transfer"}
                    onChange={() => updateForm({ paymentMethod: "transfer" })} className="mt-0.5 accent-primary" />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-on-surface">계좌이체 (세금계산서)</span>
                    <p className="text-xs text-on-surface-variant mt-1">입금 확인 후 활성화 (영업일 1~2일)</p>
                  </div>
                </label>
              </div>

              {/* 카드 입력 폼 */}
              {form.paymentMethod === "card" && (
                <div className="space-y-3 mb-5 p-4 rounded-xl bg-surface-container-low">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">카드번호</label>
                    <input type="text" placeholder="0000-0000-0000-0000" value={form.cardNumber}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "").slice(0, 16);
                        v = v.replace(/(\d{4})(?=\d)/g, "$1-");
                        updateForm({ cardNumber: v });
                      }}
                      className="w-full h-11 px-4 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data tracking-wider" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5">유효기간</label>
                      <input type="text" placeholder="MM/YY" value={form.cardExpiry}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                          updateForm({ cardExpiry: v });
                        }}
                        className="w-full h-11 px-4 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5">CVC</label>
                      <input type="password" placeholder="000" maxLength={4} value={form.cardCvc}
                        onChange={(e) => updateForm({ cardCvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        className="w-full h-11 px-4 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-data" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5">카드 소유자</label>
                      <input type="text" placeholder="홍길동" value={form.cardHolder}
                        onChange={(e) => updateForm({ cardHolder: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007d55" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <p className="text-[11px] text-on-surface-variant">256bit SSL 암호화로 안전하게 처리됩니다</p>
                  </div>
                </div>
              )}

              {/* 계좌이체 안내 */}
              {form.paymentMethod === "transfer" && (
                <div className="mb-5 p-4 rounded-xl bg-surface-container-low">
                  <p className="text-sm font-bold text-on-surface mb-2">입금 안내</p>
                  <div className="space-y-1.5 text-xs text-on-surface-variant">
                    <p>입금 계좌: <span className="font-bold text-on-surface font-data">국민은행 000-000000-00-000</span></p>
                    <p>예금주: <span className="font-bold text-on-surface">주식회사 로지에스사인</span></p>
                    <p>입금액: <span className="font-bold text-primary font-data">₩{formatPrice(form.billingCycle === "monthly" ? monthlyEq : totalPrice)}</span></p>
                    <p className="mt-2 text-[11px] text-on-surface-variant/70">입금자명을 사업자명과 동일하게 입력해주세요. 세금계산서는 입금 확인 후 이메일로 발송됩니다.</p>
                  </div>
                </div>
              )}

              {/* 무료 체험 안내 */}
              {form.paymentMethod === "free_trial" && (
                <div className="mb-5 p-4 rounded-xl bg-tertiary/[0.05] border border-tertiary/15">
                  <div className="flex items-start gap-2.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007d55" strokeWidth="2" className="shrink-0 mt-0.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-on-surface mb-1">14일 무료 체험 안내</p>
                      <ul className="space-y-1 text-xs text-on-surface-variant">
                        <li>신용카드 등록 없이 바로 시작할 수 있습니다</li>
                        <li>14일간 <strong className="text-on-surface">Free 플랜</strong>으로 기본 기능 체험 (기사 10명, 기본 정산)</li>
                        <li>기사 앱, 전자계약서, 세금계산서 등 유료 기능은 결제 후 이용 가능</li>
                        <li>체험 중 언제든 결제하면 즉시 <strong className="text-primary">{selectedPlan.name}</strong> 플랜으로 업그레이드</li>
                        <li>체험 종료 3일 전 이메일로 알림을 보내드립니다</li>
                        <li>14일 후 결제하지 않으면 Free 플랜으로 계속 이용 가능</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {form.error && <p className="text-error text-xs mb-3">{form.error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => updateForm({ step: 3, error: null })}
                  className="flex-1 h-11 rounded-xl bg-surface-container-high text-on-surface-variant font-medium text-sm hover:bg-surface-container-highest transition-colors">이전</button>
                <button type="button" onClick={handlePayment} disabled={form.isLoading}
                  className="flex-[2] h-12 rounded-xl bg-power-gradient text-white font-bold text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60">
                  {form.isLoading ? "처리 중..." :
                    form.paymentMethod === "free_trial" ? "14일 무료 체험 시작" :
                    form.paymentMethod === "card" ? `₩${formatPrice(form.billingCycle === "monthly" ? monthlyEq : totalPrice)} 결제하기` :
                    "계좌이체 신청"
                  }
                </button>
              </div>

              <p className="text-center text-[11px] text-on-surface-variant/60 mt-3">
                결제 후 14일 이내 전액 환불 가능 · 부가세 별도
              </p>
            </div>
          </div>
        )}

        {/* Back to login */}
        <div className="text-center mt-6">
          <Link href="/portal/login" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            이미 계정이 있으신가요? <span className="text-primary font-medium">로그인</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
