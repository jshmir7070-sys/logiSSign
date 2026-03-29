---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T01: 정산서 노출항목 체크 + 미리보기 UI

1. principals/[id]/page.tsx에 정산서 노출항목 설정 섹션 추가
2. FieldConfig에 settlement_display 필드 추가 (기사에게 보여줄 항목 체크)
3. 체크박스: 배송건수, 배송금액, 반품건수, 반품금액, 인센티브, 프레쉬백, 차감상세, 부가세, 총수입, 총차감, 순지급액
4. 미리보기 패널: 체크된 항목만 보이는 모바일 앱 스타일 정산서 레이아웃
5. field_config 저장 시 settlement_display 포함

## Inputs

- `web/src/services/principal.service.ts`

## Expected Output

- `web/src/app/portal/(dashboard)/principals/[id]/page.tsx`
- `web/src/services/principal.service.ts`

## Verification

cd web && npm run build
