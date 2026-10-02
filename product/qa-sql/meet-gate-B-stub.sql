do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create table public.doit_matches (id uuid primary key default gen_random_uuid(), user_a uuid not null references auth.users(id), user_b uuid not null references auth.users(id),
  status text not null check (status in ('approved','rejected','closed')), created_at timestamptz not null default now());
create table public.blocks (id uuid primary key default gen_random_uuid(), blocker_id uuid not null references auth.users(id), blocked_user_id uuid not null references auth.users(id), reason text, created_at timestamptz default now(), unique (blocker_id, blocked_user_id));
create table public.user_reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id), target_user_id uuid references auth.users(id), reason text not null default 'x', status text not null default 'open');
insert into auth.users values ('10000000-0000-4000-8000-00000000000a'),('20000000-0000-4000-8000-00000000000b'),('30000000-0000-4000-8000-00000000000c');
