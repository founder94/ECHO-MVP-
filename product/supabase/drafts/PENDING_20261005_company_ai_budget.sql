-- PENDING(실행 금지 · 대표 승인 전 초안 v2) — 회사 한 달 AI 예산 장부(2026-10-05 대표 승인: 월 30,000원 · 50% 15,000원 점검 · 80% 24,000원 경고)
-- v2(2026-10-05 Codex 5990554765 반영): ① 달 줄 자동 생성·0원 시작 금지(검증된 기존 지출로 「열기」 전엔 예약 0) · 예산 상한 30,000원 고정
--   ② 실제 금액이 최대 예약보다 크면 원금 그대로 기록 + 그 달 새 예약 중지(대조 대상) ③ 영수증 = 사용자·동작·세션·내용·정책판 지문 + 시도 토큰,
--   중복은 새 호출 권한이 아님 · 정산은 같은 시도 토큰만 ④ 되돌리기 = 새 예약 중지·함수 권한 회수(장부·영수증 삭제 0) ⑤ 50%/80% = 상태 값만(발송 0).
-- v3(2026-10-05 Codex 5990816218 반영): ⑥ 시도 토큰 NULL·불일치는 IS NULL / IS DISTINCT FROM 으로 거절(NULL 비교로 정산 통과 0)
--   ⑦ 입력 계약: 요청 키·지문 = 소문자 sha256 64자리만, NULL·공백·다른 형식은 INVALID(쓰기 0) · 표에도 같은 형식 검사 ⑧ 회사 전체 AI 경로 후보 목록(맨 아래).
-- 왜 새 표인가: doit_request_events.user_id → auth.users ON DELETE CASCADE(실제 QA catalog, Codex 5989921632) — 계정 삭제가 회사 장부를 지우면 안 됨.
-- 원자성: 예약·정산·열기는 각각 한 함수(한 트랜잭션)에서 그 달 줄을 FOR UPDATE 로 잠근 뒤 확인과 쓰기를 함께 한다.
-- 권한: RLS 켬 · 정책 0 · 실행 권한 service_role 만. 적용 담당·적용 승인·이번 달 기존 지출 근거 = 대표 결정 대기.

create table if not exists public.company_ai_budget_months (
  month_kst        date primary key,                          -- 한국시간 달의 첫날
  budget_krw       integer not null check (budget_krw > 0 and budget_krw <= 30000), -- 대표 승인 상한(올리려면 이 줄과 승인 기록을 함께 바꿈)
  opening_krw      bigint  not null check (opening_krw >= 0), -- 「열기」 때 확인된 이번 달 기존 지출(제공사 청구·다른 AI 경로 합)
  opening_evidence text    not null check (length(btrim(opening_evidence)) > 0), -- 근거 위치(원문·키 0)
  committed_krw    bigint  not null default 0 check (committed_krw >= 0),   -- 정산된 지출 + 결과 모름(최대 금액)
  reserved_krw     bigint  not null default 0 check (reserved_krw >= 0),    -- 처리 중 예약 합
  paused           boolean not null default false,            -- 초과·대조 필요·되돌리기 때 새 예약 중지
  pause_reason     text,
  opened_at        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.company_ai_reservations (
  request_key  text primary key check (request_key ~ '^[0-9a-f]{64}$'),      -- 서버 계산: sha256(user_id ':' action ':' request_id) — 사용자마다 따로(다른 사용자의 같은 요청 id 와 충돌 0)
  fingerprint  text not null check (fingerprint ~ '^[0-9a-f]{64}$'),         -- sha256(action ':' session ':' 내용 ':' 정책판) — 같은 키에 다른 내용 = 거절
  attempt      uuid not null,         -- 이번 예약을 만든 시도 토큰(정산은 같은 토큰만)
  month_kst    date not null references public.company_ai_budget_months(month_kst),
  status       text not null check (status in ('reserved', 'settled', 'released', 'uncertain', 'overrun')),
  max_krw      integer not null check (max_krw > 0),
  actual_krw   integer check (actual_krw >= 0),
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);

alter table public.company_ai_budget_months enable row level security;
alter table public.company_ai_reservations enable row level security;
revoke all on public.company_ai_budget_months, public.company_ai_reservations from anon, authenticated;

-- 열기(사람 승인 절차로 한 달에 한 번): 확인된 기존 지출과 근거가 있어야 그 달 예약이 가능. 이미 열린 달은 바꾸지 않음(낮추기 0).
create or replace function public.company_ai_open_month(p_month date, p_budget_krw integer, p_opening_krw bigint, p_evidence text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_month is null or p_budget_krw is null or p_opening_krw is null or p_evidence is null or btrim(p_evidence) = '' then return 'INVALID'; end if;
  if p_budget_krw <= 0 or p_budget_krw > 30000 or p_opening_krw < 0 then return 'INVALID'; end if;
  if p_month <> date_trunc('month', p_month)::date then return 'INVALID_MONTH'; end if;
  insert into public.company_ai_budget_months(month_kst, budget_krw, opening_krw, opening_evidence, committed_krw)
  values (p_month, p_budget_krw, p_opening_krw, p_evidence, p_opening_krw)
  on conflict (month_kst) do nothing;
  if not found then return 'ALREADY_OPEN'; end if;
  return 'OPENED';
end $$;

-- 예약: 열린 달 · 중지 아님 · (확정+예약+이번 최대) ≤ 예산일 때만. 반환 RESERVED:<점검 단계>. 중복은 DUPLICATE(호출 권한 아님 — 서버는 업체를 부르지 않는다).
create or replace function public.company_ai_reserve(p_request_key text, p_fingerprint text, p_attempt uuid, p_max_krw integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  row_ public.company_ai_budget_months%rowtype;
  prev public.company_ai_reservations%rowtype;
  used bigint;
begin
  if p_request_key is null or p_request_key !~ '^[0-9a-f]{64}$' then return 'INVALID'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then return 'INVALID'; end if;
  if p_attempt is null or p_max_krw is null or p_max_krw <= 0 then return 'INVALID'; end if;
  select * into row_ from public.company_ai_budget_months where month_kst = m for update;
  if row_.month_kst is null then return 'NOT_OPEN'; end if;                 -- 기존 지출 확인 전 = 예약 0(0원 시작 금지)
  if row_.paused then return 'PAUSED'; end if;
  select * into prev from public.company_ai_reservations where request_key = p_request_key;
  if prev.request_key is not null then
    if prev.fingerprint is distinct from p_fingerprint then return 'CONFLICT'; end if;
    return 'DUPLICATE:' || prev.status;                                    -- 새 호출 권한 아님
  end if;
  used := row_.committed_krw + row_.reserved_krw + p_max_krw;
  if used > row_.budget_krw then return 'OVER_BUDGET'; end if;
  insert into public.company_ai_reservations(request_key, fingerprint, attempt, month_kst, status, max_krw)
  values (p_request_key, p_fingerprint, p_attempt, m, 'reserved', p_max_krw);
  update public.company_ai_budget_months set reserved_krw = reserved_krw + p_max_krw, updated_at = now() where month_kst = m;
  return 'RESERVED:' || case when used * 100 >= row_.budget_krw * 80 then 'WARN80' when used * 100 >= row_.budget_krw * 50 then 'CHECK50' else 'OK' end;
end $$;

-- 정산: 같은 시도 토큰 · 예약 상태일 때 한 번. 금액을 알면 원금 그대로 확정(최대보다 크면 overrun + 그 달 새 예약 중지) · 모르면 최대 금액으로 확정(uncertain).
create or replace function public.company_ai_settle(p_request_key text, p_attempt uuid, p_actual_krw integer)
returns text language plpgsql security definer set search_path = public as $$
declare r public.company_ai_reservations%rowtype; cost bigint; st text;
begin
  if p_request_key is null or p_request_key !~ '^[0-9a-f]{64}$' then return 'INVALID'; end if;
  if p_attempt is null then return 'INVALID'; end if;                       -- 토큰 없는 정산 = 거절(NULL 비교 우회 0)
  if p_actual_krw is not null and p_actual_krw < 0 then return 'INVALID'; end if;
  select * into r from public.company_ai_reservations where request_key = p_request_key;
  if r.request_key is null then return 'NOT_FOUND'; end if;
  perform 1 from public.company_ai_budget_months where month_kst = r.month_kst for update;
  select * into r from public.company_ai_reservations where request_key = p_request_key for update;
  if r.attempt is distinct from p_attempt then return 'NOT_OWNER'; end if;               -- 늦은·다른 시도는 정산 못 함
  if r.status <> 'reserved' then return 'ALREADY:' || r.status; end if;    -- 두 번째 정산 = 변화 0
  cost := coalesce(p_actual_krw, r.max_krw);
  st := case when p_actual_krw is null then 'uncertain' when p_actual_krw > r.max_krw then 'overrun' when p_actual_krw = 0 then 'released' else 'settled' end;
  update public.company_ai_reservations set status = st, actual_krw = p_actual_krw, settled_at = now() where request_key = p_request_key;
  update public.company_ai_budget_months
     set reserved_krw = reserved_krw - r.max_krw, committed_krw = committed_krw + cost,
         paused = paused or st = 'overrun', pause_reason = case when st = 'overrun' then coalesce(pause_reason, 'overrun ' || p_request_key) else pause_reason end,
         updated_at = now()
   where month_kst = r.month_kst;
  return upper(st);
end $$;

revoke all on function public.company_ai_open_month(date, integer, bigint, text), public.company_ai_reserve(text, text, uuid, integer), public.company_ai_settle(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.company_ai_reserve(text, text, uuid, integer), public.company_ai_settle(text, uuid, integer) to service_role;
-- company_ai_open_month 는 사람 승인 절차(관리자 SQL 실행)로만 — service_role 에도 주지 않음.

-- 남은 일(이 초안 밖): 서버가 p_max_krw 를 「요청 토큰 상한 × 단가 × 고정 환율 · 수수료/세금」으로 계산(정책에 단가 없으면 예약 0 · 호출 0),
--   다른 AI 경로(재시도·제공사 전환 포함 전부)를 같은 예약으로 묶기, 제공사 청구와의 월 대조 절차, 50%/80% 알림 발송(지금은 상태 값만).

-- 되돌리기(장부·영수증 삭제 0 · 0원 초기화 0):
-- update public.company_ai_budget_months set paused = true, pause_reason = 'rollback' where month_kst = date_trunc('month', now() at time zone 'Asia/Seoul')::date;
-- revoke execute on function public.company_ai_reserve(text, text, uuid, integer) from service_role;   -- 새 예약 중지(서버는 예약 실패 = 유료 호출 0)
-- 정산 함수 권한은 남겨 진행 중 예약을 마무리(또는 uncertain 로 확정)한다. 서버 코드는 이전 판으로 되돌린다.

-- ─────────────────────────────────────────────────────────────
-- 회사 전체 AI 경로 후보(2026-10-05 읽기 전용 조사 · 이 장부에 연결된 곳 0)
-- 근거: 소스의 업체 주소 검색 + Supabase 함수 목록(list_edge_functions, 메타데이터만 · 호출·키 조회 0).
-- 「배포됨」은 함수가 ACTIVE 라는 뜻일 뿐, 배포본이 이 소스와 같다는 증명이 아니다. 실제 과금 여부는 키 설정·호출 기록으로 따로 확인해야 한다(확인 불가).
-- | 소스                                              | 업체                       | QA          | PROD         | 비고 |
-- | product doit-agent/providers.ts                   | OpenAI·Anthropic·Google    | v103 ACTIVE | v17 ACTIVE   | 사용자별 하루 상한·claim(이 PR) |
-- | product doit-understanding/index.ts               | OpenAI                     | v47 ACTIVE  | v29 ACTIVE   | |
-- | product doit-connect/index.ts                     | OpenAI                     | v70 ACTIVE  | v9 ACTIVE    | QA 에 doit-connect-cto-qa v14 도 있음 |
-- | product doit-photo-check/index.ts                 | OpenAI                     | 없음        | v3 ACTIVE    | |
-- | product echo-journey/index.ts                     | OpenAI                     | 없음        | v28 ACTIVE   | |
-- | product get-step-question/ai.ts                   | OpenAI                     | 없음        | v50 ACTIVE   | PROD 묶음 진입은 get-step-question/index.ts |
-- | product openai-chat/index.ts                      | OpenAI                     | 없음        | v5 ACTIVE    | **verify_jwt false · 로그인 검사 없음 · Origin 없는 요청 허용 ·
-- |                                                   |                            |             |              |   하루 15회 상한이 클라이언트가 고르는 익명 세션 id 기준(PROD DB 함수 정의 확인: IP 는 저장만, 제한 0)**
-- |                                                   |                            |             |              |   → 세션 id 를 바꾸면 상한이 새로 시작. 회사 월 상한의 가장 큰 구멍(대표 결정 필요) |
-- | root legacy supabase/functions/echo-ai-analysis   | OpenAI                     | 없음        | 없음         | 배포 목록에 없음(옛 코드) |
-- | root legacy supabase/functions/get-step-question  | OpenAI                     | —           | (위와 같은 이름) | 어느 소스가 PROD v50 인지는 확인 불가 |
-- 원칙: 폐기된 B구조·옛 기능을 다시 켜거나 새 모델·전송 경로를 만들지 않는다. 지금 실제로 켜져 있는 경로만 위 예약/정산에 묶는다(재시도·업체 전환 포함).

