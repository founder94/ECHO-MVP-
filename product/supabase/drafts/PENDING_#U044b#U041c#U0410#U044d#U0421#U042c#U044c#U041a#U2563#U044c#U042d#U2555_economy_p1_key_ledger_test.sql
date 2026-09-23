-- =====================================================================
-- DO IT COMPANY — ECONOMY P1 · KEY LEDGER
-- PART C — ISOLATED TEST PACKAGE (격리 테스트)
-- 기준일: 2026-09-13
--
-- [실행 전제]
--   1) 운영과 무관한 "격리된" PostgreSQL 에서만 실행. 운영 키·데이터 금지.
--   2) 사전에 setup(SQL 실행 전 pgcrypto→extensions 설치, 역할 생성, auth.uid() mock)
--      와 apply SQL(테이블/함수/권한) 을 실행해 둔다. (RUNBOOK.md 참조)
--   3) 각 테스트는 begin/rollback 으로 감싸 격리 DB를 오염시키지 않는다.
--
-- [역할 변경 규칙]
--   SET LOCAL ROLE 은 반드시 SQL 문장 레벨(DO 블록 바깥)에 둔다.
--   PL/pgSQL DO 블록 안에서는 set_config('role', ...) 을 사용.
-- =====================================================================

-- =====================================================================
-- SETUP (멱등)
-- =====================================================================
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function public.test_assert(ok boolean, msg text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERT_FAIL: %', msg;
  end if;
end;
$$;

-- 테스트 사용자(uuid 상수)
--   userA = 11111111-1111-4111-8111-111111111111
--   userB = 22222222-2222-4222-8222-222222222222

-- =====================================================================
-- T1 — 비로그인(anon) 차감 거부 (EXECUTE 권한 없음)
-- =====================================================================
begin;
  set local role anon;
  do $$
  begin
    begin
      perform public.key_spend('11111111-1111-4111-8111-111111111111'::uuid, 10, 'feature');
      raise exception 'ASSERT_FAIL: T1 anon spend should be denied';
    exception when insufficient_privilege then
      null;
    end;
  end $$;
rollback;

-- =====================================================================
-- T2 — 사용자 A가 사용자 B 원장·잔액을 읽지 못함
-- =====================================================================
begin;
  insert into public.key_balances (user_id, reward_key, revenue_key)
  values ('11111111-1111-4111-8111-111111111111'::uuid, 10, 20),
         ('22222222-2222-4222-8222-222222222222'::uuid, 30, 40)
  on conflict (user_id) do nothing;

  set local role authenticated;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  do $$
  declare v_count bigint;
  begin
    select count(*) into v_count from public.key_balances;
    perform public.test_assert(v_count = 1, 'T2 A should see only own balance');
  end $$;
rollback;

-- =====================================================================
-- T3 — 일반 사용자(authenticated)의 charge/grant/reverse 호출 거부
-- =====================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  do $$
  begin
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111'::uuid, gen_random_uuid(), 100, 'toss', 'order_1');
      raise exception 'ASSERT_FAIL: T3 charge should be denied to authenticated';
    exception when insufficient_privilege then null;
    end;
  end $$;
rollback;

-- =====================================================================
-- T4 — 직접 원장·잔액·요청 테이블 쓰기 거부 (authenticated)
-- =====================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  do $$
  begin
    begin
      insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, reason)
      values ('11111111-1111-4111-8111-111111111111'::uuid, gen_random_uuid(), 'charge', 'revenue', 100, 'toss', 'x');
      raise exception 'ASSERT_FAIL: T4 direct ledger write should be denied';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values ('11111111-1111-4111-8111-111111111111'::uuid, gen_random_uuid(), 'key_spend', 'x', 'pending');
      raise exception 'ASSERT_FAIL: T4 direct request_events write should be denied';
    exception when insufficient_privilege then null;
    end;
  end $$;
rollback;

-- =====================================================================
-- T5 — 인증 없이 spend → UNAUTHORIZED (auth.uid() null)
-- =====================================================================
begin;
  set local role authenticated;
  do $$
  begin
    begin
      perform public.key_spend(gen_random_uuid(), 10, 'feature');
      raise exception 'ASSERT_FAIL: T5 spend without auth should raise';
    exception when others then
      if sqlerrm like '%UNAUTHORIZED%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T6 — 정책 없음 → 차단 (FEATURE_POLICY_MISSING)
-- =====================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  do $$
  begin
    begin
      perform public.key_spend(gen_random_uuid(), 10, 'feature');
      raise exception 'ASSERT_FAIL: T6 spend should raise FEATURE_POLICY_MISSING';
    exception when others then
      if sqlerrm like '%FEATURE_POLICY_MISSING%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T7~T12 — 차감 정책 분기 (격리 환경 전용: 정책 테이블 + key_spend_test)
-- =====================================================================
begin;
  create table if not exists public.key_feature_policies (
    feature text primary key,
    cost integer not null check (cost > 0),
    reward_allowed boolean not null default false,
    revenue_only boolean not null default false,
    payment_required boolean not null default false
  );

  create or replace function public.key_spend_test(
    p_user_id uuid, p_request_id uuid, p_amount integer, p_feature text
  )
  returns jsonb language plpgsql security definer set search_path = '' as $$
  declare
    v_p jsonb;
    v_reward_allowed boolean; v_revenue_only boolean; v_payment_required boolean;
    v_server_cost integer;
    v_reward_bal integer; v_revenue_bal integer;
    v_from_reward integer; v_from_revenue integer;
  begin
    select to_jsonb(p) into v_p from public.key_feature_policies p where p.feature = p_feature;
    if v_p is null then raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001'; end if;
    v_reward_allowed   := coalesce((v_p->>'reward_allowed')::boolean, false);
    v_revenue_only     := coalesce((v_p->>'revenue_only')::boolean, false);
    v_payment_required := coalesce((v_p->>'payment_required')::boolean, false);
    v_server_cost := coalesce((v_p->>'cost')::integer, 0);
    if v_server_cost <= 0 then raise exception 'FEATURE_POLICY_MISSING' using errcode='P0001'; end if;
    if v_server_cost <> p_amount then raise exception 'COST_MISMATCH' using errcode='P0001'; end if;
    if v_payment_required then raise exception 'PAYMENT_REQUIRED' using errcode='P0001'; end if;

    select reward_key, revenue_key into v_reward_bal, v_revenue_bal
      from public.key_balances where user_id = p_user_id for update;

    if v_revenue_only or not v_reward_allowed then
      if v_revenue_bal < p_amount then raise exception 'INSUFFICIENT_REVENUE' using errcode='P0001'; end if;
      v_from_reward := 0; v_from_revenue := p_amount;
    else
      if (v_reward_bal::bigint + v_revenue_bal::bigint) < p_amount then raise exception 'INSUFFICIENT' using errcode='P0001'; end if;
      v_from_reward := least(v_reward_bal, p_amount);
      v_from_revenue := p_amount - v_from_reward;
    end if;
    return jsonb_build_object('reward', v_from_reward, 'revenue', v_from_revenue);
  end $$;

  insert into public.key_balances (user_id, reward_key, revenue_key)
  values ('11111111-1111-4111-8111-111111111111'::uuid, 100, 100)
  on conflict (user_id) do nothing;

  -- T7 Reward 허용 → Reward 만 차감
  delete from public.key_feature_policies;
  insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only)
  values ('f_reward', 30, true, false);
  do $$
  declare r jsonb;
  begin
    r := public.key_spend_test('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 30, 'f_reward');
    perform public.test_assert((r->>'reward')::int = 30 and (r->>'revenue')::int = 0, 'T7 reward only');
  end $$;

  -- T8 혼합 차감 → Reward/Revenue 2행
  delete from public.key_feature_policies;
  insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only)
  values ('f_mix', 120, true, false);
  do $$
  declare r jsonb;
  begin
    r := public.key_spend_test('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 120, 'f_mix');
    perform public.test_assert((r->>'reward')::int = 100 and (r->>'revenue')::int = 20, 'T8 mixed spend');
  end $$;

  -- T9 Reward 금지 → Revenue 만 사용
  delete from public.key_feature_policies;
  insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only)
  values ('f_revonly', 50, false, false);
  do $$
  declare r jsonb;
  begin
    r := public.key_spend_test('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 50, 'f_revonly');
    perform public.test_assert((r->>'reward')::int = 0 and (r->>'revenue')::int = 50, 'T9 revenue only (reward disallowed)');
  end $$;

  -- T10 Revenue-only 잔액 부족 → Reward 대체 사용 금지
  delete from public.key_feature_policies;
  insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only)
  values ('f_insuf', 200, false, true);
  do $$
  begin
    begin
      perform public.key_spend_test('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 200, 'f_insuf');
      raise exception 'ASSERT_FAIL: T10 should raise INSUFFICIENT_REVENUE';
    exception when others then
      if sqlerrm like '%INSUFFICIENT_REVENUE%' then null; else raise; end if;
    end;
  end $$;

  -- T11 결제 전용 기능 → KEY 차단 (PAYMENT_REQUIRED)
  delete from public.key_feature_policies;
  insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only, payment_required)
  values ('f_pay', 50, false, false, true);
  do $$
  begin
    begin
      perform public.key_spend_test('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 50, 'f_pay');
      raise exception 'ASSERT_FAIL: T11 should raise PAYMENT_REQUIRED';
    exception when others then
      if sqlerrm like '%PAYMENT_REQUIRED%' then null; else raise; end if;
    end;
  end $$;

  -- T12 예상 비용 vs 서버 비용 불일치 → COST_MISMATCH
  delete from public.key_feature_policies;
  insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only)
  values ('f_cost', 50, false, false);
  do $$
  begin
    begin
      perform public.key_spend_test('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 999, 'f_cost');
      raise exception 'ASSERT_FAIL: T12 should raise COST_MISMATCH';
    exception when others then
      if sqlerrm like '%COST_MISMATCH%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T13~T18 — 멱등·원인 중복 (service_role)
-- =====================================================================

-- T13 — 같은 요청 재전송 → 원장 추가 0 (exact replay)
begin;
  set local role service_role;
  do $$
  declare v1 jsonb; v2 jsonb; c1 bigint;
  begin
    v1 := public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 100, 'toss', 'order_1');
    v2 := public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 100, 'toss', 'order_1');
    perform public.test_assert(v1 = v2, 'T13 replay should return identical result_json');
    select count(*) into c1 from public.key_ledger where request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    perform public.test_assert(c1 = 1, 'T13 ledger append should be 1 not 2');
  end $$;
rollback;

-- T14 — 같은 요청, 다른 payload → REQUEST_CONFLICT
begin;
  set local role service_role;
  do $$
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 100, 'toss', 'order_2');
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 200, 'toss', 'order_2');
      raise exception 'ASSERT_FAIL: T14 should raise REQUEST_CONFLICT';
    exception when others then
      if sqlerrm like '%REQUEST_CONFLICT%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- T15 — 후속 거래 후 첫 요청 재전송 → 최초 result_json 반환
begin;
  set local role service_role;
  do $$
  declare v1 jsonb; v1b jsonb;
  begin
    v1 := public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 100, 'toss', 'order_3');
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 100, 'toss', 'order_4');
    v1b := public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 100, 'toss', 'order_3');
    perform public.test_assert(v1 = v1b, 'T15 replay should return original result_json');
    perform public.test_assert((v1b->'balance'->>'revenue')::int = 100, 'T15 balance should be post-first-tx (100) not latest (200)');
  end $$;
rollback;

-- T16 — 같은 지급 원인, 다른 request_id → CAUSE_ALREADY_APPLIED
begin;
  set local role service_role;
  do $$
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 100, 'toss', 'order_5');
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 100, 'toss', 'order_5');
      raise exception 'ASSERT_FAIL: T16 should raise CAUSE_ALREADY_APPLIED';
    exception when others then
      if sqlerrm like '%CAUSE_ALREADY_APPLIED%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- T18 — source_id NULL/빈값 → INVALID_SOURCE_ID
begin;
  set local role service_role;
  do $$
  begin
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 100, 'toss', null);
      raise exception 'ASSERT_FAIL: T18 null source_id should be denied';
    exception when others then
      if sqlerrm like '%INVALID_SOURCE_ID%' then null; else raise; end if;
    end;
    begin
      perform public.key_grant_reward('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 100, 'mission', '', 'v1', null);
      raise exception 'ASSERT_FAIL: T18 empty source_id should be denied';
    exception when others then
      if sqlerrm like '%INVALID_SOURCE_ID%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T22~T25 — reversal 검증
-- =====================================================================

-- T22 — 부분 reversal 2건 합계 한도 내 → 허용
begin;
  set local role service_role;
  do $$
  declare orig uuid;
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 100, 'toss', 'order_7');
    select id into orig from public.key_ledger where source_id = 'order_7' and type = 'charge';
    perform public.key_reverse('11111111-1111-4111-8111-111111111111', gen_random_uuid(), orig, -40, 'partial1');
    perform public.key_reverse('11111111-1111-4111-8111-111111111111', gen_random_uuid(), orig, -60, 'partial2');
  end $$;
rollback;

-- T23 — over-reversal → OVER_REVERSAL
begin;
  set local role service_role;
  do $$
  declare orig uuid;
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', 100, 'toss', 'order_8');
    select id into orig from public.key_ledger where source_id = 'order_8' and type = 'charge';
    perform public.key_reverse('11111111-1111-4111-8111-111111111111', gen_random_uuid(), orig, -60, 'p1');
    begin
      perform public.key_reverse('11111111-1111-4111-8111-111111111111', gen_random_uuid(), orig, -60, 'p2');
      raise exception 'ASSERT_FAIL: T23 over reversal should be denied';
    exception when others then
      if sqlerrm like '%OVER_REVERSAL%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- T24 — 타인 원거래·같은 부호 → FORBIDDEN / INVALID_REVERSAL_DIRECTION
begin;
  set local role service_role;
  do $$
  declare orig uuid;
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', 100, 'toss', 'order_9');
    select id into orig from public.key_ledger where source_id = 'order_9' and type = 'charge';
    begin
      perform public.key_reverse('22222222-2222-4222-8222-222222222222', gen_random_uuid(), orig, -10, 'x');
      raise exception 'ASSERT_FAIL: T24a other user should be forbidden';
    exception when others then
      if sqlerrm like '%FORBIDDEN%' then null; else raise; end if;
    end;
    begin
      perform public.key_reverse('11111111-1111-4111-8111-111111111111', gen_random_uuid(), orig, 10, 'x');
      raise exception 'ASSERT_FAIL: T24b same sign should be denied';
    exception when others then
      if sqlerrm like '%INVALID_REVERSAL_DIRECTION%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- T25 — 취소 후 음수 잔액 → REVERSAL_INSUFFICIENT_BALANCE
--   [TEST FIXTURE] 잔액을 0으로 깎는 직접 update 는 postgres(superuser, TEST ONLY)로 수행.
--   reversal RPC 실행·감지 검증은 service_role 로 수행.
begin;
  -- (1) 정상 RPC 로 충전 (service_role)
  set local role service_role;
  do $$
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa10', 100, 'toss', 'order_10');
  end $$;

  -- (2) TEST ONLY 손상 상태 생성: revenue_key 0 으로 (postgres superuser)
  reset role;
  update public.key_balances set revenue_key = 0 where user_id = '11111111-1111-4111-8111-111111111111';

  -- (3) reversal 시도 → REVERSAL_INSUFFICIENT_BALANCE 감지 (service_role)
  set local role service_role;
  do $$
  declare orig uuid;
  begin
    select id into orig from public.key_ledger where source_id = 'order_10' and type = 'charge';
    begin
      perform public.key_reverse('11111111-1111-4111-8111-111111111111', gen_random_uuid(), orig, -10, 'x');
      raise exception 'ASSERT_FAIL: T25 should raise REVERSAL_INSUFFICIENT_BALANCE';
    exception when others then
      if sqlerrm like '%REVERSAL_INSUFFICIENT_BALANCE%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T26 — 정수 범위 초과 → AMOUNT_OVERFLOW
-- =====================================================================
begin;
  set local role service_role;
  do $$
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 2147483647, 'toss', 'order_max');
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 1, 'toss', 'order_max2');
      raise exception 'ASSERT_FAIL: T26 should raise AMOUNT_OVERFLOW';
    exception when others then
      if sqlerrm like '%AMOUNT_OVERFLOW%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T27 — 미승인 만료일 지급 → EXPIRY_POLICY_UNDECIDED
-- =====================================================================
begin;
  set local role service_role;
  do $$
  begin
    begin
      perform public.key_grant_reward('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 100, 'mission', 'm1', 'v1', now() + interval '30 days');
      raise exception 'ASSERT_FAIL: T27 non-null expires_at should be denied';
    exception when others then
      if sqlerrm like '%EXPIRY_POLICY_UNDECIDED%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T28 — 전체 성공 거래 후 원장 SUM 과 잔액 캐시 일치
-- =====================================================================
begin;
  set local role service_role;
  do $$
  declare lr bigint; lrv bigint; br bigint; bv bigint;
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa11', 100, 'toss', 'order_11');
    perform public.key_grant_reward('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa12', 30, 'mission', 'm2', 'v1', null);
    select coalesce(sum(amount::bigint) filter (where bucket='reward'),0),
           coalesce(sum(amount::bigint) filter (where bucket='revenue'),0)
      into lr, lrv from public.key_ledger
     where user_id = '11111111-1111-4111-8111-111111111111';
    select reward_key, revenue_key into br, bv from public.key_balances
     where user_id = '11111111-1111-4111-8111-111111111111';
    perform public.test_assert(lr = br and lrv = bv, 'T28 ledger sum must equal balance cache');
  end $$;
rollback;

-- =====================================================================
-- T21 — 잔액 캐시 손상 감지 (원장 존재 + balance 행 삭제 → 차단)
-- =====================================================================
--   [TEST FIXTURE] 손상 생성(직접 delete)은 postgres(superuser, TEST ONLY)로 수행.
--   RPC 실행·감지 검증은 service_role 로 수행. 운영 service_role 테이블 권한을 늘리지 않음.
begin;
  -- (1) 정상 RPC 로 잔액 생성 (service_role)
  set local role service_role;
  do $$
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa13', 100, 'toss', 'order_13');
  end $$;

  -- (2) TEST ONLY 손상 상태 생성: balance 행 삭제 (postgres superuser)
  reset role;
  delete from public.key_balances where user_id = '11111111-1111-4111-8111-111111111111';

  -- (3) 손상 상태에서 재충전 시도 → BALANCE_CACHE_CORRUPTED 감지 (service_role)
  set local role service_role;
  do $$
  begin
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 50, 'toss', 'order_14');
      raise exception 'ASSERT_FAIL: T21 cache corruption should be blocked';
    exception when others then
      if sqlerrm like '%BALANCE_CACHE_CORRUPTED%' then null; else raise; end if;
    end;
  end $$;
rollback;

-- =====================================================================
-- T20 — 중간 강제 실패 → 부분 반영 없음 (transaction atomicity)
--   AMOUNT_OVERFLOW 경로: request_events pending insert 후 overflow 검사에서 실패.
--   실패한 RPC 의 pending request_events / ledger 가 남지 않아야 한다.
-- =====================================================================
begin;
  set local role service_role;
  do $$
  declare c_evt bigint; c_led bigint;
  begin
    perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20', 2147483647, 'toss', 'order_t20_max');
    begin
      perform public.key_charge_revenue('11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', 1, 'toss', 'order_t20_over');
    exception when others then null;
    end;
    select count(*) into c_evt from public.key_request_events
      where request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21';
    select count(*) into c_led from public.key_ledger
      where request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21';
    perform public.test_assert(c_evt = 0, 'T20 failed RPC must not leave pending request_events');
    perform public.test_assert(c_led = 0, 'T20 failed RPC must not leave ledger row');
  end $$;
rollback;

-- =====================================================================
-- T17 / T19 / T23(병렬) — 별도 두 psql 세션으로 수동 실행 (RUNBOOK.md §6 참조)
-- =====================================================================