-- PENDING(실행 금지 · 대표 승인 전 초안) — 회사 한 달 AI 예산 30,000원 장부(2026-10-05 대표 승인 금액 · Codex echo-spec 20261005-approved-finance-security)
-- 왜 새 표인가: doit_request_events.user_id 는 auth.users(id) 외래키 + ON DELETE CASCADE(실제 QA catalog, Codex 5989921632) →
--   회사 장부를 어떤 사용자 줄에 얹으면 그 계정 삭제 때 장부·예약이 함께 지워진다. 사용자와 무관한 회사 전용 표가 필요하다.
-- 원자성: 예약·정산은 한 함수(한 트랜잭션) 안에서 그 달 줄을 FOR UPDATE 로 잠그고 「합계 확인 + 예약 줄 + 합계 갱신」을 함께 한다
--   (읽기→합산→쓰기를 일꾼 메모리에서 하지 않음 · 임대 만료·늦은 응답과 무관).
-- 권한: RLS 켬 · 정책 0 · 함수 실행은 service_role 만(서버 함수 doit-agent 가 부름). 브라우저 접근 0.
-- 금액 단위: 원(정수). 이번 호출 최대 금액(p_max_krw)은 서버가 「요청 토큰 상한 × 제공사 단가 × 고정 환율」로 계산해 넘긴다
--   — 단가·환율이 정책에 없으면 서버는 이 함수를 부르지 않고 유료 호출을 막는다(모르는 금액 = 0원 금지).
-- 되돌리기: 맨 아래 ROLLBACK 블록(함수 2개 · 표 2개 삭제). 사용자 데이터·기존 표 변경 0.

create table if not exists public.company_ai_budget_months (
  month_kst      date primary key,                       -- 한국시간 달의 첫날(예: 2026-10-01)
  budget_krw     integer not null check (budget_krw > 0),
  committed_krw  bigint  not null default 0 check (committed_krw >= 0), -- 정산된(확인된) 지출 + 결과 모름(최대 금액으로 확정)
  reserved_krw   bigint  not null default 0 check (reserved_krw >= 0),  -- 처리 중 예약 합계
  updated_at     timestamptz not null default now()
);

create table if not exists public.company_ai_reservations (
  request_key  text primary key,                          -- 서버가 만든 「동작:요청 id」 해시(사용자 원문·키 0)
  month_kst    date not null references public.company_ai_budget_months(month_kst),
  status       text not null check (status in ('reserved', 'settled', 'released', 'uncertain')),
  max_krw      integer not null check (max_krw > 0),
  actual_krw   integer check (actual_krw >= 0),
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);

alter table public.company_ai_budget_months enable row level security;
alter table public.company_ai_reservations enable row level security;
revoke all on public.company_ai_budget_months, public.company_ai_reservations from anon, authenticated;

-- 예약: 같은 request_key 는 한 번만(다시 부르면 처음 결과 그대로) · 합계 + 이번 최대 금액이 예산을 넘으면 거절
create or replace function public.company_ai_reserve(p_request_key text, p_max_krw integer, p_budget_krw integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  row_ public.company_ai_budget_months%rowtype;
  prev text;
begin
  if p_max_krw is null or p_max_krw <= 0 then return 'INVALID'; end if;
  insert into public.company_ai_budget_months(month_kst, budget_krw) values (m, p_budget_krw) on conflict (month_kst) do nothing;
  select * into row_ from public.company_ai_budget_months where month_kst = m for update;   -- 이 달 줄 잠금(같은 달 예약은 한 번에 하나)
  select status into prev from public.company_ai_reservations where request_key = p_request_key;
  if prev is not null then return 'DUPLICATE:' || prev; end if;
  if row_.committed_krw + row_.reserved_krw + p_max_krw > row_.budget_krw then return 'OVER_BUDGET'; end if;
  insert into public.company_ai_reservations(request_key, month_kst, status, max_krw) values (p_request_key, m, 'reserved', p_max_krw);
  update public.company_ai_budget_months set reserved_krw = reserved_krw + p_max_krw, updated_at = now() where month_kst = m;
  return 'RESERVED';
end $$;

-- 정산: 예약 상태일 때만 한 번. 실제 금액을 알면 그만큼만 확정하고 차액 반환 · 모르면 최대 금액 그대로 확정(uncertain)
create or replace function public.company_ai_settle(p_request_key text, p_actual_krw integer)
returns text language plpgsql security definer set search_path = public as $$
declare r public.company_ai_reservations%rowtype;
begin
  select * into r from public.company_ai_reservations where request_key = p_request_key;
  if r.request_key is null then return 'NOT_FOUND'; end if;
  perform 1 from public.company_ai_budget_months where month_kst = r.month_kst for update;
  select * into r from public.company_ai_reservations where request_key = p_request_key for update;
  if r.status <> 'reserved' then return 'ALREADY:' || r.status; end if;   -- 늦은 응답·두 번째 정산 = 변화 0
  update public.company_ai_reservations
     set status = case when p_actual_krw is null then 'uncertain' when p_actual_krw = 0 then 'released' else 'settled' end,
         actual_krw = p_actual_krw, settled_at = now()
   where request_key = p_request_key;
  update public.company_ai_budget_months
     set reserved_krw = reserved_krw - r.max_krw,
         committed_krw = committed_krw + coalesce(least(p_actual_krw, r.max_krw), r.max_krw),
         updated_at = now()
   where month_kst = r.month_kst;
  return 'SETTLED';
end $$;

revoke all on function public.company_ai_reserve(text, integer, integer), public.company_ai_settle(text, integer) from public, anon, authenticated;
grant execute on function public.company_ai_reserve(text, integer, integer), public.company_ai_settle(text, integer) to service_role;

-- 남은 일(이 초안 밖): ① 실제 금액이 최대 금액보다 크면(단가 변경 등) least() 로 잘리므로 차이는 관리 대조(reconciliation)에서 따로 기록
-- ② 이번 달 이미 쓴 금액(제공사 청구)을 첫 줄 committed_krw 로 넣는 절차 · ③ 50%/80% 알림은 별도(기록만, 발송 0).

-- ROLLBACK(되돌리기)
-- drop function if exists public.company_ai_settle(text, integer);
-- drop function if exists public.company_ai_reserve(text, integer, integer);
-- drop table if exists public.company_ai_reservations;
-- drop table if exists public.company_ai_budget_months;
