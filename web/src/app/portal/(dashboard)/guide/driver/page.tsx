import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '기사 앱 가이드 | logiSSign',
}

const guides = [
  {
    id: 'home',
    title: '🏠 홈',
    desc: '앱 실행 시 가장 먼저 보이는 화면입니다. 최근 정산과 공지를 한눈에 확인합니다.',
    features: ['최근 정산 요약 — 정산액, 기본급, 인센티브', '바로가기 — 정산서, 세금계산서, 공지사항, 계약서', '최근 정산 목록 — 상태별(미정산/확인중/정산완료) 표시', '공지사항 미리보기'],
    mockup: {
      type: 'phone', content: [
        { label: '최근 정산액', value: '₩2,850,000', sub: '기본급 ₩2,400,000 · 인센티브 ₩450,000' },
        { label: '바로가기', items: ['📊 정산서', '🧾 세금계산서', '📢 공지사항', '📋 계약서'] },
      ],
    },
  },
  {
    id: 'settlement',
    title: '📄 정산서',
    desc: '월별 정산 내역을 확인하고 PDF로 다운로드합니다.',
    features: ['월별 정산서 목록 — 년월, 상태, 지급총액 표시', '정산 상세 — 수입 내역(배송건수, 기본금액, 인센티브)', '차감 내역 — 항목별 차감 상세', '최종 지급액 표시', 'PDF 보기 — 정산서 PDF 다운로드/열기'],
    steps: ['하단 탭 "정산서" 클릭', '월별 정산서 목록에서 원하는 월 선택', '수입/차감 내역 확인', '"정산서 PDF 보기" 버튼으로 PDF 열기'],
    mockup: {
      type: 'phone-detail', title: '2026년 3월 정산',
      rows: [
        { label: '배송 건수', value: '1,245건' },
        { label: '기본금액', value: '₩2,400,000' },
        { label: '인센티브', value: '+₩450,000', positive: true },
        { label: '총 수입', value: '₩2,850,000', bold: true },
        { divider: true },
        { label: '보험료', value: '-₩120,000', negative: true },
        { label: '차량 임대료', value: '-₩300,000', negative: true },
        { label: '총 차감', value: '-₩420,000', negative: true, bold: true },
        { divider: true },
        { label: '최종 지급액', value: '₩2,430,000', bold: true, highlight: true },
      ],
    },
  },
  {
    id: 'contracts',
    title: '📋 계약',
    desc: '운영사가 발송한 계약서를 확인하고 전자서명합니다.',
    features: ['계약서 목록 — 상태별(서명대기/서명완료/만료) 배지', '계약 상세 — 계약 내용 확인', '전자서명 — 동의 체크(5개) + 서명 패드로 직접 서명', '서명 완료 후 PDF 보기', '변경이력 — 단가/보험/공제 변경 내역 조회'],
    steps: ['하단 탭 "계약" 클릭', '"서명대기" 상태의 계약서 선택', '계약 내용 확인', '동의 항목 5개 체크', '서명 패드에 서명 → "서명 완료" 클릭'],
    mockup: {
      type: 'phone-sign',
      checks: ['계약 내용에 동의합니다', '개인정보 수집에 동의합니다', '고유식별정보 처리에 동의합니다', '제3자 제공에 동의합니다', '제3자 고유식별정보에 동의합니다'],
    },
  },
  {
    id: 'education',
    title: '🎓 교육',
    desc: '운영사가 등록한 법정교육을 이수합니다.',
    features: ['교육 과정 목록 — 진행률(%) 표시', '이수 상태 — 이수완료/미수강/진행중', '교육 콘텐츠 열람', '이수증 자동 발급'],
    steps: ['하단 탭 "교육" 클릭', '미수강 과정 선택', '교육 콘텐츠 열람 → 이수 완료', '이수증 자동 발급'],
    mockup: { type: 'phone-list', items: [{ title: '안전운행 교육', status: '✅ 이수완료', pct: 100 }, { title: '개인정보 교육', status: '🔄 진행중', pct: 60 }, { title: '화물 취급 교육', status: '⬜ 미수강', pct: 0 }] },
  },
  {
    id: 'notice',
    title: '📢 공지',
    desc: '운영사가 작성한 공지사항을 확인합니다.',
    features: ['카테고리 탭 — 공지/가이드/업데이트/기타', '공지 상세 — 제목, 본문, 첨부파일'],
    mockup: { type: 'phone-list', items: [{ title: '4월 정산 안내', status: '공지', pct: -1 }, { title: '안전운행 가이드', status: '가이드', pct: -1 }, { title: '앱 업데이트 안내', status: '업데이트', pct: -1 }] },
  },
  {
    id: 'profile',
    title: '👤 프로필',
    desc: '내 정보, 서류, 도장을 관리합니다.',
    features: ['내 정보 — 이름, 연락처, 차량번호 확인', '문서함 — 서류 목록(면허증, 차량등록증 등) 조회', '도장/서명 관리 — 개인 도장 생성, 서명 이미지', '서류 업로드 — 운전면허증, 차량등록증, 화물운송자격증', '개인정보 관리 — 수정/삭제(탈퇴) 요청', '로그아웃'],
    mockup: {
      type: 'phone-menu',
      items: ['👤 내 정보', '📁 문서함', '🔏 도장/서명 관리', '📄 운전면허증', '🚗 차량등록증', '📋 화물운송자격증', 'ℹ️ 버전 정보', '📜 이용약관', '🔒 개인정보처리방침'],
    },
  },
]

export default function DriverGuidePage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/portal/guide" className="text-white/50 text-sm hover:text-white/80 mb-4 inline-block">← 가이드</Link>
          <h1 className="text-2xl font-bold mb-2">📱 기사 앱 가이드</h1>
          <p className="text-white/70 text-sm">정산서 확인, 계약서 서명, 교육 이수, 서류 관리 사용법</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* TOC */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 mb-10">
          <h2 className="text-sm font-bold text-on-surface-variant mb-3">📋 목차 (하단 탭 메뉴)</h2>
          <div className="flex flex-wrap gap-2">
            {guides.map(g => (
              <a key={g.id} href={`#${g.id}`} className="text-sm text-primary hover:underline">{g.title}</a>
            ))}
          </div>
        </div>

        <div className="space-y-16">
          {guides.map(g => (
            <section key={g.id} id={g.id} className="scroll-mt-8">
              <h2 className="text-xl font-bold text-on-surface mb-2">{g.title}</h2>
              <p className="text-sm text-on-surface-variant mb-6">{g.desc}</p>

              <div className="grid md:grid-cols-2 gap-6 mb-4">
                {/* Phone mockup */}
                <div className="flex justify-center">
                  <div className="w-[280px] bg-surface-container-lowest rounded-[2rem] shadow-lg border border-outline-variant/20 overflow-hidden">
                    {/* Status bar */}
                    <div className="bg-on-surface text-white px-5 py-1.5 flex justify-between text-[10px]">
                      <span>9:41</span>
                      <span>●●● ▐█▌ 100%</span>
                    </div>
                    {/* Content */}
                    <div className="p-4 min-h-[320px]">
                      <p className="text-xs font-bold text-on-surface mb-3">{g.title.replace(/^\S+\s/, '')}</p>

                      {g.mockup.type === 'phone' && g.mockup.content && (
                        <div className="space-y-3">
                          {g.mockup.content.map((c, i) => (
                            <div key={i} className="bg-surface-container-low rounded-xl p-3">
                              {'value' in c && <><p className="text-[10px] text-on-surface-variant">{c.label}</p><p className="text-lg font-bold text-primary">{c.value}</p><p className="text-[10px] text-on-surface-variant">{c.sub}</p></>}
                              {'items' in c && <><p className="text-[10px] text-on-surface-variant mb-2">{c.label}</p><div className="grid grid-cols-2 gap-1.5">{c.items?.map(item => <span key={item} className="text-[10px] bg-surface-container-lowest rounded-lg py-1.5 text-center">{item}</span>)}</div></>}
                            </div>
                          ))}
                        </div>
                      )}

                      {g.mockup.type === 'phone-detail' && g.mockup.rows && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-on-surface mb-2">{g.mockup.title}</p>
                          {g.mockup.rows.map((r, i) => (
                            'divider' in r ? <div key={i} className="border-t border-outline-variant/20 my-2" /> :
                            <div key={i} className={`flex justify-between text-[11px] py-0.5 ${r.bold ? 'font-bold' : ''}`}>
                              <span className="text-on-surface-variant">{r.label}</span>
                              <span className={r.highlight ? 'text-primary font-bold' : r.positive ? 'text-emerald-600' : r.negative ? 'text-red-500' : 'text-on-surface'}>{r.value}</span>
                            </div>
                          ))}
                          <button className="w-full mt-3 py-2 rounded-xl bg-primary/10 text-primary text-[11px] font-semibold">📄 정산서 PDF 보기</button>
                        </div>
                      )}

                      {g.mockup.type === 'phone-sign' && g.mockup.checks && (
                        <div className="space-y-2">
                          {g.mockup.checks.map(c => (
                            <label key={c} className="flex items-start gap-2 text-[10px] text-on-surface-variant">
                              <span className="w-3.5 h-3.5 rounded border border-primary flex-shrink-0 mt-0.5 flex items-center justify-center text-primary text-[8px]">✓</span>
                              {c}
                            </label>
                          ))}
                          <div className="mt-3 border-2 border-dashed border-outline-variant/30 rounded-xl h-20 flex items-center justify-center">
                            <p className="text-[10px] text-on-surface-variant">✍️ 여기에 서명</p>
                          </div>
                          <button className="w-full py-2 rounded-xl bg-primary text-white text-[11px] font-semibold">서명 완료</button>
                        </div>
                      )}

                      {g.mockup.type === 'phone-list' && 'items' in g.mockup && (
                        <div className="space-y-2">
                          {(g.mockup.items as { title: string; status: string; pct: number }[]).map(item => (
                            <div key={item.title} className="bg-surface-container-low rounded-xl p-3 flex justify-between items-center">
                              <div>
                                <p className="text-[11px] font-medium text-on-surface">{item.title}</p>
                                <p className="text-[9px] text-on-surface-variant">{item.status}</p>
                              </div>
                              {item.pct >= 0 && (
                                <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-primary">{item.pct}%</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {g.mockup.type === 'phone-menu' && 'items' in g.mockup && (
                        <div className="space-y-1">
                          {(g.mockup.items as string[]).map(item => (
                            <div key={item} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-container-low text-[11px] text-on-surface">{item}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Tab bar */}
                    <div className="bg-surface-container-low border-t border-outline-variant/10 px-3 py-2 flex justify-around">
                      {['🏠', '📄', '📋', '🎓', '📢', '👤'].map((icon, i) => (
                        <span key={i} className={`text-sm ${g.id === ['home','settlement','contracts','education','notice','profile'][i] ? 'opacity-100' : 'opacity-30'}`}>{icon}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-sm font-bold text-on-surface mb-2">주요 기능</h3>
                  <ul className="space-y-1.5 mb-4">
                    {g.features.map(f => (
                      <li key={f} className="text-sm text-on-surface-variant flex gap-2"><span className="text-emerald-600 mt-0.5">•</span>{f}</li>
                    ))}
                  </ul>
                  {g.steps && (
                    <>
                      <h3 className="text-sm font-bold text-on-surface mb-2">사용 순서</h3>
                      <ol className="space-y-1.5">
                        {g.steps.map((s, i) => (
                          <li key={i} className="text-sm text-on-surface-variant flex gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 text-center pb-12">
          <Link href="/portal/guide" className="text-sm text-primary hover:underline">← 가이드으로</Link>
        </div>
      </div>
    </div>
  )
}
