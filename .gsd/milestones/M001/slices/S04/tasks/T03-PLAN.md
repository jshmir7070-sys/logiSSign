---
estimated_steps: 5
estimated_files: 5
skills_used: []
---

# T03: 전자계약 목록 + 전자서명 화면

1. 계약서 목록 화면 — 서명대기/서명완료/만료 상태 표시
2. 계약서 상세 — 계약 내용 표시 (ScrollView)
3. 전자서명 화면 — SignaturePad 컴포넌트, 서명 이미지 캡처
4. 서명 완료 처리 — contract_signatures 저장, contracts.status → signed
5. mobile/services/contract.service.ts 생성

## Inputs

- `stitch/app_signing/`

## Expected Output

- `mobile/app/(tabs)/contracts.tsx`
- `mobile/app/contract/[id].tsx`
- `mobile/app/contract/sign/[id].tsx`
- `mobile/components/common/SignaturePad.tsx`
- `mobile/services/contract.service.ts`

## Verification

cd mobile && npx tsc --noEmit
