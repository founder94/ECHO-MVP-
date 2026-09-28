# ECHO Human Continuity Engine v0.1 — IMPLEMENTATION ORDER
Date: 2026-09-28
Mode: COMPANY HQ -> CLAUDE CODE IMPLEMENTATION
Branch: rd/echo-human-continuity-v0.1

## 0. Purpose
Build ECHO's proprietary Human Continuity R&D layer from the company's real failure data.
Do NOT rebuild the product stack. Reuse existing React/Vite/TypeScript + Supabase/Postgres + Edge Functions.

Core principle:
- OpenAI / Claude / Gemini are replaceable candidate generators.
- ECHO server owns final state, correction, rejection, confirmation, routing, matching eligibility, and failure-defense decisions.
- User direct/latest correction beats AI interpretation.
- Rejected meanings must never reappear as user fact.
- Failure Intelligence must never become user profile/matching truth.

## 1. Scope v0.1
Implement only the internal R&D layer below:
1) Failure Compiler
2) Human State Compiler contract
3) Rejection/Correction state contract
4) Human Effort Cost evaluator
5) Defense Candidate output
6) tests/replay

Do NOT:
- change production DB
- deploy PROD
- change auth/payment/pricing
- alter matching output in production
- add user-facing screens
- auto-apply generated guards to production
- train/fine-tune a foundation model

## 2. Existing company assets to use
Read first:
- docs/failure-intelligence/data/failures.json
- docs/failure-intelligence/data/failed-solutions.json
- docs/failure-intelligence/data/failure-graph.json
- docs/failure-intelligence/data/action-ledger.json
- docs/failure-intelligence/FAILURE_TAXONOMY.md
- docs/failure-intelligence/STORAGE_MASTER_20260925.md
- docs/failure-intelligence/FAILURE_DATASET_DB_DESIGN_20260926.md
- existing agent/session/canonical-state implementation in product/

Do not invent synthetic history when real evidence is missing.
Unknown costs must remain UNKNOWN.

## 3. New modules
Create under product/src/lib/human-continuity/ unless current architecture has a more suitable equivalent path.

### 3.1 types.ts
Define:
- InformationStatus =
  USER_DIRECT
  USER_CONFIRMED
  USER_CORRECTED
  AI_INFERRED
  UNCONFIRMED
  DISPUTED
  REJECTED
  SUPERSEDED
  RETRACTED

- FailureEvidenceLevel =
  ACTUAL
  FOUNDER_STATEMENT
  REAL_AI_SCRIPTED
  CODE
  HYPOTHESIS

- DefenseLevel =
  CANDIDATE
  MOCK_VERIFIED
  REAL_AI_VERIFIED
  USER_VERIFIED
  PRODUCTION_VERIFIED

- HumanCost:
  emotional
  time
  financial
  mental
  each with value + evidence level; UNKNOWN allowed

- HumanStateFact
- CorrectionEdge
- RejectionEdge
- FailureRecordNormalized
- DefenseCandidate
- HumanEffortEvent

### 3.2 humanStateCompiler.ts
Pure deterministic functions only for v0.1.

Input:
- current canonical state
- raw user statement
- optional target fact/meaning id
- event type

Supported event types:
USER_MESSAGE
CONFIRM
CORRECT
REJECT
RETRACT

Rules:
- raw user statement is preserved
- AI_INFERRED never auto-promotes to confirmed
- CORRECT supersedes prior conflicting fact and keeps lineage
- REJECT marks target meaning/fact rejected, does not delete raw source
- latest direct correction wins over older state
- only eligible statuses can be exported to matching
- rejected/superseded/disputed/unconfirmed/AI-inferred must be excluded from matching export

Output:
- updated canonical state
- state transitions
- correction/rejection edges
- matching-safe projection

### 3.3 failureCompiler.ts
Input:
- existing failure record(s)

Output:
- normalized failure family
- root cause layer
- human cost summary
- linked proprietary engine
- defense candidate
- counter-test candidate
- QA test candidate
- evidence level
- NEVER write code or mutate runtime automatically

Map at minimum:
- repeated explanation -> Context Memory
- correction ignored -> Correction Engine
- rejected meaning reappears -> Rejection Firewall
- unconfirmed assertion -> Information Status
- direction drift -> Direction Lock
- completed action re-request -> Action Router / Action Ledger
- QA/PROD contamination -> Release Gate
- mock/build/deploy mistaken as success -> Verification Gate
- excessive CEO manual relay -> Agent Orchestration
- cost not surfaced -> Cost Visibility Gate

### 3.4 humanEffortCost.ts
This evaluates AI/system burden, NOT the user.

Initial event weights may be configurable defaults, never presented as scientific truth.

Events:
- repeated_explanation
- correction_required
- rejected_meaning_reappeared
- completed_action_re_requested
- blocked_path_repeated
- unnecessary_manual_step
- unnecessary_long_explanation
- wrong_navigation
- false_completion_report
- qa_prod_mix
- cost_not_disclosed

Output:
- event list
- raw score
- severity band
- evidence
- reason

Keep score internal R&D only.

### 3.5 defenseRegistry.ts
No production enforcement.
Maintain candidate registry:
failure_ids[]
family
proposed_guard
counter_test
mock_result
real_ai_result
user_result
production_result
defense_level

Promotion must be monotonic and evidence-backed.
No CANDIDATE -> VERIFIED shortcut.

## 4. Replay corpus
Use existing Failure Intelligence records as the initial corpus.
Create a deterministic loader/normalizer.

Minimum replay cases:
- repeated same-meaning question
- user correction ignored
- rejected meaning resurfaces
- unconfirmed interpretation asserted as fact
- completed action requested again
- blocked path suggested again
- QA URL/ref appears in PROD artifact
- mock PASS but real device FAIL
- user's "잘 모르겠어/딱히 생각 안 나" does not become a confirmed fact
- correction A->B results in A SUPERSEDED, B current
- rejection does not delete raw statement but blocks matching/profile use

## 5. Test requirements
Create tests that prove:
1. USER_CORRECTED beats older USER_DIRECT
2. REJECTED can never appear in matching-safe projection
3. AI_INFERRED can never appear in matching-safe projection unless explicitly confirmed
4. original raw statements are preserved
5. correction lineage is preserved
6. failure compiler does not mutate product behavior
7. human effort score evaluates system burden, never personality
8. unknown financial/time values stay UNKNOWN
9. candidate defenses cannot auto-promote
10. existing production build/tests remain unchanged outside R&D layer

Also add counter-tests:
- intentionally disable each critical exclusion and prove the test fails.

## 6. Architecture rule
Use:
UI -> ECHO Agent -> Human Continuity Layer -> model candidate if needed -> ECHO server validation -> canonical state -> matching-safe projection -> matching/connection/outcome

Do not put canonical-state logic in React components.

## 7. Storage v0.1
Respect current storage lock:
- existing failure dataset remains repository JSON for v0.1
- no new production DB table
- no migration
- no RLS change
- no user data copied into failure dataset

If persistence for runtime state is already implemented, reuse existing agent/session storage without schema changes for this phase.

## 8. Deliverables
Return only one FINAL COMPLETION REPORT containing:
- files added/changed
- architecture actually implemented
- tests added
- full test results
- regression results
- what remains R&D-only
- any mismatch with this order
- commit SHA

No intermediate progress reports.

## 9. STOP conditions
Stop and report instead of changing:
- production DB migration required
- production deploy required
- auth/security policy change required
- payment/pricing change
- destructive data change
- implementation would require changing current MVP user flow

## 10. Definition of Done
v0.1 PASS only when:
- failure corpus loads
- failure -> defense candidate generation works deterministically
- canonical state correction/rejection rules pass
- matching-safe projection excludes forbidden states
- Human Effort Cost emits internal R&D result
- counter-tests demonstrate guards are real
- existing test suite remains green
- no PROD/DB/deploy changes occurred

Company hook:
"사람처럼 말하는 AI가 아니라, 사람을 다시 설명하게 만들지 않는 AI."
