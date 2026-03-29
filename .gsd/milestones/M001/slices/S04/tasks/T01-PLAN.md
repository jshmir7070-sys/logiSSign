---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T01: 공통 UI 컴포넌트 + 누락 패키지 설치

1. expo-linear-gradient, @expo/vector-icons 설치
2. Button (primary/secondary/outline/ghost) 구현
3. Card, Input, Badge, Header, ListItem, StatCard, EmptyState, LoadingSpinner 구현
4. 모든 컴포넌트 theme.ts 토큰만 사용
5. TypeScript Props interface 정의
6. StyleSheet.create 사용

## Inputs

- `mobile/constants/theme.ts`

## Expected Output

- `mobile/components/common/Button.tsx`
- `mobile/components/common/Card.tsx`
- `mobile/components/common/Input.tsx`
- `mobile/components/common/Badge.tsx`
- `mobile/components/common/Header.tsx`
- `mobile/components/common/ListItem.tsx`
- `mobile/components/common/StatCard.tsx`
- `mobile/components/common/EmptyState.tsx`
- `mobile/components/common/LoadingSpinner.tsx`

## Verification

cd mobile && npx tsc --noEmit
