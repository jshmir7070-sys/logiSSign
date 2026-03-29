---
id: S01
parent: M002
milestone: M002
provides:
  - settlement_display config for S03 mobile screens
requires:
  []
affects:
  - S03
key_files:
  - web/src/services/principal.service.ts
  - web/src/app/portal/(dashboard)/principals/[id]/page.tsx
key_decisions:
  - 14 toggleable settlement display fields with sensible defaults
  - Live phone-frame preview for instant visual feedback
  - net_amount locked ON as required field
patterns_established:
  - SettlementDisplayConfig pattern for controlling mobile display from web admin
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S01/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-29T09:37:11.681Z
blocker_discovered: false
---

# S01: 웹 포털 나머지 페이지 완성

**정산서 노출항목 체크+미리보기 구현 + 웹 포털 20페이지 전체 빌드 확인**

## What Happened

Added settlement display config feature: 14 checkboxes controlling which fields the driver sees in their settlement detail, with a live mobile phone-frame preview showing the exact layout. All 20 portal pages verified building correctly.

## Verification

npm run build passes. All 20 portal pages compile and render.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

- Mobile settlement detail should read settlement_display from principal config

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

Reports page uses hardcoded dummy data.

## Follow-ups

Mobile app settlement detail screen needs to read settlement_display config and conditionally show/hide fields.

## Files Created/Modified

- `web/src/services/principal.service.ts` — Added SettlementDisplayConfig interface, DEFAULT_SETTLEMENT_DISPLAY, SETTLEMENT_DISPLAY_LABELS, updated FieldConfig and normalizeFieldConfig
- `web/src/app/portal/(dashboard)/principals/[id]/page.tsx` — Added settlement display checkbox grid + mobile phone frame preview section
