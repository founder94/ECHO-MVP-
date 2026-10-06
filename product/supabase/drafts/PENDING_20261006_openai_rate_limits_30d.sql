-- 2026-10-06 대표 승인 「사용기록 저장 승인 30일뒤 삭제」(14:14 KST).
-- AI 하루 사용 횟수 기록(openai_rate_limits)을 30일 지나면 지운다. 실행 전 초안(PENDING) — 운영 실행은 openai-chat 운영 배포와 함께, 대표 「운영 올리기 승인」 뒤에만.
-- 방법: 새 확장(pg_cron) 없이, 호출 제한 함수가 불릴 때마다 30일 지난 줄을 함께 지운다(표가 작아 비용 무시 · 같은 함수 이름·인자·권한 그대로).
-- 표 구조·권한 변경 0. 되돌리기 = 아래 ROLLBACK 블록(예전 함수 그대로).
begin;

create or replace function public.openai_rate_limit_allow(
  p_session_id text,
  p_ip text,
  p_day text,
  p_daily_limit integer,
  p_cooldown_ms integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.openai_rate_limits%rowtype;
  v_now timestamptz := now();
begin
  if p_session_id is null or length(p_session_id) < 8 then
    return false;
  end if;

  -- 30일 지난 기록 삭제(day = 'YYYY-MM-DD' UTC 문자열 → 같은 모양끼리 글자 비교로 날짜 순서가 맞다)
  delete from public.openai_rate_limits
   where day < to_char((v_now at time zone 'utc')::date - 30, 'YYYY-MM-DD');

  insert into public.openai_rate_limits (session_id, day, ip, call_count, last_call_at)
  values (p_session_id, p_day, p_ip, 0, null)
  on conflict (session_id, day) do nothing;

  select * into v_row from public.openai_rate_limits where session_id = p_session_id and day = p_day for update;

  if v_row.call_count >= p_daily_limit then
    return false;
  end if;
  if v_row.last_call_at is not null and v_now - v_row.last_call_at < make_interval(secs => p_cooldown_ms / 1000.0) then
    return false;
  end if;

  update public.openai_rate_limits
     set call_count = v_row.call_count + 1, last_call_at = v_now, ip = coalesce(p_ip, ip)
   where session_id = p_session_id and day = p_day;
  return true;
end;
$$;
revoke all on function public.openai_rate_limit_allow(text, text, text, integer, integer) from public, anon, authenticated;

commit;

-- ROLLBACK(예전 함수 그대로 — 30일 삭제 줄만 없음):
-- 위 함수에서 「delete from public.openai_rate_limits … ;」 두 줄을 뺀 같은 정의를 다시 실행한다.
