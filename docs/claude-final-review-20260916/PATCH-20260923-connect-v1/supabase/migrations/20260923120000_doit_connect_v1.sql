-- doit_connect_v1 (2026-09-23) — 연결(대표 승인 → 첫 질문 동시 공개 → 이야기) 저장 표 3개.
-- 근거: 대표 2026-09-23 "지금 어디까지 구현을 해야 되는 단계까지는 승인하니까 허용하고 끝까지 진행시켜".
-- 원칙
--  - 새 표만 더한다(기존 표·열·정책 변경 0).
--  - 세 표 모두 RLS 켜고 정책 0개 + anon·authenticated 권한 회수 = 서버 함수(doit-connect, service role)만 읽고 쓴다.
--    화면은 서버 함수를 거쳐서만 보고, 상대 정보는 서로 첫 질문에 답한 뒤에만 서버가 내려 준다(blind-first).
--  - 한 쌍은 한 번만 만든다(승인·거절·종료 어느 쪽이든 같은 쌍을 다시 만들지 않는다).
-- 되돌리기: supabase/rollback/20260923120000_doit_connect_v1_rollback.sql

create table if not exists public.doit_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  purpose_id text,
  common text[] not null default '{}',
  first_question text check (first_question is null or char_length(first_question) between 1 and 200),
  status text not null check (status in ('approved', 'rejected', 'closed')),
  decided_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doit_matches_pair_order check (user_a < user_b)
);
create unique index if not exists doit_matches_pair_key on public.doit_matches (user_a, user_b);
create index if not exists doit_matches_user_b_idx on public.doit_matches (user_b);

create table if not exists public.doit_match_answers (
  match_id uuid not null references public.doit_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (char_length(answer) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table if not exists public.doit_match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.doit_matches(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists doit_match_messages_match_idx on public.doit_match_messages (match_id, created_at);

alter table public.doit_matches enable row level security;
alter table public.doit_match_answers enable row level security;
alter table public.doit_match_messages enable row level security;

revoke all on table public.doit_matches from anon, authenticated;
revoke all on table public.doit_match_answers from anon, authenticated;
revoke all on table public.doit_match_messages from anon, authenticated;
grant all on table public.doit_matches to service_role;
grant all on table public.doit_match_answers to service_role;
grant all on table public.doit_match_messages to service_role;
