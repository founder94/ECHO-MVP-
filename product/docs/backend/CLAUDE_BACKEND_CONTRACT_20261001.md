# Claude integration contract — 2026-10-01

Base `echo-qa`: cf53197b1cfa591dca007afe0692189cdc97c615. Do not edit Agent or frontend files as part of this server change. Pending #93 owns question rescue and #94 owns profile presentation. Pending #95 overlaps `doit-connect/index.ts` and `qa/connect-server.test.mjs`: its safety actions, six reasons, waiting-YES withdrawal and 100-ID chunked reads/tests are incorporated here. Merge/reconcile #95 before this draft; do not replace either file wholesale with an older revision. Shared QA Connect was deliberately left untouched.

Frontend integration requirements:

- Mutual and Connection are authoritative only after successful server response with a linked connection. `match_id:null` is recovery in progress, never a celebration trigger. No optimistic mutual.
- Candidate response contains only candidate-safe confirmed text, never a full-photo URL. `my_match` returns `reveal_state:CANDIDATE_SAFE|FULL_SAFE`; no partial asset exists yet. Do not preload, blur or mask a full photo at an earlier stage.
- `room` is server-derived where present. No frontend-created deadline. Connection timestamp proxy is explicitly transitional pending approved DB room work.
- For chat retries, generate one UUID `requestId` per logical message, retain it across retries and send it with `send_message`. Different content with the same UUID conflicts. Requests without the UUID retain legacy non-dedup behavior.
- For ZZARIT call `zzarit_seen` with `matchId` when `zzarit_eligible` is true. Animate only a non-null `zzarit_event`. Server persists the once-per-participant receipt. Client local storage alone cannot establish eligibility. Lost response intentionally does not replay an event.
- Current reveal consent uses the existing connect-v1 record plus both first answers. A future post-answer separate consent and PARTIAL derivative require approved policy/storage contracts; do not imply that ceremony is already implemented.
- KEY/Mission/Reward/Reputation/Together Exit contracts are proposals, not callable persisted endpoints. Never synthesize balances, completion, reward, trust or deletion state in local storage.
- Rescue/FATIGUE/SKIP/STOP remain action semantics. Confirmed direct/corrected facts only may enter matching; AI inferred facts and fortune output remain excluded.

No frontend files were changed. Draft integration must run browser-level network/DOM/cache privacy checks after wiring these contracts; actual API E2E is not browser evidence.
