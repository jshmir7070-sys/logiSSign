---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T02: Complete mobile theme.ts with all Precision Velocity tokens

1. Read existing mobile/constants/theme.ts
2. Add any missing color tokens from DESIGN.md
3. Add complete typography scale with Pretendard/Inter font families
4. Add elevation/shadow tokens
5. Add border radius tokens
6. Export typed token objects with 'as const'

## Inputs

- `stitch/stitch_core/DESIGN.md`
- `mobile/constants/theme.ts`

## Expected Output

- `mobile/constants/theme.ts`

## Verification

TypeScript compiles: cd mobile && npx tsc --noEmit
