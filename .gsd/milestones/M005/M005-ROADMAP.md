# M005: 

## Vision
1,200줄 이상 대형 컴포넌트 3개를 분해하여 유지보수성을 확보한다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | 빌드 에러 수정 + as any 7건 제거 | medium | — | ✅ | npx next build 성공 + rg 'as any' 0건 |
| S02 | settings/page.tsx 분해 (1,268줄 → ~200줄) | medium | S01 | ⬜ | settings/page.tsx 300줄 이하 |
| S03 | drivers/new/page.tsx 분해 (1,414줄 → ~300줄) | medium | S01 | ⬜ | drivers/new/page.tsx 300줄 이하 |
| S04 | principals/page.tsx 분해 (1,351줄 → ~300줄) | medium | S01 | ⬜ | principals/page.tsx 400줄 이하 |
