-- =====================================================================
-- DO IT COMPANY — ECONOMY P1 · KEY LEDGER
-- SETUP (apply 실행 전 사전 설정 · 격리 환경 전용)
-- 기준일: 2026-09-13
--
-- 순서: setup → apply → verify → test (RUNBOOK.md 참조)
-- 멱등: 재실행해도 실패하지 않는다.
-- =====================================================================

-- 1) pgcrypto 를 extensions 스키마에 설치 (extensions.digest 사용)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2) 테스트 역할 생성 (멱등 — 이미 있으면 건너뜀)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end
$$;

-- postgres(superuser)는 set local role 가능. 명시 멤버십이 필요하면:
-- grant anon, authenticated, service_role to postgres;

-- 3) auth.uid() mock (RLS 정책이 auth.uid() 참조 → apply 실행 전에 필수)
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;