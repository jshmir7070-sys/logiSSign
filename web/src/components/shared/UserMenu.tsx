'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'

interface UserMenuProps {
  initials: string
  name?: string
  email?: string
  redirectTo: string
}

export default function UserMenu({ initials, name, email, redirectTo }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    document.cookie = '__logissign_mfa=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = '__logissign_activity=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    window.location.replace(redirectTo)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-power-gradient transition-opacity hover:opacity-90"
      >
        <span className="text-xs font-bold text-white">{initials}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-2xl bg-surface-container-lowest py-2 shadow-float">
          {(name || email) && (
            <div className="px-4 py-3">
              {name && <p className="truncate font-korean text-sm font-medium text-on-surface">{name}</p>}
              {email && <p className="truncate text-xs text-on-surface-variant">{email}</p>}
            </div>
          )}
          {(name || email) && <div className="mx-2 h-px bg-surface-container-high" />}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-korean text-sm text-error transition-colors hover:bg-surface-container-low"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
