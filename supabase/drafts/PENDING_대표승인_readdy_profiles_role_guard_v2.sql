-- ============================================================
-- PENDING · 대표 승인 전 실행 금지 · Readdy 실소스용 초안 v2 (2026-09-11)
-- profiles.role / is_admin 클라이언트 셀프 변경 차단 (권한 상승 방지)
-- ============================================================
-- [전제 · CONFIRM REQUIRED]
--   pg_policies 결과가 도착하기 전까지 "현재 RLS가 role 변경을 허용한다"는 것은 확정이 아니다.
--   그러나 두 AdminGuard 와 /admin/login 이 모두 profiles.role = 'admin' 을 신뢰하고,
--   Readdy 보고상 profiles 에 role(text, 기본 'user') 과 is_admin(boolean, 기본 false) 이 실재하므로,
--   본인 행 UPDATE 를 컬럼 제한 없이 허용하는 정책이 하나라도 있으면 아래 트리거가 필요하다.
--   verification_status / payment_status 등 다른 보호 컬럼은 information_schema 결과 확인 후 IF 절을 추가한다.
--   (존재하지 않는 컬럼을 NEW.컬럼 으로 참조하면 트리거 실행 시 오류가 나므로 확인 전 추가 금지)
--
-- [적용 원문]
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 브라우저(anon key → authenticated/anon)만 차단. service_role(서버 함수·SQL Editor)은 제한하지 않는다.
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role 컬럼은 클라이언트에서 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'is_admin 컬럼은 클라이언트에서 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- INSERT: 신규 행은 브라우저에서 만들 때 항상 비관리자 기본값으로 고정
-- (AuthContext.ensureProfile 의 upsert(ignoreDuplicates) 경로가 여기 해당)
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated', 'anon') THEN
    NEW.role := 'user';
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_insert ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_insert();

-- [영향]
--   - 일반 사용자: display_name·anon_session_id·purpose_* 등 다른 컬럼 수정은 그대로 가능.
--   - 관리자 지정: Supabase SQL Editor(service_role) 에서만 가능. 대표 계정 role 변경은 별도 승인 항목.
--   - 두 AdminGuard, /admin/login, is_echo_admin() 류 함수 동작 변화 없음(읽기만 한다).
--
-- [적용 후 검증 — 일반 사용자 토큰으로]
--   update profiles set role = 'admin' where id = auth.uid();       -- 기대: 42501
--   update profiles set is_admin = true where id = auth.uid();      -- 기대: 42501
--   update profiles set display_name = 'x' where id = auth.uid();   -- 기대: 성공
--
-- [복구 — 아래 4줄의 주석을 풀어 별도로 실행]
-- DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_columns ON public.profiles;
-- DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_insert ON public.profiles;
-- DROP FUNCTION IF EXISTS public.profiles_guard_privileged_columns();
-- DROP FUNCTION IF EXISTS public.profiles_guard_privileged_insert();
