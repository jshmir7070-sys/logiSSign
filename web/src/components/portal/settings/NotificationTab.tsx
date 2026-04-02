'use client';

import { useState } from 'react';

export default function NotificationTab() {
  const [settings, setSettings] = useState({
    settlement: true,
    contract: true,
    notice: true,
    sms: false,
    email: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  const items = [
    { key: 'settlement' as const, label: '정산서 알림', desc: '정산서 생성/변경 시 알림' },
    { key: 'contract' as const, label: '계약서 알림', desc: '전자계약 서명 요청/완료 알림' },
    { key: 'notice' as const, label: '공지사항', desc: '새 공지사항 등록 시 알림' },
    { key: 'sms' as const, label: 'SMS 알림', desc: '문자메시지로 알림 수신' },
    { key: 'email' as const, label: '이메일 알림', desc: '이메일로 알림 수신' },
  ];

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
      <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">알림 설정</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/15">
            <div>
              <p className="text-sm font-semibold text-on-surface font-korean">{item.label}</p>
              <p className="text-xs text-on-surface-variant font-korean mt-0.5">{item.desc}</p>
            </div>
            <button
              onClick={() => toggleSetting(item.key)}
              className={`relative w-12 h-7 rounded-full transition-colors ${settings[item.key] ? 'bg-primary' : 'bg-outline-variant/30'}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
