-- [SQL v3 2/4 - PARTICIPANT COMMAND + REFINED QUERY]
-- STATUS: DRAFT. EXECUTION FORBIDDEN UNTIL REPRESENTATIVE APPROVAL.
-- - 사용자 식별은 auth.uid() 만 사용. p_user_id 인수 금지.
-- - 클라이언트 digest 금지. 명령 해시는 서버가 extensions.digest 로 생성.
-- - 클라이언트 정책값(최대 글자·요청 제한) 금지. 서버 missions_policy 로만.
-- - SELECT ... FOR UPDATE 단일 트랜잭션 내에서 인증~저장까지 한 번에 처리.
-- - 상대방 답변 원문·전체 참여자 목록·내부 해시는 절대 반환하지 않는다.

begin;

-- ---------------------------------------------------------------------------
-- 1) 정제 조회 함수 (SECURITY DEFINER + 빈 search_path)
--    참여자에게 다음만 반환: missionId, stage, revision, status,
--    ownSubmitted, waitingForPartner, deadline.
-- ---------------------------------------------------------------------------
create or replace function public.get_mission_refined(
  p_mission_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_own_submitted boolean;
  v_waiting boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_mission
  from public.missions
  where id = p_mission_id;

  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 비참여자 접근 거부
  if v_uid <> all (v_mission.participant_ids) then
    raise exception 'NOT_PARTICIPANT' using errcode = '42501';
  end if;

  select exists (
    select 1 from jsonb_array_elements(v_mission.responses) as r
    where (r->>'userId') = v_uid::text
      and (r->>'stage') = v_mission.stage
  ) into v_own_submitted;

  -- waitingForPartner: 수집 중이며, 내가 이미 냈고 상대는 아직 안 냄
  v_waiting := v_mission.status = 'collecting'
    and v_own_submitted
    and exists (
      select 1
      from unnest(v_mission.participant_ids) as p(pid)
      where p.pid <> v_uid
        and not exists (
          select 1 from jsonb_array_elements(v_mission.responses) as r
          where (r->>'userId') = p.pid::text
            and (r->>'stage') = v_mission.stage
        )
    );

  return jsonb_build_object(
    'missionId', v_mission.id,
    'stage', v_mission.stage,
    'revision', v_mission.revision,
    'status', v_mission.status,
    'ownSubmitted', v_own_submitted,
    'waitingForPartner', v_waiting,
    'deadline', v_mission.deadline,
    'closeReason', v_mission.close_reason
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) 제출 함수 (단일 트랜잭션 + 행 잠금)
--    허용 상태 전이: collecting → collecting, collecting → awaiting_review.
--    completed / closed 에서는 제출·수정 불가.
-- ---------------------------------------------------------------------------
create or replace function public.submit_cooperative_command(
  p_mission_id          text,
  p_request_id          text,
  p_command             text,
  p_expected_revision   int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_policy public.missions_policy%rowtype;
  v_mission public.missions%rowtype;
  v_request_hash text;
  v_match int;
  v_user_count int;
  v_total_count int;
  v_both_submitted boolean;
begin
  -- (1) 인증
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  -- (2) 서버 정책 조회 (없으면 실패 방식 중단)
  select * into v_policy from public.missions_policy limit 1;
  if not found then
    raise exception 'POLICY_MISSING' using errcode = 'P0001';
  end if;
  if v_policy.max_answer_length is null
     or v_policy.max_requests_per_user is null
     or v_policy.max_requests_total is null then
    raise exception 'POLICY_INVALID' using errcode = 'P0001';
  end if;

  -- (3) requestId 검증: NULL/빈값/길이/허용문자
  if p_request_id is null
     or btrim(p_request_id) = ''
     or length(p_request_id) > 64
     or p_request_id ~ '[^a-zA-Z0-9_-]' then
    raise exception 'INVALID_REQUEST_ID' using errcode = '22023';
  end if;

  -- (4) 명령 길이 검증 (서버 정책값)
  if p_command is null or length(p_command) > v_policy.max_answer_length then
    raise exception 'COMMAND_TOO_LONG' using errcode = '22023';
  end if;

  -- (5) 미션 행 잠금
  select * into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- (6) 참여자 확인
  if v_uid <> all (v_mission.participant_ids) then
    raise exception 'NOT_PARTICIPANT' using errcode = '42501';
  end if;

  -- (7) 상태 전이 검사: completed/closed 에서는 제출 불가
  if v_mission.status <> 'collecting' then
    raise exception 'MISSION_NOT_COLLECTING' using errcode = 'P0001';
  end if;

  -- (8) expected revision 검사
  if v_mission.revision <> p_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40900';
  end if;

  -- (9) 서버 생성 명령 해시 (클라이언트 digest 신뢰 금지)
  v_request_hash := encode(extensions.digest(p_command, 'sha256'), 'hex');

  -- (10) 멱등성: 동일 사용자 + 동일 requestId
  select count(*) into v_match
  from jsonb_array_elements(v_mission.processed_requests) as req
  where (req->>'requestId') = p_request_id
    and (req->>'userId') = v_uid::text;

  if v_match > 0 then
    -- 같은 requestId + 같은 명령 해시 → 멱등 재시도 (재저장 없이 현재 정제 상태 반환)
    select count(*) into v_match
    from jsonb_array_elements(v_mission.processed_requests) as req
    where (req->>'requestId') = p_request_id
      and (req->>'userId') = v_uid::text
      and (req->>'commandHash') = v_request_hash;

    if v_match = 0 then
      raise exception 'REQUEST_ID_CONFLICT' using errcode = '40900';
    end if;

    return public.get_mission_refined(v_mission.id);
  end if;

  -- (11) 사용자별 요청 제한
  select count(*) into v_user_count
  from jsonb_array_elements(v_mission.processed_requests) as req
  where (req->>'userId') = v_uid::text;

  if v_user_count >= v_policy.max_requests_per_user then
    raise exception 'USER_REQUEST_LIMIT' using errcode = '42900';
  end if;

  -- (12) 미션 전체 요청 제한
  v_total_count := jsonb_array_length(v_mission.processed_requests);
  if v_total_count >= v_policy.max_requests_total then
    raise exception 'TOTAL_REQUEST_LIMIT' using errcode = '42900';
  end if;

  -- (13) 같은 단계의 내 기존 답변 제거 후 갱신 (원문은 responses 에만, 해시는 requests 에만)
  v_mission.responses := (
    select coalesce(jsonb_agg(r), '[]'::jsonb)
    from jsonb_array_elements(v_mission.responses) as r
    where (r->>'userId') <> v_uid::text
       or (r->>'stage') <> v_mission.stage
  );

  v_mission.responses := v_mission.responses || jsonb_build_object(
    'userId', v_uid::text,
    'stage', v_mission.stage,
    'answer', p_command,
    'submittedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  -- (14) 처리 요청 기록 (원문 없음, 해시·메타데이터만)
  v_mission.processed_requests := v_mission.processed_requests || jsonb_build_object(
    'requestId', p_request_id,
    'userId', v_uid::text,
    'commandHash', v_request_hash,
    'stage', v_mission.stage,
    'createdAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  -- (15) 상태 전이: 두 참여자 모두 이 단계 제출 → awaiting_review (서버만 결정)
  select (count(distinct (r->>'userId')) >= 2) into v_both_submitted
  from jsonb_array_elements(v_mission.responses) as r
  where (r->>'stage') = v_mission.stage;

  if v_both_submitted then
    v_mission.status := 'awaiting_review';
  end if;

  v_mission.revision := v_mission.revision + 1;
  v_mission.updated_at := now();

  update public.missions set
    responses         = v_mission.responses,
    processed_requests = v_mission.processed_requests,
    status            = v_mission.status,
    revision          = v_mission.revision,
    updated_at        = v_mission.updated_at
  where id = v_mission.id;

  -- (16) 정제된 결과만 반환
  return public.get_mission_refined(v_mission.id);
end;
$$;

-- [SQL v3 2/4 END - NOT TRUNCATED]
commit;