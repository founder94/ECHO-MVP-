# PR100 후속 독립 검증 · 영상 동의 필드 최소 수정 (2026-10-02)
Version: 1. Integration source: 5bda00beef832ff0e5ee4d28504535ba812d7818.
Parent for submission: 8b9ada3edd48a504f1b3af7a64bcb741eacbcc1a (only approval document differs from integration source).
PR100 82944033 merged unchanged, Claude receipt: issuecomment-5953725967. PR98 CLOSED; prior results remain closed.

## Scope and ownership
Codex changes only meetRuntime.ts and its owned runtime tests. No shared index.ts, SQL draft, workflow, UI, QA deployment, Supabase writes, Secret or PROD changes.
Existing meetApi/meetGate are reused. Claude owns route and SQL integration.

## Fixed code defect
Existing connect reveal consent must remain connect-v1. Video consent previously compared the same doit_connect_consent_version field with a different required version, making both gates impossible simultaneously.
Runtime now reads independent proposed metadata doit_video_consent_version and doit_video_consent_at.
No metadata is written or migrated. Missing/invalid/old video consent denies. Existing connect consent cannot substitute. Video withdrawal denies meeting while preserving existing reveal consent.
Actual consent wording/version, collection, retention and activation remain approval B-3; this patch is a reader contract, not evidence that consent storage/UI is active.

## Tests
Before: original integration [PR100] route 7/7 (mock); known consent conflict confirmed by source and existing scenario.
Final mirrors use integration 5bda00b index, agentSource, agent and meetGate, with proposed meetRuntime patch. meetApi unchanged.
- node --test --test-isolation=none qa-independent/meet-runtime.test.mjs: 16 PASS, 0 FAIL, process exit 0.
- node --test --test-isolation=none --test-name-pattern='\[PR100\]' qa/connect-server.test.mjs: 7 PASS, 0 FAIL, process exit 0.
- DENO_DIR=/tmp/echo-deno-cache DENO_TLS_CA_STORE=system deno check --no-config --no-lock --node-modules-dir=none supabase/functions/doit-connect/meetRuntime.ts: exit 0.
Original 35 service mock tests are preserved, not represented as fresh 35 tests. The affected runtime subset was rerun and extended by three regressions.
The original route scenario still passes because its fixtures contain no separate video consent; its title/comment about the shared field is obsolete after integration of this patch. Claude should update the explanation and add the positive separated-consent route fixture without weakening existing negative expectations.

## Integration observations / required Claude follow-up before enabling
1. meetCurrentState currently hashes connect consent only; include the independent video consent version and timestamp in the current context digest so withdrawal/re-consent invalidates old session context. Codex did not edit Claude-owned index.ts.
2. lastStepOpen currently derives from both first answers and reveal validity. This alone does not demonstrate the canonical 2/4/6 last confirmation segment; keep feature OFF until the authorized final-segment source is connected.
3. meet_plan currently treats an error-free null/incomplete RPC response as HTTP 200 cancelled. Receipt validation is needed before returning success. Code-review finding, not a reproduced live failure; owner Claude.
4. SQL draft reviewed only: row lock and block/intent/close triggers exist, but Auth consent remains outside that transaction as the draft itself states. This does not provide atomic consent/plan authorization.
Local SQL script was NOT run: psql/PostgreSQL absent; Docker socket operation denied. Claude's 27/27 local PG16 results remain owner evidence, not Codex independent PASS. No Supabase schema was applied.
5. Admin planAgreement remains not_connected/null in meetApi summary; do not display confirmed plan count as normal zero.

## Current completion levels
Code and mock tests completed; shared runtime/router integrated by Claude at 5bda00b with feature OFF.
Claude reports QA deployment run 37014762403, OFF contract21/21, A/B safety96/96. Those are owner results, not rerun by Codex.
Actual meet storage/RPC, provider room/context creation, verified provider callback adapter, actual video and two-device meeting flow: not tested/activated.
C real login and actual existing third-party room/photo tests: separate HOLD.
Existing downloaded files/signed URL revocation and real account withdrawal race remain separate.

## Next owner and approval
Claude integrates this reader fix, updates current-state hash/final-segment mapping/RPC receipt handling and reports frozen integration SHA.
Codex independently verifies that changed final combination; actual storage/race tests start only when approved B storage/RPC and provider are available.
B-1 provider; B-2 actual DB/RPC permission application; B-3 independent video consent/retention; B-4 QA activation remain existing decision bundle. No new blanket approval requested.
Posting this result is distinct from Claude receipt or execution.
