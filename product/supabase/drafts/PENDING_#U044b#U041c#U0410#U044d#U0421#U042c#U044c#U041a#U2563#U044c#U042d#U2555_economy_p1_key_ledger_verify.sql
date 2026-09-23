-- =====================================================================
-- DO IT COMPANY — ECONOMY P1 · KEY LEDGER
-- PART A — VERIFY READ-ONLY (읽기 전용 검증)
-- 기준일: 2026-09-13
-- 규칙: SELECT 만 허용. INSERT/UPDATE/DELETE/함수 호출(쓰기) 절대 금지.
--       잔액 대조는 "원장만 존재 / 잔액만 존재 / 금액 불일치" 3케이스를 모두 탐지.
-- =====================================================================

-- 1) 테이블 존재
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('key_request_events','key_ledger','key_balances') order by table_name;

-- 2) 함수 소유자 + security definer 확인
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname like 'key\_%' order by p.proname, args;

-- 3) RLS 정책 확인
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' and tablename like 'key\_%' order by tablename, policyname;

-- 4) function execute 권한 확인
select grantee, routine_name from information_schema.role_routine_grants
where routine_schema='public' and routine_name like 'key\_%' order by routine_name, grantee;

-- 5) table 권한 확인
select grantee, table_name, string_agg(privilege_type, ',') as privs
from information_schema.role_table_grants
where table_schema='public' and table_name like 'key\_%'
group by grantee, table_name order by table_name, grantee;

-- 6) 원인 중복 방지 고유 인덱스 존재 확인
select indexname, indexdef from pg_indexes
where schemaname='public' and indexname = 'key_ledger_cause_uniq';

-- 7) 잔액 대조 — 3케이스 모두 탐지 (읽기 전용, 변경 없음)
--    (a) 원장만 있고 잔액 행이 없는 사용자
--    (b) 잔액 행만 있고 원장이 없는 사용자
--    (c) 양쪽 모두 있으나 금액이 다른 사용자
select 'ledger_only_no_balance' as mismatch_kind, l.user_id
from public.key_ledger l
left join public.key_balances b on b.user_id = l.user_id
where b.user_id is null
group by l.user_id

union all

select 'balance_only_no_ledger', b.user_id
from public.key_balances b
left join public.key_ledger l on l.user_id = b.user_id
where l.user_id is null
group by b.user_id

union all

select 'amount_mismatch', b.user_id
from public.key_balances b
left join public.key_ledger l on l.user_id = b.user_id
group by b.user_id, b.reward_key, b.revenue_key
having b.reward_key <> coalesce(sum(l.amount::bigint) filter (where l.bucket='reward'), 0)
    or b.revenue_key <> coalesce(sum(l.amount::bigint) filter (where l.bucket='revenue'), 0)
order by 2;