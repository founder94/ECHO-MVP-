-- A 구조(DO IT PLAN A · "당신이 잠든 사이에") → B 프로젝트(zyyhhxyupizcqhxqnxuu) 계정·DB 통합 — 2026-09-05
-- 대표 결정: "계정 하나로 통합". 비파괴: 기존 표·열·데이터 삭제 없음. A 옛 프로젝트(kelxwvbanfyxlalotcko) 데이터는 옮기지 않는다.
-- 실행 주체: 레디(B 프로젝트) SQL 도구 1회 실행. 되돌리기는 각 구간 ROLLBACK 주석.
--
-- 이름 충돌 처리: A 의 신고 표 `reports` 는 B 의 관계 리포트 `reports` 와 이름이 겹치므로 B 에서는 `user_reports` 로 만든다(A 코드도 같이 바꿈).
-- 가정(검증 필요): [C1] profiles 의 기본키는 id(uuid, auth.users.id 참조) [C2] auth.users 참조 가능

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. profiles 확장 — A 가 쓰는 열을 덧붙인다(기존 열 무변경)
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists grade text;
alter table public.profiles add column if not exists verification_status text not null default 'pending';
alter table public.profiles add column if not exists consent_version text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists anon_session_id text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
create index if not exists profiles_role_idx on public.profiles (role);
-- ROLLBACK 1: alter table public.profiles drop column if exists nickname, drop column if exists grade, ... (열 삭제는 대표 승인 후)

-- ─────────────────────────────────────────────────────────────
-- 2. 관리자 판정 함수 + role 자가 승격 차단(A 0001 이식)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.pa_profiles_role_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_role text;
begin
  v_claim_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  if tg_op = 'INSERT' then
    if v_claim_role in ('anon', 'authenticated') and new.role is distinct from 'user' then
      new.role := 'user';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.role is distinct from new.role and v_claim_role in ('anon', 'authenticated') then
    raise exception 'role 변경은 허용되지 않습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.pa_profiles_role_lock() from public;
drop trigger if exists pa_profiles_role_lock_insert_trg on public.profiles;
create trigger pa_profiles_role_lock_insert_trg before insert on public.profiles for each row execute function public.pa_profiles_role_lock();
drop trigger if exists pa_profiles_role_lock_update_trg on public.profiles;
create trigger pa_profiles_role_lock_update_trg before update of role on public.profiles for each row execute function public.pa_profiles_role_lock();
-- ROLLBACK 2: drop trigger ... 2개; drop function public.pa_profiles_role_lock(); drop function public.is_admin();

-- ─────────────────────────────────────────────────────────────
-- 3. 신규 가입 시 프로필 자동 생성(B 초안 + A nickname 통합) — 브라우저 insert 불필요
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    '사용자'
  );
  insert into public.profiles (id, email, display_name, nickname, role)
  values (new.id, new.email, v_name, v_name, 'user')
  on conflict (id) do update set nickname = coalesce(public.profiles.nickname, excluded.nickname);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- ROLLBACK 3: drop trigger if exists on_auth_user_created on auth.users; drop function if exists public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 4. profiles 행 단위 보안(RLS): 본인 읽기/수정 + 관리자 전체 읽기·수정
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
-- ROLLBACK 4: drop policy ... 3개

-- ─────────────────────────────────────────────────────────────
-- 5. A 표 5종 — purposes · spaces · user_reports · blocks · audit_logs
-- ─────────────────────────────────────────────────────────────
create table if not exists public.purposes (
  id text primary key,
  label text not null,
  icon text,
  description text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.purposes enable row level security;
drop policy if exists "purposes_select_all" on public.purposes;
create policy "purposes_select_all" on public.purposes for select using (true);
insert into public.purposes (id, label, icon, description, color, sort_order) values
  ('slow', '사람을 천천히 알아가기', 'ri-hearts-line', '서두르지 않고 서로의 이야기를 들어봐요', '#C4453C', 1),
  ('friend', '친구', 'ri-user-smile-line', '일상을 나누는 친구를 만나요', '#C9A24B', 2),
  ('hobby', '취미', 'ri-palette-line', '같은 취미를 즐기는 사람들과', '#A8B0B8', 3),
  ('workout', '운동', 'ri-run-line', '함께 운동하며 동기부여를', '#D9A7A0', 4),
  ('culture', '문화 활동', 'ri-film-line', '전시·공연·영화를 함께', '#8FA3B8', 5),
  ('local', '지역 활동', 'ri-map-pin-line', '가까운 곳에서 만나요', '#9BB09C', 6),
  ('create', '만들기', 'ri-tools-line', '함께 무언가를 만들어요', '#C9B8A8', 7)
on conflict (id) do nothing;

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  purpose_id text references public.purposes (id),
  name text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'closed', 'hidden')),
  is_locked boolean not null default false,
  max_members integer not null default 8,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.spaces enable row level security;
drop policy if exists "spaces_select_auth" on public.spaces;
create policy "spaces_select_auth" on public.spaces for select using (auth.role() = 'authenticated');
drop policy if exists "spaces_insert_own" on public.spaces;
create policy "spaces_insert_own" on public.spaces for insert with check (auth.uid() = owner_id);
drop policy if exists "spaces_update_own" on public.spaces;
create policy "spaces_update_own" on public.spaces for update using (auth.uid() = owner_id or public.is_admin()) with check (auth.uid() = owner_id or public.is_admin());

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete set null,
  reason text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.user_reports enable row level security;
drop policy if exists "user_reports_insert_own" on public.user_reports;
create policy "user_reports_insert_own" on public.user_reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "user_reports_select_own_or_admin" on public.user_reports;
create policy "user_reports_select_own_or_admin" on public.user_reports for select using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists "user_reports_update_admin" on public.user_reports;
create policy "user_reports_update_admin" on public.user_reports for update using (public.is_admin()) with check (public.is_admin());

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks_all_own" on public.blocks;
create policy "blocks_all_own" on public.blocks for all using (auth.uid() = blocker_id or public.is_admin()) with check (auth.uid() = blocker_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs for insert with check (auth.uid() = user_id);
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin" on public.audit_logs for select using (public.is_admin());
-- ROLLBACK 5: drop table if exists public.audit_logs, public.blocks, public.user_reports, public.spaces, public.purposes;

-- ─────────────────────────────────────────────────────────────
-- 6. 사주·타로 무료 콘텐츠 요청 횟수 제한(Rate Limit) — openai-chat 함수가 서비스 역할로만 호출
-- ─────────────────────────────────────────────────────────────
create table if not exists public.openai_rate_limits (
  session_id text not null,
  day text not null,
  ip text,
  call_count integer not null default 0,
  last_call_at timestamptz,
  primary key (session_id, day)
);
alter table public.openai_rate_limits enable row level security;
-- 정책 없음 → 브라우저(anon/authenticated)는 읽기·쓰기 불가. 서비스 역할만.

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
-- ROLLBACK 6: drop function if exists public.openai_rate_limit_allow(text, text, text, integer, integer); drop table if exists public.openai_rate_limits;

commit;

-- ─────────────────────────────────────────────────────────────
-- 7. 관리자 지정 (별도 실행 · 해당 계정이 B 프로젝트에 가입한 뒤에만 효과)
--    트리거는 anon/authenticated 의 role 변경만 막으므로 SQL 도구(서비스 권한)에서는 통과한다.
-- ─────────────────────────────────────────────────────────────
-- update public.profiles set role = 'admin' where email = 'ceo@do-it.company';