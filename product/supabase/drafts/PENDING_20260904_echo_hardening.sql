-- PENDING — 대표 승인 전 실행 금지 (STOP 게이트). 초안이며 실제 스키마 실측 후 열 이름을 맞춰야 한다.
-- 대상 프로젝트: zyyhhxyupizcqhxqnxuu (레디 보고값). 실행 전 Supabase 대시보드 > Table Editor 에서 아래 "확인 필요" 항목을 대조한다.
--
-- 확인 필요(실측 전 가정):
--   [A1] profiles 기본키가 id(uuid, auth.users.id 참조)인지 user_id인지     — 레디 코드 기준 id
--   [A2] profiles 에 email, display_name 열이 있는지                          — 레디 코드 기준 있음
--   [A3] conversations 에 status, current_step, request_token, request_action, created_at, updated_at 열이 있는지
--   [A4] messages / understanding_results / emotions 에 id(pk), conversation_id, user_id, created_at 이 있는지
--   [A5] 각 표에 RLS 가 켜져 있고 "본인 행만" 정책(select/insert/update/delete)이 있는지 — 서버 함수는 사용자 토큰으로 접근하므로 필수
--
-- 되돌리기: 각 구간 끝의 ROLLBACK 주석 참고. 데이터 삭제 없음. 기존 열·표 삭제 없음.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. 프로필 자동 생성 (인증 완료 뒤 DB 가 만든다 → 브라우저 직접 insert 제거)
--    Google 첫 로그인·이메일 가입 모두 동일 경로. 중복 생성 방지(on conflict do nothing).
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)                      -- [A1][A2]
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      '사용자'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- ROLLBACK 1: drop trigger if exists on_auth_user_created on auth.users; drop function if exists public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. profiles 행 단위 보안(RLS) — 본인만 읽기/수정, 생성은 트리거가 담당(브라우저 insert 불필요)
--    ※ 기존 정책 이름과 충돌하면 이름을 바꾼다. 관리자 권한 자동 부여 없음.
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);   -- [A1]
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- 트리거 적용 전 과도기용(프론트 ensureProfile 보조 장치). 트리거 적용 후에는 제거 가능.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
-- ROLLBACK 2: drop policy ... (위 3개)

-- ─────────────────────────────────────────────────────────────
-- 3. 거절 의미 구조화 저장 (SCENE 3) — 현재는 요청 시 계산, 열 추가 후 저장으로 전환
-- ─────────────────────────────────────────────────────────────
alter table public.understanding_results
  add column if not exists rejected_meaning jsonb;                            -- [A4]
comment on column public.understanding_results.rejected_meaning is
  '사용자가 거절한 해석의 핵심 의미 키 배열(정규화). 후속 질문 후보 차단의 1차 근거.';
-- ROLLBACK 3: alter table public.understanding_results drop column if exists rejected_meaning;

-- ─────────────────────────────────────────────────────────────
-- 4. 중복 요청·부분 저장 방지 보강
--    (a) conversations.request_token 은 사용자별로 유일해야 start 재전송 조회가 안전하다
--    (b) 보상 삭제(rollback)가 동작하려면 본인 행 delete 정책이 필요하다 — 서버 함수가 사용자 토큰으로 지운다
-- ─────────────────────────────────────────────────────────────
create unique index if not exists conversations_user_request_token_uidx
  on public.conversations (user_id, request_token)
  where request_token is not null;                                            -- [A3]

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages for delete using (auth.uid() = user_id);            -- [A4][A5]
drop policy if exists "understanding_results_delete_own" on public.understanding_results;
create policy "understanding_results_delete_own" on public.understanding_results for delete using (auth.uid() = user_id);
drop policy if exists "emotions_delete_own" on public.emotions;
create policy "emotions_delete_own" on public.emotions for delete using (auth.uid() = user_id);
drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own" on public.conversations for delete using (auth.uid() = user_id);
-- ROLLBACK 4: drop index if exists conversations_user_request_token_uidx; drop policy ... (위 4개)

-- ─────────────────────────────────────────────────────────────
-- 5. (다음 단계) 완전한 원자 저장을 위한 RPC 초안 — 현재 서버 함수는 보상 삭제 방식.
--    아래 함수 적용 후 index.ts 의 answer/choose 쓰기 구간을 rpc 호출 1회로 교체한다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.echo_commit_answer(
  p_conversation_id uuid,
  p_token text,
  p_user_step int,
  p_user_content text,
  p_ai_step int,
  p_ai_content text,
  p_next_status text,
  p_display_step int
) returns void
language plpgsql
security invoker                                                              -- RLS 그대로 적용(본인 행만)
set search_path = public
as $$
declare
  v_updated int;
begin
  insert into public.messages (conversation_id, user_id, role, step, content)
  values (p_conversation_id, auth.uid(), 'user', p_user_step, p_user_content);
  insert into public.messages (conversation_id, user_id, role, step, content)
  values (p_conversation_id, auth.uid(), 'ai', p_ai_step, p_ai_content);
  update public.conversations
     set status = p_next_status, current_step = p_display_step, request_action = 'answer', updated_at = now()
   where id = p_conversation_id and user_id = auth.uid() and request_token = p_token;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'INVALID_STATE';                                          -- 전체 롤백
  end if;
end;
$$;
-- ROLLBACK 5: drop function if exists public.echo_commit_answer(uuid, text, int, text, int, text, text, int);

commit;