import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사용 가이드 | logiSSign',
}

const sections = [
  {
    title: '운영사 포털 가이드',
    desc: '기사 관리, 계약서 발송, 정산서 생성 등 포털 전체 기능',
    href: '#portal',
    icon: '🖥️',
  },
  {
    title: '기사 앱 가이드',
    desc: '기사에게 안내할 때 참고 — 정산서 확인, 계약 서명, 교육 이수',
    href: '/portal/guide/driver',
    icon: '📱',
  },
]

export default function PortalGuideLanding() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">사용 가이드</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">logiSSign 기능을 단계별로 안내합니다</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sections.map(s => (
          <Link key={s.href} href={s.href} className="block bg-surface-container-lowest rounded-2xl shadow-ambient p-6 hover:shadow-lg transition-all hover:-translate-y-1">
            <span className="text-3xl mb-3 block">{s.icon}</span>
            <h2 className="text-base font-bold text-on-surface mb-1 font-korean">{s.title}</h2>
            <p className="text-sm text-on-surface-variant font-korean">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
