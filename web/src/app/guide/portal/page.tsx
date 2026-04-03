import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '운영사 포털 가이드 | logiSSign',
}

const guides = [
  {
    id: 'dashboard',
    title: '📊 대시보드',
    desc: '로그인 후 가장 먼저 보이는 화면입니다. 운영 현황을 한눈에 파악할 수 있습니다.',
    features: ['활성 기사 수, 이번달 정산 총액, 미발송 계약 등 KPI 카드', '월별 매출 추이 차트', '최근 정산 목록 바로가기', '현재 구독 플랜 및 결제 상태'],
    mockup: { type: 'dashboard' },
  },
  {
    id: 'drivers',
    title: '👥 기사 관리',
    desc: '소속 기사를 등록하고, 단가·서류·계약 이력을 관리합니다.',
    features: ['기사 목록 — 이름, 연락처, 상태, 배송지역, 원청사 표시', '기사 등록 — 기본정보 + 차량정보 + 단가설정 + 서류업로드', '기사 상세 — 프로필 수정, 단가 관리, 서류, 계약·정산 이력', 'SMS 초대 — 기사에게 앱 설치 + 초대코드 발송'],
    steps: ['좌측 메뉴에서 "기사 관리" 클릭', '"기사 등록" 버튼으로 새 기사 추가', '이름, 연락처, 배송지역, 단가 등 입력', '"SMS 초대" 버튼으로 기사에게 앱 설치 안내 발송'],
    mockup: { type: 'list', headers: ['이름', '연락처', '배송지역', '상태'], rows: [['홍길동', '010-1234-5678', '강남구', '활성'], ['김철수', '010-9876-5432', '서초구', '활성'], ['이영희', '010-5555-3333', '송파구', '비활성']] },
  },
  {
    id: 'contracts',
    title: '📑 계약서 관리',
    desc: '전자계약서를 발송하고, 서명 상태를 추적합니다.',
    features: ['계약서 목록 — 상태별(작성중/서명대기/서명완료/만료) 필터', '계약서 양식 — 시스템 기본 양식 + 사용자 업로드 양식 관리', '계약서 발송 — 기사 선택 → 양식 선택 → 일괄 발송', '변경이력 — 단가/보험/공제 변경 요청 승인/거절', '외부문서 관리 — PDF 업로드 → 서명 필드 배치 → 기사에게 발송'],
    steps: ['좌측 메뉴 "계약서 관리" → "계약서 목록"', '"새 계약서 발송" 버튼 클릭', '기사 선택 (복수 선택 가능)', '양식 선택 → "발송" 클릭', '기사 앱에서 서명 완료 시 상태가 "서명완료"로 변경'],
    mockup: { type: 'list', headers: ['제목', '기사', '상태', '발송일'], rows: [['위수탁 표준계약서', '홍길동', '✅ 서명완료', '2026-04-01'], ['차량 임대차 계약서', '김철수', '⏳ 서명대기', '2026-04-02'], ['개인정보 동의서', '이영희', '📝 작성중', '2026-04-03']] },
  },
  {
    id: 'settlements',
    title: '💰 정산 관리',
    desc: '엑셀 업로드부터 정산서 생성, 세금계산서까지 정산 전체 플로우를 처리합니다.',
    features: ['원청사 관리 — 거래처 등록, 정산 항목 표시 설정', '엑셀 업로드 정산 — 운송사 엑셀 그대로 업로드 → 자동 컬럼 매핑', '정산서 일괄생성 — 기사별 정산서 PDF 자동 생성', '정산서 양식 편집 — 커스텀 템플릿 빌더 (항목/색상/로고)', '생성 이력 — 과거 생성 이력 조회 + ZIP 다운로드', '세금계산서 — 기사별 세금계산서 조회 + 인쇄'],
    steps: ['원청사 등록 (정산 관리 → 원청사 관리)', '엑셀 업로드 (정산 관리 → 엑셀 업로드 정산)', '컬럼 매핑 확인 후 "정산 생성" 클릭', '정산서 일괄생성 → PDF 자동 생성', '기사에게 SMS/푸시로 정산서 안내 발송'],
    mockup: { type: 'flow', steps: ['📤 엑셀 업로드', '🔄 컬럼 자동 매핑', '📊 정산 데이터 확인', '📄 PDF 일괄 생성', '📨 기사에게 발송'] },
  },
  {
    id: 'reports',
    title: '📈 매출 리포트',
    desc: '월별 매출 추이, 기사별 매출 분석을 확인합니다.',
    features: ['월별 매출 차트', '기사별 매출 분석', '수입/지출 비교'],
    mockup: { type: 'chart' },
  },
  {
    id: 'notices',
    title: '📢 공지 관리',
    desc: '기사에게 공지사항을 작성하여 앱 푸시로 전달합니다.',
    features: ['공지 목록 — 작성한 공지 리스트', '새 공지 작성 — 제목, 본문, 카테고리, 대상(전체/특정 기사)', '기사 앱에서 자동으로 공지 확인 가능'],
    steps: ['좌측 메뉴 "공지 관리" 클릭', '"새 공지 작성" 버튼 클릭', '제목, 카테고리, 본문 입력', '"발행" 버튼 → 기사 앱에 즉시 표시'],
    mockup: { type: 'list', headers: ['제목', '카테고리', '상태', '작성일'], rows: [['4월 정산 안내', '공지', '발행됨', '2026-04-01'], ['안전운행 교육 일정', '가이드', '발행됨', '2026-03-28']] },
  },
  {
    id: 'settings',
    title: '⚙️ 설정',
    desc: '대리점 정보, 관리자 계정, 도장, 구독, 알림 등을 설정합니다.',
    features: ['프로필 — 상호, 사업자번호, 대표자, 주소 등 기본정보', '관리자 계정 — 서브 관리자 초대/관리', '카테고리 관리 — 정산 항목 카테고리 설정', '도장/서명 — 법인 도장 자동 생성, 서명 이미지 관리', '구독/결제 — 플랜 변경, 카드 등록, 결제 이력', '알림 설정 — 푸시/SMS 알림 설정'],
    mockup: { type: 'tabs', tabs: ['프로필', '관리자 계정', '카테고리', '도장/서명', '구독/결제', '알림 설정'] },
  },
]

export default function PortalGuidePage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-sidebar text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/guide" className="text-white/50 text-sm hover:text-white/80 mb-4 inline-block">← 가이드 홈</Link>
          <h1 className="text-2xl font-bold mb-2">🖥️ 운영사 포털 가이드</h1>
          <p className="text-white/60 text-sm">기사 관리, 계약서, 정산, 세금계산서 등 전체 기능 안내</p>
        </div>
      </div>

      {/* TOC */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 mb-10">
          <h2 className="text-sm font-bold text-on-surface-variant mb-3">📋 목차</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {guides.map(g => (
              <a key={g.id} href={`#${g.id}`} className="text-sm text-primary hover:underline">{g.title}</a>
            ))}
          </div>
        </div>

        {/* Sections */}
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
                  <span className="text-xs text-on-surface-variant ml-2">logissign.com/portal/...</span>
                </div>
                <div className="p-6">
                  {g.mockup.type === 'list' && g.mockup.headers && (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant/20">
                          {g.mockup.headers.map(h => <th key={h} className="pb-3 text-xs font-semibold text-on-surface-variant">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {g.mockup.rows?.map((row, i) => (
                          <tr key={i} className="border-b border-outline-variant/10">
                            {row.map((cell, j) => <td key={j} className="py-3 text-on-surface">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {g.mockup.type === 'dashboard' && (
                    <div className="grid grid-cols-4 gap-3">
                      {[{ l: '활성 기사', v: '32명', c: 'text-blue-600' }, { l: '이번달 정산', v: '₩12,450,000', c: 'text-emerald-600' }, { l: '미발송 계약', v: '5건', c: 'text-amber-600' }, { l: '구독 플랜', v: 'Standard', c: 'text-purple-600' }].map(k => (
                        <div key={k.l} className="bg-surface-container-low rounded-xl p-4 text-center">
                          <p className="text-xs text-on-surface-variant mb-1">{k.l}</p>
                          <p className={`text-lg font-bold ${k.c}`}>{k.v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {g.mockup.type === 'flow' && g.mockup.steps && (
                    <div className="flex items-center justify-between">
                      {g.mockup.steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="bg-primary/10 rounded-xl px-4 py-3 text-center">
                            <p className="text-sm font-medium text-on-surface">{s}</p>
                          </div>
                          {i < g.mockup.steps!.length - 1 && <span className="text-on-surface-variant">→</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {g.mockup.type === 'chart' && (
                    <div className="flex items-end gap-2 h-32">
                      {[40, 55, 45, 65, 80, 70, 90, 85, 95, 88, 92, 100].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${h}%` }}>
                          <div className="bg-primary rounded-t h-full" style={{ opacity: 0.3 + (h / 140) }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {g.mockup.type === 'tabs' && g.mockup.tabs && (
                    <div>
                      <div className="flex gap-2 mb-4">
                        {g.mockup.tabs.map((t, i) => (
                          <span key={t} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${i === 0 ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>{t}</span>
                        ))}
                      </div>
                      <div className="bg-surface-container-low rounded-xl p-4 h-24 flex items-center justify-center">
                        <p className="text-sm text-on-surface-variant">설정 내용 영역</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-on-surface mb-2">주요 기능</h3>
                  <ul className="space-y-1.5">
                    {g.features.map(f => (
                      <li key={f} className="text-sm text-on-surface-variant flex gap-2"><span className="text-primary mt-0.5">•</span>{f}</li>
                    ))}
                  </ul>
                </div>
                {g.steps && (
                  <div>
                    <h3 className="text-sm font-bold text-on-surface mb-2">사용 순서</h3>
                    <ol className="space-y-1.5">
                      {g.steps.map((s, i) => (
                        <li key={i} className="text-sm text-on-surface-variant flex gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
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
