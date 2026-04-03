# S04: 헬스체크 API + 배포 설정 검증

**Goal:** /api/health 엔드포인트 + 전체 build+test 최종 검증
**Demo:** After this: /api/health 호출 → DB/Storage/Auth 상태 응답 + build 성공

## Tasks
- [x] **T01: /api/health 헬스체크 API 완성 + 최종 build/test 검증 통과** — 1. /api/health route 작성 (DB/Storage/Auth 상태 체크)
2. 전체 build + test 최종 검증
  - Estimate: 10min
  - Files: web/src/app/api/health/route.ts
  - Verify: build 성공 + 188 tests
