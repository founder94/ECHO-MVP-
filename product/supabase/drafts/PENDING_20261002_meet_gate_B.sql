-- PENDING · 실행 금지(대표 승인 묶음 B 전) · 2026-10-02 Claude 초안
-- 목적: 마지막 앱 내 영상 → 각자 모습 확인 → 각자 만남 의사 → 양쪽 모두 유효할 때만 약속.
-- 판정은 doit-connect/meetGate.ts(순수 함수)가 이 표들만 읽어 한다. 화면이 보낸 「참여함·확인함」은 기록하지 않는다.
-- 저장 원칙: 영상·음성 내용 저장 0(참여 사실·시각·카메라 켠 초만) · 사용자 직접 쓰기 0(서버 service_role 만) · 새 개인정보 칸 0.
-- 영상 확인은 신원·안전 보증이 아니다(배지·「확인된 사람」 0). 미디어 공급자·서명 비밀값은 별도 결정(이 초안은 공급자 이름을 정하지 않음).

begin;

-- ① 영상 세션: 공급자 서버 콜백(서명 검증 통과)으로만 만든다.
create table if not exists public.doit_video_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.doit_matches(id) on delete cascade,
  provider text not null check (length(provider) between 1 and 40),
  provider_session_ref text not null check (length(provider_session_ref) between 1 and 200),
  signature_verified boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_session_ref)
);
create index if not exists doit_video_sessions_match on public.doit_video_sessions (match_id, ended_at desc);

-- ② 참여 증거: 사람마다 한 줄(공급자 콜백 기준). 카메라를 켠 시간(초)만 — 화면·소리 0.
create table if not exists public.doit_video_participation (
  session_id uuid not null references public.doit_video_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null,
  left_at timestamptz,
  camera_on_seconds integer not null default 0 check (camera_on_seconds >= 0),
  primary key (session_id, user_id)
);

-- ③ 각자 모습 확인: 그 공동 세션에 묶인 본인 확인만(다른 방 영상으로 우회 0).
create table if not exists public.doit_meet_checks (
  session_id uuid not null references public.doit_video_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ④ 각자 만남 의사: 바꿀 수 있고(가장 최근 것만 유효) 이력은 남긴다. 상대의 「아니요·아직」은 상대에게 보여 주지 않는다(API 규칙).
create table if not exists public.doit_meet_intents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.doit_video_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null check (intent in ('yes', 'not_now', 'no')),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index if not exists doit_meet_intents_latest on public.doit_meet_intents (session_id, user_id, created_at desc);

alter table public.doit_video_sessions enable row level security;
alter table public.doit_video_participation enable row level security;
alter table public.doit_meet_checks enable row level security;
alter table public.doit_meet_intents enable row level security;
revoke all on table public.doit_video_sessions, public.doit_video_participation, public.doit_meet_checks, public.doit_meet_intents from anon, authenticated;
grant all on table public.doit_video_sessions, public.doit_video_participation, public.doit_meet_checks, public.doit_meet_intents to service_role;

commit;

-- 되돌리기(ROLLBACK_20261002_meet_gate_B.sql): 기능을 끄는 것은 API 를 막는 것이지 표 삭제가 아니다.
-- 표 삭제는 기록 보존 정책(§C) 결정 뒤에만. 이미 쌓인 참여·확인·의사 기록을 지우지 않는다.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- B-2 · PR #100 실행 경계에 맞춘 최소 추가(2026-10-02 · Claude 초안 · 실행 금지 · 위 표 4개와 같은 승인 묶음)
-- 근거: Codex product/docs/backend/MEET_API_STAGING_20261002.md 「기존 B에 반영할 최소 차이」 + 대표 지시 §5(약속·차단 동시 처리).
-- 로컬 Postgres 16 빈 DB(대용 auth.users·doit_matches·blocks·user_reports)에서만 문법·경합 검사 — QA·PROD 적용 0.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
begin;

-- ⑤ 영상 기록 고정 판·최종 근거(덮어쓰기 0). context_version = 방을 만들 때 서버 stateVersion(64 hex) — 만든 뒤 바꿀 수 없다.
alter table public.doit_video_sessions
  add column if not exists context_version text not null check (context_version ~ '^[a-f0-9]{64}$'),
  add column if not exists evidence_digest text check (evidence_digest is null or evidence_digest ~ '^[a-f0-9]{64}$'),
  add column if not exists finalized_at timestamptz;

create or replace function public.doit_video_sessions_frozen() returns trigger language plpgsql as $$
begin
  if new.context_version is distinct from old.context_version or new.match_id is distinct from old.match_id
     or new.provider is distinct from old.provider or new.provider_session_ref is distinct from old.provider_session_ref then
    raise exception 'VIDEO_SESSION_FROZEN' using errcode = 'P0001';
  end if;
  if old.finalized_at is not null and (new.evidence_digest is distinct from old.evidence_digest or new.finalized_at is distinct from old.finalized_at
     or new.ended_at is distinct from old.ended_at or new.signature_verified is distinct from old.signature_verified) then
    raise exception 'VIDEO_EVIDENCE_FINAL' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists doit_video_sessions_frozen on public.doit_video_sessions;
create trigger doit_video_sessions_frozen before update on public.doit_video_sessions for each row execute function public.doit_video_sessions_frozen();

-- ⑥ 최종 영상 근거 저장(공급자 서명 검증·최종 자료 조회는 함수 밖 서버 어댑터가 한다 — 이 함수 호출이 검증을 대신하지 않음).
--    서버가 먼저 만든 방(provider, ref)만 · 고정 판 일치 · 참가자는 그 연결의 두 사람만 · 참여 줄과 확정을 한 트랜잭션에서.
--    같은 근거 다시 = {saved:true, replayed:true} · 다른 근거 = VIDEO_EVIDENCE_CONFLICT.
create or replace function public.doit_finalize_video_evidence(evidence jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  s public.doit_video_sessions%rowtype;
  m record;
  parts jsonb;
  p jsonb;
  digest text;
begin
  select * into s from public.doit_video_sessions
   where provider = evidence->>'provider' and provider_session_ref = evidence->>'provider_session_ref' for update;
  if not found then raise exception 'VIDEO_SESSION_UNKNOWN' using errcode = 'P0001'; end if;
  if s.context_version <> evidence->>'context_version' then raise exception 'VIDEO_CONTEXT_MISMATCH' using errcode = 'P0001'; end if;
  select user_a, user_b into m from public.doit_matches where id = s.match_id;
  parts := coalesce((select jsonb_agg(x order by x->>'user_id') from jsonb_array_elements(evidence->'participants') x), '[]'::jsonb);
  if jsonb_array_length(parts) > 2 then raise exception 'VIDEO_EVIDENCE_INVALID' using errcode = 'P0001'; end if;
  for p in select * from jsonb_array_elements(parts) loop
    if (p->>'user_id')::uuid not in (m.user_a, m.user_b) then raise exception 'VIDEO_PARTICIPANT_INVALID' using errcode = 'P0001'; end if;
  end loop;
  digest := encode(sha256(convert_to(jsonb_build_object('ended_at', evidence->>'ended_at', 'participants', parts, 'context_version', s.context_version)::text, 'UTF8')), 'hex');
  if s.finalized_at is not null then
    if s.evidence_digest = digest then return jsonb_build_object('saved', true, 'replayed', true); end if;
    raise exception 'VIDEO_EVIDENCE_CONFLICT' using errcode = 'P0001';
  end if;
  insert into public.doit_video_participation (session_id, user_id, joined_at, left_at, camera_on_seconds)
  select s.id, (x->>'user_id')::uuid, (x->>'joined_at')::timestamptz, (x->>'left_at')::timestamptz, (x->>'camera_on_seconds')::int
    from jsonb_array_elements(parts) x;
  update public.doit_video_sessions
     set ended_at = (evidence->>'ended_at')::timestamptz, evidence_digest = digest, finalized_at = now(), signature_verified = true
   where id = s.id;
  return jsonb_build_object('saved', true, 'replayed', false);
end $$;
revoke all on function public.doit_finalize_video_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.doit_finalize_video_evidence(jsonb) to service_role;

-- ⑦ 약속(앱 안 약속 조율 시작) — 「둘 다 원함」의 결과 기록. 내용(시간·장소)은 저장하지 않는다(조율 범위 대표 결정 전 · 대화에서).
--    한 연결에 살아 있는 약속 1개 · 같은 요청 id 다시 = 같은 줄(새로 만들지 않음).
create table if not exists public.doit_meet_plans (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.doit_matches(id) on delete cascade,
  session_id uuid not null references public.doit_video_sessions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  cancel_reason text check (cancel_reason is null or cancel_reason in ('blocked', 'intent_changed', 'connection_closed')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (created_by, request_id)
);
create unique index if not exists doit_meet_plans_one_active on public.doit_meet_plans (match_id) where status = 'active';
alter table public.doit_meet_plans enable row level security;
revoke all on table public.doit_meet_plans from anon, authenticated;
grant all on table public.doit_meet_plans to service_role;

-- 동시 처리 규칙: 약속 만들기 · 차단 · 의사 바꾸기 · 연결 종료가 모두 같은 doit_matches 줄 잠금을 먼저 잡는다.
-- → 차단이 먼저 확정되면 약속은 만들어지지 않고, 약속이 먼저면 뒤이은 차단이 그 약속을 같은 트랜잭션에서 취소한다.
create or replace function public.doit_create_meet_plan(p_match_id uuid, p_session_id uuid, p_actor uuid, p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  m record;
  prior public.doit_meet_plans%rowtype;
  live uuid;
  ok boolean;
begin
  select id, user_a, user_b, status into m from public.doit_matches where id = p_match_id for update; -- ← 잠금(차단·의사·종료와 같은 줄)
  if not found or p_actor not in (m.user_a, m.user_b) then raise exception 'MEET_PLAN_NOT_FOUND' using errcode = 'P0001'; end if;
  ok := m.status = 'approved'
    and not exists (select 1 from public.blocks b where (b.blocker_id = m.user_a and b.blocked_user_id = m.user_b) or (b.blocker_id = m.user_b and b.blocked_user_id = m.user_a))
    and not exists (select 1 from public.user_reports r where r.reporter_id in (m.user_a, m.user_b) and r.target_user_id in (m.user_a, m.user_b)
                      and r.reporter_id <> r.target_user_id and r.status not in ('resolved', 'closed'))
    and exists (select 1 from public.doit_video_sessions v where v.id = p_session_id and v.match_id = m.id and v.finalized_at is not null and v.signature_verified)
    and (select count(*) from public.doit_meet_checks c where c.session_id = p_session_id and c.user_id in (m.user_a, m.user_b)) = 2
    -- 두 사람 각각의 「가장 최근 의사」가 yes. 의사가 없으면(null) 거짓으로 센다(bool_and 는 null 을 건너뛰므로 coalesce 필수 · 로컬 검사로 확인한 결함).
    -- 같은 시각에 다른 의사가 둘이면 순서를 정할 수 없으니 yes 로 보지 않는다(meetApi 의 MEET_INTENT_ORDER_UNRESOLVED 와 같은 원칙).
    and (select bool_and(coalesce(latest = 'yes', false)) from (
          select (select case when count(distinct i.intent) = 1 then max(i.intent) end
                    from public.doit_meet_intents i
                   where i.session_id = p_session_id and i.user_id = u
                     and i.created_at = (select max(j.created_at) from public.doit_meet_intents j where j.session_id = p_session_id and j.user_id = u)) as latest
            from unnest(array[m.user_a, m.user_b]) u) t);
  -- 같은 요청 다시: 그때 만든 줄을 돌려주되, 지금 허용(ok)은 따로 계산한 값 — 지난 성공이 지금 권한을 되살리지 않는다.
  select * into prior from public.doit_meet_plans where created_by = p_actor and request_id = p_request_id;
  if found then
    if prior.match_id <> p_match_id or prior.session_id <> p_session_id then raise exception 'REQUEST_CONFLICT' using errcode = 'P0001'; end if;
    return jsonb_build_object('plan_id', prior.id, 'status', prior.status, 'replayed', true, 'allowed_now', ok and prior.status = 'active');
  end if;
  if not ok then raise exception 'MEET_PLAN_UNAVAILABLE' using errcode = 'P0001'; end if;
  select id into live from public.doit_meet_plans where match_id = m.id and status = 'active';
  if found then return jsonb_build_object('plan_id', live, 'status', 'active', 'replayed', false, 'existing', true, 'allowed_now', true); end if;
  insert into public.doit_meet_plans (match_id, session_id, created_by, request_id) values (m.id, p_session_id, p_actor, p_request_id) returning id into live;
  return jsonb_build_object('plan_id', live, 'status', 'active', 'replayed', false, 'existing', false, 'allowed_now', true);
end $$;
revoke all on function public.doit_create_meet_plan(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.doit_create_meet_plan(uuid, uuid, uuid, uuid) to service_role;

-- 차단(기존 blocks 쓰기 경로 그대로 · 화면·서버 코드 변경 0)이 들어오면: 그 쌍의 연결 줄 잠금 → 살아 있는 약속 취소.
create or replace function public.doit_meet_plans_on_block() returns trigger language plpgsql as $$
begin
  perform 1 from public.doit_matches
    where (user_a = new.blocker_id and user_b = new.blocked_user_id) or (user_a = new.blocked_user_id and user_b = new.blocker_id) for update;
  update public.doit_meet_plans set status = 'cancelled', cancel_reason = 'blocked', cancelled_at = now()
   where status = 'active' and match_id in (select id from public.doit_matches
     where (user_a = new.blocker_id and user_b = new.blocked_user_id) or (user_a = new.blocked_user_id and user_b = new.blocker_id));
  return new;
end $$;
drop trigger if exists doit_meet_plans_on_block on public.blocks;
create trigger doit_meet_plans_on_block after insert on public.blocks for each row execute function public.doit_meet_plans_on_block();

-- 만남 의사를 「아직·아니요」로 바꾸면: 같은 잠금 → 살아 있는 약속 취소(상대에게는 「기다리는 중」만 · 이유 문구 0).
create or replace function public.doit_meet_plans_on_intent() returns trigger language plpgsql as $$
declare mid uuid;
begin
  select match_id into mid from public.doit_video_sessions where id = new.session_id;
  perform 1 from public.doit_matches where id = mid for update;
  if new.intent <> 'yes' then
    update public.doit_meet_plans set status = 'cancelled', cancel_reason = 'intent_changed', cancelled_at = now() where status = 'active' and match_id = mid;
  end if;
  return new;
end $$;
drop trigger if exists doit_meet_plans_on_intent on public.doit_meet_intents;
create trigger doit_meet_plans_on_intent after insert on public.doit_meet_intents for each row execute function public.doit_meet_plans_on_intent();

-- 연결 종료(기존 update doit_matches set status='closed' — 이미 그 줄 잠금): 살아 있는 약속 취소.
create or replace function public.doit_meet_plans_on_close() returns trigger language plpgsql as $$
begin
  if new.status <> 'approved' and old.status = 'approved' then
    update public.doit_meet_plans set status = 'cancelled', cancel_reason = 'connection_closed', cancelled_at = now() where status = 'active' and match_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists doit_meet_plans_on_close on public.doit_matches;
create trigger doit_meet_plans_on_close after update of status on public.doit_matches for each row execute function public.doit_meet_plans_on_close();

commit;
-- 남는 한계(정직하게): 연결 공개·영상 동의는 Auth 메타데이터라 이 잠금 밖이다 — 철회 직후 약속 요청은 서버(edge)가 먼저 다시 읽어 막고,
-- 이미 만든 약속은 다음 상태 읽기에서 허용 false 로 보인다(취소 기록은 동의 철회 서버 경로가 생길 때 추가). 이미 상대 기기에 간 정보는 회수하지 않는다.
