import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { AuthenticationError, AuthorizationError, AppError } from "@/lib/app-error";
import { apiError } from "@/lib/api-error";
import { getClientIp } from "@/lib/get-ip";
import { logAuthFailure, logPermissionDenied } from "@/lib/security-logger";
import { getRequestId, logStructured } from "@/lib/request-context";

interface AuthResult {
  userId: string;
  agencyId: string;
  role: string;
}

async function getUserFromRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      user: null,
      error: apiError(
        new AppError("Supabase 설정이 누락되었습니다", {
          status: 500,
          code: "service_unavailable",
          expose: process.env.NODE_ENV !== "production",
        }),
        500,
        "서비스 설정 오류가 발생했습니다",
        request
      ),
    };
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
    if (error || !data.user) {
      return {
        user: null,
        error: apiError(new AuthenticationError(), 401, "인증이 필요합니다", request),
      };
    }
    return { user: data.user, error: null };
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
  if (error || !data.user) {
    return {
      user: null,
      error: apiError(new AuthenticationError(), 401, "인증이 필요합니다", request),
    };
  }

  return { user: data.user, error: null };
}

export async function authenticateRequest(
  request: NextRequest
): Promise<{ auth: AuthResult | null; error: NextResponse | null }> {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    void logAuthFailure(
      getClientIp(request),
      request.nextUrl.pathname,
      "missing_or_invalid_session"
    );
    return { auth: null, error };
  }

  const role = (user.app_metadata?.role as string) ?? "";
  const agencyId = (user.app_metadata?.agency_id as string) ?? "";

  if (!role || !agencyId) {
    void logPermissionDenied(user.id, getClientIp(request), request.nextUrl.pathname);
    return {
      auth: null,
      error: apiError(
        new AuthorizationError("계정 메타데이터가 올바르지 않습니다. 관리자에게 문의해 주세요."),
        403,
        "권한 확인에 실패했습니다",
        request
      ),
    };
  }

  return {
    auth: {
      userId: user.id,
      agencyId,
      role,
    },
    error: null,
  };
}

export async function authenticateAdmin(
  request: NextRequest
): Promise<{ auth: AuthResult | null; error: NextResponse | null }> {
  const { auth, error } = await authenticateRequest(request);
  if (error || !auth) return { auth, error };

  if (!["provider_admin", "agency_admin"].includes(auth.role)) {
    void logPermissionDenied(auth.userId, getClientIp(request), request.nextUrl.pathname);
    return {
      auth: null,
      error: apiError(
        new AuthorizationError("관리자 권한이 필요합니다"),
        403,
        "관리자 권한이 필요합니다",
        request
      ),
    };
  }

  return { auth, error: null };
}

export function authenticateCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const requestId = getRequestId(request);

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      logStructured("error", "cron_secret_missing", {
        requestId,
        path: request.nextUrl.pathname,
      });
      return apiError(
        new AppError("CRON_SECRET 환경변수가 누락되었습니다", {
          status: 500,
          code: "service_unavailable",
          expose: false,
        }),
        500,
        "서버 설정 오류가 발생했습니다",
        request
      );
    }

    logStructured("warn", "cron_secret_missing_dev", {
      requestId,
      path: request.nextUrl.pathname,
    });
    return null;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  const aBuffer = Buffer.from(authHeader.padEnd(256, "\0"));
  const bBuffer = Buffer.from(expected.padEnd(256, "\0"));

  const lengthMatches = authHeader.length === expected.length;
  let contentMatches = true;
  try {
    contentMatches = timingSafeEqual(aBuffer, bBuffer);
  } catch {
    contentMatches = false;
  }

  if (!lengthMatches || !contentMatches) {
    void logAuthFailure(getClientIp(request), request.nextUrl.pathname, "invalid_cron_secret");
    return apiError(new AuthenticationError("Unauthorized"), 401, "Unauthorized", request);
  }

  return null;
}
