-- =====================================================================
-- DO IT COMPANY — ECONOMY P1 · KEY LEDGER SOURCE OF TRUTH
-- FINAL PRE-EXECUTION SQL PACKAGE (대표 승인본 · 회사모드)
-- 기준일: 2026-09-13
-- 상태: EXECUTION FORBIDDEN (대표의 별도 실행 승인 전 절대 실행 금지)
--
-- 최종 구조 (FINAL LOCK):
--   key_request_events  = command-level idempotency  (status: pending/applied)
--   key_ledger          = append-only Source of Truth (bucket: reward/revenue)
--   key_balances        = key_ledger 기반 balance cache
--
-- Revenue KEY / Reward KEY 는 별도 테이블 2벌로 나누지 않는다.
--   key_ledger.bucket      = revenue / reward
--   key_balances           = revenue_key / reward_key
--
-- 절대 원칙:
--   transactions = 진실, balance = 계산 결과, 프론트 state = 공식 장부 아님.
--
-- 구현 규칙 (기존 canonical 재사용, 임의 신규 방식 금지):
--   - 모든 함수: security definer + set search_path = '' + public. 완전 표기.
--   - payload_hash: 서버가 extensions.digest 로 결정적 생성(클라이언트 digest 금지).
--     입력은 jsonb_build_object 로 구조화(필드 경계 안전, NULL/공백/한글/줄바꿈 안전).
--   - idempotency: pg_advisory_xact_lock(hashtext(user_id), hashtext(request_id)) 직렬화.
--   - exact replay: applied + payload 동일 → result_json 그대로 반환(append 0, balance 변경 0).
--   - 요청 중복(request_id) 과 원인 중복(source+source_id) 은 분리하여 각각 차단.
--   - amount 는 delta, 0 금지. type별 부호는 RPC가 검증.
--   - key_ledger.user_id 는 FK 없음(RLS로 보호). 회원 탈퇴가 경제 원장을 자동 삭제 못 함.
--   - reverses_id 는 self-FK(NO ACTION). CASCADE 금지 → 원장 불변.
--   - 잔액 캐시 손상(원장 존재 + balance 행 누락) 시 0으로 만들어 진행하지 않고 오류 차단.
--
-- 권한 모델:
--   USER COMMAND  : key_spend (authenticated, auth.uid() 만 사용, p_user_id 없음)
--   SERVER COMMAND: key_charge_revenue / key_grant_reward / key_reverse (service_role only)
--   READ          : key_ledger / key_balances RLS 본인 SELECT (RPC 불필요)
--   key_request_events: 정책 0개 → 오직 SECURITY DEFINER RPC만 접근.
--
-- 선행 의존성:
--   pgcrypto 확장이 extensions 스키마에 설치돼 있어야 extensions.digest 사용 가능
--   (실DB 확인: PostgreSQL 17.6, pgcrypto 는 extensions 스키마에 설치됨).
-- =====================================================================

begin;

-- =====================================================================
-- PART 1. key_request_events — command-level idempotency
-- =====================================================================
create table public.key_request_events (
  id           uuid        not null default gen_random_uuid(),
  user_id      uuid        not null,
  request_id   uuid        not null,
  action       text        not null
    check (action in ('key_spend','key_charge_revenue','key_grant_reward','key_reverse')),
  payload_hash text        not null,
  status       text        not null default 'pending'
    check (status in ('pending','applied')),
  result_json  jsonb,                          -- 최초 성공 응답 (exact replay 용)
  created_at   timestamptz not null default now(),
  applied_at   timestamptz,
  constraint key_request_events_pk primary key (id),
  constraint key_request_events_once unique (user_id, request_id)
);

-- =====================================================================
-- PART 2. key_ledger — append-only Source of Truth
-- =====================================================================
create table public.key_ledger (
  id             uuid        not null default gen_random_uuid(),
  user_id        uuid        not null,         -- FK 없음(기존 패턴). RLS로 보호.
  request_id     uuid        not null,         -- command 참조. unique 아님(1→N row 허용)
  type           text        not null
    check (type in ('charge','grant','spend','expiry','clawback','reversal')),
  bucket         text        not null
    check (bucket in ('reward','revenue')),
  amount         integer     not null check (amount <> 0),  -- delta (0 금지)
  source         text        not null,         -- mission/exit_feedback/referral/just_try/admin_correction/toss/feature
  source_id      text,                         -- 원인 식별(주문·미션·피드백 id). charge/grant 는 RPC에서 필수.
  policy_version text,                         -- nullable. reward 정책 거래만 필수(RPC 검증)
  reason         text        not null,
  reverses_id    uuid        references public.key_ledger (id),  -- reversal 원거래. CASCADE 금지(NO ACTION)
  expires_at     timestamptz,                  -- reward 만료 추적(정책 UNDECIDED → P1 비활성)
  created_at     timestamptz not null default now(),
  constraint key_ledger_pk primary key (id)
);

-- =====================================================================
-- PART 3. key_balances — key_ledger 기반 balance cache
-- =====================================================================
create table public.key_balances (
  user_id      uuid        not null,
  reward_key   integer     not null default 0 check (reward_key >= 0),
  revenue_key  integer     not null default 0 check (revenue_key >= 0),
  updated_at   timestamptz not null default now(),
  constraint key_balances_pk primary key (user_id)
);

-- =====================================================================
-- PART 4. INDEXES
-- =====================================================================
create index key_request_events_status_idx
  on public.key_request_events (user_id, action, status);

create index key_ledger_user_created_idx
  on public.key_ledger (user_id, created_at desc);
create index key_ledger_request_idx
  on public.key_ledger (user_id, request_id);
create index key_ledger_source_idx
  on public.key_ledger (source, source_id);
create index key_ledger_reverses_idx
  on public.key_ledger (reverses_id);

-- 원인 중복 방지(부분 unique): 같은 사용자에게 같은 원인(source, source_id)의
-- charge/grant 를 재지급 금지. spend/reversal 은 source_id null → 제외.
-- RPC 사전 검사(CAUSE_ALREADY_APPLIED) + 이 고유 인덱스(동시성 원자 보장) 이중 방어.
create unique index key_ledger_cause_uniq
  on public.key_ledger (user_id, source, source_id)
  where source_id is not null;

-- =====================================================================
-- PART 5. ENABLE RLS
-- =====================================================================
alter table public.key_request_events enable row level security;
alter table public.key_ledger enable row level security;
alter table public.key_balances enable row level security;

-- =====================================================================
-- PART 6. CREATE POLICY
--   key_request_events: 정책 0개(기본 deny). SECURITY DEFINER RPC만 접근.
--   key_ledger / key_balances: authenticated 본인 SELECT만. 쓰기 직접 금지.
-- =====================================================================
create policy "key_ledger_select_own" on public.key_ledger
  for select to authenticated
  using (auth.uid() = user_id);

create policy "key_balances_select_own" on public.key_balances
  for select to authenticated
  using (auth.uid() = user_id);

-- (선택) 관리자 읽기: 기존 public.is_admin() 재사용(신규 함수 생성 금지).
-- P11 Admin Economy 에서 필요 시 아래 정책 추가(이번 실행 금지).
-- create policy "key_ledger_select_admin" on public.key_ledger
--   for select using (public.is_admin());
-- create policy "key_balances_select_admin" on public.key_balances
--   for select using (public.is_admin());

-- =====================================================================
-- PART 7. TABLE GRANT / REVOKE
-- =====================================================================
revoke all on public.key_request_events from public, anon, authenticated;
revoke all on public.key_ledger from public, anon, authenticated;
revoke all on public.key_balances from public, anon, authenticated;

grant select on public.key_ledger, public.key_balances to authenticated;
-- (key_request_events 는 어떤 role 에도 grant 하지 않는다 → RPC 전용)

-- =====================================================================
-- PART 8. key_spend — USER COMMAND (authenticated)
--   p_user_id 없음. 사용자 식별은 auth.uid() 만.
--   p_amount 는 "사용자가 확인한 예상 비용"일 뿐, 실제 비용은 서버 정책(v_policy.cost)이 결정.
--   서버 비용 ≠ p_amount → COST_MISMATCH 차단(임의 더 차감 금지).
--   차감 분기: revenue_only / reward_allowed / payment_required 를 실제로 반영.
--   P1: feature 정책 저장소 미구현 → FEATURE_POLICY_MISSING 으로 항상 차단(안전 기본값).
-- =====================================================================
create or replace function public.key_spend(
  p_request_id uuid,
  p_amount     integer,
  p_feature    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid              uuid := auth.uid();
  v_payload_hash     text;
  v_evt              public.key_request_events%rowtype;
  v_policy           jsonb;
  v_reward_allowed   boolean;
  v_revenue_only     boolean;
  v_payment_required boolean;
  v_server_cost      integer;
  v_reward_bal       integer;
  v_revenue_bal      integer;
  v_from_reward      integer;
  v_from_revenue     integer;
  v_result           jsonb;
begin
  -- (1) 인증
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  -- (2) 입력 검증
  if p_request_id is null then
    raise exception 'INVALID_REQUEST_ID' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_feature is null or btrim(p_feature) = '' then
    raise exception 'INVALID_FEATURE' using errcode = '22023';
  end if;

  -- (3) command-level advisory lock
  perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(p_request_id::text));

  -- (4) 서버 결정 payload hash
  v_payload_hash := encode(extensions.digest(
    jsonb_build_object('action','key_spend','amount',p_amount,'feature',p_feature)::text, 'sha256'), 'hex');

  -- (5) idempotency + 응답 무결성 (action / payload_hash / 상태 일관성 대조)
  select * into v_evt from public.key_request_events
    where user_id = v_uid and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from 'key_spend' then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.payload_hash is distinct from v_payload_hash then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then
        raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001';
      end if;
      -- exact replay: 최초 성공 응답 그대로 반환 (ledger append 0, balance 변경 0)
      return v_evt.result_json;
    end if;
    -- 영속 pending 은 lock 하에서 도달 불가한 손상 상태 → 이어가지 않고 차단
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (v_uid, p_request_id, 'key_spend', v_payload_hash, 'pending')
      returning * into v_evt;
  end if;

  -- (6) feature 결제 정책 (서버 결정. 프론트가 reward_allowed/revenue_only 지정 금지)
  --     P1: feature 정책 저장소 미구현 → FEATURE_POLICY_MISSING 차단(비활성).
  --     정책 저장소(별도 PHASE) 구현 시 아래를 실제 조회로 교체.
  --     v_policy := (select to_jsonb(p) from public.key_feature_policies p where p.feature = p_feature);
  v_policy := null;
  if v_policy is null then
    raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  v_reward_allowed   := coalesce((v_policy->>'reward_allowed')::boolean, false);
  v_revenue_only     := coalesce((v_policy->>'revenue_only')::boolean, false);
  v_payment_required := coalesce((v_policy->>'payment_required')::boolean, false);

  -- 서버 정책 비용 결정 + 사용자 확인 예상 비용 대조
  v_server_cost := coalesce((v_policy->>'cost')::integer, 0);
  if v_server_cost <= 0 then
    raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001';
  end if;
  if v_server_cost <> p_amount then
    raise exception 'COST_MISMATCH' using errcode = 'P0001';
  end if;

  if v_payment_required then
    raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001';
  end if;

  -- (7) 잔액 행 확보 + 캐시 손상 감지 + FOR UPDATE
  --     원장은 있는데 balance 행만 없으면 0으로 만들어 정상 진행하지 않는다.
  if not exists (select 1 from public.key_balances where user_id = v_uid) then
    if exists (select 1 from public.key_ledger where user_id = v_uid) then
      raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001';
    end if;
    insert into public.key_balances (user_id) values (v_uid);
  end if;
  select reward_key, revenue_key into v_reward_bal, v_revenue_bal
    from public.key_balances where user_id = v_uid for update;

  -- (8) 차감 계산 — 정책 분기 실제 반영
  --     revenue_only=true            → Revenue 만 사용
  --     revenue_only=false & reward_allowed=true  → Reward 우선, 부족분 Revenue
  --     revenue_only=false & reward_allowed=false → Revenue 만 사용 (Reward 대체 차감 금지)
  if v_revenue_only or not v_reward_allowed then
    if v_revenue_bal < p_amount then
      raise exception 'INSUFFICIENT_REVENUE' using errcode = 'P0001';
    end if;
    v_from_reward  := 0;
    v_from_revenue := p_amount;
  else
    if (v_reward_bal::bigint + v_revenue_bal::bigint) < p_amount then
      raise exception 'INSUFFICIENT' using errcode = 'P0001';
    end if;
    v_from_reward  := least(v_reward_bal, p_amount);
    v_from_revenue := p_amount - v_from_reward;
  end if;

  -- (9) key_ledger append (1~N행, 동일 request_id)
  if v_from_reward > 0 then
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, reason)
      values (v_uid, p_request_id, 'spend', 'reward', -v_from_reward, p_feature, 'spend');
  end if;
  if v_from_revenue > 0 then
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, reason)
      values (v_uid, p_request_id, 'spend', 'revenue', -v_from_revenue, p_feature, 'spend');
  end if;

  -- (10) key_balances 갱신 (원자)
  update public.key_balances
     set reward_key  = reward_key  - v_from_reward,
         revenue_key = revenue_key - v_from_revenue,
         updated_at  = now()
   where user_id = v_uid;

  -- (11) 최초 성공 응답 구성 + result_json 저장
  v_result := jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'spent', jsonb_build_object('reward', v_from_reward, 'revenue', v_from_revenue),
    'balance', jsonb_build_object(
      'reward', v_reward_bal - v_from_reward,
      'revenue', v_revenue_bal - v_from_revenue)
  );

  update public.key_request_events
     set status = 'applied', result_json = v_result, applied_at = now()
   where id = v_evt.id;

  return v_result;
exception
  when others then raise;  -- 검증 실패 시 전체 ROLLBACK (pending 영속 없음)
end;
$$;

-- =====================================================================
-- PART 9. key_charge_revenue — SERVER COMMAND (service_role only)
--   Revenue KEY 는 Toss confirm 후 서버 검증 경로에서만 생성.
--   source_id 는 실제 결제/주문 식별자(필수). 같은 원인 재충전 금지(원인 중복 방지).
-- =====================================================================
create or replace function public.key_charge_revenue(
  p_user_id    uuid,
  p_request_id uuid,
  p_amount     integer,
  p_source     text,
  p_source_id  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload_hash text;
  v_evt          public.key_request_events%rowtype;
  v_revenue_bal  integer;
  v_result       jsonb;
begin
  -- 입력 검증
  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'INVALID_REQUEST_ID' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_source is null or btrim(p_source) = '' then
    raise exception 'INVALID_SOURCE' using errcode = '22023';
  end if;
  -- 원인 식별자는 실제 결제/주문 식별자. NULL/빈/공백 거부.
  if p_source_id is null or btrim(p_source_id) = '' then
    raise exception 'INVALID_SOURCE_ID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  v_payload_hash := encode(extensions.digest(
    jsonb_build_object('action','key_charge_revenue','amount',p_amount,'source',p_source,'sourceId',p_source_id)::text, 'sha256'), 'hex');

  select * into v_evt from public.key_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from 'key_charge_revenue' then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.payload_hash is distinct from v_payload_hash then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then
        raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001';
      end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, 'key_charge_revenue', v_payload_hash, 'pending')
      returning * into v_evt;
  end if;

  -- 원인 중복 사전 검사 (같은 사용자 + 같은 원인 재충전 금지)
  --   동시 요청은 아래 key_ledger_cause_uniq 고유 인덱스가 원자적으로 차단.
  if exists (
    select 1 from public.key_ledger
    where user_id = p_user_id and source = p_source and source_id = p_source_id
  ) then
    raise exception 'CAUSE_ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  -- 잔액 행 확보 + 캐시 손상 감지 + FOR UPDATE
  if not exists (select 1 from public.key_balances where user_id = p_user_id) then
    if exists (select 1 from public.key_ledger where user_id = p_user_id) then
      raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001';
    end if;
    insert into public.key_balances (user_id) values (p_user_id);
  end if;
  select revenue_key into v_revenue_bal from public.key_balances
    where user_id = p_user_id for update;

  -- 정수 범위 안전성 (bigint 계산 후 integer 범위 확인)
  if p_amount::bigint + v_revenue_bal::bigint > 2147483647 then
    raise exception 'AMOUNT_OVERFLOW' using errcode = '22003';
  end if;

  -- ledger append: charge/revenue +N (delta 양수)
  insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, source_id, reason)
    values (p_user_id, p_request_id, 'charge', 'revenue', p_amount, p_source, p_source_id, 'revenue charge');

  update public.key_balances
     set revenue_key = revenue_key + p_amount, updated_at = now()
   where user_id = p_user_id;

  v_result := jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'charged', p_amount,
    'balance', jsonb_build_object('revenue', v_revenue_bal + p_amount)
  );

  update public.key_request_events
     set status = 'applied', result_json = v_result, applied_at = now()
   where id = v_evt.id;

  return v_result;
exception
  when others then raise;
end;
$$;

-- =====================================================================
-- PART 10. key_grant_reward — SERVER COMMAND (service_role only)
--   Reward 지급은 검증된 서버 상태머신에서만. policy_version 필수.
--   source_id 는 실제 행동/보상 자격 식별자(필수). 같은 자격 재지급 금지.
--   P1: 만료 정책 미확정 → 비어있지 않은 expires_at 은 EXPIRY_POLICY_UNDECIDED 차단.
-- =====================================================================
create or replace function public.key_grant_reward(
  p_user_id        uuid,
  p_request_id     uuid,
  p_amount         integer,
  p_source         text,
  p_source_id      text,
  p_policy_version text,
  p_expires_at     timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload_hash text;
  v_evt          public.key_request_events%rowtype;
  v_reward_bal   integer;
  v_result       jsonb;
begin
  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'INVALID_REQUEST_ID' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_source is null or btrim(p_source) = '' then
    raise exception 'INVALID_SOURCE' using errcode = '22023';
  end if;
  -- 원인 식별자는 실제 행동/보상 자격 식별자. NULL/빈/공백 거부.
  if p_source_id is null or btrim(p_source_id) = '' then
    raise exception 'INVALID_SOURCE_ID' using errcode = '22023';
  end if;
  -- reward 정책 거래는 policy_version 필수 (Revenue charge 는 요구하지 않음)
  if p_policy_version is null or btrim(p_policy_version) = '' then
    raise exception 'POLICY_VERSION_REQUIRED' using errcode = '22023';
  end if;
  -- 만료 정책 미확정 → 비어있지 않은 expires_at 요청은 차단(화면/실사용 잔액 괴리 방지)
  if p_expires_at is not null then
    raise exception 'EXPIRY_POLICY_UNDECIDED' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  v_payload_hash := encode(extensions.digest(
    jsonb_build_object(
      'action','key_grant_reward',
      'amount',p_amount,
      'source',p_source,
      'sourceId',p_source_id,
      'policyVersion',p_policy_version,
      'expiresAt',(p_expires_at at time zone 'UTC'))::text, 'sha256'), 'hex');

  select * into v_evt from public.key_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from 'key_grant_reward' then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.payload_hash is distinct from v_payload_hash then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then
        raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001';
      end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, 'key_grant_reward', v_payload_hash, 'pending')
      returning * into v_evt;
  end if;

  -- 원인 중복 사전 검사 (같은 사용자 + 같은 원인 재지급 금지)
  if exists (
    select 1 from public.key_ledger
    where user_id = p_user_id and source = p_source and source_id = p_source_id
  ) then
    raise exception 'CAUSE_ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  -- 잔액 행 확보 + 캐시 손상 감지 + FOR UPDATE
  if not exists (select 1 from public.key_balances where user_id = p_user_id) then
    if exists (select 1 from public.key_ledger where user_id = p_user_id) then
      raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001';
    end if;
    insert into public.key_balances (user_id) values (p_user_id);
  end if;
  select reward_key into v_reward_bal from public.key_balances
    where user_id = p_user_id for update;

  -- 정수 범위 안전성
  if p_amount::bigint + v_reward_bal::bigint > 2147483647 then
    raise exception 'AMOUNT_OVERFLOW' using errcode = '22003';
  end if;

  -- ledger append: grant/reward +N (delta 양수)
  insert into public.key_ledger
    (user_id, request_id, type, bucket, amount, source, source_id, policy_version, reason, expires_at)
  values
    (p_user_id, p_request_id, 'grant', 'reward', p_amount, p_source, p_source_id, p_policy_version, 'reward grant', p_expires_at);

  update public.key_balances
     set reward_key = reward_key + p_amount, updated_at = now()
   where user_id = p_user_id;

  v_result := jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'granted', p_amount,
    'balance', jsonb_build_object('reward', v_reward_bal + p_amount)
  );

  update public.key_request_events
     set status = 'applied', result_json = v_result, applied_at = now()
   where id = v_evt.id;

  return v_result;
exception
  when others then raise;
end;
$$;

-- =====================================================================
-- PART 11. key_reverse — SERVER COMMAND (service_role only)
--   reversal 은 기존 row UPDATE/DELETE 금지, 새 row append.
--   부분 reversal 허용. 누적 절대값이 원거래 절대값 초과 금지.
--   reversal of reversal 은 P1 에서 금지.
--   누적/abs 계산은 bigint 로 수행(integer 오버플로·abs(min int) 방지).
-- =====================================================================
create or replace function public.key_reverse(
  p_user_id        uuid,
  p_request_id     uuid,
  p_original_tx_id uuid,
  p_amount         integer,   -- signed reversal delta (원거래 반대 부호)
  p_reason         text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload_hash text;
  v_evt          public.key_request_events%rowtype;
  v_original     public.key_ledger%rowtype;
  v_reversed_sum bigint;
  v_bal          integer;
  v_result       jsonb;
begin
  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'INVALID_REQUEST_ID' using errcode = '22023';
  end if;
  if p_original_tx_id is null then
    raise exception 'ORIGINAL_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  v_payload_hash := encode(extensions.digest(
    jsonb_build_object('action','key_reverse','originalTxId',p_original_tx_id,'amount',p_amount,'reason',p_reason)::text, 'sha256'), 'hex');

  select * into v_evt from public.key_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from 'key_reverse' then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.payload_hash is distinct from v_payload_hash then
      raise exception 'REQUEST_CONFLICT' using errcode = '40900';
    end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then
        raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001';
      end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, 'key_reverse', v_payload_hash, 'pending')
      returning * into v_evt;
  end if;

  -- 원거래 잠금 + 검증
  select * into v_original from public.key_ledger
    where id = p_original_tx_id
    for update;

  if not found then
    raise exception 'ORIGINAL_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_original.user_id <> p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_original.type = 'reversal' then
    -- P1: reversal of reversal 금지(감사 단순화). correction 은 별도 PHASE.
    raise exception 'REVERSAL_OF_REVERSAL_FORBIDDEN' using errcode = 'P0001';
  end if;

  -- 방향 검증: reversal amount 부호는 원거래 반대
  if (p_amount > 0 and v_original.amount > 0) or (p_amount < 0 and v_original.amount < 0) then
    raise exception 'INVALID_REVERSAL_DIRECTION' using errcode = 'P0001';
  end if;

  -- 누적 reversal 계산 + over-reversal 차단 (bigint 로 안전 계산)
  select coalesce(sum(amount::bigint), 0) into v_reversed_sum
    from public.key_ledger where reverses_id = p_original_tx_id;

  if abs(v_reversed_sum + p_amount::bigint) > abs(v_original.amount::bigint) then
    raise exception 'OVER_REVERSAL' using errcode = 'P0001';
  end if;

  -- reversal append (bucket = 원거래 bucket, sign = 원거래 반대)
  insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, reason, reverses_id)
    values (p_user_id, p_request_id, 'reversal', v_original.bucket, p_amount, v_original.source, p_reason, p_original_tx_id);

  -- balance 보정 (명시 잔액 검사 + DB CHECK 이중 방어)
  --   원거래가 존재하므로 원장은 반드시 존재 → balance 행 없으면 캐시 손상.
  if not exists (select 1 from public.key_balances where user_id = p_user_id) then
    raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001';
  end if;

  if v_original.bucket = 'reward' then
    select reward_key into v_bal from public.key_balances
      where user_id = p_user_id for update;
    if v_bal::bigint + p_amount::bigint < 0 then
      raise exception 'REVERSAL_INSUFFICIENT_BALANCE' using errcode = 'P0001';
    end if;
    update public.key_balances set reward_key = reward_key + p_amount, updated_at = now()
      where user_id = p_user_id returning reward_key into v_bal;
  else
    select revenue_key into v_bal from public.key_balances
      where user_id = p_user_id for update;
    if v_bal::bigint + p_amount::bigint < 0 then
      raise exception 'REVERSAL_INSUFFICIENT_BALANCE' using errcode = 'P0001';
    end if;
    update public.key_balances set revenue_key = revenue_key + p_amount, updated_at = now()
      where user_id = p_user_id returning revenue_key into v_bal;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'reversed', p_amount,
    'balance', jsonb_build_object(v_original.bucket, v_bal)
  );

  update public.key_request_events
     set status = 'applied', result_json = v_result, applied_at = now()
   where id = v_evt.id;

  return v_result;
exception
  when others then raise;
end;
$$;

-- =====================================================================
-- PART 12. FUNCTION GRANT / REVOKE
-- =====================================================================
-- USER COMMAND (authenticated)
revoke all on function public.key_spend(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.key_spend(uuid, integer, text) to authenticated;

-- SERVER COMMAND (service_role only)
revoke all on function public.key_charge_revenue(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.key_charge_revenue(uuid, uuid, integer, text, text) to service_role;

revoke all on function public.key_grant_reward(uuid, uuid, integer, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.key_grant_reward(uuid, uuid, integer, text, text, text, timestamptz) to service_role;

revoke all on function public.key_reverse(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.key_reverse(uuid, uuid, uuid, integer, text) to service_role;

commit;

-- =====================================================================
-- 검증·복구 SQL 은 별도 파일로 분리.
--   검증(읽기 전용):  PENDING_대표승인_economy_p1_key_ledger_verify.sql
--   격리 테스트:      PENDING_대표승인_economy_p1_key_ledger_test.sql
--   복구(변경, STOP): PENDING_대표승인_economy_p1_key_ledger_repair.sql
-- =====================================================================