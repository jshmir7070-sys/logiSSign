# M005: 

## Vision
빌드 에러를 수정하고, as any 7건을 안전한 타입으로 교체하여 프로덕션 빌드 통과 + 타입 경고 0건을 달성한다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | 빌드 에러 수정 + as any 7건 제거 | medium | — | ⬜ | npx next build 성공 + rg 'as any' 0건 |
