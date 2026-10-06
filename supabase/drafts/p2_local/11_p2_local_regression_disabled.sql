-- LOCAL ONLY · FEATURE_DISABLED 계약 회귀검사 (10_ 실행 뒤 같은 DB에서 이어서 실행)
create temp table t_results2 (n int, name text, expect text, got text, pass boolean);
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;

-- 전제: 10_ 에서 A 가 feature_x(cost 4, enabled) 로 request …106 성공(reward 3 + revenue 1), 잔액 reward 0 / revenue 4
-- R1 성공 후 정책 비활성화 → 기존 요청 exact replay 는 저장 응답 그대로, 원장 추가 0
update public.key_feature_policies set enabled = false where feature = 'feature_x';
do $$ declare r jsonb; stored jsonb; before int; after int; begin
  select result_json into stored from public.key_request_events where request_id='aa000000-0000-4000-8000-000000000106';
  select count(*) into before from public.key_ledger;
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  r := public.key_spend('aa000000-0000-4000-8000-000000000106', 4, 'feature_x');
  perform pg_temp.as_postgres();
  select count(*) into after from public.key_ledger;
  insert into t_results2 values (18, '정책 비활성화 후 기존 요청 exact replay → 저장 응답, 원장 +0', 'same, +0', (r = stored)::text||', +'||(after-before), r = stored and after = before);
end $$;
-- R2 비활성 정책에 새 요청 → FEATURE_DISABLED, 부분 반영 0
do $$ declare s text; m text; b_led int; b_req int; b_bal jsonb; begin
  select count(*) into b_led from public.key_ledger; select count(*) into b_req from public.key_request_events;
  select jsonb_build_object('r',reward_key,'v',revenue_key) into b_bal from public.key_balances where user_id='aa000000-0000-4000-8000-000000000001';
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-000000000109', 4, 'feature_x'); s := 'NO_ERROR'; exception when others then get stacked diagnostics s = returned_sqlstate, m = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results2 values (19, '비활성 정책에 새 요청 → FEATURE_DISABLED', 'P0001 FEATURE_DISABLED', s||' '||coalesce(m,''), s='P0001' and m='FEATURE_DISABLED');
  insert into t_results2 select 20, '실패 후 원장·요청·잔액 부분 반영 0', 'unchanged',
    'led +'||((select count(*) from public.key_ledger)-b_led)||', req +'||((select count(*) from public.key_request_events)-b_req)||', bal '||(select jsonb_build_object('r',reward_key,'v',revenue_key)::text from public.key_balances where user_id='aa000000-0000-4000-8000-000000000001'),
    (select count(*) from public.key_ledger)=b_led and (select count(*) from public.key_request_events)=b_req and (select jsonb_build_object('r',reward_key,'v',revenue_key) from public.key_balances where user_id='aa000000-0000-4000-8000-000000000001')=b_bal;
end $$;
-- R3 정책 재활성 + 가격 변경(4→7) → 기존 요청(amount 4) exact replay 는 여전히 저장 응답(재실행·COST_MISMATCH 아님)
update public.key_feature_policies set enabled = true, cost = 7, policy_version = 'LOCAL_P2_TEST_v2' where feature = 'feature_x';
do $$ declare r jsonb; stored jsonb; before int; after int; begin
  select result_json into stored from public.key_request_events where request_id='aa000000-0000-4000-8000-000000000106';
  select count(*) into before from public.key_ledger;
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  r := public.key_spend('aa000000-0000-4000-8000-000000000106', 4, 'feature_x');
  perform pg_temp.as_postgres();
  select count(*) into after from public.key_ledger;
  insert into t_results2 values (21, '가격 변경 후 기존 요청 exact replay → 저장 응답(v1), 원장 +0', 'same(v1), +0', (r = stored)::text||' pv='||(r->>'policyVersion')||', +'||(after-before), r = stored and after = before and r->>'policyVersion'='LOCAL_P2_TEST_v1');
end $$;
-- R4 가격 변경 후 새 요청은 현재 정책(7)으로 판단: amount 4 → COST_MISMATCH, amount 7 → INSUFFICIENT_REVENUE? (reward 0 + revenue 4 < 7, reward_allowed 이므로 INSUFFICIENT)
do $$ declare s1 text; m1 text; s2 text; m2 text; begin
  perform pg_temp.as_user('aa000000-0000-4000-8000-000000000001');
  begin perform public.key_spend('aa000000-0000-4000-8000-00000000010a', 4, 'feature_x'); s1 := 'NO_ERROR'; exception when others then get stacked diagnostics s1 = returned_sqlstate, m1 = message_text; end;
  begin perform public.key_spend('aa000000-0000-4000-8000-00000000010b', 7, 'feature_x'); s2 := 'NO_ERROR'; exception when others then get stacked diagnostics s2 = returned_sqlstate, m2 = message_text; end;
  perform pg_temp.as_postgres();
  insert into t_results2 values (22, '가격 변경 후 새 요청(옛 금액 4) → COST_MISMATCH', 'P0001 COST_MISMATCH', s1||' '||coalesce(m1,''), s1='P0001' and m1='COST_MISMATCH');
  insert into t_results2 values (23, '가격 변경 후 새 요청(새 금액 7, 잔액 4) → INSUFFICIENT', 'P0001 INSUFFICIENT', s2||' '||coalesce(m2,''), s2='P0001' and m2='INSUFFICIENT');
end $$;
-- R5 정책 존재 확인과 enabled 판정 분리: enabled=false 행이 있어도 MISSING 이 아니라 DISABLED (T19 로 확인) / 행 없음은 MISSING (T17 로 확인)
select n, case when pass then 'PASS' else 'FAIL' end as result, name, expect, got from t_results2 order by n;
select count(*) filter (where pass) as pass_cnt, count(*) filter (where not pass) as fail_cnt from t_results2;
