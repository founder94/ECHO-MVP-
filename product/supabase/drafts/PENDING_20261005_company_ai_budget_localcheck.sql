-- 로컬 확인용(회사 DB 실행 금지): 빈 로컬 Postgres 16 에 PENDING_20261005_company_ai_budget.sql 을 넣은 뒤 psql -f 로 실행.
-- 기대값(2026-10-05 v3 실측): reserve_not_open=NOT_OPEN · open_blank_evidence=INVALID · open=OPENED · reserve_null_attempt=INVALID · reserve_bad_key=INVALID ·
--   reserve=RESERVED:OK · dup=DUPLICATE:reserved · settle_null_attempt=INVALID · status_after_null=reserved · settle_wrong_attempt=NOT_OWNER ·
--   settle_owner=SETTLED · settle_again=ALREADY:settled · month=1080/0/false · over=OVER_BUDGET  (v2 는 settle_null_attempt=SETTLED)
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
select 'reserve_not_open=' || public.company_ai_reserve(repeat('a',64), repeat('b',64), '00000000-0000-0000-0000-000000000001', 100);
select 'open_blank_evidence=' || public.company_ai_open_month(date_trunc('month', now() at time zone 'Asia/Seoul')::date, 30000, 1000, '   ');
select 'open=' || public.company_ai_open_month(date_trunc('month', now() at time zone 'Asia/Seoul')::date, 30000, 1000, 'invoice-2026-10');
select 'reserve_null_attempt=' || coalesce(public.company_ai_reserve(repeat('c',64), repeat('b',64), null, 100), '<null>');
select 'reserve_bad_key=' || coalesce(public.company_ai_reserve('not-a-hash', repeat('b',64), '00000000-0000-0000-0000-000000000001', 100), '<null>');
select 'reserve=' || public.company_ai_reserve(repeat('a',64), repeat('b',64), '00000000-0000-0000-0000-000000000001', 100);
select 'dup=' || public.company_ai_reserve(repeat('a',64), repeat('b',64), '00000000-0000-0000-0000-000000000002', 100);
select 'settle_null_attempt=' || coalesce(public.company_ai_settle(repeat('a',64), null, 80), '<null>');
select 'status_after_null=' || status from public.company_ai_reservations where request_key = repeat('a',64);
select 'settle_wrong_attempt=' || public.company_ai_settle(repeat('a',64), '00000000-0000-0000-0000-000000000009', 80);
select 'settle_owner=' || public.company_ai_settle(repeat('a',64), '00000000-0000-0000-0000-000000000001', 80);
select 'settle_again=' || public.company_ai_settle(repeat('a',64), '00000000-0000-0000-0000-000000000001', 80);
select 'month=' || committed_krw || '/' || reserved_krw || '/' || paused from public.company_ai_budget_months;
select 'over=' || public.company_ai_reserve(repeat('d',64), repeat('b',64), '00000000-0000-0000-0000-000000000003', 29000);
