---
estimated_steps: 5
estimated_files: 4
skills_used: []
---

# T02: 로그인 + 정산 확인 화면

1. 로그인 화면 — Supabase Auth signIn 연동, Precision Velocity 디자인
2. 정산 탭 화면 — 월별 정산 목록 (year_month, delivery_count, total_amount, net_amount, status)
3. 정산 상세 — 항목별 금액, 차감 내역
4. mobile/services/settlement.service.ts 생성
5. TanStack Query로 데이터 패칭

## Inputs

- `stitch/settlement/`
- `stitch/login/`

## Expected Output

- `mobile/app/(auth)/login.tsx`
- `mobile/app/(tabs)/settlement.tsx`
- `mobile/app/settlement/[id].tsx`
- `mobile/services/settlement.service.ts`

## Verification

cd mobile && npx tsc --noEmit
