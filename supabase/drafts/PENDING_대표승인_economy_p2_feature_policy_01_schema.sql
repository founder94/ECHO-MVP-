-- ============================================================
-- NEWLY AUTHORED · 2026-09-13 · 과거 원문 회수본 아님 · 운영 미적용 · 검사 결과 별도(p2_local/TEST_LOG)
-- ECONOMY P2 · 01 · Feature Policy 저장소 (설계명 key_feature_policies — 운영에 실존하지 않음, 2026-09-13 실측)
-- 기준: 검증된 P1 r2 (migration 20260913033639). P1 테이블·함수·원장은 변경하지 않는다.
-- ============================================================
-- [설계 원칙]
--   - 서버 권위: cost 는 이 테이블이 결정, key_spend 의 p_amount 는 대조값(불일치 = COST_MISMATCH)
--   - enabled 기본 false, 초기 row 0 → 이 파일만 적용해도 어떤 기능도 열리지 않는다
--   - 직접 접근 금지: anon/authenticated/service_role 모두 SELECT 불가. 오직 SECURITY DEFINER 인 public.key_spend 내부에서만 읽는다
--   - 가격·보상량·수수료·만료 정책 값은 여기서 확정하지 않는다(row 0)
create table public.key_feature_policies (
  feature          text        not null,
  cost             integer     not null,
  reward_allowed   boolean     not null default false,
  revenue_only     boolean     not null default false,
  payment_required boolean     not null default false,
  enabled          boolean     not null default false,
  policy_version   text        not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint key_feature_policies_pk primary key (feature),
  constraint key_feature_policies_feature_check check (feature ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  constraint key_feature_policies_cost_check check (cost > 0),
  constraint key_feature_policies_version_check check (btrim(policy_version) <> ''),
  -- revenue_only 와 reward_allowed 동시 true 는 모순 → 저장 단계에서 차단
  constraint key_feature_policies_bucket_rule_check check (not (revenue_only and reward_allowed))
);
comment on table public.key_feature_policies is 'ECONOMY P2 · 기능별 KEY 차감 서버 정책. key_spend 내부 조회 전용. 클라이언트 직접 접근 금지.';

alter table public.key_feature_policies enable row level security;
-- 정책 없음 = 모든 비소유 역할 차단. (RLS 는 테이블 소유자 postgres 에는 적용되지 않으므로 SECURITY DEFINER 함수만 읽는다)
revoke all on table public.key_feature_policies from public, anon, authenticated, service_role;

-- [영향] 신규 테이블 1개. 기존 서비스·B 결제·원장 영향 0. row 0 이므로 key_spend 는 여전히 FEATURE_POLICY_MISSING.
-- [복구] drop table public.key_feature_policies;
