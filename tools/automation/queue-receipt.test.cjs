// Mock-only checks for the completion receipt: worker run completed -> API-verified handoff -> REVIEW. No network, no real gh.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./queue-adapter-cli.cjs');
const { memoryStore } = require('./queue-adapter.cjs');

const S1 = 'a'.repeat(40), S2 = 'b'.repeat(40), REPO = 'o/r';
const OWNER = { login: 'founder94', type: 'User' };
const BOT = 'github-actions[bot]';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qrc-'));
const ev = o => { const f = path.join(tmp(), 'e.json'); fs.writeFileSync(f, JSON.stringify(o)); return f; };
const ENV = { GITHUB_REPOSITORY: REPO, QUEUE_WORKER_WORKFLOW: 'queue-worker-receiver.yml' };
const wfEv = (id = 99) => ({ repository: { full_name: REPO }, workflow_run: { id } });
const prInfo = (over = {}) => ({ headSha: S2, branch: 'work/x', state: 'open', draft: false, base: 'main', headRepo: REPO, ...over });
const goodRun = (over = {}) => ({ id: 99, path: '.github/workflows/queue-worker-receiver.yml', event: 'workflow_dispatch', status: 'completed', conclusion: 'success', attempt: 1,
  headBranch: 'main', repo: REPO, headRepo: REPO, startedAt: '2026-10-03T21:00:00Z', updatedAt: '2026-10-03T21:10:00Z', ...over });
const handoff = (sha = S2, over = {}) => ({ id: 555, login: BOT, type: 'Bot', createdAt: '2026-10-03T21:09:00Z', body: `<!-- echo-handoff to=codex sha=${sha} round=1 -->\nbody`, ...over });

// queue with task t1 started (outbox START claimed by receiver run 99-1)
function claimed() {
  const s = memoryStore({ tasks: [] });
  run(['init', ev({ repository: { full_name: REPO }, sender: OWNER, inputs: { tasks: JSON.stringify([{ id: 't1', ref: 'pr:7', owner: OWNER }]) } }), 'i'], ENV, s);
  run(['workflow_dispatch', ev({ repository: { full_name: REPO }, sender: OWNER }), 'd1'], ENV, s);
  { const { rev, state } = s.load(); state.outbox[0].status = 'DISPATCHING'; assert.ok(s.save(rev, state)); }
  const v = run(['verify-dispatch'], { ...ENV, DQ_KEY: 'START:t1', DQ_ACTION: 'START', DQ_TASK_ID: 't1', DQ_REF: 'pr:7', DQ_SHA: '', ACTOR: BOT, TRIGGERING_ACTOR: BOT, CLAIM_ID: '99-1' }, s, undefined, { getPr: () => prInfo({ headSha: S1 }) });
  assert.strictEqual(v.code, 0);
  return s;
}
const rc = (s, deps, id = 99) => run(['receipt', ev(wfEv(id))], ENV, s, undefined, { getRun: () => goodRun(), getPr: () => prInfo(), listComments: () => [handoff()], ...deps });
const task = s => s.load().state.tasks[0];

test('happy path: verified completion + handoff on the current head => REVIEW saved once; duplicate receipt is a no-op', () => {
  const s = claimed();
  const r = rc(s);
  assert.strictEqual(r.code, 0); assert.strictEqual(r.out.action, 'REVIEW');
  assert.strictEqual(task(s).state, 'REVIEW'); assert.strictEqual(task(s).headSha, S2);
  assert.strictEqual(s.load().state.outbox[0].receipt.commentId, 555);
  const again = rc(s); // same run replayed
  assert.strictEqual(again.out.reason, 'duplicate_receipt'); assert.strictEqual(task(s).state, 'REVIEW');
});

test('ids written in the event/comment text are never trusted: claim must come from CAS state; other run / attempt / path / event / branch refused', () => {
  const cases = [
    [{ getRun: () => goodRun({ id: 100 }) }, 100, 'no_claim_for_run'],      // past/other run: no verify-dispatch claim
    [{ getRun: () => goodRun({ attempt: 2 }) }, 99, 'no_claim_for_run'],    // re-run attempt was never claimed
    [{ getRun: () => goodRun({ path: '.github/workflows/evil.yml' }) }, 99, 'not_receiver_run'],
    [{ getRun: () => goodRun({ event: 'issue_comment' }) }, 99, 'not_receiver_run'],
    [{ getRun: () => goodRun({ headBranch: 'feature' }) }, 99, 'not_receiver_run'],
    [{ getRun: () => goodRun({ headRepo: 'evil/r' }) }, 99, 'not_receiver_run'],
    [{ getRun: () => goodRun({ id: 5 }) }, 99, 'not_receiver_run'],         // API answer differs from the requested run id
    [{ getRun: () => goodRun({ status: 'in_progress' }) }, 99, 'run_not_completed'],
  ];
  for (const [deps, id, reason] of cases) {
    const s = claimed(); const r = rc(s, deps, id);
    assert.strictEqual(r.out.reason, reason); assert.strictEqual(task(s).state, 'RUNNING');
  }
  const s = claimed();
  assert.strictEqual(run(['receipt', ev({ repository: { full_name: 'evil/r' }, workflow_run: { id: 99 } })], ENV, s, undefined, {}).out.reason, 'repo_mismatch');
  assert.strictEqual(task(s).state, 'RUNNING');
});

test('worker failure / cancelled run => no REVIEW, exit 3 (needs a human)', () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', null]) {
    const s = claimed(); const r = rc(s, { getRun: () => goodRun({ conclusion }) });
    assert.strictEqual(r.code, 3); assert.strictEqual(r.out.reason, 'worker_failed'); assert.strictEqual(task(s).state, 'RUNNING');
  }
});

test('missing / deleted / forged / late handoff => REVIEW saved 0', () => {
  const cases = {
    deleted: [],
    founder_forged: [handoff(S2, { login: 'founder94', type: 'User' })],
    wrong_bot_type: [handoff(S2, { type: 'User' })],
    stranger_bot: [handoff(S2, { login: 'dependabot[bot]' })],
    late_sha: [handoff(S1)],                                  // handoff for an older head than the PR's current head
    before_run: [handoff(S2, { createdAt: '2026-10-03T20:00:00Z' })],
    after_run: [handoff(S2, { createdAt: '2026-10-03T22:00:00Z' })],
    bad_marker: [handoff(S2, { body: `x <!-- echo-handoff to=codex sha=${S2} round=1 -->` })],
  };
  for (const [name, list] of Object.entries(cases)) {
    const s = claimed(); const r = rc(s, { listComments: () => list });
    assert.strictEqual(r.out.reason, 'no_valid_handoff', name); assert.strictEqual(r.code, 3, name);
    assert.strictEqual(task(s).state, 'RUNNING', name);
  }
});

test('other PR: comments are read only from the claimed entry PR; closed/foreign PR refused', () => {
  const s = claimed(); let asked;
  assert.strictEqual(rc(s, { listComments: (repo, n) => { asked = n; return [handoff()]; } }).out.action, 'REVIEW');
  assert.strictEqual(asked, 7);
  for (const over of [{ state: 'closed' }, { headRepo: 'evil/r' }]) {
    const t = claimed(); assert.strictEqual(rc(t, { getPr: () => prInfo(over) }).out.reason, 'pr_not_eligible'); assert.strictEqual(task(t).state, 'RUNNING');
  }
});

test('lookup failures fail closed: exit 1, nothing saved, no token in output', () => {
  for (const deps of [{ getRun: () => { throw new Error('TOKEN123'); } }, { getPr: () => { throw new Error('TOKEN123'); } }, { listComments: () => { throw new Error('TOKEN123'); } }]) {
    const s = claimed(); const r = rc(s, deps);
    assert.strictEqual(r.code, 1); assert.ok(!JSON.stringify(r).includes('TOKEN123')); assert.strictEqual(task(s).state, 'RUNNING');
  }
});

test('CAS: a replayed handoff comment (same id) after FIX cannot move the task back to REVIEW; round cap still applies', () => {
  const s = claimed(); rc(s);
  const { rev, state } = s.load(); state.tasks[0].state = 'FIX'; state.tasks[0].rounds = 1; // Codex failed it; a later FIX claim for run 120
  state.outbox.push({ key: 'FIX:t1:1', action: 'FIX', taskId: 't1', ref: 'pr:7', sha: S2, round: 1, status: 'DONE', attempts: 1, workerClaim: { id: '120-1', actor: BOT } });
  assert.ok(s.save(rev, state));
  const r = run(['receipt', ev(wfEv(120))], ENV, s, undefined, { getRun: () => goodRun({ id: 120 }), getPr: () => prInfo(), listComments: () => [handoff(S2)] });
  assert.strictEqual(r.out.reason, 'no_valid_handoff'); // FIX handoff must be on a NEW head (sha != the FIX source)
  assert.strictEqual(task(s).state, 'FIX');
  const S3 = 'c'.repeat(40);
  const ok = run(['receipt', ev(wfEv(120))], ENV, s, undefined, { getRun: () => goodRun({ id: 120 }), getPr: () => prInfo({ headSha: S3 }), listComments: () => [handoff(S3, { id: 556 })] });
  assert.strictEqual(ok.out.action, 'REVIEW'); assert.strictEqual(task(s).headSha, S3);
  // same comment id replayed under a new delivery (rerun) is deduplicated by seenEvents
  const { rev: r2, state: st2 } = s.load(); st2.tasks[0].state = 'FIX'; st2.outbox.push({ key: 'FIX:t1:2', action: 'FIX', taskId: 't1', ref: 'pr:7', sha: S2, round: 2, status: 'DONE', attempts: 1, workerClaim: { id: '121-1', actor: BOT } }); assert.ok(s.save(r2, st2));
  const rep = run(['receipt', ev(wfEv(121))], ENV, s, undefined, { getRun: () => goodRun({ id: 121 }), getPr: () => prInfo({ headSha: S3 }), listComments: () => [handoff(S3, { id: 556 })] });
  assert.strictEqual(rep.out.reason, 'duplicate_event'); assert.strictEqual(task(s).state, 'FIX');
});

test('halted queue and wrong task state are ignored', () => {
  const s = claimed(); { const { rev, state } = s.load(); state.halted = true; s.save(rev, state); }
  assert.strictEqual(rc(s).out.reason, 'halted');
  const t = claimed(); { const { rev, state } = t.load(); state.tasks[0].state = 'REVIEW'; t.save(rev, state); }
  assert.strictEqual(rc(t).out.reason, 'task_state');
});
