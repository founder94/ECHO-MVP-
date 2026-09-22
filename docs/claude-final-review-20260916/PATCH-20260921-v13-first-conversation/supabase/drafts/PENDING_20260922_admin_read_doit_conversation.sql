-- ============================================================================
-- REVIEW ONLY / NOT EXECUTED / DO NOT RUN  (대표 승인 전 실행 금지)
-- 작성 2026-09-22 · 목적: 관리자 화면(/doit/admin/mobile → "AI 대화 기록")이
--   다른 사용자의 대화 기록도 읽을 수 있게 하는 "조회 전용" 정책을 추가한다.
--
-- 지금 상태 (2026-09-22 실제 확인):
--   doit_records        : RLS 켜짐, SELECT 정책 = doit_records_select_own (본인 줄만)
--   doit_insights       : RLS 켜짐, SELECT 정책 = doit_insights_select_own (본인 줄만)
--   doit_request_events : RLS 켜짐, SELECT 정책 0개 + authenticated 에게 SELECT 권한 자체 없음
--                         → 서버 함수(service_role) 전용. 화면에서는 아무도 못 읽는다.
--
-- 이 파일을 실행하면 달라지는 것:
--   role='admin' 인 계정만 세 표를 "읽기"만 할 수 있게 된다.
--   INSERT/UPDATE/DELETE 는 한 줄도 추가하지 않는다(관리자도 고치지 못한다).
--
-- 실행 전 대표가 알아야 할 것:
--   1) 관리자 계정은 이 순간부터 다른 사용자가 적은 답 원문을 볼 수 있게 된다.
--      개인정보 범위가 넓어지는 변경이다. 약관·개인정보 문서와 함께 검토해야 한다.
--   2) role='admin' 이 누구인지 먼저 확인해야 한다 (아래 0번 확인 질의).
--   3) 되돌리려면 맨 아래 "되돌리기" 부분을 실행한다.
-- ============================================================================

-- ── 0) 실행 전 확인: 관리자가 누구인가 (읽기만 한다) ─────────────────────────
-- select id, email, role from public.profiles where role = 'admin';

begin;

-- ── 1) doit_records : 관리자 조회 ────────────────────────────────────────────
-- 기존 doit_records_select_own 은 그대로 둔다(본인은 계속 본인 줄을 본다).
create policy doit_records_admin_select
  on public.doit_records
  for select
  to authenticated
  using (public.is_admin());

-- ── 2) doit_insights : 관리자 조회 ───────────────────────────────────────────
create policy doit_insights_admin_select
  on public.doit_insights
  for select
  to authenticated
  using (public.is_admin());

-- ── 3) doit_request_events : 관리자 조회 ─────────────────────────────────────
-- 이 표만 표 단위 권한(grant)부터 없다. 정책만 만들면 여전히 막힌다.
-- 조회 권한만 주고, 쓰기 권한은 주지 않는다.
grant select on public.doit_request_events to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.doit_request_events from authenticated;

create policy doit_request_events_admin_select
  on public.doit_request_events
  for select
  to authenticated
  using (public.is_admin());

commit;

-- ── 4) 실행 후 확인 (읽기만 한다) ────────────────────────────────────────────
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'public'
--    and tablename in ('doit_records','doit_insights','doit_request_events')
--  order by tablename, policyname;
--
-- 기대값: 표마다 _select_own(또는 없음) + _admin_select 가 함께 보인다.

-- ============================================================================
-- 되돌리기 (문제가 생기면 이것만 실행한다)
-- ----------------------------------------------------------------------------
-- begin;
--   drop policy if exists doit_records_admin_select on public.doit_records;
--   drop policy if exists doit_insights_admin_select on public.doit_insights;
--   drop policy if exists doit_request_events_admin_select on public.doit_request_events;
--   revoke select on public.doit_request_events from authenticated;
-- commit;
-- ============================================================================
