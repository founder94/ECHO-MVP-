-- =====================================================================
-- DO IT COMPANY — ECONOMY P1 · KEY LEDGER
-- PART B — REPAIR / REBUILD (변경을 일으키는 복구 SQL)
--
-- [STOP — MUTATING REPAIR SQL]
-- [대표 별도 승인 전 실행 금지]
-- [일반 검증 절차·검증 버튼에서는 절대 자동 실행 금지]
--
-- 사고 발생 시 순서:
--   1) 쓰기 중단 (RPC 호출 차단)
--   2) 증거 보존 (ledger / request_events 스냅샷)
--   3) 별도 복구 승인 → 아래 REBUILD
--
-- 실거래 발생 후 DROP TABLE 로 되돌리는 롤백 금지.
-- =====================================================================

begin;

-- key_balances 손상 시 ledger 기준 재구축.
--   주의: ledger 에만 있고 balance 행이 없는 사용자도 복구하도록 INSERT 포함.
--   1) balance 행 누락 사용자 생성 (원장 합계 기준)
insert into public.key_balances (user_id, reward_key, revenue_key, updated_at)
select l.user_id,
       coalesce(sum(l.amount::bigint) filter (where l.bucket='reward'), 0)::integer,
       coalesce(sum(l.amount::bigint) filter (where l.bucket='revenue'), 0)::integer,
       now()
from public.key_ledger l
left join public.key_balances b on b.user_id = l.user_id
where b.user_id is null
group by l.user_id;

--   2) 기존 balance 행 갱신 (ledger 합계로 재구축)
update public.key_balances b set
  reward_key  = coalesce((select sum(l.amount::bigint) from public.key_ledger l
    where l.user_id = b.user_id and l.bucket = 'reward'), 0)::integer,
  revenue_key = coalesce((select sum(l.amount::bigint) from public.key_ledger l
    where l.user_id = b.user_id and l.bucket = 'revenue'), 0)::integer,
  updated_at  = now();

--   3) (선택) 원장 없는 고아 balance 행 정리 — 대표 별도 승인 시에만 주석 해제
-- delete from public.key_balances b
-- where not exists (select 1 from public.key_ledger l where l.user_id = b.user_id)
--   and b.reward_key = 0 and b.revenue_key = 0;

commit;