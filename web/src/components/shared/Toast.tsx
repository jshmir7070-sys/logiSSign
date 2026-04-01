'use client'

import { useEffect, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

let addToastFn: ((type: ToastType, message: string) => void) | null = null

/**
 * 글로벌 toast 호출 함수
 * 컴포넌트 밖에서도 호출 가능 (서비스 레이어 등)
 */
export function toast(type: ToastType, message: string) {
  if (addToastFn) {
    addToastFn(type, message)
  } else {
    // fallback — 아직 마운트 안 된 경우
    console.warn(`[Toast] ${type}: ${message}`)
  }
}

export function toastSuccess(message: string) { toast('success', message) }
export function toastError(message: string) { toast('error', message) }
export function toastWarning(message: string) { toast('warning', message) }

const typeConfig: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-green-50', icon: '✅', border: 'border-green-200' },
  error: { bg: 'bg-red-50', icon: '❌', border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', icon: '⚠️', border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', icon: 'ℹ️', border: 'border-blue-200' },
}

/**
 * Toast 컨테이너 — layout.tsx에 한 번만 배치
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => {
        const cfg = typeConfig[t.type]
        return (
          <div
            key={t.id}
            className={`${cfg.bg} ${cfg.border} border rounded-xl px-4 py-3 shadow-card animate-slide-in flex items-start gap-2`}
          >
            <span className="text-sm shrink-0">{cfg.icon}</span>
            <p className="text-sm text-on-surface font-korean leading-snug">{t.message}</p>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="ml-auto text-on-surface-variant hover:text-on-surface text-lg leading-none shrink-0"
            >
              ×
            </button>
          </div>
        )
      })}
      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </div>
  )
}
