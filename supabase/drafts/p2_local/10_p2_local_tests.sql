-- LOCAL ONLY · P2 후보 실제 검증 (doit_p2_local). 각 케이스는 예외 블록으로 SQLSTATE/메시지를 포착해 PASS/FAIL 기록.
create temp table t_results (n int, name text, expect text, got text, pass boolean);
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;

-- 고정 테스트 UUID (로컬 전용)
\set uA '''aa000000-0000-4000-8000-000000000001'''
\set uB '''bb000000-0000-4000-8000-000000000002'''

-- 준비: A 에게 reward 3, revenue 5 (service_role 경로의 P1 함수로)
select public.key_charge_revenue(:uA, 'aa000000-0000-4000-8000-0000000000c1', 5, 'local_test', 'order-local-1');
select public.key_grant_reward(:uA, 'aa000000-0000-4000-8000-0000000000d1', 3, 'local_test', 'action-local-1', 'LOCAL_TEST', null);

-- T1 정책 없음
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000101', 4, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (1, '정책 없음 → FEATURE_POLICY_MISSING', 'P0001 FEATURE_POLICY_MISSING', s||' '||coalesce(m,''), s='P0001' and m='FEATURE_POLICY_MISSING');
end $$;
-- T1b pending 잔존 0
insert into t_results select 2, '실패 후 pending 요청 잔존 0', '0', count(*)::text, count(*)=0 from public.key_request_events where status='pending';

-- 정책 등록 (postgres 로) : disabled 상태
insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only, payment_required, enabled, policy_version)
values ('feature_x', 4, true, false, false, false, 'LOCAL_P2_TEST_v1');

-- T3 disabled
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000102', 4, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (3, '정책 disabled → FEATURE_DISABLED', 'P0001 FEATURE_DISABLED', s||' '||coalesce(m,''), s='P0001' and m='FEATURE_DISABLED');
end $$;

update public.key_feature_policies set enabled = true where feature='feature_x';

-- T4 cost mismatch (서버 4, 클라 3)
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000103', 3, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (4, 'cost 불일치 → COST_MISMATCH', 'P0001 COST_MISMATCH', s||' '||coalesce(m,''), s='P0001' and m='COST_MISMATCH');
end $$;

-- T5 payment_required
insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only, payment_required, enabled, policy_version)
values ('feature_paid', 2, false, true, true, true, 'LOCAL_P2_TEST_v1');
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000104', 2, 'feature_paid'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (5, 'payment_required → PAYMENT_REQUIRED', 'P0001 PAYMENT_REQUIRED', s||' '||coalesce(m,''), s='P0001' and m='PAYMENT_REQUIRED');
end $$;

-- T6 revenue_only, revenue 5 < cost 6 → INSUFFICIENT_REVENUE (reward 3 있어도 대체 금지)
insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only, payment_required, enabled, policy_version)
values ('feature_rev', 6, false, true, false, true, 'LOCAL_P2_TEST_v1');
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000105', 6, 'feature_rev'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (6, 'revenue_only 부족 → INSUFFICIENT_REVENUE (reward 대체 금지)', 'P0001 INSUFFICIENT_REVENUE', s||' '||coalesce(m,''), s='P0001' and m='INSUFFICIENT_REVENUE');
end $$;

-- T7 reward 우선 차감: reward 3 + revenue 1 = 4
do $$ declare r jsonb; s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin r := public.key_spend('aa000000-0000-4000-8000-000000000106', 4, 'feature_x'); s := 'OK'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (7, 'reward 우선 차감 응답 (reward 3, revenue 1, policyVersion 기록)', 'reward=3 revenue=1 pv=LOCAL_P2_TEST_v1 bal 0/4',
    coalesce(r::text, s||' '||coalesce(m,'')),
    r->'spent'->>'reward'='3' and r->'spent'->>'revenue'='1' and r->>'policyVersion'='LOCAL_P2_TEST_v1' and r->'balance'->>'reward'='0' and r->'balance'->>'revenue'='4');
end $$;
insert into t_results select 8, 'spend 원장 2행 + policy_version 기록', '2 rows, pv set', count(*)::text||' rows, pv '||string_agg(coalesce(policy_version,'NULL'), ','), count(*)=2 and bool_and(policy_version='LOCAL_P2_TEST_v1') from public.key_ledger where request_id='aa000000-0000-4000-8000-000000000106';
insert into t_results select 9, '잔액 캐시 = 원장 합계', 'reward 0 / revenue 4', 'reward '||reward_key||' / revenue '||revenue_key, reward_key=0 and revenue_key=4 and reward_key=(select sum(amount) from public.key_ledger where user_id=user_id_b and bucket='reward') from (select user_id as user_id_b, reward_key, revenue_key from public.key_balances where user_id='aa000000-0000-4000-8000-000000000001') b;

-- T10 exact replay: 응답 동일 · 원장 추가 0
do $$ declare r jsonb; before int; after int; stored jsonb; begin
  select count(*) into before from public.key_ledger;
  select result_json into stored from public.key_request_events where request_id='aa000000-0000-4000-8000-000000000106';
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  r := public.key_spend('aa000000-0000-4000-8000-000000000106', 4, 'feature_x');
  perform pg_temp.as_postgres();
  select count(*) into after from public.key_ledger;
  insert into t_results values (10, 'exact replay → 저장 응답 동일, 원장 추가 0', 'same, +0', (r = stored)::text||', +'||(after-before), r = stored and after = before);
end $$;

-- T11 같은 request_id 다른 amount → REQUEST_CONFLICT
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000106', 5, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (11, '같은 request_id 다른 amount → REQUEST_CONFLICT', '40900 REQUEST_CONFLICT', s||' '||coalesce(m,''), s='40900' and m='REQUEST_CONFLICT');
end $$;

-- T12 미인증 → UNAUTHORIZED
do $$ declare s text; m text; begin
  perform set_config('request.jwt.claim.sub', '', true); execute 'set local role authenticated';
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000107', 4, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (12, '미인증 → UNAUTHORIZED', '42501 UNAUTHORIZED', s||' '||coalesce(m,''), s='42501' and m='UNAUTHORIZED');
end $$;

-- T13 다른 사용자 B: 잔액 없음 → INSUFFICIENT (A 잔액 사용 불가)
do $$ declare s text; m text; begin
  perform pg_temp.as_user('bb000000-0000-4000-8000-000000000002');
  begin perform public.key_spend('bb000000-0000-4000-8000-000000000201', 4, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (13, '다른 사용자 B 잔액 0 → INSUFFICIENT (A 잔액 격리)', 'P0001 INSUFFICIENT', s||' '||coalesce(m,''), s='P0001' and m='INSUFFICIENT');
end $$;

-- T14 정책 테이블 직접 접근 차단 (authenticated / service_role)
do $$ declare s text; begin
  execute 'set local role authenticated';
  begin perform 1 from public.key_feature_policies; s := 'READ_OK'; exception when others then get stacked diagnostics s = returned_sqlstate; end;
  execute 'reset role';
  insert into t_results values (14, 'authenticated 직접 SELECT 차단', '42501', s, s='42501');
  execute 'set local role service_role';
  begin perform 1 from public.key_feature_policies; s := 'READ_OK'; exception when others then get stacked diagnostics s = returned_sqlstate; end;
  execute 'reset role';
  insert into t_results values (15, 'service_role 직접 SELECT 차단', '42501', s, s='42501');
end $$;

-- T16 모순 정책(revenue_only & reward_allowed) 저장 차단
do $$ declare s text; begin
  begin insert into public.key_feature_policies (feature,cost,reward_allowed,revenue_only,enabled,policy_version) values ('bad',1,true,true,false,'v'); s := 'INSERTED'; exception when others then get stacked diagnostics s = returned_sqlstate; end;
  insert into t_results values (16, 'revenue_only+reward_allowed 모순 → CHECK 위반', '23514', s, s='23514');
end $$;

-- T17 정책 row 0 인 상태 재확인(초기 상태 의미): 다른 feature 는 여전히 MISSING
do $$ declare s text; m text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000108', 1, 'feature_unknown'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results values (17, '미등록 feature → FEATURE_POLICY_MISSING 유지', 'P0001 FEATURE_POLICY_MISSING', s||' '||coalesce(m,''), s='P0001' and m='FEATURE_POLICY_MISSING');
end $$;

select n, case when pass then 'PASS' else 'FAIL' end as result, name, expect, got from t_results order by n;
select count(*) filter (where pass) as pass_cnt, count(*) filter (where not pass) as fail_cnt from t_results;
