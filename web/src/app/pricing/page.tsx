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

/* ── 유료 / 무료 포인트 항목 분리 ── */
const PAID_ACTIONS = (Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][])
  .filter(([, info]) => info.cost > 0);
const FREE_ACTIONS = (Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][])
  .filter(([, info]) => info.cost === 0 && !info.desc.includes('개발중') && !info.desc.includes('구독형 전용'));

/* ── 기사 30명 기준 월 예상 (정산서: 5명 1세트) ── */
const EST_DRIVERS = 30;
const EST_EXTRA_DRIVERS = EST_DRIVERS - FREE_PLAN_FREE_DRIVERS; // 25명 초과
const EST_DRIVER_FEE = EST_EXTRA_DRIVERS * EXTRA_DRIVER_MONTHLY_POINTS; // 37,500P
const EST = { contract_send: 6, settlement_sets: 6, excel_upload: 1 }; // 30명 ÷ 5명 = 6세트
const estPointTotal = EST.contract_send * POINT_COSTS.contract_send.cost
  + EST.settlement_sets * POINT_COSTS.settlement_generate.cost
  + EST.excel_upload * POINT_COSTS.excel_upload.cost;
const estFreeTotal = EST_DRIVER_FEE + estPointTotal; // 무료플랜 총비용 (기사비 + 포인트)

/* ── 타사 비교 (직접 사명 사용 금지) ── */
const COMPETITORS = [
  { name: 'A사', type: '구독+건당', perDoc: '1,330~1,900원/건', settlement: '미제공', app: '미제공', note: '전자계약 전문 서비스' },
  { name: 'B사', type: '구독+충전형', perDoc: '600원/건', settlement: '미제공', app: '미제공', note: '전자문서 관리 서비스' },
  { name: 'C사', type: '건당 충전', perDoc: '500원/건', settlement: '미제공', app: '미제공', note: '전자서명 서비스' },
  { name: 'D사', type: '구독형', perDoc: '플랜 내 포함', settlement: '미제공', app: '미제공', note: '글로벌 전자서명 서비스' },
  { name: '엑셀 수동', type: '인건비', perDoc: '-', settlement: '수동 계산', app: '없음', note: '오류 리스크, 인수인계 어려움' },
  { name: '사내 그룹웨어', type: '월 구독', perDoc: '-', settlement: '별도 구축', app: '웹 전용', note: '급여명세·공지 전용, 계약·정산 미제공' },
];

/* ── 기능별 상세 비교 ── */
const FEATURE_ROWS = [
  { label: '기사 수', free: `${FREE_PLAN_FREE_DRIVERS}명 무료`, point: `${FREE_PLAN_FREE_DRIVERS}명 무료`, basic: '30명', standard: '80명', pro: '150명', enterprise: '무제한' },
  { label: '초과 기사 비용', free: `${fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/명/월`, point: `${fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/명/월`, basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '전자계약서', free: '포인트 차감', point: `${fmt(POINT_COSTS.contract_send.cost)}P/건`, basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '정산서 생성', free: '포인트 차감', point: `${fmt(POINT_COSTS.settlement_generate.cost)}P/5명`, basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '정산서 전송', free: '무료', point: '무료', basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '정산서 PDF', free: '무료', point: '무료', basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '정산서 빌더', free: '-', point: '포함', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '엑셀 업로드 정산', free: '포인트 차감', point: `${fmt(POINT_COSTS.excel_upload.cost)}P/회`, basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '알림톡 발송', free: '포함', point: '포함', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '세금계산서', free: '-', point: '개발중', basic: '개발중', standard: '개발중', pro: '개발중', enterprise: '개발중' },
  { label: '매출 리포트', free: '-', point: '-', basic: '-', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '기사 전용 앱', free: '포함', point: '포함', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '관리자 계정', free: '1명', point: '3명', basic: '3명', standard: '6명', pro: '11명', enterprise: '100명' },
  { label: 'PDF 필드배치', free: '-', point: '무료', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '가입 보너스', free: `${fmt(WELCOME_BONUS_POINTS)}P`, point: `${fmt(WELCOME_BONUS_POINTS)}P`, basic: '-', standard: '-', pro: '-', enterprise: '-' },
];

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary shrink-0 mt-0.5">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Nav — about 페이지와 동일 */}
      <nav className="sticky top-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
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

      <main className="max-w-6xl mx-auto px-6 py-16 space-y-24">

        {/* ══════ Hero ══════ */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tertiary/10 border border-tertiary/20">
            <span className="text-xl">🎁</span>
            <span className="text-sm font-bold text-tertiary font-korean">
              첫 가입 시 {fmt(WELCOME_BONUS_POINTS)}P 무료 지급!
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-white font-korean">
            합리적인 요금제
          </h1>
          <p className="text-lg text-gray-400 font-korean max-w-2xl mx-auto leading-relaxed">
            기사 {FREE_PLAN_FREE_DRIVERS}명까지 <strong className="text-white">완전 무료</strong>.<br/>
            그 이상은 <strong className="text-primary">구독형</strong>(월정액 무제한) 또는{' '}
            <strong className="text-tertiary">포인트형</strong>(쓴 만큼만) 선택하세요.
          </p>
        </div>

        {/* ══════ Section 0: 무료 플랜 상세 설명 ══════ */}
        <section>
          <div className="bg-gradient-to-br from-primary/5 via-tertiary/5 to-primary/5 rounded-3xl border border-primary/15 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* 왼쪽: 무료플랜 설명 */}
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-korean">FREE</span>
                  <span className="text-2xl font-data font-bold text-primary">₩0</span>
                  <span className="text-sm text-gray-400 font-korean">/ 영구 무료</span>
                </div>
                <h2 className="text-2xl font-headline font-bold text-white font-korean">
                  가입만 하면 바로 시작
                </h2>

                <div className="space-y-3 text-sm text-gray-400 font-korean leading-relaxed">
                  <p>
                    <strong className="text-white">1. 기사 {FREE_PLAN_FREE_DRIVERS}명까지 완전 무료</strong><br/>
                    신용카드 등록 없이, 가입 즉시 기사 {FREE_PLAN_FREE_DRIVERS}명을 등록하고 관리할 수 있습니다.
                    기사 전용 앱, 기본 정산, 공지사항, 알림톡 발송 모두 포함됩니다.
                  </p>
                  <p>
                    <strong className="text-white">2. 가입 즉시 {fmt(WELCOME_BONUS_POINTS)}P 무료 지급</strong><br/>
                    포인트로 전자계약서 전송({fmt(POINT_COSTS.contract_send.cost)}P/건),
                    정산서 생성({fmt(POINT_COSTS.settlement_generate.cost)}P/5명 1세트, 전송 무료),
                    엑셀 업로드 정산({fmt(POINT_COSTS.excel_upload.cost)}P/회) 등 유료 기능을 바로 체험할 수 있습니다.
                    <strong className="text-error/70">※ 해당 기능은 포인트가 차감됩니다.</strong>
                  </p>
                  <p>
                    <strong className="text-white">3. 포인트 소진 후에도 무료 기능 유지</strong><br/>
                    포인트가 모두 소진되어도 기사 관리, 기본 정산, 공지사항 등 무료 기능은 계속 사용 가능합니다.
                    추가 유료 기능이 필요하면 포인트를 충전하거나 구독형으로 전환하세요.
                  </p>
                  <p>
                    <strong className="text-white">4. 기사 {FREE_PLAN_FREE_DRIVERS}명 초과 시</strong><br/>
                    추가 기사 1명당 월 <strong className="text-primary">{fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P</strong>만 내면 됩니다.
                    구독형 플랜으로 업그레이드하면 기사 추가 비용이 없습니다.
                  </p>
                </div>

                <Link href="/portal/signup"
                  className="inline-flex h-11 px-6 rounded-xl bg-primary text-white text-sm font-semibold font-korean items-center hover:bg-primary/90 transition-colors">
                  무료로 시작하기
                </Link>
              </div>

              {/* 오른쪽: 포인트 작동 방식 */}
              <div className="space-y-4">
                <div className="bg-white/5 rounded-2xl p-6 ">
                  <h3 className="text-sm font-bold text-white font-korean mb-4">포인트는 이렇게 작동합니다</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold shrink-0">1</span>
                      <div>
                        <p className="text-sm font-semibold text-white font-korean">가입 시 {fmt(WELCOME_BONUS_POINTS)}P 자동 지급</p>
                        <p className="text-xs text-gray-400 font-korean">별도 신청 없이 즉시 사용 가능</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                      <div>
                        <p className="text-sm font-semibold text-white font-korean">유료 기능 사용 시 포인트 차감</p>
                        <p className="text-xs text-gray-400 font-korean">
                          계약서 전송 {fmt(POINT_COSTS.contract_send.cost)}P/건 · 정산서 생성 {fmt(POINT_COSTS.settlement_generate.cost)}P/5명 · 엑셀 업로드 {fmt(POINT_COSTS.excel_upload.cost)}P
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold shrink-0">3</span>
                      <div>
                        <p className="text-sm font-semibold text-white font-korean">포인트 소진 시</p>
                        <p className="text-xs text-gray-400 font-korean">
                          포인트 추가 충전 또는 구독형으로 전환하여 무제한 사용
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 ">
                  <h3 className="text-sm font-bold text-white font-korean mb-3">
                    {fmt(WELCOME_BONUS_POINTS)}P로 할 수 있는 것
                  </h3>
                  <div className="space-y-2 text-xs text-gray-400 font-korean">
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.03]">
                      <span>계약서 전송</span>
                      <span className="font-data font-semibold text-white">{Math.floor(WELCOME_BONUS_POINTS / POINT_COSTS.contract_send.cost)}건</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.03]">
                      <span>정산서 생성 (5명 1세트)</span>
                      <span className="font-data font-semibold text-white">{Math.floor(WELCOME_BONUS_POINTS / POINT_COSTS.settlement_generate.cost)}세트</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.03]">
                      <span>엑셀 업로드 정산</span>
                      <span className="font-data font-semibold text-white">{Math.floor(WELCOME_BONUS_POINTS / POINT_COSTS.excel_upload.cost)}회</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400/50 mt-2 font-korean">
                    정산서 PDF · 기사 등록 · 템플릿 업로드 · 알림톡은 무료이므로 포인트 차감 없음
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ Section 1: 구독형 + 포인트형 ══════ */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-headline font-bold text-white font-korean">더 많은 기능이 필요하다면?</h2>
            <p className="text-sm text-gray-400 mt-3 font-korean">구독형 또는 포인트 충전형 중 선택하세요. 언제든 변경 가능합니다.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 구독형 */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold font-korean">구독형 (월정액)</span>
              </div>
              <p className="text-sm text-gray-400 font-korean">
                월 고정 비용으로 계약서·정산서·엑셀 업로드 등 <strong className="text-white">모든 유료 기능을 무제한</strong> 사용.
                기사 추가 비용 없음. 포인트 차감 없음. 기사 50명 이상이면 구독형이 유리합니다.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['basic', 'standard', 'pro', 'enterprise'] as PlanType[]).map((id) => (
                  <div key={id} className={`rounded-2xl border-2 p-5 transition-all ${
                    id === 'standard' ? 'border-primary bg-primary/5 shadow-lg' : 'border-white/10'
                  }`}>
                    {id === 'standard' && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold mb-2">추천</span>
                    )}
                    <h3 className="text-sm font-bold text-white font-korean">{PLAN_LABELS[id]}</h3>
                    <p className="text-xl font-data font-bold text-primary mt-1">
                      {id === 'enterprise' ? '별도 문의' : fmtKRW(PLAN_PRICES[id])}
                      {id !== 'enterprise' && <span className="text-xs text-gray-400 font-normal">/월</span>}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {PLAN_HIGHLIGHTS[id].map((h) => (
                        <li key={h} className="flex items-start gap-1.5 text-xs text-gray-400 font-korean"><Check />{h}</li>
                      ))}
                      <li className="flex items-start gap-1.5 text-xs text-gray-400 font-korean"><Check />포인트 차감 없음 (무제한)</li>
                      <li className="flex items-start gap-1.5 text-xs text-gray-400 font-korean"><Check />기사 추가 비용 없음</li>
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400/50 font-korean">연간 결제 시 20~40% 할인. Enterprise는 별도 문의.</p>
            </div>

            {/* 포인트형 */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-full bg-tertiary/10 text-tertiary text-sm font-bold font-korean">포인트 충전형</span>
              </div>
              <p className="text-sm text-gray-400 font-korean">
                월정액 없이 <strong className="text-white">사용할 때만 포인트가 차감</strong>됩니다.
                기사 {FREE_PLAN_FREE_DRIVERS}명까지 무료, 초과 시 기사당 <strong className="text-white">{fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/월</strong>.
                포인트가 부족하면 충전하고, 소진되어도 무료 기능은 유지됩니다.
              </p>

              {/* 유료 항목 */}
              <div className="bg-white/5 rounded-2xl  p-5">
                <h4 className="text-sm font-bold text-white font-korean mb-3">포인트 차감 항목 (유료)</h4>
                <div className="space-y-2">
                  {PAID_ACTIONS.map(([, info]) => (
                    <div key={info.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03]">
                      <div>
                        <p className="text-sm font-semibold text-white font-korean">{info.label}</p>
                        <p className="text-[11px] text-gray-400 font-korean">{info.desc}</p>
                      </div>
                      <span className="text-sm font-data font-bold text-primary">{fmt(info.cost)}P</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 무료 항목 */}
              <div className="bg-tertiary/5 rounded-2xl p-5 border border-tertiary/15">
                <h4 className="text-sm font-bold text-tertiary font-korean mb-2">포인트 차감 없이 무료</h4>
                <div className="flex flex-wrap gap-2">
                  {FREE_ACTIONS.map(([, info]) => (
                    <span key={info.label} className="px-3 py-1 rounded-full bg-white border border-tertiary/20 text-xs text-white font-korean">
                      {info.label}
                    </span>
                  ))}
                  <span className="px-3 py-1 rounded-full bg-white border border-tertiary/20 text-xs text-white font-korean">알림톡 발송</span>
                  <span className="px-3 py-1 rounded-full bg-white border border-tertiary/20 text-xs text-white font-korean">기사 전용 앱</span>
                </div>
              </div>

              {/* 월 예상 비용 — 기사 30명 기준 */}
              <div className="bg-white/5 rounded-2xl  p-5">
                <h4 className="text-sm font-bold text-white font-korean mb-1">기사 {EST_DRIVERS}명 월 예상 비용</h4>
                <p className="text-[11px] text-gray-400 font-korean mb-3">
                  기사 {FREE_PLAN_FREE_DRIVERS}명 무료, 초과 {EST_EXTRA_DRIVERS}명 × {fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/월 포함
                </p>
                <div className="space-y-1.5 text-xs font-korean">
                  <div className="flex justify-between text-error/80 font-semibold">
                    <span>초과 기사 {EST_EXTRA_DRIVERS}명 × {fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P</span>
                    <span className="font-data">{fmt(EST_DRIVER_FEE) + "P"}/월</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>계약서 전송 {EST.contract_send}건</span>
                    <span className="font-data">{fmt(EST.contract_send * POINT_COSTS.contract_send.cost)}P</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>정산서 생성 {EST.settlement_sets}세트 ({EST_DRIVERS}명÷5명)</span>
                    <span className="font-data">{fmt(EST.settlement_sets * POINT_COSTS.settlement_generate.cost)}P</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>엑셀 업로드 {EST.excel_upload}회</span>
                    <span className="font-data">{fmt(EST.excel_upload * POINT_COSTS.excel_upload.cost)}P</span>
                  </div>
                  <div className="flex justify-between text-tertiary">
                    <span>정산전송 · PDF · 기사등록 · 알림톡</span>
                    <span className="font-data font-semibold">무료</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-2 text-sm font-bold text-white">
                    <span>월 총비용</span>
                    <span className="font-data text-primary">{fmt(estFreeTotal)}P</span>
                  </div>
                  <div className="text-[10px] text-gray-400/60 mt-1">
                    (기사비 {fmt(EST_DRIVER_FEE) + "P"} + 포인트 {fmt(estPointTotal)}P)
                  </div>
                </div>
              </div>

              {/* 포인트형 vs 구독형 비교 */}
              <div className="bg-primary/5 rounded-2xl border border-primary/15 p-5">
                <h4 className="text-sm font-bold text-white font-korean mb-3">기사 {EST_DRIVERS}명 — 어디가 유리?</h4>
                <div className="space-y-2 text-xs font-korean">
                  <div className="flex justify-between p-2 rounded-lg bg-white/60">
                    <span className="text-gray-400">포인트형 (기사비 + 포인트)</span>
                    <span className="font-data font-bold text-tertiary">{fmt(estFreeTotal)}P/월</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-white/60">
                    <span className="text-gray-400">구독 Basic (기사 30명·무제한)</span>
                    <span className="font-data font-bold text-primary">{fmtKRW(49900)}/월</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400/60 mt-2 font-korean">
                  무료·포인트형 모두 기사 {FREE_PLAN_FREE_DRIVERS}명 초과 시 {fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/명/월 포인트 차감. 포인트 소진 시 충전 또는 플랜 변경 알림.
                  구독형은 플랜 내 기사 수까지 추가 비용 없음.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ Section 2: 충전 패키지 ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-white font-korean">포인트 충전 패키지</h2>
            <p className="text-sm text-gray-400 mt-2 font-korean">많이 충전할수록 보너스 포인트가 더 많아집니다.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {POINT_PACKAGES.map((pkg) => (
              <div key={pkg.points} className={`relative rounded-2xl border-2 p-5 text-center transition-all hover:shadow-md ${
                pkg.bonus > 0 ? 'border-tertiary/30 bg-tertiary/[0.03]' : 'border-white/10'
              }`}>
                {pkg.bonus > 0 && (
                  <span className="absolute -top-2.5 right-2 px-2.5 py-0.5 rounded-full bg-tertiary text-white text-[10px] font-bold">+{fmt(pkg.bonus)}P</span>
                )}
                <p className="text-lg font-data font-bold text-white">{fmt(pkg.points)}P</p>
                <p className="text-sm font-data text-primary mt-1">{fmtKRW(pkg.price)}</p>
                {pkg.bonus > 0 && (
                  <p className="text-[10px] text-tertiary font-korean mt-1">실수령 {fmt(pkg.points + pkg.bonus)}P</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ══════ Section 3: 어떤 요금제? ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-white font-korean">어떤 요금제가 유리할까요?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-2xl border-2 border-white/10 p-6 relative">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-on-surface text-surface text-xs font-bold">기사 5명 이하</span>
              <h3 className="text-lg font-bold text-white font-korean mt-3">무료 플랜</h3>
              <p className="text-2xl font-data font-bold text-white mt-2">₩0</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-400 font-korean">
                <li className="flex items-start gap-1.5"><Check />기사 {FREE_PLAN_FREE_DRIVERS}명 완전 무료</li>
                <li className="flex items-start gap-1.5"><Check />{fmt(WELCOME_BONUS_POINTS)}P 지급 (유료기능 체험용)</li>
                <li className="flex items-start gap-1.5 text-xs text-gray-400/70">
                  ※ 계약서 전송·정산서 생성·엑셀 업로드는 포인트 차감
                </li>
                <li className="flex items-start gap-1.5"><Check />포인트 소진 후에도 기본기능 유지</li>
                <li className="flex items-start gap-1.5"><Check />초과 시 기사당 {fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/월</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-tertiary/30 bg-tertiary/[0.02] p-6 relative">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-tertiary text-white text-xs font-bold">기사 6~50명</span>
              <h3 className="text-lg font-bold text-white font-korean mt-3">포인트 충전형</h3>
              <p className="text-2xl font-data font-bold text-tertiary mt-2">사용한 만큼</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-400 font-korean">
                <li className="flex items-start gap-1.5"><Check />기사 {FREE_PLAN_FREE_DRIVERS}명 무료, 초과 시 {fmt(EXTRA_DRIVER_MONTHLY_POINTS)}P/명/월</li>
                <li className="flex items-start gap-1.5"><Check />계약서 전송 {fmt(POINT_COSTS.contract_send.cost)}P/건</li>
                <li className="flex items-start gap-1.5"><Check />정산서 생성 {fmt(POINT_COSTS.settlement_generate.cost)}P/5명 (전송 무료)</li>
                <li className="flex items-start gap-1.5"><Check />엑셀 업로드 정산 {fmt(POINT_COSTS.excel_upload.cost)}P/회</li>
                <li className="flex items-start gap-1.5"><Check />PDF·알림톡·기사등록·정산전송 무료</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 relative shadow-lg">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">기사 50명 이상</span>
              <h3 className="text-lg font-bold text-white font-korean mt-3">구독형</h3>
              <p className="text-2xl font-data font-bold text-primary mt-2">{fmtKRW(49900)}~</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-400 font-korean">
                <li className="flex items-start gap-1.5"><Check />모든 기능 무제한 (포인트 차감 없음)</li>
                <li className="flex items-start gap-1.5"><Check />기사 추가 비용 없음</li>
                <li className="flex items-start gap-1.5"><Check />���용 예측 쉬움 (고정비)</li>
                <li className="flex items-start gap-1.5"><Check />연간 결제 시 최대 40% 할인</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ══════ Section 4: 기능별 상세 비교표 ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-white font-korean">기능별 상세 비교</h2>
          </div>
          <div className="bg-white/5 rounded-2xl  overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.05]/60">
                    <th className="text-left p-4 font-korean font-semibold text-gray-400">기능</th>
                    <th className="p-4 font-korean font-semibold text-gray-400 text-center">Free</th>
                    <th className="p-4 font-korean font-semibold text-tertiary text-center bg-tertiary/5">포인트형</th>
                    <th className="p-4 font-korean font-semibold text-gray-400 text-center">Basic</th>
                    <th className="p-4 font-korean font-semibold text-primary text-center bg-primary/5">Standard</th>
                    <th className="p-4 font-korean font-semibold text-gray-400 text-center">Pro</th>
                    <th className="p-4 font-korean font-semibold text-gray-400 text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr className="bg-white/[0.05]/30">
                    <td className="p-4 font-korean font-bold text-white">월 요금</td>
                    <td className="p-4 text-center font-data font-bold text-white">무료</td>
                    <td className="p-4 text-center font-data font-bold text-tertiary bg-tertiary/5">충전식</td>
                    <td className="p-4 text-center font-data font-bold text-white">{fmtKRW(49900)}</td>
                    <td className="p-4 text-center font-data font-bold text-primary bg-primary/5">{fmtKRW(99000)}</td>
                    <td className="p-4 text-center font-data font-bold text-white">{fmtKRW(149000)}</td>
                    <td className="p-4 text-center font-data font-bold text-white">별도 문의</td>
                  </tr>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.label}>
                      <td className="p-4 font-korean text-white">{row.label}</td>
                      <td className="p-4 text-center font-korean text-gray-400 text-xs">{row.free}</td>
                      <td className="p-4 text-center font-korean text-tertiary bg-tertiary/5 text-xs">{row.point}</td>
                      <td className="p-4 text-center font-korean text-gray-400 text-xs">{row.basic}</td>
                      <td className="p-4 text-center font-korean text-primary bg-primary/5 text-xs">{row.standard}</td>
                      <td className="p-4 text-center font-korean text-gray-400 text-xs">{row.pro}</td>
                      <td className="p-4 text-center font-korean text-gray-400 text-xs">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══════ Section 5: 타사 비교 (사명 비노출) ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-white font-korean">타 서비스 비교</h2>
            <p className="text-sm text-gray-400 mt-2 font-korean">
              logiSSign은 <strong>정산 + 전자계약 + 기사앱</strong>을 하나로 통합한 유일한 플랫폼입니다.
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl  overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.05]/60">
                    <th className="text-left p-4 font-korean font-semibold text-gray-400">항목</th>
                    <th className="p-4 font-korean font-semibold text-primary text-center bg-primary/5">logiSSign</th>
                    {COMPETITORS.map((c) => (
                      <th key={c.name} className="p-4 font-korean font-semibold text-gray-400 text-center">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr>
                    <td className="p-4 font-korean text-white">요금 방식</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold text-xs">무료 + 구독 + 포인트</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-gray-400 text-xs">{c.type}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-white">계약서 건당</td>
                    <td className="p-4 text-center font-data font-bold text-primary bg-primary/5">{fmt(POINT_COSTS.contract_send.cost)}원</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-data text-gray-400 text-xs">{c.perDoc}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-white">정산 기능</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold text-xs">자동정산 + 빌더 + 엑셀</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-gray-400 text-xs">{c.settlement}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-white">기사 전용 앱</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold text-xs">iOS + Android</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-gray-400 text-xs">{c.app}</td>)}
                  </tr>
                  <tr className="bg-white/[0.05]/30">
                    <td className="p-4 font-korean text-white font-semibold">비고</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 text-xs font-semibold">정산·계약·기사앱 올인원</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-gray-400/60 text-xs">{c.note}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══════ CTA ══════ */}
        <section className="text-center pb-8">
          <div className="bg-gradient-to-br from-primary/10 to-tertiary/10 rounded-3xl p-12 border border-primary/15">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-tertiary/20 mb-4">
              <span className="text-xl">🎁</span>
              <span className="text-sm font-bold text-tertiary font-korean">첫 가입 {fmt(WELCOME_BONUS_POINTS)}P 무료</span>
            </div>
            <h2 className="text-3xl font-headline font-bold text-white font-korean">지금 무료로 시작하세요</h2>
            <p className="text-sm text-gray-400 mt-3 font-korean max-w-md mx-auto">
              기사 {FREE_PLAN_FREE_DRIVERS}명까지 완전 무료. 카드 등록 없이 바로 시작.<br/>
              {fmt(WELCOME_BONUS_POINTS)}P 지급으로 유료 기능도 바로 체험하세요.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link href="/portal/signup" className="h-12 px-8 rounded-xl bg-primary text-white font-semibold font-korean flex items-center hover:bg-primary/90 transition-colors">
                무료 시작하기
              </Link>
              <Link href="/about" className="h-12 px-8 rounded-xl bg-white/60 border border-white/10 text-gray-400 font-semibold font-korean flex items-center hover:bg-white transition-colors">
                서비스 소개
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-xs text-gray-500">&copy; 2026 logiSSign(로지사인). All rights reserved.</p>
      </footer>
    </div>
  );
}
