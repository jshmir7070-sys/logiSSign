import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { csrfCheck } from "@/lib/csrf";

// 공개 경로: 인증 불필요
const PUBLIC_ROUTES = [
  "/coming-soon",   // 커밍순 페이지
  "/about",         // 서비스 소개 페이지
  "/terms",         // 이용약관
  "/privacy",       // 개인정보처리방침
  "/admin/login",   // 슈퍼관리자 로그인
  "/portal/login",  // 대리점 로그인
  "/portal/signup", // 대리점 회원가입
  "/verify",        // 공개 진위확인 페이지
  "/api/verify",    // 공개 진위확인 API
  "/api/auth/signup", // 운영사 회원가입 API
  "/api/auth/driver-signup", // 기사 가입 API (초대코드+계정+driver 연결 원자적)
  "/api/cron",      // CRON (자체 시크릿 인증)
  "/_next",
  "/favicon.ico",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
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
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isPortalRoute) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  // ⚠️ 보안: app_metadata만 사용 (user_metadata는 클라이언트 조작 가능)
  const role = user.app_metadata?.role as string | undefined;

  // 슈퍼관리자 경로 보호
  if (isAdminRoute && role !== "provider_admin") {
    if (role === "agency_admin") {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // 대리점 경로 보호
  if (isPortalRoute && role !== "agency_admin") {
    if (role === "provider_admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  // API 라우트: 세션 있으면 통과 (각 라우트에서 role/agency_id 추가 검증)
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