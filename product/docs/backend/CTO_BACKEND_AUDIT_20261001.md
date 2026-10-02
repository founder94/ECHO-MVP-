# ECHO backend final implementation audit — 2026-10-01

Canonical specification: the founder's FINAL IMPLEMENTATION MASTER in this conversation. Canonical repository HEAD: `echo-qa`, `cf53197b1cfa591dca007afe0692189cdc97c615` (merge #92). Implementation branch: `codex/qa-backend-final-20261001`. No older document overrides that specification.

## Current backend and classification

Read-only inspection covered actual QA database columns, constraints, RLS policies, Storage, function sources and security advisors. QA project: `mutniujeiyujhkobadkd`. Production was not modified. Shared QA Agent version 83 and Connect version 44 were observed separately from canonical Git source; they include pending Claude work. Shared functions were not overwritten. Final implementation was deployed only as fixture-restricted `doit-connect-cto-qa`, version 2, JWT verification enabled, two synthetic accounts allowed.

| Area | Classification | Evidence / limitation |
|---|---|---|
| Agent / canonical state | PARTIAL | Existing memory, corrections, rejected/superseded provenance and readiness preserved. Actual QA Agent completed for two accounts. Full semantic correctness is not proved by that smoke test. |
| Question rescue | PARTIAL | QA Agent 83 and pending Claude #93 contain rescue work; canonical branch is older. HELP/SKIP/STOP/FATIGUE must remain control actions, never matching facts. No concurrent Agent edits here. |
| Confirmed profile | PARTIAL | Confirmed/direct/corrected provenance admitted; AI-extracted, rejected, superseded and fortune output excluded. FRAME/LAYERS/FILM/SCENES are not all persisted server contracts. |
| Matching | PARTIAL | Eligibility, purpose, blocks/reports, confirmed overlap, direct region/lifestyle tie-break, stale-fact revalidation and bounded candidate generation. No distance coordinates or final compatibility prediction. |
| Rolling / quiet / delivery | MISSING / HOLD | No continuously running scheduler, persisted personal schedule, delivery worker or notifications. IANA/DST/day-sleep utility implemented and tested; not a live scheduler. |
| Candidate 1–3 | PARTIAL | Existing bounded proposal path; stale/ineligible partners removed. Concurrent global pool fairness/count enforcement still needs transactional scheduling. |
| MBTI / blood type / Lens | PARTIAL | No hard-filter/scoring use of MBTI, blood type, saju or tarot in Connect. Complete optional flavor/Lens persistence not present. |
| Reveal | IMPLEMENTED gates; PARTIAL product | Candidate response has no full photo. Full requires both answers, both current consent records, participant ownership and active safety gate. No PARTIAL derivative assets exist. |
| KEY ledger | MISSING / HOLD | No account/ledger/entitlement tables or spend endpoint. Reviewed contract forbids buying YES, mutual, chat, trust or full-face access. No price or payment enabled. |
| Mutual / connection | PARTIAL | Conditional choice/finalization, ordered pair uniqueness, retry recovery, orphan suppression and safety rechecks implemented. Multi-statement writes still require a transaction RPC for atomic guarantees. |
| ZZARIT | IMPLEMENTED server receipt | Unique existing request-event receipt per participant/connection; simultaneous retries return event once. Lost response may omit animation. Frontend integration pending. |
| First Room | PARTIAL / HOLD | Server-derived 72h idle gate, refresh-independent response and timely interaction continuation. Connection creation timestamp is a proxy; exact mutual commit timestamp, persisted lifecycle and expiry/write atomicity require DB work. |
| First question / blind-first | IMPLEMENTED existing MVP | Shared stored question, per-participant answers, answer replay, pre-answer chat denial and safe reveal gates tested. No new editing/skip policy invented. |
| Chat | PARTIAL | Auth, ordering, block/leave gates, reconnect and UUID request dedup supported. Current frontend must supply stable requestId; legacy requests without it remain non-idempotent. Block/write atomic race needs RPC. |
| Mission | MISSING / HOLD | Pure A/B completion and reward-reference contract tested; no persisted assignment, live endpoint or actual mission completion. |
| Trust / activity / support | MISSING / HOLD | Separate contract axes, purchase affects support only, spam cannot earn activity. No unapproved score, grade, weighting or live engine. |
| Reward | MISSING / HOLD | Idempotent ledger design only. No grants, amounts or unapproved trigger rules. |
| Outcome | PARTIAL | Existing participant outcome updates and simultaneous initial insert recovery; not promoted to personality facts. No automatic rewards. |
| Pause / reset / Together Exit | MISSING / HOLD | Two-consent pure exit contract tested; no persisted bilateral workflow or live pause/reset endpoints. Exit consent never authorizes the other account's deletion. |
| Account deletion | PARTIAL / SECURITY RISK | Own-account deletion source exists but QA function is not deployed. Storage-first failure and retention semantics need review. No deletion executed. |
| Observability / failure intelligence | PARTIAL | Existing event/failure logs retained; full request/run/room/mission/reward trace and listed analytics taxonomy not implemented. No raw conversation analytics added. |

## Implemented changes

Connect fails closed on failed safety, ownership, eligibility and answer reads; reports are idempotent and failed safety writes cannot appear successful. Candidate decisions use conditional updates. Mutual claims precede expensive question generation; a missing parent stays unavailable and is recovered on retry. Participant connection reads suppress unapproved/orphaned parents. Reveal emits only authorized data, returns private no-store responses and rechecks safety after signing. Answers and messages support retry conflict handling; outcomes merge racing initial updates. Claude #95's six safety reasons, withdrawal behavior and chunked 100-ID reads were preserved.

## Security risk

All inspected public tables have RLS enabled. Internal matching tables deliberately have no client policies and anon/authenticated SELECT revoked. Photos are in private `profile-photos`, JPEG-only, 5MB maximum, own-folder policies. Profile admin role is protected by role-lock triggers; service authorization rechecks protected role. A signed full-image URL already issued can remain usable for up to 600 seconds after a block; no frontend blur can solve this. Current consent is broad connect-v1 rather than a new post-answer reveal consent ceremony. Multi-request safety/expiry checks are not an atomic transaction. QA eligibility checks photo-row count, not authenticity; synthetic fixtures prove server flow, not identity verification.

Advisor findings: intentional internal RLS/no-policy notices, SECURITY DEFINER `is_admin` execution exposure (authenticated use participates in existing policies; do not blindly revoke), and disabled leaked-password protection. No configuration or privilege changes were applied.

## E2E and tests

The reproducible actual-QA harness is `qa-real/qa-backend-final-live.mjs`; credentials stay in /tmp, outside Git. It uses two fresh Auth accounts, real distinct synthetic JPEG uploads, real Agent calls and authenticated Edge calls. It covers candidate privacy, both YES, mutual retry, connection, room, first question, answers, full reveal, bidirectional duplicate-safe chat, outcome, re-login, block/report and failed re-entry. Browser DOM/cache inspection, actual KEY/Mission/Reward/Pause/Together Exit/Deletion are not passed or claimed: those live engines do not exist. Expiry, conflicting decisions, consent withdrawal and signing races are simulated deterministically in the server suite.

See `evidence/` for final public check results. Lint, TypeScript and Deno checks passed. Combined backend regression suite: 72 individual checks passed. Whole repository test command is recorded separately as test-file results; do not confuse file count with individual assertions.

## Approval and remaining work

Read [CTO_BACKEND_APPROVAL_20261001.md](CTO_BACKEND_APPROVAL_20261001.md) for concrete proposed schema/privilege/storage changes, necessity and rollback. SQL is review-only and was not executed. DB atomicity/room persistence, ledger/RPCs, derivative storage, mission/delivery/exit/reputation persistence and deletion retention remain HOLD. Payment, prices, secrets and every production action remain HOLD. No 100% completion declaration is valid while these remain.
