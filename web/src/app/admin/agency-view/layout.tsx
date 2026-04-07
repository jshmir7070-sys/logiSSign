import type { ReactNode } from 'react'

export const metadata = {
  title: '고객사 현황 | logiSSign',
}

export default function AgencyViewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Material Symbols 폰트 */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      />
      {children}
    </div>
  )
}
