---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T03: 전자계약 핵심 페이지 완성 (템플릿→발송→관리)

1. 계약서 목록 페이지 (contracts/page) 검토
2. 계약서 템플릿 관리 페이지 (contracts/templates) 검토
3. 계약서 발송 기능이 contract.service.ts와 연결 확인
4. 계약서 상태별 필터링 (전체/서명완료/서명대기/만료)
5. 필요시 계약서 상세보기/서명현황 페이지 추가

## Inputs

- `web/src/services/contract.service.ts`

## Expected Output

- `web/src/app/portal/(dashboard)/contracts/page.tsx`
- `web/src/app/portal/(dashboard)/contracts/templates/page.tsx`

## Verification

cd web && npm run build
