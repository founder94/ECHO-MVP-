// 2026-10-02 사고 재발 방지: 검사 스크립트가 실패할 때 찍는 내용(실패 메시지·JSON 세부)에 비밀값이 남지 않는다.
// 진짜 값 대신 가짜 비밀값만 쓴다. 자동 가림(GitHub ***)에 기대지 않고 실제 출력 글자를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { safeDetail } from '../qa-real/safe-detail.mjs';

const FAKE = {
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlLXVzZXItMDAwMCJ9.ZmFrZXNpZ25hdHVyZXZhbHVl',
  refresh: 'fakerefresh7x9q',
  password: 'Qa!fake-password-123',
  email: 'qa-fakeadmin-20990101@do-it.company',
  secretKey: 'sb_secret_FAKEFAKEFAKEFAKE1234',
  openai: 'sk-fakeopenaikey000000000000',
};
const session = { access_token: FAKE.jwt, token_type: 'bearer', refresh_token: FAKE.refresh, user: { email: FAKE.email } };
const leaks = (out) => Object.entries(FAKE).filter(([, v]) => out.includes(v)).map(([k]) => k);

test('safeDetail: 객체·JSON 문자열·이중 이스케이프(로그 안의 JSON 안의 JSON)·헤더·키 모양을 모두 지운다', () => {
  const cases = [
    session,
    JSON.stringify(session),
    JSON.stringify({ url: '/', token: JSON.stringify(session), rows: 200 }),
    `Authorization: Bearer ${FAKE.jwt}`,
    { password: FAKE.password, apikey: FAKE.secretKey, key: FAKE.openai },
    `login failed for ${FAKE.email}`,
  ];
  for (const c of cases) assert.deepEqual(leaks(safeDetail(c)), [], safeDetail(c));
  assert.equal(safeDetail('PASS 화면 chrome 390 admin · {"rows":0}'), 'PASS 화면 chrome 390 admin · {"rows":0}', '비밀값 없는 글은 그대로');
});

test('실제 실패 출력: 검사 함수가 FAIL 로 세션 JSON 을 찍어도 표준 출력·오류에 가짜 비밀값 0', () => {
  const script = `
    import { safeDetail } from ${JSON.stringify(new URL('../qa-real/safe-detail.mjs', import.meta.url).href)};
    const check = (name, ok, detail = '') => { console.log(\`\${ok ? 'PASS' : 'FAIL'} \${name}\${detail ? \` · \${safeDetail(detail)}\` : ''}\`); };
    const session = ${JSON.stringify(session)};
    check('로그아웃 뒤 자료 0', false, JSON.stringify({ url: '/', token: JSON.stringify(session), rows: 200 }));
    check('관리자 로그인', false, session);
    try { throw new Error('request failed: Bearer ' + session.access_token); } catch (e) { console.error(safeDetail(String(e.stack ?? e))); }
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout + r.stderr;
  assert.match(r.stdout, /FAIL 로그아웃 뒤 자료 0/);
  assert.deepEqual(leaks(out), [], out);
});

test('검사 스크립트: 결과를 찍거나 파일에 쓰는 check() 는 모두 safeDetail 을 거친다 · 저장 세션 값을 그대로 꺼내는 코드 0', () => {
  const dir = new URL('../qa-real/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    if (/console\.log\(`\$\{ok \? 'PASS' : 'FAIL'\} \$\{name\}\$\{detail \?/.test(src)) assert.match(src, /safeDetail\(detail\)/, `${f}: 출력 check() 가 safeDetail 을 거치지 않음`);
    for (const m of src.matchAll(/localStorage\.getItem\(([^)]*)\)(.{0,12})/g)) assert.match(m[2], /^\s*!==\s*null/, `${f}: 저장 세션 값을 그대로 꺼냄`);
  }
});
