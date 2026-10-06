-- REVIEW ONLY / SERVER_NOT_DEPLOYED / DO NOT RUN WITHOUT REPRESENTATIVE APPROVAL
-- Target observed read-only on 2026-09-14: Supabase project zyyhhxyupizcqhxqnxuu, public schema.
-- Purpose: stop browser-forged ECHO state writes and prevent unpaid/incomplete direct report SELECT.
-- This draft must be applied in the same approved maintenance window as all three matching Edge Functions.

begin;

-- Fail before changing anything when the reviewed schema is not present.
do $$
declare
  missing_columns text[];
begin
  select array_agg(required.name order by required.name)
    into missing_columns
  from (
    values
      ('conversations.id'), ('conversations.user_id'), ('conversations.status'),
      ('conversations.request_token'), ('conversations.request_action'),
      ('messages.user_id'), ('emotions.user_id'), ('understanding_results.user_id'),
      ('payments.user_id'), ('payments.conversation_id'), ('payments.status'),
      ('reports.user_id'), ('reports.conversation_id')
  ) as required(name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and required.name = c.table_name || '.' || c.column_name
  );

  if missing_columns is not null then
    raise exception 'ECHO preflight failed; missing columns: %', missing_columns;
  end if;

  if exists (
    select 1
    from public.conversations
    where request_token is not null
    group by user_id, request_token
    having count(*) > 1
  ) then
    raise exception 'ECHO preflight failed; duplicate (user_id, request_token) rows exist';
  end if;
end
$$;

-- Idempotency and entitlement lookups. Partial indexes keep the hot predicates small.
create unique index if not exists conversations_user_request_token_unique
  on public.conversations (user_id, request_token)
  where request_token is not null;

create index if not exists payments_paid_entitlement_lookup
  on public.payments (user_id, conversation_id)
  where status = 'paid';

-- Edge Functions now authenticate the caller, check ownership, then write with service_role.
-- The browser keeps authenticated SELECT but loses all mutation rights for ECHO state tables.
revoke all on table
  public.conversations,
  public.messages,
  public.emotions,
  public.understanding_results,
  public.payments,
  public.reports
from anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.conversations,
  public.messages,
  public.emotions,
  public.understanding_results,
  public.payments,
  public.reports
from authenticated;

drop policy if exists conversations_insert_own on public.conversations;
drop policy if exists conversations_update_own on public.conversations;
drop policy if exists messages_insert_own on public.messages;
drop policy if exists emotions_insert_own on public.emotions;
drop policy if exists emotions_update_own on public.emotions;
drop policy if exists understanding_results_insert_own on public.understanding_results;
drop policy if exists understanding_results_update_own on public.understanding_results;

-- A report body is selectable only by its owner, after valid STEP 7 completion, with a paid record.
drop policy if exists reports_select_own on public.reports;
drop policy if exists reports_select_paid_completed_own on public.reports;
create policy reports_select_paid_completed_own
on public.reports
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = reports.conversation_id
      and c.user_id = (select auth.uid())
      and c.status in ('report_ready', 'report_done')
  )
  and exists (
    select 1
    from public.payments p
    where p.conversation_id = reports.conversation_id
      and p.user_id = (select auth.uid())
      and p.status = 'paid'
  )
);

commit;

-- Post-apply checks (read-only; execute separately after the transaction):
-- 1) SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema='public' AND table_name IN
--    ('conversations','messages','emotions','understanding_results','payments','reports')
--    AND grantee IN ('anon','authenticated') ORDER BY table_name, grantee, privilege_type;
-- 2) SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies
--    WHERE schemaname='public' AND tablename IN
--    ('conversations','messages','emotions','understanding_results','payments','reports')
--    ORDER BY tablename, policyname;
-- 3) Run the isolated two-user entitlement matrix in APPLY_ROLLBACK_PLAN.md.
