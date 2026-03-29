---
id: S01
parent: M001
milestone: M001
provides:
  - Precision Velocity color tokens for S03 and S04
  - Typography scale with font family assignments
  - Shadow, borderRadius, gradient, glass tokens
requires:
  []
affects:
  - S03
  - S04
key_files:
  - mobile/constants/theme.ts
  - web/tailwind.config.ts
key_decisions:
  - Full M3-style color palette with 30+ tokens for complete tonal layering
  - Dual-font strategy: Pretendard for Korean/headlines, Inter for data/numbers
  - Shadows tinted with Sidebar Navy #0F172A — never pure black
  - Korean label letter-spacing +0.02em for dense table clarity
patterns_established:
  - All design values reference token files — no hardcoded colors/spacing
  - Shadow colors tinted with brand navy, not pure black
  - Korean labels get +0.02em letter-spacing
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-29T08:25:26.163Z
blocker_discovered: false
---

# S01: Design System & Tokens Unification

**Unified Precision Velocity design tokens across mobile (theme.ts) and web (tailwind.config.ts) with full M3 color palette, dual-font typography, and Navy-tinted shadows**

## What Happened

Audited DESIGN.md spec and performed gap analysis against existing theme.ts and tailwind.config.ts. Mobile theme.ts was rewritten from 15 colors to 35+ with full M3 surface hierarchy, added font family assignments to all typography levels, Navy-tinted shadows, gradient/glass/ghostBorder tokens. Web tailwind.config.ts received full fontSize scale (12 levels), glass backdrop-blur, consistent shadow naming, and Manrope removal. Both files now export semantically identical tokens from the same Precision Velocity spec.

## Verification

Mobile TypeScript compiles with zero theme-related errors. Web Tailwind CSS builds successfully (2608 lines, 247ms). Token values verified matching between both configs.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Added backwards-compat aliases for old token names (shadows.md, shadows.lg, borderRadius['2xl']) to avoid breaking existing screens. Removed Manrope font from web config — not in DESIGN.md spec.

## Known Limitations

Pretendard and Inter fonts must be loaded at runtime (Expo fonts / Next.js Google Fonts). Not configured yet — will be handled during screen implementation in S03/S04.

## Follow-ups

None.

## Files Created/Modified

- `mobile/constants/theme.ts` — Complete rewrite with full Precision Velocity M3 palette, font families, gradients, glass, ghostBorder, Navy-tinted shadows
- `web/tailwind.config.ts` — Synced with mobile tokens — added fontSize scale, glass blur, consistent shadow names, removed Manrope
