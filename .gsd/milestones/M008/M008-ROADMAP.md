# M008: 

## Vision
Vercel 배포, 에러 모니터링(Sentry), SEO 기본 설정, 환경변수 문서화, 헬스체크를 갖추어 logissign.com을 프로덕션으로 안정적으로 운영할 수 있는 상태로 만든다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Sentry 에러 모니터링 연동 | high | — | ✅ | 의도적 에러 발생 → Sentry 대시보드에 수집 확인 |
| S02 | SEO 기본 설정 (robots, sitemap, OG) | low | — | ✅ | Google에서 logissign.com 크롤링 가능, SNS 공유 시 OG 카드 표시 |
| S03 | 환경변수 문서화 + 배포 가이드 | low | — | ✅ | .env.example 기반으로 새 개발자가 5분 이내 환경 세팅 가능 |
| S04 | 헬스체크 API + 배포 설정 검증 | medium | S01, S02, S03 | ✅ | /api/health 호출 → DB/Storage/Auth 상태 응답 + build 성공 |
