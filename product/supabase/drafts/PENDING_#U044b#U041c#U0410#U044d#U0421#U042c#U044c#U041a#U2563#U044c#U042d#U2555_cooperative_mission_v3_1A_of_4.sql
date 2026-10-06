-- [SQL v3 1A/4 - READ-ONLY MEASUREMENT + PGCRYPTO PREFLIGHT + MISSIONS SHAPE CHECK]
-- STATUS: DRAFT. EXECUTION FORBIDDEN UNTIL REPRESENTATIVE APPROVAL.
-- 1B/4: policy table + missions create table. 2/4: participant command + view.
-- 3/4: server review + deadline + RLS + revoke/grant. 4/4: indexes + test + change + rollback.

-- READ-ONLY MEASUREMENT SQL (executed 2026-09-08, actual):
--   select to_regclass('public.missions') is not null,
--          to_regclass('public.missions_policy') is not null;
--   select extname||':'||extversion||':'||n.nspname from pg_extension e
--     join pg_namespace n on n.oid = e.extnamespace where extname = 'pgcrypto';
--   select proname, nspname, pg_get_function_identity_arguments(oid),
--          pg_get_function_result(oid) from pg_proc
--     join pg_namespace n on n.oid = pronamespace where proname = 'digest';
-- MEASUREMENT RESULTS:
--   public.missions: NOT FOUND. public.missions_policy: NOT FOUND.
--   pgcrypto: version 1.3, schema = extensions.
--   extensions.digest signatures: (bytea,text)->bytea and (text,text)->bytea.
--   user ids = uuid, timestamps = timestamptz (profiles/spaces/messages/conversations).

begin;

do $$
declare
  v_missions_exists boolean;
  v_shape_bad boolean := false;
  v_reason text := '';
  v_cnt bigint;
  v_col_ok bigint;
begin
  -- pgcrypto: installed + extensions schema + digest(text,text)->bytea exists
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    v_reason := v_reason || 'pgcrypto missing;';
  end if;
  if not exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                 where e.extname = 'pgcrypto' and n.nspname = 'extensions') then
    v_reason := v_reason || 'pgcrypto schema;';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where p.proname = 'digest' and n.nspname = 'extensions'
                   and pg_get_function_identity_arguments(p.oid) = 'text, text'
                   and pg_get_function_result(p.oid) = 'bytea') then
    v_reason := v_reason || 'digest signature;';
  end if;

  select to_regclass('public.missions') is not null into v_missions_exists;

  if v_missions_exists then
    -- required columns + exact type + NOT NULL (single shape match)
    select count(*) into v_col_ok from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'missions'
      and (
        (c.column_name = 'id' and c.udt_name = 'text' and c.is_nullable = 'NO')
        or (c.column_name = 'stage' and c.udt_name = 'text' and c.is_nullable = 'NO')
        or (c.column_name = 'participant_ids' and c.udt_name = '_uuid' and c.is_nullable = 'NO')
        or (c.column_name = 'revision' and c.udt_name = 'int4' and c.is_nullable = 'NO')
        or (c.column_name = 'status' and c.udt_name = 'text' and c.is_nullable = 'NO')
        or (c.column_name = 'deadline' and c.udt_name = 'timestamptz')
        or (c.column_name = 'responses' and c.udt_name = 'jsonb' and c.is_nullable = 'NO')
        or (c.column_name = 'processed_requests' and c.udt_name = 'jsonb' and c.is_nullable = 'NO')
        or (c.column_name = 'closed_by' and c.udt_name = 'uuid')
        or (c.column_name = 'created_at' and c.udt_name = 'timestamptz' and c.is_nullable = 'NO')
        or (c.column_name = 'updated_at' and c.udt_name = 'timestamptz' and c.is_nullable = 'NO')
      );
    if v_col_ok <> 11 then
      v_reason := v_reason || 'missions.columns;'; v_shape_bad := true;
    end if;

    -- primary key: exactly one column, that column = id (conkey/attnum)
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass
        and c.contype = 'p'
        and array_length(c.conkey, 1) = 1
        and exists (
          select 1 from pg_attribute a
          where a.attrelid = c.conrelid
            and a.attnum = c.conkey[1]
            and a.attname = 'id'
        )
    ) then
      v_reason := v_reason || 'missions.pk;'; v_shape_bad := true;
    end if;

    -- exact CHECK constraints: fixed constraint name + exact definition
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_id_check'
        and pg_get_constraintdef(c.oid) = 'CHECK (((btrim(id) <> ''::text) AND (length(id) <= 128)))')
    then v_reason := v_reason || 'id.check;'; v_shape_bad := true; end if;
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_stage_check'
        and pg_get_constraintdef(c.oid) = 'CHECK ((stage = ANY (ARRAY[''6''::text, ''4''::text, ''2''::text])))')
    then v_reason := v_reason || 'stage.check;'; v_shape_bad := true; end if;
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_revision_check'
        and pg_get_constraintdef(c.oid) = 'CHECK ((revision >= 0))')
    then v_reason := v_reason || 'revision.check;'; v_shape_bad := true; end if;
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_status_check'
        and pg_get_constraintdef(c.oid) = 'CHECK ((status = ANY (ARRAY[''collecting''::text, ''awaiting_review''::text, ''completed''::text, ''closed''::text])))')
    then v_reason := v_reason || 'status.check;'; v_shape_bad := true; end if;
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_participants_len'
        and pg_get_constraintdef(c.oid) = 'CHECK ((cardinality(participant_ids) = 2))')
    then v_reason := v_reason || 'participant.len;'; v_shape_bad := true; end if;
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_participants_not_null'
        and pg_get_constraintdef(c.oid) = 'CHECK (((participant_ids[1] IS NOT NULL) AND (participant_ids[2] IS NOT NULL)))')
    then v_reason := v_reason || 'participant.null;'; v_shape_bad := true; end if;
    if not exists (select 1 from pg_constraint c
      where c.conrelid = 'public.missions'::regclass and c.contype = 'c'
        and c.conname = 'missions_participants_distinct'
        and pg_get_constraintdef(c.oid) = 'CHECK ((participant_ids[1] <> participant_ids[2]))')
    then v_reason := v_reason || 'participant.distinct;'; v_shape_bad := true; end if;

    -- data integrity: run only when shape is fully valid
    if not v_shape_bad then
      select count(*) into v_cnt from public.missions;
      if v_cnt > 0 then
        if exists (select 1 from public.missions where jsonb_typeof(responses) <> 'array' or jsonb_typeof(processed_requests) <> 'array') then v_reason := v_reason || 'json.array;'; end if;
        if exists (select 1 from public.missions where cardinality(participant_ids) <> 2) then v_reason := v_reason || 'participant.count;'; end if;
        if exists (select 1 from public.missions where participant_ids[1] is null or participant_ids[2] is null or participant_ids[1] = participant_ids[2]) then v_reason := v_reason || 'participant.dup;'; end if;
        if exists (select 1 from public.missions where stage not in ('6','4','2')) then v_reason := v_reason || 'stage.invalid;'; end if;
        if exists (select 1 from public.missions where status not in ('collecting','awaiting_review','completed','closed')) then v_reason := v_reason || 'status.invalid;'; end if;
        if exists (select 1 from public.missions where revision < 0) then v_reason := v_reason || 'revision.negative;'; end if;
      end if;
    end if;
  end if;

  if v_reason <> '' then
    raise exception 'MIGRATION_PREFLIGHT_FAILED: %', v_reason using errcode = '22023';
  end if;
end;
$$;

-- [SQL v3 1A/4 END - NOT TRUNCATED]