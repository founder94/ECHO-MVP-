// 공유 세션 저장소 검사(가짜 쿠키 · 로컬). 브랜드/앱이 같은 도메인 쿠키를 읽고 쓰는지, 조각 나누기와 삭제가 맞는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function load() {
  const source = readFileSync('src/lib/supabase/sessionStorage.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: () => { throw new Error('no deps'); } });
  return exports;
}

// document.cookie 를 흉내 낸다: 쓰기는 "이름=값; 속성" 한 줄, 읽기는 "이름=값; 이름=값".
function fakeJar() {
  const store = new Map();
  return {
    store,
    read: () => [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    write: (cookie) => {
      const [pair, ...attrs] = cookie.split(';').map((s) => s.trim());
      const at = pair.indexOf('=');
      const name = pair.slice(0, at), value = pair.slice(at + 1);
      const maxAge = attrs.find((a) => a.startsWith('Max-Age='));
      if (maxAge === 'Max-Age=0') store.delete(name); else store.set(name, value);
      assert.ok(attrs.includes('Domain=do-it.company'), '도메인 쿠키여야 두 주소가 공유한다');
      assert.ok(attrs.includes('Path=/'));
    },
  };
}

const { createCookieChunkStorage, sharedCookieDomain, createSharedSessionStorage } = load();

test('도메인 판정: do-it.company 와 그 하위만 공유, 다른 호스트는 null', () => {
  assert.equal(sharedCookieDomain('do-it.company'), 'do-it.company');
  assert.equal(sharedCookieDomain('app.do-it.company'), 'do-it.company');
  assert.equal(sharedCookieDomain('APP.DO-IT.COMPANY'), 'do-it.company');
  assert.equal(sharedCookieDomain('localhost'), null);
  assert.equal(sharedCookieDomain('evil-do-it.company'), null);
  assert.equal(sharedCookieDomain('doitmobile.netlify.app'), null);
});

test('긴 세션 값을 조각으로 나눠 저장하고 그대로 되읽는다', () => {
  const jar = fakeJar();
  const storage = createCookieChunkStorage(jar, 'do-it.company', true);
  const session = JSON.stringify({ access_token: 'a'.repeat(2500), refresh_token: 'r'.repeat(300), user: { id: 'u1', email: 'x@example.com', 이름: '한글 값 "따옴표"' } });
  storage.setItem('sb-test-auth-token', session);
  assert.ok(jar.store.size >= 2, '4KB 를 넘는 값은 조각이 둘 이상이어야 한다');
  for (const v of jar.store.values()) assert.ok(v.length <= 3000);
  assert.equal(storage.getItem('sb-test-auth-token'), session);
});

test('짧아진 값을 다시 쓰면 남는 조각을 지우고, 삭제하면 조각이 모두 사라진다', () => {
  const jar = fakeJar();
  const storage = createCookieChunkStorage(jar, 'do-it.company', true);
  storage.setItem('k', 'x'.repeat(7000));
  assert.equal(jar.store.size, 3);
  storage.setItem('k', 'short');
  assert.equal(jar.store.size, 1);
  assert.equal(storage.getItem('k'), 'short');
  storage.removeItem('k');
  assert.equal(jar.store.size, 0);
  assert.equal(storage.getItem('k'), null);
});

test('브랜드와 앱이 같은 쿠키 항아리를 보면 한쪽 로그인·로그아웃이 다른 쪽에 보인다', () => {
  const jar = fakeJar();
  const brand = createCookieChunkStorage(jar, 'do-it.company', true);
  const app = createCookieChunkStorage(jar, 'do-it.company', true);
  app.setItem('sb-x-auth-token', '{"user":"u1"}');
  assert.equal(brand.getItem('sb-x-auth-token'), '{"user":"u1"}');
  brand.removeItem('sb-x-auth-token');
  assert.equal(app.getItem('sb-x-auth-token'), null);
});

test('공유 저장소: 예전 localStorage 세션을 쿠키로 한 번 옮기고 localStorage 는 비운다 · 다른 호스트는 undefined', () => {
  const jar = fakeJar();
  const local = new Map();
  const win = {
    location: { hostname: 'app.do-it.company', protocol: 'https:' },
    document: { get cookie() { return jar.read(); }, set cookie(v) { jar.write(v); } },
    localStorage: { getItem: (k) => local.get(k) ?? null, setItem: (k, v) => local.set(k, v), removeItem: (k) => local.delete(k) },
  };
  local.set('sb-x-auth-token', '{"legacy":true}');
  const storage = createSharedSessionStorage(win);
  assert.ok(storage);
  assert.equal(storage.getItem('sb-x-auth-token'), '{"legacy":true}');
  assert.equal(local.has('sb-x-auth-token'), false, 'localStorage 쪽은 지워져야 유령 로그인이 없다');
  assert.equal(createCookieChunkStorage(jar, 'do-it.company', true).getItem('sb-x-auth-token'), '{"legacy":true}');
  assert.equal(jar.store.has('doit-cookie-probe.0'), false, '확인용 쿠키는 남기지 않는다');
  assert.equal(createSharedSessionStorage({ ...win, location: { hostname: 'localhost', protocol: 'http:' } }), undefined);
});

test('쿠키를 못 쓰는 브라우저면 undefined(기본 localStorage 로 동작)', () => {
  const win = {
    location: { hostname: 'do-it.company', protocol: 'https:' },
    document: { get cookie() { return ''; }, set cookie(_v) { /* 차단됨: 아무것도 저장 안 됨 */ } },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  assert.equal(createSharedSessionStorage(win), undefined);
});
