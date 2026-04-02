---
estimated_steps: 1
estimated_files: 6
skills_used: []
---

# T02: as any 7건 안전 타입 교체

1) Recharts formatter 4건: ContentType 또는 실제 타입 사용\n2) verification.service.ts rpc 1건: Supabase 타입 확장\n3) settings 3건: (doc as any).recipients → 타입 확장

## Inputs

- None specified.

## Expected Output

- `as any 0건`
- `빌드 성공`
- `테스트 통과`

## Verification

cd web && rg 'as any' src/ --count-matches && npx next build && npm test
