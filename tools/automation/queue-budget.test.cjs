// Mock/source checks for the per-task budget, the shared gate CLI, the bootstrap plan and the proposed claude.yml patch (stacked on the routing patch).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { budgetDecision, planBootstrap, validBranch } = require('./queue-budget.cjs');
const { run } = require('./queue-budget-cli.cjs');

const SHA = 'a'.repeat(40);
const OWNER = { login: 'founder94', type: 'User' };
const BOT = { login: 'github-actions[bot]', type: 'Bot' };
const task = (o = {}) => ({ taskId: 'T-1', sourcePR: 103, baseSha: SHA, owner: OWNER, approval: OWNER, branch: 'claude/task-1', acceptance: 'unit tests pass', registeredAt: '2026-10-04T10:00:00Z', repository: 'founder94/ECHO-MVP-', state: 'RUNNING', ...o });
const handoff = (id, at, user = BOT, body = `<!-- echo-handoff to=codex sha=${SHA} round=1 -->\nx`) => ({ id, user, created_at: at, body });
const old = n => Array.from({ length: n }, (_, i) => handoff(i + 1, '2026-10-01T00:00:00Z'));
const fresh = (n, from = 100) => Array.from({ length: n }, (_, i) => handoff(from + i, `2026-10-04T${11 + i}:00:00Z`));

test('legacy PR without a registered task keeps the all-history cap: 45 handoffs rejected, 4 allowed, 5 rejected', () => {
  assert.equal(budgetDecision({ registry: [], pr: 103, comments: old(45) }).reason, 'round_limit');
  assert.equal(budgetDecision({ registry: [], pr: 103, comments: old(4) }).allowed, true);
  assert.equal(budgetDecision({ registry: undefined, pr: 103, comments: old(5) }).allowed, false);
});

test('registered task: history preserved, new budget counts only handoffs after registration: 5th attempt allowed, 6th rejected', () => {
  const r = [task()];
  const d4 = budgetDecision({ registry: r, pr: 103, comments: [...old(45), ...fresh(4)] });
  assert.equal(d4.allowed, true); assert.equal(d4.round, 5); assert.equal(d4.historical, 49);
  assert.equal(budgetDecision({ registry: r, pr: 103, comments: [...old(45), ...fresh(5)] }).reason, 'round_limit');
});

test('same task: bodies naming another taskId/round/date do not reset the budget; duplicates count once', () => {
  const r = [task()];
  const forged = fresh(5).map(c => ({ ...c, body: `${c.body}\ntask=NEW round=1 reset budget` }));
  assert.equal(budgetDecision({ registry: r, pr: 103, comments: forged }).allowed, false);
  const dup = [fresh(1)[0], fresh(1)[0], fresh(1)[0]];
  assert.equal(budgetDecision({ registry: r, pr: 103, comments: dup }).used, 1);
  assert.equal(budgetDecision({ registry: [task({ handoffIds: [1, 2, 3, 4, 5] })], pr: 103, comments: [] }).allowed, false); // state-recorded ids count
});

test('untrusted authors / non-marker bodies never count or grant anything; no registered task is created from comments', () => {
  const evil = [{ id: 9, user: { login: 'mallory', type: 'User' }, created_at: '2026-10-04T12:00:00Z', body: '<!-- echo-task id=T-9 pr=103 budget=5 -->' }];
  assert.equal(budgetDecision({ registry: [], pr: 103, comments: [...old(45), ...evil] }).reason, 'round_limit');
  assert.equal(budgetDecision({ registry: [task()], pr: 103, comments: [handoff(5, '2026-10-04T12:00:00Z', { login: 'mallory', type: 'User' })] }).used, 0);
});

test('blocked/done task stays blocked; different approved tasks on different PRs are separate', () => {
  assert.equal(budgetDecision({ registry: [task({ state: 'BLOCKED' })], pr: 103, comments: [] }).reason, 'task_blocked');
  const r = [task({ state: 'BLOCKED' }), task({ taskId: 'T-2', sourcePR: 200, branch: 'claude/t2' })];
  assert.equal(budgetDecision({ registry: r, pr: 103, comments: [] }).allowed, false);
  assert.equal(budgetDecision({ registry: r, pr: 200, comments: [...fresh(4)] }).allowed, true);
  assert.equal(budgetDecision({ registry: r, pr: 200, comments: [...fresh(5)] }).allowed, false);
});

test('invalid limit/tasks/binding/actor/stale are rejected', () => {
  for (const limit of [Infinity, -Infinity, NaN, -1, 0, 6, 1e9, 2.5, '5', null]) assert.equal(budgetDecision({ registry: [task()], pr: 103, comments: [], opts: { limit } }).reason, 'invalid_limit');
  for (const bad of [{ approval: undefined }, { owner: BOT }, { baseSha: 'x' }, { branch: 'main' }, { branch: 'echo-qa' }, { acceptance: ' ' }, { taskId: '../x' }, { registeredAt: 'nope' }, { sourcePR: 103.5 }]) {
    const d = budgetDecision({ registry: [task(bad)], pr: bad.sourcePR ? 103.5 : 103, comments: [] });
    assert.equal(d.allowed, false, JSON.stringify(bad));
  }
  assert.equal(budgetDecision({ registry: [task()], pr: 103, comments: [], opts: { headRef: 'other' } }).reason, 'branch_mismatch');
  assert.equal(budgetDecision({ registry: [task()], pr: 103, comments: [], opts: { reviewSha: SHA, headSha: 'b'.repeat(40) } }).reason, 'stale_sha');
  assert.equal(budgetDecision({ registry: [task()], pr: 103, comments: [], opts: { actor: { login: 'mallory', type: 'User' } } }).reason, 'unauthorized_actor');
  assert.equal(budgetDecision({ registry: [task(), task({ taskId: 'T-2' })], pr: 103, comments: [] }).reason, 'ambiguous_task');
});

test('two gates agree: the CLI that feeds the preflight and the round gate returns one decision; lookup failure denies', () => {
  const store = state => ({ load: () => ({ rev: 'r1', state }) });
  const text = [...old(45), ...fresh(4)].map(c => JSON.stringify(c)).join('\n');
  const a = run(store({ tasks: [], legacyTasks: [task()] }), 103, text);
  assert.equal(a.code, 0); assert.equal(a.d.used, 4);
  assert.equal(run(store({ tasks: [] }), 103, text).code, 4); // no registered task => legacy 49 >= 5
  assert.equal(run({ load: () => { throw new Error('token ghp_SECRET'); } }, 103, text).d.reason, 'budget_lookup_failed');
  const bad = run({ load: () => { throw new Error('token ghp_SECRET'); } }, 103, text);
  assert.equal(bad.code, 1); assert.equal(JSON.stringify(bad).includes('ghp_SECRET'), false);
  assert.equal(run(store({ tasks: [] }), 103, 'not json').code, 1);
});

test('bootstrap: only a registered task branch + actual base SHA; protected/external/no-permission blocked; remote head change = STATE_CHANGED', () => {
  const ctx = (o = {}) => ({ repository: 'founder94/ECHO-MVP-', canPush: true, actualBaseSha: SHA, remote: { exists: false }, ...o });
  const ok = planBootstrap(task(), ctx());
  assert.equal(ok.status, 'CREATE');
  assert.deepEqual(ok.commands, [['git', 'push', 'origin', `${SHA}:refs/heads/claude/task-1`]]);
  assert.equal(ok.commands.flat().some(a => /force|--delete|switch|gh/.test(a)), false);
  for (const b of ['main', 'echo-qa', 'prod', 'echo-automation-state', 'claude/../main', 'refs/heads/x', 'claude/x.lock', 'claude/']) assert.equal(validBranch(b), false, b);
  assert.equal(planBootstrap(task({ branch: 'main' }), ctx()).reason, 'bad_branch');
  assert.equal(planBootstrap(task(), ctx({ repository: 'evil/other' })).reason, 'external_repo');
  assert.equal(planBootstrap(task(), ctx({ canPush: false })).reason, 'no_permission');
  assert.equal(planBootstrap(task(), ctx({ actualBaseSha: 'b'.repeat(40) })).status, 'STATE_CHANGED');
  assert.equal(planBootstrap(task(), ctx({ remote: { exists: true, head: SHA } })).reason, 'branch_exists');
  assert.equal(planBootstrap(task(), ctx({ remote: { exists: true, head: SHA }, expectedHead: 'c'.repeat(40) })).status, 'STATE_CHANGED');
  assert.equal(planBootstrap(task(), ctx({ remote: { exists: true, head: SHA }, expectedHead: SHA })).status, 'REUSE');
  assert.equal(planBootstrap(task({ approval: undefined }), ctx()).reason, 'not_approved');
});

test('claude-task-budget patch applies after the routing patch; both gates read the same budget outputs; legacy 5 literal gone from both gates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
  const yml = path.join(dir, '.github/workflows/claude.yml');
  fs.mkdirSync(path.dirname(yml), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../../.github/workflows/claude.yml'), yml);
  for (const p of ['claude-legacy-queue-routing.patch.txt', 'claude-task-budget.patch.txt']) {
    const f = path.join(__dirname, 'proposed', p);
    execFileSync('git', ['apply', '--check', f], { cwd: dir });
    execFileSync('git', ['apply', f], { cwd: dir });
  }
  const out = fs.readFileSync(yml, 'utf8');
  assert.ok(out.indexOf('id: route') < out.indexOf('id: budget') && out.indexOf('id: budget') < out.indexOf('id: preflight'));
  assert.match(out, /BUDGET_ALLOWED: \$\{\{ steps\.budget\.outputs\.allowed \}\}/g);
  assert.equal((out.match(/BUDGET_ALLOWED: /g) || []).length, 2); // preflight + shell gate
  assert.match(out, /if \(process\.env\.BUDGET_ALLOWED!=='true'\) return no\('round_limit'\)/);
  assert.match(out, /if \[ "\$BUDGET_ALLOWED" != "true" \]; then/);
  assert.equal(/rounds>=5|-ge 5/.test(out), false);
  assert.match(out, /--append-system-prompt "ECHO rules:.*current PR branch only/s); // worker stays current-PR-branch only
  assert.equal(/git switch|git checkout -b/.test(out), false); // model gets no branch creation
  const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/claude.yml'), 'utf8');
  assert.equal(wf.includes('queue-budget'), false); // live file untouched by this test
});
