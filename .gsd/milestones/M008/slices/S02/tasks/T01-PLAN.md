---
estimated_steps: 4
estimated_files: 3
skills_used: []
---

# T01: robots.txt + sitemap + OG 메타 적용

1. web/src/app/robots.ts — Next.js robots() 함수
2. web/src/app/sitemap.ts — Next.js sitemap() 함수
3. web/src/app/layout.tsx에 metadata 추가 (title, description, OG)
4. build 확인

## Inputs

- `web/src/app/layout.tsx`

## Expected Output

- `web/src/app/robots.ts`
- `web/src/app/sitemap.ts`
- `web/src/app/layout.tsx (수정)`

## Verification

build 성공 + robots.ts/sitemap.ts 파일 존재
