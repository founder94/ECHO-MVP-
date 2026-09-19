-- ============================================================
-- PENDING · 대표 승인 전 실행 금지
-- profiles.role / payment_status 셀프 변경 차단 (권한 상승 방지)
-- 작성: 2026-09-11 · PHASE 1 Auth 실측 중 발견
-- ============================================================
-- [문제]
--   현재 RLS "profiles_update_own"은 본인 행 UPDATE를 컬럼 제한 없이 허용한다.
--   따라서 브라우저 anon key만으로 아래가 통한다:
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', <내 id>)
--   관리자 화면 가드(profile.role === 'admin')와 is_echo_admin()이 모두 이 컬럼을 믿으므로
--   일반 사용자가 스스로 관리자가 될 수 있다. payment_status도 같은 경로로 'paid' 셀프 변경 가능.
--
-- [적용 원문]
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role(서버 함수·콘솔)은 제한하지 않는다. 브라우저(authenticated/anon)만 차단.
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role 컬럼은 클라이언트에서 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'payment_status 컬럼은 클라이언트에서 변경할 수 없습니다' USING ERRCODE = '42501';
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

-- INSERT 시에도 role/payment_status는 기본값만 허용 (신규 가입자가 처음부터 admin으로 들어오는 것 차단)
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated', 'anon') THEN
    NEW.role := 'user';
    NEW.payment_status := 'free';
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
--   - 일반 사용자: 이름·연령대·온보딩 답변 등 다른 컬럼 수정은 그대로 가능. role/payment_status만 변경 불가.
--   - 관리자 지정: 대표가 Supabase SQL Editor(service_role)에서 UPDATE 하거나 서버 함수로만 가능.
--   - 결제 상태 변경: Toss 승인 서버 함수(service_role)만 가능 → 이미 그 구조라면 영향 없음.
--   - Readdy 소스에 is_admin / verification_status 컬럼이 실재하면 같은 방식으로 IF 절을 추가해야 한다(소스 확인 후 보강).
--
-- [검증 SQL — 적용 후 일반 사용자 토큰으로]
--   update profiles set role = 'admin' where id = auth.uid();   -- 기대: 42501 오류
--   update profiles set name = '테스트' where id = auth.uid();  -- 기대: 성공
--
-- [복구 — 아래 4줄의 주석을 풀어 별도로 실행]
-- DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_columns ON public.profiles;
-- DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_insert ON public.profiles;
-- DROP FUNCTION IF EXISTS public.profiles_guard_privileged_columns();
-- DROP FUNCTION IF EXISTS public.profiles_guard_privileged_insert();
