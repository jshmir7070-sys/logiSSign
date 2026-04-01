'use client';

import KpiCard from '@/components/admin/KpiCard';
import MrrChart from '@/components/admin/charts/MrrChart';
import PlanDistribution from '@/components/admin/charts/PlanDistribution';

function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[now.getDay()];
  return `${year}. ${month}. ${day}. (${weekday})`;
}

export default function DashboardPage() {
  const currentDate = getCurrentDate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
          플랫폼 현황
        </h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">
          {currentDate}
        </p>
      </div>

      {/* KPI Cards — 제공사 관점 */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="활성 구독사"
          value="47개"
          change="+12%"
          changeType="up"
          accentColor="#2563eb"
          icon="apartment"
        />
        <KpiCard
          label="이번달 MRR"
          value="₩4,850,000"
          change="+8.2%"
          changeType="up"
          accentColor="#007d55"
          icon="trending_up"
        />
        <KpiCard
          label="미수금"
          value="₩1,240,000"
          change="-15%"
          changeType="down"
          accentColor="#ba1a1a"
          icon="warning"
        />
        <KpiCard
          label="이탈률"
          value="2.1%"
          change="-0.3%"
          changeType="down"
          accentColor="#565e74"
          icon="trending_down"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[320px]">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            MRR 추이
          </h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            월간 구독 매출 추이
          </p>
          <MrrChart />
        </div>
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[320px]">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            플랜별 구독 분포
          </h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            Free · Basic · Standard · Enterprise 비율
          </p>
          <PlanDistribution />
        </div>
      </div>

      {/* Subscriber Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
              구독사 목록
            </h3>
            <p className="font-body text-on-surface-variant text-[13px]">
              구독 중인 대리점 현황 및 결제 관리
            </p>
          </div>
          <button className="h-9 px-4 rounded-xl bg-power-gradient text-white font-label text-[13px] font-semibold hover:opacity-90 transition-opacity">
            구독사 추가
          </button>
        </div>
        <div className="flex items-center justify-center h-[200px] rounded-xl bg-surface-container-low">
          <p className="font-body text-on-surface-variant/50 text-[13px]">
            테이블 영역
          </p>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            실시간 서버 상태
          </h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            정산 · PDF · SMS · 스토리지 상태
          </p>
          <div className="flex items-center justify-center h-[160px] rounded-xl bg-surface-container-low">
            <p className="font-body text-on-surface-variant/50 text-[13px]">
              서버 상태 영역
            </p>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
            최근 활동 로그
          </h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            구독 변경, 결제, 시스템 이벤트
          </p>
          <div className="flex items-center justify-center h-[160px] rounded-xl bg-surface-container-low">
            <p className="font-body text-on-surface-variant/50 text-[13px]">
              로그 영역
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
