# Codex shared QA independent verification — 2026-10-02 v1
Existing PR97 handoff and isolated v3 work are CLOSED/completed.
Reference: echo-qa 1da42948348dc674e6863563351ec65d7598c52c; PR96 head 0ee5ebecb2ce5a4965f3d428026a9d7c3c4f095b.
Integrated runtime source cbc9497679cecb096d74565d00853ad56fcb60d1; later head differs ONLY in documentation.
Read-only deployed doit-connect v52 package c79f7768c1554b3804ded3dead1dd65ca5762aa5d43cb3ab681c3fd0282f03f4.
All THREE included modules match PR96 head exactly: doit-connect/index.ts, doit-connect/agentSource.ts, doit-agent/agent.ts.
Workflow runs 36984368988 and 36984507871 completed success, workflow head 43d3130324811727f5374a00f7dec07923f436a6 (workflow SHA distinct from deployed source).
Reuse Claude reported server85/85 and live contract15/15 for this source; these do not test every race.
Reuse isolated v3 live47 exit0/mock6 exit0 as isolated evidence ONLY. Submission87 file completion exists, exit code unrecovered.
PR97 receipt 5947971111 and integration receipt 5948266524 confirmed. Archived server source ae103a43f8fb1c0daa3b6c8e5119370838bf1e23 is remotely accessible.

## Two specific defects: mocked actual current handler; no live account changes
Command from product: node qa-independent/connect-v52-repro.test.mjs
Executed from separate local source mirror / same deployed three modules. Final actual process exit1; tests2/pass0/fail2/cancel0/skip0/todo0.
Initial node --test subprocess returned file-level failure without child output; direct node invocation recovered actual assertions. No full suite rerun.
1. my_matches DB failure: inject doit_matches read error 08006. Actual HTTP200 ok:true matches[]; expected HTTP500. Both asA/asB errors discarded by destructuring.
2. Consent revocation during profile_photos lookup (after initial auth snapshot, before response). Actual HTTP200 FULL_SAFE partner_present:true photo_present:true even after partner metadata consent removed. Expected no full partner / asset. Current final recheck validates match status and blocks, but not fresh consent.
This is a deterministic mock reproduction, NOT a real-account revocation test. It concerns newly returned data after an in-flight withdrawal, NOT retrieval of previously downloaded bytes.
No claim a final recheck can make cross-Auth/DB/Storage reads atomic. Residual races after final read require separate guarantees.

## Owner repair, no concurrent server overwrite
Claude owns current Connect index and shared deployments. Codex edits ZERO production/shared runtime files in this submission.
Minimal expected owner changes:
- Preserve asA/asB error and fail with existing StageError connection_read_failed before constructing successful list; review equivalent my_turns/outcomes/messages empty-success paths separately.
- Refresh current BOTH participant consent after asynchronous asset/profile/message fetch, before adding partner fields. Fail closed on consent lookup error/withdrawal; current connection/block checks retained.
- Run attached two reproductions after repair and existing affected server tests. Shared deploy/retest owner remains Claude.
No new migration/RLS/storage/auth structure/secret/provider/payment/price/PROD change requested or performed.

## Missing work and limits
Shared A/B full flow not verified; original A/B remain blocked/closed and not reset. C entrance test and actual third-party room/photo checks remain separate HOLD; no new request/account creation.
Agent upstream401 and leaked CI log remediation remain Claude-only; no raw leaked log accessed, no credential copied.
APP/ADMIN/Agent full final deployment tuple still needs owner confirmation; historical admin77 is not rerun on a new tuple.
G1/C11 partial assets and V1–V4 durable video/appearance/meeting intent require existing approval B and provider/data policy; pure meetGate5 is not video completion.
C2/C8 require existing policy/timezone/storage approval. No old idle72 revival, no new prices/trust/reward policies.
admin-web file ownership is Codex per existing CORE_STRUCTURE_HANDOFF; API availability must be reviewed before implementing missing aggregate fields. No new implementation claimed.
New submission receipt: HANDOFF_PENDING until actual owner acknowledgement. PR97 historical receipt stays completed.
