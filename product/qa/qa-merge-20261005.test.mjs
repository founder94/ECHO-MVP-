// 테스트 쪽 합치기(.claude/hooks/echo-qa-merge.sh) — 대표 승인 2026-10-05 16:56 KST 「모든거 다 너가해 병합도 테스트 권한 다 승인 줬자나」.
// 가짜 gh 로 확인: echo-qa 대상 · 같은 저장소 · 열림 · 충돌 없음 · 지금 머리 커밋에 Codex 통과일 때만 합치고, 그 밖에는 합치기 호출 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../.claude/hooks/echo-qa-merge.sh', import.meta.url));
const SHA = 'abcdef1234567890abcdef1234567890abcdef12';
const run = ({ base = 'echo-qa', state = 'open', ms = 'clean', repo = 'founder94/ECHO-MVP-', codex = `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${SHA.slice(0, 10)}\``, n = '7' } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qamerge-'));
  const log = path.join(dir, 'calls.log');
  const pr = JSON.stringify({ base: { ref: base }, state, mergeable_state: ms, head: { sha: SHA, repo: { full_name: repo } } });
  const comments = JSON.stringify([{ user: { login: 'chatgpt-codex-connector[bot]' }, body: codex }]);
  writeFileSync(path.join(dir, 'pr.json'), pr); writeFileSync(path.join(dir, 'comments.json'), comments);
  const gh = path.join(dir, 'gh');
  writeFileSync(gh, `#!/usr/bin/env bash
echo "$*" >> "${log}"
if [[ "$*" == *"/merge"* ]]; then echo true; exit 0; fi
if [[ "$*" == *"/comments"* ]]; then
  q=""; for ((i=1;i<=$#;i++)); do if [[ "\${!i}" == "--jq" ]]; then j=$((i+1)); q="\${!j}"; fi; done
  jq -r "$q" "${dir}/comments.json"; exit 0; fi
cat "${dir}/pr.json"
`);
  chmodSync(gh, 0o755);
  const r = spawnSync('bash', [SCRIPT, n], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, encoding: 'utf8' });
  const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
  return { code: r.status, out: r.stdout + r.stderr, merged: calls.includes('/merge') };
};

test('조건을 모두 만족하면 지금 머리 커밋으로만 합친다', () => {
  const r = run();
  assert.equal(r.code, 0, r.out); assert.equal(r.merged, true);
});

test('운영 가지·다른 저장소·닫힘·충돌·Codex 통과 없음·옛 커밋 통과·번호 아님 = 합치기 0', () => {
  for (const [why, o] of [
    ['main 대상', { base: 'main' }],
    ['다른 저장소', { repo: 'someone/fork' }],
    ['닫힘', { state: 'closed' }],
    ['충돌', { ms: 'dirty' }],
    ['검사 중', { ms: 'unstable' }],
    ['Codex 지적', { codex: '### 💡 Codex Review\nHere are some automated review suggestions' }],
    ['옛 커밋 통과', { codex: "Codex Review: Didn't find any major issues.\n**Reviewed commit:** `0000000000`" }],
    ['번호 아님', { n: '7; gh api -X PUT x' }],
  ]) { const r = run(o); assert.notEqual(r.code, 0, why); assert.equal(r.merged, false, why); }
});
