-- STOP: 대표 승인 전 실행 금지
-- =============================================================================
-- profiles 보조 컬럼 잠금 초안 (2026-09-06)
--
-- 결론 요약(실제 스키마 확인):
--   - role 컬럼은 이미 pa_profiles_role_lock_update_trg + pa_profiles_role_lock() 로
--     일반 사용자(anon/authenticated)가 변경하지 못하게 보호됨 → 추가 강화 불필요.
--   - 다만 아래 2개 컬럼은 보호되지 않아, 방어심층(선택)으로 잠그는 초안다.
--
--     1) is_admin (boolean): 현재 is_admin() 함수는 role='admin' 만 보므로
--        is_admin 은 권한에 영향 없음(죽은 컬럼). 그러나 미래에 누군가 is_admin 을
--        참조하는 코드를 쓰면 오용될 수 있어 미리 잠근다.
--     2) verification_status (text): 일반 사용자가 자기 행을 'verified' 로 바꾸는
--        자기 인증을 막는다. 단, 실제 본인확인 흐름에서 사용자가 스스로 상태를
--        바꾸는 단계가 있다면 이 잠금이 흐름을 막을 수 있으니 적용 전 확인 필요.
--
-- 영향:
--   - 기존 role 보호(pa_profiles_role_lock)는 그대로 유지, 여기서는 추가만 한다.
--   - 일반 사용자의 is_admin / verification_status 변경만 차단(service_role 은 통과).
--
-- 되돌리기: 아래 "DROP" 문장 실행 시 원상 복구.
-- =============================================================================

create or replace function public.pa_profiles_column_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_role text;
begin
  v_claim_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');

  if v_claim_role in ('anon', 'authenticated') then
    if (new.is_admin is distinct from old.is_admin) then
      raise exception 'is_admin 변경은 허용되지 않습니다.' using errcode = '42501';
    end if;
    if (new.verification_status is distinct from old.verification_status) then
      raise exception 'verification_status 변경은 허용되지 않습니다.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pa_profiles_column_lock_update_trg on public.profiles;
create trigger pa_profiles_column_lock_update_trg
  before update of is_admin, verification_status on public.profiles
  for each row execute function public.pa_profiles_column_lock();

-- =============================================================================
-- 되돌리기
-- =============================================================================
-- drop trigger if exists pa_profiles_column_lock_update_trg on public.profiles;
-- drop function if exists public.pa_profiles_column_lock();