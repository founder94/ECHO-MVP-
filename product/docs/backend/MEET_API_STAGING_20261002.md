# Video → appearance → meeting server adapter — 2026-10-02
Status: CODE + MOCK TESTS READY; NOT ROUTED, NOT DEPLOYED, DB/PROVIDER HOLD.
Base: PR96 22a9c59e7bcef8efab9de85b4f88d20fcf6691c5. Existing meetGate.ts reused unchanged.
Files: doit-connect/meetApi.ts (new), qa-independent/meet-api.test.mjs (new). Claude-owned index.ts, Agent, admin/web, workflow and SQL drafts unchanged.
No route or stage invented; no numeric 2/4/6 hardcoding. Current server progression must supply lastStepOpen via MeetPolicyReader, never client body.

## Implemented staged code
Supabase-shaped service queries existing connection and approval-B draft video_session/participation/check/intent tables; caller verified Auth identity owns the target.
Reads current connection and injected current block/safety/consent/final-stage policy after evidence reads.
Reuses existing meetGate / meetStatusForMe for status and final requireMeetingAllowed guard.
meet_check stores ONLY caller's own check after signed joint same-connection camera evidence.
meet_intent stores ONLY caller's own yes/not_now/no with user+request uniqueness; same ID other payload conflicts; unique collision is reread.
HTTP adapter handle returns status/body, sanitizes failure codes, never trusts user_id, allowed or lastStepOpen in request body.
Default OFF: MEET_NOT_CONFIGURED/503, zero table calls. Missing tables/reads/too-many records are errors, never normal 0.
Timestamp-tied conflicting newest intents fail closed instead of arbitrarily choosing yes.
No provider recording, callbacks, tickets, camera controls, reservation, stage persistence, admin raw data or real video claimed.

## Request contract (activation pending)
Verified actor comes ONLY from existing getUser call.
meet_status: {matchId}; success {ok:true,state,allowed}.
meet_check: {matchId,sessionId}; success same status + replayed.
meet_intent: {matchId,sessionId,intent,requestId}; success same status + replayed.
States reuse existing gate: allowed, need_video, need_my_check, need_my_intent, waiting_partner, unavailable.
Partner no/not_now remains private. No provider reference, photo URL, participant duration or partner intent returned.
Errors: UNAUTHORIZED401, NOT_FOUND404, BAD_REQUEST400, REQUEST_CONFLICT409, MEET_UNAVAILABLE409/503, MEET_NOT_CONFIGURED503, MEET_READ_FAILED503, MEET_WRITE_FAILED503, MEET_READ_INCOMPLETE503, MEET_INTENT_ORDER_UNRESOLVED503.
No runtime endpoint exists yet; frontend must not turn on video/meet UI based on this PR.

## Verification
node qa-independent/meet-api.test.mjs: 14 PASS,0fail,exit0 (mock database/service, no network, no real accounts).
deno check --no-config --no-lock --node-modules-dir=none supabase/functions/doit-connect/meetApi.ts: exit0.
Initial Node strip-only syntax failure was corrected (parameter property replaced); final tests passed.
PR98 original node qa-independent/connect-v52-repro.test.mjs:2/2 exit0; existing PR98 regressions6/6 exit0 against3388ec9 (QA v54 all3modules identical).
Do not sum these layers into product/real video PASS.
PR98 independent return comment5950723423. Prior PR97 handoff remains completed.
Existing Claude A/B96, AI28/33 reports reused as OWNER evidence; no additional account mutation here.

## Existing approval B, not a new master
Use existing PENDING_20261002_meet_gate_B.sql and rollback draft; no migration executed or duplicated.
Needed actual decisions: QA four-table/RLS/service access approval, media supplier/signature Secret/external transmission and retention/consent policy; current server final-stage source.
Reason: confirmed appearance and intent need durable per-user/session state, actual joint video evidence must come from verified provider.
Impact: new relationship/video metadata and permissions (metadata IS personal data even without image/audio); original consent/deletion/retention terms need decision.
Apply order: approve policies → QA schema/access → provider verified callbacks → server policy reader → owner route wiring behind OFF flag → QA BOLA/retry/revocation/provider forgery checks → device tests → activate. PROD separately.
Rollback: disable route/feature preserves records; old code ignores new tables. Do not delete metadata/columns without retention decision; disabling cannot revoke delivered bytes or guarantee terminate an existing provider call.
Current multi-query reads and precheck→write are NOT transactions; after-write status rechecks permission but historical confirmation/intent could persist if concurrent block occurs. requireMeetingAllowed is a read guard, not atomic plan creation. Plan transaction / stage authority / ordered intent updates remain review items.
Public privacy partial assets and signed-URL revocation remain independent; no original or derivatives created.
Admin current missing/unconnected/error states remain existing; no fake video counters added.
Owner: Codex new module/mock tests, Claude integration/index/deploy; provider/schema decisions founder. No simultaneous same-file work.
