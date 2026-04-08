"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isDefaultAdminPassword, requiresAdminPasswordSetup } from "@/lib/admin-password-policy";
import { createBrowserSupabaseClient } from "@/lib/supabase";

interface LoginFormState {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  showPassword: boolean;
}

interface OtpState {
  show: boolean;
  userId: string;
  redirectPath: string;
  maskedPhone: string;
  digits: string[];
  error: string | null;
  isVerifying: boolean;
  resendCooldown: number;
  expireTimer: number;
  accessToken: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormState>({
    email: "", password: "", isLoading: false, error: null, showPassword: false,
  });
  const [otp, setOtp] = useState<OtpState>({
    show: false, userId: "", redirectPath: "", maskedPhone: "", digits: ["", "", "", "", "", ""],
    error: null, isVerifying: false, resendCooldown: 0, expireTimer: 180, accessToken: '',
  });
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!otp.show || otp.expireTimer <= 0) return;
    const t = setTimeout(() => setOtp((p) => ({ ...p, expireTimer: p.expireTimer - 1 })), 1000);
    return () => clearTimeout(t);
  }, [otp.show, otp.expireTimer]);

  useEffect(() => { if (otp.show) otpRefs.current[0]?.focus(); }, [otp.show]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForm((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });

      if (error) { setForm((prev) => ({ ...prev, isLoading: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." })); return; }

      const role = (data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as string | undefined;
      if (role !== "provider_admin") {
        setForm((prev) => ({ ...prev, isLoading: false, error: "슈퍼 관리자 권한이 없는 계정입니다." }));
        await supabase.auth.signOut();
        return;
      }

      const shouldForcePasswordSetup =
        requiresAdminPasswordSetup(data.user) || isDefaultAdminPassword(form.password);

      if (shouldForcePasswordSetup) {
        await supabase.auth.updateUser({
          data: {
            ...(data.user?.user_metadata ?? {}),
            must_change_password: true,
          },
        });
      }

      const userId = data.user!.id;
      const accessToken = data.session?.access_token || '';
      const redirectPath = shouldForcePasswordSetup ? "/admin/setup-password?required=1" : "/admin/dashboard";
      try {
        const otpRes = await fetch("/api/auth/send-login-otp", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` }, body: JSON.stringify({ userId }) });
        const otpData = await otpRes.json();
        if (otpData.skip) { router.push(redirectPath); return; }
        setForm((prev) => ({ ...prev, isLoading: false }));
        setOtp({ show: true, userId, redirectPath, accessToken, maskedPhone: otpData.maskedPhone || "", digits: ["", "", "", "", "", ""], error: null, isVerifying: false, resendCooldown: 0, expireTimer: 180 });
      } catch { router.push(redirectPath); }
    } catch {
      setForm((prev) => ({ ...prev, isLoading: false, error: "로그인 중 오류가 발생했습니다." }));
    }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...otp.digits]; next[i] = v.slice(-1);
    setOtp((p) => ({ ...p, digits: next, error: null }));
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp.digits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!p) return;
    const next = [...otp.digits]; for (let i = 0; i < 6; i++) next[i] = p[i] || "";
    setOtp((s) => ({ ...s, digits: next }));
    otpRefs.current[Math.min(p.length, 5)]?.focus();
  };

  const handleOtpSubmit = async () => {
    const code = otp.digits.join("");
    if (code.length !== 6) { setOtp((p) => ({ ...p, error: "6자리 인증번호를 모두 입력해주세요." })); return; }
    setOtp((p) => ({ ...p, isVerifying: true, error: null }));
    try {
      const res = await fetch("/api/auth/verify-login-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: otp.userId, code }) });
      const data = await res.json();
      if (!res.ok) { setOtp((p) => ({ ...p, isVerifying: false, error: data.error || "인증 실패", digits: ["", "", "", "", "", ""] })); otpRefs.current[0]?.focus(); return; }
      window.location.replace(otp.redirectPath || "/admin/dashboard");
    } catch { setOtp((p) => ({ ...p, isVerifying: false, error: "인증 처리 중 오류" })); }
  };

  const handleResend = async () => {
    setOtp((p) => ({ ...p, expireTimer: 180, error: null }));
    try {
      const res = await fetch("/api/auth/send-login-otp", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${otp.accessToken}` }, body: JSON.stringify({ userId: otp.userId }) });
      const data = await res.json();
      if (!res.ok) setOtp((p) => ({ ...p, error: data.error || "재발송 실패" }));
    } catch { setOtp((p) => ({ ...p, error: "재발송 중 오류" })); }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-sidebar flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] rounded-full bg-primary-container/15 blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="logiSSign" className="w-[320px] object-contain mb-8" />
          <h1 className="font-headline text-4xl font-bold text-white tracking-tight mb-2">&nbsp;</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-white/80 tracking-wider">플랫폼 관리자</span>
          </div>
          <p className="font-korean text-lg text-white/50">SaaS 플랫폼 전체 관리 시스템</p>
          <span className="text-white/20 text-sm font-data tracking-widest mt-12">v2.0</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center bg-surface-container-lowest px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-light.png" alt="logiSSign" className="w-[160px] object-contain" />
          </div>

          <h2 className="font-headline text-xl font-bold text-on-surface mb-1">관리자 로그인</h2>
          <p className="text-sm text-on-surface-variant mb-8">플랫폼 운영 관리자 계정으로 로그인하세요</p>

          <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-5">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              </div>
              <input type="text" name="admin_email_nofill" autoComplete="off" placeholder="관리자 이메일" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full h-12 pl-11 pr-4 rounded-2xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body text-sm" required />
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <input type={form.showPassword ? "text" : "password"} name="admin_pw_nofill" autoComplete="new-password" placeholder="비밀번호" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full h-12 pl-11 pr-12 rounded-2xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body text-sm" required />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, showPassword: !prev.showPassword }))} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {form.showPassword ? (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>) : (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>)}
                </svg>
              </button>
            </div>

            {form.error && <p className="text-error text-sm font-body px-1">{form.error}</p>}

            <button type="submit" disabled={form.isLoading} className="w-full h-12 rounded-full bg-sidebar text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all hover:bg-sidebar/90 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
              {form.isLoading ? "로그인 중..." : "관리자 로그인"}
            </button>
          </form>

          <div className="mt-8 space-y-3 text-center">
            <div className="flex items-center justify-center gap-4">
              <Link href="/admin/find-id" className="text-xs text-on-surface-variant hover:text-primary transition-colors">
                아이디 찾기
              </Link>
              <span className="text-on-surface-variant/30">|</span>
              <Link href="/admin/reset-password" className="text-xs text-on-surface-variant hover:text-primary transition-colors">
                비밀번호 재설정
              </Link>
            </div>
            <Link href="/" className="text-sm text-on-surface-variant hover:text-primary transition-colors">← 역할 선택으로 돌아가기</Link>
          </div>
        </div>
      </div>

      {/* ════════ OTP 인증 모달 ════════ */}
      {otp.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-[400px] mx-4 bg-surface-container-lowest rounded-2xl shadow-float p-8">
            <button type="button" onClick={() => { setOtp((p) => ({ ...p, show: false })); const supabase = createBrowserSupabaseClient(); supabase.auth.signOut(); }} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="닫기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>

            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
            </div>

            <h3 className="font-headline text-lg font-bold text-on-surface text-center mb-2">관리자 본인인증</h3>
            <p className="text-sm text-on-surface-variant text-center mb-1 font-korean">등록된 휴대폰으로 인증번호를 발송했습니다.</p>
            {otp.maskedPhone && <p className="text-sm text-primary font-semibold text-center mb-2 font-data">{otp.maskedPhone}</p>}
            <p className={`text-center text-sm font-data mb-5 ${otp.expireTimer <= 30 ? 'text-error' : 'text-on-surface-variant'}`}>
              {otp.expireTimer > 0 ? `${Math.floor(otp.expireTimer / 60)}:${(otp.expireTimer % 60).toString().padStart(2, '0')}` : '인증번호가 만료되었습니다'}
            </p>

            <div className="flex gap-2 justify-center mb-5" onPaste={handleOtpPaste}>
              {otp.digits.map((d, i) => (
                <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => { handleOtpKeyDown(i, e); if (e.key === "Enter" && otp.digits.every(Boolean)) handleOtpSubmit(); }}
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow font-data" />
              ))}
            </div>

            {otp.error && <p className="text-error text-xs text-center mb-4 font-body">{otp.error}</p>}

            <button type="button" onClick={handleOtpSubmit} disabled={otp.isVerifying || otp.digits.some((d) => !d) || otp.expireTimer <= 0} className="w-full h-11 rounded-xl bg-sidebar text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {otp.isVerifying ? "확인 중..." : "인증 확인"}
            </button>

            <div className="mt-3 text-center">
              <button type="button" onClick={handleResend} className="text-xs text-primary font-semibold hover:underline transition-colors font-korean">
                인증번호 재전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
