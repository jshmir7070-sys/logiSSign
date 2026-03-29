# S01: Design System & Tokens Unification

**Goal:** Unify design tokens across mobile (theme.ts) and web (Tailwind config) from the Precision Velocity DESIGN.md spec
**Demo:** After this: theme.ts and tailwind.config.ts both export identical Precision Velocity color/spacing/typography tokens

## Tasks
- [x] **T01: Audited DESIGN.md and identified all token gaps in mobile and web configs** — 1. Read stitch/stitch_core/DESIGN.md completely
2. Extract all color tokens (surfaces, primary, error, tertiary, sidebar, outlines)
3. Extract typography scale (display, title, body, label sizes + font families)
4. Extract spacing scale, border radius, elevation/shadow values
5. Create a canonical token reference list
  - Estimate: 30min
  - Files: stitch/stitch_core/DESIGN.md
  - Verify: All sections of DESIGN.md covered — colors, typography, spacing, elevation, components
- [x] **T02: Completed mobile theme.ts with full Precision Velocity token set — 30+ new color tokens, font families, Navy-tinted shadows, gradients** — 1. Read existing mobile/constants/theme.ts
2. Add any missing color tokens from DESIGN.md
3. Add complete typography scale with Pretendard/Inter font families
4. Add elevation/shadow tokens
5. Add border radius tokens
6. Export typed token objects with 'as const'
  - Estimate: 45min
  - Files: mobile/constants/theme.ts
  - Verify: TypeScript compiles: cd mobile && npx tsc --noEmit
- [x] **T03: Synced web tailwind.config.ts with full Precision Velocity tokens — fontSize scale, glass blur, Navy-tinted shadows matching mobile** — 1. Read existing web/tailwind.config.ts
2. Map all Precision Velocity color tokens to Tailwind extend colors
3. Map typography (fontFamily, fontSize) to Tailwind extend
4. Map spacing, borderRadius, boxShadow values
5. Ensure token names match mobile theme.ts semantically
  - Estimate: 45min
  - Files: web/tailwind.config.ts
  - Verify: Tailwind build succeeds: cd web && npx tailwindcss --content './src/**/*.tsx' --output /dev/null
