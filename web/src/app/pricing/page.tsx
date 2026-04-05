import Link from 'next/link';
import {
  PLAN_PRICES,
  PLAN_HIGHLIGHTS,
  PLAN_LABELS,
  POINT_COSTS,
  type PlanType,
  type PointAction,
} from '@/lib/plan-limits';

export const metadata = {
  title: 'logiSSign 요금제 — 구독형 vs 포인트형 vs 타사 비교',
  description: '택배 대리점 정산·전자계약 자동화 플랫폼 logiSSign의 합리적인 요금제를 확인하세요.',
};

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

const SUB_PLANS: PlanType[] = ['free', 'basic', 'standard', 'pro', 'enterprise'];

/** 기사 30명 기준 월 예상 사용량 */
const MONTHLY_USAGE = {
  contract_send: 6,
  settlement_generate: 30,
  settlement_pdf: 30,
  sms_send: 36,
  push_send: 30,
  driver_register: 2,
  excel_upload: 1,
  tax_invoice: 1,
  report_generate: 1,
  template_upload: 0,
} satisfies Record<PointAction, number>;

const pointMonthlyTotal = (Object.entries(MONTHLY_USAGE) as [PointAction, number][]).reduce(
  (sum, [action, count]) => sum + (POINT_COSTS[action]?.cost ?? 0) * count, 0
);

/** 타사 비교 (공개 정보 기준) */
const COMPETITORS = [
  {
    name: '모두싸인',
    type: '건당 과금',
    monthly: '~₩50,000+',
    contracts: '월 10건 (스타터)',
    settlement: '미제공',
    driverApp: '미제공',
    note: '전자계약 전문. 정산·기사앱 없음',
  },
  {
    name: '도큐사인',
    type: '구독형',
    monthly: '~₩40,000+',
    contracts: '월 5건 (Personal)',
    settlement: '미제공',
    driverApp: '미제공',
    note: '글로벌 전자서명. 한국 물류 특화 없음',
  },
  {
    name: '엑셀 수동관리',
    type: '인건비',
    monthly: '₩0 (SW)',
    contracts: '수동 작성',
    settlement: '���동 계산',
    driverApp: '없음',
    note: '오류 리스크, 담당자 퇴사 시 인수인계 어려움',
  },
];

/* ── Feature comparison rows ── */
const FEATURE_ROWS = [
  { label: '기사 수', free: '10명', point: '무제한', basic: '30명', standard: '80명', pro: '150명', enterprise: '무제한' },
  { label: '전자계약서', free: '-', point: '1,500P/건', basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '정산서 생성', free: '��본만', point: '800P/건', basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '정산서 빌더', free: '-', point: '포함', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '엑셀 업로드 정산', free: '-', point: '3,000P/회', basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: 'SMS 발송', free: '-', point: '300P/건', basic: '무제한', standard: '무제한', pro: '무제한', enterprise: '무제한' },
  { label: '세금계산서', free: '-', point: '1,500P/건', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '매출 리포트', free: '-', point: '800P/건', basic: '-', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '기사 전용 앱', free: '포함', point: '포함', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
  { label: '관리자 계정', free: '1��', point: '3명', basic: '3명', standard: '6명', pro: '11명', enterprise: '100명' },
  { label: 'PDF 계약서 필드배치', free: '-', point: '500P/건', basic: '포함', standard: '포함', pro: '포함', enterprise: '포함' },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="logiSSign" className="h-7 object-contain" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm text-on-surface-variant hover:text-on-surface font-korean">서비스 소개</Link>
            <Link href="/auth/login" className="h-9 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean flex items-center">
              로그인
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-16 space-y-20">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-headline font-bold text-on-surface font-korean">
            합리적인 요금제
          </h1>
          <p className="text-lg text-on-surface-variant font-korean max-w-2xl mx-auto">
            구독형은 월정액으로 모든 기능 무제한 사용.<br/>
            포인트형은 사용한 만큼만 결제. 소량 사용에 유리합니다.
          </p>
        </div>

        {/* ══════ Section 1: 구독형 플랜 ══════ */}
        <section>
          <div className="text-center mb-8">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-korean">구독형 (월정액)</span>
            <h2 className="text-2xl font-headline font-bold text-on-surface mt-3 font-korean">월 고정 비용, 무제한 사용</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {SUB_PLANS.map((id) => (
              <div key={id} className={`rounded-2xl border-2 p-6 transition-all ${
                id === 'standard' ? 'border-primary bg-primary/5 shadow-lg scale-[1.02]' : 'border-outline-variant/15'
              }`}>
                {id === 'standard' && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold mb-2">추천</span>
                )}
                <h3 className="text-sm font-bold text-on-surface font-korean">{PLAN_LABELS[id]}</h3>
                <p className="text-2xl font-data font-bold text-primary mt-2">
                  {PLAN_PRICES[id] === 0 ? '무료' : formatKRW(PLAN_PRICES[id])}
                  {PLAN_PRICES[id] > 0 && <span className="text-xs text-on-surface-variant font-normal">/월</span>}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {PLAN_HIGHLIGHTS[id].map((h) => (
                    <li key={h} className="flex items-start gap-1.5 text-xs text-on-surface-variant font-korean">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary shrink-0 mt-0.5">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant/50 text-center mt-4 font-korean">
            연간 결제 시 20~40% 할인. Enterprise 플랜은 별도 문의.
          </p>
        </section>

        {/* ══════ Section 2: 포인트 충전형 ══════ */}
        <section>
          <div className="text-center mb-8">
            <span className="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold font-korean">포인트 충전형</span>
            <h2 className="text-2xl font-headline font-bold text-on-surface mt-3 font-korean">사용한 만큼만 결제</h2>
            <p className="text-sm text-on-surface-variant mt-2 font-korean">월정액 없이 포인트를 충전하고, 기능 사용 시 차감됩니다.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 항목별 단가 */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
              <h3 className="text-sm font-bold text-on-surface font-korean mb-4">항목별 포인트 단가</h3>
              <div className="space-y-2">
                {(Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][]).map(([, info]) => (
                  <div key={info.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50">
                    <div>
                      <p className="text-sm font-semibold text-on-surface font-korean">{info.label}</p>
                      <p className="text-[11px] text-on-surface-variant font-korean">{info.desc}</p>
                    </div>
                    <span className={`text-sm font-data font-bold ${info.cost === 0 ? 'text-tertiary' : 'text-primary'}`}>
                      {info.cost === 0 ? '무료' : `${info.cost}P`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-on-surface-variant/50 mt-3 font-korean">1P = 1원. 충전 시 보너스 포인트 추가 지급.</p>
            </div>

            {/* 충전 패키지 + 예상 비용 */}
            <div className="space-y-6">
              <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
                <h3 className="text-sm font-bold text-on-surface font-korean mb-4">충전 패키지</h3>
                <div className="space-y-2">
                  {[
                    { name: '5,000P', price: 5000, bonus: 0 },
                    { name: '10,000P', price: 10000, bonus: 500 },
                    { name: '30,000P', price: 30000, bonus: 2000 },
                    { name: '50,000P', price: 50000, bonus: 5000 },
                    { name: '100,000P', price: 100000, bonus: 15000 },
                  ].map((pkg) => (
                    <div key={pkg.name} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-data font-bold text-on-surface">{pkg.name}</span>
                        {pkg.bonus > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-[10px] font-bold">
                            +{pkg.bonus.toLocaleString()}P 보너스
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-data text-primary">{formatKRW(pkg.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
                <h3 className="text-sm font-bold text-on-surface font-korean mb-3">기사 30명 월 예상 비용</h3>
                <div className="space-y-1 text-xs text-on-surface-variant font-korean">
                  <div className="flex justify-between"><span>계약서 전송 {MONTHLY_USAGE.contract_send}건</span><span className="font-data">{MONTHLY_USAGE.contract_send * POINT_COSTS.contract_send.cost}P</span></div>
                  <div className="flex justify-between"><span>정산서 생성 {MONTHLY_USAGE.settlement_generate}건</span><span className="font-data">{MONTHLY_USAGE.settlement_generate * POINT_COSTS.settlement_generate.cost}P</span></div>
                  <div className="flex justify-between"><span>정산서 PDF {MONTHLY_USAGE.settlement_pdf}건</span><span className="font-data">{MONTHLY_USAGE.settlement_pdf * POINT_COSTS.settlement_pdf.cost}P</span></div>
                  <div className="flex justify-between"><span>SMS {MONTHLY_USAGE.sms_send}건</span><span className="font-data">{MONTHLY_USAGE.sms_send * POINT_COSTS.sms_send.cost}P</span></div>
                  <div className="flex justify-between"><span>엑셀 업로드 {MONTHLY_USAGE.excel_upload}회</span><span className="font-data">{MONTHLY_USAGE.excel_upload * POINT_COSTS.excel_upload.cost}P</span></div>
                  <div className="flex justify-between border-t border-outline-variant/20 pt-2 mt-2 text-sm font-bold text-on-surface">
                    <span>합계</span>
                    <span className="font-data text-primary">{pointMonthlyTotal.toLocaleString()}P ({formatKRW(pointMonthlyTotal)})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ Section 3: 구독형 vs 포인트형 한눈에 비교 ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-on-surface font-korean">어떤 요금제가 유리할까요?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-primary/5 rounded-2xl border-2 border-primary/30 p-6 relative">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">기사 25명 이상이면 구독형!</span>
              <h3 className="text-lg font-bold text-on-surface font-korean mt-2">구독형</h3>
              <p className="text-3xl font-data font-bold text-primary mt-2">{formatKRW(49900)}<span className="text-sm font-normal text-on-surface-variant">/월</span></p>
              <ul className="mt-4 space-y-2 text-sm text-on-surface-variant font-korean">
                <li>+ 기능 무제한 사용, 추가 비용 없음</li>
                <li>+ 기사 수 늘어도 비용 동일</li>
                <li>+ 예산 예측 쉬움 (고정비)</li>
                <li className="text-on-surface-variant/50">- 소량 사용 시 비효율</li>
              </ul>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl border-2 border-outline-variant/20 p-6 relative">
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-tertiary text-white text-xs font-bold">기사 20명 이하면 포인트형!</span>
              <h3 className="text-lg font-bold text-on-surface font-korean mt-2">포인트 충전형</h3>
              <p className="text-3xl font-data font-bold text-on-surface mt-2">사용량에 따라<span className="text-sm font-normal text-on-surface-variant"> 변동</span></p>
              <ul className="mt-4 space-y-2 text-sm text-on-surface-variant font-korean">
                <li>+ 사용한 만큼만 결제</li>
                <li>+ 초기 비용 부담 없음</li>
                <li>+ 비정기 사용 시 유리</li>
                <li className="text-on-surface-variant/50">- 기사 많으면 구독보다 비쌈</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ══════ Section 4: 기능별 상세 비교표 ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-on-surface font-korean">기능별 상세 비교</h2>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low/60">
                    <th className="text-left p-4 font-korean font-semibold text-on-surface-variant">기능</th>
                    <th className="p-4 font-korean font-semibold text-on-surface-variant text-center">Free</th>
                    <th className="p-4 font-korean font-semibold text-tertiary text-center bg-tertiary/5">포인트형</th>
                    <th className="p-4 font-korean font-semibold text-on-surface-variant text-center">Basic</th>
                    <th className="p-4 font-korean font-semibold text-primary text-center bg-primary/5">Standard</th>
                    <th className="p-4 font-korean font-semibold text-on-surface-variant text-center">Pro</th>
                    <th className="p-4 font-korean font-semibold text-on-surface-variant text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {/* 가격 행 */}
                  <tr className="bg-surface-container-low/30">
                    <td className="p-4 font-korean font-bold text-on-surface">월 요금</td>
                    <td className="p-4 text-center font-data font-bold text-on-surface">무료</td>
                    <td className="p-4 text-center font-data font-bold text-tertiary bg-tertiary/5">충전식</td>
                    <td className="p-4 text-center font-data font-bold text-on-surface">{formatKRW(49900)}</td>
                    <td className="p-4 text-center font-data font-bold text-primary bg-primary/5">{formatKRW(99000)}</td>
                    <td className="p-4 text-center font-data font-bold text-on-surface">{formatKRW(149000)}</td>
                    <td className="p-4 text-center font-data font-bold text-on-surface">별도 문의</td>
                  </tr>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.label}>
                      <td className="p-4 font-korean text-on-surface">{row.label}</td>
                      <td className="p-4 text-center font-korean text-on-surface-variant">{row.free}</td>
                      <td className="p-4 text-center font-korean text-tertiary bg-tertiary/5">{row.point}</td>
                      <td className="p-4 text-center font-korean text-on-surface-variant">{row.basic}</td>
                      <td className="p-4 text-center font-korean text-primary bg-primary/5">{row.standard}</td>
                      <td className="p-4 text-center font-korean text-on-surface-variant">{row.pro}</td>
                      <td className="p-4 text-center font-korean text-on-surface-variant">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══════ Section 5: 타사 비교 ══════ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-headline font-bold text-on-surface font-korean">타 서비스 비교</h2>
            <p className="text-sm text-on-surface-variant mt-2 font-korean">logiSSign은 정산 + 전자계약 + 기사앱을 하나로 통합한 유일한 플랫폼입니다.</p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low/60">
                    <th className="text-left p-4 font-korean font-semibold text-on-surface-variant">항목</th>
                    <th className="p-4 font-korean font-semibold text-primary text-center bg-primary/5">logiSSign Basic</th>
                    {COMPETITORS.map((c) => (
                      <th key={c.name} className="p-4 font-korean font-semibold text-on-surface-variant text-center">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr>
                    <td className="p-4 font-korean text-on-surface">��금 방식</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold">월정액 (기사 30명)</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-on-surface-variant">{c.type}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-on-surface">월 비용</td>
                    <td className="p-4 text-center font-data font-bold text-primary bg-primary/5">{formatKRW(49900)}</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-data text-on-surface-variant">{c.monthly}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-on-surface">전자계약서</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold">무제한</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-on-surface-variant">{c.contracts}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-on-surface">정산 기능</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold">엑셀업로드 + 자동정산</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-on-surface-variant">{c.settlement}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-korean text-on-surface">기사 전용 앱</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 font-semibold">iOS + Android</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-on-surface-variant">{c.driverApp}</td>)}
                  </tr>
                  <tr className="bg-surface-container-low/30">
                    <td className="p-4 font-korean text-on-surface font-semibold">비고</td>
                    <td className="p-4 text-center font-korean text-primary bg-primary/5 text-xs">정산·계약·기사앱 올인원</td>
                    {COMPETITORS.map((c) => <td key={c.name} className="p-4 text-center font-korean text-on-surface-variant/60 text-xs">{c.note}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center pb-8">
          <div className="bg-primary/5 rounded-3xl p-12 border border-primary/20">
            <h2 className="text-2xl font-headline font-bold text-on-surface font-korean">지금 무료로 시작하세요</h2>
            <p className="text-sm text-on-surface-variant mt-2 font-korean">기사 10명까지 무료. 신용카드 등록 없이 바로 시작.</p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link href="/auth/signup" className="h-12 px-8 rounded-xl bg-primary text-white font-semibold font-korean flex items-center">
                무료 시작하기
              </Link>
              <Link href="/" className="h-12 px-8 rounded-xl bg-surface-container-low text-on-surface-variant font-semibold font-korean flex items-center hover:bg-surface-container-high transition-colors">
                서비스 소개
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/10 py-8 text-center">
        <p className="text-xs text-on-surface-variant font-korean">
          &copy; 2026 logiSSign(로지사인). All rights reserved.
        </p>
      </footer>
    </div>
  );
}
