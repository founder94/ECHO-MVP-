-- doit_connect_v2_mutual (2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§19) — 후보 제안 · 상호선택 · 만남 결과 저장 표 2개.
-- 흐름: 서버가 후보를 준비(proposed) → 두 사람이 각자 고름 → 둘 다 「이어지고 싶어요」일 때만 mutual → doit_matches(approved) 로 연결을 연다.
-- 원칙
--  - 새 표만 더한다(기존 표·열·정책 변경 0). doit_matches 의 상태 값은 그대로 쓴다.
--  - 두 표 모두 RLS 켜고 정책 0개 + anon·authenticated 권한 회수 = 서버 함수(doit-connect, service role)만 읽고 쓴다.
--  - 한 쌍은 한 번만 제안한다(pair unique). 거절·숨김·차단된 쌍은 다시 제안하지 않는다.
--  - 결과(outcome)는 추천 개선용 기록일 뿐 사용자 사실(프로필·매칭 재료)로 올리지 않는다.
-- 적용 범위: QA(mutniujeiyujhkobadkd) 만. 운영 적용은 대표 GO 전 금지.
-- 되돌리기: supabase/rollback/20260928120000_doit_connect_v2_mutual_rollback.sql

create table if not exists public.doit_match_candidates (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  purpose_id text,
  common_a text[] not null default '{}',
  common_b text[] not null default '{}',
  a_choice text check (a_choice is null or a_choice in ('yes', 'no', 'hide')),
  b_choice text check (b_choice is null or b_choice in ('yes', 'no', 'hide')),
  status text not null default 'proposed' check (status in ('proposed', 'mutual', 'declined', 'withdrawn')),
  match_id uuid references public.doit_matches(id) on delete set null,
  source text not null default 'server' check (source in ('server', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doit_match_candidates_pair_order check (user_a < user_b)
);
create unique index if not exists doit_match_candidates_pair_key on public.doit_match_candidates (user_a, user_b);
create index if not exists doit_match_candidates_user_b_idx on public.doit_match_candidates (user_b);

create table if not exists public.doit_match_outcomes (
  match_id uuid not null references public.doit_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  talked text check (talked is null or talked in ('yes', 'no')),
  met text check (met is null or met in ('yes', 'planned', 'no')),
  again text check (again is null or again in ('yes', 'unsure', 'no')),
  helpful text check (helpful is null or helpful in ('yes', 'unsure', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.doit_match_candidates enable row level security;
alter table public.doit_match_outcomes enable row level security;
revoke all on table public.doit_match_candidates from anon, authenticated;
revoke all on table public.doit_match_outcomes from anon, authenticated;
grant all on table public.doit_match_candidates to service_role;
grant all on table public.doit_match_outcomes to service_role;
