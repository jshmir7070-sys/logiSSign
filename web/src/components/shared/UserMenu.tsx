'use client';

import { useState, useRef, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface UserMenuProps {
  initials: string;
  name?: string;
  email?: string;
  redirectTo: string;
}

export default function UserMenu({ initials, name, email, redirectTo }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    // MFA 쿠키 삭제 (httpOnly이므로 서버에서도 삭제하지만, 경로 이동으로 처리)
    document.cookie = '__logissign_mfa=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.replace(redirectTo);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-power-gradient flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <span className="text-white text-xs font-bold">{initials}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-surface-container-lowest rounded-2xl shadow-float py-2 z-50">
          {(name || email) && (
            <div className="px-4 py-3">
              {name && <p className="text-sm font-medium text-on-surface font-korean truncate">{name}</p>}
              {email && <p className="text-xs text-on-surface-variant truncate">{email}</p>}
            </div>
          )}
          {(name || email) && <div className="h-px bg-surface-container-high mx-2" />}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-surface-container-low transition-colors flex items-center gap-2 font-korean"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
