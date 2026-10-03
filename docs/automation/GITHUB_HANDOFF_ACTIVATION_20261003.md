# ECHO GitHub handoff: activation boundary
Version: 2026-10-03 revision 3. PR104 is a draft, not live automation.

## Confirmed
- Codex can read/write this repository through the connected GitHub MCP.
- Existing main Claude Code Action runs when a comment mentions Claude.
- Runs 37107592740 and 37107847111 returned actual Claude replies.
- PR104 now restricts its proposed path to read-only review.
- Codex cannot be assumed to wake when Claude posts a reply.

## Roles
Claude implements product files it owns. Codex independently reviews exact commits.
GitHub records request, source, ownership, results and next owner.
Only one actor integrates or deploys the shared QA target.
Do not share ownership of a live workflow or product file without explicit transfer.

## Proposed review path
Trusted owner posts an explicit handoff on a same-repository open main/echo-qa PR.
Preflight checks source, records the request id and rejects unsupported targets.
Comment-specific job grouping avoids cancellation from unrelated comments.
The Claude review path denies shell, edits, delegation and file-operation MCP.
It may inspect files and return findings; it does not implement or execute tests.
Implementation is a distinct capability and is not secretly re-enabled by a review prompt.

## Still NOT VERIFIED
- Action-generated token rights and all MCP deny-list enforcement.
- Action internal checkout preserving the requested SHA throughout execution.
- New workflow actual execution and handling interrupted jobs.
- Actual local Codex worker startup and Claude Stop-hook execution.
- An event-based wake-up for this ChatGPT/Codex conversation.
- Durable per-PR queue and atomic execution/cost reservations.
Do not merge and advertise a complete unattended company from this draft.

## Bounded local fix/review loop (implemented, OFF)
Files: .claude/hooks/echo-review-gate.mjs, its test file,
.claude/echo-review-gate.json and .claude/settings.json.
This is distinct from the review-only GitHub workflow.
Claude's Stop hook asks the existing Codex CLI to review the preserved source.
FAIL blocks completion and asks Claude to fix findings in its authorized owned files.
PASS approves only the reviewed source fingerprint. HOLD stops the task.
At most three reviews per Claude session, 45 seconds per worker; attempts are reserved
before sending. Changed source invalidates approval. Duplicate approved source does
not call again. Unknown usage is not a zero monetary cost.
Do not enable the stock plugin's unbounded Stop gate alongside this bounded gate.

Mock verification: node --test --test-isolation=none echo-review-gate.test.mjs,
11/11 PASS, exit 0. An independent reviewer reproduced two issues (nested working
directory scope and corrupt attempt counts); both were fixed and rechecked.
These are mocked worker tests, not actual Claude/Codex model execution.

## Actual execution obstacle
Existing Codex login status reports authenticated using ChatGPT. No keys or auth
files were read, copied or changed. A missing key is not the diagnosed obstacle.
Actual Codex exec exits 1: failed to initialize in-process app-server client:
Read-only file system (os error 30).
The runtime CODEX_HOME is read-only and its installation_id is absent.
The upstream startup implementation creates this metadata before starting.
A narrowly scoped filesystem write grant was attempted; exec still failed with
the same error. A grant does not make the backing runtime filesystem writable.
No model worker is running. The local gate is OFF and is not installed in the
representative's separate Claude Code session by this draft.
Required next step: use a supported writable Codex runtime with the existing
approved login, then execute one bounded Claude Stop-hook integration test.
Do not modify authentication, copy credentials, bypass protection or claim activation.
GitHub comments can start a separate Claude Action; they do not control the
representative's already-open Claude Code session or wake this chat automatically.

## Recovery
Before activation retain the previous main workflow commit and disable the new
executor switch. Reverting workflow code does not cancel active jobs, undo comments,
recover transmitted data, or refund paid calls. Cancel active jobs separately.
No DB, PROD, automatic merge or QA deploy is part of this proposal.
