-- [SQL v3 3/4 - SERVER REVIEW + DEADLINE + REWARD CANDIDATE + RLS + GRANT/REVOKE]
-- STATUS: DRAFT. EXECUTION FORBIDDEN UNTIL REPRESENTATIVE APPROVAL.
-- - 서버 검토·미션 생성·보상 확정은 service role 만 실행 (authenticated/anon 제외).
-- - 72시간 종료는 프론트 타이머가 아니라 서버 deadline(now() 기준)으로 판정.
-- - 이탈/만료/검토실패/정상완료를 close_reason 으로 구분 저장.
-- - 보상 금액·포인트·등급은 "정책 미확정" → 후보 사건만 1회 기록, 금액 없음.

begin;

-- ---------------------------------------------------------------------------
-- 1) 보상 후보 테이블 (구조만. 금액·등급 없음. 동일 사건 중복 방지)
-- ---------------------------------------------------------------------------
create table if not exists public.mission_reward_candidates (
  id         uuid        not null default gen_random_uuid(),
  mission_id text        not null,
  user_id    uuid        not null,
  reason     text        not null,
  created_at timestamptz not null default now(),
  constraint mission_reward_candidates_pk primary key (id),
  constraint mission_reward_candidates_once unique (mission_id, user_id),
  constraint mission_reward_candidates_reason_check
    check (reason in ('participant_exit', 'expired', 'review_failed', 'completed'))
);

-- ---------------------------------------------------------------------------
-- 2) 미션 생성 (service role 전용)
-- ---------------------------------------------------------------------------
create or replace function public.create_mission(
  p_id              text,
  p_stage           text,
  p_participant_ids uuid[],
  p_deadline        timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
begin
  if p_participant_ids is null or cardinality(p_participant_ids) <> 2 then
    raise exception 'INVALID_PARTICIPANTS' using errcode = '22023';
  end if;
  if p_participant_ids[1] is null or p_participant_ids[2] is null
     or p_participant_ids[1] = p_participant_ids[2] then
    raise exception 'INVALID_PARTICIPANTS' using errcode = '22023';
  end if;

  insert into public.missions
    (id, stage, participant_ids, revision, status, deadline)
  values
    (p_id, p_stage, p_participant_ids, 0, 'collecting', p_deadline)
  returning * into v_mission;

  return jsonb_build_object(
    'missionId', v_mission.id,
    'stage', v_mission.stage,
    'revision', v_mission.revision,
    'status', v_mission.status,
    'deadline', v_mission.deadline
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) 참여자 이탈 (authenticated 참여자 본인만)
--    - 한 사람이 나가면 미션 closed, 남은 사용자 보상 후보 1회 생성.
-- ---------------------------------------------------------------------------
create or replace function public.exit_mission(
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
  v_remaining uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_uid <> all (v_mission.participant_ids) then
    raise exception 'NOT_PARTICIPANT' using errcode = '42501';
  end if;

  if v_mission.status in ('completed', 'closed') then
    raise exception 'MISSION_ALREADY_CLOSED' using errcode = 'P0001';
  end if;

  -- 남은 사용자 식별
  select pid into v_remaining
  from unnest(v_mission.participant_ids) as p(pid)
  where p.pid <> v_uid
  limit 1;

  v_mission.status := 'closed';
  v_mission.closed_by := v_uid;
  v_mission.close_reason := 'participant_exit';
  v_mission.updated_at := now();

  update public.missions set
    status       = v_mission.status,
    closed_by    = v_mission.closed_by,
    close_reason = v_mission.close_reason,
    updated_at   = v_mission.updated_at
  where id = v_mission.id;

  -- 남은 사용자 보상 후보 1회 (중복 방지 unique 제약)
  if v_remaining is not null then
    insert into public.mission_reward_candidates (mission_id, user_id, reason)
    values (v_mission.id, v_remaining, 'participant_exit')
    on conflict (mission_id, user_id) do nothing;
  end if;

  return jsonb_build_object(
    'missionId', v_mission.id,
    'status', v_mission.status,
    'closeReason', v_mission.close_reason
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) 72시간 만료 처리 (service role / 스케줄러 전용)
--    - 서버 now() 기준. 클라이언트 시간 신뢰 금지.
-- ---------------------------------------------------------------------------
create or replace function public.close_expired_missions()
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
begin
  for v_mission in
    select * from public.missions
    where status in ('collecting', 'awaiting_review')
      and deadline is not null
      and deadline < now()
    for update
  loop
    update public.missions set
      status       = 'closed',
      close_reason = 'expired',
      updated_at   = now()
    where id = v_mission.id;

    -- 만료 보상 후보: 정책 미확정이므로 기본 생성 안 함(대표 승인 문서 확정 후 반영).
    return next jsonb_build_object(
      'missionId', v_mission.id,
      'status', 'closed',
      'closeReason', 'expired'
    );
  end loop;

  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) 서버 검토 (service role 전용 · 클라이언트 approved 값 신뢰 금지)
--    - 검증 서버 역할만 실행. 일반 사용자/관리자 직접 실행 금지(아래 revoke).
--    - awaiting_review → completed 또는 closed(review_failed) 전환.
--    - 실제 통과 기준(LLM 결과 평가 규칙)은 "정책 미확정" → 여기서는 상태 전이만.
-- ---------------------------------------------------------------------------
create or replace function public.apply_server_review(
  p_mission_id text,
  p_verdict    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
begin
  if p_verdict not in ('completed', 'closed') then
    raise exception 'INVALID_VERDICT' using errcode = '22023';
  end if;

  select * into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_mission.status <> 'awaiting_review' then
    raise exception 'NOT_AWAITING_REVIEW' using errcode = 'P0001';
  end if;

  if p_verdict = 'completed' then
    v_mission.status := 'completed';
    v_mission.close_reason := 'completed';
  else
    v_mission.status := 'closed';
    v_mission.close_reason := 'review_failed';
  end if;

  v_mission.updated_at := now();

  update public.missions set
    status       = v_mission.status,
    close_reason = v_mission.close_reason,
    updated_at   = v_mission.updated_at
  where id = v_mission.id;

  return jsonb_build_object(
    'missionId', v_mission.id,
    'status', v_mission.status,
    'closeReason', v_mission.close_reason
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) RLS: 기본 거부. 일반 사용자는 base table 직접 접근 불가.
--    모든 읽기/쓰기는 SECURITY DEFINER 함수(소유자 권한)로만 통과.
-- ---------------------------------------------------------------------------
alter table public.missions enable row level security;
alter table public.missions_policy enable row level security;
alter table public.mission_reward_candidates enable row level security;

revoke all on public.missions from public, anon, authenticated;
revoke all on public.missions_policy from public, anon, authenticated;
revoke all on public.mission_reward_candidates from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) 함수 실행 권한: 과부하 서명별 REVOKE → 필요 role 만 GRANT
-- ---------------------------------------------------------------------------
-- 기본 실행권 회수 (PUBLIC/anon/authenticated 전부)
revoke execute on function public.submit_cooperative_command(text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.get_mission_refined(text) from public, anon, authenticated;
revoke execute on function public.create_mission(text, text, uuid[], timestamptz) from public, anon, authenticated;
revoke execute on function public.exit_mission(text) from public, anon, authenticated;
revoke execute on function public.close_expired_missions() from public, anon, authenticated;
revoke execute on function public.apply_server_review(text, text) from public, anon, authenticated;

-- authenticated: 안전한 제출·정제 조회·본인 이탈만 허용
grant execute on function public.submit_cooperative_command(text, text, text, integer) to authenticated;
grant execute on function public.get_mission_refined(text) to authenticated;
grant execute on function public.exit_mission(text) to authenticated;

-- service role: 미션 생성·만료 처리·서버 검토·보상 확정
-- (create_mission / close_expired_missions / apply_server_review 는
--  authenticated/anon 에 grant 하지 않는다 → service role 만 실행 가능)

-- [SQL v3 3/4 END - NOT TRUNCATED]
commit;