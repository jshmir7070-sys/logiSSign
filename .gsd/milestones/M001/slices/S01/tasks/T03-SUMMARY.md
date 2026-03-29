---
id: T03
parent: S01
milestone: M001
provides: []
requires: []
affects: []
key_files: ["web/tailwind.config.ts"]
key_decisions: ["Added full fontSize scale (display-lg through label-sm) with DESIGN.md §3 Korean letter-spacing", "Added glass backdropBlur utility", "Removed Manrope — DESIGN.md specifies Pretendard for all Korean/headline text", "Shadow names match mobile: sm, card, ambient, float"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Tailwind CSS build succeeds: cd web && npx tailwindcss --content './src/**/*.tsx' --output /tmp/tw-test.css — 2608 lines, 247ms"
completed_at: 2026-03-29T08:24:59.433Z
blocker_discovered: false
---

# T03: Synced web tailwind.config.ts with full Precision Velocity tokens — fontSize scale, glass blur, Navy-tinted shadows matching mobile

> Synced web tailwind.config.ts with full Precision Velocity tokens — fontSize scale, glass blur, Navy-tinted shadows matching mobile

## What Happened
---
id: T03
parent: S01
milestone: M001
key_files:
  - web/tailwind.config.ts
key_decisions:
  - Added full fontSize scale (display-lg through label-sm) with DESIGN.md §3 Korean letter-spacing
  - Added glass backdropBlur utility
  - Removed Manrope — DESIGN.md specifies Pretendard for all Korean/headline text
  - Shadow names match mobile: sm, card, ambient, float
duration: ""
verification_result: passed
completed_at: 2026-03-29T08:24:59.515Z
blocker_discovered: false
---

# T03: Synced web tailwind.config.ts with full Precision Velocity tokens — fontSize scale, glass blur, Navy-tinted shadows matching mobile

**Synced web tailwind.config.ts with full Precision Velocity tokens — fontSize scale, glass blur, Navy-tinted shadows matching mobile**

## What Happened

Synced web/tailwind.config.ts with mobile theme.ts. Added full fontSize scale (12 levels), Korean letter-spacing on label sizes, glass backdropBlur, consistent shadow naming (sm/card/ambient/float). Fixed font family from Manrope to Pretendard per DESIGN.md spec. Tailwind build succeeds — 2608 lines of CSS generated in 247ms.

## Verification

Tailwind CSS build succeeds: cd web && npx tailwindcss --content './src/**/*.tsx' --output /tmp/tw-test.css — 2608 lines, 247ms

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx tailwindcss --content './src/**/*.tsx' --output /tmp/tw-test.css` | 0 | ✅ pass | 247ms |


## Deviations

Removed Manrope from headline font stack — DESIGN.md specifies Pretendard for headlines, not Manrope. Added explicit fontSize scale with line-height and font-weight per level.

## Known Issues

Pre-existing TS errors in Recharts chart components and notices page — unrelated to tailwind config.

## Files Created/Modified

- `web/tailwind.config.ts`


## Deviations
Removed Manrope from headline font stack — DESIGN.md specifies Pretendard for headlines, not Manrope. Added explicit fontSize scale with line-height and font-weight per level.

## Known Issues
Pre-existing TS errors in Recharts chart components and notices page — unrelated to tailwind config.
