"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OtpVerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/portal/dashboard";
  const userId = params.get("uid") || "";
  const phone = params.get("phone") || "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 카운트다운 타이머
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // 첫 번째 입력란에 자동 포커스
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    setError(null);

    // 다음 칸으로 자동 이동
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setError("6자리 인증번호를 모두 입력해주세요.");
      return;
    }

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
        // 틀린 코드 → 전체 선택
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      // MFA 쿠키 발급됨 → 대시보드 이동
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
      if (!res.ok) {
        setError(data.error || "재발송 실패");
      }
    } catch {
      setError("재발송 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-light.png" alt="logiSSign" className="w-[220px] object-contain mb-4" />
        </div>

        {/* OTP Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
          {/* 자물쇠 아이콘 */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          <h2 className="font-headline text-lg font-bold text-on-surface text-center mb-2">
            본인인증
          </h2>
          <p className="text-sm text-on-surface-variant text-center mb-1 font-korean">
            등록된 휴대폰으로 인증번호를 발송했습니다.
          </p>
          {phone && (
            <p className="text-sm text-primary font-semibold text-center mb-6 font-data">
              {phone}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            {/* 6자리 OTP 입력 */}
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
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow font-data"
                />
              ))}
            </div>

            {error && (
              <p className="text-error text-xs text-center mb-4 font-body">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || digits.some((d) => !d)}
              className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "확인 중..." : "인증 확인"}
            </button>
          </form>

          {/* 재발송 */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40 font-korean"
            >
              {resendCooldown > 0
                ? `인증번호 재발송 (${resendCooldown}초)`
                : "인증번호 재발송"}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-on-surface-variant/40 mt-6 font-data">
          © 2026 logiSSign. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">로딩 중...</p>
      </div>
    }>
      <OtpVerifyForm />
    </Suspense>
  );
}
