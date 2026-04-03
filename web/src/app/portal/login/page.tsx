"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";

interface LoginFormState {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  showPassword: boolean;
}

export default function PortalLoginPage() {
  const _router = useRouter();
  const [form, setForm] = useState<LoginFormState>({
    email: "",
    password: "",
    isLoading: false,
    error: null,
    showPassword: false,
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForm((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        setForm((prev) => ({
          ...prev,
          isLoading: false,
          error: "이메일 또는 비밀번호가 올바르지 않습니다.",
        }));
        return;
      }

      // ⚠️ 보안: app_metadata 우선 사용 (user_metadata는 클라이언트에서 조작 가능)
      const role = (data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as string | undefined;
      if (role !== "agency_admin") {
        setForm((prev) => ({
          ...prev,
          isLoading: false,
          error: "대리점 관리자 권한이 없는 계정입니다.",
        }));
        await supabase.auth.signOut();
        return;
      }

      window.location.replace("/portal/dashboard");
    } catch (err) {
      setForm((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? `오류: ${err.message}` : "로그인 중 알 수 없는 오류가 발생했습니다.",
      }));
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="logiSSign" className="h-14 object-contain mb-5" />
          <p className="font-korean text-sm text-on-surface-variant mt-1">
            택배 대리점 정산·전자계약 플랫폼
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-1">로그인</h2>
          <p className="text-sm text-on-surface-variant mb-6">대리점 관리자 계정으로 로그인하세요</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-label">이메일</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="example@company.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body text-sm"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-label">비밀번호</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={form.showPassword ? "text" : "password"}
                  placeholder="비밀번호 입력"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {form.showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {form.error && (
              <p className="text-error text-xs font-body">{form.error}</p>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={form.isLoading}
              className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {form.isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* 소셜 로그인 */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-outline-variant/20" />
              <span className="text-xs text-on-surface-variant/50 font-korean">간편 로그인</span>
              <div className="flex-1 h-px bg-outline-variant/20" />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signInWithOAuth({
                    provider: 'kakao',
                    options: { redirectTo: `${window.location.origin}/portal/dashboard` },
                  });
                }}
                className="flex-1 h-11 rounded-xl bg-[#FEE500] text-[#3C1E1E] font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.58 2 10.89c0 2.77 1.85 5.2 4.62 6.57-.16.57-.57 2.06-.66 2.38-.1.4.15.39.31.28.13-.08 2.04-1.38 2.87-1.94.6.09 1.22.13 1.86.13 5.52 0 10-3.58 10-7.99S17.52 3 12 3z"/></svg>
                카카오
              </button>
              <button
                type="button"
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/portal/dashboard` },
                  });
                }}
                className="flex-1 h-11 rounded-xl bg-white border border-outline-variant/30 text-on-surface font-semibold text-sm flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </button>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <Link href="/portal/find-id" className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">
              아이디 찾기
            </Link>
            <span className="text-on-surface-variant/30">|</span>
            <Link href="/portal/reset-password" className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">
              비밀번호 찾기
            </Link>
            <span className="text-on-surface-variant/30">|</span>
            <Link href="/portal/signup" className="text-xs text-primary font-medium hover:underline font-korean">
              회원가입
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-on-surface-variant/40 mt-8 font-data">
          © 2026 logiSSign. All rights reserved.
        </p>
      </div>
    </div>
  );
}
