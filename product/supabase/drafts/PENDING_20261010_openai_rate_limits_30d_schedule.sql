-- 2026-10-10 실행 금지 초안(PENDING) — 대표 결정 필요: 새 확장(pg_cron) 켜기.
-- 왜: PENDING_20261006_openai_rate_limits_30d.sql 은 「호출 제한 함수가 불릴 때」만 30일 지난 기록을 지운다.
--      AI 호출이 멈추면 지우기도 멈춰, 마지막 기록이 30일 넘게 남을 수 있다(Codex PR #141 4500978).
-- 이 초안: 하루 한 번(한국 시간 새벽 4시 = UTC 19시) 호출과 상관없이 30일 지난 줄을 지운다.
-- 경계: 30일째 되는 날의 실행에서 지운다(`<=` · Codex PR #141 b198296 — `<` 면 하루 더 남아 최대 32일).
-- 확인(2026-10-10, 운영 확장 목록 읽기): pg_cron 은 설치 가능 목록에 있으나 아직 켜져 있지 않다 → 켜는 것 자체가 DB 변경 = 대표 승인.
-- 표 구조·권한 변경 0. 되돌리기 = 맨 아래 ROLLBACK.

create extension if not exists pg_cron;

select cron.schedule(
  'echo-openai-rate-limits-30d',
  '0 19 * * *',
  $$delete from public.openai_rate_limits
     where day <= to_char((now() at time zone 'utc')::date - 30, 'YYYY-MM-DD')$$
);

-- ROLLBACK:
-- select cron.unschedule('echo-openai-rate-limits-30d');
-- (pg_cron 을 다른 곳에서 쓰지 않으면) drop extension pg_cron;
