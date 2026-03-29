---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T03: Sync web tailwind.config.ts with Precision Velocity tokens

1. Read existing web/tailwind.config.ts
2. Map all Precision Velocity color tokens to Tailwind extend colors
3. Map typography (fontFamily, fontSize) to Tailwind extend
4. Map spacing, borderRadius, boxShadow values
5. Ensure token names match mobile theme.ts semantically

## Inputs

- `stitch/stitch_core/DESIGN.md`
- `web/tailwind.config.ts`

## Expected Output

- `web/tailwind.config.ts`

## Verification

Tailwind build succeeds: cd web && npx tailwindcss --content './src/**/*.tsx' --output /dev/null
