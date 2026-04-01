const planDetails = [
  { plan: 'Enterprise', subscribers: 12, mrr: 2388000, share: 28.8, arpu: 199000 },
  { plan: 'Standard', subscribers: 23, mrr: 2277000, share: 27.5, arpu: 99000 },
  { plan: 'Basic', subscribers: 35, mrr: 1746500, share: 21.1, arpu: 49900 },
  { plan: 'Free', subscribers: 42, mrr: 0, share: 0, arpu: 0 },
];

const kpis = [
  { label: 'MRR', value: '₩24,500,000', change: '+8.2%', isUp: true, icon: 'trending_up' },
  { label: 'ARR', value: '₩294,000,000', change: '+12.5%', isUp: true, icon: 'monitoring' },
  { label: '신규 구독', value: '5건', change: '+2', isUp: true, icon: 'group_add' },
  { label: '이탈률', value: '2.1%', change: '-0.3%', isUp: false, icon: 'person_off' },
];

export default function RevenuePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
            매출 분석
          </h2>
          <p className="font-body text-on-surface-variant text-[14px] mt-1">
            구독 매출 및 성장 지표
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['1개월', '3개월', '6개월', '1년'].map((period) => (
            <button
              key={period}
              className={`h-9 px-4 rounded-xl font-label text-[13px] font-medium transition-colors ${
                period === '3개월'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[22px] text-primary"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
              >
                {kpi.icon}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-label text-on-surface-variant text-[12px]">{kpi.label}</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-data text-on-surface text-[20px] font-bold tracking-tight">
                  {kpi.value}
                </span>
                <span
                  className={`font-data text-[12px] font-semibold ${
                    kpi.isUp ? 'text-tertiary' : 'text-error'
                  }`}
                >
                  {kpi.change}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Row */}
      <div className="grid grid-cols-3 gap-5">
        {/* MRR Trend - large */}
        <div className="lg:col-span-2 col-span-3 bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[360px]">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            MRR 추이
          </h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            월간 반복 매출 변화 추이
          </p>
          <div className="flex items-center justify-center h-[240px] rounded-xl bg-surface-container-low">
            <div className="text-center">
              <span
                className="material-symbols-outlined text-[32px] text-on-surface-variant/30"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
              >
                area_chart
              </span>
              <p className="font-body text-on-surface-variant/50 text-[13px] mt-2">
                MRR 추이 차트 영역
              </p>
            </div>
          </div>
        </div>

        {/* Plan Revenue Share - donut */}
        <div className="col-span-3 lg:col-span-1 bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[360px]">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            플랜별 매출 비중
          </h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            플랜별 MRR 기여도
          </p>
          <div className="flex items-center justify-center h-[240px] rounded-xl bg-surface-container-low">
            <div className="text-center">
              <span
                className="material-symbols-outlined text-[32px] text-on-surface-variant/30"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
              >
                donut_large
              </span>
              <p className="font-body text-on-surface-variant/50 text-[13px] mt-2">
                도넛 차트 영역
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Details Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="mb-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            플랜별 상세
          </h3>
          <p className="font-body text-on-surface-variant text-[13px]">
            플랜별 구독사 수, MRR, ARPU 현황
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-l-xl">
                  플랜명
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  구독사 수
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  MRR
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  비중(%)
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-r-xl">
                  ARPU
                </th>
              </tr>
            </thead>
            <tbody>
              {planDetails.map((row) => (
                <tr
                  key={row.plan}
                  className="group hover:bg-surface-container-lowest/60 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface text-[14px] font-medium">
                      {row.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {row.subscribers}개
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {`₩${row.mrr.toLocaleString()}`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {row.share}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {`₩${row.arpu.toLocaleString()}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
