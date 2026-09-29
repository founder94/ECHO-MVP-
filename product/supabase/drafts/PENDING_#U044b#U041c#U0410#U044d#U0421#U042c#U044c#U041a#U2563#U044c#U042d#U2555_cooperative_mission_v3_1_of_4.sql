-- [SQL v3 1/4 - READ-ONLY MEASUREMENT + PREFLIGHT + POLICY + MISSIONS TABLES]
-- STATUS: DRAFT. EXECUTION FORBIDDEN UNTIL REPRESENTATIVE APPROVAL.
-- This file is 1/4 of SQL v3 cooperative mission (6/4/2) security revision.
-- 2/4: participant command function + sanitized view function.
-- 3/4: server review + deadline/remaining-user + RLS + revoke/grant.
-- 4/4: indexes + test SQL + change SQL + rollback SQL.

-- ============================================================
-- READ-ONLY MEASUREMENT RESULTS (2026-09-08, actual DB)
-- ============================================================
-- public.missions: NOT FOUND (new, zero conflicts)
-- public.missions_policy: NOT FOUND (new, zero conflicts)
-- pgcrypto: installed, version 1.3, schema = extensions
-- profiles.id: uuid; conversations.user_id: uuid; spaces.owner_id: uuid
-- profiles.created_at: timestamptz; messages.created_at: timestamptz
-- => v3 type basis: user ids = uuid, timestamps = timestamptz.
-- => digest via extensions.digest(value, 'sha256').

begin;

-- ============================================================
-- 1) PREFLIGHT (detect existing v1/v2 tables, verify integrity)
--    If a table exists but differs from v3, stop with
--    MIGRATION_PREFLIGHT_FAILED. Never drop or auto-convert.
-- ============================================================
do $$
declare
  v_missions_exists boolean := false;
  v_policy_exists boolean := false;
  v_pgcrypto boolean := false;
  v_bad boolean := false;
  v_reason text := '';
  v_cnt bigint;
begin
  select to_regclass('public.missions') is not null into v_missions_exists;
  select to_regclass('public.missions_policy') is not null into v_policy_exists;
  select exists (select 1 from pg_extension where extname = 'pgcrypto')
    into v_pgcrypto;

  if not v_pgcrypto then
    v_reason := v_reason || 'pgcrypto missing;'; v_bad := true;
  end if;

  -- (A) missions: required columns + exact type + NOT NULL
  if v_missions_exists then
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='id' and c.udt_name='text' and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.id;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='stage' and c.udt_name='text' and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.stage;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='participant_ids' and c.udt_name='_uuid'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.participant_ids;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='revision' and c.udt_name='int4'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.revision;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='status' and c.udt_name='text'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.status;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='deadline' and c.udt_name='timestamptz') then
      v_reason := v_reason || 'missions.deadline;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='responses' and c.udt_name='jsonb'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.responses;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='processed_requests' and c.udt_name='jsonb'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.processed_requests;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='closed_by' and c.udt_name='uuid') then
      v_reason := v_reason || 'missions.closed_by;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='created_at' and c.udt_name='timestamptz'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.created_at;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions'
        and c.column_name='updated_at' and c.udt_name='timestamptz'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'missions.updated_at;'; v_bad := true;
    end if;

    -- primary key / check / unique constraints presence
    if not exists (select 1 from information_schema.table_constraints t
      where t.table_schema='public' and t.table_name='missions'
        and t.constraint_type='PRIMARY KEY') then
      v_reason := v_reason || 'missions.pk;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.table_constraints t
      where t.table_schema='public' and t.table_name='missions'
        and t.constraint_type='CHECK') then
      v_reason := v_reason || 'missions.check;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.table_constraints t
      where t.table_schema='public' and t.table_name='missions'
        and t.constraint_type='UNIQUE') then
      v_reason := v_reason || 'missions.unique;'; v_bad := true;
    end if;

    -- existing data integrity (only when rows exist)
    select count(*) into v_cnt from public.missions;
    if v_cnt > 0 then
      if exists (select 1 from public.missions
        where jsonb_typeof(responses) <> 'array'
           or jsonb_typeof(processed_requests) <> 'array') then
        v_reason := v_reason || 'json not array;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions
        where participant_ids is null or cardinality(participant_ids) <> 2) then
        v_reason := v_reason || 'participant count != 2;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions
        where participant_ids[1] is null or participant_ids[2] is null
           or participant_ids[1] = participant_ids[2]) then
        v_reason := v_reason || 'participant null/dup;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions
        where stage not in ('6','4','2')) then
        v_reason := v_reason || 'stage invalid;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions
        where status not in ('collecting','awaiting_review','completed','closed')) then
        v_reason := v_reason || 'status invalid;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions where revision < 0) then
        v_reason := v_reason || 'revision negative;'; v_bad := true;
      end if;
    end if;
  end if;

  -- (B) missions_policy: required columns + type + singleton
  if v_policy_exists then
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions_policy'
        and c.column_name='id' and c.udt_name='int4' and c.is_nullable='NO') then
      v_reason := v_reason || 'policy.id;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions_policy'
        and c.column_name='max_answer_chars' and c.udt_name='int4'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'policy.max_answer_chars;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions_policy'
        and c.column_name='max_requests_per_user' and c.udt_name='int4'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'policy.max_requests_per_user;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions_policy'
        and c.column_name='max_requests_total' and c.udt_name='int4'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'policy.max_requests_total;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='missions_policy'
        and c.column_name='updated_at' and c.udt_name='timestamptz'
        and c.is_nullable='NO') then
      v_reason := v_reason || 'policy.updated_at;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.table_constraints t
      where t.table_schema='public' and t.table_name='missions_policy'
        and t.constraint_type='PRIMARY KEY') then
      v_reason := v_reason || 'policy.pk;'; v_bad := true;
    end if;

    select count(*) into v_cnt from public.missions_policy;
    if v_cnt > 1 then
      v_reason := v_reason || 'policy rows > 1;'; v_bad := true;
    end if;
    if exists (select 1 from public.missions_policy where id <> 1) then
      v_reason := v_reason || 'policy id != 1;'; v_bad := true;
    end if;
    if exists (select 1 from public.missions_policy
      where max_answer_chars is null or max_answer_chars <= 0
         or max_requests_per_user is null or max_requests_per_user <= 0
         or max_requests_total is null or max_requests_total <= 0) then
      v_reason := v_reason || 'policy value not positive;'; v_bad := true;
    end if;
    if exists (select 1 from public.missions_policy
      where max_requests_total < max_requests_per_user) then
      v_reason := v_reason || 'policy total < per_user;'; v_bad := true;
    end if;
  end if;

  if v_bad then
    raise exception 'MIGRATION_PREFLIGHT_FAILED: %', v_reason using errcode = '22023';
  end if;
end;
$$;

-- ============================================================
-- 2) POLICY TABLE (singleton)
--    RLS + revoke/grant are applied in 3/4. No client can pass
--    or change policy values. If id=1 row is absent the command
--    functions stop with POLICY_NOT_CONFIGURED.
-- ============================================================
create table if not exists public.missions_policy (
  id integer primary key default 1 check (id = 1),
  max_answer_chars integer not null check (max_answer_chars > 0),
  max_requests_per_user integer not null check (max_requests_per_user > 0),
  max_requests_total integer not null check (max_requests_total > 0),
  updated_at timestamptz not null default now(),
  constraint missions_policy_total_ge_per_user
    check (max_requests_total >= max_requests_per_user)
);

-- ============================================================
-- 3) MISSIONS TABLE
--    participant_ids: uuid[] (same type as auth.uid()).
--    closed_by: uuid (same type as user id).
--    deadline: timestamptz (server now() comparison).
--    Participant integrity: exactly 2, distinct, non-null.
-- ============================================================
create table if not exists public.missions (
  id text primary key
    check (btrim(id) <> '' and length(id) <= 128),
  stage text not null check (stage in ('6','4','2')),
  participant_ids uuid[] not null,
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'collecting'
    check (status in ('collecting','awaiting_review','completed','closed')),
  deadline timestamptz,
  responses jsonb not null default '[]'::jsonb,
  processed_requests jsonb not null default '[]'::jsonb,
  closed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_participants_len check (cardinality(participant_ids) = 2),
  constraint missions_participants_not_null check (
    participant_ids[1] is not null and participant_ids[2] is not null
  ),
  constraint missions_participants_distinct check (
    participant_ids[1] <> participant_ids[2]
  )
);

-- [SQL v3 1/4 END - NOT TRUNCATED]