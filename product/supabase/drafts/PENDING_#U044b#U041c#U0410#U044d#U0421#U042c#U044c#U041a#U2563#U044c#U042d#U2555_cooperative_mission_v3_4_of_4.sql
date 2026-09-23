-- [SQL v3 4/4 - INDEXES + TESTS + ROLLBACK]
-- STATUS: DRAFT. EXECUTION FORBIDDEN UNTIL REPRESENTATIVE APPROVAL.
-- - 인덱스: 실제 적용 대상.
-- - 시험: 격리된 로컬 Supabase 에서만 실행. 운영 DB 금지.
-- - 롤백: 역순으로 객체 제거 (대표 승인 시 역변경용).

begin;

-- ---------------------------------------------------------------------------
-- 1) 인덱스
-- ---------------------------------------------------------------------------
create index if not exists missions_participant_ids_gin
  on public.missions using gin (participant_ids);

create index if not exists missions_status_idx
  on public.missions (status);

create index if not exists missions_deadline_idx
  on public.missions (deadline)
  where status in ('collecting', 'awaiting_review');

-- ---------------------------------------------------------------------------
-- 2) 시험 (격리 환경 전용 · 운영 DB 절대 금지)
--    각 항목의 기대 결과를 주석으로 명시. 실패 시 원문 오류를 기록한다.
-- ---------------------------------------------------------------------------

-- 2-1) 정책 시드 (시험용)
-- insert into public.missions_policy (max_answer_length, max_requests_per_user, max_requests_total)
-- values (500, 20, 40);

-- 2-2) 제약 검사 (기대: 오류)
--   - stage '5' 삽입 → missions_stage_check 위반
--   - participant_ids 3명 → missions_participants_len 위반
--   - participant_ids NULL 포함 → missions_participants_not_null 위반
--   - participant_ids 동일 2명 → missions_participants_distinct 위반
--   - id 빈 문자열/129자 → missions_id_check 위반
--   - status 'open' → missions_status_check 위반

-- 2-3) 정상 생성 (service role 로 create_mission 호출)
-- select public.create_mission('m-test-1', '6', array[a_uuid, b_uuid]::uuid[], now() + interval '72 hours');

-- 2-4) 제출 (authenticated = 참여자 A)
-- select public.submit_cooperative_command('m-test-1', 'req-1', '안녕하세요', 0);
--   기대: status='collecting', ownSubmitted=true, waitingForPartner=true

-- 2-5) 멱등 재시도 (같은 requestId + 같은 명령)
-- select public.submit_cooperative_command('m-test-1', 'req-1', '안녕하세요', 1);
--   기대: 재저장 없이 현재 정제 상태 반환 (revision 그대로)

-- 2-6) requestId 충돌 (같은 requestId + 다른 명령)
-- select public.submit_cooperative_command('m-test-1', 'req-1', '다른 내용', 1);
--   기대: REQUEST_ID_CONFLICT (40900)

-- 2-7) 오래된 revision
-- select public.submit_cooperative_command('m-test-1', 'req-2', '새 내용', 0);
--   기대: STALE_REVISION (40900)

-- 2-8) 비참여자 접근 (authenticated = 제3자)
-- select public.submit_cooperative_command('m-test-1', 'req-3', '침입', 1);
--   기대: NOT_PARTICIPANT (42501)

-- 2-9) 두 번째 참여자 제출 → awaiting_review
-- select public.submit_cooperative_command('m-test-1', 'req-4', '반가워요', 1);
--   기대: status='awaiting_review'

-- 2-10) 완료/종료 후 재제출 거절
-- select public.apply_server_review('m-test-1', 'completed');
-- select public.submit_cooperative_command('m-test-1', 'req-5', '추가', 2);
--   기대: MISSION_NOT_COLLECTING

-- 2-11) 상대방 답변 비노출
-- select public.get_mission_refined('m-test-1');
--   기대: 반환 jsonb 에 opponent answer / participant_ids / commandHash 없음

-- 2-12) 일반 사용자의 서버 검토 함수 실행 거절
--   authenticated 로 public.apply_server_review 호출
--   기대: permission denied (42501)

-- 2-13) 기한 만료 (서버 now() 기준)
--   deadline 을 과거로 만든 뒤 select public.close_expired_missions();
--   기대: status='closed', close_reason='expired'

-- 2-14) 이탈 (참여자 본인)
-- select public.exit_mission('m-test-1');
--   기대: status='closed', close_reason='participant_exit',
--         남은 사용자 reward candidate 1회 생성

-- ---------------------------------------------------------------------------
-- 3) 롤백 (역변경 · 대표 승인 시 원복용)
-- ---------------------------------------------------------------------------
-- -- 함수 실행권 회수
-- revoke execute on function public.submit_cooperative_command(text, text, text, integer) from authenticated;
-- revoke execute on function public.get_mission_refined(text) from authenticated;
-- revoke execute on function public.exit_mission(text) from authenticated;
--
-- -- 함수 삭제 (역순)
-- drop function if exists public.apply_server_review(text, text);
-- drop function if exists public.close_expired_missions();
-- drop function if exists public.exit_mission(text);
-- drop function if exists public.create_mission(text, text, uuid[], timestamptz);
-- drop function if exists public.submit_cooperative_command(text, text, text, integer);
-- drop function if exists public.get_mission_refined(text);
--
-- -- 테이블 삭제 (역순)
-- drop table if exists public.mission_reward_candidates;
-- drop table if exists public.missions;
-- drop table if exists public.missions_policy;

-- [SQL v3 4/4 END - NOT TRUNCATED]
commit;