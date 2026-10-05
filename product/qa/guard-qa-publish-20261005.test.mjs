// 안전 잠금(.claude/hooks/echo-guard-bash.sh) — 대표 승인 2026-10-05 16:36 KST 「테스트사이트는 승인 허용 권한 한다」.
// QA 테스트 사이트 게시(echo-netlify-deploy · 가지 echo-qa · target=qa)만 자동 허용, 운영 게시·병합·다른 워크플로는 그대로 막는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../../.claude/hooks/echo-guard-bash.sh', import.meta.url));
const denied = (command) => execFileSync('bash', [HOOK], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' }).includes('"deny"');
const BASE = 'gh api -X POST repos/founder94/echo-mvp-/actions/workflows/echo-netlify-deploy.yml/dispatches';

test('QA 테스트 사이트 게시만 허용', () => {
  assert.equal(denied(`${BASE} -f ref=echo-qa -f inputs[target]=qa -f inputs[qa_roles]=app`), false);
  assert.equal(denied(`${BASE} -f ref=echo-qa -f inputs[target]=qa`), false);
});

test('운영 게시·GO·다른 가지·다른 워크플로·이어 붙인 명령·병합은 그대로 막음', () => {
  for (const c of [
    `${BASE} -f ref=echo-qa -f inputs[target]=prod`,
    `${BASE} -f ref=echo-qa -f inputs[target]=qa -f inputs[go]=GO`,
    `${BASE} -f ref=echo-qa -f inputs[target]=qa -f inputs[prod_roles]=app`,
    `${BASE} -f ref=main -f inputs[target]=qa`,
    `${BASE} -f ref=echo-qa -f ref=main -f inputs[target]=qa`,
    `${BASE} -f ref=echo-qa -f inputs[target]=qa -f inputs[target]=prod`,
    `${BASE} -f ref=echo-qa -f inputs[target]=qa; gh api -X PUT repos/founder94/echo-mvp-/pulls/1/merge`,
    `${BASE} -f ref=echo-qa -f inputs[target]=qa && gh api -X PUT repos/founder94/echo-mvp-/pulls/1/merge`,
    'gh api -X POST repos/founder94/echo-mvp-/actions/workflows/other.yml/dispatches -f ref=echo-qa -f inputs[target]=qa',
    'gh api -X PUT repos/founder94/echo-mvp-/pulls/132/merge',
    'gh api -X POST repos/founder94/echo-mvp-/actions/runs/1/rerun',
  ]) assert.equal(denied(c), true, c);
});
