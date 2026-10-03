// Pure unattended-queue controller (isolated: no I/O, no GitHub/network/model calls, not wired into any workflow).
// States: READY -> RUNNING -> REVIEW -> (FAIL) FIX -> REVIEW ... | (PASS) DONE -> next READY | BLOCKED/limit -> halted.
// Review text is never read here; only verified event metadata (actor, id, sha, verdict) is input.
const CODEX = 'chatgpt-codex-connector[bot]';
const WORKERS = [{ login: 'claude[bot]', type: 'Bot' }, { login: 'github-actions[bot]', type: 'Bot' }];
const ACTIVE = ['RUNNING', 'REVIEW', 'FIX'];
const DEFAULT_MAX_ROUNDS = 5;

const stop = (queue, reason) => ({ action: 'STOP', reason, queue: { ...queue, halted: true, haltReason: reason } });
const ignore = (queue, reason) => ({ action: 'IGNORE', reason, queue });
const withTask = (queue, id, patch) => ({ ...queue, tasks: queue.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) });

function promote(queue, owner) {
  if (queue.tasks.some(t => ACTIVE.includes(t.state))) return ignore(queue, 'concurrent_owner');
  const next = queue.tasks.find(t => t.state === 'READY');
  if (!next) return { action: 'IDLE', reason: 'no_task', queue };
  return { action: 'START', reason: 'ready_promoted', taskId: next.id, queue: withTask(queue, next.id, { state: 'RUNNING', owner: owner || 'actions' }) };
}

// event: {type:'start'|'submit'|'review', id?, actor?:{login,type}, taskId?, sha?, verdict?:'PASS'|'FAIL'|'BLOCKED'}
// Contract: start/submit come from the worker side and are accepted only from WORKERS (actor allowlist);
// review is accepted only from CODEX. The adapter must pass the actor taken from the verified GitHub event,
// never from comment text. A missing/unknown actor is refused (fail closed).
const isWorker = a => !!a && WORKERS.some(w => w.login === a.login && w.type === a.type);
const validMax = m => Number.isInteger(m) && m >= 1 && m <= DEFAULT_MAX_ROUNDS; // finite, positive, never above approved 5

function step(queue, event, config = {}) {
  if (!queue || !Array.isArray(queue.tasks)) return { action: 'STOP', reason: 'invalid_queue', queue };
  if (!config || typeof config !== 'object' || (config.maxRounds !== undefined && !validMax(config.maxRounds))) return stop(queue, 'invalid_config');
  const max = config.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (queue.halted) return ignore(queue, 'halted');
  if ((event?.type === 'start' || event?.type === 'submit') && !isWorker(event.actor)) return ignore(queue, 'unauthorized_actor');
  if (event?.type === 'start') return promote(queue, event.owner);
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
  if (event.actor?.login !== CODEX || event.actor.type !== 'Bot') return ignore(queue, 'unauthorized_actor');
  if ((queue.seenEvents || []).includes(event.id)) return ignore(queue, 'duplicate_event');
  const t = queue.tasks.find(x => x.id === event.taskId);
  if (!t) return ignore(queue, 'unknown_task');
  if (t.state !== 'REVIEW') return ignore(queue, 'bad_state');
  if (event.sha !== t.headSha) return ignore(queue, 'stale_sha'); // stale event is not recorded as seen
  const q = { ...queue, seenEvents: [...(queue.seenEvents || []), event.id] };
  if (event.verdict === 'BLOCKED') return stop(withTask(q, t.id, { state: 'BLOCKED' }), 'blocked');
  if (event.verdict === 'PASS') {
    const r = promote(withTask(q, t.id, { state: 'DONE' }), t.owner);
    return r.action === 'IDLE' ? { ...r, reason: 'pass_no_more_tasks' } : r;
  }
  if (event.verdict === 'FAIL') {
    const rounds = (t.rounds || 0) + 1;
    if (rounds >= max) return stop(withTask(q, t.id, { state: 'BLOCKED', rounds }), 'round_limit');
    return { action: 'FIX', reason: 'fail_fix', taskId: t.id, round: rounds, queue: withTask(q, t.id, { state: 'FIX', rounds }) };
  }
  return ignore(queue, 'bad_verdict');
}
module.exports = { step, CODEX, WORKERS, DEFAULT_MAX_ROUNDS };
