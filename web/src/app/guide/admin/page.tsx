import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자 가이드 | logiSSign',
}

const guides = [
  {
    id: 'dashboard',
    title: '📊 대시보드',
    desc: '플랫폼 전체 현황을 실시간으로 모니터링합니다.',
    features: ['활성 구독사 수, MRR, 등록 기사 수, 이탈률 KPI', 'MRR 추이 차트', '플랜별 구독 분포', '최근 구독사 테이블', '최근 보안 활동 로그'],
    mockup: { kpis: [{ l: '활성 구독사', v: '47개' }, { l: 'MRR', v: '₩4.8M' }, { l: '기사 수', v: '1,240명' }, { l: '이탈률', v: '2.1%' }] },
  },
  {
    id: 'agencies',
    title: '🏢 구독사 관리',
    desc: '가입한 대리점(운영사)을 관리하고 플랜을 설정합니다.',
    features: ['구독사 목록 — 이름, 플랜, 상태, 기사수', '플랜/상태 변경 — Free/Basic/Standard/Enterprise', '상세 정보 — 사업자정보, 활동 현황'],
    mockup: { table: { headers: ['운영사', '플랜', '기사수', '상태'], rows: [['강남택배', 'Enterprise', '120명', '활성'], ['서초물류', 'Standard', '45명', '활성'], ['인천퀵', 'Basic', '18명', '활성'], ['부산배송', 'Free', '8명', '체험중']] } },
  },
  {
    id: 'templates',
    title: '📄 계약서 템플릿',
    desc: '전체 운영사에 제공되는 시스템 기본 계약서 양식을 관리합니다.',
    features: ['시스템 기본 양식 CRUD', '{{변수}} 바인딩 지원', '운영사별 양식 활성화/비활성화'],
  },
  {
    id: 'billing',
    title: '💳 구독/결제',
    desc: '운영사별 구독 현황과 결제 내역을 관리합니다.',
    features: ['활성 구독, MRR, 미수/연체, 총 구독사 KPI', '구독 목록 — 플랜, 월액, 결제수단, 상태', '연체 관리 — 실패 내역 + 재시도'],
    mockup: { table: { headers: ['운영사', '플랜', '월액', '상태'], rows: [['강남택배', 'Enterprise', '₩199,000', '✅ 활성'], ['서초물류', 'Standard', '₩99,000', '✅ 활성'], ['부산배송', 'Basic', '₩49,900', '⚠️ 연체']] } },
  },
  {
    id: 'revenue',
    title: '📈 매출 분석',
    desc: '플랫폼 전체 매출을 분석합니다.',
    features: ['MRR, ARR, ARPU 지표', '플랜별 구독사 수, MRR, 비중(%)', '합계 테이블'],
  },
  {
    id: 'server',
    title: '🖥️ 서버 상태',
    desc: '핵심 서비스의 가동 상태를 실시간으로 확인합니다.',
    features: ['Database, Storage, Auth, 전체 상태 카드', '응답시간(ms) 실시간 측정', '데이터베이스 현황 — 주요 테이블 레코드 수', '최근 보안 이벤트 (warning/critical)'],
    mockup: { services: [{ name: 'Database', status: '정상', ms: '12ms' }, { name: 'Storage', status: '정상', ms: '45ms' }, { name: 'Auth', status: '정상', ms: '8ms' }, { name: '전체', status: '정상', ms: '-' }] },
  },
  {
    id: 'audit',
    title: '🔒 감사 로그',
    desc: '시스템 보안 이벤트를 실시간으로 모니터링합니다.',
    features: ['이벤트 필터 — 로그인/실패/권한거부/데이터변경/PII접근/Rate Limit/무결성', '시각, 이벤트, IP, 리소스, 상세 정보', '실시간 조회 (security_logs 테이블)'],
    mockup: { table: { headers: ['시각', '이벤트', 'IP', '리소스'], rows: [['04-03 09:12', '로그인 성공', '1.2.3.4', 'auth'], ['04-03 09:10', '권한 거부', '5.6.7.8', '/api/admin'], ['04-03 09:08', 'PII 접근', '1.2.3.4', 'drivers']] } },
  },
  {
    id: 'settings',
    title: '⚙️ 설정',
    desc: '플랫폼 전체 설정을 관리합니다.',
    features: ['일반 — 플랫폼명, 관리자 이메일', '플랜 관리 — Free/Basic/Standard/Enterprise 가격/기능', '이메일 템플릿 — 시스템 발송 이메일 양식'],
  },
]

export default function AdminGuidePage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/guide" className="text-white/50 text-sm hover:text-white/80 mb-4 inline-block">← 가이드 홈</Link>
          <h1 className="text-2xl font-bold mb-2">🛡️ 관리자 가이드</h1>
          <p className="text-white/70 text-sm">구독사 관리, 매출 분석, 서버 모니터링, 감사 로그 등 슈퍼 관리자 기능</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 mb-10">
          <h2 className="text-sm font-bold text-on-surface-variant mb-3">📋 목차</h2>
          <div className="flex flex-wrap gap-2">
            {guides.map(g => <a key={g.id} href={`#${g.id}`} className="text-sm text-primary hover:underline">{g.title}</a>)}
          </div>
        </div>

        <div className="space-y-16">
          {guides.map(g => (
            <section key={g.id} id={g.id} className="scroll-mt-8">
              <h2 className="text-xl font-bold text-on-surface mb-2">{g.title}</h2>
              <p className="text-sm text-on-surface-variant mb-6">{g.desc}</p>

              {/* Mockup */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden mb-6">
                <div className="bg-surface-container-low px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-on-surface-variant ml-2">logissign.com/admin/...</span>
                </div>
                <div className="p-6">
                  {g.mockup?.kpis && (
                    <div className="grid grid-cols-4 gap-3">
                      {g.mockup.kpis.map(k => (
                        <div key={k.l} className="bg-surface-container-low rounded-xl p-4 text-center">
                          <p className="text-xs text-on-surface-variant mb-1">{k.l}</p>
                          <p className="text-lg font-bold text-primary">{k.v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {g.mockup?.table && (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant/20">
                          {g.mockup.table.headers.map(h => <th key={h} className="pb-3 text-xs font-semibold text-on-surface-variant">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {g.mockup.table.rows.map((row, i) => (
                          <tr key={i} className="border-b border-outline-variant/10">
                            {row.map((cell, j) => <td key={j} className="py-3 text-on-surface">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {g.mockup?.services && (
                    <div className="grid grid-cols-4 gap-3">
                      {g.mockup.services.map(s => (
                        <div key={s.name} className="bg-surface-container-low rounded-xl p-4">
                          <p className="text-xs text-on-surface-variant mb-1">{s.name}</p>
                          <p className="text-sm font-bold text-emerald-600">{s.status}</p>
                          <p className="text-xs text-on-surface-variant">{s.ms}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!g.mockup && (
                    <div className="h-24 flex items-center justify-center bg-surface-container-low rounded-xl">
                      <p className="text-sm text-on-surface-variant">{g.title} 화면</p>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-bold text-on-surface mb-2">주요 기능</h3>
              <ul className="space-y-1.5">
                {g.features.map(f => (
                  <li key={f} className="text-sm text-on-surface-variant flex gap-2"><span className="text-purple-600 mt-0.5">•</span>{f}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-16 text-center pb-12">
          <Link href="/guide" className="text-sm text-primary hover:underline">← 가이드 홈으로</Link>
        </div>
      </div>
    </div>
  )
}
