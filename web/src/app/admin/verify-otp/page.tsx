"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AdminOtpVerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/admin/dashboard";
  const userId = params.get("uid") || "";
  const phone = params.get("phone") || "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    setError(null);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) { setError("6자리 인증번호를 모두 입력해주세요."); return; }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "인증에 실패했습니다.");
        setIsLoading(false);
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      window.location.replace(redirect);
    } catch {
      setError("인증 처리 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(30);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "재발송 실패");
    } catch { setError("재발송 중 오류가 발생했습니다."); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-sidebar flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <img src="/logo.png" alt="logiSSign" className="w-[280px] object-contain mb-6" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-white/80 tracking-wider uppercase">2-Step Verification</span>
          </div>
          <p className="font-korean text-sm text-white/50">본인인증 단계</p>
        </div>
      </div>

      {/* Right OTP Form */}
      <div className="flex-1 flex items-center justify-center bg-surface-container-lowest px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          <h2 className="font-headline text-xl font-bold text-on-surface text-center mb-2">관리자 본인인증</h2>
          <p className="text-sm text-on-surface-variant text-center mb-1">등록된 휴대폰으로 인증번호를 발송했습니다.</p>
          {phone && <p className="text-sm text-primary font-semibold text-center mb-6 font-data">{phone}</p>}

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold rounded-2xl bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow font-data"
                />
              ))}
            </div>

            {error && <p className="text-error text-sm text-center mb-4 font-body">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || digits.some((d) => !d)}
              className="w-full h-12 rounded-full bg-sidebar text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all hover:bg-sidebar/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "확인 중..." : "인증 확인"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button type="button" onClick={handleResend} disabled={resendCooldown > 0}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40 font-korean">
              {resendCooldown > 0 ? `인증번호 재발송 (${resendCooldown}초)` : "인증번호 재발송"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminVerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-on-surface-variant">로딩 중...</p></div>}>
      <AdminOtpVerifyForm />
    </Suspense>
  );
}
