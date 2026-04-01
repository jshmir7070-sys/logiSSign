import Badge from '@/components/shared/Badge';
import Link from 'next/link';

const notices = [
  { title: '3월 정기 점검 안내 (03/29 02:00~06:00)', target: '전체', date: '2026-03-20', views: 342, status: '게시중' },
  { title: 'Enterprise 플랜 신규 기능 업데이트', target: 'Enterprise', date: '2026-03-18', views: 87, status: '게시중' },
  { title: '4월 요금제 변경 사전 안내', target: '전체', date: '2026-03-25', views: 12, status: '예약' },
  { title: '설 연휴 고객센터 운영 안내', target: '전체', date: '2026-01-22', views: 521, status: '종료' },
  { title: 'Standard 플랜 SMS 발송 한도 상향 안내', target: 'Standard', date: '2026-03-10', views: 198, status: '게시중' },
];

const statusBadgeVariant: Record<string, 'success' | 'warning' | 'default'> = {
  '게시중': 'success',
  '예약': 'warning',
  '종료': 'default',
};

const targetBadgeVariant: Record<string, 'info' | 'success' | 'default'> = {
  '전체': 'default',
  Enterprise: 'info',
  Standard: 'success',
  Basic: 'info',
  Free: 'default',
};

export default function NoticesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
            공지 관리
          </h2>
          <p className="font-body text-on-surface-variant text-[14px] mt-1">
            구독사 대상 공지사항 관리
          </p>
        </div>
        <Link
          href="/admin/notices/new"
          className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            edit_note
          </span>
          공지 작성
        </Link>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-l-xl w-[45%]">
                  제목
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  대상
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  작성일
                </th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">
                  조회수
                </th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-r-xl">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {notices.map((notice, idx) => (
                <tr
                  key={idx}
                  className="group hover:bg-surface-container-lowest/60 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface text-[14px] font-medium group-hover:text-primary transition-colors">
                      {notice.title}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge label={notice.target} variant={targetBadgeVariant[notice.target] ?? 'default'} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-data text-on-surface-variant text-[13px]">
                      {notice.date}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">
                      {notice.views.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge label={notice.status} variant={statusBadgeVariant[notice.status]} />
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
