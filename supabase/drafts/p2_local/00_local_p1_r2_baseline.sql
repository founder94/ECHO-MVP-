-- ============================================================
-- LOCAL ONLY · P1 r2 기준선 재현 (운영 zyyhhxyupizcqhxqnxuu 에서 2026-09-13 읽기 전용으로 추출한 DDL·함수 정의를 그대로 옮김)
-- 운영 적용 금지. 로컬 격리 PG(doit_p2_local)에서 P2 후보 검증 전용.
-- Supabase 전용 객체(auth.uid, extensions.digest, 역할)는 동작 동일한 스텁으로 대체.
-- ============================================================
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;
-- Supabase auth.uid() 와 동일 의미: JWT sub claim. 로컬에서는 request.jwt.claim.sub GUC 로 주입.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;

create table public.key_request_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid not null,
  action text not null,
  payload_hash text not null,
  status text not null default 'pending'::text,
  result_json jsonb,
  created_at timestamp with time zone not null default now(),
  applied_at timestamp with time zone,
  constraint key_request_events_pk primary key (id),
  constraint key_request_events_once unique (user_id, request_id),
  constraint key_request_events_action_check check (action = any (array['key_spend','key_charge_revenue','key_grant_reward','key_reverse'])),
  constraint key_request_events_status_check check (status = any (array['pending','applied']))
);
create index key_request_events_status_idx on public.key_request_events (user_id, action, status);

create table public.key_ledger (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid not null,
  type text not null,
  bucket text not null,
  amount integer not null,
  source text not null,
  source_id text,
  policy_version text,
  reason text not null,
  reverses_id uuid,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint key_ledger_pk primary key (id),
  constraint key_ledger_amount_check check (amount <> 0),
  constraint key_ledger_bucket_check check (bucket = any (array['reward','revenue'])),
  constraint key_ledger_type_check check (type = any (array['charge','grant','spend','expiry','clawback','reversal'])),
  constraint key_ledger_reverses_id_fkey foreign key (reverses_id) references public.key_ledger(id)
);
create unique index key_ledger_cause_uniq on public.key_ledger (user_id, source, source_id) where (source_id is not null);
create index key_ledger_request_idx on public.key_ledger (user_id, request_id);
create index key_ledger_reverses_idx on public.key_ledger (reverses_id);
create index key_ledger_source_idx on public.key_ledger (source, source_id);
create index key_ledger_user_created_idx on public.key_ledger (user_id, created_at desc);

create table public.key_balances (
  user_id uuid not null,
  reward_key integer not null default 0,
  revenue_key integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint key_balances_pk primary key (user_id),
  constraint key_balances_reward_key_check check (reward_key >= 0),
  constraint key_balances_revenue_key_check check (revenue_key >= 0)
);
alter table public.key_request_events enable row level security;
alter table public.key_ledger enable row level security;
alter table public.key_balances enable row level security;
grant select on public.key_ledger, public.key_balances to authenticated;
create policy key_ledger_select_own on public.key_ledger for select to authenticated using (auth.uid() = user_id);
create policy key_balances_select_own on public.key_balances for select to authenticated using (auth.uid() = user_id);

-- ── 운영 함수 정의 (원문 그대로) ──
CREATE OR REPLACE FUNCTION public.key_charge_revenue(p_user_id uuid, p_request_id uuid, p_amount integer, p_source text, p_source_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_payload_hash text;
  v_evt          public.key_request_events%rowtype;
  v_revenue_bal  integer;
  v_result       jsonb;
  v_constraint   text;
begin
  if p_user_id is null then raise exception 'INVALID_USER' using errcode = '22023'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  if p_source is null or btrim(p_source) = '' then raise exception 'INVALID_SOURCE' using errcode = '22023'; end if;
  if p_source_id is null or btrim(p_source_id) = '' then raise exception 'INVALID_SOURCE_ID' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));
  v_payload_hash := encode(extensions.digest(
    jsonb_build_object('action','key_charge_revenue','amount',p_amount,'source',p_source,'sourceId',p_source_id)::text, 'sha256'), 'hex');
  select * into v_evt from public.key_request_events where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_evt.action is distinct from 'key_charge_revenue' then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.payload_hash is distinct from v_payload_hash then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001'; end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, 'key_charge_revenue', v_payload_hash, 'pending') returning * into v_evt;
  end if;
  if exists (select 1 from public.key_ledger where user_id = p_user_id and source = p_source and source_id = p_source_id) then
    raise exception 'CAUSE_ALREADY_APPLIED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.key_balances where user_id = p_user_id) then
    if exists (select 1 from public.key_ledger where user_id = p_user_id) then raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001'; end if;
    insert into public.key_balances (user_id) values (p_user_id) on conflict (user_id) do nothing;
  end if;
  select revenue_key into v_revenue_bal from public.key_balances where user_id = p_user_id for update;
  if p_amount::bigint + v_revenue_bal::bigint > 2147483647 then raise exception 'AMOUNT_OVERFLOW' using errcode = '22003'; end if;
  begin
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, source_id, reason)
      values (p_user_id, p_request_id, 'charge', 'revenue', p_amount, p_source, p_source_id, 'revenue charge');
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'key_ledger_cause_uniq' then raise exception 'CAUSE_ALREADY_APPLIED' using errcode = 'P0001'; end if;
    raise;
  end;
  update public.key_balances set revenue_key = revenue_key + p_amount, updated_at = now() where user_id = p_user_id;
  v_result := jsonb_build_object('ok', true, 'requestId', p_request_id, 'charged', p_amount, 'balance', jsonb_build_object('revenue', v_revenue_bal + p_amount));
  update public.key_request_events set status = 'applied', result_json = v_result, applied_at = now() where id = v_evt.id;
  return v_result;
exception when others then raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.key_grant_reward(p_user_id uuid, p_request_id uuid, p_amount integer, p_source text, p_source_id text, p_policy_version text, p_expires_at timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_payload_hash text;
  v_evt          public.key_request_events%rowtype;
  v_reward_bal   integer;
  v_result       jsonb;
  v_constraint   text;
begin
  if p_user_id is null then raise exception 'INVALID_USER' using errcode = '22023'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  if p_source is null or btrim(p_source) = '' then raise exception 'INVALID_SOURCE' using errcode = '22023'; end if;
  if p_source_id is null or btrim(p_source_id) = '' then raise exception 'INVALID_SOURCE_ID' using errcode = '22023'; end if;
  if p_policy_version is null or btrim(p_policy_version) = '' then raise exception 'POLICY_VERSION_REQUIRED' using errcode = '22023'; end if;
  if p_expires_at is not null then raise exception 'EXPIRY_POLICY_UNDECIDED' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));
  v_payload_hash := encode(extensions.digest(
    jsonb_build_object('action','key_grant_reward','amount',p_amount,'source',p_source,'sourceId',p_source_id,'policyVersion',p_policy_version,'expiresAt',(p_expires_at at time zone 'UTC'))::text, 'sha256'), 'hex');
  select * into v_evt from public.key_request_events where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_evt.action is distinct from 'key_grant_reward' then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.payload_hash is distinct from v_payload_hash then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001'; end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, 'key_grant_reward', v_payload_hash, 'pending') returning * into v_evt;
  end if;
  if exists (select 1 from public.key_ledger where user_id = p_user_id and source = p_source and source_id = p_source_id) then
    raise exception 'CAUSE_ALREADY_APPLIED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.key_balances where user_id = p_user_id) then
    if exists (select 1 from public.key_ledger where user_id = p_user_id) then raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001'; end if;
    insert into public.key_balances (user_id) values (p_user_id) on conflict (user_id) do nothing;
  end if;
  select reward_key into v_reward_bal from public.key_balances where user_id = p_user_id for update;
  if p_amount::bigint + v_reward_bal::bigint > 2147483647 then raise exception 'AMOUNT_OVERFLOW' using errcode = '22003'; end if;
  begin
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, source_id, policy_version, reason, expires_at)
      values (p_user_id, p_request_id, 'grant', 'reward', p_amount, p_source, p_source_id, p_policy_version, 'reward grant', p_expires_at);
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'key_ledger_cause_uniq' then raise exception 'CAUSE_ALREADY_APPLIED' using errcode = 'P0001'; end if;
    raise;
  end;
  update public.key_balances set reward_key = reward_key + p_amount, updated_at = now() where user_id = p_user_id;
  v_result := jsonb_build_object('ok', true, 'requestId', p_request_id, 'granted', p_amount, 'balance', jsonb_build_object('reward', v_reward_bal + p_amount));
  update public.key_request_events set status = 'applied', result_json = v_result, applied_at = now() where id = v_evt.id;
  return v_result;
exception when others then raise;
end;
$function$;

-- key_spend 원문 (P1 r2 · v_policy := null 상태). P2 패치(02_)는 이 함수를 CREATE OR REPLACE 한다.
CREATE OR REPLACE FUNCTION public.key_spend(p_request_id uuid, p_amount integer, p_feature text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
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
  if v_uid is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  if p_feature is null or btrim(p_feature) = '' then raise exception 'INVALID_FEATURE' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(p_request_id::text));
  v_payload_hash := encode(extensions.digest(jsonb_build_object('action','key_spend','amount',p_amount,'feature',p_feature)::text, 'sha256'), 'hex');
  select * into v_evt from public.key_request_events where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_evt.action is distinct from 'key_spend' then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.payload_hash is distinct from v_payload_hash then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001'; end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (v_uid, p_request_id, 'key_spend', v_payload_hash, 'pending') returning * into v_evt;
  end if;
  v_policy := null;
  if v_policy is null then raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001'; end if;
  v_reward_allowed   := coalesce((v_policy->>'reward_allowed')::boolean, false);
  v_revenue_only     := coalesce((v_policy->>'revenue_only')::boolean, false);
  v_payment_required := coalesce((v_policy->>'payment_required')::boolean, false);
  v_server_cost := coalesce((v_policy->>'cost')::integer, 0);
  if v_server_cost <= 0 then raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001'; end if;
  if v_server_cost <> p_amount then raise exception 'COST_MISMATCH' using errcode = 'P0001'; end if;
  if v_payment_required then raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.key_balances where user_id = v_uid) then
    if exists (select 1 from public.key_ledger where user_id = v_uid) then raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001'; end if;
    insert into public.key_balances (user_id) values (v_uid) on conflict (user_id) do nothing;
  end if;
  select reward_key, revenue_key into v_reward_bal, v_revenue_bal from public.key_balances where user_id = v_uid for update;
  if v_revenue_only or not v_reward_allowed then
    if v_revenue_bal < p_amount then raise exception 'INSUFFICIENT_REVENUE' using errcode = 'P0001'; end if;
    v_from_reward := 0; v_from_revenue := p_amount;
  else
    if (v_reward_bal::bigint + v_revenue_bal::bigint) < p_amount then raise exception 'INSUFFICIENT' using errcode = 'P0001'; end if;
    v_from_reward := least(v_reward_bal, p_amount); v_from_revenue := p_amount - v_from_reward;
  end if;
  if v_from_reward > 0 then
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, reason) values (v_uid, p_request_id, 'spend', 'reward', -v_from_reward, p_feature, 'spend');
  end if;
  if v_from_revenue > 0 then
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, reason) values (v_uid, p_request_id, 'spend', 'revenue', -v_from_revenue, p_feature, 'spend');
  end if;
  update public.key_balances set reward_key = reward_key - v_from_reward, revenue_key = revenue_key - v_from_revenue, updated_at = now() where user_id = v_uid;
  v_result := jsonb_build_object('ok', true, 'requestId', p_request_id, 'spent', jsonb_build_object('reward', v_from_reward, 'revenue', v_from_revenue),
    'balance', jsonb_build_object('reward', v_reward_bal - v_from_reward, 'revenue', v_revenue_bal - v_from_revenue));
  update public.key_request_events set status = 'applied', result_json = v_result, applied_at = now() where id = v_evt.id;
  return v_result;
exception when others then raise;
end;
$function$;
revoke all on function public.key_charge_revenue(uuid,uuid,integer,text,text) from public;
revoke all on function public.key_grant_reward(uuid,uuid,integer,text,text,text,timestamptz) from public;
revoke all on function public.key_spend(uuid,integer,text) from public;
grant execute on function public.key_charge_revenue(uuid,uuid,integer,text,text) to service_role;
grant execute on function public.key_grant_reward(uuid,uuid,integer,text,text,text,timestamptz) to service_role;
grant execute on function public.key_spend(uuid,integer,text) to authenticated;
