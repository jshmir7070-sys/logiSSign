-- 025: 포인트형 플랜을 별도 플랜에서 제거하고 free로 통합
-- free 플랜이 포인트 충전형 역할을 겸함

-- 1) 기존 point 플랜 → free로 변경
UPDATE agencies SET plan = 'free' WHERE plan = 'point';

-- 2) plan CHECK 제약 변경 (point 제거)
ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_plan_check;
ALTER TABLE agencies ADD CONSTRAINT agencies_plan_check
  CHECK (plan IN ('free', 'basic', 'standard', 'pro', 'enterprise'));

-- 3) max_drivers 기본값 5로 통일 (코드와 일치)
ALTER TABLE agencies ALTER COLUMN max_drivers SET DEFAULT 5;

-- 4) plan_configs에서 point 행 삭제 (동적 설정 테이블)
DELETE FROM plan_configs WHERE plan = 'point';

-- 5) plan_configs의 free 행 업데이트
UPDATE plan_configs
SET max_drivers = 5,
    max_admin_accounts = 0,
    label = 'Free (포인트 충전형)',
    description = '모든 기능 사용 가능, 포인트 차감 방식'
WHERE plan = 'free';

-- 6) subscriptions 테이블의 point → free
UPDATE subscriptions SET plan = 'free' WHERE plan = 'point';

-- 7) plan_change_log에서 참조 정리 (기록은 유지, 조회 시 하위호환)
-- 별도 조치 불필요 (기존 로그는 히스토리로 보존)
