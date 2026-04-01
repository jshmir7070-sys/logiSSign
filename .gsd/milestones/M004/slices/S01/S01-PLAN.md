# S01: ESLint 미사용 import 정리 + console 정리

**Goal:** ESLint 미사용 import 45건 제거 + 프로덕션 console.log 정리
**Demo:** After this: npx next build 시 ESLint 경고 0건

## Tasks
- [ ] **T01: 미사용 import 45건 + console 정리** — 1. npx next build로 미사용 import 목록 추출
2. 각 파일에서 미사용 변수/import 제거
3. 재빌드로 0건 확인
  - Estimate: 1h
  - Files: web/src/
  - Verify: cd web && npx next build 2>&1 | grep -c 'defined but never used'
