// 회원 탈퇴(출시 1.0 · 대표 2026-09-24 "출시 1.0 진행해") — 실제 서버 코드(doit-account)를 가짜 DB·가짜 저장소로 돌리는 검사 (가짜 서버 기준).
// 약속: 로그인한 "나"만 지운다 · 확인 없이는 안 지운다 · 사진 파일을 다 지우기 전에는 계정을 안 지운다 ·
//       관리자·결제 기록은 멈추고 메일로 · 로그에 사용자 번호·이메일이 없다 · 화면에서 빠져나갈 문(메일)이 늘 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const read = (p) => readFileSync(p, 'utf8');
const SERVER = 'supabase/functions/doit-account/index.ts';
const ME = '10000000-0000-4000-8000-00000000000a';
const OTHER = '20000000-0000-4000-8000-00000000000b';
const ADMIN = '00000000-0000-4000-8000-000000000001';
const EMAIL = 'someone@example.com';

function world(over = {}) {
  const files = new Set([`${ME}/1/a.jpg`, `${ME}/2/b.jpg`, `${ME}/3/c.jpg`, `${OTHER}/1/z.jpg`]);
  return {
    current: ME, logs: [], deleted: [], removedCalls: [],
    users: { [ME]: { id: ME, email: EMAIL }, [OTHER]: { id: OTHER, email: 'other@example.com' }, [ADMIN]: { id: ADMIN, email: 'admin@example.com' } },
    files,
    storageFail: null, // 'list' | 'remove' | 'silent'
    deleteFail: false,
    tables: {
      profiles: [{ id: ME, role: 'user' }, { id: OTHER, role: 'user' }, { id: ADMIN, role: 'admin' }],
      doit_records: [{ user_id: ME, text: '내 답 원문' }, { user_id: ME, text: '두 번째 답' }, { user_id: OTHER, text: '남의 답' }],
      doit_insights: [{ user_id: ME, text: 'AI 이해' }],
      profile_photos: [1, 2, 3].map((slot) => ({ user_id: ME, slot, storage_path: `${ME}/${slot}/${'abc'[slot - 1]}.jpg` })).concat([{ user_id: OTHER, slot: 1, storage_path: `${OTHER}/1/z.jpg` }]),
      doit_matches: [{ user_a: ME, user_b: OTHER }],
      payments: [],
    },
    ...over,
  };
}

function fakeDb(state) {
  const chain = (name) => {
    let rows = (state.tables[name] ?? []).slice();
    let head = false;
    const c = {
      select: (_cols, opts) => { head = !!opts?.head; return c; },
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (ok, bad) => Promise.resolve(head ? { count: rows.length, data: null, error: null } : { data: rows, error: null }).then(ok, bad),
    };
    return c;
  };
  const bucket = {
    list: async (folder) => {
      if (state.storageFail === 'list') return { data: null, error: { message: 'x' } };
      const prefix = `${folder}/`;
      const names = new Map();
      for (const f of state.files) {
        if (!f.startsWith(prefix)) continue;
        const rest = f.slice(prefix.length);
        const [head, ...tail] = rest.split('/');
        names.set(head, tail.length ? { name: head, id: null } : { name: head, id: `id-${f}` });
      }
      return { data: [...names.values()], error: null };
    },
    remove: async (paths) => {
      state.removedCalls.push(paths.slice());
      if (state.storageFail === 'remove') return { data: null, error: { message: 'x' } };
      if (state.storageFail !== 'silent') paths.forEach((p) => state.files.delete(p));
      return { data: [], error: null };
    },
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: state.users[state.current] ?? null }, error: state.users[state.current] ? null : { message: 'no' } }),
      admin: {
        deleteUser: async (id) => {
          if (state.deleteFail) return { data: null, error: { message: 'x' } };
          state.deleted.push(id);
          return { data: {}, error: null };
        },
      },
    },
    from: (name) => chain(name),
    storage: { from: () => bucket },
  };
}

function loadServer(state) {
  const compiled = ts.transpileModule(read(SERVER), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const sandbox = {
    exports: {}, console: { log: (line) => state.logs.push(String(line)), error: (line) => state.logs.push(String(line)) },
    setTimeout, clearTimeout, Request, Response, Headers, URL, JSON, Promise, Map, Set, Array, Object, Number, String, Date, Error,
    Deno: { env: { get: (k) => ({ SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-account.ts' });
  assert.ok(handler);
  return async (who, payload, { auth = true } = {}) => {
    state.current = who;
    const headers = { 'content-type': 'application/json' };
    if (auth) headers.Authorization = 'Bearer t';
    const res = await handler(new Request('http://fn/', { method: 'POST', headers, body: JSON.stringify(payload) }));
    return { status: res.status, body: await res.json() };
  };
}

const CONFIRM = 'delete-my-account-v1';

test('로그인 없으면 401, 모르는 요청은 400', async () => {
  const s = world(); const call = loadServer(s);
  assert.equal((await call(ME, { action: 'preview' }, { auth: false })).status, 401);
  assert.equal((await call(ME, { action: 'delete_everyone' })).status, 400);
  assert.deepEqual(s.deleted, []);
});

test('미리 보기: 개수만 알려 주고(원문 0), 지우지 않는다', async () => {
  const s = world(); const call = loadServer(s);
  const r = await call(ME, { action: 'preview' });
  assert.equal(r.body.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(r.body.counts)), { answers: 2, insights: 1, photos: 3, matches: 1 });
  assert.equal(r.body.can_delete, true);
  assert.doesNotMatch(JSON.stringify(r.body), /내 답 원문|AI 이해|jpg/);
  assert.deepEqual(s.deleted, []); assert.equal(s.removedCalls.length, 0);
});

test('확인 문자열이 없거나 다르면 아무것도 지우지 않는다', async () => {
  for (const confirm of [undefined, '', 'yes', true, 'delete-my-account-v0']) {
    const s = world(); const call = loadServer(s);
    const r = await call(ME, { action: 'delete_me', confirm });
    assert.equal(r.body.code, 'CONFIRM_REQUIRED', String(confirm));
    assert.deepEqual(s.deleted, []); assert.equal(s.removedCalls.length, 0);
  }
});

test('탈퇴: 내 사진 파일을 다 지운 뒤 내 계정만 지운다 — 화면이 남의 번호를 보내도 무시한다', async () => {
  const s = world(); const call = loadServer(s);
  const r = await call(ME, { action: 'delete_me', confirm: CONFIRM, userId: OTHER, user_id: OTHER });
  assert.equal(r.status, 200); assert.equal(r.body.deleted, true);
  assert.deepEqual(s.deleted, [ME], '지운 계정은 로그인한 나 하나');
  assert.deepEqual([...s.files], [`${OTHER}/1/z.jpg`], '남의 사진은 그대로, 내 사진은 0장');
  for (const batch of s.removedCalls) for (const p of batch) assert.ok(p.startsWith(`${ME}/`), p);
});

test('DB 줄에 없는 사진 파일(업로드 뒤 저장 실패한 것)도 폴더를 훑어 지운다', async () => {
  const s = world(); s.files.add(`${ME}/2/orphan.jpg`); const call = loadServer(s);
  await call(ME, { action: 'delete_me', confirm: CONFIRM });
  assert.ok(![...s.files].some((f) => f.startsWith(`${ME}/`)));
  assert.deepEqual(s.deleted, [ME]);
});

test('관리자 계정·결제 기록이 있으면 멈추고 메일로 안내한다(지우지 않음)', async () => {
  let s = world(); let call = loadServer(s);
  let r = await call(ADMIN, { action: 'delete_me', confirm: CONFIRM });
  assert.equal(r.body.code, 'ADMIN_ACCOUNT'); assert.deepEqual(s.deleted, []); assert.equal(s.removedCalls.length, 0);
  assert.equal((await call(ADMIN, { action: 'preview' })).body.can_delete, false);

  s = world(); s.tables.payments = [{ user_id: ME, status: 'done' }]; call = loadServer(s);
  r = await call(ME, { action: 'delete_me', confirm: CONFIRM });
  assert.equal(r.body.code, 'PAYMENT_RECORDS'); assert.match(r.body.error, /메일/);
  assert.deepEqual(s.deleted, []); assert.equal(s.removedCalls.length, 0);
  const p = await call(ME, { action: 'preview' });
  assert.equal(p.body.can_delete, false); assert.match(p.body.blocked_reason, /메일/);
});

test('사진을 다 못 지우면(목록 실패·삭제 실패·남음) 계정은 지우지 않는다 — 다시 누르면 이어서 지운다', async () => {
  for (const mode of ['list', 'remove', 'silent']) {
    const s = world(); s.storageFail = mode; const call = loadServer(s);
    const r = await call(ME, { action: 'delete_me', confirm: CONFIRM });
    assert.equal(r.body.code, 'STORAGE_FAILED', mode);
    assert.match(r.body.error, /계정은 그대로/);
    assert.deepEqual(s.deleted, [], mode);
    s.storageFail = null;
    const again = await call(ME, { action: 'delete_me', confirm: CONFIRM });
    assert.equal(again.body.deleted, true, `${mode} 뒤 다시 누르면 끝까지`);
    assert.deepEqual(s.deleted, [ME]);
  }
});

test('계정 지우기가 실패하면 실패로 알린다(성공이라고 하지 않음)', async () => {
  const s = world(); s.deleteFail = true; const call = loadServer(s);
  const r = await call(ME, { action: 'delete_me', confirm: CONFIRM });
  assert.equal(r.body.ok, false); assert.equal(r.body.code, 'DELETE_FAILED');
});

test('로그에는 단계·개수만 — 사용자 번호·이메일·원문이 없다', async () => {
  const s = world(); const call = loadServer(s);
  await call(ME, { action: 'preview' });
  await call(ME, { action: 'delete_me', confirm: CONFIRM });
  const all = s.logs.join('\n');
  assert.ok(s.logs.length > 0);
  for (const secret of [ME, EMAIL, '내 답 원문', 'jpg', 'Bearer']) assert.ok(!all.includes(secret), secret);
});

test('서버 약속: 로그인 실검증 · 사용자 번호를 요청 본문에서 읽지 않음 · 확인 값이 화면과 같음', () => {
  const src = read(SERVER);
  assert.match(src, /auth\.getUser\(\)/);
  assert.match(src, /deleteUser\(userId\)/);
  assert.match(src, /const userId = user\.id;/);
  assert.doesNotMatch(src, /body\.(userId|user_id|id)\b/, '지울 대상을 화면이 정하지 않는다');
  const serverConfirm = src.match(/const DELETE_CONFIRM = "([^"]+)"/)[1];
  const clientConfirm = read('src/doit/lib/accountApi.ts').match(/export const DELETE_CONFIRM = '([^']+)'/)[1];
  assert.equal(serverConfirm, clientConfirm);
  // 사진 → 계정 순서
  assert.ok(src.indexOf('removeMyPhotoFiles(admin, userId)') < src.indexOf('admin.auth.admin.deleteUser(userId)'));
  assert.doesNotMatch(src, /console\.(log|error)\([^)]*(email|user\.id|userId)/);
});

test('화면: 두 번 확인해야 지우고, 메일(빠져나갈 문)은 늘 보이며, 로그인 흔적을 이 기기에서 정리한다', () => {
  const ui = read('src/doit/pages/do-it/settings/AccountDeletion.tsx');
  assert.match(ui, /탈퇴 전에 지워지는 것 보기/);
  assert.match(ui, /되돌릴 수 없다는 걸 알고 있어요/);
  assert.match(ui, /disabled=\{!agreed \|\| deleting\}/, '확인 칸을 체크해야 버튼이 눌린다');
  assert.match(ui, /그대로 둘게요/);
  assert.match(ui, /signOut\(\{ scope: "local" \}\)/, '이 기기에서만 로그아웃(다른 기기 세션은 계정 삭제로 함께 끝난다)');
  assert.match(ui, /clearLocalTraces\(userId\)/);
  assert.match(ui, /mailto:\$\{SUPPORT_EMAIL\}/);
  // 메일 링크는 어떤 단계에서든 그려진다(done 화면 제외 — 이미 지워짐).
  const afterDone = ui.slice(ui.indexOf('const preview ='));
  assert.match(afterDone, /\{mail\}\n    <\/div>\n  \);\n\}\n?$/);
  assert.doesNotMatch(ui, /console\./);
  const page = read('src/doit/pages/do-it/settings/page.tsx');
  assert.match(page, /<AccountDeletion userId=\{user\?\.id \?\? null\} authLoading=\{loading\} \/>/);
  assert.doesNotMatch(page, /아직 이 화면에서 처리할 수 없어요/);
});

test('화면 오류 안내: 서버가 아직 없거나 연결이 끊기면 메일로, 관리자·결제는 멈춤, 일시 오류는 다시 해 보기', () => {
  const compile = (p) => ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class UnderstandingError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const store = new Map([[`doit:request:${ME}:abc`, '1'], ['doit:install:dismissed', '1'], [`sb-x-${OTHER}`, '1']]);
  const fake = { get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null, removeItem: (k) => store.delete(k) };
  const exports = {};
  vm.runInNewContext(compile('src/doit/lib/accountApi.ts'), { exports, localStorage: fake, sessionStorage: undefined, require: (n) => { if (n === '@/doit/lib/understandingApi') return { UnderstandingError, serverFunctionRequest: async () => ({}) }; throw new Error(n); } });
  const { accountFailure, UNAVAILABLE_TEXT, clearLocalTraces } = exports;
  const E = (code, msg = '서버 문장') => new UnderstandingError(code, msg);
  assert.equal(accountFailure(E('NOT_FOUND')).kind, 'unavailable');
  assert.equal(accountFailure(E('NOT_FOUND')).message, UNAVAILABLE_TEXT);
  assert.equal(accountFailure(E('NETWORK_ERROR')).kind, 'unavailable');
  assert.equal(accountFailure(new Error('boom')).kind, 'unavailable');
  assert.equal(accountFailure(E('ADMIN_ACCOUNT')).kind, 'blocked');
  assert.equal(accountFailure(E('PAYMENT_RECORDS')).kind, 'blocked');
  for (const c of ['STORAGE_FAILED', 'DELETE_FAILED', 'RATE_LIMITED', 'ERROR']) assert.equal(accountFailure(E(c)).kind, 'retry', c);
  assert.equal(accountFailure(E('UNAUTHORIZED')).kind, 'signin');
  assert.match(UNAVAILABLE_TEXT, /메일/);
  // 이 기기의 내 흔적만 지운다
  clearLocalTraces(ME);
  assert.deepEqual([...store.keys()].sort(), ['doit:install:dismissed', `sb-x-${OTHER}`]);
});

test('약관: 앱 안 탈퇴와 메일 요청 둘 다 적혀 있고, 쓰지 않는 단어가 새 화면에 없다', () => {
  assert.match(read('src/lib/legal/documents.ts'), /설정 → 회원 탈퇴에서 직접 계정을 해지\(탈퇴\)할 수 있고, 회사 이메일로 요청할 수도/);
  const banned = /데이팅|소개팅|궁합|점술|심리치료|성격검사/;
  for (const p of ['src/doit/pages/do-it/settings/AccountDeletion.tsx', 'src/doit/lib/accountApi.ts', SERVER]) assert.doesNotMatch(read(p), banned, p);
});

test('41차 메뉴: 숨김 목록은 비어 있어 운영(37차)과 같은 탭·메뉴다(대표 정정 "임의 숨김 금지"). 숨김 장치와 주소는 그대로 남는다', () => {
  const nav = read('src/doit/components/feature/BottomNav.tsx');
  assert.match(nav, /const tabs = allTabs\.filter\(\(tab\) => visibleInRelease\(tab\.to\)\);/);
  const top = read('src/doit/components/feature/TopBar.tsx');
  assert.match(top, /ECHO와 이야기하기/, '메뉴 문구도 운영과 같다');
  const routes = read('src/doit/routes.tsx');
  for (const p of ['spaces', 'world', 'just-try', 'grade', 'notifications', 'fortune']) assert.match(routes, new RegExp(`path: "${p}"`), p);
  const compile = (p) => ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compile('src/doit/lib/releaseScope.ts'), { exports });
  assert.equal(Object.keys(exports.HIDDEN_IN_RELEASE).length, 0);
  for (const p of ['/doit/home', '/doit/spaces', '/doit/world', '/doit/connections', '/doit/profile', '/doit/fortune', '/doit/just-try', '/doit/grade', '/doit/notifications']) assert.equal(exports.visibleInRelease(p), true, p);
});
