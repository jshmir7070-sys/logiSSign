# S02: SEO 기본 설정 (robots, sitemap, OG)

**Goal:** robots.txt, sitemap.xml, OG 메타태그, 페이지별 metadata 적용
**Demo:** After this: Google에서 logissign.com 크롤링 가능, SNS 공유 시 OG 카드 표시

## Tasks
- [x] **T01: robots.txt + sitemap.xml + OG/Twitter 메타태그 완성** — 1. web/src/app/robots.ts — Next.js robots() 함수
2. web/src/app/sitemap.ts — Next.js sitemap() 함수
3. web/src/app/layout.tsx에 metadata 추가 (title, description, OG)
4. build 확인
  - Estimate: 10min
  - Files: web/src/app/robots.ts, web/src/app/sitemap.ts, web/src/app/layout.tsx
  - Verify: build 성공 + robots.ts/sitemap.ts 파일 존재
