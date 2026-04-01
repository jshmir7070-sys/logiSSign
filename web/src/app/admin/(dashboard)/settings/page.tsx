'use client';

import { useState } from 'react';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'plans' | 'email'>('general');

  const tabs = [
    { id: 'general' as const, label: '일반' },
    { id: 'plans' as const, label: '플랜 관리' },
    { id: 'email' as const, label: '이메일 템플릿' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">설정</h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">플랫폼 전반 설정을 관리합니다</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold">플랫폼 정보</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">플랫폼명</label>
              <input
                type="text"
                defaultValue="Precision Velocity"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">관리자 이메일</label>
              <input
                type="email"
                defaultValue="admin@precision.io"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">고객센터 연락처</label>
              <input
                type="text"
                defaultValue="1588-0000"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">정산 마감일</label>
              <input
                type="text"
                defaultValue="매월 25일"
                className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all">
              저장
            </button>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-5">
          {[
            { name: 'Free', price: 0, drivers: 10, features: '기본 정산만 (기사앱, 전자계약서 불가)' },
            { name: 'Basic', price: 49900, drivers: 50, features: '기사앱, 정산서, 전자계약서, 세금계산서, 이메일 지원' },
            { name: 'Standard', price: 99000, drivers: 100, features: 'Basic 전체 + 매출 리포트, 푸시 알림, 전화 지원, API' },
            { name: 'Enterprise', price: 199000, drivers: -1, features: '무제한, 맞춤형 정산, 전담 매니저, SLA 99.9%' },
          ].map((plan) => (
            <div key={plan.name} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="font-headline text-on-surface text-[16px] font-bold">{plan.name}</h3>
                  <p className="font-data text-primary text-[20px] font-bold mt-1">₩{plan.price.toLocaleString()}<span className="text-on-surface-variant text-[13px] font-normal"> / 월</span></p>
                </div>
                <div className="h-12 w-px bg-surface-container-high" />
                <div>
                  <p className="text-sm text-on-surface font-body">기사 {plan.drivers === -1 ? '무제한' : `${plan.drivers}명`}</p>
                  <p className="text-xs text-on-surface-variant font-body mt-1">{plan.features}</p>
                </div>
              </div>
              <button className="h-9 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-[13px] font-medium hover:bg-surface-container-highest transition-colors">
                수정
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="space-y-5">
          {[
            { name: '회원가입 환영', subject: '환영합니다! Precision Velocity 가입이 완료되었습니다', status: '활성' },
            { name: '정산서 발송', subject: '[{month}월] 정산서가 발행되었습니다', status: '활성' },
            { name: '계약서 서명 요청', subject: '전자계약서 서명을 요청드립니다', status: '활성' },
            { name: '결제 실패', subject: '구독료 결제에 실패했습니다. 확인해주세요', status: '비활성' },
            { name: '구독 만료 안내', subject: '구독 만료 7일 전 안내', status: '활성' },
          ].map((tmpl) => (
            <div key={tmpl.name} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline text-on-surface text-[14px] font-bold">{tmpl.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-label font-medium ${
                    tmpl.status === '활성' ? 'text-tertiary bg-tertiary-fixed' : 'text-on-surface-variant bg-surface-container-low'
                  }`}>
                    {tmpl.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-body mt-1">{tmpl.subject}</p>
              </div>
              <button className="h-9 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-[13px] font-medium hover:bg-surface-container-highest transition-colors">
                편집
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
