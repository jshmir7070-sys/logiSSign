# M003: 

## Vision
schema.sql을 라이브 Supabase에 배포하고, 웹/모바일 앱이 실제 데이터로 작동하는지 확인한다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Supabase 스키마 배포 | medium | — | ✅ | Supabase 대시보드에서 19개 테이블 확인 가능 |
| S02 | Auth 수정 + Seed 데이터 | high | S01 | ⬜ | 포털 로그인 → 대시보드 진입, 기사/원청사 목록에 seed 데이터 표시 |
| S03 | Server-side Auth 컨텍스트 수정 | high | S02 | ✅ | 로그인한 운영사만 자기 데이터 조회 가능, 타 운영사 데이터 차단 |
| S04 | Portal E2E: 원청사 → 기사 → 계약 CRUD | medium | S03 | ✅ | 원청사 등록 → 기사 등록 → 계약 생성 → 계약 목록에 표시 |
| S05 | 정산 Excel 업로드 → 생성 → 조회 | medium | S04 | ✅ | Excel 업로드 → 정산서 자동 생성 → 기사별 정산 상세 조회 |
| S06 | 계약 PDF 생성 + 서명 + QR 진위확인 | high | S04 | ✅ | 계약서 PDF 생성 → 기사 서명 → QR코드 스캔으로 진위 확인 |
| S07 | SMS 연동 (Solapi) | medium | S04 | ✅ | 기사 초대 SMS 발송 → 수신 확인 |
| S08 | Supabase Storage + 파일 업로드 | low | S03 | ✅ | 사업자등록증 업로드 → 저장 → 다운로드 확인 |
| S09 | 모바일 연동 테스트 | medium | S02 | ✅ | 모바일 앱에서 기사 로그인 → 계약 조회 → 정산 조회 → 서명 |
