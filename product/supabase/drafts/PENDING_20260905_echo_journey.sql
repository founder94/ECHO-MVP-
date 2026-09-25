-- ECHO 여정 확장(결제·STEP 3~7·리포트·보관함) DB 변경 — 2026-09-05
-- 대상 프로젝트: zyyhhxyupizcqhxqnxuu 단독. 비파괴: 표·열·데이터 삭제 없음. 되돌리기는 각 구간 ROLLBACK 주석.
-- 실행 주체: 대표(Supabase 대시보드 > SQL Editor) 또는 레디의 Supabase 마이그레이션 도구(있을 때).
--
-- 가정(실측 전 · 검증 필요):
--   [B1] conversations.id 는 uuid, conversations.status 는 text
--   [B2] auth.users(id) 참조 가능(기본)
--   [B3] conversations.status 에 CHECK 제약이 있다면 새 상태값을 허용하도록 교체(아래 3번). 없으면 3번은 새로 만든다(not valid: 기존 행 검사 생략).

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. payments — Toss 4,900원 단건결제 기록. 브라우저는 읽기만(본인 행). 쓰기는 서버 함수(echo-payment, 서비스 역할)만.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,                                            -- [B1]
  order_id text not null unique,
  amount integer not null,
  currency text not null default 'KRW',
  provider text not null default 'toss',
  status text not null default 'ready' check (status in ('ready', 'paid', 'failed')),
  payment_key text unique,
  method text,
  approved_at timestamptz,
  receipt_url text,
  fail_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_user_conversation_idx on public.payments (user_id, conversation_id);

alter table public.payments enable row level security;
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);
-- insert/update/delete 정책 없음 → 브라우저·사용자 토큰으로는 쓰기 불가(서비스 역할만)
-- ROLLBACK 1: drop table if exists public.payments;

-- ─────────────────────────────────────────────────────────────
-- 2. reports — 관계 리포트(서버 생성 JSON). 브라우저는 본인 행 읽기만. 쓰기는 서버 함수(echo-journey, 서비스 역할)만.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null unique,                                     -- 대화 1건당 리포트 1건(멱등)
  title text not null,
  summary text not null default '',
  content jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists reports_user_created_idx on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports for select using (auth.uid() = user_id);
-- ROLLBACK 2: drop table if exists public.reports;

-- ─────────────────────────────────────────────────────────────
-- 3. conversations.status 허용값 확장 — 기존 5개 + 결제 이후 7개
--    step1 · step2 · understanding · followup · white_door_ready
--    step3 · step4 · step5 · step6 · step7 · report_ready · report_done
-- ─────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.conversations'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.conversations drop constraint %I', r.conname);        -- [B3]
  end loop;
end $$;

alter table public.conversations
  add constraint conversations_status_allowed
  check (status in (
    'step1', 'step2', 'understanding', 'followup', 'white_door_ready',
    'step3', 'step4', 'step5', 'step6', 'step7', 'report_ready', 'report_done'
  )) not valid;                                                              -- 기존 행은 검사하지 않음(비파괴)
-- ROLLBACK 3: alter table public.conversations drop constraint if exists conversations_status_allowed;

commit;