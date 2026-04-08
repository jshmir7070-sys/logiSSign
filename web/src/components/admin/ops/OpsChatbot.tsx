'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface DeptConfig {
  id: string
  name: string
  icon: string
  keywords: string[]
  responses: string[]
}

const DEPARTMENTS: DeptConfig[] = [
  {
    id: 'cs',
    name: '고객센터',
    icon: 'support_agent',
    keywords: ['배송', '배달', '지연', '환불', '취소', '문의'],
    responses: [
      '배송 지연의 경우 담당 배달대행사에 실시간 확인 요청을 진행합니다. 평균 처리 시간은 2.3분입니다.',
      '환불 요청은 Level 3 승인 프로세스를 거칩니다. 자동 처리는 불가하며 담당자 확인 후 진행됩니다.',
      '현재 고객 만족도 94%, 오늘 접수된 문의 대부분 해결 완료 상태입니다.',
    ],
  },
  {
    id: 'legal',
    name: '법무팀',
    icon: 'gavel',
    keywords: ['계약', '전자서명', '법규', '규정', '컴플라이언스'],
    responses: [
      '전자서명법 개정안에 따라 감사추적(Audit Trail) 기반 서명이 법적 효력을 가집니다.',
      '현재 계약서 검토 현황을 확인 중입니다. 법적 리스크 플래그 처리된 건이 있습니다.',
      '물류 관련 법규 RAG 데이터베이스에서 관련 조항을 검색합니다.',
    ],
  },
  {
    id: 'finance',
    name: '재무팀',
    icon: 'account_balance',
    keywords: ['정산', '세금', '매출', '인보이스', '세금계산서'],
    responses: [
      '오늘 세금계산서 발행 및 정산 현황을 조회합니다.',
      'PopBill API 연동 세금계산서 자동 발행 시스템 정상 가동 중입니다.',
      '정산 정확도를 확인하고 불일치 건은 재계산 진행 중입니다.',
    ],
  },
  {
    id: 'ops',
    name: '운영팀',
    icon: 'engineering',
    keywords: ['운영', '배달', '기사', '지역', '배정'],
    responses: [
      '오늘 배달 처리 현황과 정시 배달률을 확인합니다.',
      'AI 이상탐지 모델이 운영 패턴을 분석 중입니다.',
      '헬프미 플랫폼 기사 매칭률이 정상 범위입니다.',
    ],
  },
  {
    id: 'dev',
    name: '개발팀',
    icon: 'code',
    keywords: ['오류', '버그', '배포', '서버', 'API', '에러'],
    responses: [
      '시스템 업타임과 최근 배포 현황을 확인합니다.',
      'Edge Function 관련 이슈는 서킷브레이커 패턴으로 자동 fallback 처리 중입니다.',
      '자동 복구 시스템: Level 1-2 완전자동, Level 3 승인대기, Level 4 알림입니다.',
    ],
  },
]

export default function OpsChatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! 로지사인 AI 어시스턴트입니다. 운영 관련 질문을 해주세요.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDept, setSelectedDept] = useState('cs')
  const bottomRef = useRef<HTMLDivElement>(null)

  const getResponse = useCallback(
    (text: string) => {
      const dept = DEPARTMENTS.find((d) => d.id === selectedDept)
      if (!dept) return '부서를 선택해주세요.'

      const matched = dept.keywords.some((k) => text.includes(k))
      const response = dept.responses[Math.floor(Math.random() * dept.responses.length)]

      if (matched) return response
      return `[${dept.name} RAG 검색 중...]\n\n${response}\n\n더 구체적인 질문을 해주시면 정확한 답변을 드립니다.`
    },
    [selectedDept],
  )

  const send = useCallback(() => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setInput('')
    setLoading(true)

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: getResponse(userMsg) }])
      setLoading(false)
    }, 600 + Math.random() * 600)
  }, [input, loading, getResponse])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-float transition-transform hover:scale-105"
      >
        <span
          className="material-symbols-outlined text-[24px]"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
        >
          smart_toy
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-float">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-tertiary" />
          <span className="font-headline text-[14px] font-bold text-on-surface">AI 어시스턴트</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
          >
            close
          </span>
        </button>
      </div>

      {/* Department Selector */}
      <div className="flex gap-1 overflow-x-auto border-b border-outline-variant/15 px-3 py-2">
        {DEPARTMENTS.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDept(d.id)}
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-body text-[11px] transition-colors ${
              selectedDept === d.id
                ? 'bg-primary/[0.08] font-semibold text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 14" }}
            >
              {d.icon}
            </span>
            {d.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 font-body text-[13px] leading-6 ${
              m.role === 'user'
                ? 'self-end rounded-br-sm bg-primary/[0.08] text-on-surface'
                : 'self-start rounded-bl-sm bg-surface-container-low text-on-surface'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="self-start rounded-xl rounded-bl-sm bg-surface-container-low px-3.5 py-2.5 font-body text-[13px] text-on-surface-variant">
            분석 중...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t border-outline-variant/15 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          placeholder={`${DEPARTMENTS.find((d) => d.id === selectedDept)?.name ?? ''}에 질문하기...`}
          className="flex-1 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3.5 py-2.5 font-body text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          onClick={send}
          className="rounded-xl bg-primary px-4 py-2.5 font-body text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary/90"
        >
          전송
        </button>
      </div>
    </div>
  )
}
