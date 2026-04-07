import Link from 'next/link';
import {
  PLAN_PRICES,
  PLAN_HIGHLIGHTS,
  PLAN_LABELS,
  POINT_COSTS,
  POINT_PACKAGES,
  EXTRA_DRIVER_MONTHLY_POINTS,
  FREE_PLAN_FREE_DRIVERS,
  WELCOME_BONUS_POINTS,
  type PlanType,
  type PointAction,
} from '@/lib/plan-limits';

export const metadata = {
  title: 'logiSSign 요금제 — 무료 시작 · 구독형 · 포인트형',
  description: '택배 대리점 정산·전자계약 자동화 플랫폼. 가입 즉시 5,000P 지급. 기사 5명까지 완전 무료.',
};

function fmt(n: number): string { return n.toLocaleString('ko-KR'); }
function fmtKRW(n: number): string { return `₩${fmt(n)}`; }

const PAID_ACTIONS = (Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][])
  .filter(([, info]) => info.cost > 0);
const FREE_ACTIONS = (Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][])
  .filter(([, info]) => info.cost === 0 && !info.desc.includes('개발중') && !info.desc.includes('구독형 전용'));

const EST_DRIVERS = 30;
const EST_EXTRA = EST_DRIVERS - FREE_PLAN_FREE_DRIVERS;
const EST_DRIVER_FEE = EST_EXTRA * EXTRA_DRIVER_MONTHLY_POINTS;
const EST = { contract_send: 6, settlement_sets: 6, excel_upload: 1 };
const estPointTotal = EST.contract_send * POINT_COSTS.contract_send.cost + EST.settlement_sets * POINT_COSTS.settlement_generate.cost + EST.excel_upload * POINT_COSTS.excel_upload.cost;
const estFreeTotal = EST_DRIVER_FEE + estPointTotal;

function Check() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary shrink-0 mt-0.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
}

const PLAN_LIST: { id: PlanType; popular?: boolean }[] = [
  { id: 'free' },
  { id: 'basic' },
  { id: 'standard', popular: true },
  { id: 'pro' },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">

      {/* ═══════════ NAV (다크 — about과 동일) ═══════════ */}
      <nav className="sticky top-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="logiSSign" className="w-[120px] object-contain" />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <Link href="/about" className="hover:text-white transition-colors">서비스 소개</Link>
            <Link href="/pricing" className="text-white font-semibold">요금제</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:block">로그인</Link>
            <Link href="/portal/signup" className="h-9 px-5 rounded-lg bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white text-sm font-semibold flex items-center hover:shadow-lg hover:shadow-blue-500/20 transition-all">
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════ HERO (다크) ═══════════ */}
      <section className="relative bg-[#0a0f1e] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#004ac6]/20 rounded-full blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[#2563eb]/15 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[13px] text-gray-400 mb-8">
            <span className="text-xl">🎁</span>
            첫 가입 시 {fmt(WELCOME_BONUS_POINTS)}P 무료 지급
          </div>
          <h1 className="text-4xl md:text-[56px] font-extrabold text-white leading-[1.1] tracking-tight mb-6">
            합리적인{' '}
            <span className="bg-gradient-to-r from-[#60a5fa] to-[#2563eb] bg-clip-text text-transparent">요금제</span>
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
            기사 {FREE_PLAN_FREE_DRIVERS}명까지 <strong className="text-white">완전 무료</strong>.
            그 이상은 <strong className="text-blue-400">구독형</strong>(월정액) 또는{' '}
            <strong className="text-emerald-400">포인트형</strong>(쓴 만큼만) 선택하세요.
          </p>
          <div className="flex items-center justify-center gap-6 text-[13px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              카드 등록 불필요
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              언제든 플랜 변경
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {FREE_PLAN_FREE_DRIVERS}명까지 무료
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#f7f9fb]" />
      </section>

      {/* ═══════════ 이하 밝은 배경 (#f7f9fb) ═══════════ */}

      {/* ── 플랜 5개 한 줄 ── */}
      <section id="plans" className="bg-[#f7f9fb] pt-16 pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-3">요금제</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">기사 수에 맞게, 합리적으로</h2>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {PLAN_LIST.map(({ id, popular }) => {
              const price = PLAN_PRICES[id];
              const planHref = id === 'enterprise' ? 'mailto:contact@logissign.com' : '/portal/signup';
              return (
                <div key={id} className={`relative bg-white rounded-2xl p-6 flex flex-col border-2 transition-all duration-300 ${
                  popular ? 'border-primary shadow-ambient ring-1 ring-primary/20 scale-[1.02]' : 'border-outline-variant/15 shadow-sm hover:shadow-card'
                }`}>
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white text-[11px] font-bold tracking-wide whitespace-nowrap">추천</span>
                  )}
                  <h3 className="text-sm font-bold text-on-surface">{PLAN_LABELS[id]}</h3>
                  <p className="text-2xl font-extrabold text-on-surface mt-2 font-data">
                    {price === 0 ? '무료' : fmtKRW(price)}
                    {price > 0 && id !== 'enterprise' && <span className="text-xs text-on-surface-variant font-normal">/월</span>}
                  </p>
                  <ul className="mt-4 space-y-1.5 flex-1">
                    {PLAN_HIGHLIGHTS[id].map(h => (
                      <li key={h} className="flex items-start gap-1.5 text-xs text-on-surface-variant"><Check />{h}</li>
                    ))}
                    {id !== 'free' && (
                      <li className="flex items-start gap-1.5 text-xs text-on-surface-variant"><Check />포인트 차감 없음</li>
                    )}
                  </ul>
                  <Link href={planHref}
                    className={`mt-5 h-10 rounded-xl text-sm font-semibold flex items-center justify-center transition-all ${
                      popular
                        ? 'bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white hover:shadow-lg hover:shadow-blue-500/20'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>
                    {id === 'free' ? '무료 시작' : id === 'enterprise' ? '문의하기' : '시작하기'}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-on-surface-variant/50 mt-5">연간 결제 시 20~40% 할인. Enterprise는 별도 문의.</p>
        </div>
      </section>

      {/* ── 무료 + 포인트형 설명 ── */}
      <section className="bg-[#f7f9fb] pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 무료 플랜 */}
            <div className="bg-white rounded-2xl border border-outline-variant/15 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">FREE</span>
                <span className="text-2xl font-extrabold text-on-surface font-data">₩0</span>
                <span className="text-sm text-on-surface-variant">/ 영구 무료</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-4">가입만 하면 바로 시작</h2>
              <div className="space-y-3 text-sm text-on-surface-variant leading-relaxed">
                <p><strong className="text-on-surface">1.</strong> 기사 {FREE_PLAN_FREE_DRIVERS}명까지 완전 무료 — 카드 등록 없이 즉시 시작</p>
                <p><strong className="text-on-surface">2.</strong> 가입 즉시 {fmt(WELCOME_BONUS_POINTS)}P 무료 지급 — 유료 기능 바로 체험</p>
                <p><strong className="text-on-surface">3.</strong> 포인트 소진 후에도 무료 기능 유지</p>
                <p><strong className="text-on-surface">4.</strong> 기사 초과 시 {fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/명/월</p>
              </div>
            </div>
            {/* 포인트형 */}
            <div className="bg-white rounded-2xl border border-outline-variant/15 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold">포인트형</span>
                <span className="text-sm text-on-surface-variant">사용한 만큼만</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-4">포인트 차감 항목</h2>
              <div className="space-y-2">
                {PAID_ACTIONS.map(([, info]) => (
                  <div key={info.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{info.label}</p>
                      <p className="text-[11px] text-on-surface-variant">{info.desc}</p>
                    </div>
                    <span className="text-sm font-bold text-primary font-data">{fmt(info.cost)}P</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-tertiary/5 border border-tertiary/15">
                <p className="text-xs font-bold text-tertiary mb-1">무료 항목</p>
                <div className="flex flex-wrap gap-1.5">
                  {FREE_ACTIONS.map(([, info]) => (
                    <span key={info.label} className="px-2 py-0.5 rounded-full bg-white text-[11px] text-on-surface border border-tertiary/20">{info.label}</span>
                  ))}
                  <span className="px-2 py-0.5 rounded-full bg-white text-[11px] text-on-surface border border-tertiary/20">알림톡</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-[11px] text-on-surface border border-tertiary/20">기사 앱</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 충전 패키지 ── */}
      <section className="bg-[#f7f9fb] pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold text-tertiary tracking-widest uppercase mb-3">포인트</span>
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">포인트 충전 패키지</h2>
            <p className="text-sm text-on-surface-variant mt-3">많이 충전할수록 보너스 포인트가 더 많아집니다.</p>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {POINT_PACKAGES.map(pkg => (
              <div key={pkg.points} className={`relative rounded-2xl border-2 p-6 text-center bg-white transition-all hover:shadow-md ${
                pkg.bonus > 0 ? 'border-tertiary/30' : 'border-outline-variant/15'
              }`}>
                {pkg.bonus > 0 && (
                  <span className="absolute -top-2.5 right-2 px-2.5 py-0.5 rounded-full bg-tertiary text-white text-[10px] font-bold">+{fmt(pkg.bonus)}P</span>
                )}
                <p className="text-lg font-extrabold text-on-surface font-data">{fmt(pkg.points)}P</p>
                <p className="text-sm font-bold text-primary mt-1 font-data">{fmtKRW(pkg.price)}</p>
                {pkg.bonus > 0 && (
                  <p className="text-[10px] text-tertiary mt-1">실수령 {fmt(pkg.points + pkg.bonus)}P</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 어디가 유리? ── */}
      <section className="bg-[#f7f9fb] pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">어떤 요금제가 유리할까요?</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="rounded-2xl border-2 border-outline-variant/15 bg-white p-7 relative shadow-sm">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-on-surface text-white text-xs font-bold">기사 5명 이하</span>
              <h3 className="text-lg font-bold text-on-surface mt-3">무료 플랜</h3>
              <p className="text-2xl font-extrabold text-on-surface mt-2 font-data">₩0</p>
              <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-start gap-1.5"><Check />{FREE_PLAN_FREE_DRIVERS}명 완전 무료</li>
                <li className="flex items-start gap-1.5"><Check />{fmt(WELCOME_BONUS_POINTS)}P 지급</li>
                <li className="flex items-start gap-1.5"><Check />포인트 소진 후 기본기능 유지</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-tertiary/30 bg-white p-7 relative shadow-sm">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-tertiary text-white text-xs font-bold">기사 6~50명</span>
              <h3 className="text-lg font-bold text-on-surface mt-3">포인트 충전형</h3>
              <p className="text-2xl font-extrabold text-tertiary mt-2 font-data">사용한 만큼</p>
              <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-start gap-1.5"><Check />계약서 {fmt(POINT_COSTS.contract_send.cost)}P/건</li>
                <li className="flex items-start gap-1.5"><Check />정산서 {fmt(POINT_COSTS.settlement_generate.cost)}P/5명</li>
                <li className="flex items-start gap-1.5"><Check />30명 기준 월 ~{fmt(estFreeTotal)}P</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-primary/30 bg-white p-7 relative shadow-lg">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">기사 50명 이상</span>
              <h3 className="text-lg font-bold text-on-surface mt-3">구독형</h3>
              <p className="text-2xl font-extrabold text-primary mt-2 font-data">{fmtKRW(49900)}~</p>
              <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-start gap-1.5"><Check />모든 기능 무제한</li>
                <li className="flex items-start gap-1.5"><Check />기사 추가 비용 없음</li>
                <li className="flex items-start gap-1.5"><Check />연간 결제 최대 40% 할인</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#f7f9fb] pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="bg-gradient-to-br from-primary/[0.06] to-[#2563eb]/[0.04] rounded-3xl p-12 border border-primary/15 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-tertiary/20 mb-4">
              <span className="text-xl">🎁</span>
              <span className="text-sm font-bold text-tertiary">첫 가입 {fmt(WELCOME_BONUS_POINTS)}P 무료</span>
            </div>
            <h2 className="text-3xl font-extrabold text-on-surface">지금 무료로 시작하세요</h2>
            <p className="text-sm text-on-surface-variant mt-3 max-w-md mx-auto">
              기사 {FREE_PLAN_FREE_DRIVERS}명까지 완전 무료. 카드 등록 없이 바로 시작.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link href="/portal/signup" className="h-12 px-8 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-semibold flex items-center hover:shadow-lg hover:shadow-blue-500/20 transition-all">
                무료 시작하기
              </Link>
              <Link href="/about" className="h-12 px-8 rounded-xl bg-white border border-outline-variant/20 text-on-surface-variant font-semibold flex items-center hover:bg-surface-container-low transition-all">
                서비스 소개
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER (다크 — about과 동일) ═══════════ */}
      <footer className="bg-[#0a0f1e] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs text-gray-500 space-y-1 mb-4 leading-relaxed">
            <p>상호: 라이트 | 대표자: 주상하 | 사업자등록번호: 819-16-01461</p>
            <p>주소: 경기도 시흥시 목감남서로5, 406호 | 전화: 010-5695-8838 | 이메일: jshmir77@naver.com</p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-xs text-gray-500">&copy; 2026 logiSSign. All rights reserved.</span>
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <Link href="/terms" className="hover:text-gray-300 transition-colors">이용약관</Link>
              <Link href="/privacy" className="hover:text-gray-300 transition-colors">개인정보처리방침</Link>
              <Link href="/refund" className="hover:text-gray-300 transition-colors">환불정책</Link>
              <Link href="/about" className="hover:text-gray-300 transition-colors">서비스 소개</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
