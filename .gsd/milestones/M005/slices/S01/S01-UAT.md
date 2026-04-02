# S01: 빌드 에러 수정 + as any 7건 제거 — UAT

**Milestone:** M005
**Written:** 2026-04-02T11:52:49.578Z

## UAT: 빌드 수정 + 타입 안전성\n\n### 검증 항목\n- [x] `npx next build` 성공 (exit 0)\n- [x] ESLint 에러 0건 (warning만 잔존)\n- [x] `rg 'as any' src/` → 0건\n- [x] `npm test` → 21건 전부 통과\n- [x] 55개 정적 페이지 생성 성공
