'use client';

import { useState, FormEvent } from 'react';
import {
  PLAN_PRICES, PLAN_HIGHLIGHTS, PLAN_LABELS,
  FREE_PLAN_FREE_DRIVERS, type PlanType,
} from '@/lib/plan-limits';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ───────────────────────── Data ───────────────────────── */

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    title: '엑셀 업로드 자동 정산',
    desc: '쿠팡·CJ·한진·롯데·로젠 등 운송사 엑셀을 그대로 업로드하면 사번 매칭부터 단가 계산, 공제·인센티브까지 한 번에 처리합니다.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
    title: '앱 전자서명 — 외부 연동 불필요',
    desc: '카카오·이메일 인증이 아닌, 기사 전용 앱에서 직접 전자서명. 외부 서비스 비용 없이 위수탁 표준계약서를 법적 효력 있게 체결합니다.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
    title: '기사 전용 앱',
    desc: '정산서 확인, 계약서 서명, 법정교육 이수, 공지사항까지. 기사에게 필요한 모든 것을 하나의 앱에서 제공합니다.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    ),
    title: '매출 리포트 & 대시보드',
    desc: '기사별·화주별·월별 정산 현황을 실시간으로 확인. KPI 대시보드와 매출 리포트로 경영 현황을 한눈에 파악합니다.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: '기사 관리 & 법정교육',
    desc: '기사 등록부터 인적사항, 차량정보, 세금 유형까지 통합 관리. 안전교육·성희롱예방 등 법정교육 이수도 앱에서 완료.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M7 15h0M2 9.5h20" />
      </svg>
    ),
    title: '세금계산서 자동 발행',
    desc: '정산이 확정되면 세금계산서와 현금영수증을 자동 생성. 기사의 세금 유형(간이·일반·사업자 등)에 맞춰 자동 처리합니다.',
  },
];

const COMPARE = [
  { feature: '전자서명 방식', us: '자체 앱 서명 (무료)', them: '카카오/이메일 인증 (건당 과금)' },
  { feature: '서명 비용', us: '월정액에 포함', them: '건당 100~300원' },
  { feature: '배송 정산 연동', us: '엑셀 업로드 → 자동 정산', them: '미지원' },
  { feature: '기사 전용 앱', us: '기본 제공', them: '미지원' },
  { feature: '법정교육 관리', us: '앱 내 이수 + 수료증', them: '미지원' },
  { feature: '화주별 단가 설정', us: '화주/노선별 세분화', them: '미지원' },
  { feature: '세금계산서 발행', us: '자동 생성', them: '별도 서비스' },
  { feature: '타겟 업종', us: '택배·배송 대리점 특화', them: '범용 전자계약' },
];

/* 결제 모델별 가격 */
type BillingCycle = 'monthly' | '1year' | '2year';

interface PlanPricing {
  monthly: number;        // 월결제 가격
  yearly1: number;        // 1년 일시불 총액
  yearly2: number;
  discountYear1: number;
  discountYear2: number;
}

interface Plan {
  id: string;
  name: string;
  pricing: PlanPricing | null;
  desc: string;
  maxDrivers: number | null;
  features: string[];
  disabled: string[];
  techFeatures: string[];
  cta: string;
  popular: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: '무료',
    pricing: {
      monthly: 0, yearly1: 0, yearly2: 0,
      discountYear1: 0, discountYear2: 0,
    },
    desc: '소규모 대리점 시작',
    maxDrivers: 10,
    features: ['기사 10명까지', '기본 정산 관리', '엑셀 업로드 정산', '대시보드'],
    disabled: ['기사 앱', '전자계약서', '세금계산서', '리포트'],
    techFeatures: ['Supabase RLS 데이터 격리', '웹 기반 포탈 접근'],
    cta: '무료 시작',
    popular: false,
  },
  {
    id: 'basic',
    name: 'Basic',
    pricing: {
      monthly: 49900,
      yearly1: Math.round(49900 * 12 * 0.8),
      yearly2: Math.round(49900 * 24 * 0.7),
      discountYear1: 20, discountYear2: 30,
    },
    desc: '성장하는 대리점에 추천',
    maxDrivers: 30,
    features: ['기사 30명까지', '기사 모바일 앱', '정산서 발송', '전자계약서 발송/서명', '세금계산서 발행', '이메일 지원'],
    disabled: [],
    techFeatures: ['SHA-256 해시 기반 문서 진위확인', 'QR 코드 검증 시스템', '감사추적인증서 자동 발급', 'PDF 워터마크 원본 증명'],
    cta: '시작하기',
    popular: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    pricing: {
      monthly: 99000,
      yearly1: 99000 * 12 * 0.8,
      yearly2: 99000 * 24 * 0.7,
      discountYear1: 20, discountYear2: 30,
    },
    desc: '중규모 대리점 운영',
    maxDrivers: 80,
    features: ['기사 80명까지', 'Basic 전체 기능', '매출 리포트', '푸시 알림', '전화 지원'],
    disabled: [],
    techFeatures: ['SHA-256 트리플 해싱 위변조 방지', 'DB 불변 트리거 (서명 데이터 보호)', '정기 무결성 검사 (CRON)', '해시 체인 감사추적'],
    cta: '시작하기',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    pricing: {
      monthly: 199000,
      yearly1: 199000 * 12 * 0.8,
      yearly2: 199000 * 24 * 0.7,
      discountYear1: 20, discountYear2: 30,
    },
    desc: '대규모 대리점 전담 지원',
    maxDrivers: 150,
    features: ['기사 150명까지', 'Standard 전체 기능', '전담 지원', 'API 연동', '맞춤형 정산 규칙'],
    disabled: [],
    techFeatures: ['전담 기술 지원', '커스텀 API 연동', '맞춤형 정산 로직'],
    cta: '시작하기',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pricing: null,
    desc: '150명 이상 맞춤 구축',
    maxDrivers: null,
    features: ['기사 150명 이상', 'Pro 전체 기능', '전담 매니저', 'SLA 99.9%', '커스텀 계약서', '온보딩 지원'],
    disabled: [],
    techFeatures: ['전담 보안 감사 리포트', '커스텀 API 연동', '전용 서버 옵션', '위변조 감지 알림 (Slack/이메일)'],
    cta: '상담 신청',
    popular: false,
  },
];

/* 맞춤 플랜 찾기 질문 */
const PLAN_QUIZ = [
  { q: '현재 소속 기사 수가 몇 명인가요?', options: ['10명 이하', '11~30명', '31~80명', '81~150명', '150명 이상'] },
  { q: '전자계약서(위수탁 표준계약서) 기능이 필요한가요?', options: ['필요 없음', '필요함'] },
  { q: '계약서 진위확인·위변조 방지가 중요한가요?', options: ['중요하지 않음', '있으면 좋겠음', '필수'] },
  { q: '결제 방식은 어떤 것을 선호하시나요?', options: ['월결제', '1년 일시불 (20% 할인)', '2년 일시불 (30% 할인)'] },
];

/* 가격 포맷 */
function formatPrice(amount: number): string {
  if (amount === 0) return '0';
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount));
}

function getMonthlyEquivalent(plan: Plan, cycle: BillingCycle): number {
  if (!plan.pricing) return 0;
  switch (cycle) {
    case 'monthly': return plan.pricing.monthly;
    case '1year': return plan.pricing.yearly1 / 12;
    case '2year': return plan.pricing.yearly2 / 24;
  }
}

function getTotalPrice(plan: Plan, cycle: BillingCycle): number {
  if (!plan.pricing) return 0;
  switch (cycle) {
    case 'monthly': return plan.pricing.monthly;
    case '1year': return plan.pricing.yearly1;
    case '2year': return plan.pricing.yearly2;
  }
}

function getDiscount(plan: Plan, cycle: BillingCycle): number {
  if (!plan.pricing) return 0;
  switch (cycle) {
    case 'monthly': return 0;
    case '1year': return plan.pricing.discountYear1;
    case '2year': return plan.pricing.discountYear2;
  }
}

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: '월결제',
  '1year': '1년 일시불',
  '2year': '2년 일시불',
  
};

const FAQS = [
  {
    q: '전자서명에 법적 효력이 있나요?',
    a: 'logiSSign의 전자서명은 전자서명법에 따라 법적 효력을 갖습니다. 서명 시 본인인증, IP 주소, 서명 시각, 동의 내역이 모두 기록되어 법적 분쟁 시 증거로 활용할 수 있습니다.',
  },
  {
    q: '모두싸인 같은 외부 전자서명 서비스와 뭐가 다른가요?',
    a: '모두싸인은 범용 전자계약 서비스로 카카오/이메일을 통해 서명합니다. logiSSign은 배송 기사 전용 앱에서 직접 서명하므로 건당 과금이 없고, 정산·교육·계약이 하나의 플랫폼에 통합되어 있습니다.',
  },
  {
    q: '기존에 사용하던 엑셀 양식을 그대로 쓸 수 있나요?',
    a: '네, 쿠팡·CJ대한통운·한진택배·롯데택배·로젠택배 등 주요 운송사의 엑셀 양식을 자동으로 인식합니다. 커스텀 양식도 칼럼 매핑 설정으로 사용할 수 있습니다.',
  },
  {
    q: '기사가 스마트폰이 없으면 어떻게 하나요?',
    a: 'Free 플랜에서는 웹 기반 정산만으로도 운영 가능합니다. 기사 앱이 없어도 로그인에서 정산서 생성·확인이 가능하며, 필요 시 PDF로 출력할 수 있습니다.',
  },
  {
    q: '데이터 보안은 어떻게 관리되나요?',
    a: '모든 데이터는 Supabase(AWS 기반) 클라우드에 암호화 저장됩니다. Row Level Security(RLS) 정책으로 대리점 간 데이터가 완전히 격리되며, 금융 수준의 보안을 제공합니다.',
  },
  {
    q: '계약서 진위확인은 어떻게 하나요?',
    a: '서명 완료된 계약서에는 고유 문서번호(LSS-YYYY-NNNNNN)와 8자리 인증코드, QR 코드가 자동으로 부여됩니다. QR 코드를 스캔하거나 인증코드를 입력하면 누구나 문서의 진위를 즉시 확인할 수 있습니다. SHA-256 해시로 내용이 변조되지 않았음을 검증합니다.',
  },
  {
    q: '일시불 결제 시 할인은 어떻게 되나요?',
    a: '1년 일시불 20%, 2년 일시불 30% 할인이 적용됩니다. 예를 들어 Basic 플랜을 1년 일시불로 결제하면 월 ₩49,900 대신 월 ₩39,920(환산)에 사용하실 수 있습니다.',
  },
];

/* ───────────────────────── Components ───────────────────────── */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-outline-variant/20 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-[15px] font-semibold text-on-surface group-hover:text-primary transition-colors pr-4">
          {q}
        </span>
        <svg
          className={`w-5 h-5 text-on-surface-variant shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-60 pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm text-on-surface-variant leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ── 계약서 진위확인 ── */
function VerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('인증코드를 입력해주세요.');
      return;
    }
    if (!/^[A-Z0-9]{6,12}$/.test(trimmed)) {
      setError('영문·숫자 6~12자리 인증코드를 입력해주세요.');
      return;
    }
    setError('');
    router.push(`/verify/${trimmed}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-lg mx-auto">
      <div className="flex-1 relative">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          placeholder="인증코드 입력 (예: A1B2C3D4)"
          maxLength={12}
          className={`w-full h-12 px-4 rounded-xl border text-sm bg-white text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${
            error ? 'border-red-400' : 'border-outline-variant/20'
          }`}
        />
        {error && (
          <p className="absolute -bottom-5 left-1 text-[11px] text-red-500">{error}</p>
        )}
      </div>
      <button
        type="submit"
        className="h-12 px-6 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 transition-all shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        진위확인
      </button>
    </form>
  );
}

/* ── 맞춤 플랜 찾기 ── */
function PlanFinder() {
  const [step, setStep] = useState(-1); // -1 = 시작 전
  const [answers, setAnswers] = useState<number[]>([]);

  const pickAnswer = (idx: number) => {
    const next = [...answers, idx];
    setAnswers(next);
    if (next.length < PLAN_QUIZ.length) {
      setStep(step + 1);
    } else {
      setStep(PLAN_QUIZ.length); // 결과
    }
  };

  const getRecommendation = (): { plan: Plan; cycle: BillingCycle; reason: string } => {
    const driverSize = answers[0] ?? 0;   // 0=10이하, 1=11~50, 2=51~100, 3=100+
    const needContract = answers[1] ?? 0;  // 0=불필요, 1=필요
    const needSecurity = answers[2] ?? 0;  // 0=안중요, 1=있으면, 2=필수
    const billingPref = answers[3] ?? 0;   // 0=월, 1=1년, 2=2년

    const cycles: BillingCycle[] = ['monthly', '1year', '2year'];
    const cycle = cycles[billingPref] ?? 'monthly';

    if (driverSize >= 3 || needSecurity >= 2) {
      return { plan: PLANS[4], cycle, reason: '기사 150명 이상이므로 Enterprise를 추천합니다.' };
    }
    if (driverSize >= 2 || needSecurity >= 1) {
      return { plan: PLANS[2], cycle, reason: '기사 31명 이상이므로 Standard를 추천합니다.' };
    }
    if (driverSize >= 1 || needContract >= 1) {
      return { plan: PLANS[1], cycle, reason: '전자계약서가 필요하고 기사 30명까지 지원되는 Basic을 추천합니다.' };
    }
    return { plan: PLANS[0], cycle: 'monthly', reason: '기사 10명 이하에 기본 기능이면 충분하므로 Free로 시작하세요.' };
  };

  if (step === -1) {
    return (
      <button
        onClick={() => setStep(0)}
        className="w-full mt-8 h-14 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/[0.04] hover:border-primary/50 transition-all"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        나에게 맞는 플랜 찾기
      </button>
    );
  }

  if (step < PLAN_QUIZ.length) {
    const quiz = PLAN_QUIZ[step];
    return (
      <div className="mt-8 bg-white rounded-2xl border border-outline-variant/20 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-primary tracking-wider">
            STEP {step + 1} / {PLAN_QUIZ.length}
          </span>
          <button onClick={() => { setStep(-1); setAnswers([]); }} className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">
            다시 시작
          </button>
        </div>
        <div className="w-full h-1.5 bg-surface-container-high rounded-full mb-5">
          <div className="h-full bg-gradient-to-r from-[#004ac6] to-[#2563eb] rounded-full transition-all" style={{ width: `${((step + 1) / PLAN_QUIZ.length) * 100}%` }} />
        </div>
        <p className="text-base font-bold text-on-surface mb-5">{quiz.q}</p>
        <div className="grid gap-2.5">
          {quiz.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => pickAnswer(i)}
              className="w-full text-left px-4 py-3 rounded-xl border border-outline-variant/15 text-sm text-on-surface font-medium hover:bg-primary/[0.04] hover:border-primary/30 transition-all"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 결과
  const { plan, cycle, reason } = getRecommendation();
  const monthlyEq = getMonthlyEquivalent(plan, cycle);
  const allCycles: BillingCycle[] = ['monthly', '1year', '2year'];

  return (
    <div className="mt-8 bg-gradient-to-br from-primary/[0.06] to-[#2563eb]/[0.04] rounded-2xl border border-primary/15 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-primary tracking-wider">추천 결과</span>
        <button onClick={() => { setStep(-1); setAnswers([]); }} className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">
          다시 하기
        </button>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-extrabold text-primary">{plan.name}</span>
        {cycle !== 'monthly' && plan.pricing && (
          <span className="px-2.5 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-xs font-bold">
            {CYCLE_LABELS[cycle]} {getDiscount(plan, cycle)}% 할인
          </span>
        )}
      </div>
      <p className="text-sm text-on-surface-variant mb-4">{reason}</p>

      {/* 결제주기별 가격 비교표 */}
      {plan.pricing && plan.pricing.monthly > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {allCycles.map((c) => {
            const mE = getMonthlyEquivalent(plan, c);
            const d = getDiscount(plan, c);
            const months = c === 'monthly' ? 1 : c === '1year' ? 12 : c === '2year' ? 24 : 36;
            const total = mE * months;
            const isCurrent = c === cycle;
            return (
              <div
                key={c}
                className={`p-3 rounded-xl text-center transition-all ${
                  isCurrent
                    ? 'bg-white shadow-sm ring-1 ring-primary/20'
                    : 'bg-white/50'
                }`}
              >
                <p className={`text-[10px] font-bold mb-1 ${isCurrent ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {CYCLE_LABELS[c]}
                </p>
                <p className={`text-sm font-extrabold ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                  ₩{formatPrice(mE)}
                </p>
                <p className="text-[10px] text-on-surface-variant">/월</p>
                {d > 0 && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary text-[10px] font-bold">
                    -{d}%
                  </span>
                )}
                {c !== 'monthly' && (
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    총 ₩{formatPrice(total)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 선택된 주기 최종 가격 */}
      {plan.pricing && plan.pricing.monthly > 0 && cycle !== 'monthly' && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/60 mb-4 text-sm">
          <span className="text-on-surface-variant">
            <span className="line-through mr-1">₩{formatPrice(plan.pricing.monthly)}/월</span>
            → <strong className="text-primary">₩{formatPrice(monthlyEq)}/월</strong>
          </span>
          <span className="text-tertiary font-bold text-xs">
            ₩{formatPrice(plan.pricing.monthly * (cycle === '1year' ? 12 : cycle === '2year' ? 24 : 36) - getTotalPrice(plan, cycle))} 절약
          </span>
        </div>
      )}

      <Link
        href={plan.id === 'enterprise' ? 'mailto:contact@logissign.com' : `/portal/signup?plan=${plan.id}&billing=${cycle}`}
        className="h-11 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-semibold text-sm flex items-center justify-center hover:shadow-lg hover:shadow-blue-500/20 transition-all"
      >
        {plan.cta}
      </Link>
    </div>
  );
}

void PlanFinder;

/* ───────────────────────── Page ───────────────────────── */

export default function LandingPage() {
  const [_billingCycle, _setBillingCycle] = useState<BillingCycle>('monthly');
  const [_showTech, _setShowTech] = useState(false);

  return (
    <div className="min-h-screen">
      {/* ═══════════════════ NAV ═══════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="logiSSign" className="w-[120px] object-contain" />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">기능</a>
            <a href="#compare" className="hover:text-white transition-colors">비교</a>
            <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
            <a href="#verify" className="hover:text-white transition-colors">진위확인</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/login"
              className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:block"
            >
              로그인
            </Link>
            <Link
              href="/portal/signup"
              className="h-9 px-5 rounded-lg bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white text-sm font-semibold flex items-center hover:shadow-lg hover:shadow-blue-500/20 transition-all"
            >
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════ HERO (Dark) ═══════════════════ */}
      <section className="relative bg-[#0a0f1e] overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#004ac6]/20 rounded-full blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[#2563eb]/15 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#007d55]/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 md:pt-32 md:pb-36">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[13px] text-gray-400 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              택배·배송 대리점을 위한 올인원 SaaS
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-[56px] font-extrabold text-white leading-[1.1] tracking-tight mb-6">
              정산은 자동으로,
              <br />
              <span className="bg-gradient-to-r from-[#60a5fa] to-[#2563eb] bg-clip-text text-transparent">
                계약은 앱에서 서명
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
              엑셀만 올리면 자동 정산, 기사 앱에서 전자서명 —
              <br className="hidden md:block" />
              외부 서비스 비용 없이 정산·계약·교육을 하나로 통합합니다.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/portal/signup"
                className="h-13 px-8 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-bold text-base flex items-center gap-2 hover:shadow-xl hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5"
              >
                14일 무료 체험 시작
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
              <a
                href="#features"
                className="h-13 px-8 rounded-xl border border-white/10 text-gray-300 font-medium text-base flex items-center gap-2 hover:bg-white/5 hover:border-white/20 transition-all"
              >
                기능 살펴보기
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-6 mt-12 text-[13px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                카드 등록 불필요
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                3분 안에 가입 완료
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                10명까지 무료
              </span>
            </div>
          </div>
        </div>

        {/* Transition gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#f7f9fb]" />
      </section>

      {/* ═══════════════════ FEATURES (Light) ═══════════════════ */}
      <section id="features" className="bg-[#f7f9fb] py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-3">
              핵심 기능
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
              대리점 운영에 필요한 전부
            </h2>
            <p className="mt-4 text-on-surface-variant text-base max-w-xl mx-auto">
              엑셀 정산부터 전자계약, 기사 앱, 세금계산서까지 — 하나의 플랫폼에서 끝냅니다.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-7 shadow-sm hover:shadow-card transition-all duration-300 group border border-outline-variant/10"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/[0.08] text-primary flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-on-surface mb-2">{f.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ COMPARE (Light) ═══════════════════ */}
      <section id="compare" className="bg-white py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-3">
              왜 logiSSign인가
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
              범용 전자서명 vs 배송 특화 플랫폼
            </h2>
            <p className="mt-4 text-on-surface-variant text-base max-w-xl mx-auto">
              모두싸인 같은 범용 서비스는 전자서명만 제공합니다.
              logiSSign은 정산·계약·교육이 하나로 연결됩니다.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-3 bg-surface-container-low">
              <div className="p-4 text-sm font-semibold text-on-surface-variant">비교 항목</div>
              <div className="p-4 text-sm font-bold text-primary text-center border-x border-outline-variant/10 bg-primary/[0.04]">
                logiSSign
              </div>
              <div className="p-4 text-sm font-semibold text-on-surface-variant text-center">
                범용 전자서명
              </div>
            </div>
            {/* Rows */}
            {COMPARE.map((row, i) => (
              <div key={i} className="grid grid-cols-3 border-t border-outline-variant/10">
                <div className="p-4 text-sm text-on-surface font-medium">{row.feature}</div>
                <div className="p-4 text-sm text-primary font-semibold text-center border-x border-outline-variant/10 bg-primary/[0.02]">
                  {row.us}
                </div>
                <div className="p-4 text-sm text-on-surface-variant text-center">{row.them}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ PRICING (Light) ═══════════════════ */}
      <section id="pricing" className="bg-[#f7f9fb] py-24 md:py-32">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-3">요금제</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">기사 수에 맞게, 합리적으로</h2>
            <p className="mt-4 text-on-surface-variant text-base max-w-xl mx-auto">
              기사 {FREE_PLAN_FREE_DRIVERS}명까지 <strong className="text-on-surface">완전 무료</strong>.
              그 이상은 구독형(월정액) 또는 포인트형(쓴 만큼만) 선택.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {([
              { id: 'free' as PlanType },
              { id: 'basic' as PlanType },
              { id: 'standard' as PlanType, popular: true },
              { id: 'pro' as PlanType },
            ]).map(({ id, popular }) => {
              const price = PLAN_PRICES[id];
              return (
                <div key={id} className={`relative bg-white rounded-2xl p-6 flex flex-col border-2 transition-all duration-300 ${
                  popular ? 'border-primary shadow-ambient ring-1 ring-primary/20 scale-[1.02]' : 'border-outline-variant/15 shadow-sm hover:shadow-card'
                }`}>
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white text-[11px] font-bold tracking-wide whitespace-nowrap">추천</span>
                  )}
                  <h3 className="text-sm font-bold text-on-surface">{PLAN_LABELS[id]}</h3>
                  <p className="text-2xl font-extrabold text-on-surface mt-2 font-data">
                    {price === 0 ? '무료' : `₩${price.toLocaleString()}`}
                    {price > 0 && <span className="text-xs text-on-surface-variant font-normal">/월</span>}
                  </p>
                  <ul className="mt-4 space-y-1.5 flex-1">
                    {PLAN_HIGHLIGHTS[id].map(h => (
                      <li key={h} className="flex items-start gap-1.5 text-xs text-on-surface-variant">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary shrink-0 mt-0.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <Link href="/portal/signup"
                    className={`mt-5 h-10 rounded-xl text-sm font-semibold flex items-center justify-center transition-all ${
                      popular
                        ? 'bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white hover:shadow-lg hover:shadow-blue-500/20'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>                    {id === 'free' ? '무료 시작' : '시작하기'}
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              요금제 상세 비교 · 포인트 단가 →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FAQ (Light) ═══════════════════ */}
      <section id="faq" className="bg-white py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-3">
              FAQ
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
              자주 묻는 질문
            </h2>
          </div>
          <div>
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ VERIFY (Light) ═══════════════════ */}
      <section id="verify" className="bg-[#f7f9fb] py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#004ac6]/10 to-[#2563eb]/10 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004ac6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-3">
            계약서 진위확인
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight mb-3">
            계약서가 진짜인지 바로 확인하세요
          </h2>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-8 leading-relaxed">
            서명 완료된 계약서에 기재된 인증코드를 입력하면
            문서의 진위 여부와 위변조 여부를 즉시 확인할 수 있습니다.
          </p>
          <VerifyForm />
          <div className="flex items-center justify-center gap-6 mt-10 text-[12px] text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              로그인 불필요
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              SHA-256 해시 검증
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              QR코드로도 확인 가능
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FINAL CTA (Dark) ═══════════════════ */}
      <section className="relative bg-[#0a0f1e] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#004ac6]/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#2563eb]/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 py-24 md:py-32 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
            엑셀 정산에 지치셨다면
            <br />
            지금 바로 시작하세요
          </h2>
          <p className="text-gray-400 text-base mb-10 max-w-lg mx-auto">
            가입 3분, 무료로 10명까지 사용 가능.
            유료 플랜도 14일간 무료로 체험할 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/portal/signup"
              className="h-13 px-10 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-bold text-base flex items-center gap-2 hover:shadow-xl hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5"
            >
              무료로 시작하기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
            <Link
              href="/portal/login"
              className="h-13 px-10 rounded-xl border border-white/10 text-gray-300 font-medium text-base flex items-center hover:bg-white/5 transition-all"
            >
              기존 계정으로 로그인
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER (Dark) ═══════════════════ */}
      <footer className="bg-[#060a16] border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="logiSSign" className="h-7 object-contain" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
                택배·배송 대리점의 정산, 전자계약, 기사 관리를
                <br />하나의 플랫폼으로 통합합니다.
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-12 text-sm">
              <div>
                <h4 className="text-gray-400 font-semibold mb-3">서비스</h4>
                <ul className="space-y-2 text-gray-500">
                  <li><a href="#features" className="hover:text-gray-300 transition-colors">핵심 기능</a></li>
                  <li><a href="#pricing" className="hover:text-gray-300 transition-colors">요금제</a></li>
                  <li><a href="#faq" className="hover:text-gray-300 transition-colors">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-400 font-semibold mb-3">바로가기</h4>
                <ul className="space-y-2 text-gray-500">
                  <li><Link href="/portal/login" className="hover:text-gray-300 transition-colors">로그인</Link></li>
                  <li><Link href="/portal/signup" className="hover:text-gray-300 transition-colors">회원가입</Link></li>
                  <li><Link href="/admin/login" className="hover:text-gray-300 transition-colors">관리자</Link></li>
                  <li><a href="#verify" className="hover:text-gray-300 transition-colors">계약서 진위확인</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-400 font-semibold mb-3">지원</h4>
                <ul className="space-y-2 text-gray-500">
                  <li><a href="mailto:contact@logissign.com" className="hover:text-gray-300 transition-colors">이메일 문의</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 mt-10 pt-6">
            <div className="text-xs text-gray-500 space-y-1 mb-4 leading-relaxed">
              <p>상호: 라이트 | 대표자: 주상하 | 사업자등록번호: 819-16-01461</p>
              <p>주소: 경기도 시흥시 목감남서로5, 406호 | 전화: 010-5695-8838 | 이메일: jshmir77@naver.com</p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-600">© 2026 logiSSign. All rights reserved.</p>
              <div className="flex gap-6 text-xs text-gray-600">
                <Link href="/terms" className="hover:text-gray-400 transition-colors">이용약관</Link>
                <Link href="/privacy" className="hover:text-gray-400 transition-colors">개인정보처리방침</Link>
                <Link href="/refund" className="hover:text-gray-400 transition-colors">환불정책</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
