// 운영 빌드 점검기(scripts/check-dist.mjs)가 실제로 문제를 잡는지 확인한다.
// 가짜 산출물 폴더에 문제를 하나씩 넣고, 점검기가 실패(exit 1)로 끝나는지 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKER = join(ROOT, 'scripts', 'check-dist.mjs');

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
const FAKE_SIG = 'abcdefghijklmnopqrstuvwxyz';
const ANON_JWT = `${b64url({ alg: 'HS256' })}.${b64url({ role: 'anon', iss: 'supabase' })}.${FAKE_SIG}`;
const SERVICE_JWT = `${b64url({ alg: 'HS256' })}.${b64url({ role: 'service_role', iss: 'supabase' })}.${FAKE_SIG}`;

function runOn(files) {
  const dir = mkdtempSync(join(tmpdir(), 'check-dist-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      const path = join(dir, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body);
    }
    const r = spawnSync(process.execPath, [CHECKER, dir], { encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('깨끗한 산출물은 통과한다 (공개용 anon 키·라이브러리 기본 주소는 허용)', () => {
  const r = runOn({
    'index.html': '<!doctype html><script src="/assets/a.js"></script>',
    'assets/a.js': `const k="${ANON_JWT}";const u=new URL(p,\`http://localhost\`);const g="http://localhost:9999";`,
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /허용 예외/);
});

const PLANTED = [
  ['source map 파일', { 'assets/a.js': 'x', 'assets/a.js.map': '{}' }, /\[source map\]/],
  ['sourceMappingURL 주석', { 'assets/a.js': 'x\n//# sourceMappingURL=a.js.map' }, /\[sourceMappingURL\]/],
  ['OpenAI 비밀키', { 'assets/a.js': `const k="sk-proj-${'A'.repeat(30)}"` }, /OpenAI secret key/],
  ['Toss 비밀키', { 'assets/a.js': `const k="live_sk_${'B'.repeat(20)}"` }, /Toss secret key/],
  ['Stripe 비밀키', { 'assets/a.js': `const k="sk_live_${'C'.repeat(20)}"` }, /Stripe secret key/],
  ['service_role 키', { 'assets/a.js': `const k="${SERVICE_JWT}"` }, /JWT role=service_role/],
  ['localhost 실제 요청 주소', { 'assets/a.js': 'fetch("http://localhost/api")' }, /개발용 주소.*localhost\/api/],
  ['포트 붙은 localhost', { 'assets/a.js': 'fetch(`http://localhost:9999/token`)' }, /개발용 주소.*9999\/token/],
  ['127.0.0.1', { 'assets/a.js': 'fetch("http://127.0.0.1:54321")' }, /개발용 주소/],
  ['QA 전용 화면 조각', { 'assets/QaDoitUnderstanding-abc123.js': 'x' }, /QA 전용 화면/],
];

for (const [name, files, expected] of PLANTED) {
  test(`점검기가 잡는다: ${name}`, () => {
    const r = runOn(files);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, expected);
  });
}

test('발견한 비밀값은 가려서 출력한다', () => {
  const secret = `sk-proj-${'Z'.repeat(40)}`;
  const r = runOn({ 'assets/a.js': `const k="${secret}"` });
  assert.equal(r.code, 1);
  assert.ok(!r.out.includes(secret), '원래 값이 그대로 출력되면 안 된다');
  assert.match(r.out, /sk-p\*\*\*\*ZZZZ/);
});

test('검사할 폴더가 없으면 통과로 치지 않는다', () => {
  const r = spawnSync(process.execPath, [CHECKER, join(tmpdir(), 'no-such-dist-folder-xyz')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}${r.stderr}`, /검사 대상 없음/);
});
