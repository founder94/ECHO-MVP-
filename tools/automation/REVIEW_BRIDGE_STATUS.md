# Trusted Codex review bridge — not activated

Actual current main workflow rejects all Bot reviews and requires @claude. Actual Codex reviewer is chatgpt-codex-connector[bot]; its native review has neither the requested echo-review marker nor @claude. This prevents unattended review-to-fix execution.

Preserved verification: node --test --test-isolation=none tools/automation/review-gate.test.cjs; 13/13 mock PASS, exit 0. Covers exact bot, current SHA, same repository, explicit owner, duplicate review, five-round cap, actionable findings and API review confirmation. These tests do not run GitHub Actions, models or the full loop.

The persistent workflow write was rejected by automatic approval review due to security-sensitive write/id-token scope and automated code modification. No workflow change was applied. No merge, secret, product code, DB or deployment changed. Do not apply the blocked change indirectly.

Proposed exact scope for a new explicit decision: retain existing contents:write, pull-requests:write, issues:write, id-token:write, actions:read (no new permissions); accept only current reviews from the verified Codex bot; require owner comment [ECHO-AUTO-OWNER:actions] so active session and Actions do not both implement; minimally fix and test only the PR branch; retain five handoffs and existing STOP; Node22. No protected-branch push or automatic merge/deploy. This is not activated by this document.

Reverse direction Claude push/comment -> Codex App rerun remains unverified. No new PAT is assumed necessary. Existing PR103 fifth review must not be restarted or its counter reset. Runtime npm403 is a separate unresolved setup issue.

Rollback after any future separately approved activation: restore previous main workflow; cancel queued/running implementation jobs separately; do not claim reverting removes pushed commits, comments or transmitted data. Source tests are complete; activation and actual round-trip are not.
