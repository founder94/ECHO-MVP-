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
