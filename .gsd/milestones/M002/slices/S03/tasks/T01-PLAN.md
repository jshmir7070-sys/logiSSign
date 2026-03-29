---
estimated_steps: 5
estimated_files: 5
skills_used: []
---

# T01: 탭바 수정 + 나머지 화면 연동

1. (tabs)/_layout.tsx에 계약 탭 추가 (5번째 탭)
2. 홈 탭 — Supabase에서 기사 정보 + 오늘 정산 요약 표시
3. 공지 탭 — notices 테이블에서 데이터 패칭
4. 프로필 탭 — 기사 정보 + 로그아웃 버튼
5. mobile/services/notice.service.ts 생성

## Inputs

- `mobile/components/common/`
- `mobile/stores/authStore.ts`

## Expected Output

- `mobile/app/(tabs)/_layout.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/notice.tsx`
- `mobile/app/(tabs)/profile.tsx`
- `mobile/services/notice.service.ts`

## Verification

cd mobile && npx tsc --noEmit
