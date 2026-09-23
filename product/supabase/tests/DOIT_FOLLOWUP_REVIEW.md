# ECHO follow-up contract — local proposal, not deployed

Baseline was read directly from operating `doit-understanding` v5 and public RPC definitions.
The v5 Edge text matched the local file exactly before this patch. Actual inspection also confirmed
that the write RPCs are callable by `service_role` only, not `anon` or `authenticated`.

## What this patch adds

- `followup_generate { recordId, requestId }` → `{ ok: true, question: { text, sourceRecordId }, duplicate }`.
- `followup_get { recordId }` → `{ ok: true, question: { text, sourceRecordId } | null }`.
- A question is an AI candidate checked against current record, latest confirmed/corrected/self evidence,
  and rejected interpretations. It is never promoted to a confirmed insight.
- Evidence selection gives this record's corrections/direct explanations first, then other direct
  explanations/corrections, then AI confirmations. Newer AI confirmations cannot crowd out the
  current record's explicit correction from the bounded model input.
- When any correction or direct explanation is present, candidate generation cannot accept a
  word-overlap shortcut: the existing grounding judge checks every candidate using explicit
  correction/self priority. Failed or unavailable judgment accepts no candidate. Existing model,
  attempt limits, call time budgets, and write/rescue reserves remain unchanged.
- The server loads only the owned `profiles.purpose_id` and the canonical active `purposes.id/label`.
  The purpose is dialog context, never evidence of personality, intent, compatibility, or divination.
  Browser-supplied purpose labels are ignored. No nickname, region, or photo enters AI context.
  Purpose is included in the version hash; changing it invalidates saved questions and pending work.
  Profile and selected catalog rows stay under `FOR SHARE` locks through final acceptance, including
  an inactive catalog row whose exposed purpose is null. This orders direct profile updates with
  acceptance even though those updates do not use the advisory locks.
- A DB claim is obtained before any AI request; the exact accepted question is cached for retries.
- Unresolved candidates for the selected record prevent question generation. Questions for changed
  evidence are discarded at final DB acceptance and are not returned by restore.
- At most three existing-model AI calls: generation, premises/grounding check, rejection semantic check.
  Generation/validation failure produces an explicit error, with no invented or fixed fallback question.
- `record_create.originalText` now preserves the submitted spacing/newlines. Working `text` is cleaned
  separately. Empty/overlong original text is rejected before the RPC.
- Existing `insight_generate` now claims before AI, then checks context and invokes the existing
  candidate-insertion RPC atomically in the finish transaction. Different request UUIDs are also
  blocked while an AI job is active for the record. Expired leases cannot commit late results.
- Candidate and rescue responses are stored exactly. Retries, including new request IDs with
  unchanged context, return the accepted response without paying for another AI call.
- The post-insertion context is cached, so the candidate rows created by the operation itself do
  not incorrectly invalidate the saved response. Later corrections do invalidate it.

## Client handling

- Do not auto-generate on load, reload, timers, tab switching, or automatic error retries.
- Keep one request ID for a failed/ambiguous request. Complete it only on a confirmed response.
- `STALE_CONTEXT`: discard that old request ID, reload latest records and insights, then allow a new
  explicit user request. Applies to both insight and question generation. Never retry an old applied
  output with changed context. Old v5 applied events without response snapshots return this error;
  they are not reconstructed by speculation or by another AI call.
- `PENDING_INSIGHTS`: finish the four-reaction review for that record first.
- `IN_FLIGHT`: do not start another generation; offer a later restore/retry.
- `SERVER_UPDATE_REQUIRED`: DB draft is absent. Show an honest unavailable state, not a local question.
- The current operating v5 does not know these actions. Keep the separate UI feature gate OFF until
  the reviewed DB and Edge release is approved and verified.
- `insight_correct` can update confirmed, corrected, and self-origin rows; rejected rows are terminal.
- `insight_self` creates a new confirmed/self row, it does not replace an existing candidate atomically.
  Reject-then-self UI must retain partial progress and recover the second write without repeating rejection.

## Approval and deployment boundary

No operating changes were performed. Proposed deployment requires:

1. Review the exact six captured RPC replacements in `PENDING_20260921_doit_revision_lock.sql`.
   It adds the same per-user short transaction lock to existing mutations and explicit row/revision
   guards to record/insight transitions. Their service role checks support legacy and JSON JWT claims
   consistently; a real SQL fixture reproduced and verified that compatibility fix.
   Captured-definition fingerprints reject deployment if the
   operating definitions have drifted. No table grants or RLS changes are included.
2. Review `PENDING_20260921_doit_followup.sql`: four nullable columns on request events and six
   service-only RPCs. New functions explicitly revoke public/anonymous/authenticated execution.
   A preflight check refuses to install the new RPCs until the shared mutation locks are present.
3. Both drafts were run in isolated PGlite/PostgreSQL with synthetic fixtures. They remain drafts
   outside migrations and were NOT executed against the operating database. Validate actual
   operating PostgreSQL compatibility and multi-session behavior before release approval.
4. Deploy the approved DB change and Edge code; use existing model and secrets unchanged.
5. Verify with a real authorised test account and real AI, then enable the separate frontend gate.

Default rollback: disable v6 UI gates, restore operating v5 Edge, KEEP the compatible revision safety
locks and additive columns/data. `ROLLBACK_20260921_doit_revision_lock.sql` is emergency-only: it
removes concurrency safeguards and therefore requires separate approval. Its fingerprint guard
refuses to overwrite newer modifications. No user data deletion is part of either rollback.
The exact v5 Edge rollback source is `supabase/rollback/doit-understanding-v5.ts`.

## Verification actually run

- Actual Edge handler local mock tests: `node --test supabase/tests/doit_followup_contract.test.mjs`,
  31/31 PASS. All SDK/AI boundaries are mocked; no real network, user writes, or AI calls occurred.
- Isolated SQL tests: 31 scenarios PASS (Node totals 32/32 including the parent group), with the
  actual three SQL drafts, captured baselines, and the nine operating CHECK constraints. Covered
  stale correction/purpose, expired A → B takeover, both generation caches, role grants/claim formats,
  legacy v5 response-null events, exact source retention, and deploy/rollback fingerprints.
  See `DOIT_ISOLATED_SQL_REVIEW.md` for fixture scope and reproduction. No operating DB was changed.
- TypeScript compiler with actual pinned Supabase SDK and an ambient Deno API: zero diagnostics.
- Deno runtime unavailable: `deno check` and `deno lint` were not run.
- Actual multi-session DB races, production PostgreSQL compatibility/RLS/Auth, real AI semantic
  quality, physical device, and production deployment: NOT RUN / not verified.
- This is independent from the reported v48/v26 `FINAL100V4` tests; those results do not validate v6.

## Remaining risks deliberately not hidden

- Operating v5 still has the old AI-before-idempotency limitation until this reviewed proposal is
  approved and deployed. The local patch addresses it for candidate generation and follow-up.
- Lease expiry permits retry after an abandoned worker. A lost/slow provider request can still have
  incurred cost; this design prevents concurrent accepted jobs, not an impossible guarantee that
  an external provider will bill exactly once in every network failure.
- Mandatory correction-aware judgments still rely on the existing AI model; controlled mock tests
  do not prove all real-AI corrections or paraphrased rejections are always handled correctly.
- Existing v5 rescue behavior remains separate from the new normal follow-up contract. Its quoted
  or generic fallback is not evidence that a normal next question was generated or an insight confirmed.
- Snapshot generation covers the selected record, persisted understanding, and selected purpose. It does not invent a
  global personality, pairwise compatibility, astrology result, or matching/mission functionality.

References consulted: Supabase changelog and database function guide; PostgreSQL explicit locking.
https://supabase.com/changelog
https://supabase.com/docs/guides/database/functions
https://www.postgresql.org/docs/current/explicit-locking.html
