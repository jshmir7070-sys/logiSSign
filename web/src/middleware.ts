import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { csrfCheck } from "@/lib/csrf";
import { getFeatureForRoute, hasFeature } from "@/lib/plan-limits";
import { verifyMfaToken, MFA_COOKIE } from "@/lib/mfa";

// 공개 경로: 인증 불필요
const PUBLIC_ROUTES = [
  "/",              // 메인 랜딩 페이지
  "/coming-soon",   // 레거시 (리디렉트 호환)
  "/about",         // 서비스 소개 페이지
  "/pricing",       // 요금제 비교 페이지
  "/terms",         // 이용약관
  "/privacy",       // 개인정보처리방침
  "/admin/login",   // 슈퍼관리자 로그인
  "/admin/verify-otp", // 슈퍼관리자 OTP 인증
  "/portal/login",  // 대리점 로그인
  "/portal/verify-otp", // 대리점 OTP 인증
  "/portal/signup", // 대리점 회원가입
  "/portal/find-id", // 아이디(이메일) 찾기
  "/portal/reset-password", // 비밀번호 초기화
  "/verify",        // 공개 진위확인 페이지
  "/api/verify",    // 공개 진위확인 API
  "/api/auth/signup", // 운영사 회원가입 API
  "/api/auth/driver-signup", // 기사 가입 API
  "/api/auth/find-id",      // 아이디 찾기 API
  "/api/auth/reset-password", // 비밀번호 초기화 API
  "/api/auth/send-login-otp", // OTP 발송 API
  "/api/auth/verify-login-otp", // OTP 검증 API
  "/api/cron",      // CRON (자체 시크릿 인증)
  "/api/health",    // 헬스체크 (인증 불필요)
  "/api/beta-apply", // 베타 테스트 신청 (공개)
  "/_next",
  "/favicon.ico",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
}

/**
 * 보안 헤더: 인증 필요 페이지에 캐시 방지 헤더 추가
 * → 브라우저 뒤로가기/재부팅 후 캐시된 페이지 접속 차단
 */
function addNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF 검사 (POST/PATCH/DELETE API 요청)
  const csrfBlocked = csrfCheck(request);
  if (csrfBlocked) return csrfBlocked;

  // 공개 경로는 통과
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Supabase 미설정 시 통과 (개발용)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey || supabaseUrl === "your-project-url") {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // ✅ 보안: getUser()는 서버에서 JWT를 재검증합니다 (getSession은 검증하지 않음)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const isAdminRoute = pathname.startsWith("/admin");
  const isPortalRoute = pathname.startsWith("/portal");
  const isApiRoute = pathname.startsWith("/api");

  // 미인증 → 각 섹션의 로그인 페이지로
  if (userError || !user) {
    if (isApiRoute) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }
    if (isAdminRoute) {
      const redir = NextResponse.redirect(new URL("/admin/login", request.url));
      // 세션 만료 시 MFA 쿠키도 삭제
      redir.cookies.delete(MFA_COOKIE);
      return addNoCacheHeaders(redir);
    }
    if (isPortalRoute) {
      const redir = NextResponse.redirect(new URL("/portal/login", request.url));
      redir.cookies.delete(MFA_COOKIE);
      return addNoCacheHeaders(redir);
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ⚠️ 보안: app_metadata만 사용 (user_metadata는 클라이언트 조작 가능)
  const role = user.app_metadata?.role as string | undefined;

  // ─── MFA 검증: 대시보드/API 접근 시 MFA 쿠키 필수 ───
  if ((isAdminRoute || isPortalRoute) && !isApiRoute) {
    const mfaToken = request.cookies.get(MFA_COOKIE)?.value;
    const mfaValid = mfaToken ? await verifyMfaToken(mfaToken, user.id) : false;

    if (!mfaValid) {
      try {
        // MFA 미완료 → 로그인 페이지로 리다이렉트 (모달에서 OTP 인증)
        const loginPath = isAdminRoute ? "/admin/login" : "/portal/login";
        return addNoCacheHeaders(NextResponse.redirect(new URL(loginPath, request.url)));
      } catch {
        // fallback
        return addNoCacheHeaders(NextResponse.redirect(new URL("/portal/login", request.url)));
      }
    }
  }

  // API 라우트에서도 MFA 검증 (인증 필요 API)
  if (isApiRoute) {
    try {
      const mfaToken = request.cookies.get(MFA_COOKIE)?.value;
      const mfaValid = mfaToken ? await verifyMfaToken(mfaToken, user.id) : false;
      if (!mfaValid) {
        return NextResponse.json({ error: 'MFA 인증이 필요합니다' }, { status: 403 });
      }
    } catch {
      // MFA 검증 실패 시 — 세션 인증은 통과했으므로 API 접근 허용 (가용성 우선)
    }
  }

  // 슈퍼관리자 경로 보호
  if (isAdminRoute && role !== "provider_admin") {
    if (role === "agency_admin") {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }
    return addNoCacheHeaders(NextResponse.redirect(new URL("/admin/login", request.url)));
  }

  // 대리점 경로 보호
  if (isPortalRoute && role !== "agency_admin") {
    if (role === "provider_admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return addNoCacheHeaders(NextResponse.redirect(new URL("/portal/login", request.url)));
  }

  // 포탈 경로: 플랜 기반 접근 제어
  if (isPortalRoute) {
    const userPlan = user.app_metadata?.plan as string | undefined;
    const feature = getFeatureForRoute(pathname);
    if (feature && !hasFeature(userPlan, feature)) {
      return NextResponse.redirect(
        new URL("/portal/settings?tab=billing&upgrade=1", request.url)
      );
    }
  }

  // 인증 필요 페이지에 캐시 방지 헤더 추가
  addNoCacheHeaders(response);

  return response;
}

export const config = {
  matcher: [
    /*
     * 모든 경로를 매칭하되, 정적 파일과 이미지는 제외
     * - _next/static, _next/image, favicon.ico
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
