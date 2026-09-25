begin;

-- ============================================================
-- 협동 미션(6·4·2) — SQL v3 수정 원문 1/2
-- 상태: 수정 초안. 대표 승인 전까지 실행 금지(DDL/DML/RLS STOP).
-- 본 파일은 1/2이다. commit / 서버 검토 함수 / RLS / REVOKE·GRANT /
-- 인덱스 / 롤백 / 정적검사·시험조건은 2/2에 있다.
--
-- v3 수정 요점(검수 지적 반영):
--  ① JSON 생성 오류: ''::jsonb 제거 → v_command 는 항상 JSON 객체.
--  ② p_action IS NULL 명시 차단(NULL 이 not in 을 빠져나가지 못하게).
--  ③ 기존 v2 테이블 사전검사(열·자료형·제약·건수·deadline·closed_by·
--     JSON 배열·참여자 무결성) → 불일치 시 MIGRATION_PREFLIGHT_FAILED.
--  ④ submit/exit 모두 변경 전 p_expected_revision 검사.
--  ⑤ submit/exit 모두 변경 전 요청 제한 검사(전체 + 사용자별).
--  ⑥ responses 무결성 강화(객체·userId 문자열/참여자/중복·answer 문자열/
--     비공백/길이·불허 필드).
--  ⑦ processed_requests 무결성 강화 + 서버 생성 해시(pgcrypto)로
--     답변 원문 중복 보관 제거.
--  ⑧ 상태 전이 화이트리스트(collecting↔, →closed, →completed 서버 전용).
--  ⑨ 기한 만료는 DEADLINE_REACHED_POLICY_REQUIRED 만, 자동 보상·삭제 없음.
--     방 닫기·이탈/시간만료 구분·보상 후보 생성은 2/2 서버 설계로 연결.
--
-- 실제 DB 확인 결과(2026-09-08, 읽기 전용):
--  - missions, missions_policy 테이블: 미존재(신규).
--  - 기존 user_id 자료형: uuid. created_at 자료형: timestamptz.
--  - pgcrypto: 설치됨(extensions 스키마, version 1.3).
--    → extensions.digest(text, 'sha256') 사용 가능.
-- ============================================================

-- ------------------------------------------------------------
-- 1) 사전검사 SQL (기존 v2/v1 테이블 대응)
--    기존 public.missions / public.missions_policy 가 존재할 때
--    v3 구조와 불일치하면 자동 삭제·강제 변환 없이
--    MIGRATION_PREFLIGHT_FAILED 로 중단한다.
-- ------------------------------------------------------------
do $$
declare
  v_missions_exists boolean := false;
  v_policy_exists boolean := false;
  v_reason text := '';
  v_bad boolean := false;
  v_cnt bigint;
begin
  select exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'missions')
    into v_missions_exists;
  select exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'missions_policy')
    into v_policy_exists;

  -- (A) missions: 필수 열 존재 + 정확한 자료형
  if v_missions_exists then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'id' and udt_name = 'text') then
      v_reason := v_reason || 'missions.id 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'stage' and udt_name = 'text') then
      v_reason := v_reason || 'missions.stage 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'participant_ids' and udt_name = '_uuid') then
      v_reason := v_reason || 'missions.participant_ids 자료형 불일치(uuid[] 기대);'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'revision' and udt_name = 'int4') then
      v_reason := v_reason || 'missions.revision 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'status' and udt_name = 'text') then
      v_reason := v_reason || 'missions.status 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'deadline' and udt_name = 'timestamptz') then
      v_reason := v_reason || 'missions.deadline 자료형 불일치(timestamptz 기대);'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'responses' and udt_name = 'jsonb') then
      v_reason := v_reason || 'missions.responses 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'processed_requests' and udt_name = 'jsonb') then
      v_reason := v_reason || 'missions.processed_requests 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'closed_by' and udt_name = 'uuid') then
      v_reason := v_reason || 'missions.closed_by 자료형 불일치(uuid 기대);'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'created_at' and udt_name = 'timestamptz') then
      v_reason := v_reason || 'missions.created_at 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions'
                     and column_name = 'updated_at' and udt_name = 'timestamptz') then
      v_reason := v_reason || 'missions.updated_at 자료형 불일치;'; v_bad := true;
    end if;

    -- (B) 기존 데이터 무결성 (행이 있을 때만)
    select count(*) into v_cnt from public.missions;
    if v_cnt > 0 then
      if exists (select 1 from public.missions
                 where jsonb_typeof(responses) <> 'array'
                    or jsonb_typeof(processed_requests) <> 'array') then
        v_reason := v_reason || '기존 JSON 값이 배열이 아님;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions
                 where participant_ids is null or cardinality(participant_ids) <> 2) then
        v_reason := v_reason || '기존 참여자 수 != 2;'; v_bad := true;
      end if;
      if exists (select 1 from public.missions
                 where participant_ids is not null and cardinality(participant_ids) = 2
                   and (participant_ids[1] is null or participant_ids[2] is null
                        or participant_ids[1] = participant_ids[2])) then
        v_reason := v_reason || '기존 참여자 NULL/중복;'; v_bad := true;
      end if;
    end if;
  end if;

  -- (C) missions_policy: 필수 열 존재 + 자료형 + 싱글턴
  if v_policy_exists then
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions_policy'
                     and column_name = 'id' and udt_name = 'int4') then
      v_reason := v_reason || 'missions_policy.id 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions_policy'
                     and column_name = 'max_answer_chars' and udt_name = 'int4') then
      v_reason := v_reason || 'missions_policy.max_answer_chars 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions_policy'
                     and column_name = 'max_requests_per_user' and udt_name = 'int4') then
      v_reason := v_reason || 'missions_policy.max_requests_per_user 자료형 불일치;'; v_bad := true;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'missions_policy'
                     and column_name = 'max_requests_total' and udt_name = 'int4') then
      v_reason := v_reason || 'missions_policy.max_requests_total 자료형 불일치;'; v_bad := true;
    end if;
    select count(*) into v_cnt from public.missions_policy;
    if v_cnt > 1 then
      v_reason := v_reason || 'missions_policy 행 수 > 1;'; v_bad := true;
    end if;
  end if;

  if v_bad then
    raise exception 'MIGRATION_PREFLIGHT_FAILED: %', v_reason using errcode = '22023';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2) 정책 테이블(싱글턴)
--    id=1 행 하나만. 운영 확정값은 대표 승인 후 관리자/서버가 삽입.
--    함수는 이 테이블에서만 정책값을 읽는다(클라이언트 인수 없음).
--    max_requests_per_user: 사용자별 제한(한 사용자가 상대 제출을
--      막지 못하도록), max_requests_total: 방 전체 제한.
--    (RLS·권한 회수는 2/2에서 적용)
-- ------------------------------------------------------------
create table if not exists public.missions_policy (
  id integer primary key default 1 check (id = 1),
  max_answer_chars integer not null check (max_answer_chars > 0),
  max_requests_per_user integer not null check (max_requests_per_user > 0),
  max_requests_total integer not null check (max_requests_total > 0),
  updated_at timestamptz not null default now(),
  constraint missions_policy_total_ge_per_user
    check (max_requests_total >= max_requests_per_user)
);

-- ------------------------------------------------------------
-- 3) 미션 테이블 (신규 설치 또는 안전 중단 처리)
--    위 사전검사가 MIGRATION_PREFLIGHT_FAILED 없이 통과한 경우에만
--    아래 create table if not exists 에 도달한다. 즉, 테이블이 없거나
--    v3 구조와 일치할 때만 진행된다. 불일치 시 위에서 이미 중단.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4) 참여자 명령 함수 (submit / exit)
--    보안 요점:
--     - 사용자 식별은 auth.uid() 로만(p_user_id 인수 없음).
--     - p_action IS NULL 명시 차단.
--     - 정책값은 인수로 받지 않고 missions_policy 에서 읽는다.
--     - requestId 는 NULL·빈값·길이·허용문자 검사.
--     - 명령은 정규화된 JSON 객체로 만들고, extensions.digest 로
--       서버 해시(commandHash)를 생성해 processed_requests 에 저장한다.
--       답변 원문은 processed_requests 에 중복 보관하지 않는다.
--     - 잠금·읽기·검사·수정·저장을 단일 함수·단일 트랜잭션에서 처리.
--    참고: 이 함수의 EXECUTE 권한 회수/부여는 2/2에서 적용한다.
-- ------------------------------------------------------------
create or replace function public.submit_mission_command(
  p_mission_id text,
  p_request_id text,
  p_expected_revision integer,
  p_action text,
  p_answer text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_answer_chars integer;
  v_max_requests_per_user integer;
  v_max_requests_total integer;
  m record;
  v_command jsonb;
  v_command_hash text;
  v_existing jsonb;
  v_status text;
  v_revision integer;
  v_own_submitted boolean;
  v_partner_submitted boolean;
  v_user_request_count bigint;
  v_total_request_count bigint;
  v_target_status text;
begin
  -- 1) 인증 (JWT → auth.uid() 로만)
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  -- 2) 입력 검증
  if p_mission_id is null or btrim(p_mission_id) = '' or length(p_mission_id) > 128 then
    raise exception 'INVALID_MISSION_ID' using errcode = '22023';
  end if;

  if p_request_id is null or btrim(p_request_id) = ''
     or length(p_request_id) > 128
     or p_request_id !~ '^[A-Za-z0-9_-]{1,128}$' then
    raise exception 'INVALID_REQUEST_ID' using errcode = '22023';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;

  -- NULL action 명시 차단 (NULL 은 not in 조건을 통과하지 못하게)
  if p_action is null or p_action not in ('submit','exit') then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;

  -- 3) 정책값 (클라이언트 인수 없음, missions_policy 에서만)
  select max_answer_chars, max_requests_per_user, max_requests_total
    into v_max_answer_chars, v_max_requests_per_user, v_max_requests_total
  from public.missions_policy where id = 1;
  if not found then
    raise exception 'POLICY_NOT_CONFIGURED' using errcode = '22023';
  end if;

  -- 4) action 별 answer 규칙
  if p_action = 'submit' then
    if p_answer is null or btrim(p_answer) = '' or length(p_answer) > v_max_answer_chars then
      raise exception 'INVALID_ANSWER' using errcode = '22023';
    end if;
  else
    if p_answer is not null then
      raise exception 'INVALID_COMMAND' using errcode = '22023';
    end if;
  end if;

  -- 5) 정규화된 명령 객체 + 서버 생성 해시 (pgcrypto extensions.digest)
  v_command := jsonb_build_object('action', p_action);
  if p_action = 'submit' then
    v_command := v_command || jsonb_build_object('answer', btrim(p_answer));
  end if;
  v_command_hash := encode(extensions.digest(v_command::text, 'sha256'), 'hex');

  -- 6) 원자적 잠금 (조회·검사·수정·저장을 단일 트랜잭션에서)
  select * into m from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 7) 저장 상태 무결성 검사 (responses)
  if jsonb_typeof(m.responses) <> 'array' then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(m.responses) r
    where jsonb_typeof(r) <> 'object'
       or not (r ? 'userId' and r ? 'answer')
       or (select count(*) from jsonb_object_keys(r)) <> 2
       or jsonb_typeof(r->'userId') <> 'string'
       or jsonb_typeof(r->'answer') <> 'string'
       or r->>'userId' = '' or btrim(r->>'userId') <> r->>'userId'
       or not (r->>'userId' = any (m.participant_ids::text[]))
       or btrim(r->>'answer') = ''
       or length(r->>'answer') > v_max_answer_chars
  ) then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(m.responses) r)
     <> (select count(distinct r->>'userId') from jsonb_array_elements(m.responses) r) then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  -- 8) 저장 상태 무결성 검사 (processed_requests)
  if jsonb_typeof(m.processed_requests) <> 'array' then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(m.processed_requests) pr
    where jsonb_typeof(pr) <> 'object'
       or not (pr ? 'requestId' and pr ? 'userId' and pr ? 'commandHash')
       or (select count(*) from jsonb_object_keys(pr)) <> 3
       or jsonb_typeof(pr->'requestId') <> 'string'
       or pr->>'requestId' !~ '^[A-Za-z0-9_-]{1,128}$'
       or jsonb_typeof(pr->'userId') <> 'string'
       or pr->>'userId' = '' or btrim(pr->>'userId') <> pr->>'userId'
       or not (pr->>'userId' = any (m.participant_ids::text[]))
       or jsonb_typeof(pr->'commandHash') <> 'string'
       or pr->>'commandHash' !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(m.processed_requests) pr)
     <> (select count(distinct (pr->>'userId', pr->>'requestId'))
         from jsonb_array_elements(m.processed_requests) pr) then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  -- 9) 참여자 확인
  if not (v_user_id = any (m.participant_ids)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 10) 멱등 재요청 (revision 검사 전에)
  --     같은 (userId, requestId) + 같은 commandHash → 현재 상태 반환
  --     같은 (userId, requestId) + 다른 commandHash → REQUEST_ID_REUSED
  select elem into v_existing
  from jsonb_array_elements(m.processed_requests) as elem
  where elem->>'requestId' = p_request_id and elem->>'userId' = v_user_id::text
  limit 1;

  if v_existing is not null then
    if v_existing->>'commandHash' = v_command_hash then
      v_own_submitted := exists(select 1 from jsonb_array_elements(m.responses) r where r->>'userId' = v_user_id::text);
      return jsonb_build_object(
        'missionId', m.id, 'stage', m.stage, 'revision', m.revision, 'status', m.status,
        'ownSubmitted', v_own_submitted, 'waitingForPartner', m.status = 'collecting' and v_own_submitted
      );
    else
      raise exception 'REQUEST_ID_REUSED' using errcode = '23505';
    end if;
  end if;

  -- 11) 요청 제한 (모든 변경 전, submit/exit 공통)
  select count(*) into v_user_request_count
  from jsonb_array_elements(m.processed_requests) pr
  where pr->>'userId' = v_user_id::text;
  select jsonb_array_length(m.processed_requests) into v_total_request_count;

  if v_user_request_count >= v_max_requests_per_user then
    raise exception 'REQUEST_LIMIT' using errcode = '22023';
  end if;
  if v_total_request_count >= v_max_requests_total then
    raise exception 'REQUEST_LIMIT' using errcode = '22023';
  end if;

  -- 12) 예상 revision 검사 (submit/exit 공통, 변경 전)
  if p_expected_revision <> m.revision then
    raise exception 'STALE_REVISION' using errcode = '22023';
  end if;

  -- 13) 기한 검사 (자동 완료·보상·삭제 없음. 방 닫기·이탈/시간만료 구분·
  --     보상 후보 생성은 2/2 서버 설계로 연결)
  if m.deadline is not null and now() >= m.deadline then
    raise exception 'DEADLINE_REACHED_POLICY_REQUIRED' using errcode = '22023';
  end if;

  -- 14) 상태 전이 화이트리스트 + 분기
  --     허용 전이:
  --       collecting → collecting / collecting → awaiting_review (submit)
  --       collecting → closed / awaiting_review → closed (exit)
  --       awaiting_review → completed (서버 검토 함수 전용, 2/2)
  --       completed/closed → 변경 불가
  if p_action = 'exit' then
    if m.status not in ('collecting','awaiting_review') then
      raise exception 'INVALID_STATE_TRANSITION' using errcode = '22023';
    end if;
    update public.missions
      set status = 'closed',
          closed_by = v_user_id,
          revision = revision + 1,
          processed_requests = processed_requests || jsonb_build_array(
            jsonb_build_object('requestId', p_request_id, 'userId', v_user_id::text, 'commandHash', v_command_hash)
          ),
          updated_at = now()
      where id = m.id;
    select status, revision into v_status, v_revision from public.missions where id = m.id;
    return jsonb_build_object(
      'missionId', m.id, 'stage', m.stage, 'revision', v_revision, 'status', v_status,
      'ownSubmitted', false, 'waitingForPartner', false
    );
  end if;

  -- submit 분기
  if m.status not in ('collecting','awaiting_review') then
    raise exception 'MISSION_NOT_ACTIVE' using errcode = '22023';
  end if;

  v_partner_submitted := exists(
    select 1 from jsonb_array_elements(m.responses) r where r->>'userId' <> v_user_id::text
  );

  if v_partner_submitted then
    v_target_status := 'awaiting_review';
  else
    v_target_status := 'collecting';
  end if;

  if v_target_status not in ('collecting','awaiting_review') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = '22023';
  end if;

  update public.missions
    set responses = (
          coalesce((select jsonb_agg(r) from jsonb_array_elements(m.responses) r
                    where r->>'userId' <> v_user_id::text), '[]'::jsonb)
        ) || jsonb_build_array(jsonb_build_object('userId', v_user_id::text, 'answer', btrim(p_answer))),
        processed_requests = processed_requests || jsonb_build_array(
          jsonb_build_object('requestId', p_request_id, 'userId', v_user_id::text, 'commandHash', v_command_hash)
        ),
        status = v_target_status,
        revision = revision + 1,
        updated_at = now()
    where id = m.id;

  select status, revision into v_status, v_revision from public.missions where id = m.id;

  return jsonb_build_object(
    'missionId', m.id, 'stage', m.stage, 'revision', v_revision, 'status', v_status,
    'ownSubmitted', true,
    'waitingForPartner', v_status = 'collecting'
  );
end;
$$;

-- ------------------------------------------------------------
-- 5) 참여자용 정제 조회 함수
--    반환값은 missionId, stage, revision, status, ownSubmitted,
--    waitingForPartner 만 허용한다. participant_ids, responses,
--    processed_requests, commandHash, 상대방 답변은 절대 반환하지 않는다.
--    참고: 이 함수의 EXECUTE 권한 회수/부여는 2/2에서 적용한다.
-- ------------------------------------------------------------
create or replace function public.get_mission_participant_view(p_mission_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  m record;
  v_own_submitted boolean;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_mission_id is null or btrim(p_mission_id) = '' or length(p_mission_id) > 128 then
    raise exception 'INVALID_MISSION_ID' using errcode = '22023';
  end if;

  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (v_user_id = any (m.participant_ids)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(m.responses) <> 'array' then
    raise exception 'INVALID_SERVER_STATE' using errcode = '22023';
  end if;

  v_own_submitted := exists(select 1 from jsonb_array_elements(m.responses) r where r->>'userId' = v_user_id::text);

  return jsonb_build_object(
    'missionId', m.id,
    'stage', m.stage,
    'revision', m.revision,
    'status', m.status,
    'ownSubmitted', v_own_submitted,
    'waitingForPartner', m.status = 'collecting' and v_own_submitted
  );
end;
$$;

-- ============================================================
-- 1/2 종료. 이어지는 2/2에 포함될 항목:
--   - commit
--   - 서버 검토 함수(apply_server_review): 일반 사용자·관리자 화면에서
--     직접 호출 불가, 검증된 서버 역할만 실행, p_approved 는 서버 검증
--     평가에서만 도출, 현재 revision 과 평가 답변 상태 일치 확인
--   - RLS 전체(missions, missions_policy 기본 deny)
--   - REVOKE·GRANT 전체(PUBLIC/anon/authenticated 명시적 회수,
--     참여자에게 기본 테이블 INSERT·UPDATE·DELETE 권한 없음)
--   - 인덱스·자료 무결성
--   - 실제 변경 마이그레이션·롤백 원문
--   - SQL 정적 검사와 실제 DB 시험 조건
-- ============================================================