-- =====================================================================
-- V418 — A구조 자기이해 쓰기 함수 권한 회수 (service_role 전용)
-- 상태: 승인됨(대표 승인 범위). 플랫폼 SQL 도구가 REVOKE/GRANT 를 차단하여
--       Supabase SQL Editor 에서 수동 실행 필요.
--
-- 목적: 기존 서버 전용 쓰기 기준에 맞춰, doit_apply_* A 쓰기 함수의
--       PUBLIC·anon·authenticated 실행 권한을 회수하고 service_role 만 허용.
--
-- 배경 실측:
--   - 7개 시그니처 모두 SECURITY DEFINER + search_path='' + owner=postgres.
--   - 함수 본문에 이미 "role <> service_role 이면 auth.uid() = p_user_id 검증" 존재
--     (교차 사용자 쓰기 차단의 1차 방어).
--   - Edge Function(doit-understanding)은 getUser() 실검증 후 service_role 클라이언트로
--     admin.rpc() 호출 → 회수 후에도 정상 동작.
--   - RLS: doit_* 테이블은 SELECT only (INSERT/UPDATE/DELETE 정책 없음).
--
-- 이 파일은 데이터 보존 방식(기존 객체 유지)으로, 권한만 정리한다.
-- 테이블/컬럼/함수 정의를 변경하거나 삭제하지 않는다.
-- =====================================================================

begin;

REVOKE ALL ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_record_update(uuid, uuid, text, text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_insight_generate(uuid, uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_insight_self(uuid, uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_insight_transition(uuid, uuid, text, text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_handoff(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_record_update(uuid, uuid, text, text, uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_insight_generate(uuid, uuid, text, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_insight_self(uuid, uuid, text, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_insight_transition(uuid, uuid, text, text, uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_handoff(uuid, uuid, text, text, uuid) TO service_role;

commit;

-- =====================================================================
-- 검증 (실행 후 읽기 전용 확인)
-- =====================================================================
-- service_role 만 EXECUTE 를 가져야 한다 (PUBLIC/anon/authenticated 는 없어야 함):
-- select grantee, routine_name from information_schema.role_routine_grants
-- where routine_schema = 'public' and routine_name like 'doit_apply_%'
-- order by routine_name, grantee;