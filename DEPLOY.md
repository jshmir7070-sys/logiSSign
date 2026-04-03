# logiSSign 배포 가이드

## 사전 요구사항

- Node.js 18+
- Vercel 계정
- Supabase 프로젝트 (PostgreSQL + Auth + Storage)

## 1. Supabase 설정

### 1-1. 스키마 배포
```bash
# Supabase SQL Editor에서 순서대로 실행:
supabase/schema.sql                          # 33 테이블 + RLS
supabase/migrations/002_storage_buckets.sql  # Storage 버킷
supabase/migrations/003_security_hardening.sql  # RLS 보안 강화
supabase/migrations/004_rpc_auth.sql         # RPC 함수 권한
supabase/migrations/005_settlement_builder.sql  # 정산 빌더
supabase/migrations/006_rls_complete.sql     # RLS 완전 적용
supabase/migrations/007_pii_audit_log.sql    # PII 감사 로그
```

### 1-2. Storage 버킷 확인
- `contracts` (private)
- `documents` (private)
- `education` (private)
- `seals` (private)
- `settlements` (private)

### 1-3. Auth 설정
- Email/Password 활성화
- JWT expiry: 3600초 (기본값)
- Site URL: `https://logissign.com`
- Redirect URLs: `https://logissign.com/**`

## 2. Vercel 배포

### 2-1. 프로젝트 연결
```bash
cd web
vercel link
```

### 2-2. 환경변수 설정

Vercel Dashboard → Settings → Environment Variables에서 설정:

#### 필수 (없으면 서비스 불가)
| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키 ⚠️ |
| `NEXT_PUBLIC_APP_URL` | `https://logissign.com` |
| `CRON_SECRET` | CRON 인증 시크릿 (32자+ 랜덤 문자열) |

#### 결제 (PortOne 사용 시)
| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_PORTONE_STORE_ID` | PortOne 상점 ID |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | PortOne 채널 키 |
| `PORTONE_API_SECRET` | PortOne API 시크릿 ⚠️ |

#### SMS (Solapi 사용 시)
| 변수 | 설명 |
|------|------|
| `SOLAPI_API_KEY` | Solapi API 키 |
| `SOLAPI_API_SECRET` | Solapi API 시크릿 ⚠️ |
| `SOLAPI_SENDER_PHONE` | 사전등록된 발신번호 |

#### AI / 본인인증 / 모니터링
| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 (AI 계약서 생성) ⚠️ |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (에러 모니터링) |

### 2-3. 배포
```bash
vercel --prod
```

### 2-4. 도메인 연결
Vercel Dashboard → Domains → `logissign.com` 추가

## 3. CRON 설정

`vercel.json`에 이미 설정됨:
- 매일 01:00 — `/api/cron/renewal-check` (계약 만료 알림)
- 매주 일요일 03:00 — `/api/cron/integrity-check` (무결성 검사)

CRON 호출 시 `Authorization: Bearer {CRON_SECRET}` 헤더로 인증.

## 4. 배포 후 확인

```bash
# 헬스체크
curl https://logissign.com/api/health

# robots.txt
curl https://logissign.com/robots.txt

# sitemap
curl https://logissign.com/sitemap.xml

# 보안 헤더
curl -I https://logissign.com | grep -E "strict-transport|x-frame|content-security"
```

## 5. 모바일 앱 (Expo)

```bash
cd mobile
npm install
npx expo start
```

EAS Build (프로덕션):
```bash
npx eas build --platform all --profile production
npx eas submit --platform all
```

## 6. 모니터링

| 도구 | 용도 |
|------|------|
| **Sentry** | 클라이언트/서버 에러 자동 수집 |
| **Vercel Analytics** | 성능 + Web Vitals |
| **감사 로그** | `/admin/audit-log` — 보안 이벤트 |
| **서버 상태** | `/admin/server` — DB/Storage/Auth 헬스체크 |
| **UptimeRobot** | `/api/health` 모니터링 (외부) |
