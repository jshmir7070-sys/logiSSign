# S04: 모바일 앱 — 정산 확인 & 전자서명

**Goal:** 기사가 모바일 앱에서 정산서를 확인하고 전자계약서에 서명할 수 있도록 핵심 화면을 구현한다
**Demo:** After this: 기사가 앱에서 정산서를 확인하고, 전자계약서에 서명할 수 있다

## Tasks
- [x] **T01: Built 9 common UI components + installed 4 missing Expo packages — 0 TS errors** — 1. expo-linear-gradient, @expo/vector-icons 설치
2. Button (primary/secondary/outline/ghost) 구현
3. Card, Input, Badge, Header, ListItem, StatCard, EmptyState, LoadingSpinner 구현
4. 모든 컴포넌트 theme.ts 토큰만 사용
5. TypeScript Props interface 정의
6. StyleSheet.create 사용
  - Estimate: 1.5h
  - Files: mobile/components/common/*.tsx, mobile/package.json
  - Verify: cd mobile && npx tsc --noEmit
- [x] **T02: Settlement service + detail screen built — login already complete, tab screen already implemented** — 1. 로그인 화면 — Supabase Auth signIn 연동, Precision Velocity 디자인
2. 정산 탭 화면 — 월별 정산 목록 (year_month, delivery_count, total_amount, net_amount, status)
3. 정산 상세 — 항목별 금액, 차감 내역
4. mobile/services/settlement.service.ts 생성
5. TanStack Query로 데이터 패칭
  - Estimate: 2h
  - Files: mobile/app/(auth)/login.tsx, mobile/app/(tabs)/settlement.tsx, mobile/app/settlement/[id].tsx, mobile/services/settlement.service.ts
  - Verify: cd mobile && npx tsc --noEmit
- [x] **T03: E-contract flow complete — contract list, detail, SignaturePad, signature save to Supabase** — 1. 계약서 목록 화면 — 서명대기/서명완료/만료 상태 표시
2. 계약서 상세 — 계약 내용 표시 (ScrollView)
3. 전자서명 화면 — SignaturePad 컴포넌트, 서명 이미지 캡처
4. 서명 완료 처리 — contract_signatures 저장, contracts.status → signed
5. mobile/services/contract.service.ts 생성
  - Estimate: 2h
  - Files: mobile/app/(tabs)/contracts.tsx, mobile/app/contract/[id].tsx, mobile/app/contract/sign/[id].tsx, mobile/components/common/SignaturePad.tsx, mobile/services/contract.service.ts
  - Verify: cd mobile && npx tsc --noEmit
