-- [SQL v3 1B/4 - SERVER POLICY TABLE + MISSIONS CREATE TABLE]
-- STATUS: DRAFT. EXECUTION FORBIDDEN UNTIL REPRESENTATIVE APPROVAL.
-- 기준: PENDING_대표승인_cooperative_mission_v3_1A_of_4.sql 의 preflight 가 요구하는
--       정확한 컬럼/기본키/CHECK 제약 정의를 그대로 만족하도록 작성한다.
-- 순서: 1A(측정) → 1B(이 파일) → 2(제출+조회) → 3(검토+기한+RLS) → 4(인덱스+시험+롤백)

begin;

-- ---------------------------------------------------------------------------
-- 1) 서버 전용 정책 테이블 (단일 행, service role 만 기록)
--    - 클라이언트는 최대 글자수·요청 제한을 절대 전달하지 않는다.
--    - 값이 없거나 잘못되면 제출 함수가 '실패 방식'으로 중단한다.
--    - 기본값은 아래 시드가 아니라 "정책 미확정"이므로,
--      대표 승인 전에는 service role 이 정확한 값을 넣어야 한다.
-- ---------------------------------------------------------------------------
create table if not exists public.missions_policy (
  id                     text        not null default 'default',
  max_answer_length      int         not null,
  max_requests_per_user  int         not null,
  max_requests_total     int         not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint missions_policy_pk primary key (id),
  constraint missions_policy_max_answer_check check (max_answer_length > 0),
  constraint missions_policy_per_user_check check (max_requests_per_user > 0),
  constraint missions_policy_total_check check (max_requests_total > 0)
);

-- ---------------------------------------------------------------------------
-- 2) 협동 미션 테이블
--    - 1A/4 가 검증하는 컬럼 11개와 자료형/제약을 정확히 맞춘다.
--    - id: text (공백 금지, 128자 이하)
--    - stage: '6' | '4' | '2' 만 허용 (6·4·2 대화공간, 정책 미확정)
--    - participant_ids: uuid[] 정확히 2명, NULL 금지, 중복 금지
--    - status: collecting | awaiting_review | completed | closed
--    - deadline: timestamptz (72시간 종료 판정은 서버 now() 기준)
-- ---------------------------------------------------------------------------
create table if not exists public.missions (
  id                 text         not null,
  stage              text         not null,
  participant_ids    uuid[]       not null,
  revision           int          not null default 0,
  status             text         not null default 'collecting',
  deadline           timestamptz,
  responses          jsonb        not null default '[]'::jsonb,
  processed_requests jsonb        not null default '[]'::jsonb,
  closed_by          uuid,
  close_reason       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint missions_pkey primary key (id),

  constraint missions_id_check
    check (btrim(id) <> '' and length(id) <= 128),

  constraint missions_stage_check
    check (stage in ('6', '4', '2')),

  constraint missions_revision_check
    check (revision >= 0),

  constraint missions_status_check
    check (status in ('collecting', 'awaiting_review', 'completed', 'closed')),

  constraint missions_participants_len
    check (cardinality(participant_ids) = 2),

  constraint missions_participants_not_null
    check (participant_ids[1] is not null and participant_ids[2] is not null),

  constraint missions_participants_distinct
    check (participant_ids[1] <> participant_ids[2])
);

-- ---------------------------------------------------------------------------
-- 3) 정책 시드 (선택 · "정책 미확정" — 대표 승인 전 값은 확정하지 않음)
--    아래 값은 구조 확인용 플레이스홀더다. 실제 값은 대표 승인 문서 기준으로
--    service role 이 재기록해야 한다. 절대 클라이언트로부터 받지 않는다.
-- ---------------------------------------------------------------------------
-- insert into public.missions_policy
--   (id, max_answer_length, max_requests_per_user, max_requests_total)
-- values
--   ('default', 500, 20, 40)
-- on conflict (id) do nothing;

-- [SQL v3 1B/4 END - NOT TRUNCATED]
commit;