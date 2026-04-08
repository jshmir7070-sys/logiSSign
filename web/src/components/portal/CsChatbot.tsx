'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlan } from '@/contexts/PlanContext'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  category?: string
  timestamp: string
}

type CsCategory =
  | 'payment'
  | 'contract'
  | 'settlement'
  | 'driver'
  | 'plan'
  | 'account'
  | 'bug'
  | 'feedback'
  | 'other'

interface CategoryItem {
  id: CsCategory
  label: string
  icon: string
  desc: string
}

const CATEGORIES: CategoryItem[] = [
  { id: 'payment', label: '결제/요금', icon: 'credit_card', desc: '결제 오류, 환불, 요금 문의' },
  { id: 'contract', label: '계약서', icon: 'description', desc: '발송, 서명, 템플릿' },
  { id: 'settlement', label: '정산', icon: 'calculate', desc: '엑셀 업로드, 단가, 세금계산서' },
  { id: 'driver', label: '기사 관리', icon: 'person', desc: '등록, 앱 연동, 초대' },
  { id: 'plan', label: '플랜/업그레이드', icon: 'upgrade', desc: '플랜 변경, 한도, 할인' },
  { id: 'account', label: '계정/설정', icon: 'settings', desc: '비밀번호, 관리자, 도장' },
  { id: 'bug', label: '오류 신고', icon: 'bug_report', desc: '버그, 오작동 신고' },
  { id: 'feedback', label: '건의/피드백', icon: 'lightbulb', desc: '기능 제안, 개선 요청' },
]

function timeStr(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function CsChatbot() {
  const { companyName } = usePlan()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CsCategory>('other')
  const [showCategories, setShowCategories] = useState(true)
  const [meta, setMeta] = useState<{ driverCount: number; isDedicatedSupport: boolean } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 초기 인사
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = `안녕하세요, ${companyName || '고객'}님!\n로지사인 고객지원 센터입니다.\n\n아래에서 문의 카테고리를 선택하시거나, 바로 질문을 입력해주세요.`
      setMessages([{ role: 'assistant', content: greeting, timestamp: timeStr() }])
    }
  }, [open, messages.length, companyName])

  const send = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim()
      if (!msg || loading) return

      setInput('')
      setShowCategories(false)
      setMessages((prev) => [...prev, { role: 'user', content: msg, category: selectedCategory, timestamp: timeStr() }])
      setLoading(true)

      try {
        const response = await fetch('/api/cs-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, category: selectedCategory }),
        })

        if (!response.ok) {
          const errPayload = await response.json()
          throw new Error(errPayload.error || '응답을 받지 못했습니다.')
        }

        const data = await response.json()
        setMeta(data.meta ?? null)

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response, category: data.category, timestamp: timeStr() },
        ])

        if (data.category && data.category !== selectedCategory) {
          setSelectedCategory(data.category)
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: err instanceof Error ? err.message : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            timestamp: timeStr(),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [input, loading, selectedCategory],
  )

  const handleCategorySelect = useCallback(
    (cat: CategoryItem) => {
      setSelectedCategory(cat.id)
      setShowCategories(false)
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `[${cat.label}] 카테고리가 선택되었습니다.`, timestamp: timeStr() },
        {
          role: 'assistant',
          content: `${cat.label} 관련 문의를 도와드리겠습니다.\n${cat.desc}에 대해 궁금한 점을 입력해주세요.`,
          timestamp: timeStr(),
        },
      ])
    },
    [],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Quick actions
  const quickActions = [
    { label: '결제 오류', msg: '결제가 실패했어요', cat: 'payment' as CsCategory },
    { label: '계약서 재발송', msg: '계약서 재발송하고 싶어요', cat: 'contract' as CsCategory },
    { label: '정산 오류', msg: '정산 금액이 맞지 않아요', cat: 'settlement' as CsCategory },
    { label: '플랜 변경', msg: '플랜을 업그레이드하고 싶어요', cat: 'plan' as CsCategory },
  ]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-float transition-transform hover:scale-105"
        aria-label="고객지원 챗봇 열기"
      >
        <span
          className="material-symbols-outlined text-[24px]"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
        >
          support_agent
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[580px] w-[420px] flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-float">
      {/* Header */}
      <div className="flex items-center justify-between bg-primary px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-[22px] text-on-primary"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 22" }}
          >
            support_agent
          </span>
          <div>
            <p className="font-headline text-[14px] font-bold text-on-primary">고객지원 센터</p>
            <p className="font-body text-[10px] text-on-primary/70">
              {meta?.isDedicatedSupport ? '전담 에이전트 응답' : 'AI 에이전트 응답'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meta?.isDedicatedSupport && (
            <span className="rounded-full bg-on-primary/20 px-2 py-0.5 font-body text-[10px] font-semibold text-on-primary">
              VIP
            </span>
          )}
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-primary/80 hover:bg-on-primary/10"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
            >
              close
            </span>
          </button>
        </div>
      </div>

      {/* Category Selector (selected state) */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-outline-variant/15 px-3 py-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat)}
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 font-body text-[10px] transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary/[0.08] font-semibold text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span
              className="material-symbols-outlined text-[13px]"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 13" }}
            >
              {cat.icon}
            </span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {/* Category Cards (initial state) */}
        {showCategories && messages.length <= 1 && (
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat)}
                className="flex items-start gap-2 rounded-xl border border-outline-variant/15 p-3 text-left transition-colors hover:bg-surface-container-low"
              >
                <span
                  className="material-symbols-outlined mt-0.5 text-[18px] text-primary"
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
                >
                  {cat.icon}
                </span>
                <div>
                  <p className="font-body text-[12px] font-semibold text-on-surface">{cat.label}</p>
                  <p className="font-body text-[10px] text-on-surface-variant">{cat.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="flex flex-col">
            {m.role === 'system' ? (
              <div className="self-center rounded-full bg-surface-container-low px-3 py-1 font-body text-[10px] text-on-surface-variant">
                {m.content}
              </div>
            ) : (
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 font-body text-[12px] leading-5 ${
                  m.role === 'user'
                    ? 'self-end rounded-br-sm bg-primary text-on-primary'
                    : 'self-start rounded-bl-sm bg-surface-container-low text-on-surface'
                }`}
              >
                {m.content}
              </div>
            )}
            <span
              className={`mt-0.5 font-body text-[9px] text-on-surface-variant/50 ${
                m.role === 'user' ? 'self-end' : m.role === 'system' ? 'self-center' : 'self-start'
              }`}
            >
              {m.timestamp}
            </span>
          </div>
        ))}

        {loading && (
          <div className="self-start rounded-xl rounded-bl-sm bg-surface-container-low px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-surface-variant/40" />
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-surface-variant/40" style={{ animationDelay: '0.2s' }} />
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-surface-variant/40" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {!showCategories && messages.length <= 3 && !loading && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => {
                  setSelectedCategory(qa.cat)
                  void send(qa.msg)
                }}
                className="rounded-lg border border-primary/20 bg-primary/[0.04] px-2.5 py-1.5 font-body text-[11px] text-primary transition-colors hover:bg-primary/[0.08]"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-outline-variant/15 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="문의 내용을 입력해주세요..."
            className="flex-1 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3.5 py-2.5 font-body text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-primary px-4 py-2.5 font-body text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            전송
          </button>
        </div>
        <p className="mt-1.5 font-body text-[9px] text-on-surface-variant/50">
          {meta?.isDedicatedSupport
            ? `${companyName} 전담 에이전트 · 기사 ${meta.driverCount}명 · 우선 처리`
            : 'AI 에이전트가 24시간 응답합니다'}
        </p>
      </div>
    </div>
  )
}
