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

export default function AdminLoginPage() {
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

      // ⚠️ 보안: app_metadata 우선 사용 (user_metadata는 클라이언트에서 조작 가능)
      const role = (data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as string | undefined;

      if (role !== "provider_admin") {
        setForm((prev) => ({
          ...prev,
          isLoading: false,
          error: "슈퍼 관리자 권한이 없는 계정입니다.",
        }));
        await supabase.auth.signOut();
        return;
      }

      router.push("/admin/dashboard");
    } catch {
      setForm((prev) => ({
        ...prev,
        isLoading: false,
        error: "로그인 중 오류가 발생했습니다.",
      }));
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Brand Panel — Super Admin */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-sidebar flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] rounded-full bg-primary-container/15 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <img src="/logo.png" alt="logiSSign" className="w-[320px] object-contain mb-8" />
          <h1 className="font-headline text-4xl font-bold text-white tracking-tight mb-2">
            &nbsp;
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-white/80 tracking-wider uppercase">Super Admin</span>
          </div>
          <p className="font-korean text-lg text-white/50">
            SaaS 플랫폼 전체 관리 시스템
          </p>
          <span className="text-white/20 text-sm font-data tracking-widest mt-12">v2.0</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center bg-surface-container-lowest px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo-light.png" alt="logiSSign" className="w-[160px] object-contain" />
          </div>

          <h2 className="font-headline text-xl font-bold text-on-surface mb-1">관리자 로그인</h2>
          <p className="text-sm text-on-surface-variant mb-8">플랫폼 운영 관리자 계정으로 로그인하세요</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="관리자 이메일"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body text-sm"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <input
                type={form.showPassword ? "text" : "password"}
                placeholder="비밀번호"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full h-12 pl-11 pr-12 rounded-2xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {form.showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
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

            {form.error && (
              <p className="text-error text-sm font-body px-1">{form.error}</p>
            )}

            <button
              type="submit"
              disabled={form.isLoading}
              className="w-full h-12 rounded-full bg-sidebar text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all hover:bg-sidebar/90 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {form.isLoading ? "로그인 중..." : "관리자 로그인"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
              ← 역할 선택으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
