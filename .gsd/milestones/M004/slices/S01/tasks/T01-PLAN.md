---
estimated_steps: 3
estimated_files: 1
skills_used: []
---

# T01: 미사용 import 45건 + console 정리

1. npx next build로 미사용 import 목록 추출
2. 각 파일에서 미사용 변수/import 제거
3. 재빌드로 0건 확인

## Inputs

- None specified.

## Expected Output

- `ESLint 경고 0건`

## Verification

cd web && npx next build 2>&1 | grep -c 'defined but never used'
