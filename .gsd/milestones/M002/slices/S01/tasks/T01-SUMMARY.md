---
id: T01
parent: S01
milestone: M002
provides: []
requires: []
affects: []
key_files: ["web/src/services/principal.service.ts", "web/src/app/portal/(dashboard)/principals/[id]/page.tsx"]
key_decisions: ["SettlementDisplayConfig added to FieldConfig — 14 toggleable fields", "Mobile app preview shows live toggle response — phone frame mockup in web", "net_amount is required (can't uncheck) — driver must always see final pay", "Display config saved alongside other field_config via handleSaveFieldConfig"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "cd web && npm run build — passes, 0 errors"
completed_at: 2026-03-29T09:36:17.088Z
blocker_discovered: false
---

# T01: 정산서 노출항목 14개 체크박스 + 모바일 앱 실시간 미리보기 구현

> 정산서 노출항목 14개 체크박스 + 모바일 앱 실시간 미리보기 구현

## What Happened
---
id: T01
parent: S01
milestone: M002
key_files:
  - web/src/services/principal.service.ts
  - web/src/app/portal/(dashboard)/principals/[id]/page.tsx
key_decisions:
  - SettlementDisplayConfig added to FieldConfig — 14 toggleable fields
  - Mobile app preview shows live toggle response — phone frame mockup in web
  - net_amount is required (can't uncheck) — driver must always see final pay
  - Display config saved alongside other field_config via handleSaveFieldConfig
duration: ""
verification_result: passed
completed_at: 2026-03-29T09:36:17.198Z
blocker_discovered: false
---

# T01: 정산서 노출항목 14개 체크박스 + 모바일 앱 실시간 미리보기 구현

**정산서 노출항목 14개 체크박스 + 모바일 앱 실시간 미리보기 구현**

## What Happened

Added SettlementDisplayConfig interface with 14 toggleable fields (delivery_count/amount, return, pickup, incentive, fresh/extra incentive, deduction_detail, vat, totals, net). Added DEFAULT_SETTLEMENT_DISPLAY with sensible defaults (배송건수+금액, 인센티브, 차감상세, 부가세, 총수입/차감, 순지급액 ON). Built checkbox grid UI in principals/[id] page. Built live phone-frame preview showing exactly what the driver sees in their app — toggles respond instantly. net_amount is locked ON (순지급액 필수). Saves via existing handleSaveFieldConfig alongside other settings.

## Verification

cd web && npm run build — passes, 0 errors

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npm run build` | 0 | ✅ pass | 15400ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `web/src/services/principal.service.ts`
- `web/src/app/portal/(dashboard)/principals/[id]/page.tsx`


## Deviations
None.

## Known Issues
None.
