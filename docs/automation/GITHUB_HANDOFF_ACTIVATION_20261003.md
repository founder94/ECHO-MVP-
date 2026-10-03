# ECHO GitHub handoff: activation boundary
Version: 2026-10-03 revision 2. PR104 is a draft, not live automation.

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
- Codex background executor/authentication/account entitlement.
- An event-based wake-up for this ChatGPT/Codex conversation.
- Durable per-PR queue and atomic execution/cost reservations.
Do not merge and advertise a complete unattended company from this draft.

## Minimum decision for the full loop
Recommended: separate GitHub review executor for Codex, distinct from this chat.
Use an approved existing authentication mechanism if one is actually available.
If API authentication is chosen, a dedicated review-only key must be registered
through the service settings, never chat/PR/logs. Do not reuse the product/AB-test key
without explicit approval for the new purpose.
No new secret, model or paid run has been authorized by this draft.

The representative must decide the approved authentication route, exact model,
per-run and daily monetary ceiling before paid activation. Money unknown is null,
not zero. Stop on unknown rates or budget exhaustion. Use at most three fix/review
rounds per source lineage, one active implementation per PR, bounded request time.
A source change invalidates a queued review; a duplicate event must not call a model.

## Recovery
Before activation retain the previous main workflow commit and disable the new
executor switch. Reverting workflow code does not cancel active jobs, undo comments,
recover transmitted data, or refund paid calls. Cancel active jobs separately.
No DB, PROD, automatic merge or QA deploy is part of this proposal.
