# Claude final close evidence (2026-10-01)

Base: `echo-qa` @ `18b209a` (merge of PR #86). QA Supabase `mutniujeiyujhkobadkd` only. PROD is untouched: test 0, deploy 0, data change 0.

## 1. Measured state

| Item | Evidence | Result |
|---|---|---|
| QA doit-agent | v77 ACTIVE. Runtime files sha256 equal to source `ee8d786` (index.ts, agent.ts, failure-intelligence.ts). `AGENT_VERSION = echo-agent-v2.5.7` | Match |
| QA doit-connect | v41 ACTIVE. index.ts, agentSource.ts and the bundled doit-agent/agent.ts all sha256-equal to `ee8d786` | Match |
| Edge deploy runs | echo-claude-smoke 36863103373 (connect_deploy_qa), 36863397826 (agent_deploy_qa). Pinned SHA; PROD ref hash lock | PASS |
| QA APP / BRAND / ADMIN | echo-netlify-deploy 36864969165: the 3 QA sites; each live `index.html` sha equals this build. PROD deploy job skipped | PASS |
| Live QA app | `/doit/fortune` has `.echo-fortune-space` inside `.doit-app-pastel`; horizontal overflow 0; internal terms 0 | PASS |
| Session restore | QA test account email login → reload → close and reopen page in the same browser profile: session kept; no extra login call (only 1 token call) | PASS (desktop Chromium; iPhone = device hold) |
| Real-AI (local, QA live v2.5.7) | `qa-real/qa-core-live.mjs`: 28 PASS / 0 FAIL (1 INVALID item: the AI showed no interpretation to withdraw, so it counts as neither PASS nor FAIL). Includes question fatigue = repair with save 0, unsure = save 0, and plain "아니요 + new value" keeps the earlier fact | PASS |
| CI close run (`qa-post-release-close` 36864972940 @ `18b209a`, issue #87) | quality PASS · real-AI PASS · Matching 2-account E2E **39 PASS / 0 FAIL** (A yes → waiting, B yes → mutual, duplicate 0, blind-first, messages blocked before both first answers (409), reveal after both, both-way messages, outcome, 404 on unknown connection) · OAuth AUTH_PERMISSION_HOLD → the final gate is red **only** because of OAuth | PASS except OAuth HOLD |
| Local gates (PR #86 head) | lint 0 · type 0 · tests 886 (881 pass / 0 fail / 5 todo) · builds app/brand/admin · sourcemap 0 · PROD ref 0 · browser 34/34 | PASS |

## 2. OAuth

| Check | Result |
|---|---|
| Secret presence (booleans only; values never printed) | `SUPABASE_QA_AUTH_READ_TOKEN=false` (also all 6 other read-token candidate names false). `SUPABASE_QA_ACCESS_TOKEN=true` is the deploy token and is **not** used as a substitute (rule: do not substitute another secret) |
| Auth Config read (`/v1/projects/{ref}/config/auth`) | Not possible without the token → **AUTH_PERMISSION_HOLD** |
| Public settings `/auth/v1/settings` | google=true, email=true |
| Authorize redirect (valid PKCE) | 302 → accounts.google.com with `redirect_uri=https://mutniujeiyujhkobadkd.supabase.co/auth/v1/callback`, client_id present |
| App callback path `/auth/callback` | HTTP 200 |
| Real Google round trip | Needs a human Google account (iPhone checklist items 5–6) |
| Session restore | PASS (email login, see above) |

Verdict: **AUTH_PERMISSION_HOLD**. "provider true" and "302" are not counted as PASS.

## 3. TODO 5

| Test | Classification | Reason |
|---|---|---|
| v15.1 heuristic ①-b (`conversation-v15.test.mjs`) | NON-BLOCKING | This tests `doit-understanding` (CoreConversation). In the app build `VITE_ECHO_AGENT_ENABLED=true` makes `/doit/conversation` render `AgentConversation` (doit-agent). It also has a mock-only limitation; the real-AI agent run covers repetition |
| v15.1 heuristic ②-b | NON-BLOCKING | Same path as above (fallback only when the agent flag is off) |
| [미확정] STEP 1→7 완주율 (`full-journey-1to7`) | OBSOLETE | Old B-structure flow (`get-step-question` / `echo-journey`). Neither function is deployed on QA; the routes redirect to app home (`router/config.tsx`, 2026-09-26 MVP note). Screen files are kept |
| [미확정] 깊은 여정 막다른 길 (`stress-messy-inputs`) | OBSOLETE | Same old STEP flow |
| LEGACY-01 deep journey 40 | OBSOLETE | Same old STEP flow (already labelled LEGACY-01) |

Release-blocking 0. External hold 0.

## 4. Failure Intelligence

| ID | Name | Judgment | Evidence |
|---|---|---|---|
| FI-021 | QA/PROD environment lock | IMPLEMENTED | Builds: PROD ref 0. Edge deploy: PROD ref hash lock. Netlify: target=qa only for QA; PROD needs target=prod + GO + ECHO-PROD reviewer (job skipped in 36864969165) |
| FI-022 | deploy ≠ product PASS | IMPLEMENTED | Deploy is followed by the live contract (401/403/400/404/200), runtime sha256 = source, the separate real-AI run and E2E. Reported as separate lines |
| FI-023 | artifact pinning | IMPLEMENTED | `AGENT_SHA`/`CONNECT_SHA` pinned to `ee8d786`; runtime sha256 match; Netlify live index sha = build |
| FI-026 | actual device distinction | IMPLEMENTED | Desktop Chromium results are labelled as such. iPhone = EXTERNAL_DEVICE_HOLD until real evidence (`docs/ops/IPHONE_DEVICE_CHECKLIST_20261001.md`) |
| FI-027 | first pixel / splash | IMPLEMENTED | `qa/app-meta.test.mjs` (navy first background before React, pastel app background, build fails without theme-color). Real-device first pixel = checklist #1–3 |
| FI-028 | OAuth E2E | EXTERNAL HOLD | The Auth Config read token is missing (AUTH_PERMISSION_HOLD), and the Google round trip needs a human. Measured parts are in section 2 |
| FI-029 | permission-aware HOLD | IMPLEMENTED | `scripts/oauth-redirect-guard.mjs` exit 3 = HOLD (not FAIL, not PASS). `secret_presence_qa` prints booleans only |
| FI-031 | full-loop E2E accounting | IMPLEMENTED | `qa-real/qa-match-e2e*.mjs` step-by-step records; close workflow writes an `ECHO_CLOSE_RUN` issue per run |
| FI-037 | duplicate work prevention | IMPLEMENTED | `concurrency:` in `echo-netlify-deploy.yml` and `qa-post-release-close.yml` (no two runs at once). E2E checks the A↔B shared candidate (`pairCandidateId`), so test accounts left from earlier runs do not double-count or break the run. Runtime sha256 is compared with source, so a deploy that is already live is not re-done. Note: each close run still signs up two new QA-only test accounts |
| FI-038 | handoff | IMPLEMENTED | Section 6 of this file |
| FI-041 | multi-gate QA | IMPLEMENTED | `qa-post-release-close.yml`: quality → real-AI → OAuth → matching E2E → issue → final gate |
| FI-042 | TODO accounting | IMPLEMENTED | Section 3 (each of the 5 TODOs classified). The test runner reports `todo 5` |
| FI-043 | STOP | IMPLEMENTED | PROD Netlify/edge needs CEO GO + environment approval. No DB/RLS/migration/secret/payment change in this round |
| FI-044 | rollback | IMPLEMENTED | Section 5 (pinned previous SHAs + Netlify previous deploy) |
| FI-045 | evidence provenance | IMPLEMENTED | Every line above names a run id, commit or sha256 |

PARTIAL 0 · MISSING 0 · EXTERNAL HOLD 1 (FI-028).

## 5. Rollback (QA)

- Edge: in `echo-claude-smoke.yml` on `claude/echo-p0-qa-20260927`, set `AGENT_SHA`/`CONNECT_SHA` back to the previous pin `02aedd0` (agent v2.5.6) and `AGENT_VERSION` to `echo-agent-v2.5.6`, then dispatch `agent_deploy_qa` / `connect_deploy_qa`. QA only.
- Netlify QA: Netlify → site → Deploys → choose the previous deploy → "Publish deploy". Or dispatch `echo-netlify-deploy.yml` (target=qa) from the previous `echo-qa` commit `aa6181c`.
- No DB change in this round, so no data rollback is needed.
- This procedure has not been drilled in this round.

## 6. Handoff (Codex)

- Code: `echo-qa` @ `18b209a`. PR #82, #84, #86 merged. No open Claude PR for this scope.
- Single readiness contract: `conversationReadiness()` in `supabase/functions/doit-agent/agent.ts`, used by `doit-connect/agentSource.ts`.
- Agent v2.5.7: plain "아니요 + new value" → `fix_check`; `REPLACE_MARK` words → direct correction.
- Saju/Tarot: PASTEL_WORLD_LOCKED (light/depth/material/type only).
- Partial photo reveal: PRIVACY_ARCHITECTURE_HOLD (no server/Storage/RLS/DB/Auth change).
- Open external items: QA Auth read token (CEO), Google round trip and iPhone checklist (human + device).
