// Pure unattended-queue controller (isolated: no I/O, no GitHub/network/model calls, not wired into any workflow).
// States: READY -> RUNNING -> REVIEW -> (FAIL) FIX -> REVIEW ... | (PASS) DONE -> next READY | BLOCKED/limit -> halted.
// Review text is never read here; only verified event metadata (actor, id, sha, verdict) is input.
const { gateDecision } = require('./queue-security-gate.cjs');
const CODEX = 'chatgpt-codex-connector[bot]';
const WORKERS = [{ login: 'claude[bot]', type: 'Bot' }, { login: 'github-actions[bot]', type: 'Bot' }];
const ACTIVE = ['RUNNING', 'REVIEW', 'FIX'];
const DEFAULT_MAX_ROUNDS = 5;

const stop = (queue, reason) => ({ action: 'STOP', reason, queue: { ...queue, halted: true, haltReason: reason } });
const ignore = (queue, reason) => ({ action: 'IGNORE', reason, queue });
const withTask = (queue, id, patch) => ({ ...queue, tasks: queue.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) });

// gate (config.securityGate, default OFF): READY tasks the pre-experiment gate denies become BLOCKED (structured reason only, no halt)
// and are skipped; the next approved READY task (e.g. an unrelated development task) may still start under the same single-owner order.
function promote(queue, owner, gate) {
  if (queue.tasks.some(t => ACTIVE.includes(t.state))) return ignore(queue, 'concurrent_owner');
  let q = queue, blocked = false;
  for (const t of queue.tasks.filter(x => x.state === 'READY')) {
    const g = gate ? gateDecision(t) : { ok: true };
    if (!g.ok) { q = withTask(q, t.id, { state: 'BLOCKED', gateReason: g.reason }); blocked = true; continue; }
    return { action: 'START', reason: 'ready_promoted', taskId: t.id, queue: withTask(q, t.id, { state: 'RUNNING', owner: owner || 'actions' }) };
  }
  return { action: 'IDLE', reason: blocked ? 'gate_blocked' : 'no_task', queue: q };
}

// event: {type:'start'|'submit'|'review', id?, actor?:{login,type}, taskId?, sha?, verdict?:'PASS'|'FAIL'|'BLOCKED'}
// Contract: start/submit come from the worker side and are accepted only from WORKERS (actor allowlist);
// review is accepted only from CODEX. The adapter must pass the actor taken from the verified GitHub event,
// never from comment text. A missing/unknown actor is refused (fail closed).
const isWorker = a => !!a && WORKERS.some(w => w.login === a.login && w.type === a.type);
// Start by the real owner: actor (verified payload sender, a User) is the approver; the Bot that runs the work is the separate event.worker field.
const OWNER = { login: 'founder94', type: 'User' };
const isOwnerStart = e => !!e.actor && e.actor.login === OWNER.login && e.actor.type === OWNER.type && !!e.approver && e.approver.login === e.actor.login && e.approver.type === e.actor.type && isWorker(e.worker);
const validMax = m => Number.isInteger(m) && m >= 1 && m <= DEFAULT_MAX_ROUNDS; // finite, positive, never above approved 5

function step(queue, event, config = {}) {
  if (!queue || !Array.isArray(queue.tasks)) return { action: 'STOP', reason: 'invalid_queue', queue };
  if (!config || typeof config !== 'object' || (config.maxRounds !== undefined && !validMax(config.maxRounds))) return stop(queue, 'invalid_config');
  const max = config.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (queue.halted) return ignore(queue, 'halted');
  if (event?.type === 'submit' && !isWorker(event.actor)) return ignore(queue, 'unauthorized_actor');
  if (event?.type === 'start' && !isWorker(event.actor) && !isOwnerStart(event)) return ignore(queue, 'unauthorized_actor');
  if (event?.type === 'start') return promote(queue, event.owner, config.securityGate === true);
  if (event?.type === 'submit') {
    // worker pushed a new head: RUNNING|FIX -> REVIEW
    const t = queue.tasks.find(x => x.id === event.taskId);
    if (!t) return ignore(queue, 'unknown_task');
    if (!['RUNNING', 'FIX'].includes(t.state)) return ignore(queue, 'bad_state');
    if (!/^[a-f0-9]{40}$/.test(event.sha || '')) return ignore(queue, 'bad_sha');
    if (event.id !== undefined && (queue.seenEvents || []).includes(event.id)) return ignore(queue, 'duplicate_event'); // replayed handoff
    // handoff cap: initial submit is handoff 1, each FAIL (rounds) consumed one; never schedule beyond max
    if ((t.rounds || 0) >= max) return stop(withTask(queue, t.id, { state: 'BLOCKED' }), 'round_limit');
    const q = event.id === undefined ? queue : { ...queue, seenEvents: [...(queue.seenEvents || []), event.id] };
    return { action: 'REVIEW', reason: 'submitted', taskId: t.id, queue: withTask(q, t.id, { state: 'REVIEW', headSha: event.sha }) };
  }
  if (event?.type !== 'review') return ignore(queue, 'unknown_event');
  // Opt-in (default OFF) reviewer principal: a real User explicitly approved in config.reviewerPrincipal (never from event/comment text).
  // It is a separate role, not the Codex Bot: GitHub author alone cannot prove Codex origin, and the account may equal the owner.
  // So it may only stop work (FAIL/BLOCKED); its PASS is never promoted to DONE and halts as BLOCKED.
  const rp = config.reviewerPrincipal;
  const isPrincipal = !!rp && rp.type === 'User' && typeof rp.login === 'string' && event.actor?.type === 'User' && event.actor.login === rp.login;
  const isCodex = event.actor?.login === CODEX && event.actor.type === 'Bot';
  if (!isCodex && !isPrincipal) return ignore(queue, 'unauthorized_actor');
  if (!isCodex && event.verdict === 'PASS') event = { ...event, verdict: 'BLOCKED', principalPass: true };
  if ((queue.seenEvents || []).includes(event.id)) return ignore(queue, 'duplicate_event');
  const t = queue.tasks.find(x => x.id === event.taskId);
  if (!t) return ignore(queue, 'unknown_task');
  if (t.state !== 'REVIEW') return ignore(queue, 'bad_state');
  if (event.sha !== t.headSha) return ignore(queue, 'stale_sha'); // stale event is not recorded as seen
  const q = { ...queue, seenEvents: [...(queue.seenEvents || []), event.id] };
  if (event.verdict === 'BLOCKED') return stop(withTask(q, t.id, { state: 'BLOCKED' }), event.principalPass ? 'reviewer_pass_unproven' : 'blocked');
  if (event.verdict === 'PASS') {
    const r = promote(withTask(q, t.id, { state: 'DONE' }), t.owner, config.securityGate === true);
    return r.action === 'IDLE' && r.reason === 'no_task' ? { ...r, reason: 'pass_no_more_tasks' } : r;
  }
  if (event.verdict === 'FAIL') {
    const rounds = (t.rounds || 0) + 1;
    if (rounds >= max) return stop(withTask(q, t.id, { state: 'BLOCKED', rounds }), 'round_limit');
    return { action: 'FIX', reason: 'fail_fix', taskId: t.id, round: rounds, queue: withTask(q, t.id, { state: 'FIX', rounds }) };
  }
  return ignore(queue, 'bad_verdict');
}
module.exports = { step, CODEX, WORKERS, DEFAULT_MAX_ROUNDS };
