// Verified-event adapter + persistent store around the pure queue controller (queue-controller.cjs).
// Not wired into any workflow. No network/model calls: raw GitHub payloads are passed in by the caller.
// Trust rules: actor comes ONLY from the payload's sender/user object (never comment text);
// verdict comes ONLY from a strict first-line echo-review marker written by the Codex bot and bound to the exact SHA;
// a Codex standard review body (no marker, "no findings", reactions) never becomes PASS.
const fs = require('node:fs');
const { step, CODEX, WORKERS } = require('./queue-controller.cjs');
const { isApprover, validateApproved, withOutbox } = require('./queue-exec.cjs');

const REVIEW_MARKER = /^<!-- echo-review from=codex sha=([a-f0-9]{40}) verdict=(PASS|FAIL|BLOCKED) -->(\r?\n|$)/;
const HANDOFF_MARKER = /^<!-- echo-handoff to=codex sha=([a-f0-9]{40}) round=\d+ -->(\r?\n|$)/;
const actorOf = u => (u && typeof u.login === 'string' && typeof u.type === 'string' ? { login: u.login, type: u.type } : undefined);
const ignored = (reason, queue) => ({ action: 'IGNORE', reason, queue });

// Turn a raw GitHub event into a controller event, or {skip: reason}. ref = "pr:<n>" | "issue:<n>" of the task.
// ctx: {strict, nativeFindings} — nativeFindings = number of VERIFIED Codex findings for this review (set only by the CLI after lookup).
function normalize(name, p, queue, ctx = {}) {
  if (!p || typeof p !== 'object') return { skip: 'bad_payload' };
  const refOf = o => (o ? `${p.pull_request ? 'pr' : 'issue'}:${o.number}` : undefined);
  const task = ref => (queue.tasks || []).find(t => t.ref === ref);
  if (name === 'pull_request_review' && p.action === 'submitted') {
    const m = REVIEW_MARKER.exec(p.review?.body || '');
    if (!m) {
      // Native Codex review (no marker): author + exact commit + completion metadata + verified findings only. Never PASS: findings => FAIL, none => BLOCKED.
      if (!Number.isInteger(ctx.nativeFindings) || ctx.nativeFindings < 0) return { skip: 'no_verdict_marker' };
      const sha = p.review?.commit_id, a = actorOf(p.review?.user);
      if (!/^[a-f0-9]{40}$/.test(sha || '') || !p.review.submitted_at || !a || a.login !== CODEX || a.type !== 'Bot') return { skip: 'native_not_trusted' };
      const t = task(refOf(p.pull_request)); if (!t) return { skip: 'unknown_task' };
      return { type: 'review', id: `review:${p.review.id}`, actor: a, taskId: t.id, sha, verdict: ctx.nativeFindings > 0 ? 'FAIL' : 'BLOCKED' };
    }
    if (m[1] !== p.review.commit_id) return { skip: 'marker_sha_mismatch' };
    const t = task(refOf(p.pull_request));
    if (!t) return { skip: 'unknown_task' };
    return { type: 'review', id: `review:${p.review.id}`, actor: actorOf(p.review.user), taskId: t.id, sha: m[1], verdict: m[2] };
  }
  if (name === 'issue_comment' && p.action === 'created') {
    const body = p.comment?.body || '';
    const t = task(`${p.issue?.pull_request ? 'pr' : 'issue'}:${p.issue?.number}`);
    if (!t) return { skip: 'unknown_task' };
    const r = REVIEW_MARKER.exec(body);
    if (r) return { type: 'review', id: `comment:${p.comment.id}`, actor: actorOf(p.comment.user), taskId: t.id, sha: r[1], verdict: r[2] };
    const h = HANDOFF_MARKER.exec(body);
    if (h) return { type: 'submit', id: `comment:${p.comment.id}`, actor: actorOf(p.comment.user), taskId: t.id, sha: h[1] };
    return { skip: 'no_marker' };
  }
  if (ctx.strict) {
    // start: approval by the real owner (payload sender, a User) is kept apart from the worker Bot identity that runs it.
    if (name !== 'workflow_dispatch') return { skip: 'unsupported_event' };
    if (!isApprover(actorOf(p.sender))) return { skip: 'start_not_by_owner' };
    return { type: 'start', actor: WORKERS[1], approver: actorOf(p.sender) };
  }
  if (name === 'workflow_dispatch' || name === 'workflow_run') return { type: 'start', actor: actorOf(p.sender) };
  return { skip: 'unsupported_event' };
}

// Stores expose load() -> {rev, state} and save(expectedRev, state) -> boolean (compare-and-swap, false = conflict).
function memoryStore(initial) {
  let cur = { rev: 0, state: initial };
  return { load: () => ({ rev: cur.rev, state: JSON.parse(JSON.stringify(cur.state)) }), save(exp, s) { if (exp !== cur.rev) return false; cur = { rev: cur.rev + 1, state: s }; return true; } };
}

// File store: O_EXCL lock file serializes the read-check-write; rename makes the write atomic.
function fileStore(path) {
  const lock = path + '.lock';
  return {
    load() { const j = JSON.parse(fs.readFileSync(path, 'utf8')); return { rev: j.rev, state: j.state }; },
    save(exp, s) {
      let fd; try { fd = fs.openSync(lock, 'wx'); } catch { return false; }
      try {
        if (JSON.parse(fs.readFileSync(path, 'utf8')).rev !== exp) return false;
        fs.writeFileSync(path + '.tmp', JSON.stringify({ rev: exp + 1, state: s }));
        fs.renameSync(path + '.tmp', path);
        return true;
      } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
    },
  };
}

// handle: verify -> step -> CAS save with bounded retry. deliveryId dedupes redelivered webhooks.
// Every processed delivery is appended to state.log (result record); duplicates/ignored events leave tasks untouched.
function handle(store, name, payload, deliveryId, config, retries = 3, ctx = {}) {
  const strict = !!(config && config.strict); // strict: only owner-approved tasks run; START/FIX/REVIEW also land in state.outbox (same CAS commit)
  for (let i = 0; i <= retries; i++) {
    const { rev, state } = store.load();
    if (!deliveryId) return ignored('no_delivery_id', state);
    if ((state.deliveries || []).includes(deliveryId)) return ignored('duplicate_delivery', state);
    const bad = strict && validateApproved(state); // fail closed: nothing unapproved ever runs
    const ev = bad ? { skip: bad } : normalize(name, payload, state, { ...ctx, strict });
    const r = ev.skip ? ignored(ev.skip, state) : step(state, ev, config);
    const next = { ...(strict ? withOutbox(r, WORKERS[1]) : r.queue), deliveries: [...(state.deliveries || []), deliveryId],
      log: [...(state.log || []), { delivery: deliveryId, event: ev.type || 'skip', action: r.action, reason: r.reason, taskId: r.taskId }] };
    if (store.save(rev, next)) return { ...r, queue: next };
  }
  return ignored('store_conflict', store.load().state); // fail closed: nothing applied
}
module.exports = { normalize, handle, memoryStore, fileStore, REVIEW_MARKER, HANDOFF_MARKER, CODEX };
