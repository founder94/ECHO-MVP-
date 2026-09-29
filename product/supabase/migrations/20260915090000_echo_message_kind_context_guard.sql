-- Distinguish summaries, controls and real journey questions.
-- Additive only: existing messages remain untouched and readable.

alter table public.messages
  add column if not exists message_kind text;

alter table public.messages
  drop constraint if exists messages_message_kind_check;

alter table public.messages
  add constraint messages_message_kind_check
  check (
    message_kind is null or message_kind in (
      'step_question',
      'step_answer',
      'understanding_summary',
      'understanding_choice',
      'followup_question',
      'followup_answer',
      'journey_question',
      'journey_answer'
    )
  ) not valid;

alter table public.messages
  validate constraint messages_message_kind_check;

create index if not exists messages_journey_question_lookup_idx
  on public.messages (conversation_id, step, created_at desc)
  where role = 'ai' and message_kind = 'journey_question';
