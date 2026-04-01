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
  const router = useRouter();
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

      const role = data.user?.user_metadata?.role as string | undefined;
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
    } catch {
      setForm((prev) => ({
        ...prev,
        isLoading: false,
        error: "로그인 중 오류가 발생했습니다.",
      }));
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-power-gradient flex items-center justify-center mb-5 shadow-ambient">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-headline text-2xl font-bold text-on-surface tracking-tight">
            Precision Velocity
          </h1>
          <p className="font-korean text-sm text-on-surface-variant mt-1">
            배송 대리점 전산 관리 시스템
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

          {/* Links */}
          <div className="flex items-center justify-between mt-5">
            <button type="button" className="text-xs text-on-surface-variant hover:text-primary transition-colors">
              비밀번호 찾기
            </button>
            <Link href="/portal/signup" className="text-xs text-primary font-medium hover:underline">
              회원가입 →
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-on-surface-variant/40 mt-8 font-data">
          © 2026 Precision Velocity. All rights reserved.
        </p>
      </div>
    </div>
  );
}
