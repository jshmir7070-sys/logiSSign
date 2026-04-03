---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T01: service_role 사용 감사 + 최소화

1. service_role 사용 10개 라우트 리스트업
2. 각 사용의 필요성 판단 (RLS 우회 필요 vs 불필요)
3. 불필요한 곳 전환 + 필요한 곳 주석 문서화
4. NEXT_PUBLIC_ 환경변수에 service_role 미노출 확인
5. build 확인

## Inputs

- `web/src/lib/supabase.ts`

## Expected Output

- `service_role 감사 결과 문서`

## Verification

build 성공 + NEXT_PUBLIC_*에 service_role 미노출
