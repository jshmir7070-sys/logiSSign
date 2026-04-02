---
id: S01
parent: M005
milestone: M005
provides:
  - as any 0건 코드베이스
  - 프로덕션 빌드 통과
requires:
  []
affects:
  []
key_files:
  - web/src/types/database.ts
  - web/src/components/portal/charts/ExpenseDonut.tsx
  - web/src/services/verification.service.ts
key_decisions:
  - Recharts formatter는 타입 어노테이션 제거하고 추론에 의존
  - Supabase RPC는 database.ts Functions 타입에 등록하여 정적 타입 검사 확보
patterns_established:
  - Recharts formatter는 타입 어노테이션 없이 추론에 의존
  - Supabase 커스텀 RPC는 database.ts Functions에 등록하여 타입 안전성 확보
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M005/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M005/slices/S01/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T11:52:49.578Z
blocker_discovered: false
---

# S01: 빌드 에러 수정 + as any 7건 제거

**빌드 에러 수정 + as any 9건 전량 제거 — 프로덕션 빌드 통과 + 타입 안전성 확보**

## What Happened

빌드를 깨트리던 _DocumentsTab React hooks 규칙 위반을 리네이밍으로 해소하고, 코드베이스 전체의 as any 9건을 안전한 타입으로 교체했다. Recharts는 타입 추론 활용, Supabase RPC는 database.ts Functions 타입에 등록, DocumentFile은 인터페이스 확장, csrf 테스트는 안전 캐스트 적용.

## Verification

npx next build 성공, rg 'as any' src/ 0건, npm test 21건 통과

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

초기 보고 as any 7건이 실제 9건(csrf.test.ts 포함)이었으나 전량 해결

## Known Limitations

Recharts SSG 시 chart width/height 경고 발생 (기능 영향 없음)

## Follow-ups

DocumentsTab을 설정 탭 UI에 연결 (현재 dead code)

## Files Created/Modified

- `web/src/app/portal/(dashboard)/settings/page.tsx` — _DocumentsTab → DocumentsTab 리네이밍 + recipients as any 제거
- `web/src/components/admin/charts/PlanDistribution.tsx` — formatter as any 제거
- `web/src/components/admin/charts/MrrChart.tsx` — formatter as any 제거
- `web/src/components/portal/charts/RevenueChart.tsx` — formatter as any 제거
- `web/src/components/portal/charts/ExpenseDonut.tsx` — label + formatter as any 제거, PieLabelRenderProps 적용
- `web/src/services/verification.service.ts` — supabase.rpc as any 제거
- `web/src/services/seal.service.ts` — DocumentFile에 recipients 옵션 필드 추가
- `web/src/types/database.ts` — Functions에 nextval_text + approve_amendment_with_period RPC 타입 등록
- `web/src/__tests__/csrf.test.ts` — mockRequest 반환타입 any → NextRequest 캐스트
