---
id: T02
parent: S01
milestone: M005
provides: []
requires: []
affects: []
key_files: ["web/src/components/admin/charts/PlanDistribution.tsx", "web/src/components/admin/charts/MrrChart.tsx", "web/src/components/portal/charts/RevenueChart.tsx", "web/src/components/portal/charts/ExpenseDonut.tsx", "web/src/services/verification.service.ts", "web/src/services/seal.service.ts", "web/src/types/database.ts", "web/src/app/portal/(dashboard)/settings/page.tsx", "web/src/__tests__/csrf.test.ts"]
key_decisions: ["Recharts formatter: 타입 어노테이션 제거하고 타입 추론에 의존", "Supabase RPC: database.ts Functions 타입에 nextval_text + approve_amendment_with_period 등록", "ExpenseDonut: PieLabelRenderProps import하여 라벨 함수 타입 정합", "csrf.test.ts: as unknown as NextRequest 안전 캐스트로 mock 교체"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "rg 'as any' src/ → 0건, npx next build → 성공, npm test → 21건 통과"
completed_at: 2026-04-02T11:52:17.383Z
blocker_discovered: false
---

# T02: as any 9건(Recharts 5, Supabase RPC 1, 타입 미비 3) + csrf.test any 1건 → 전량 안전 타입으로 교체

> as any 9건(Recharts 5, Supabase RPC 1, 타입 미비 3) + csrf.test any 1건 → 전량 안전 타입으로 교체

## What Happened
---
id: T02
parent: S01
milestone: M005
key_files:
  - web/src/components/admin/charts/PlanDistribution.tsx
  - web/src/components/admin/charts/MrrChart.tsx
  - web/src/components/portal/charts/RevenueChart.tsx
  - web/src/components/portal/charts/ExpenseDonut.tsx
  - web/src/services/verification.service.ts
  - web/src/services/seal.service.ts
  - web/src/types/database.ts
  - web/src/app/portal/(dashboard)/settings/page.tsx
  - web/src/__tests__/csrf.test.ts
key_decisions:
  - Recharts formatter: 타입 어노테이션 제거하고 타입 추론에 의존
  - Supabase RPC: database.ts Functions 타입에 nextval_text + approve_amendment_with_period 등록
  - ExpenseDonut: PieLabelRenderProps import하여 라벨 함수 타입 정합
  - csrf.test.ts: as unknown as NextRequest 안전 캐스트로 mock 교체
duration: ""
verification_result: passed
completed_at: 2026-04-02T11:52:17.384Z
blocker_discovered: false
---

# T02: as any 9건(Recharts 5, Supabase RPC 1, 타입 미비 3) + csrf.test any 1건 → 전량 안전 타입으로 교체

**as any 9건(Recharts 5, Supabase RPC 1, 타입 미비 3) + csrf.test any 1건 → 전량 안전 타입으로 교체**

## What Happened

as any 9건을 카테고리별로 처리:\n\n1. Recharts formatter 4건 (PlanDistribution, MrrChart, RevenueChart, ExpenseDonut) — 타입 어노테이션 제거하고 Recharts 자체 타입 추론에 의존. Number() 변환으로 ValueType→number 안전하게 처리.\n\n2. ExpenseDonut label 1건 — PieLabelRenderProps를 recharts에서 import하여 renderCustomLabel 함수 시그니처에 적용.\n\n3. verification.service.ts rpc 1건 — database.ts의 Functions 타입에 nextval_text와 approve_amendment_with_period RPC 함수 등록. 이제 supabase.rpc() 호출이 타입 안전.\n\n4. settings/page.tsx recipients 3건 — DocumentFile 인터페이스에 recipients?: {id:string}[] 옵셔널 필드 추가.\n\n5. csrf.test.ts any 1건 — mockRequest 반환 타입을 as unknown as NextRequest로 교체.

## Verification

rg 'as any' src/ → 0건, npx next build → 성공, npm test → 21건 통과

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `rg 'as any' src/` | 1 | ✅ pass (0건) | 100ms |
| 2 | `npx next build` | 0 | ✅ pass | 21400ms |
| 3 | `npm test` | 0 | ✅ pass (21건) | 2600ms |


## Deviations

초기 보고 7건이 아닌 9건이었음 — csrf.test.ts의 : any 1건 + 실제 as any 2건 추가 발견. 전부 해결.

## Known Issues

None.

## Files Created/Modified

- `web/src/components/admin/charts/PlanDistribution.tsx`
- `web/src/components/admin/charts/MrrChart.tsx`
- `web/src/components/portal/charts/RevenueChart.tsx`
- `web/src/components/portal/charts/ExpenseDonut.tsx`
- `web/src/services/verification.service.ts`
- `web/src/services/seal.service.ts`
- `web/src/types/database.ts`
- `web/src/app/portal/(dashboard)/settings/page.tsx`
- `web/src/__tests__/csrf.test.ts`


## Deviations
초기 보고 7건이 아닌 9건이었음 — csrf.test.ts의 : any 1건 + 실제 as any 2건 추가 발견. 전부 해결.

## Known Issues
None.
