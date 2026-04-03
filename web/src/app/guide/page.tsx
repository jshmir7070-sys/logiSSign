import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사용 가이드 | logiSSign',
  description: 'logiSSign 운영사 포털, 기사 앱, 관리자 사용 가이드',
}

const sections = [
  {
    title: '운영사 포털 가이드',
    desc: '기사 관리, 계약서 발송, 정산서 생성, 세금계산서 등 운영사 전체 기능 안내',
    href: '/guide/portal',
    icon: '🖥️',
    color: 'from-blue-500 to-blue-700',
    menus: ['대시보드', '기사 관리', '계약서 관리', '정산 관리', '매출 리포트', '공지 관리', '설정'],
  },
  {
    title: '기사 앱 가이드',
    desc: '정산서 확인, 계약서 서명, 교육 이수, 서류 관리 등 기사 전용 앱 사용법',
    href: '/guide/driver',
    icon: '📱',
    color: 'from-emerald-500 to-emerald-700',
    menus: ['홈', '정산서', '계약', '교육', '공지', '프로필'],
  },
  {
    title: '관리자 가이드',
    desc: '구독사 관리, 매출 분석, 서버 상태, 감사 로그 등 슈퍼 관리자 기능 안내',
    href: '/guide/admin',
    icon: '🛡️',
    color: 'from-purple-500 to-purple-700',
    menus: ['대시보드', '구독사 관리', '계약서 템플릿', '구독/결제', '매출 분석', '서버 상태', '감사 로그'],
  },
]

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-sidebar text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <img src="/logo.png" alt="logiSSign" className="w-[200px] mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">사용 가이드</h1>
          <p className="text-white/60 text-sm">logiSSign의 모든 기능을 단계별로 안내합니다</p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group block bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className={`bg-gradient-to-br ${s.color} p-8 text-center`}>
                <span className="text-5xl">{s.icon}</span>
              </div>
              <div className="p-6">
                <h2 className="text-lg font-bold text-on-surface mb-2">{s.title}</h2>
                <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">{s.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.menus.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-md bg-surface-container-low text-xs text-on-surface-variant">{m}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-primary hover:underline">← 메인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  )
}
