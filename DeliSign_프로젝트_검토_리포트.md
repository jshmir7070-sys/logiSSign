# DeliSign 프로젝트 종합 검토 리포트

**검토일:** 2026-03-30
**프로젝트:** DeliSign — 라스트마일 배송 정산/계약 SaaS 플랫폼
**검토 범위:** 아키텍처, 코드 품질, 보안, 구현 상황

---

## 1. 프로젝트 개요

DeliSign은 배송 대리점(Agency)이 기사(Driver)의 정산, 계약, 교육을 관리할 수 있는 B2B SaaS 플랫폼입니다.

**기술 스택:**
- Web: Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- Mobile: Expo SDK 54 + React Native (Expo Router v5)
- Backend: Supabase (PostgreSQL + Auth + RLS)
- 상태관리: Web은 useState/service 패턴, Mobile은 Zustand

**멀티테넌시 구조:**
- Provider (SaaS 운영자) → Agency (대리점) → Driver (기사)
- RLS로 agency_id 기반 데이터 격리

---

## 2. 현재 구현 상황

### 완료된 기능 (Web - 대리점 포털)

| 기능 | 상태 | 비고 |
|------|------|------|
| 대리점 로그인/회원가입 | 완료 | Supabase Auth (email/password) |
| 대시보드 (KPI, 차트) | 완료 | 매출/지출 차트, 최근 정산 |
| 기사 관리 (CRUD) | 완료 | 목록, 등록, 상세 |
| 화주/거래처 관리 | 완료 | 화물 유형별 단가 설정 |
| 정산 규칙 설정 | 완료 | 화물/기사별 단가, 공제, 인센티브 |
| 엑셀 업로드 정산 | 완료 | 쿠팡/CJ/한진 등 택배사별 파싱 |
| 정산서 생성 | 완료 | 기사별 정산 계산 및 생성 |
| 계약서 템플릿/발송 | 완료 | 템플릿 관리, 기사에게 발송 |
| 세금계산서 | 완료 | 목록, 인쇄 |
| 공지사항 | 완료 | 작성, 목록 |
| 매출 리포트 | 완료 | 기간별 보고서 |

### 완료된 기능 (Web - 슈퍼관리자)

| 기능 | 상태 | 비고 |
|------|------|------|
| 관리자 로그인 | 완료 | provider_admin 역할 |
| 대리점 관리 | 완료 | 목록, 플랜 관리 |
| 대시보드 (MRR, 플랜 분포) | 완료 | SaaS 메트릭 |
| 매출/빌링/서버 설정 | 완료 | 관리 화면 |

### 완료된 기능 (Mobile - 기사용 앱)

| 기능 | 상태 | 비고 |
|------|------|------|
| 전화번호 로그인/가입 | 완료 | SecureStore 토큰 보관 |
| 홈 대시보드 | 완료 | 요약 정보 |
| 정산서 조회 | 완료 | 월별 정산 내역 |
| 계약서 조회/서명 | 완료 | 전자서명 (SVG SignaturePad) |
| 교육 수강/퀴즈 | 완료 | 진도 추적, 수료증 |
| 공지사항 | 완료 | 읽기 전용 |
| 프로필 관리 | 완료 | 기사 정보 |

### 미구현/미완성 기능

| 기능 | 상태 | 비고 |
|------|------|------|
| SMS 발송 (Solapi) | 미연동 | API 키 미설정, 서비스 코드만 존재 |
| 푸시 알림 | 비활성 | SDK 54 호환 문제로 주석 처리 |
| 본인인증 (PASS/카카오) | 목업 | 개발 모드에서 자동 통과 처리 |
| 결제/구독 시스템 | 미구현 | subscriptions 테이블만 존재 |
| 채용 관리 | 미구현 | 라우트만 존재 (recruitment) |
| 서명 PDF 저장 | 미연동 | signed_pdf_url 칼럼 존재, 실제 생성 미구현 |

---

## 3. 아키텍처 검토

### 잘된 점

**명확한 레이어 분리.** Web의 services/ 폴더에 16개 서비스 파일이 비즈니스 로직을 캡슐화하고 있습니다. 컴포넌트가 직접 Supabase를 호출하지 않고 서비스 레이어를 통하는 패턴이 일관되게 적용되어 있어 유지보수성이 좋습니다.

**적절한 라우팅 구조.** Next.js App Router의 Route Groups `(dashboard)` 를 활용해 admin/portal 레이아웃을 깔끔하게 분리했고, Mobile도 Expo Router의 `(auth)/(tabs)` 그룹으로 인증 흐름을 명확하게 구분했습니다.

**DB 스키마 설계.** 19개 이상의 테이블이 정규화되어 있고, settlement_rules → driver_rates → driver_route_rates로 이어지는 계층적 가격 오버라이드 구조가 실제 배송 정산 도메인을 잘 반영합니다.

**타입 안전성.** Supabase에서 생성된 Database 타입을 Web과 Mobile이 공유하고, 서비스 함수들이 모두 제네릭 타입으로 연결되어 있습니다.

### 개선 필요

**Server Component 미활용.** 현재 대부분의 페이지가 `'use client'`로 되어 있고 useEffect에서 데이터를 fetch합니다. Next.js App Router의 Server Component를 활용하면 초기 로딩 성능과 SEO가 크게 개선됩니다. 특히 대시보드, 목록 페이지는 서버에서 렌더링하는 것이 적합합니다.

**Web 전역 상태 부재.** Web의 stores/ 폴더가 비어 있고, 모든 상태가 페이지별 useState로 관리됩니다. 현재 로그인 사용자 정보(agencyId, role)를 매 페이지 useEffect에서 `supabase.auth.getUser()`로 가져오는 패턴이 반복됩니다. React Context나 Zustand로 세션 정보를 한 번만 가져와 공유하는 것이 좋겠습니다.

**코드 중복.** Web과 Mobile의 types/database.ts가 동일한 파일이 각각 존재합니다. 모노레포 패키지나 심볼릭 링크로 공유하면 스키마 변경 시 동기화 누락을 방지할 수 있습니다.

**API 라우트 부족.** 현재 API 라우트가 contracts/send, contracts/list 두 개뿐입니다. 정산 생성, 세금계산서 발행 등 중요한 비즈니스 로직이 클라이언트에서 직접 Supabase를 호출하는데, 이런 로직은 서버 사이드 API로 옮기는 것이 데이터 무결성과 보안에 유리합니다.

---

## 4. 보안 검토

### 심각 (즉시 수정 필요)

**1. .env 파일이 Git에 포함되어 있을 가능성**
`web/.env.local`에 실제 Supabase Service Role Key가 평문으로 존재합니다. `.gitignore`에 포함되어 있는지 반드시 확인하세요. Service Role Key가 노출되면 RLS를 우회하여 모든 데이터에 접근할 수 있습니다.

**2. NEXT_PUBLIC_ 접두사로 노출되는 민감 키**
`NEXT_PUBLIC_SOLAPI_API_KEY`와 `NEXT_PUBLIC_SOLAPI_API_SECRET`이 클라이언트에 노출됩니다. SMS API 키는 서버에서만 사용해야 하며, `NEXT_PUBLIC_` 접두사를 제거하고 API Route에서만 사용하세요. `NEXT_PUBLIC_IDENTITY_API_KEY`도 마찬가지입니다.

**3. Middleware에서 getSession() 사용**
현재 미들웨어에서 `supabase.auth.getSession()`을 사용하는데, 이는 쿠키의 JWT를 검증 없이 신뢰합니다. `supabase.auth.getUser()`를 사용해야 Supabase 서버에서 토큰 유효성을 검증합니다. 다만 매 요청마다 API 호출이 발생하므로, 성능이 우려되면 getSession()으로 빠른 체크 후 민감한 작업에서만 getUser()를 호출하는 방식을 고려하세요.

**4. API Route에 인증 체크 누락**
`/api/contracts/send`와 `/api/contracts/list` 라우트에서 요청자의 인증/권한을 확인하지 않고 Service Role Key로 직접 DB를 조작합니다. 악의적 사용자가 다른 대리점의 agencyId를 파라미터로 보내면 해당 대리점의 계약을 조회/생성할 수 있습니다.

### 높음

**5. RLS 정책의 서브쿼리 성능**
거의 모든 RLS 정책이 `driver_id IN (SELECT id FROM drivers WHERE agency_id = ...)`와 같은 서브쿼리를 사용합니다. 데이터가 늘어나면 성능 저하가 발생할 수 있습니다. JWT 커스텀 클레임에 agency_id를 포함시키고 `auth.jwt()->>'agency_id'`로 직접 비교하는 방식을 고려하세요.

**6. 은행 계좌 정보 평문 저장**
agencies 테이블의 bank_name, bank_account, bank_holder가 평문입니다. Supabase의 Vault나 칼럼 레벨 암호화를 적용하는 것이 좋겠습니다.

**7. 계약 서명 토큰 보안**
`sign_token`이 URL 파라미터로 전달될 수 있으며, 30일간 유효합니다. 토큰 사용 후 즉시 무효화하는 로직과, 사용 횟수 제한을 추가하는 것이 좋겠습니다.

### 중간

**8. JSONB 필드 검증 부재**
excel_config, field_config, custom_values, quiz_data 등 JSONB 필드에 스키마 검증이 없습니다. 잘못된 데이터가 들어가면 런타임 에러가 발생할 수 있습니다.

**9. 정산 금액 DB 레벨 검증 없음**
정산의 총액 계산(gross_total, net_amount 등)이 모두 애플리케이션 코드에서만 이루어집니다. DB 트리거나 CHECK 제약으로 무결성을 보장하는 것이 좋겠습니다.

---

## 5. 코드 품질 검토

### 잘된 점

**일관된 서비스 패턴.** 모든 서비스가 `{ data: T | null, error: string | null }` 형태를 반환하여 에러 처리가 예측 가능합니다.

**디자인 시스템.** Mobile의 theme.ts가 Material Design 3 토큰을 체계적으로 정의하고 있고, Web은 Tailwind CSS 변수로 일관된 스타일링을 유지합니다.

**컴포넌트 재사용.** Badge, KpiCard, Button 등 공통 컴포넌트가 잘 분리되어 있고, Mobile의 SignaturePad는 PanResponder 기반으로 자체 구현되어 있습니다.

### 개선 필요

**에러 핸들링 일관성 부족.** 서비스 레이어는 에러를 반환하지만, UI에서 사용자에게 에러를 보여주는 패턴이 일관되지 않습니다. 토스트/알림 시스템을 도입하면 좋겠습니다.

**로딩 상태 처리 미흡.** 대부분의 페이지에서 loading 상태일 때 단순 텍스트("로딩 중...")만 표시합니다. Skeleton UI나 LoadingSpinner 컴포넌트를 통일하면 UX가 개선됩니다.

**교육 부정행위 방지 미흡.** education_activity_logs에 tab_leave, video_seek 등을 기록하지만, 이를 검증하여 수료를 차단하는 로직은 없습니다. DB CHECK 제약이나 서버 로직으로 `total_study_sec >= required_minutes`를 강제하는 것이 필요합니다.

**updated_at 칼럼 부재.** 대부분의 테이블에 created_at만 있고 updated_at이 없어 데이터 변경 이력 추적이 불가능합니다. 특히 정산, 계약 등 법적 효력이 있는 데이터에는 필수입니다.

**상태 전이 규칙 부재.** 계약(draft→sent→viewed→signed)이나 정산(draft→sent→confirmed)의 상태 전이가 애플리케이션 코드에만 의존합니다. 잘못된 상태 변경(예: draft에서 바로 signed)이 가능합니다.

---

## 6. 다음 단계 권장사항

### 우선순위 1 (즉시)
1. API Route에 인증/권한 체크 추가
2. `NEXT_PUBLIC_` 접두사 민감 키 제거 (Solapi, Identity)
3. .env 파일 Git 이력에서 제거 및 키 재발급
4. Middleware에서 getUser() 전환 검토

### 우선순위 2 (1-2주 내)
5. 정산 생성/세금계산서 발행을 서버 사이드 API Route로 이동
6. updated_at 칼럼 추가 + 자동 업데이트 트리거
7. 계약/정산 상태 전이 규칙 DB 레벨 적용
8. 사용자 세션 Context/Store 도입 (Web)

### 우선순위 3 (장기)
9. Server Component 활용으로 성능 최적화
10. types/database.ts 모노레포 패키지로 공유
11. 결제/구독 시스템 구현
12. 본인인증(PASS/카카오) 실제 연동
13. SMS/푸시 알림 연동

---

## 7. 총평

DeliSign은 배송 정산이라는 도메인 복잡도를 잘 소화한 프로젝트입니다. 2번의 커밋(M001, M002)으로 이 정도의 기능을 구현한 것은 인상적이며, 특히 DB 스키마 설계와 서비스 레이어 분리가 깔끔합니다. Web과 Mobile 모두 핵심 기능이 동작하는 수준까지 완성되어 있습니다.

다만, **보안 측면에서 즉시 조치가 필요한 사항들**이 있습니다. 특히 API Route 인증 누락과 클라이언트에 노출된 민감 키 문제는 프로덕션 배포 전에 반드시 해결해야 합니다. 또한 Next.js의 Server Component를 더 적극 활용하면 성능과 보안 모두 개선할 수 있습니다.

전체적으로 MVP 수준에서는 잘 구성되어 있으며, 위의 권장사항을 순차적으로 적용하면 프로덕션 레디 상태로 발전시킬 수 있을 것입니다.
