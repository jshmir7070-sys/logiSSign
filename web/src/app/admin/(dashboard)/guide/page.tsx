import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자 가이드 | logiSSign',
}

const guides = [
  { id: 'dashboard', title: '📊 대시보드', desc: '활성 구독사, MRR, 기사 수, 이탈률 등 플랫폼 현황을 실시간 확인합니다.', features: ['KPI 카드 (구독사/MRR/기사수/이탈률)', 'MRR 추이 차트', '플랜별 구독 분포', '최근 구독사 + 활동 로그'] },
  { id: 'agencies', title: '🏢 구독사 관리', desc: '가입한 운영사를 관리하고 플랜을 설정합니다.', features: ['구독사 목록 조회', '플랜/상태 변경', '상세 정보 (사업자정보, 기사수, 활동)'] },
  { id: 'templates', title: '📄 계약서 템플릿', desc: '전체 운영사에 제공되는 시스템 기본 양식을 관리합니다.', features: ['시스템 양식 CRUD', '{{변수}} 바인딩 지원'] },
  { id: 'billing', title: '💳 구독/결제', desc: '구독 현황과 결제 내역을 관리합니다.', features: ['활성 구독/MRR/미수 KPI', '구독 목록 (플랜, 월액, 결제수단, 상태)', '연체 관리'] },
  { id: 'revenue', title: '📈 매출 분석', desc: '플랫폼 매출을 분석합니다.', features: ['MRR/ARR/ARPU 지표', '플랜별 구독사 수, 비중(%)'] },
  { id: 'server', title: '🖥️ 서버 상태', desc: '핵심 서비스 가동 상태를 실시간 확인합니다.', features: ['DB/Storage/Auth 상태 + 응답시간(ms)', '데이터베이스 레코드 수', '보안 이벤트 (warning/critical)'] },
  { id: 'audit', title: '🔒 감사 로그', desc: '보안 이벤트를 실시간 모니터링합니다.', features: ['이벤트 필터 (로그인/권한거부/PII접근/Rate Limit)', 'IP, 리소스, 상세 정보'] },
  { id: 'settings', title: '⚙️ 설정', desc: '플랫폼 전체 설정을 관리합니다.', features: ['플랫폼명, 관리자 이메일', '플랜 가격/기능 설정', '이메일 템플릿'] },
]

export default function AdminGuidePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">🛡️ 관리자 가이드</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">슈퍼 관리자 전체 기능 안내</p>
      </div>

      <div className="space-y-6">
        {guides.map(g => (
          <div key={g.id} id={g.id} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
            <h2 className="text-base font-bold text-on-surface mb-1 font-korean">{g.title}</h2>
            <p className="text-sm text-on-surface-variant mb-3 font-korean">{g.desc}</p>
            <ul className="space-y-1">
              {g.features.map(f => (
                <li key={f} className="text-sm text-on-surface-variant flex gap-2 font-korean">
                  <span className="text-purple-600 mt-0.5">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
