-- ECHO 관리자 대화보기 선행 보안 잠금
-- 기준일: 2026-09-16
-- 상태: 대표 승인(2026-09-16) / 운영 적용 대상
-- 목적: 일반 사용자 토큰으로 role/is_admin/grade/verification_status를 바꾸는 경로 차단

begin;

-- 테이블 전체 쓰기·삭제·DDL 보조 권한을 먼저 제거한다. SELECT와 기존 RLS는 유지한다.
revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;

-- 로그인 사용자는 자기 프로필의 일반 입력 열만 생성할 수 있다.
-- 행 소유권은 기존 profiles_insert_own RLS가 계속 검사한다.
grant insert (
  id,
  email,
  display_name,
  nickname,
  consent_version,
  bio,
  avatar_url,
  anon_session_id,
  purpose_id,
  purpose_label,
  region,
  life_rhythm,
  updated_at
) on table public.profiles to authenticated;

-- 로그인 사용자는 일반 프로필 열만 수정할 수 있다.
-- role, is_admin, grade, verification_status, id, created_at은 포함하지 않는다.
-- 행 소유권은 기존 profiles_update_own RLS가 계속 검사한다.
grant update (
  display_name,
  nickname,
  consent_version,
  bio,
  avatar_url,
  anon_session_id,
  purpose_id,
  purpose_label,
  region,
  life_rhythm,
  updated_at
) on table public.profiles to authenticated;

commit;

-- 적용 뒤 반드시 별도 트랜잭션에서 검사:
-- 1) 일반 사용자의 role/is_admin/grade/verification_status INSERT·UPDATE 실패
-- 2) 가입 프로필 생성, 목적 저장, 프로필 저장 성공
-- 3) 기존 ceo 관리자 role 유지
