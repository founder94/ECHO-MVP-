-- Run only after restoring the pre-change get-step-question and echo-journey functions.
-- This removes only the metadata column and lookup index added by the context-guard migration.

drop index if exists public.messages_journey_question_lookup_idx;

alter table public.messages
  drop constraint if exists messages_message_kind_check;

alter table public.messages
  drop column if exists message_kind;
