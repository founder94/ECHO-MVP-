# CTO Backend — 승인 대상 및 최소 DB 계약

기준: 이 대화의 FINAL IMPLEMENTATION MASTER. QA `mutniujeiyujhkobadkd`; PROD 적용 금지.
아래 SQL은 **검토용 diff이며 실행하지 않았다**. 실제 migration 파일도 만들지 않았다. 정책·법적 보존기간·가격은 결정하지 않았다.

## A. 원자적 Mutual / Room / message 안전

현재: 후보와 연결은 별도 REST 트랜잭션이다. 코드의 조건부 UPDATE·유일 키·재시도 복구로 중복 연결과 불완전 parent 노출을 방어하지만, block/message/expiry/finalization 전체를 한 트랜잭션으로 보장하지 못한다.

필요 diff:

```sql
CREATE TABLE public.echo_first_rooms (
  connection_id uuid PRIMARY KEY REFERENCES public.doit_matches(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  first_action_at timestamptz,
  status text NOT NULL CHECK (status IN ('open','active','expired','closed')),
  closed_reason text,
  extension_state jsonb,
  CHECK (expires_at > opened_at)
);
CREATE INDEX echo_first_rooms_expiry_idx ON public.echo_first_rooms(expires_at)
  WHERE status = 'open';
ALTER TABLE public.echo_first_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.echo_first_rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.echo_first_rooms TO service_role;
```

이 표만 생성해도 기능은 켜지지 않는다. 함께 필요한 service-role-only transaction RPC:

- `finalize_connection(actor, candidate_id)`: candidate `FOR UPDATE` → participant/양쪽 YES/현재 자격/차단 확인 → 같은 transaction에서 connection unique pair + room 생성 + candidate link. 이 commit의 DB timestamp를 Mutual 확정 시점으로 저장. LLM question 후보는 transaction 전에 만들고 현재 confirmed snapshot을 재검증. concurrent retry는 같은 connection/room을 반환.
- `apply_room_action(actor, connection_id, request_id, action, payload_hash)`: 동일한 room lock → server `clock_timestamp()` → expiry와 interaction 검사 → immutable answer/message와 first_action 기록. 첫 행동과 만료가 같은 lock을 사용.
- `close_connection`/`block`도 같은 connection lock 사용. 기존 blocks direct INSERT policy를 유지하면 server RPC 밖의 block race가 남는다. 따라서 이를 함께 검토해야 한다.
- participant 검사는 Edge와 RPC 양쪽에서 수행. Client callable SECURITY DEFINER 함수 추가 금지. RPC execute는 PUBLIC/anon/authenticated에서 revoke, service_role에만 grant.

Rollback: 신규 endpoint disable → 기존 code로 rollback → 새 room rows를 export/보존 → `DROP TABLE public.echo_first_rooms` (운영 데이터가 생겼으면 별도 승인 없이 drop 금지). 기존 match/answer/message 데이터 삭제 없음.

## B. KEY / Reward / entitlement

현재 DB에는 ledger가 없다. 기존 Agent JSON event를 돈/KEY balance처럼 사용하지 않았다.

최소 diff 후보:

```sql
CREATE TABLE public.echo_key_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
CREATE TABLE public.echo_key_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.echo_key_accounts(user_id),
  amount bigint NOT NULL CHECK (amount <> 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('grant','spend','refund')),
  source text NOT NULL CHECK (source IN ('purchase','reward','promotion','refund','admin')),
  target text CHECK (target IN ('scene','profile_layer','photo_fragment','special_question','special_experience')),
  target_id uuid,
  reference_id text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  UNIQUE (user_id, transaction_type, source, reference_id),
  CHECK ((transaction_type = 'spend' AND amount < 0 AND target IS NOT NULL AND target_id IS NOT NULL)
      OR (transaction_type IN ('grant','refund') AND amount > 0))
);
CREATE TABLE public.echo_key_entitlements (
  user_id uuid NOT NULL REFERENCES public.echo_key_accounts(user_id),
  target text NOT NULL,
  target_id uuid NOT NULL,
  ledger_id uuid NOT NULL UNIQUE REFERENCES public.echo_key_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,target,target_id)
);
CREATE TABLE public.echo_reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_event text NOT NULL,
  reward_type text NOT NULL,
  source text NOT NULL CHECK (source IN ('mission','outcome','profile_completion')),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  connection_id uuid REFERENCES public.doit_matches(id),
  reference_id text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,idempotency_key),
  UNIQUE (user_id,source,reference_id,reward_type)
);
```

각 표 RLS enable + PUBLIC/anon/authenticated revoke + service_role CRUD grant 필요. 위 draft에는 가격/보상량/룰이 없다. 삭제 보존 정책이 미확정이므로 monetary ledger FK에 cascade deletion을 넣지 않았다.

Atomic operation: account lock `FOR UPDATE` → idempotency 조회/hash conflict 검사 → balance `SUM(amount)` → 부족하면 spend 없음 → spend와 entitlement 같은 transaction. Reward grant는 business-source unique + reward row + KEY row가 같은 transaction. 서로 다른 idempotency key로 같은 mission/outcome을 재요청해도 business unique가 막는다. 잔액만 UPDATE하거나 Edge memory lock을 사용하지 않는다.

KEY는 Mutual/YES/Chat/Trust/relationship level/full face를 허용하지 않는다. Full photo 권한은 KEY entitlement 조회로 열지 않는다. `purchase` 경로는 CEO payment/price 승인 전 disabled.

Rollback: spend/grant endpoints disable → rows export → 정책에 따라 ledger 보존. 데이터가 존재하면 drop/삭제는 별도 승인. 신규 endpoint 없는 현재 상태로 되돌릴 수 있다.

## C. Delivery / Mission / Together Exit / Reputation

최소 계약 (table 생성까지 승인 필요):

| 표 후보 | 최소 칸·유일 키 | transaction 규칙 |
|---|---|---|
| `echo_delivery_preferences` | user_id PK, IANA timezone, quiet_start/end(local minutes), delivery_start/end, mode, revision | 본인만 변경; missing timezone을 region에서 추론 금지 |
| `echo_candidate_delivery` | candidate_id + user_id PK, window_revision, finalized_at, delivered_at, run_id | 개인 주기당 1~3 cap lock; matching과 delivery는 별도 |
| `echo_missions` | id PK, connection_id FK, validated candidate, assignment revision, status | 생성 후보는 LLM 가능; final은 server; cancelled/closed parent는 진행 금지 |
| `echo_mission_participants` | mission_id + user_id PK, state, evidence_ref, updated_at | A/B 중 해당 actor만; both complete transition lock; reward 참조 한 개 |
| `echo_exit_agreements` | connection_id + user_id PK, proposal_id, consent_version, agreed_at | 같은 proposal 양쪽 동의만 LEFT_TOGETHER; account action 없음 |
| `echo_reputation_receipts` | user_id, axis, source, reference_id, evidence_id, UNIQUE(user_id,axis,source,reference_id) | trust/activity/support 분리; purchase는 support만; 단일 report 자동 불이익 금지 |

정책 미확정: reward amount/trigger 활성화, trust weight/등급, extension, skip/edit, reset/revisit, consent/retention. 이번 코드의 pure contracts는 DB가 없는 실제 기능 완료가 아니다.

## D. Reveal / Scenes / Storage

지금은 CANDIDATE_SAFE → FULL_SAFE만 실제 지원. PARTIAL_SAFE asset 없음. Frontend blur로 만들어서는 안 된다.

최소 diff: 별도 `echo_profile_assets(photo_id, owner_id, asset_kind, storage_path, source_revision, consent_version)` + `echo_scenes(owner_id,photo_id,category,caption,revision)` 또는 기존 photo additive columns. Storage private derivative bucket + server-generated **별도 물리 조각 파일** 필요. 원본 signed URL에 transform 파라미터만 붙이는 것을 원본 차단 근거로 삼지 않는다.

- 기존 connect-v1 consent는 양쪽 first answer 이후 full reveal에만 동의한다. Partial-before-answer consent version/문구 정책 승인 필요.
- derivative SELECT는 client에 직접 허용하지 않고 authorized Edge가 현재 gate에 맞는 asset만 sign. owner upload 경로 및 server derivative write를 구분.
- photo cache, preload, DOM/JS/network 테스트 필요. 이미 발급된 full signed URL은 block/leave 이후 최대 600초 살아 있을 수 있다. 즉시 철회가 필요하면 모든 image request에서 permission을 검증하는 proxy/새 storage serving 계약 필요.

Rollback: partial/scene endpoint disable → 새 asset path/signing 중단 → 기존 FULL_SAFE 공개만 사용. 새 Storage 객체 삭제는 별도 승인 및 보존 정책 확인 후. 기존 원본/정책 변경 없음.

## E. Security advisor / Deletion

QA advisor WARN: `is_admin()` anon/authenticated SECURITY DEFINER execute, leaked-password protection disabled. 실제 `is_admin()`은 `auth.uid()` + 보호된 `profiles.role`을 확인한다. 현재 정책이 이를 사용하므로 authenticated EXECUTE를 무조건 revoke하면 RLS를 깨뜨린다. 실행 권한/노출 schema 재설계가 필요하면 별도 승인으로 다룬다.

`doit-account` 소스는 본인 confirm, storage 제거, Auth delete와 FK cascade를 사용하지만 QA에는 배포되지 않았다. 기존 signed URL/JWT 철회, 사진 제거 뒤 Auth delete 실패, legal/financial retention까지 실제 검증 전 account deletion 완료 아님. 실제 사용자 삭제 0.

승인되지 않은 DB/RLS/Storage/Auth 설정/Secret/Payment/Price/PROD 변경은 전부 실행 0.
