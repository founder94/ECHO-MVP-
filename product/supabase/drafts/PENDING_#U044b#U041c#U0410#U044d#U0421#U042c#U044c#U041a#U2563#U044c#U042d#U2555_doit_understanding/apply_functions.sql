-- =====================================================================
-- PENDING_대표승인  doit_understanding — 서버 전용 반영 함수 초안 (V412)
-- 상태: 초안(DRAFT). 대표 승인 전 절대 실행 금지(STOP).
--
-- 목적: AI 후보 생성은 Edge Function이 수행하고, "최종 데이터 반영 + doit_request_events
--       완료 기록"은 아래 서버 전용 DB 함수의 단일 트랜잭션에서 원자적으로 처리한다.
--
-- 해결하는 문제 (이전 멱등 로직의 6가지 결함 철회 후 재설계):
--   1) 오래된 pending 을 pending 으로 갱신 → 다중 성공   → advisory lock 으로 (user_id, request_id) 직렬화
--   2) failed 분기가 재선점 없이 proceed                 → failed 는 lock 안에서 재시도로 재진입
--   3) checkExists 조회와 저장 사이 race                 → 조회·저장을 동일 트랜잭션 + lock 안에서 수행
--   4) 조회 오류를 "저장 안 됨"으로 취급                  → plpgsql 예외 시 전체 롤백(쓰기 중단)
--   5) revision 변경만으로 성공 증명 불가                → events.status='applied' + applied_revision 을 데이터 변경과 동일 트랜잭션에서 기록
--   6) created_at 만료가 재선점 후에도 stale 판정          → 시간 기반 만료 제거, lock + 상태 재확인으로만 판정
--
-- 원칙:
--   - 모든 함수는 SECURITY DEFINER + search_path='' + public. 완전 표기.
--   - execute 권한은 service_role 에만 부여. anon/authenticated/public 은 REVOKE.
--   - p_user_id 는 Edge Function 이 getUser() 로 실검증한 값만 전달받는다(함수는 인증 책임 없음).
--   - 로그·반환 값에 사용자 원문·토큰·키 미포함.
--
-- 기존 4개 테이블만 사용. 신규 테이블 0, 기존 테이블/컬럼 변경 0.
-- =====================================================================

begin;

-- ───────────────────────────────────────────────────────────────────
-- ① record_create : 첫 자기이해 기록 생성 (confirmed)
-- ───────────────────────────────────────────────────────────────────
create function public.doit_apply_record_create(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text,
  p_text text,
  p_emotion text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_evt record;
  v_rec record;
begin
  -- 같은 user_id+request_id 를 트랜잭션 잠금으로 직렬화(문제 1·3 해결)
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  select * into v_evt from public.doit_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    -- action·payload 불일치 → 충돌(문제 2 해결: 같은 request_id 는 같은 내용만)
    if v_evt.action is distinct from p_action or v_evt.payload_hash is distinct from p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    end if;
    -- 완료 요청이면 기존 결과 재반환(요구 3)
    if v_evt.status = 'applied' then
      select * into v_rec from public.doit_records
        where user_id = p_user_id and request_id = p_request_id;
      return jsonb_build_object('ok', true, 'duplicate', true,
        'record', case when v_rec.id is null then null else to_jsonb(v_rec) end);
    end if;
    -- failed → 재시도로 재진입(문제 2 해결). pending 은 같은 잠금 하에서 도달하지 않음.
  else
    insert into public.doit_request_events(user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  end if;

  -- 데이터 변경(요구 5: 아래 events 갱신과 동일 트랜잭션)
  insert into public.doit_records(user_id, original_text, text, emotion, status, request_id)
    values (p_user_id, p_text, p_text, p_emotion, 'confirmed', p_request_id)
    returning * into v_rec;

  update public.doit_request_events
    set status = 'applied', target_id = v_rec.id, applied_revision = 1, error_code = null
    where user_id = p_user_id and request_id = p_request_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'record', to_jsonb(v_rec));
exception
  when others then raise; -- 조회/쓰기 오류 시 전체 롤백(문제 4 해결)
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- ② insight_generate : AI 후보 다수 생성 (candidate)
--   Edge Function 이 LLM 으로 만든 후보 배열을 p_candidates(jsonb)로 받아 반영.
-- ───────────────────────────────────────────────────────────────────
create function public.doit_apply_insight_generate(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text,
  p_record_id uuid,
  p_source_text text,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_evt record;
  v_list jsonb;
  v_i int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  select * into v_evt from public.doit_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from p_action or v_evt.payload_hash is distinct from p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    end if;
    if v_evt.status = 'applied' then
      select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) into v_list
        from public.doit_insights t
        where t.user_id = p_user_id and t.request_id = p_request_id;
      return jsonb_build_object('ok', true, 'duplicate', true, 'insights', v_list);
    end if;
  else
    insert into public.doit_request_events(user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  end if;

  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array' then
    update public.doit_request_events set status = 'failed', error_code = 'BAD_REQUEST'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  end if;

  for v_i in 0 .. jsonb_array_length(p_candidates) - 1 loop
    insert into public.doit_insights(
      user_id, category, text, ai_text, source_record_id, source_text, status, origin, request_id
    ) values (
      p_user_id,
      p_candidates->v_i->>'category',
      p_candidates->v_i->>'text',
      p_candidates->v_i->>'text',
      p_record_id,
      p_source_text,
      'candidate',
      'ai',
      p_request_id
    );
  end loop;

  update public.doit_request_events
    set status = 'applied', target_id = p_record_id, error_code = null
    where user_id = p_user_id and request_id = p_request_id;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) into v_list
    from public.doit_insights t
    where t.user_id = p_user_id and t.request_id = p_request_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'insights', v_list);
exception
  when others then raise;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- ③ insight_self : 사용자 직접 설명 (confirmed, 단건)
-- ───────────────────────────────────────────────────────────────────
create function public.doit_apply_insight_self(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text,
  p_record_id uuid,
  p_category text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_evt record;
  v_rec record;
  v_source text;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  select * into v_evt from public.doit_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from p_action or v_evt.payload_hash is distinct from p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    end if;
    if v_evt.status = 'applied' then
      select * into v_rec from public.doit_insights
        where user_id = p_user_id and request_id = p_request_id
        limit 1;
      return jsonb_build_object('ok', true, 'duplicate', true,
        'insight', case when v_rec.id is null then null else to_jsonb(v_rec) end);
    end if;
  else
    insert into public.doit_request_events(user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  end if;

  select text into v_source from public.doit_records
    where id = p_record_id and user_id = p_user_id;
  if not found then
    update public.doit_request_events set status = 'failed', error_code = 'FORBIDDEN'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.doit_insights(user_id, category, text, source_record_id, source_text, status, origin, request_id)
    values (p_user_id, p_category, p_text, p_record_id, v_source, 'confirmed', 'self', p_request_id)
    returning * into v_rec;

  update public.doit_request_events
    set status = 'applied', target_id = v_rec.id, applied_revision = 1, error_code = null
    where user_id = p_user_id and request_id = p_request_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'insight', to_jsonb(v_rec));
exception
  when others then raise;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- ④ insight_transition : confirm/correct/reject 상태 전이 (revision 낙관 잠금)
--   p_new_status ∈ ('confirmed','corrected','rejected'). p_text 는 correct 일 때만 사용.
-- ───────────────────────────────────────────────────────────────────
create function public.doit_apply_insight_transition(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text,
  p_insight_id uuid,
  p_expected_revision integer,
  p_new_status text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_evt record;
  v_ins record;
  v_cur_status text;
  v_cur_rev integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  select * into v_evt from public.doit_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from p_action or v_evt.payload_hash is distinct from p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    end if;
    if v_evt.status = 'applied' then
      select * into v_ins from public.doit_insights
        where id = p_insight_id and user_id = p_user_id;
      return jsonb_build_object('ok', true, 'duplicate', true,
        'insight', case when v_ins.id is null then null else to_jsonb(v_ins) end);
    end if;
  else
    insert into public.doit_request_events(user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  end if;

  -- 해당 요청이 "미처리"일 때만 revision·상태 확인(요구 4)
  select status, revision into v_cur_status, v_cur_rev from public.doit_insights
    where id = p_insight_id and user_id = p_user_id;
  if not found then
    update public.doit_request_events set status = 'failed', error_code = 'FORBIDDEN'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_cur_status = 'rejected' then
    update public.doit_request_events set status = 'failed', error_code = 'INVALID_STATE'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;
  if v_cur_rev is distinct from p_expected_revision then
    -- 서로 다른 요청이 이미 revision 을 변경 → 내 요청 성공으로 처리하지 않음(요구 7)
    update public.doit_request_events set status = 'failed', error_code = 'STALE_REVISION'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'STALE_REVISION');
  end if;

  update public.doit_insights
    set status = p_new_status,
        revision = revision + 1,
        text = case when p_text is not null and btrim(p_text) <> '' then p_text else text end,
        request_id = p_request_id
    where id = p_insight_id and user_id = p_user_id
    returning * into v_ins;

  if v_ins.id is null then
    update public.doit_request_events set status = 'failed', error_code = 'STALE_REVISION'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'STALE_REVISION');
  end if;

  update public.doit_request_events
    set status = 'applied', target_id = p_insight_id,
        prev_revision = p_expected_revision, applied_revision = p_expected_revision + 1, error_code = null
    where user_id = p_user_id and request_id = p_request_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'insight', to_jsonb(v_ins));
exception
  when others then raise;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- ⑤ handoff : B→A 기술 연결 (원문 미복사)
--   소유권·연결 일치 검증은 기존 doit_handoffs_owner_check 트리거가 담당.
-- ───────────────────────────────────────────────────────────────────
create function public.doit_apply_handoff(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload_hash text,
  p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_evt record;
  v_rec record;
  v_conv uuid;
  v_report uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  select * into v_evt from public.doit_request_events
    where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_evt.action is distinct from p_action or v_evt.payload_hash is distinct from p_payload_hash then
      return jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    end if;
    if v_evt.status = 'applied' then
      select * into v_rec from public.doit_handoffs
        where user_id = p_user_id and request_id = p_request_id;
      return jsonb_build_object('ok', true, 'duplicate', true,
        'handoff', case when v_rec.id is null then null else to_jsonb(v_rec) end);
    end if;
  else
    insert into public.doit_request_events(user_id, request_id, action, payload_hash, status)
      values (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  end if;

  select id into v_conv from public.conversations
    where id = p_conversation_id and user_id = p_user_id;
  if not found then
    update public.doit_request_events set status = 'failed', error_code = 'FORBIDDEN'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select id into v_report from public.reports
    where conversation_id = p_conversation_id and user_id = p_user_id;
  if not found then
    update public.doit_request_events set status = 'failed', error_code = 'FORBIDDEN'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.doit_handoffs(user_id, source_conversation_id, source_report_id, request_id)
    values (p_user_id, p_conversation_id, v_report, p_request_id)
    returning * into v_rec;

  update public.doit_request_events
    set status = 'applied', target_id = v_rec.id, error_code = null
    where user_id = p_user_id and request_id = p_request_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'handoff', to_jsonb(v_rec));
exception
  when others then raise;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 권한: service_role 전용. anon/authenticated/public 실행 금지.
-- ───────────────────────────────────────────────────────────────────
revoke all on function public.doit_apply_record_create(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.doit_apply_insight_generate(uuid, uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.doit_apply_insight_self(uuid, uuid, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.doit_apply_insight_transition(uuid, uuid, text, text, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.doit_apply_handoff(uuid, uuid, text, text, uuid) from public, anon, authenticated;

grant execute on function public.doit_apply_record_create(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.doit_apply_insight_generate(uuid, uuid, text, text, uuid, text, jsonb) to service_role;
grant execute on function public.doit_apply_insight_self(uuid, uuid, text, text, uuid, text, text) to service_role;
grant execute on function public.doit_apply_insight_transition(uuid, uuid, text, text, uuid, integer, text, text) to service_role;
grant execute on function public.doit_apply_handoff(uuid, uuid, text, text, uuid) to service_role;

commit;

-- =====================================================================
-- 검증 SQL (승인·실행 후, 아래는 읽기 전용 확인)
-- =====================================================================
-- 함수 존재 + 소유자 + security 정의 확인
-- select p.proname, pg_get_function_identity_arguments(p.oid), pg_get_userbyid(p.proowner)
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like 'doit_apply_%' order by p.proname;
--
-- service_role 만 execute 확인
-- select grantee, routine_name from information_schema.role_routine_grants
-- where routine_schema = 'public' and routine_name like 'doit_apply_%' order by routine_name;