import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { AuthenticationError } from "@/lib/app-error";
import { apiError } from "@/lib/api-error";
import { getClientIp } from "@/lib/get-ip";
import { canResendOtp, generateOtpCode, maskPhone, storeOtp } from "@/lib/mfa";
import { rateLimitPublic } from "@/lib/rate-limit";
import { logStructured } from "@/lib/request-context";
import { sendSms } from "@/services/sms.service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getLoginUser(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new AuthenticationError("인증 구성을 확인할 수 없습니다.");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (bearerToken) {
    const tokenClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await tokenClient.auth.getUser(bearerToken);
    if (error || !data.user) throw new AuthenticationError();
    return data.user;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {},
      remove(_name: string, _options: CookieOptions) {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthenticationError();
  return data.user;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = await rateLimitPublic(ip, "send-login-otp");
  if (limited) return limited;

  try {
    const user = await getLoginUser(request);

    const { canResend, waitMs } = canResendOtp(user.id);
    if (!canResend) {
      return NextResponse.json(
        { error: `${Math.ceil(waitMs / 1000)}초 후 다시 시도해 주세요.`, waitMs },
        { status: 429 }
      );
    }

    const role = user.app_metadata?.role as string | undefined;
    let phone: string | null = null;

    if (role === "agency_admin") {
      const agencyId = user.app_metadata?.agency_id as string | undefined;
      if (agencyId) {
        const { data: agency } = await supabaseAdmin
          .from("agencies")
          .select("phone")
          .eq("id", agencyId)
          .single();
        phone = agency?.phone ?? null;
      }
    } else if (role === "provider_admin") {
      phone = (user.user_metadata?.phone as string | undefined) ?? process.env.ADMIN_PHONE ?? null;
    }

    if (!phone) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "등록된 전화번호가 없습니다. 관리자에게 문의해 주세요." },
          { status: 403 }
        );
      }

      return NextResponse.json({
        skip: true,
        message: "개발 환경에서는 등록된 전화번호가 없어 OTP 발송을 건너뜁니다.",
      });
    }

    const code = generateOtpCode();
    storeOtp(user.id, code, phone);

    const smsResult = await sendSms({
      to: phone,
      text: `[logiSSign] 로그인 인증번호: ${code} (5분 내 입력)`,
    });

    if (!smsResult.sent) {
      logStructured("error", "mfa_sms_send_failed", {
        userId: user.id,
        role,
        ip,
        message: smsResult.error,
      });
      return NextResponse.json(
        { error: "SMS 발송에 실패했습니다. 등록된 전화번호를 확인해 주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sent: true,
      maskedPhone: maskPhone(phone),
    });
  } catch (error) {
    return apiError(error, 500, "인증번호 발송 중 오류가 발생했습니다.", request);
  }
}
