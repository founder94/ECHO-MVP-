-- PENDING(실행 금지 · 대표 승인 전 초안) — 「나를 기억하는 ECHO와 무엇이든 대화」 유료 권한 표(2026-10-06 대표 승인 C.8 · E.18)
-- 왜 새 표인가: 유료 권한(entitlement)은 결제·구독과 함께 생기고 끝나는 상태라 대화 기록(doit_request_events)과 섞지 않는다.
--   결제 연결(토스)은 심사 중이라 이 초안에 결제 쓰기 경로는 없다 — QA 는 환경값 FREE_TALK_TEST_USERS(시험용 권한 표시)로만 검사한다(실결제 0 · 가격 생성 0).
-- 권한: RLS 켬 · 본인 읽기만 · 쓰기는 service_role(서버) 만. 삭제 = 계정 삭제 연쇄(ON DELETE CASCADE).
-- 되돌리기: drop table public.doit_entitlements; (서버는 표가 없으면 권한 0 으로 동작 — 코드 변경 0)

create table if not exists public.doit_entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  feature     text not null check (feature in ('free_talk')),
  status      text not null check (status in ('active', 'ended', 'refunded')),
  source      text not null check (source in ('toss', 'manual', 'qa_test')),   -- 결제 · 운영자 수동 · QA 시험용
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,                                                     -- null = 끝 없음(구독 해지 전까지)
  order_ref   text,                                                            -- 결제 주문 참조(원문 카드정보 0)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists doit_entitlements_user_feature_idx on public.doit_entitlements (user_id, feature, status);

alter table public.doit_entitlements enable row level security;
revoke all on public.doit_entitlements from anon;
grant select on public.doit_entitlements to authenticated;
create policy doit_entitlements_self_read on public.doit_entitlements for select to authenticated using (auth.uid() = user_id);
-- 쓰기 정책 0(service_role 만 · 결제 확인 서버 함수에서) — 결제 서버 연결은 별도 승인.

-- 서버가 읽는 조건(doit-agent freeStatus): user_id = 본인 and feature = 'free_talk' and status = 'active' and (ends_at is null or ends_at > now())
-- 월 비용 상한(5,000원)·하루 상한(30회)·맛보기(3회)는 표가 아니라 서버가 자리 기록(doit_request_events agent_turn_claim · payload_hash 'free:trial:…'/'free:paid:…')으로 센다 → DB 변경 0.
