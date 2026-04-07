import type { ReactNode } from 'react'

export const metadata = {
  title: '고객사 현황 | logiSSign',
}

export default function AgencyViewLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-surface">{children}</div>
}
