// node --test .github/scripts/echo-loop.test.cjs — 순회 판정 모의 검사(실제 GitHub 왕복 증거와 별개)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CODEX, pickNextTask, judgeRunning } = require('./echo-loop.cjs');

const SHA = 'a'.repeat(40);
const T0 = '2026-10-04T00:00:00Z';
const at = (min) => new Date(Date.parse(T0) + min * 60000).toISOString();
const label = (...n) => n.map((name) => ({ name }));
const base = (o = {}) => ({ now: at(10), issue: { updated_at: T0 }, pr: { state: 'open', head: { sha: SHA } }, headCommittedAt: T0, reviews: [], reviewComments: [], issueComments: [], ...o });
const ok = (sha) => ({ user: { login: CODEX }, body: `Codex Review: Didn't find any major issues. Keep it up!\n\n**Reviewed commit:** \`${sha.slice(0, 10)}\`` });

test('다음 작업: 믿을 수 있는 사람의 echo-ready 중 가장 오래된 것 · PR·외부인·진행/완료/막힘 제외 · 없으면 null', () => {
  const issues = [
    { number: 3, state: 'open', labels: label('echo-ready'), author_association: 'OWNER', created_at: at(3) },
    { number: 1, state: 'open', labels: label('echo-ready'), author_association: 'NONE', created_at: at(0) },
    { number: 2, state: 'open', labels: label('echo-ready'), author_association: 'OWNER', created_at: at(1), pull_request: {} },
    { number: 4, state: 'open', labels: label('echo-ready', 'echo-done'), author_association: 'OWNER', created_at: at(0) },
    { number: 5, state: 'open', labels: label('echo-ready'), author_association: 'MEMBER', created_at: at(2) },
  ];
  assert.equal(pickNextTask(issues).number, 5);
  assert.equal(pickNextTask([]), null);
});

test('PASS = Codex 「지적 없음」 댓글의 Reviewed commit 이 현재 head SHA', () => {
  assert.equal(judgeRunning(base({ issueComments: [ok(SHA)] })).action, 'pass');
});

test('Codex 지적(리뷰 5972966203 계열) 👍 반응만으로는 PASS 아님 · 옛 SHA 의 「지적 없음」도 PASS 아님 · 리뷰 없음 PASS 아님 · 다른 사람이 쓴 같은 문구 무시', () => {
  assert.equal(judgeRunning(base({ reactions: [{ user: { login: CODEX }, content: '+1', created_at: at(5) }] })).action, 'wait');
  assert.equal(judgeRunning(base({ issueComments: [ok('b'.repeat(40))] })).action, 'wait');
  assert.equal(judgeRunning(base()).action, 'wait');
  assert.equal(judgeRunning(base({ issueComments: [{ ...ok(SHA), user: { login: 'someone' } }] })).action, 'wait');
});

test('FAIL(현재 SHA 지적) 이면 수정은 claude.yml 이 맡고 여기서는 대기 · 「지적 없음」 댓글이 있어도 PASS 아님', () => {
  const r = judgeRunning(base({
    reviews: [{ user: { login: CODEX }, commit_id: SHA }],
    reviewComments: [{ user: { login: CODEX }, commit_id: SHA, body: '**![P1 Badge](x)** bug' }],
    issueComments: [ok(SHA)],
  }));
  assert.equal(r.action, 'wait'); assert.equal(r.reason, 'fail_fix_by_claude_yml');
});

test('옛 SHA 지적은 현재 판정에 쓰지 않음', () => {
  const r = judgeRunning(base({
    reviews: [{ user: { login: CODEX }, commit_id: 'b'.repeat(40) }],
    reviewComments: [{ user: { login: CODEX }, commit_id: 'b'.repeat(40), body: '![P1 Badge](x)' }],
    issueComments: [ok(SHA)],
  }));
  assert.equal(r.action, 'pass');
});

test('조용하면 25분 뒤 한 번만 다시 검수 요청 · 그 뒤 오래 조용하면 막힘(무한 반복 0)', () => {
  assert.equal(judgeRunning(base({ now: at(20) })).action, 'wait');
  assert.equal(judgeRunning(base({ now: at(30) })).action, 'poke');
  const poked = [{ body: `<!-- echo-poke sha=${SHA} -->\n@codex review` }];
  assert.equal(judgeRunning(base({ now: at(40), issueComments: poked })).action, 'wait');
  assert.equal(judgeRunning(base({ now: at(120), issueComments: poked })).action, 'block');
});

test('수정 왕복 5회 넘으면 막힘 · PR 이 닫혔으면 막힘 · 시작 뒤 90분 PR 없으면 막힘', () => {
  const h = Array.from({ length: 6 }, (_, i) => ({ body: `<!-- echo-handoff to=codex sha=${SHA} round=${i + 1} -->` }));
  assert.equal(judgeRunning(base({ issueComments: h })).reason, 'round_limit');
  assert.equal(judgeRunning(base({ pr: { state: 'closed', head: { sha: SHA } } })).action, 'block');
  assert.equal(judgeRunning(base({ pr: null, now: at(100) })).action, 'block');
  assert.equal(judgeRunning(base({ pr: null, now: at(30) })).action, 'wait');
});
