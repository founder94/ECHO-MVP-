// Mock-only checks: sender-actor preservation, drain -> workflow_dispatch wiring (fake `gh` on PATH, no network), receiver verify-dispatch gate.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./queue-adapter-cli.cjs');
const { normalize, memoryStore } = require('./queue-adapter.cjs');
const { initQueue } = require('./queue-exec.cjs');

const S1 = 'a'.repeat(40), S2 = 'b'.repeat(40), REPO = 'o/r';
const OWNER = { login: 'founder94', type: 'User' };
const BOT = 'github-actions[bot]';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
const ev = o => { const f = path.join(tmp(), 'e.json'); fs.writeFileSync(f, JSON.stringify(o)); return f; };
const ENV = { GITHUB_REPOSITORY: REPO, QUEUE_WORKER_WORKFLOW: 'queue-worker-receiver.yml' };
const startEv = { repository: { full_name: REPO }, sender: OWNER };
const initEv = { repository: { full_name: REPO }, sender: OWNER, inputs: { tasks: JSON.stringify([{ id: 't1', ref: 'pr:7', owner: OWNER }]) } };
const started = () => { const s = memoryStore({ tasks: [] }); run(['init', ev(initEv), 'i'], ENV, s); run(['workflow_dispatch', ev(startEv), 'd1'], ENV, s); return s; };
const pr = (over = {}) => ({ headSha: S1, branch: 'work/x', state: 'open', draft: false, base: 'main', headRepo: REPO, ...over });
const vEnv = (over = {}) => ({ ...ENV, DQ_KEY: 'START:t1', DQ_ACTION: 'START', DQ_TASK_ID: 't1', DQ_REF: 'pr:7', DQ_SHA: '', ACTOR: BOT, TRIGGERING_ACTOR: BOT, CLAIM_ID: '99-1', ...over });
const claimable = s => { const { rev, state } = s.load(); state.outbox[0].status = 'DISPATCHING'; assert.ok(s.save(rev, state)); };

test('normalize keeps the real sender User as actor; worker Bot is a separate field; real orig repro', () => {
  const ev1 = normalize('workflow_dispatch', { sender: { login: 'founder94', type: 'User' } }, { tasks: [] }, { strict: true });
  assert.deepStrictEqual(ev1.actor, { login: 'founder94', type: 'User' });
  assert.deepStrictEqual(ev1.approver, ev1.actor);
  assert.deepStrictEqual(ev1.worker, { login: 'github-actions[bot]', type: 'Bot' });
  assert.strictEqual(normalize('workflow_dispatch', { sender: { login: 'founder94', type: 'Bot' } }, { tasks: [] }, { strict: true }).skip, 'start_not_by_owner');
});

test('controller: start needs owner User actor + approver + worker Bot; forged combinations are refused', () => {
  const { step } = require('./queue-controller.cjs');
  const q = { tasks: [{ id: 't', state: 'READY' }] };
  const W = { login: BOT, type: 'Bot' };
  assert.strictEqual(step(q, { type: 'start', actor: OWNER, approver: OWNER, worker: W }).action, 'START');
  for (const e of [{ actor: OWNER, approver: OWNER }, { actor: OWNER, worker: W }, { actor: { login: 'mallory', type: 'User' }, approver: { login: 'mallory', type: 'User' }, worker: W }, { actor: OWNER, approver: OWNER, worker: OWNER }])
    assert.strictEqual(step(q, { type: 'start', ...e }).reason, 'unauthorized_actor');
});

test('CLI drain default is wired to gh workflow run (fake gh on PATH, typed inputs only, no real call)', () => {
  const s = started(); const d = tmp(); const log = path.join(d, 'log');
  fs.writeFileSync(path.join(d, 'gh'), `#!/bin/sh\necho "$@" >> "${log}"\n`, { mode: 0o755 });
  const oldPath = process.env.PATH; process.env.PATH = `${d}:${oldPath}`;
  try {
    const r = run(['drain'], ENV, s, () => S1);
    assert.strictEqual(r.out.dispatched, 1);
  } finally { process.env.PATH = oldPath; }
  const line = fs.readFileSync(log, 'utf8');
  assert.match(line, /^workflow run queue-worker-receiver\.yml --repo o\/r --ref main -f key=START:t1 -f action=START -f task_id=t1 -f ref=pr:7/);
  assert.ok(!/comment/.test(line));
  assert.strictEqual(s.load().state.outbox[0].status, 'DONE');
  // no workflow configured => fails closed, nothing recorded as DONE
  const s2 = started();
  assert.strictEqual(run(['drain'], { GITHUB_REPOSITORY: REPO }, s2, () => S1).code, 3);
  assert.notStrictEqual(s2.load().state.outbox[0].status, 'DONE');
});

test('verify-dispatch accepts a claimed START (DISPATCHING) and also DONE (race), once only', () => {
  const s = started(); claimable(s);
  const r = run(['verify-dispatch'], vEnv(), s, undefined, { getPr: () => pr() });
  assert.strictEqual(r.code, 0); assert.strictEqual(r.out.branch, 'work/x'); assert.strictEqual(r.out.sha, S1);
  assert.strictEqual(s.load().state.outbox[0].workerClaim.id, '99-1');
  assert.strictEqual(run(['verify-dispatch'], vEnv({ CLAIM_ID: '100-1' }), s, undefined, { getPr: () => pr() }).out.reason, 'already_claimed');
  const s2 = started(); { const { rev, state } = s2.load(); state.outbox[0].status = 'DONE'; s2.save(rev, state); }
  assert.strictEqual(run(['verify-dispatch'], vEnv(), s2, undefined, { getPr: () => pr() }).code, 0);
  assert.strictEqual(s2.load().state.outbox[0].status, 'DONE'); // worker never changes dispatch status
});

test('verify-dispatch rejects forged inputs/actors, wrong state and unsafe PR; nothing claimed', () => {
  const cases = [
    [{ ACTOR: 'mallory', TRIGGERING_ACTOR: 'mallory' }, undefined, 'untrusted_actor'],
    [{ ACTOR: 'founder94', TRIGGERING_ACTOR: BOT }, undefined, 'untrusted_actor'],
    [{ DQ_KEY: 'START:zz' }, undefined, 'no_outbox_entry'],
    [{ DQ_REF: 'pr:8' }, undefined, 'entry_mismatch'],
    [{ DQ_TASK_ID: 't2' }, undefined, 'entry_mismatch'],
    [{ DQ_SHA: S1 }, undefined, 'entry_mismatch'],
    [{ DQ_ACTION: 'FIX', DQ_SHA: S1 }, undefined, 'entry_mismatch'],
    [{ DQ_REF: 'pr:7; rm' }, undefined, 'bad_input'],
    [{ CLAIM_ID: '' }, undefined, 'bad_claim_id'],
    [{}, pr({ state: 'closed' }), 'pr_not_eligible'],
    [{}, pr({ draft: true }), 'pr_not_eligible'],
    [{}, pr({ base: 'prod' }), 'pr_not_eligible'],
    [{}, pr({ headRepo: 'evil/r' }), 'pr_not_eligible'],
    [{}, pr({ branch: '-x' }), 'pr_not_eligible'],
  ];
  for (const [over, p, reason] of cases) {
    const s = started(); claimable(s);
    const r = run(['verify-dispatch'], vEnv(over), s, undefined, { getPr: () => p || pr() });
    assert.strictEqual(r.out.reason, reason, JSON.stringify(over)); assert.strictEqual(r.code, 4);
    assert.ok(!s.load().state.outbox[0].workerClaim);
  }
  const pend = started(); // PENDING (never claimed by drain) is not a dispatch
  assert.strictEqual(run(['verify-dispatch'], vEnv(), pend, undefined, { getPr: () => pr() }).out.reason, 'not_dispatched');
});

test('verify-dispatch: lookup failure => exit 1, no claim; FIX needs current head and round budget', () => {
  const s = started(); claimable(s);
  const r = run(['verify-dispatch'], vEnv(), s, undefined, { getPr: () => { throw new Error('boom TOKEN123'); } });
  assert.strictEqual(r.code, 1); assert.strictEqual(r.out.error, 'verify_lookup_failed'); assert.ok(!JSON.stringify(r).includes('TOKEN123'));
  assert.ok(!s.load().state.outbox[0].workerClaim);
  // FIX entry: head moved => stale_head; wrong task state => task_state
  const fx = () => ({ tasks: [{ id: 't1', ref: 'pr:7', state: 'FIX', rounds: 1, headSha: S1, worker: { login: BOT, type: 'Bot' }, approval: initQueue({ tasks: [{ id: 't1', ref: 'pr:7', owner: OWNER }] }, OWNER).state.tasks[0].approval }],
    outbox: [{ key: 'FIX:t1:1', action: 'FIX', taskId: 't1', ref: 'pr:7', sha: S1, round: 1, status: 'DISPATCHING', attempts: 1 }], deliveries: [], seenEvents: [], log: [] });
  const f = { DQ_KEY: 'FIX:t1:1', DQ_ACTION: 'FIX', DQ_SHA: S1 };
  const a = memoryStore(fx()); assert.strictEqual(run(['verify-dispatch'], vEnv(f), a, undefined, { getPr: () => pr({ headSha: S2 }) }).out.reason, 'stale_head');
  const b = memoryStore(fx()); assert.strictEqual(run(['verify-dispatch'], vEnv(f), b, undefined, { getPr: () => pr() }).code, 0);
  const c = fx(); c.tasks[0].rounds = 5; assert.strictEqual(run(['verify-dispatch'], vEnv(f), memoryStore(c), undefined, { getPr: () => pr() }).out.reason, 'fix_not_current');
  const d = fx(); d.tasks[0].state = 'REVIEW'; assert.strictEqual(run(['verify-dispatch'], vEnv(f), memoryStore(d), undefined, { getPr: () => pr() }).out.reason, 'task_state');
  const e = fx(); e.halted = true; assert.strictEqual(run(['verify-dispatch'], vEnv(f), memoryStore(e), undefined, { getPr: () => pr() }).out.reason, 'halted');
});
