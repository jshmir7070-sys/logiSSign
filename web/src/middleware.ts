import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { csrfCheck } from "@/lib/csrf";
import { getFeatureForRoute, hasFeature } from "@/lib/plan-limits";
import { MFA_COOKIE, verifyMfaToken } from "@/lib/mfa";
import {
  REQUEST_ID_HEADER,
  SESSION_ACTIVITY_COOKIE,
  createRequestHeaders,
  getRequestId,
  getSessionIdleTimeoutMs,
  isSessionIdle,
  logStructured,
} from "@/lib/request-context";

const PUBLIC_ROUTES = [
  "/",
  "/coming-soon",
  "/about",
  "/pricing",
  "/terms",
  "/privacy",
  "/admin/login",
  "/admin/verify-otp",
  "/portal/login",
  "/portal/verify-otp",
  "/portal/signup",
  "/portal/find-id",
  "/portal/reset-password",
  "/verify",
  "/verify-identity",
  "/api/verify",
  "/api/auth/signup",
  "/api/auth/driver-signup",
  "/api/auth/find-id",
  "/api/auth/reset-password",
  "/api/auth/send-login-otp",
  "/api/auth/verify-login-otp",
  "/api/cron",
  "/api/health",
  "/api/beta-apply",
  "/_next",
  "/favicon.ico",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
}

function addNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  return response;
}

function addRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function clearSecurityCookies(response: NextResponse) {
  response.cookies.delete(MFA_COOKIE);
  response.cookies.delete(SESSION_ACTIVITY_COOKIE);
}

function setActivityCookie(response: NextResponse) {
  response.cookies.set(SESSION_ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(getSessionIdleTimeoutMs() / 1000),
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = createRequestHeaders(request);
  const requestId = getRequestId(requestHeaders);

  const csrfBlocked = csrfCheck(request);
  if (csrfBlocked) {
    addRequestIdHeader(csrfBlocked, requestId);
    return csrfBlocked;
  }

  if (isPublicRoute(pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    addRequestIdHeader(response, requestId);
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey || supabaseUrl === "your-project-url") {
    if (process.env.NODE_ENV === "production") {
      const response = NextResponse.json({ error: "Service configuration error" }, { status: 503 });
      addRequestIdHeader(response, requestId);
      return response;
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    addRequestIdHeader(response, requestId);
    return response;
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const isAdminRoute = pathname.startsWith("/admin");
  const isPortalRoute = pathname.startsWith("/portal");
  const isApiRoute = pathname.startsWith("/api");
  const hasBearerToken = request.headers.get("authorization")?.startsWith("Bearer ") ?? false;

  if (userError || !user) {
    logStructured("warn", "auth_missing", {
      requestId,
      path: pathname,
      method: request.method,
    });

    if (isApiRoute) {
      const apiResponse = NextResponse.json({ error: "인증이 필요합니다", requestId }, { status: 401 });
      addRequestIdHeader(apiResponse, requestId);
      return apiResponse;
    }

    const loginPath = isAdminRoute ? "/admin/login" : isPortalRoute ? "/portal/login" : "/";
    const redirect = NextResponse.redirect(new URL(loginPath, request.url));
    clearSecurityCookies(redirect);
    addRequestIdHeader(addNoCacheHeaders(redirect), requestId);
    return redirect;
  }

  if (!hasBearerToken && isSessionIdle(request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value)) {
    logStructured("warn", "session_idle_timeout", {
      requestId,
      path: pathname,
      method: request.method,
      userId: user.id,
    });

    if (isApiRoute) {
      const timeoutResponse = NextResponse.json(
        { error: "세션이 만료되었습니다. 다시 로그인해 주세요.", requestId },
        { status: 401 }
      );
      clearSecurityCookies(timeoutResponse);
      addRequestIdHeader(timeoutResponse, requestId);
      return timeoutResponse;
    }

    const loginPath = isAdminRoute ? "/admin/login" : "/portal/login";
    const redirect = NextResponse.redirect(new URL(loginPath, request.url));
    clearSecurityCookies(redirect);
    addRequestIdHeader(addNoCacheHeaders(redirect), requestId);
    return redirect;
  }

  const role = (user.app_metadata?.role as string | undefined) ?? "";

  if ((isAdminRoute || isPortalRoute || isApiRoute) && !hasBearerToken) {
    const mfaToken = request.cookies.get(MFA_COOKIE)?.value;
    const mfaValid = mfaToken ? await verifyMfaToken(mfaToken, user.id) : false;

    if (!mfaValid) {
      logStructured("warn", "mfa_required", {
        requestId,
        path: pathname,
        method: request.method,
        userId: user.id,
      });

      if (isApiRoute) {
        const mfaResponse = NextResponse.json({ error: "MFA 인증이 필요합니다", requestId }, { status: 403 });
        addRequestIdHeader(mfaResponse, requestId);
        return mfaResponse;
      }

      const loginPath = isAdminRoute ? "/admin/login" : "/portal/login";
      const redirect = NextResponse.redirect(new URL(loginPath, request.url));
      clearSecurityCookies(redirect);
      addRequestIdHeader(addNoCacheHeaders(redirect), requestId);
      return redirect;
    }
  }

  if (isAdminRoute && role !== "provider_admin") {
    const redirect =
      role === "agency_admin"
        ? NextResponse.redirect(new URL("/portal/dashboard", request.url))
        : NextResponse.redirect(new URL("/admin/login", request.url));
    addRequestIdHeader(addNoCacheHeaders(redirect), requestId);
    return redirect;
  }

  if (isPortalRoute && role !== "agency_admin") {
    const redirect =
      role === "provider_admin"
        ? NextResponse.redirect(new URL("/admin/dashboard", request.url))
        : NextResponse.redirect(new URL("/portal/login", request.url));
    addRequestIdHeader(addNoCacheHeaders(redirect), requestId);
    return redirect;
  }

  if (isPortalRoute) {
    const plan = user.app_metadata?.plan as string | undefined;
    const feature = getFeatureForRoute(pathname);
    if (feature && !hasFeature(plan, feature)) {
      const redirect = NextResponse.redirect(
        new URL("/portal/settings?tab=billing&upgrade=1", request.url)
      );
      addRequestIdHeader(addNoCacheHeaders(redirect), requestId);
      return redirect;
    }
  }

  setActivityCookie(response);
  addRequestIdHeader(addNoCacheHeaders(response), requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
