import Badge from '@/components/shared/Badge';
import KpiCard from '@/components/admin/KpiCard';

const payments = [
  { agency: '서울중앙 대리점', plan: 'Enterprise', amount: 199000, date: '2026-03-01', method: '카드 자동결제', status: '완료' },
  { agency: '강남 퀵서비스', plan: 'Standard', amount: 99000, date: '2026-03-01', method: '카드 자동결제', status: '완료' },
  { agency: '인천항만 물류', plan: 'Enterprise', amount: 199000, date: '2026-03-01', method: '계좌이체', status: '완료' },
  { agency: '부산 익스프레스', plan: 'Standard', amount: 99000, date: '2026-03-05', method: '카드 자동결제', status: '실패' },
  { agency: '대전 스피드 배달', plan: 'Basic', amount: 49900, date: '2026-03-01', method: '카드 자동결제', status: '완료' },
  { agency: '수원 라이더스', plan: 'Standard', amount: 99000, date: '2026-03-10', method: '계좌이체', status: '대기' },
];

const statusBadgeVariant: Record<string, 'success' | 'error' | 'warning'> = {
  '완료': 'success',
  '실패': 'error',
  '대기': 'warning',
};

const failedPayments = [
  { agency: '부산 익스프레스', amount: 99000, reason: '카드 한도 초과', failDate: '2026-03-05', retryDate: '2026-03-08' },
  { agency: '광주 원콜 물류', amount: 49900, reason: '카드 만료', failDate: '2026-03-02', retryDate: '2026-03-06' },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
          구독/결제 관리
        </h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">
          구독 결제 현황 및 미수금 관리
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="이번달 총 매출"
          value="₩4,850,000"
          change="+8.2%"
          changeType="up"
          accentColor="#2563eb"
          icon="payments"
        />
        <KpiCard
          label="미수금"
          value="₩1,240,000"
          change="-15%"
          changeType="down"
          accentColor="#ba1a1a"
          icon="money_off"
        />
        <KpiCard
          label="결제 완료율"
          value="92.4%"
          change="+3.1%"
          changeType="up"
          accentColor="#007d55"
          icon="check_circle"
        />
        <KpiCard
          label="평균 구독 기간"
          value="8.3개월"
          change="+1.2"
          changeType="up"
          accentColor="#565e74"
          icon="calendar_month"
        />
      </div>

      {/* Payment Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="mb-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            결제 내역
          </h3>
          <p className="font-body text-on-surface-variant text-[13px]">
            2026년 3월 결제 현황
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-l-xl">
                  대리점명
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  플랜
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  결제금액
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  결제일
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  결제수단
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-r-xl">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, idx) => (
                <tr
                  key={idx}
                  className="group hover:bg-surface-container-lowest/60 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface text-[14px] font-medium">
                      {payment.agency}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface-variant text-[14px]">
                      {payment.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {`₩${payment.amount.toLocaleString()}`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-data text-on-surface-variant text-[13px]">
                      {payment.date}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface-variant text-[14px]">
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge label={payment.status} variant={statusBadgeVariant[payment.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Payments Alert */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-error/[0.08] flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[22px] text-error"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              credit_card_off
            </span>
          </div>
          <div>
            <h3 className="font-headline text-on-surface text-[16px] font-bold">
              결제 실패 알림
            </h3>
            <p className="font-body text-on-surface-variant text-[13px]">
              재결제 시도가 필요한 구독사
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {failedPayments.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-xl bg-error/[0.04]"
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-body text-on-surface text-[14px] font-medium">
                    {item.agency}
                  </p>
                  <p className="font-body text-on-surface-variant text-[13px] mt-0.5">
                    사유: {item.reason} &middot; 실패일: {item.failDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-data text-error text-[14px] font-semibold">
                  {`₩${item.amount.toLocaleString()}`}
                </span>
                <button className="h-8 px-4 rounded-lg bg-error/[0.08] text-error font-label text-[12px] font-semibold hover:bg-error/[0.14] transition-colors">
                  재결제 요청
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
