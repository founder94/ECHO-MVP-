-- ============================================================================
-- PENDING · 회원탈퇴 분리 보존 구조 초안 (2026-09-24)
-- ----------------------------------------------------------------------------
-- 상태: 초안. 실행 금지. 운영·스테이징 어디에도 적용하지 않았다.
-- 실행 조건: ① 대표 실행 승인 ② [법무 검증 필요] 항목 확정(보관 기간·보관 근거)
--           ③ 스테이징에서 아래 "검사 계획" 통과. 셋 중 하나라도 없으면 실행하지 않는다.
-- 설계 문서: docs/claude-final-review-20260916/PATCH-20260924-withdrawal-design/
--            ECHO_회원탈퇴_구조설계_20260924.md (D·E·F·H 절)
--
-- 원칙
--  1. 삭제할 개인정보는 지금처럼 계정 삭제(auth.admin.deleteUser) + CASCADE 로 지운다.
--  2. 법적으로 필요한 것만 "계정과 끊긴" 별도 표에 옮긴다(FK 없음 → 계정 CASCADE 로 사라지지 않는다).
--  3. 옮기는 칸은 최소한만. 이메일·전화번호 원문, 답·이야기 원문, 사진은 옮기지 않는다.
--  4. 재가입 확인용 식별값은 원문이 아니라 HMAC(비밀 pepper) 값만, 제재가 확정된 계정만, 만료일 필수.
--  5. 보관 기간(retain_until)은 여기서 확정하지 않는다. NULL 로 두지 못하게 막고, 값은 법무 확정 뒤 서버가 넣는다.
--  6. 새 표는 RLS 켜고 정책 0개 + anon·authenticated 권한 회수 = 서버(service_role)만 접근.
--
-- 이 초안이 기존 초안과 충돌하는 곳
--  - supabase/drafts/PENDING_20260921_user_consents.sql 의 user_consents.user_id 는
--    "references auth.users (id) on delete cascade" 라 탈퇴 시 동의 기록이 같이 사라진다.
--    이 초안의 withdrawal_consent_evidence 가 그 공백을 메운다. 두 초안을 같이 실행할 때는
--    user_consents 를 탈퇴 직전 스냅샷의 원본으로 쓰고, FK 는 그대로 둔다(살아 있는 동안의 기록이므로).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) 동의 증빙 (문제 1: 동의 데이터 소실)
--    현재 동의 저장 위치: profiles.consent_version(CASCADE 삭제), auth.users.raw_user_meta_data
--    (doit_connect_consent_version/_at 등, 계정과 함께 삭제). 동의 "시각"은 profiles 에 칸이 없다.
-- ---------------------------------------------------------------------------
create table if not exists public.withdrawal_consent_evidence (
  id               uuid primary key default gen_random_uuid(),
  former_user_id   uuid not null,                  -- FK 없음(의도). 계정 삭제 뒤에도 남는다.
  consent_version  text,                           -- 약관·개인정보 동의 판(profiles.consent_version)
  consent_at       timestamptz,                    -- 알 수 있을 때만(현재 운영에는 칸 없음 → NULL 가능)
  connect_consent_version text,                    -- user_metadata.doit_connect_consent_version
  connect_consent_at      timestamptz,             -- user_metadata.doit_connect_consent_at
  withdrawn_at     timestamptz not null default now(),
  retain_until     timestamptz not null,           -- [법무 검증 필요] 기간 미확정 → 서버가 법무 확정값으로 채운다
  created_at       timestamptz not null default now()
);
create index if not exists withdrawal_consent_evidence_retain_idx
  on public.withdrawal_consent_evidence (retain_until);

-- ---------------------------------------------------------------------------
-- 2) 신고·제재 증빙 (문제 2: 신고 대상 소실 / 문제 5: 재가입 회피)
--    현재: user_reports.reporter_id = CASCADE(신고자가 탈퇴하면 신고 자체가 사라짐),
--          user_reports.target_user_id = SET NULL(신고 대상이 탈퇴하면 누구를 신고했는지 사라짐),
--          blocks = 양쪽 CASCADE.
-- ---------------------------------------------------------------------------

-- 2-a) 신고자 탈퇴 시 신고가 사라지지 않게: reporter_id CASCADE → SET NULL
alter table public.user_reports alter column reporter_id drop not null;
alter table public.user_reports drop constraint if exists user_reports_reporter_id_fkey;
alter table public.user_reports
  add constraint user_reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users (id) on delete set null;

-- 2-b) 대상 탈퇴 시에도 "어느 계정이었는지"를 계정과 끊긴 칸에 남긴다(탈퇴 직전 서버가 채움).
alter table public.user_reports add column if not exists target_former_user_id uuid;
alter table public.user_reports add column if not exists reporter_former_user_id uuid;

-- 2-c) 재가입 확인용 보류 목록 — 제재가 확정된 계정만. 원문 금지, HMAC 만.
create table if not exists public.withdrawal_identifier_holds (
  id               uuid primary key default gen_random_uuid(),
  identifier_kind  text not null check (identifier_kind in ('email', 'phone')),
  identifier_hmac  text not null,                  -- HMAC-SHA256(pepper, 정규화한 이메일/전화). 원문 저장 금지.
  pepper_version   text not null,                  -- pepper 교체 대비(교체 = Secret 변경 → STOP 게이트)
  reason           text not null check (reason in ('sanction_confirmed')),
  former_user_id   uuid not null,                  -- FK 없음(의도)
  report_ids       uuid[] not null default '{}',   -- 근거가 된 user_reports.id
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null            -- [법무 검증 필요] 기간 미확정. 무기한 금지(NOT NULL).
);
create unique index if not exists withdrawal_identifier_holds_uniq
  on public.withdrawal_identifier_holds (identifier_kind, identifier_hmac, pepper_version);
create index if not exists withdrawal_identifier_holds_expires_idx
  on public.withdrawal_identifier_holds (expires_at);

-- ---------------------------------------------------------------------------
-- 3) 결제 기록 (문제 3: 결제가 계정 CASCADE 에 묶임)
--    현재 payments.user_id = CASCADE. 앱 안 탈퇴(doit-account)는 결제 기록이 있으면 멈추지만,
--    관리자가 대시보드에서 계정을 지우면 결제 기록이 같이 사라진다. 운영 payments 0줄(2026-09-24).
-- ---------------------------------------------------------------------------
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
alter table public.payments add column if not exists former_user_id uuid;
alter table public.payments add column if not exists retain_until timestamptz;  -- [법무 검증 필요] 전자상거래법 5년 적용 범위

-- ---------------------------------------------------------------------------
-- 4) KEY 표 (문제 4: 탈퇴 뒤에도 남음)
--    현재 key_balances·key_ledger·key_request_events 는 user_id 에 FK 가 없다.
--    운영 9줄 = 한 test_only 사용자, source test_only_smoke(2026-09-13 서버 시험 기록). 앱이 쓰지 않는다.
--    KEY 가 결제·보상 성격이 되면 key_ledger 는 결제 기록처럼 보관 대상일 수 있다 → [법무 검증 필요].
--    여기서는 "지금 쓰지 않는 기능"이므로 탈퇴 시 서버가 명시적으로 지우는 쪽을 권장하고, FK 추가는 하지 않는다.
--    (FK 를 새로 걸면 주인이 없는 시험 줄 때문에 실패할 수 있고, 시험 줄 삭제는 운영 데이터 삭제 = STOP.)
-- ---------------------------------------------------------------------------
-- (DDL 없음. doit-account 서버 코드에서 key_* 삭제 단계를 추가하는 것으로 처리 — 설계 문서 E절.)

-- ---------------------------------------------------------------------------
-- 5) 새 표 잠금: RLS 켜고 정책 0개 + 권한 회수 = 서버 전용
-- ---------------------------------------------------------------------------
alter table public.withdrawal_consent_evidence enable row level security;
alter table public.withdrawal_identifier_holds enable row level security;
revoke all on public.withdrawal_consent_evidence from anon, authenticated;
revoke all on public.withdrawal_identifier_holds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) 만료 파기 — 보관 기간이 끝난 줄을 지운다(스케줄 등록은 별도 승인).
-- ---------------------------------------------------------------------------
create or replace function public.withdrawal_purge_expired()
returns table (consent_deleted bigint, holds_deleted bigint)
language plpgsql security definer set search_path = public as $$
declare c bigint; h bigint;
begin
  delete from public.withdrawal_consent_evidence where retain_until < now();
  get diagnostics c = row_count;
  delete from public.withdrawal_identifier_holds where expires_at < now();
  get diagnostics h = row_count;
  return query select c, h;
end $$;
revoke all on function public.withdrawal_purge_expired() from public, anon, authenticated;

commit;

-- ============================================================================
-- 되돌리기 (이 초안을 실행했을 때만. 실행 순서 그대로.)
-- 주의: 새 표를 지우면 그 안의 보관 증빙도 지워진다. 보관 기간 중이면 되돌리기 전에 법무 확인.
-- ----------------------------------------------------------------------------
-- begin;
-- drop function if exists public.withdrawal_purge_expired();
-- drop table if exists public.withdrawal_identifier_holds;
-- drop table if exists public.withdrawal_consent_evidence;
-- alter table public.payments drop column if exists retain_until;
-- alter table public.payments drop column if exists former_user_id;
-- alter table public.payments drop constraint if exists payments_user_id_fkey;
-- alter table public.payments add constraint payments_user_id_fkey
--   foreign key (user_id) references auth.users (id) on delete cascade;
-- -- user_id NOT NULL 복구는 NULL 줄이 없을 때만 가능:
-- -- alter table public.payments alter column user_id set not null;
-- alter table public.user_reports drop column if exists reporter_former_user_id;
-- alter table public.user_reports drop column if exists target_former_user_id;
-- alter table public.user_reports drop constraint if exists user_reports_reporter_id_fkey;
-- alter table public.user_reports add constraint user_reports_reporter_id_fkey
--   foreign key (reporter_id) references auth.users (id) on delete cascade;
-- -- alter table public.user_reports alter column reporter_id set not null;  -- NULL 줄이 없을 때만
-- commit;
-- ============================================================================
