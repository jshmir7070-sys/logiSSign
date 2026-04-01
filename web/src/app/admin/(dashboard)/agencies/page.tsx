import Badge from '@/components/shared/Badge';

const agencies = [
  { name: '서울중앙 대리점', ceo: '김태우', plan: 'Enterprise', drivers: 42, mrr: 199000, startDate: '2025-03-15', status: '활성' },
  { name: '강남 퀵서비스', ceo: '이수진', plan: 'Standard', drivers: 28, mrr: 99000, startDate: '2025-05-22', status: '활성' },
  { name: '인천항만 물류', ceo: '박정훈', plan: 'Enterprise', drivers: 65, mrr: 199000, startDate: '2025-01-10', status: '활성' },
  { name: '부산 익스프레스', ceo: '최민호', plan: 'Standard', drivers: 18, mrr: 99000, startDate: '2025-07-01', status: '미납' },
  { name: '대전 스피드 배달', ceo: '정하영', plan: 'Basic', drivers: 8, mrr: 49900, startDate: '2025-09-12', status: '활성' },
  { name: '수원 라이더스', ceo: '강동현', plan: 'Standard', drivers: 22, mrr: 99000, startDate: '2025-06-03', status: '활성' },
  { name: '광주 원콜 물류', ceo: '윤서아', plan: 'Free', drivers: 5, mrr: 0, startDate: '2025-11-20', status: '해지' },
  { name: '제주 프레시 딜리버리', ceo: '한지우', plan: 'Enterprise', drivers: 51, mrr: 199000, startDate: '2024-12-01', status: '활성' },
];

const planBadgeVariant: Record<string, 'info' | 'success' | 'default' | 'warning'> = {
  Free: 'default',
  Basic: 'info',
  Standard: 'success',
  Enterprise: 'warning',
};

const statusBadgeVariant: Record<string, 'success' | 'error' | 'warning'> = {
  '활성': 'success',
  '미납': 'error',
  '해지': 'warning',
};

export default function AgenciesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
            구독사 관리
          </h2>
          <p className="font-body text-on-surface-variant text-[14px] mt-1">
            대리점 구독 현황 및 관리
          </p>
        </div>
        <button className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            add
          </span>
          신규 구독사 등록
        </button>
      </div>

      {/* Search + Filter */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <span
              className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="대리점명 또는 대표자 검색"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-container-low font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            {['전체', 'Free', 'Basic', 'Standard', 'Enterprise'].map((plan) => (
              <button
                key={plan}
                className={`h-9 px-4 rounded-xl font-label text-[13px] font-medium transition-colors ${
                  plan === '전체'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-l-xl">
                  대리점명
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  대표자
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  플랜
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  기사 수
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  MRR
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  구독시작일
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-r-xl">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency, idx) => (
                <tr
                  key={idx}
                  className="group hover:bg-surface-container-lowest/60 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface text-[14px] font-medium">
                      {agency.name}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface-variant text-[14px]">
                      {agency.ceo}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge label={agency.plan} variant={planBadgeVariant[agency.plan]} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {agency.drivers}명
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {`₩${agency.mrr.toLocaleString()}`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-data text-on-surface-variant text-[13px]">
                      {agency.startDate}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge label={agency.status} variant={statusBadgeVariant[agency.status]} />
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
