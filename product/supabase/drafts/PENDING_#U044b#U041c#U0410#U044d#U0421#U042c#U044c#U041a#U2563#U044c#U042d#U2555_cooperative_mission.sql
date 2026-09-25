-- ============================================================
-- PENDING_대표승인 — 협동 미션(6·4·2) 서버 스키마 + 원자적 상태머신
-- 파일: supabase/drafts/PENDING_대표승인_cooperative_mission.sql
-- 상태: 초안. 대표 승인 전까지 실행 금지(DDL/DML/RLS STOP).
--
-- 설계 원칙:
--  1) 조회와 저장을 나눠 동시성을 "흉내" 내지 않는다.
--     단일 RPC 안에서 SELECT ... FOR UPDATE 로 행을 잠근 뒤 읽고 쓴다.
--  2) 사용자 "approved" 값이나 LLM 답변을 검토(리뷰) 결과로 직접 받지 않는다.
--     apply_server_review 의 approved 는 서버가 검증한 평가 결과에서만 도출한다.
--  3) 응답 제출/중복 요청/오래된 revision/만료/요청 한도를 서버에서 검사한다.
-- ============================================================

-- 1) 미션 테이블
create table if not exists public.missions (
  id text primary key,
  stage text not null check (stage in ('6','4','2')),
  participant_ids text[] not null,
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

-- 2) 원자적 커맨드 적용 RPC (참여자 전용: submit / exit)
--    p_request_digest 는 Edge Function(Deno crypto.subtle)에서 SHA-256으로 계산해 전달.
create or replace function public.submit_mission_command(
  p_mission_id text,
  p_user_id text,
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
as $$
declare
  m record;
  is_participant boolean;
  reused jsonb;
  existing_answer text := null;
  v_status text;
  v_revision integer;
  own_submitted boolean;
begin
  -- 입력 검증
  if p_action not in ('submit','exit') then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
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
  if m.id <> p_mission_id then
    raise exception 'MISSION_ID_MISMATCH' using errcode = '22023';
  end if;

  is_participant := p_user_id = any(m.participant_ids);
  if not is_participant then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 요청 중복 확인(같은 requestId + userId)
  select elem into reused
  from jsonb_array_elements(m.processed_requests) as elem
  where elem->>'requestId' = p_request_id and elem->>'userId' = p_user_id
  limit 1;

  if reused is not null then
    if reused->>'digest' <> p_request_digest then
      raise exception 'REQUEST_ID_REUSED' using errcode = '23505';
    end if;
    -- 멱등: 동일 요청 재전송 → 현재 상태 그대로 반환
    return jsonb_build_object(
      'missionId', m.id,
      'stage', m.stage,
      'revision', m.revision,
      'status', m.status,
      'ownSubmitted', exists(select 1 from jsonb_array_elements(m.responses) r where r->>'userId' = p_user_id),
      'waitingForPartner', m.status = 'collecting' and exists(select 1 from jsonb_array_elements(m.responses) r where r->>'userId' = p_user_id)
    );
  end if;

  -- 종료 처리
  if p_action = 'exit' then
    if m.status <> 'closed' then
      update public.missions
        set status = 'closed',
            closed_by = p_user_id,
            revision = revision + 1,
            updated_at = now()
        where id = m.id;
    end if;
    select status, revision into v_status, v_revision from public.missions where id = m.id;
    return jsonb_build_object(
      'missionId', m.id, 'stage', m.stage, 'revision', v_revision, 'status', v_status,
      'ownSubmitted', exists(select 1 from jsonb_array_elements(m.responses) r where r->>'userId' = p_user_id),
      'waitingForPartner', false
    );
  end if;

  -- 제출 처리
  if m.status = 'closed' or m.status = 'completed' then
    raise exception 'MISSION_NOT_ACTIVE' using errcode = '22023';
  end if;
  if p_expected_revision <> m.revision then
    raise exception 'STALE_REVISION' using errcode = '22023';
  end if;
  if m.deadline is not null and extract(epoch from now()) * 1000 >= m.deadline then
    raise exception 'DEADLINE_REACHED_POLICY_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_array_length(m.processed_requests) >= p_max_requests then
    raise exception 'REQUEST_LIMIT' using errcode = '22023';
  end if;

  -- 기존 응답 제거 후 새 응답 기록
  update public.missions
    set responses = (
          (select coalesce(jsonb_agg(r), '[]'::jsonb)
             from jsonb_array_elements(m.responses) r
             where r->>'userId' <> p_user_id)
        ) || jsonb_build_array(jsonb_build_object('userId', p_user_id, 'answer', btrim(p_answer))),
        processed_requests = m.processed_requests || jsonb_build_array(
          jsonb_build_object('requestId', p_request_id, 'userId', p_user_id, 'digest', p_request_digest)
        ),
        status = case when (
          (select count(*) from jsonb_array_elements(responses) r where r->>'userId' <> p_user_id) = 1
        ) then 'awaiting_review' else 'collecting' end,
        revision = revision + 1,
        updated_at = now()
    where id = m.id;

  select status, revision into v_status, v_revision from public.missions where id = m.id;
  own_submitted := exists(select 1 from jsonb_array_elements((select responses from public.missions where id = m.id)) r where r->>'userId' = p_user_id);

  return jsonb_build_object(
    'missionId', m.id, 'stage', m.stage, 'revision', v_revision, 'status', v_status,
    'ownSubmitted', own_submitted,
    'waitingForPartner', v_status = 'collecting' and own_submitted
  );
end;
$$;

-- 3) 서버 리뷰 RPC (관리자/서버 전용. 참여자에게 노출 금지)
--    p_approved 는 "서버가 검증한 평가 결과"에서만 도출한다.
--    (사용자가 보낸 boolean 이나 LLM 답변을 그대로 받지 않는다.)
create or replace function public.apply_server_review(
  p_mission_id text,
  p_expected_revision integer,
  p_approved boolean,
  p_actor_id text
) returns jsonb
language plpgsql
security definer
as $$
declare
  m record;
begin
  -- 실제 배포 시: p_actor_id 가 관리자/검증 서버인지 권한 확인 필요
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
  if m.deadline is not null and extract(epoch from now()) * 1000 >= m.deadline then
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

-- 4) RLS(참여자만 자신의 미션 조회/제출 가능. 리뷰는 서버 전용)
--    (초안: 최종 정책은 클로드가 Supabase 대시보드에서 적용)
-- alter table public.missions enable row level security;
-- create policy "participant read own missions" on public.missions
--   for select using (auth.uid() = any(participant_ids));
-- create policy "participant update via rpc" on public.missions
--   for update using (auth.uid() = any(participant_ids)) with check (auth.uid() = any(participant_ids));

-- ============================================================
-- 검사 조건 (대표 승인 후 클로드가 실행):
--  - 한쪽만 제출: status='collecting', ownSubmitted=true, waitingForPartner=true
--  - 양쪽 제출: status='awaiting_review', responses=2
--  - 같은 requestId 재전송(동일 digest): 멱등(상태 불변, revision 불변)
--  - 같은 requestId + 다른 digest: REQUEST_ID_REUSED 오류
--  - 오래된 revision: STALE_REVISION 오류
--  - 차단/비참여자: FORBIDDEN 오류
--  - 종료: exit 후 status='closed', closed_by 기록
--  - 만료: deadline 지나면 DEADLINE_REACHED_POLICY_REQUIRED
-- ============================================================