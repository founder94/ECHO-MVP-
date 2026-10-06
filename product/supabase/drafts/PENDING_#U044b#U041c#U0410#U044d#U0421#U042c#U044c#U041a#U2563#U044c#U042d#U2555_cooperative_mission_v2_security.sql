-- ============================================================
-- PENDING_대표승인 — 협동 미션(6·4·2) 서버 스키마 + 원자적 상태머신
-- 파일: supabase/drafts/PENDING_대표승인_cooperative_mission_v2_security.sql
-- 상태: 보안 수정 초안(v2). 대표 승인 전까지 실행 금지(DDL/DML/RLS STOP).
--
-- v1 → v2 보안 수정 요약:
--  1) 권한 위조 차단: submit_mission_command 의 p_user_id 파라미터 제거.
--     사용자 ID는 JWT에서 auth.uid() 로 파생. 타인 ID 주입 불가.
--  2) 직접 호출 차단: apply_server_review 에 실제 권한 검사 코드 추가.
--     (JWT role=service_role 또는 기존 public.is_admin()) + EXECUTE 권한 최소화.
--  3) 상대 답변 노출 차단: 참여자의 missions 테이블 직접 SELECT 를 RLS 기본 deny 로
--     막고, sanitize된 조회 함수(get_mission_participant_view)로만 노출.
--     상대방 답변(responses)은 절대 반환하지 않는다.
--
-- 기존 자산 재사용(신규 권한 함수·트리거 추가 없음):
--  - public.is_admin(): auth.uid() + profiles.role='admin'
--  - profiles.role 은 pa_profiles_role_lock 트리거로 위조 불가(JWT role 강제 'user')
-- ============================================================

-- 1) 미션 테이블 (participant_ids 를 uuid[] 로 변경: auth.uid() 와 타입 일치)
create table if not exists public.missions (
  id text primary key,
  stage text not null check (stage in ('6','4','2')),
  participant_ids uuid[] not null,
  revision integer not null default 0,
  status text not null default 'collecting'
    check (status in ('collecting','awaiting_review','completed','closed')),
  deadline bigint,                                   -- epoch millis 또는 null
  responses jsonb not null default '[]',             -- [{userId, answer}]
  processed_requests jsonb not null default '[]',    -- [{requestId, userId, digest}]
  closed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_participants_len check (cardinality(participant_ids) = 2)
);

-- ============================================================
-- 2) 참여자 제출 RPC (submit / exit)
--    보안: p_user_id 파라미터 없음 → auth.uid() 로 사용자 파생(위조 불가).
-- ============================================================
create or replace function public.submit_mission_command(
  p_mission_id text,
  p_request_id text,
  p_request_digest text,
  p_expected_revision integer,
  p_action text,          -- 'submit' | 'exit'
  p_answer text default null,
  p_max_answer_chars integer default 500,
  p_max_requests integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  m record;
  reused jsonb;
  v_status text;
  v_revision integer;
  own_submitted boolean;
begin
  -- 인증: JWT에서 사용자 파생. p_user_id 를 받지 않으므로 타인 위조 불가.
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  -- 입력 검증
  if p_action not in ('submit','exit') then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;
  if p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_DIGEST' using errcode = '22023';
  end if;
  if p_action = 'submit' and (p_answer is null or btrim(p_answer) = '' or length(p_answer) > p_max_answer_chars) then
    raise exception 'INVALID_ANSWER' using errcode = '22023';
  end if;
  if p_action = 'exit' and p_answer is not null then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;
  if p_max_answer_chars < 1 or p_max_requests < 1 then
    raise exception 'POLICY_NOT_CONFIGURED' using errcode = '22023';
  end if;

  -- 원자적 잠금: 행을 잠근 뒤 읽기/쓰기를 한 트랜잭션에서 수행
  select * into m from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 참여자 확인 (auth.uid() 기준)
  if not (v_user_id = any(m.participant_ids)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 요청 중복 확인(같은 requestId + userId)
  select elem into reused
  from jsonb_array_elements(m.processed_requests) as elem
  where elem->>'requestId' = p_request_id and (elem->>'userId')::uuid = v_user_id
  limit 1;

  if reused is not null then
    if reused->>'digest' <> p_request_digest then
      raise exception 'REQUEST_ID_REUSED' using errcode = '23505';
    end if;
    -- 멱등: 동일 요청 재전송 → 현재 상태 그대로 반환
    own_submitted := exists(select 1 from jsonb_array_elements(m.responses) r where (r->>'userId')::uuid = v_user_id);
    return jsonb_build_object(
      'missionId', m.id,
      'stage', m.stage,
      'revision', m.revision,
      'status', m.status,
      'ownSubmitted', own_submitted,
      'waitingForPartner', m.status = 'collecting' and own_submitted
    );
  end if;

  -- 종료 처리 (자동 보상·삭제 없음)
  if p_action = 'exit' then
    if m.status <> 'closed' then
      update public.missions
        set status = 'closed',
            closed_by = v_user_id::text,
            revision = revision + 1,
            updated_at = now()
        where id = m.id;
    end if;
    select status, revision into v_status, v_revision from public.missions where id = m.id;
    return jsonb_build_object(
      'missionId', m.id, 'stage', m.stage, 'revision', v_revision, 'status', v_status,
      'ownSubmitted', false, 'waitingForPartner', false
    );
  end if;

  -- 제출 처리
  if m.status = 'closed' or m.status = 'completed' then
    raise exception 'MISSION_NOT_ACTIVE' using errcode = '22023';
  end if;
  if p_expected_revision <> m.revision then
    raise exception 'STALE_REVISION' using errcode = '22023';
  end if;
  if m.deadline is not null and (extract(epoch from now()) * 1000)::bigint >= m.deadline then
    raise exception 'DEADLINE_REACHED_POLICY_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_array_length(m.processed_requests) >= p_max_requests then
    raise exception 'REQUEST_LIMIT' using errcode = '22023';
  end if;

  -- 기존 응답 제거 후 새 응답 기록
  update public.missions
    set responses = (
          coalesce((select jsonb_agg(r) from jsonb_array_elements(m.responses) r
                    where (r->>'userId')::uuid <> v_user_id), '[]'::jsonb)
        ) || jsonb_build_array(jsonb_build_object('userId', v_user_id::text, 'answer', btrim(p_answer))),
        processed_requests = m.processed_requests || jsonb_build_array(
          jsonb_build_object('requestId', p_request_id, 'userId', v_user_id::text, 'digest', p_request_digest)
        ),
        status = case when (
          (select count(*) from jsonb_array_elements(m.responses) r where (r->>'userId')::uuid <> v_user_id) = 1
        ) then 'awaiting_review' else 'collecting' end,
        revision = revision + 1,
        updated_at = now()
    where id = m.id;

  select status, revision into v_status, v_revision from public.missions where id = m.id;
  own_submitted := exists(select 1 from jsonb_array_elements((select responses from public.missions where id = m.id)) r where (r->>'userId')::uuid = v_user_id);

  return jsonb_build_object(
    'missionId', m.id, 'stage', m.stage, 'revision', v_revision, 'status', v_status,
    'ownSubmitted', own_submitted,
    'waitingForPartner', v_status = 'collecting' and own_submitted
  );
end;
$$;

-- ============================================================
-- 3) 참여자 조회 RPC (sanitize: 상대방 답변·digest 미노출)
--    보안: responses / processed_requests 를 절대 반환하지 않는다.
-- ============================================================
create or replace function public.get_mission_participant_view(p_mission_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  m record;
  own_submitted boolean;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (v_user_id = any(m.participant_ids)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  own_submitted := exists(select 1 from jsonb_array_elements(m.responses) r where (r->>'userId')::uuid = v_user_id);

  -- 상대방 답변(responses)은 반환하지 않는다. 상태 플래그만.
  return jsonb_build_object(
    'missionId', m.id,
    'stage', m.stage,
    'revision', m.revision,
    'status', m.status,
    'ownSubmitted', own_submitted,
    'waitingForPartner', m.status = 'collecting' and own_submitted
  );
end;
$$;

-- ============================================================
-- 4) 서버 리뷰 RPC (완료 승인)
--    보안: JWT role=service_role 또는 기존 public.is_admin() 만 호출 가능.
--          p_approved 는 서버 검증 평가에서만 도출한다(사용자/LLM 답변 직접 수용 금지).
-- ============================================================
create or replace function public.apply_server_review(
  p_mission_id text,
  p_expected_revision integer,
  p_approved boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_role text;
  m record;
begin
  -- 실제 권한 검사 (주석이 아니라 코드):
  --  - service_role(서버 프로세스) → 허용
  --  - authenticated + public.is_admin() → 허용
  --  - 그 외(일반 사용자) → FORBIDDEN
  v_claim_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  if v_claim_role <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into m from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_revision <> m.revision then
    raise exception 'STALE_REVIEW' using errcode = '22023';
  end if;
  if m.status <> 'awaiting_review' or jsonb_array_length(m.responses) <> 2 then
    raise exception 'REVIEW_NOT_READY' using errcode = '22023';
  end if;
  if m.deadline is not null and (extract(epoch from now()) * 1000)::bigint >= m.deadline then
    raise exception 'DEADLINE_REACHED_POLICY_REQUIRED' using errcode = '22023';
  end if;

  if not p_approved then
    return jsonb_build_object('missionId', m.id, 'status', m.status, 'revision', m.revision, 'approved', false);
  end if;

  update public.missions
    set status = 'completed', revision = revision + 1, updated_at = now()
    where id = m.id;

  return jsonb_build_object('missionId', m.id, 'status', 'completed', 'revision', m.revision + 1, 'approved', true);
end;
$$;

-- ============================================================
-- 5) 관리자 전체 조회 RPC (리뷰용: 양쪽 답변 확인)
--    보안: is_admin()/service_role 만 호출. 참여자에게는 노출 금지.
-- ============================================================
create or replace function public.get_mission_admin_view(p_mission_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_role text;
  m record;
begin
  v_claim_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  if v_claim_role <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into m from public.missions where id = p_mission_id;
  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', m.id, 'stage', m.stage, 'participantIds', m.participant_ids,
    'revision', m.revision, 'status', m.status, 'deadline', m.deadline,
    'responses', m.responses, 'closedBy', m.closed_by
  );
end;
$$;

-- ============================================================
-- 6) RLS: 정책 없음(기본 deny). 참여자의 직접 SELECT/INSERT/UPDATE/DELETE 전면 차단.
--    모든 접근은 위 security definer 함수를 통해서만.
--    (security definer 함수는 소유자 권한으로 RLS 를 우회하고, 함수 내부에서
--     auth.uid() + 참여자/관리자 검사를 직접 수행한다.)
-- ============================================================
alter table public.missions enable row level security;

-- ============================================================
-- 7) EXECUTE 권한 최소화 (함수는 RLS 를 타지 않으므로 명시적 revoke/grant)
-- ============================================================
-- 참여자용: authenticated 만 호출 가능
revoke execute on function public.submit_mission_command(text, text, text, integer, text, text, integer, integer) from public;
grant execute on function public.submit_mission_command(text, text, text, integer, text, text, integer, integer) to authenticated;

revoke execute on function public.get_mission_participant_view(text) from public;
grant execute on function public.get_mission_participant_view(text) to authenticated;

-- 서버/관리자 전용: authenticated·anon 에서 revoke, service_role 만 호출 가능
revoke execute on function public.apply_server_review(text, integer, boolean) from public;
grant execute on function public.apply_server_review(text, integer, boolean) to service_role;

revoke execute on function public.get_mission_admin_view(text) from public;
grant execute on function public.get_mission_admin_view(text) to service_role;

-- ============================================================
-- 검사 조건 (대표 승인 후 클로드가 실행):
--  - 한쪽만 제출: status='collecting', ownSubmitted=true, waitingForPartner=true
--  - 양쪽 제출: status='awaiting_review', responses=2
--  - 같은 requestId 재전송(동일 digest): 멱등(상태·revision 불변)
--  - 같은 requestId + 다른 digest: REQUEST_ID_REUSED
--  - 오래된 revision: STALE_REVISION
--  - 비참여자/타인 ID 위조 시도: FORBIDDEN (p_user_id 없으므로 auth.uid() 로만)
--  - 일반 사용자의 apply_server_review 호출: FORBIDDEN
--  - 참여자의 get_mission_admin_view 호출: FORBIDDEN
--  - 참여자 조회 시 상대방 답변 미노출(responses 미반환)
--  - exit: status='closed', closed_by 기록, 자동 보상·삭제 없음
--  - 만료: deadline 지나면 DEADLINE_REACHED_POLICY_REQUIRED
-- ============================================================