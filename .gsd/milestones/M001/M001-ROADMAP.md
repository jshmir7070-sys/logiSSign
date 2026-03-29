# M001: Full-Stack Foundation — Mobile + Web + Supabase Integration

## Vision
Establish a working full-stack foundation where mobile app (driver-facing), web portal (agency admin), and Supabase backend are connected end-to-end. Auth works, core CRUD flows are live, and the Precision Velocity design system is consistently applied across both surfaces.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Design System & Tokens Unification | low | — | ✅ | theme.ts and tailwind.config.ts both export identical Precision Velocity color/spacing/typography tokens |
| S02 | Supabase Backend & Auth Foundation | medium | — | ✅ | Supabase tables deployed, RLS policies active, auth signup/login/logout works with role-based JWT claims |
| S03 | 웹 포털 — 정산서 생성 & 전자계약 관리 | medium | S01, S02 | ✅ | 운영사가 엑셀 업로드로 정산서 생성하고, 계약서 템플릿으로 전자계약을 기사에게 발송할 수 있다 |
| S04 | 모바일 앱 — 정산 확인 & 전자서명 | medium | S01, S02, S03 | ✅ | 기사가 앱에서 정산서를 확인하고, 전자계약서에 서명할 수 있다 |
