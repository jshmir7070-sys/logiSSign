---
estimated_steps: 7
estimated_files: 9
skills_used: []
---

# T01: 웹 TypeScript 에러 전체 수정 (27개→0개)

1. web/src/types/database.ts에 settlements 테이블 누락 컬럼 추가 (delivery_amount, return_count, return_amount, pickup_count, pickup_amount, fresh_incentive, extra_incentive, gross_total, rate_mode, rate_percentage, route_details)
2. agencies 테이블에 excel_config, field_config 확인
3. tax_invoices에 invoice_type 확인 (vat_invoice, withholding_3_3 추가)
4. supabase/schema.sql도 동기화
5. 모든 서비스 파일의 as never 캐스트 제거하고 올바른 타입 사용
6. Recharts 차트 컴포넌트 타입 에러 수정
7. notices page null index 에러 수정

## Inputs

- `web/src/services/*.ts`
- `supabase/schema.sql`

## Expected Output

- `web/src/types/database.ts`
- `supabase/schema.sql`
- `web/src/services/*.ts (타입 정리)`
- `web/src/components/admin/charts/*.tsx`
- `web/src/app/portal/(dashboard)/notices/page.tsx`

## Verification

cd web && npx tsc --noEmit
