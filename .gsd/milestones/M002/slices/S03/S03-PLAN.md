# S03: 모바일 나머지 화면 + 탭바 수정

**Goal:** 모바일 탭바에 계약 탭 추가 + 홈/공지/프로필 화면 Supabase 서비스 연동
**Demo:** After this: 기사가 홈/공지/프로필/계약 탭을 모두 사용할 수 있다

## Tasks
- [x] **T01: 계약 탭 추가 (5개 탭 완성) + notice service 생성, 0 TS errors** — 1. (tabs)/_layout.tsx에 계약 탭 추가 (5번째 탭)
2. 홈 탭 — Supabase에서 기사 정보 + 오늘 정산 요약 표시
3. 공지 탭 — notices 테이블에서 데이터 패칭
4. 프로필 탭 — 기사 정보 + 로그아웃 버튼
5. mobile/services/notice.service.ts 생성
  - Estimate: 1.5h
  - Files: mobile/app/(tabs)/_layout.tsx, mobile/app/(tabs)/index.tsx, mobile/app/(tabs)/notice.tsx, mobile/app/(tabs)/profile.tsx, mobile/services/notice.service.ts
  - Verify: cd mobile && npx tsc --noEmit
