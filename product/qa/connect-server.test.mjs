// 연결 서버(doit-connect) 실제 코드를 가짜 DB·가짜 AI로 끝까지 돌리는 검사 (가짜 서버 기준).
// 목적: 연결 원칙(대표 확정 2026-09-21)의 약속이 코드에서 지켜지는지 — 자격·같은 목적·겹친 말·차단·대표 승인·
//       blind-first(둘 다 답하기 전엔 상대 정보 0)·저장 금지 입력·로그에 원문 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import path from 'node:path';

const ID = {
  admin: '00000000-0000-4000-8000-000000000001',
  a: '10000000-0000-4000-8000-00000000000a',
  b: '20000000-0000-4000-8000-00000000000b',
  c: '30000000-0000-4000-8000-00000000000c',
  d: '40000000-0000-4000-8000-00000000000d',
};
const NICK_B = '바다고양이';
const BIO_B = '주말엔 산책을 해요';

const fakeDbFor = (state) => fakeDb(state);
function fakeDb(state) {
  const table = (name) => (state.tables[name] ??= []);
  const chain = (name) => {
    for (const r of table(name)) if (r.id === undefined) r.id = globalThis.crypto.randomUUID(); // 실제 표는 모두 id 가 있다(id 순 커서)
    let rows = table(name).slice();
    let op = 'select', patch = null;
    const keys = []; let window = null;
    const sorted = () => { if (keys.length) rows.sort((x, y) => { for (const [col, dir] of keys) { if (x[col] === y[col]) continue; return (x[col] < y[col] ? -1 : 1) * dir; } return 0; }); return rows; };
    const c = {
      select: () => c, order: (col, o) => { keys.push([col, o?.ascending === false ? -1 : 1]); return c; },
      limit: (n) => { (state.ranges ??= []).push([name, 'limit', n]); rows = sorted().slice(0, Math.min(n, state.maxRows ?? Infinity)); keys.length = 0; return c; },
      gt: (col, v) => { rows = rows.filter((r) => r[col] > v); return c; },
      range: (from, to) => { (state.ranges ??= []).push([name, from, to]); window = [from, Math.min(to, from + (state.maxRows ?? 1000) - 1)]; return c; },
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      in: (col, vals) => { (state.inSizes ??= []).push(vals.length); rows = rows.filter((r) => vals.includes(r[col])); return c; },
      not: (col, _is, v) => { rows = rows.filter((r) => r[col] !== v && r[col] !== undefined); return c; },
      update: (p) => { op = 'update'; patch = p; return c; },
      delete: () => { op = 'delete'; return c; },
      maybeSingle: () => Promise.resolve({ data: sorted()[0] ?? null, error: null }),
      then: (ok, bad) => {
        if (op === 'update') { for (const r of rows) Object.assign(r, patch); state.writes.push({ name, op, patch }); return Promise.resolve({ data: null, error: null }).then(ok, bad); }
        if (op === 'delete') { const t = table(name); for (const r of rows) t.splice(t.indexOf(r), 1); state.writes.push({ name, op: 'delete' }); return Promise.resolve({ data: null, error: null }).then(ok, bad); }
        const fail = state.failOn?.(name); if (fail) return Promise.resolve({ data: null, error: fail }).then(ok, bad);
        const out = sorted(); const sliced = window ? out.slice(window[0], window[1] + 1) : out.slice(0, state.maxRows ?? Infinity);
        return Promise.resolve({ data: sliced, error: null }).then(ok, bad);
      },
    };
    return c;
  };
  const insert = (name, row) => {
    const t = table(name);
    if (name === 'doit_matches' && t.some((r) => r.user_a === row.user_a && r.user_b === row.user_b)) return { error: { code: '23505' } };
    if (name === 'doit_match_candidates' && t.some((r) => r.user_a === row.user_a && r.user_b === row.user_b)) return { error: { code: '23505' } };
    if (name === 'doit_match_outcomes' && t.some((r) => r.match_id === row.match_id && r.user_id === row.user_id)) return { error: { code: '23505' } };
    if (name === 'doit_match_answers' && t.some((r) => r.match_id === row.match_id && r.user_id === row.user_id)) return { error: { code: '23505' } };
    if (name === 'blocks' && t.some((r) => r.blocker_id === row.blocker_id && r.blocked_user_id === row.blocked_user_id)) return { error: null };
    const failed = state.failOn?.(name); if (failed) return { error: failed };
    if (row.id && t.some((r) => r.id === row.id)) return { error: { code: '23505' } }; // 기본키 충돌(실제 DB 와 같게)
    const made = { id: globalThis.crypto.randomUUID(), created_at: new Date(Date.now() + t.length).toISOString(), common: [], ...row };
    t.push(made);
    state.writes.push({ name, op: 'insert' });
    return { error: null, made };
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: state.users[state.current] }, error: null }),
      admin: { listUsers: async () => ({ data: { users: Object.values(state.users) }, error: null }) },
    },
    from: (name) => Object.assign((state.beforeRead?.(name), chain(name)), {
      // insert(row) 은 바로 기다릴 수도, .select().maybeSingle() 로 만든 줄을 받을 수도 있다(실제 supabase-js 와 같은 모양).
      insert: (row) => { const p = (async () => { await null; return insert(name, row); })(); return { then: (ok, bad) => p.then(({ error }) => ({ data: null, error })).then(ok, bad), select: () => ({ maybeSingle: () => p.then(({ error, made }) => ({ data: error ? null : { id: made?.id }, error })) }) }; },
      upsert: async (row) => insert(name, row),
    }),
    storage: { from: () => ({ createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed/${path}` }, error: null }) }) },
  };
}

function loadServer(state, ai = () => ({ question: '둘이 같이 걷는다면 어디가 좋아요?' })) {
  const source = readFileSync('supabase/functions/doit-connect/index.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const sandbox = {
    exports: {}, console: { log: (line) => state.logs.push(String(line)), error: () => {} },
    setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', ...state.env })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; if (name.startsWith('.')) return local(path.join('supabase/functions/doit-connect', name)); throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      state.aiCalls.push(JSON.parse(init.body));
      const answer = ai();
      if (answer === 'HTTP500') return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: { content: typeof answer === 'string' ? answer : JSON.stringify(answer) } }] }), { status: 200 });
    },
  };
  // 같은 함수 폴더·다른 함수 폴더의 순수 모듈(agentSource.ts → doit-agent/matching.ts)만 허용 — 네트워크·DB 모듈은 여전히 막는다.
  function local(file) {
    const mod = { exports: {} };
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports: mod.exports, module: mod, require: (n) => { if (n.startsWith('.')) return local(path.join(path.dirname(file), n)); throw new Error(`Unexpected dependency ${n}`); } }, { filename: file });
    return mod.exports;
  }
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-connect.ts' });
  assert.ok(handler);
  const call = async (who, payload, { auth = true } = {}) => {
    state.current = who;
    const headers = { 'content-type': 'application/json' };
    if (auth) headers.Authorization = 'Bearer t';
    const res = await handler(new Request('http://fn/', { method: 'POST', headers, body: JSON.stringify(payload) }));
    return { status: res.status, body: await res.json() };
  };
  call.exports = sandbox.exports;
  return call;
}

const confirmedRows = (uid, texts, at = '2026-09-23T01:00:00Z') => texts.map((text) => ({ user_id: uid, text, status: 'confirmed', created_at: at, updated_at: at }));
const photos = (uid, n = 3) => Array.from({ length: n }, (_, i) => ({ user_id: uid, slot: i + 1, storage_path: `${uid}/${i + 1}/x.jpg`, is_primary: i === 0 }));
const COMMON = ['조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요'];
const OWN_A = ['산책을 자주 해요', '책 읽는 걸 즐겨요', '주말엔 요리를 해요'];
const OWN_B = ['영화를 자주 봐요', '고양이를 키워요', '아침형 인간이에요'];

const CONSENTED = { doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: '2026-09-23T00:00:00Z' };

function world(over = {}) {
  const user = (id, phone = true, meta = CONSENTED) => ({ id, phone: phone ? '821000000000' : '', phone_confirmed_at: phone ? '2026-09-23T00:00:00Z' : null, user_metadata: { ...meta } });
  const state = {
    current: ID.a, logs: [], writes: [], aiCalls: [],
    users: { [ID.admin]: user(ID.admin), [ID.a]: user(ID.a), [ID.b]: user(ID.b), [ID.c]: user(ID.c), [ID.d]: user(ID.d) },
    tables: {
      profiles: [
        { id: ID.admin, role: 'admin', nickname: '운영', purpose_id: null, verification_status: 'pending' },
        { id: ID.a, role: 'user', nickname: '별빛', purpose_id: 'friend', purpose_label: '친구', bio: '안녕하세요', verification_status: 'pending' },
        { id: ID.b, role: 'user', nickname: NICK_B, purpose_id: 'friend', purpose_label: '친구', bio: BIO_B, verification_status: 'verified' },
        { id: ID.c, role: 'user', nickname: '다른목적', purpose_id: 'hobby', purpose_label: '취미', bio: '반가워요', verification_status: 'verified' },
        { id: ID.d, role: 'user', nickname: '사진부족', purpose_id: 'friend', purpose_label: '친구', bio: '반가워요', verification_status: 'verified' },
      ],
      profile_photos: [...photos(ID.a), ...photos(ID.b), ...photos(ID.c), ...photos(ID.d, 1)],
      doit_records: [ID.a, ID.b, ID.c, ID.d].flatMap((uid) => [1, 2, 3, 4, 5].map((i) => ({ user_id: uid, status: 'confirmed', text: `답 ${i}`, created_at: '2026-09-23T01:00:00Z' }))),
      doit_insights: [
        ...confirmedRows(ID.a, [...COMMON, ...OWN_A]), ...confirmedRows(ID.b, [...COMMON, ...OWN_B]),
        ...confirmedRows(ID.c, [...COMMON, ...OWN_B]), ...confirmedRows(ID.d, [...COMMON, ...OWN_B]),
      ],
      blocks: [], doit_matches: [], doit_match_candidates: [], doit_match_outcomes: [], doit_match_answers: [], doit_match_messages: [], user_reports: [],
    },
    ...over,
  };
  return state;
}

// v2.0(2026-09-28 §17): 관리자 승인 = 후보 제안. 두 사람이 모두 「이어지고 싶어요」를 눌러야 연결이 열린다.
async function approveBoth(s, call, x, y, extra = {}) {
  const d = await call(ID.admin, { action: 'admin_decide', userA: x, userB: y, decision: 'approve', ...extra });
  if (d.body.status !== 'proposed') return d;
  const [ua, ub] = x < y ? [x, y] : [y, x];
  const cand = s.tables.doit_match_candidates.find((c) => c.user_a === ua && c.user_b === ub);
  await call(x, { action: 'choose', candidateId: cand.id, choice: 'yes' });
  return call(y, { action: 'choose', candidateId: cand.id, choice: 'yes' });
}

test('로그인 없이 부르면 401', async () => {
  const call = loadServer(world());
  const { status } = await call(ID.a, { action: 'my_matches' }, { auth: false });
  assert.equal(status, 401);
});

test('phone_sync: Auth 서버가 확인한 번호가 있을 때만 verified 로 바꾼다', async () => {
  const s = world();
  s.users[ID.a] = { ...s.users[ID.a], phone: '', phone_confirmed_at: null };
  const call = loadServer(s);
  let r = await call(ID.a, { action: 'phone_sync' });
  assert.equal(r.body.verified, false);
  assert.equal(s.tables.profiles.find((p) => p.id === ID.a).verification_status, 'pending', '인증 전에는 바꾸지 않는다');
  s.users[ID.a] = { ...s.users[ID.a], phone: '821012345678', phone_confirmed_at: '2026-09-23T02:00:00Z' };
  r = await call(ID.a, { action: 'phone_sync', verified: true });
  assert.equal(r.body.verified, true);
  assert.equal(s.tables.profiles.find((p) => p.id === ID.a).verification_status, 'verified');
  assert.ok(!s.logs.some((l) => l.includes('1012345678')), '로그에 번호가 없어야 한다');
});

test('phone_sync: 화면이 verified:true 를 보내도 Auth 확인이 없으면 바꾸지 않는다', async () => {
  const s = world();
  s.users[ID.a] = { ...s.users[ID.a], phone: '821012345678', phone_confirmed_at: null };
  const call = loadServer(s);
  const r = await call(ID.a, { action: 'phone_sync', verified: true });
  assert.equal(r.body.verified, false);
  assert.equal(s.writes.filter((w) => w.name === 'profiles').length, 0);
});

test('관리자 아닌 사람은 후보·결정·목록을 못 본다(403)', async () => {
  const call = loadServer(world());
  for (const action of ['admin_candidates', 'admin_matches', 'admin_decide', 'admin_members']) {
    const r = await call(ID.a, { action, userA: ID.a, userB: ID.b, decision: 'approve' });
    assert.equal(r.status, 403, action);
  }
});

test('후보: 자격 + 같은 목적 + 겹친 말이 있는 쌍만 나온다(목적 다름·사진 부족 제외)', async () => {
  const s = world();
  const call = loadServer(s);
  const r = await call(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates.length, 1);
  const cand = r.body.candidates[0];
  assert.deepEqual([cand.user_a, cand.user_b], [ID.a, ID.b]);
  assert.ok(cand.common_a.length >= 1 && cand.common_b.length >= 1);
  assert.equal(r.body.missing.photos, 1, 'D 는 사진이 모자라 빠진다');
  assert.equal(r.body.eligible, 3);
});

// 2026-09-27 대표 「P0-1 · 전화 인증 연결 필수 해제」: 초기 베타·출시 단계에서 전화 인증은 연결 자격 조건이 아니다(참고 정보로만).
// (이전 규칙 「전화 인증이 없으면 자격 없음」은 문자 발송 업체 미연결로 연결 가능 인원을 0으로 만들었다 — 이 검사가 그 규칙을 대신한다.)
test('P0-1: 전화 인증을 안 한 정상 사용자도 연결 후보 · 전화 인증은 참고 정보 · verification_status 는 건드리지 않는다', async () => {
  const s = world();
  s.users[ID.a] = { ...s.users[ID.a], phone: '', phone_confirmed_at: null }; // 프로필 pending · Auth 확인도 없음
  const call = loadServer(s);
  const r = await call(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.candidates.map((c) => [c.user_a, c.user_b]), [[ID.a, ID.b]], '다른 자격을 갖추면 후보');
  assert.equal(r.body.missing.phone, undefined, '「자격이 안 되는 이유」에 전화 인증 없음');
  assert.ok(r.body.phone_unverified >= 1, '참고: 전화 인증 안 한 사람 수');
  assert.equal(r.body.candidates[0].a.phone_verified, false, '후보 카드에 참고로 표시');
  const d = await approveBoth(s, call, ID.a, ID.b);
  assert.equal(d.status, 200, '결정 순간 재확인에서도 전화 인증으로 막지 않는다');
  assert.equal(s.tables.profiles.find((p) => p.id === ID.a).verification_status, 'pending', 'verification_status 값 그대로(인증됨으로 바꾸지 않음)');
  assert.ok(!s.writes.some((w) => w.name === 'profiles'), 'profiles 쓰기 0');
});

test('P0-1: 전화 인증을 마친 사용자는 전과 같다 · 차단한 사이는 전화 인증과 상관없이 연결 금지', async () => {
  let s = world();
  let r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.deepEqual(r.body.candidates.map((c) => [c.user_a, c.user_b]), [[ID.a, ID.b]]);
  assert.equal(r.body.candidates[0].b.phone_verified, true);
  s = world();
  s.users[ID.a] = { ...s.users[ID.a], phone: '', phone_confirmed_at: null };
  s.tables.blocks.push({ blocker_id: ID.b, blocked_user_id: ID.a });
  const call = loadServer(s);
  r = await call(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0, '차단한 사이는 후보 0');
  const d = await approveBoth(s, call, ID.a, ID.b);
  assert.equal(d.status, 409); assert.equal(d.body.code, 'NOT_ELIGIBLE');
});

test('P0-1: 전화 인증 없이 이어진 연결도 그만하기·차단·신고 안전 규칙은 그대로', async () => {
  const s = world();
  s.users[ID.a] = { ...s.users[ID.a], phone: '', phone_confirmed_at: null };
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  assert.equal((await call(ID.a, { action: 'answer', matchId, text: '010-1234-5678 로 연락 주세요' })).body.code, 'BLOCKED_CONTENT', '연락처 막기 그대로');
  const r = await call(ID.b, { action: 'leave', matchId, block: true, report: true });
  assert.equal(r.status, 200);
  assert.equal(s.tables.doit_matches[0].status, 'closed');
  assert.equal(s.tables.user_reports[0].target_user_id, ID.a);
  const again = await call(ID.admin, { action: 'admin_candidates' });
  assert.equal(again.body.candidates.length, 0, '결정한 쌍·차단한 사이는 다시 후보가 되지 않는다');
});

test('후보: 새 회차를 시작하기 전 답·맞다고 한 말은 세지 않는다', async () => {
  const s = world();
  s.users[ID.a] = { ...s.users[ID.a], user_metadata: { doit_round_started_at: '2026-09-23T05:00:00Z' } };
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0);
  assert.equal(r.body.missing.answers, 1, '새 회차 이전 답은 세지 않는다');
});

test('후보: 차단한 사이·이미 결정한 쌍은 다시 나오지 않는다', async () => {
  const s = world();
  s.tables.blocks.push({ blocker_id: ID.b, blocked_user_id: ID.a });
  let r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0, '차단은 한쪽만 해도 막힌다');
  const s2 = world();
  s2.tables.doit_matches.push({ id: 'm0', user_a: ID.a, user_b: ID.b, status: 'rejected' });
  r = await loadServer(s2)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0);
});

test('승인: AI 첫 질문이 검사를 통과하면 그대로, 같은 쌍 두 번 승인은 409', async () => {
  const s = world();
  const call = loadServer(s);
  const r = await approveBoth(s, call, ID.b, ID.a);
  assert.equal(r.status, 200);
  assert.equal(r.body.question_source, 'ai');
  const m = s.tables.doit_matches[0];
  assert.deepEqual([m.user_a, m.user_b], [ID.a, ID.b], '쌍은 정렬해서 저장한다');
  assert.equal(m.status, 'approved');
  assert.equal(m.first_question, '둘이 같이 걷는다면 어디가 좋아요?');
  assert.ok(!JSON.stringify(s.aiCalls[0].messages[1]).includes('산책을 자주 해요'), 'AI 에는 겹친 말만 넘긴다');
  const again = await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
  assert.equal(again.status, 409);
});

for (const [name, answer] of [
  ['겹친 말을 그대로 옮김', { question: '조용한 곳에서 대화하는 걸 좋아해요 어때요?' }],
  ['개인정보를 물음', { question: '어느 동네에 사는 곳이 있나요, 나이는요?' }],
  ['물음표 두 개', { question: '뭘 좋아해요? 왜요?' }],
  ['쓰지 않는 단어', { question: '우리 궁합이 맞을까요?' }],
  ['너무 김', { question: `${'아주 '.repeat(30)}좋아요?` }],
  ['AI 서버 오류', 'HTTP500'],
  ['JSON 아님', 'not json'],
]) {
  test(`승인: 첫 질문이 ${name} → 고정 문장으로 대신한다`, async () => {
    const s = world();
    const r = await approveBoth(s, loadServer(s, () => answer), ID.a, ID.b);
    assert.equal(r.status, 200);
    assert.equal(r.body.question_source, 'fixed');
    assert.equal(s.tables.doit_matches[0].first_question, '처음 만난 사람에게 가장 먼저 들려주고 싶은 내 이야기는 뭐예요?');
  });
}

test('승인 순간에 다시 확인한다: 목적이 다르거나 자격이 없으면 저장하지 않는다', async () => {
  const s = world();
  const call = loadServer(s);
  let r = await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.c, decision: 'approve' });
  assert.equal(r.body.code, 'NOT_ELIGIBLE');
  r = await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.d, decision: 'approve' });
  assert.equal(r.body.code, 'NOT_ELIGIBLE');
  assert.equal(s.tables.doit_matches.length, 0);
});

test('넘기기: 기록만 남고 사용자에게는 보이지 않는다', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'reject' });
  assert.equal(s.tables.doit_matches[0].status, 'rejected');
  const r = await call(ID.a, { action: 'my_matches' });
  assert.equal(r.body.matches.length, 0);
  assert.equal(s.aiCalls.length, 0, '넘기기에는 AI 를 부르지 않는다');
});

test('blind-first: 둘 다 답하기 전에는 상대 이름·소개·사진·답이 응답 어디에도 없다', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;

  let r = await call(ID.a, { action: 'my_matches' });
  assert.equal(r.body.matches.length, 1);
  assert.equal(r.body.matches[0].revealed, false);
  assert.equal(r.body.matches[0].first_question, '둘이 같이 걷는다면 어디가 좋아요?');
  const leak = (b) => [NICK_B, BIO_B, ID.b, 'signed/'].filter((x) => JSON.stringify(b).includes(x));
  assert.deepEqual(leak(r.body), []);

  assert.equal((await call(ID.b, { action: 'answer', matchId, text: '한강 산책길이요' })).status, 200);
  r = await call(ID.a, { action: 'my_matches' });
  assert.equal(r.body.matches[0].partner_answered, true);
  assert.deepEqual(leak(r.body), [], '상대만 답했을 때도 상대 답·이름은 안 보인다');
  assert.ok(!JSON.stringify(r.body).includes('한강 산책길이요'));

  const msgEarly = await call(ID.a, { action: 'message', matchId, text: '안녕하세요' });
  assert.equal(msgEarly.status, 409, '내가 답하기 전에는 이야기할 수 없다');

  assert.equal((await call(ID.a, { action: 'answer', matchId, text: '숲길이요' })).status, 200);
  r = await call(ID.a, { action: 'my_matches' });
  const m = r.body.matches[0];
  assert.equal(m.revealed, true);
  assert.equal(m.partner.nickname, NICK_B);
  assert.equal(m.partner.answer, '한강 산책길이요');
  assert.match(m.partner.photo_url, new RegExp(`signed/${ID.b}/1/`), '대표 사진은 서명 주소로만');
  // 사진 서명 주소에는 저장 폴더 이름(계정 id)이 들어간다 — 비공개 저장소라 그 id 만으로는 아무것도 못 연다. 그 밖의 칸에는 없어야 한다.
  const { photo_url: _photo, ...partnerRest } = m.partner;
  assert.ok(!JSON.stringify({ ...m, partner: partnerRest }).includes(ID.b), '상대 계정 id 는 사진 주소 밖에서는 내려 주지 않는다');

  const dup = await call(ID.a, { action: 'answer', matchId, text: '다시' });
  assert.equal(dup.status, 409, '첫 답은 한 번만');

  assert.equal((await call(ID.a, { action: 'message', matchId, text: '반가워요' })).status, 200);
  r = await call(ID.b, { action: 'my_matches' });
  assert.deepEqual(r.body.matches[0].messages.map((x) => [x.mine, x.body]), [[false, '반가워요']]);

  for (const text of ['숲길이요', '한강 산책길이요', '반가워요', NICK_B]) assert.ok(!s.logs.some((l) => l.includes(text)), `로그에 "${text}" 없음`);
});

test('남의 연결에는 답할 수 없다(있는지조차 알리지 않는다, 404)', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const r = await call(ID.c, { action: 'answer', matchId: s.tables.doit_matches[0].id, text: '끼어들기' });
  assert.equal(r.status, 404);
  assert.equal(s.tables.doit_match_answers.length, 0);
});

test('저장 금지 입력(전화번호·링크)은 보내지 않고 안내한다', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  for (const text of ['제 번호 010-1234-5678 이에요', 'insta.com/me 로 와요']) {
    const r = await call(ID.a, { action: 'answer', matchId, text });
    assert.equal(r.body.code, 'BLOCKED_CONTENT');
    assert.match(r.body.error, /적은 내용은 그대로 남아 있어요/);
  }
  assert.equal(s.tables.doit_match_answers.length, 0);
});

test('그만하기 + 차단·신고: 연결이 닫히고 상대 정보가 다시 나오지 않는다', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  await call(ID.a, { action: 'answer', matchId, text: '숲길이요' });
  await call(ID.b, { action: 'answer', matchId, text: '한강이요' });
  const r = await call(ID.b, { action: 'leave', matchId, block: true, report: true });
  assert.equal(r.status, 200);
  assert.equal(s.tables.doit_matches[0].status, 'closed');
  assert.deepEqual(s.tables.blocks.map((x) => [x.blocker_id, x.blocked_user_id]), [[ID.b, ID.a]]);
  assert.equal(s.tables.user_reports[0].target_user_id, ID.a);
  const list = await call(ID.a, { action: 'my_matches' });
  assert.equal(list.body.matches[0].status, 'closed');
  assert.equal(list.body.matches[0].revealed, false);
  assert.ok(!('partner' in list.body.matches[0]));
  assert.equal((await call(ID.a, { action: 'message', matchId, text: '왜요' })).status, 409);
});

test('차단만 해도(연결이 열려 있어도) 이야기·공개가 멈춘다', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  await call(ID.a, { action: 'answer', matchId, text: '숲길이요' });
  await call(ID.b, { action: 'answer', matchId, text: '한강이요' });
  s.tables.blocks.push({ blocker_id: ID.b, blocked_user_id: ID.a });
  const list = await call(ID.a, { action: 'my_matches' });
  assert.equal(list.body.matches[0].revealed, false);
  assert.equal((await call(ID.a, { action: 'message', matchId, text: '안녕' })).status, 409);
});

test('관리자 연결 목록: 진행(답 수·이야기 수)만, 이야기 내용은 없다', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  await call(ID.a, { action: 'answer', matchId, text: '숲길이요' });
  await call(ID.b, { action: 'answer', matchId, text: '한강이요' });
  await call(ID.a, { action: 'message', matchId, text: '비밀 이야기' });
  const r = await call(ID.admin, { action: 'admin_matches' });
  assert.equal(r.body.matches[0].answered, 2);
  assert.equal(r.body.matches[0].messages, 1);
  assert.ok(!JSON.stringify(r.body).includes('비밀 이야기'));
  assert.ok(!JSON.stringify(r.body).includes('숲길이요'));
});

test('복사본 동기화: 겹침 판정·저장 금지 규칙이 doit-understanding 과 글자 단위로 같다', () => {
  const conn = readFileSync('supabase/functions/doit-connect/index.ts', 'utf8');
  const und = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const cut = (src, start, end) => { const i = src.indexOf(start); const j = src.indexOf(end, i); assert.ok(i >= 0 && j > i, start); return src.slice(i, j); };
  const sim = (src) => cut(src, 'const normalizeKey =', 'function cleanKeys');
  const simConn = cut(conn, 'const normalizeKey =', '// ── /텍스트 유사도');
  assert.equal(simConn.trim(), sim(und).trim());
  const blocked = (src) => cut(src, 'const BLOCKED_PATTERNS', 'return null;\n}').replace(/^export /gm, '');
  assert.equal(blocked(conn), blocked(und));
  const num = (src, key) => src.match(new RegExp(`${key}: ([0-9.]+)`))?.[1];
  for (const key of ['REPEAT_SIM', 'REPEAT_OVERLAP', 'CONNECT_ANSWERS_NEEDED', 'CONNECT_PHOTOS_NEEDED']) assert.equal(num(conn, key), num(und, key), key);
  assert.ok(!/Deno\.env\.get\("OPENAI_URL/.test(conn), '호출 주소는 환경변수로 바꿀 수 없다');
});

test('v1.1 자격 = 다섯 가지 질문에 모두 답함: 맞아요가 적어도(겹친 말만 있으면) 후보, 답이 4개면 맞아요가 많아도 후보 아님', async () => {
  const s = world();
  s.tables.doit_insights = [...confirmedRows(ID.a, [COMMON[0]]), ...confirmedRows(ID.b, [COMMON[0]])];
  s.tables.profile_photos = [...photos(ID.a), ...photos(ID.b)];
  let r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 1, '맞아요 1개씩이어도 다섯 가지를 다 답했고 겹치면 후보');
  const s2 = world();
  s2.tables.doit_records = s2.tables.doit_records.filter((x) => !(x.user_id === ID.a && x.text === '답 5'));
  r = await loadServer(s2)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0, 'A 는 답이 4개라 자격 없음(맞아요 5개가 있어도)');
  assert.equal(r.body.missing.answers, 1);
  const s3 = world();
  s3.tables.doit_records = s3.tables.doit_records.map((x) => (x.user_id === ID.a && x.text === '답 5' ? { ...x, status: 'rejected' } : x));
  r = await loadServer(s3)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0, '아니라고 한 기록은 답으로 세지 않는다');
  const s4 = world();
  s4.tables.doit_insights = [...confirmedRows(ID.a, OWN_A), ...confirmedRows(ID.b, OWN_B)];
  r = await loadServer(s4)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 1, 'v1.2: 겹친 말이 없어도 같은 목적이면 목록에 남는다');
  assert.equal(r.body.candidates[0].no_common, true, '겹친 말 없음으로 표시');
  assert.equal(r.body.candidates[0].score, 0);
  assert.equal(r.body.eligible, 3, 'A·B·C(목적 다름) 모두 자격은 있다');
});

// ── v1.2 (대표 2026-09-24 "최종완성하라고") ──
const ID_E = '50000000-0000-4000-8000-00000000000e';
function withE(s) {
  s.users[ID_E] = { id: ID_E, phone: '821000000001', phone_confirmed_at: '2026-09-23T00:00:00Z', user_metadata: { ...CONSENTED } };
  s.tables.profiles.push({ id: ID_E, role: 'user', nickname: '새벽', purpose_id: 'friend', purpose_label: '친구', bio: '반가워요', verification_status: 'verified' });
  s.tables.profile_photos.push(...photos(ID_E));
  s.tables.doit_records.push(...[1, 2, 3, 4, 5].map((i) => ({ user_id: ID_E, status: 'confirmed', text: `답 ${i}`, created_at: '2026-09-23T01:00:00Z' })));
  s.tables.doit_insights.push(...confirmedRows(ID_E, ['밤하늘 사진을 찍어요']));
  return s;
}

test('v1.2 후보: 겹친 말 있는 쌍이 앞, 겹친 말 없는 같은 목적 쌍은 뒤에 no_common 으로 남는다', async () => {
  const s = withE(world());
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.candidates.map((c) => [c.user_a, c.user_b, c.no_common]), [
    [ID.a, ID.b, false], [ID.a, ID_E, true], [ID.b, ID_E, true],
  ], '겹친 쌍 먼저, 겹친 말 없는 쌍은 뒤');
  assert.ok(r.body.candidates.filter((c) => c.no_common).every((c) => c.common_a.length === 0 && c.common_b.length === 0 && c.score === 0));
  assert.ok(!r.body.candidates.some((c) => [c.user_a, c.user_b].includes(ID.c)), '목적이 다르면 겹친 말이 없어도 여전히 후보 아님');
});

test('v1.2 승인: 겹친 말 없는 쌍은 noCommonOk 없이는 저장하지 않고, 있으면 목적만으로 첫 질문을 만든다', async () => {
  const s = withE(world());
  const call = loadServer(s);
  let r = await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID_E, decision: 'approve' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'NOT_ELIGIBLE');
  assert.equal(s.tables.doit_matches.length, 0);
  assert.equal(s.aiCalls.length, 0);
  r = await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID_E, decision: 'approve', noCommonOk: 'true' });
  assert.equal(r.status, 409, '문자열 "true" 는 확인으로 치지 않는다');
  r = await approveBoth(s, call, ID.a, ID_E, { noCommonOk: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.question_source, 'ai');
  const sent = JSON.parse(s.aiCalls[0].messages[1].content);
  assert.deepEqual(sent, { purpose: '친구', first_person: [], second_person: [] }, 'AI 에는 목적만 간다(각자의 말은 안 보낸다)');
  assert.equal(JSON.stringify(s.tables.doit_matches[0].common), '[]');
});

test('v1.2 동의: 연결 동의 전에는 첫 답을 저장하지 않는다(공개의 방아쇠), 동의하면 보낼 수 있다', async () => {
  const s = world();
  s.users[ID.a].user_metadata = {};
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  let r = await call(ID.a, { action: 'my_matches' });
  assert.equal(r.body.consented, false);
  r = await call(ID.a, { action: 'answer', matchId, text: '숲길이요' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'CONSENT_REQUIRED');
  assert.equal(s.tables.doit_match_answers.length, 0);
  s.users[ID.a].user_metadata = { doit_connect_consent_version: 'connect-v0', doit_connect_consent_at: '2026-09-23T00:00:00Z' };
  assert.equal((await call(ID.a, { action: 'answer', matchId, text: '숲길이요' })).body.code, 'CONSENT_REQUIRED', '옛 판 동의는 다시 묻는다');
  s.users[ID.a].user_metadata = { doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: 'not-a-date' };
  assert.equal((await call(ID.a, { action: 'answer', matchId, text: '숲길이요' })).body.code, 'CONSENT_REQUIRED', '시각이 이상하면 동의로 치지 않는다');
  s.users[ID.a].user_metadata = { ...CONSENTED };
  assert.equal((await call(ID.a, { action: 'my_matches' })).body.consented, true);
  assert.equal((await call(ID.a, { action: 'answer', matchId, text: '숲길이요' })).status, 200);
  assert.ok(!s.logs.some((l) => l.includes('숲길이요')));
});

test('v1.2 my_turns: 내 차례만 센다(답할 질문·새로 열림·상대가 보낸 말), 이름·내용은 없다', async () => {
  const s = withE(world());
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  await approveBoth(s, call, ID.a, ID_E, { noCommonOk: true });
  const [ab, ae] = s.tables.doit_matches.map((m) => m.id);
  let r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body, { ok: true, open: 2, turns: { answer: 2, reply: 0, opened: 0, choose: 0 } });
  await call(ID.a, { action: 'answer', matchId: ab, text: '숲길이요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 0, opened: 0, choose: 0 }, '내가 답하고 상대를 기다리는 건 내 차례가 아니다');
  await call(ID.b, { action: 'answer', matchId: ab, text: '한강이요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 0, opened: 1, choose: 0 }, '둘 다 답해 열렸고 아직 아무 말 없음');
  await call(ID.b, { action: 'message', matchId: ab, text: '반가워요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 1, opened: 0, choose: 0 }, '상대가 마지막으로 말함');
  await call(ID.a, { action: 'message', matchId: ab, text: '저도요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 0, opened: 0, choose: 0 }, '내가 마지막으로 말하면 내 차례 아님');
  for (const x of [NICK_B, '새벽', '한강이요', '반가워요', ID.b, ID_E]) assert.ok(!JSON.stringify(r.body).includes(x), `my_turns 에 "${x}" 없음`);
  await call(ID.a, { action: 'leave', matchId: ae, block: false, report: false });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body, { ok: true, open: 1, turns: { answer: 0, reply: 0, opened: 0, choose: 0 } }, '끝난 연결은 세지 않는다');
  s.tables.blocks.push({ blocker_id: ID.b, blocked_user_id: ID.a });
  r = await call(ID.a, { action: 'my_turns' });
  assert.equal(r.body.open, 0, '상대가 차단하면 세지 않는다');
});

// v15.1 대표 결정 「모르겠어요 ×5 연결 자격 금지」: 후보 고르기도 화면의 준비 상태와 같은 기준(내용 있는 답)으로 센다.
test('v15.1 후보: 「모르겠어요」·지친 말로 채운 다섯 칸은 연결 자격이 아니다(원문은 남는다)', async () => {
  const s = world();
  s.tables.doit_insights = [...confirmedRows(ID.a, [COMMON[0]]), ...confirmedRows(ID.b, [COMMON[0]])];
  s.tables.profile_photos = [...photos(ID.a), ...photos(ID.b)];
  const unsure = ['모르겠어요', '몰라', '잘 모르겠어요', '할말이없다 휴', '모르겠어'];
  s.tables.doit_records = s.tables.doit_records.map((x) => x.user_id === ID.a ? { ...x, text: unsure[Number(x.text.slice(2)) - 1] } : x);
  let r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0, 'A 는 내용 있는 답 0 → 후보 아님');
  assert.equal(r.body.missing.answers, 1);
  assert.equal(s.tables.doit_records.filter((x) => x.user_id === ID.a).length, 5, '원문은 지우지 않는다');
  const s2 = world();
  s2.tables.doit_insights = [...confirmedRows(ID.a, [COMMON[0]]), ...confirmedRows(ID.b, [COMMON[0]])];
  s2.tables.profile_photos = [...photos(ID.a), ...photos(ID.b)];
  s2.tables.doit_records = s2.tables.doit_records.map((x) => x.user_id === ID.a && x.text === '답 5' ? { ...x, text: '그게 아니라 조용한 사람이 좋다는 거예요' } : x);
  r = await loadServer(s2)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 1, '설명이 붙은 정정은 내용 있는 답으로 센다');
});

// Matching Integration(2026-09-27 FINAL IMPLEMENTATION MASTER · PHASE 10): MATCH_SOURCE=agent 일 때만 Agent 확정 상태(CONFIRMED)를 재료로 쓴다.
// (가짜 DB 는 select 의 JSON 경로를 풀지 않으므로 줄에 profile·phase 를 바로 넣는다 — 실제 경로 문법은 deno check 로만 확인.)
const agentProfile = (notes) => ({
  relationship_intent: { status: 'CONFIRMED', items: [{ note: notes[0], quote: notes[0], status: 'CONFIRMED', source_type: 'USER_DIRECT', source_turn: 1 }] },
  // 2026-09-29 매칭 재료 = 사용자 출처(USER_DIRECT · USER_CONFIRMED · USER_CORRECTED)만 — AI 정리(AI_EXTRACTED)·추정(AI_INFERRED)은 재료 0.
  attraction_comfort: { status: 'CONFIRMED', items: [{ note: notes[1], quote: notes[1], status: 'CONFIRMED', source_type: 'USER_CONFIRMED', source_turn: 2 }, { note: 'AI 가 정리한 말', quote: notes[1], status: 'CONFIRMED', source_type: 'AI_EXTRACTED', source_turn: 2 }] },
  values_character: { status: 'CONFIRMED', items: [{ note: notes[2], quote: notes[2], status: 'CONFIRMED', source_type: 'USER_CORRECTED', source_turn: 3 }, { note: '추정만 있는 말', quote: '', status: 'CONFIRMED', source_type: 'AI_INFERRED', source_turn: 3 }] },
  relationship_style: { status: 'OPEN', items: [] }, boundaries: { status: 'OPEN', items: [] },
});
const agentRow = (uid, notes, phase = 'done', at = '2026-09-24T00:00:00Z') => ({ user_id: uid, request_id: `${uid}-s`, action: 'agent_session', status: 'applied', created_at: at, updated_at: at, profile: agentProfile(notes), phase });

test('Matching Integration: 기본값(legacy)은 agent_session 을 읽지 않는다 — 지금과 같다', async () => {
  const s = world(); s.tables.doit_request_events = [agentRow(ID.a, ['전혀 다른 말 1', '전혀 다른 말 2', '전혀 다른 말 3'], 'talk')];
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.candidates.map((c) => [c.user_a, c.user_b]), [[ID.a, ID.b]], 'Agent 가 대화 중이어도 legacy 재료로 판정(기존 결과 그대로)');
});

test('Matching Integration: MATCH_SOURCE=agent 면 Agent 확정 값으로 겹친 말을 찾고 · 추정은 재료가 아니다', async () => {
  const s = world({ env: { MATCH_SOURCE: 'agent' } });
  s.tables.doit_request_events = [
    agentRow(ID.a, ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요']),
    agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요']),
  ];
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates.length, 1);
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes('추정만 있는 말'), 'AI 추정은 응답 어디에도 없다');
  assert.ok(!text.includes('AI 가 정리한 말'), 'AI 정리(AI_EXTRACTED)는 응답 어디에도 없다');
  assert.ok(!text.includes('주말엔 요리를 해요'), 'Agent 사용자는 legacy 재료(doit_insights)를 쓰지 않는다');
});

test('Matching Integration: MATCH_SOURCE=agent · 대화 중(talk)인 Agent 사용자는 legacy 답이 다섯 개여도 자격 없음', async () => {
  const s = world({ env: { MATCH_SOURCE: 'agent' } });
  s.tables.doit_request_events = [agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요'], 'talk')];
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0);
  // FI-018(2026-10-01): Agent 매칭에서는 대화 준비를 Agent 공통 계약으로만 본다 — b(대화 중) 와 Agent 대화가 없는 a·c·d(옛 답 다섯 개) 모두 준비 0.
  assert.equal(r.body.missing.answers, 4, '옛 「답 다섯 개」로 대신하지 않는다');
});

// 2026-09-27 출시 차단 P0-6 · T15: Agent 로만 대화한 사용자(옛 표 doit_insights·doit_records 0줄).
// 기본값(legacy · 지금 운영)은 겹친 말 0 · 답 수 모자람으로 후보 0 — 끊김 재현. MATCH_SOURCE=agent 면 Agent 확정 값으로 겹친 말이 생긴다(0 고정 아님).
test('P0-6 T15: Agent 만 쓴 사용자 — legacy 는 겹친 말 0(끊김 재현) · agent 는 유효한 확정 값으로 겹친 말 > 0', async () => {
  const onlyAgent = (env) => {
    const s = world(env ? { env } : {});
    s.tables.doit_insights = []; s.tables.doit_records = [];
    s.tables.doit_request_events = [
      agentRow(ID.a, ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요']),
      agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요']),
    ];
    return s;
  };
  const legacy = await loadServer(onlyAgent(null))(ID.admin, { action: 'admin_candidates' });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.candidates.length, 0, '지금 운영(legacy): Agent 사용자는 답 수 0 → 자격 없음');
  const agent = await loadServer(onlyAgent({ MATCH_SOURCE: 'agent' }))(ID.admin, { action: 'admin_candidates' });
  assert.equal(agent.status, 200);
  assert.equal(agent.body.candidates.length, 1);
  const c = agent.body.candidates[0];
  assert.equal(c.no_common, false, '겹친 말 0 고정 아님');
  assert.ok(c.score > 0);
  assert.ok(JSON.stringify(c).includes('조용한 곳에서 대화하는 걸 좋아해요'), '겹친 말 = 두 사람 모두 확정한 값');
});

test('ADMIN WEB: admin_members — 같은 연결 자격 계산 · 사람별 준비·부족 항목만(소개 글·확정 문장·전화번호 0) · 쓰기 0', async () => {
  const s = world();
  const call = loadServer(s);
  const before = s.writes.length;
  const r = await call(ID.admin, { action: 'admin_members' });
  assert.equal(r.status, 200);
  const cand = await call(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.members.filter((m) => m.eligible).length, cand.body.eligible, '후보 계산과 같은 기준');
  const d = r.body.members.find((m) => m.id === ID.d);
  assert.ok(d && !d.eligible && d.missing.includes('photos'));
  const text = JSON.stringify(r.body);
  assert.ok(!/bio|confirmed|phone"/.test(text.replace(/phone_verified/g, '')), '소개·확정 문장·전화번호 필드 없음');
  assert.equal(s.writes.length, before, '읽기만');
});

// ── v2.0(2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§19): 당신이 잠든 사이 · 상호선택 · 연결 · 결과 ──
const candOf = (s, x, y) => { const [ua, ub] = x < y ? [x, y] : [y, x]; return s.tables.doit_match_candidates.find((c) => c.user_a === ua && c.user_b === ub); };

test('v2.0 잠든 사이: 자격 있는 사람이 열면 서버가 같은 목적 후보를 준비 · 후보 단계에 상대 이름·소개·말·id 0 · 이유는 내 말과 고른 목적만', async () => {
  const s = world();
  const call = loadServer(s);
  const r = await call(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.eligible, true);
  assert.equal(r.body.candidates.length, 1, '같은 목적·자격 있는 B 하나(C 목적 다름 · D 사진 부족 제외)');
  const c = candOf(s, ID.a, ID.b);
  assert.equal(c.status, 'proposed');
  assert.equal(c.source, 'server');
  const text = JSON.stringify(r.body);
  for (const x of [NICK_B, BIO_B, ID.b, ...OWN_B]) assert.ok(!text.includes(x), `후보 응답에 "${x}" 없음`);
  assert.ok(r.body.candidates[0].reasons.some((t) => t.includes('「친구」')), '직접 고른 목적');
  assert.ok(r.body.candidates[0].reasons.some((t) => COMMON.some((m) => t.includes(m))), '내가 직접 한 말');
  assert.ok(!/%|점수|궁합|사주|타로|AI가/.test(text), '퍼센트·점수·궁합·사주·타로 표현 0');
  assert.equal(s.tables.doit_matches.length, 0, '후보는 아직 연결이 아니다');
  const again = await call(ID.a, { action: 'my_candidates' });
  assert.equal(s.tables.doit_match_candidates.length, 1, '다시 열어도 같은 쌍을 또 만들지 않는다');
  assert.equal(again.body.candidates.length, 1);
});

test('v2.0 자격 없는 사람은 후보를 받지 않고 준비도 하지 않는다', async () => {
  const s = world();
  const r = await loadServer(s)(ID.d, { action: 'my_candidates' });
  assert.equal(r.body.eligible, false);
  assert.deepEqual(r.body.missing, ['photos']);
  assert.equal(r.body.candidates.length, 0);
  assert.equal(s.tables.doit_match_candidates.length, 0);
});

test('v2.0 상호선택: 한쪽만 yes 면 연결 0 · 둘 다 yes 일 때만 연결 1개(첫 질문) · 그 뒤 blind-first 그대로', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  let r = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' });
  assert.equal(r.body.status, 'waiting');
  assert.equal(s.tables.doit_matches.length, 0, '한쪽만 골랐으면 연결을 열지 않는다');
  assert.equal((await call(ID.a, { action: 'my_matches' })).body.matches.length, 0);
  const mineA = (await call(ID.a, { action: 'my_candidates' })).body.candidates[0];
  assert.equal(mineA.waiting, true, '내 쪽은 상대를 기다림');
  const mineB = (await call(ID.b, { action: 'my_candidates' })).body.candidates.find((x) => x.id === c.id);
  assert.equal(mineB.my_choice, null, '상대에게는 아직 고를 후보');
  assert.ok(!JSON.stringify(mineB).includes('yes'), '상대가 먼저 골랐다는 사실도 알리지 않는다');
  assert.equal((await call(ID.b, { action: 'my_turns' })).body.turns.choose, 1, '홈 카드: 고를 후보 1');
  r = await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' });
  assert.equal(r.body.status, 'mutual');
  assert.equal(s.tables.doit_matches.length, 1);
  assert.equal(s.tables.doit_matches[0].status, 'approved');
  assert.equal(candOf(s, ID.a, ID.b).status, 'mutual');
  assert.equal(candOf(s, ID.a, ID.b).match_id, s.tables.doit_matches[0].id);
  const m = (await call(ID.a, { action: 'my_matches' })).body.matches[0];
  assert.equal(m.status, 'open');
  assert.equal(m.revealed, false, '연결이 열려도 둘 다 첫 질문에 답하기 전에는 상대 정보 0');
  assert.ok(!('partner' in m));
  assert.equal(m.via_mutual, true, '먼저 고른 쪽(A)도 서로 골라 열린 연결임을 서버에서 받는다');
  assert.equal((await call(ID.b, { action: 'my_matches' })).body.matches[0].via_mutual, true);
  const again = await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' });
  assert.equal(again.body.status, 'mutual', '같은 선택 다시 눌러도 같은 결과(멱등)');
  assert.equal(s.tables.doit_matches.length, 1);
});

test('v2.0 동시에 둘 다 yes 를 눌러도 연결은 1개', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  const [x, y] = await Promise.all([call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' }), call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' })]);
  assert.ok([x.body.status, y.body.status].includes('mutual'));
  assert.equal(s.tables.doit_matches.length, 1);
});

test('v2.0 거절·숨기기: 연결 0 · 후보에서 사라짐 · 같은 쌍 재추천 0 · 바꿔 고르기 409', async () => {
  for (const choice of ['no', 'hide']) {
    const s = world();
    const call = loadServer(s);
    await call(ID.a, { action: 'my_candidates' });
    const c = candOf(s, ID.a, ID.b);
    await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' });
    const r = await call(ID.a, { action: 'choose', candidateId: c.id, choice });
    assert.equal(r.body.status, 'declined');
    assert.equal(s.tables.doit_matches.length, 0);
    assert.equal((await call(ID.a, { action: 'my_candidates' })).body.candidates.length, 0);
    assert.equal((await call(ID.b, { action: 'my_candidates' })).body.candidates.length, 0, '상대 쪽에서도 사라진다');
    assert.equal(s.tables.doit_match_candidates.length, 1, '같은 쌍을 다시 준비하지 않는다');
    assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' })).status, 409);
    assert.equal((await call(ID.admin, { action: 'admin_run_matching' })).body.made, 0);
  }
});

test('v2.0 차단: 차단한 사이는 후보로 준비 0 · 제안 뒤 차단하면 목록에서 빠지고 고르기 409 · 연결 0', async () => {
  const s = world();
  s.tables.blocks.push({ blocker_id: ID.b, blocked_user_id: ID.a });
  const call = loadServer(s);
  assert.equal((await call(ID.a, { action: 'my_candidates' })).body.candidates.length, 0);
  assert.equal(s.tables.doit_match_candidates.length, 0);
  const s2 = world();
  const call2 = loadServer(s2);
  await call2(ID.a, { action: 'my_candidates' });
  const c = candOf(s2, ID.a, ID.b);
  await call2(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' });
  s2.tables.blocks.push({ blocker_id: ID.a, blocked_user_id: ID.b });
  assert.equal((await call2(ID.b, { action: 'my_candidates' })).body.candidates.length, 0);
  assert.equal((await call2(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' })).status, 409);
  assert.equal(s2.tables.doit_matches.length, 0);
  assert.equal(candOf(s2, ID.a, ID.b).status, 'withdrawn');
});

test('v2.0 남의 후보는 고를 수 없다(404) · 잘못된 선택 값 400', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  assert.equal((await call(ID.c, { action: 'choose', candidateId: c.id, choice: 'yes' })).status, 404);
  assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'maybe' })).status, 400);
});

test('v2.0 결과(outcome): 본인 것만 기록·수정 · 남의 연결 404 · 잘못된 값 400 · 사용자 사실(프로필·확정 말)로 올리지 않음', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  const before = { insights: s.tables.doit_insights.length, records: s.tables.doit_records.length, profiles: JSON.stringify(s.tables.profiles) };
  assert.equal((await call(ID.a, { action: 'outcome', matchId, talked: 'yes', met: 'planned' })).status, 200);
  assert.equal((await call(ID.a, { action: 'outcome', matchId, met: 'yes', again: 'yes', helpful: 'yes' })).status, 200);
  assert.equal(s.tables.doit_match_outcomes.length, 1, '한 사람 한 줄(고쳐 쓰기)');
  assert.deepEqual((({ talked, met, again, helpful }) => ({ talked, met, again, helpful }))(s.tables.doit_match_outcomes[0]), { talked: 'yes', met: 'yes', again: 'yes', helpful: 'yes' });
  assert.equal((await call(ID.c, { action: 'outcome', matchId, met: 'yes' })).status, 404);
  assert.equal((await call(ID.a, { action: 'outcome', matchId, met: 'maybe' })).status, 400);
  assert.equal((await call(ID.a, { action: 'outcome', matchId })).status, 400);
  const mine = (await call(ID.a, { action: 'my_matches' })).body.matches[0];
  assert.deepEqual(mine.outcome, { talked: 'yes', met: 'yes', again: 'yes', helpful: 'yes' });
  assert.equal((await call(ID.b, { action: 'my_matches' })).body.matches[0].outcome, null, '상대의 결과는 보이지 않는다');
  assert.equal(s.tables.doit_insights.length, before.insights);
  assert.equal(s.tables.doit_records.length, before.records);
  assert.equal(JSON.stringify(s.tables.profiles), before.profiles);
  const adm = await call(ID.admin, { action: 'admin_matches' });
  assert.deepEqual(adm.body.matches[0].outcomes, [{ talked: 'yes', met: 'yes', again: 'yes', helpful: 'yes' }]);
  assert.equal(adm.body.proposals[0].status, 'mutual');
});

test('v2.0 admin_run_matching: 관리자만(일반 사용자 403) · 모두 몫 준비 · 두 번 눌러도 중복 0', async () => {
  const s = world();
  const call = loadServer(s);
  assert.equal((await call(ID.a, { action: 'admin_run_matching' })).status, 403);
  const r = await call(ID.admin, { action: 'admin_run_matching' });
  assert.equal(r.body.made, 1);
  assert.equal((await call(ID.admin, { action: 'admin_run_matching' })).body.made, 0);
  assert.equal((await call(ID.admin, { action: 'admin_candidates' })).body.candidates.length, 0, '이미 제안한 쌍은 관리자 후보 목록에서 빠진다');
});

test('v2.0 소수 후보: 한 사람에게 동시에 3개까지만', async () => {
  const s = world();
  const extra = ['50000000-0000-4000-8000-00000000000e', '60000000-0000-4000-8000-00000000000f', '70000000-0000-4000-8000-000000000010', '80000000-0000-4000-8000-000000000011'];
  for (const id of extra) {
    s.users[id] = { ...s.users[ID.b], id };
    s.tables.profiles.push({ id, role: 'user', nickname: `추가${id[0]}`, purpose_id: 'friend', purpose_label: '친구', bio: '반가워요', verification_status: 'pending' });
    s.tables.profile_photos.push(...photos(id));
    s.tables.doit_records.push(...[1, 2, 3, 4, 5].map((i) => ({ user_id: id, status: 'confirmed', text: `답 ${i}`, created_at: '2026-09-23T01:00:00Z' })));
    s.tables.doit_insights.push(...confirmedRows(id, [...COMMON]));
  }
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.body.candidates.length, 3);
});

test('via_mutual: 후보 상호선택 없이 열린 연결(예전 관리자 직접 연결)은 false · 한쪽만 yes 인 후보는 연결 자체가 없다', async () => {
  const s = world();
  const call = loadServer(s);
  s.tables.doit_matches.push({ id: 'm0000000-0000-4000-8000-000000000001', user_a: ID.a, user_b: ID.b, purpose_id: 'p', common: [], first_question: '처음 질문', status: 'approved', created_at: '2026-09-20T00:00:00Z' });
  const m = (await call(ID.a, { action: 'my_matches' })).body.matches[0];
  assert.equal(m.status, 'open');
  assert.equal(m.via_mutual, false, '관리자가 연 연결에 「상대도 당신이 궁금했대요」 근거를 주지 않는다');
  s.tables.doit_match_candidates.push({ id: 'c0000000-0000-4000-8000-000000000001', user_a: ID.a, user_b: ID.b, a_choice: 'yes', b_choice: null, status: 'mutual', match_id: m.id });
  assert.equal((await call(ID.a, { action: 'my_matches' })).body.matches[0].via_mutual, false, '양쪽 yes 가 아니면 status 값만으로 true 로 만들지 않는다');
});

// ── FI-018(2026-10-01 대표 「AGENT ↔ MATCHING CONTRACT」): 연결 자격 = conversation_ready(Agent 공통 계약) AND 목적 AND 소개 AND 필수 사진.
// 화면은 서버가 준 readiness 를 그대로 그린다(화면 계산 0). Agent 매칭에서 옛 「답 다섯 개」는 대화 준비가 아니다.
const fi018 = (rows) => { const s = world({ env: { MATCH_SOURCE: 'agent' } }); s.tables.doit_request_events = rows; return s; };
const READY = ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요'];
test('FI-018 CASE 1: conversation_ready + 목적·소개·사진 → matching_eligible=true · 후보 생성 · 화면용 readiness 동봉', async () => {
  const s = fi018([agentRow(ID.a, READY), agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요'])]);
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 200); assert.equal(r.body.eligible, true); assert.deepEqual(r.body.missing, []);
  assert.deepEqual(r.body.readiness.conversation, { ready: true, source: 'agent', finished: true, have: 3, need: 3 });
  assert.equal(r.body.readiness.photos, 3); assert.equal(r.body.readiness.intro, true); assert.equal(r.body.readiness.purpose, true);
  assert.equal(r.body.candidates.length, 1, '실제 후보 생성');
});
test('FI-018 CASE 2: conversation_ready 지만 사진 부족 → matching_eligible=false · 이유는 photos 하나로 분명', async () => {
  const s = fi018([agentRow(ID.a, READY)]);
  s.tables.profile_photos = s.tables.profile_photos.filter((p) => !(p.user_id === ID.a && p.slot === 3));
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.body.eligible, false); assert.deepEqual(r.body.missing, ['photos']);
  assert.equal(r.body.readiness.conversation.ready, true, '대화 조건은 충족으로 따로 보인다');
  assert.equal(r.body.readiness.photos, 2); assert.equal(r.body.candidates.length, 0);
});
test('FI-018 CASE 3: conversation_ready=false(대화 중) → matching_eligible=false · 이유 answers · 옛 답 다섯 개로 대신하지 않음', async () => {
  const s = fi018([agentRow(ID.a, READY, 'talk')]);
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.body.eligible, false); assert.deepEqual(r.body.missing, ['answers']);
  assert.deepEqual(r.body.readiness.conversation, { ready: false, source: 'agent', finished: false, have: 3, need: 3 });
  const none = await loadServer(fi018([]))(ID.a, { action: 'my_candidates' });
  assert.equal(none.body.eligible, false, 'Agent 대화가 없으면 doit_records 다섯 개가 있어도 준비 0');
  assert.equal(none.body.readiness.conversation.have, 0);
});
test('FI-018 CASE 9(연결): QA 실패 모양 — 대화를 마쳤지만 사용자 출처 칸 2(나머지 AI 정리) → 후보 0 · 같은 함수가 Agent 쪽에서도 「준비 안 됨」', async () => {
  // QA 재현(2026-10-01) A 의 profile 모양: intent·attraction = USER_DIRECT, values·style = AI_EXTRACTED
  const it = (note, source_type, turn) => ({ note, quote: note, status: 'CONFIRMED', source_type, source_turn: turn });
  const qaA = { relationship_intent: { status: 'CONFIRMED', items: [it('깊은 대화부터 시작하고 싶어요', 'USER_DIRECT', 1)], history: [] }, attraction_comfort: { status: 'CONFIRMED', items: [it('처음엔 카페에서 한두 시간 편하게 이야기하고 싶어요', 'USER_DIRECT', 2)], history: [] }, values_character: { status: 'CONFIRMED', items: [it('서로 말 끊지 않고 천천히 듣는 대화가 좋아요', 'AI_EXTRACTED', 3)], history: [] }, relationship_style: { status: 'CONFIRMED', items: [it('처음엔 카페에서 한두 시간 편하게 이야기하고 싶어요', 'AI_EXTRACTED', 2)], history: [] }, boundaries: { status: 'UNKNOWN', items: [], history: [] } };
  const row = { ...agentRow(ID.a, READY), profile: qaA };
  const r = await loadServer(fi018([row, agentRow(ID.b, READY)]))(ID.a, { action: 'my_candidates' });
  assert.equal(r.body.eligible, false); assert.deepEqual(r.body.missing, ['answers']); assert.equal(r.body.readiness.conversation.have, 2);
  // 고친 Agent(v2.5.6)는 물은 칸의 원문을 USER_DIRECT 로 남기므로 같은 대화가 3칸이 된다(agent-server FI-018 CASE 9) — 여기서는 그 결과 모양으로 후보가 생기는지 본다.
  qaA.values_character.items.push(it('서로 말 끊지 않고 천천히 듣는 대화가 좋아요', 'USER_DIRECT', 3));
  const fixed = await loadServer(fi018([{ ...row, profile: qaA }, agentRow(ID.b, READY)]))(ID.a, { action: 'my_candidates' });
  assert.equal(fixed.body.eligible, true); assert.equal(fixed.body.candidates.length, 1);
});

// v2.1(2026-10-01 대표 「SAFETY LAYER」): 신고 사유 · 후보 단계 차단·신고 · 응답은 실제로 저장된 것만 · 같은 신고는 한 번만.
test('v2.1 안전: 연결 신고 사유 6개만 · 저장값 「connection:코드 한국어」 · 같은 사유 다시 눌러도 1건 · 예전 report:true 는 그대로', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  assert.equal((await call(ID.b, { action: 'leave', matchId, block: true, reason: 'hack' })).status, 400, '모르는 사유는 거절');
  assert.equal(s.tables.doit_matches[0].status, 'approved', '거절된 요청은 아무것도 바꾸지 않는다');
  const r = await call(ID.b, { action: 'leave', matchId, block: true, reason: 'threat' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.blocked, r.body.reported], [true, true]);
  assert.equal(s.tables.doit_matches[0].status, 'closed');
  assert.equal(s.tables.user_reports.length, 1);
  assert.equal(s.tables.user_reports[0].reason, 'connection:threat 위협·강요');
  assert.equal(s.tables.user_reports[0].detail, null, '자유 글 저장 0');
  assert.equal(s.tables.user_reports[0].target_user_id, ID.a);
  const again = await call(ID.b, { action: 'leave', matchId, block: true, reason: 'threat' });
  assert.equal(again.body.reported, true);
  assert.equal(s.tables.user_reports.length, 1, '같은 사람·같은 사유 신고는 한 번만');
  const legacy = await call(ID.b, { action: 'leave', matchId, block: false, report: true });
  assert.equal(legacy.body.reported, true);
  assert.equal(s.tables.user_reports[1].reason, 'connection', '예전 화면 호환');
  const m = (await call(ID.a, { action: 'my_matches' })).body.matches[0];
  assert.equal(m.status, 'closed'); assert.ok(!('partner' in m) && !('messages' in m), '끝난 연결은 상대 정보·이야기 0');
  assert.equal((await call(ID.a, { action: 'message', matchId, text: '안녕하세요' })).status >= 400, true, '차단 뒤 새 메시지 0');
  assert.ok(!s.logs.some((l) => l.includes(NICK_B) || l.includes('위협·강요')), '로그에 이름·한국어 사유 원문 0');
});

test('v2.1 안전: 후보 단계 차단·신고 — 숨김과 함께 저장 · 기다리는 중(yes)에도 가능 · yes+차단은 400 · 다시 추천 0', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes', block: true })).status, 400, '이어지고 싶어요 + 차단은 모순');
  await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' });
  const r = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', block: true, reason: 'spam' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.status, r.body.blocked, r.body.reported], ['declined', true, true]);
  assert.equal(candOf(s, ID.a, ID.b).status, 'declined');
  assert.equal(s.tables.user_reports[0].reason, 'candidate:spam 스팸');
  assert.ok(s.tables.blocks.some((b) => b.blocker_id === ID.a && b.blocked_user_id === ID.b && b.reason === 'candidate'));
  assert.equal((await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' })).status, 409, '상대가 뒤늦게 골라도 연결 0');
  assert.equal(s.tables.doit_matches.length, 0);
  assert.equal((await call(ID.a, { action: 'my_candidates' })).body.candidates.length, 0);
  assert.equal((await call(ID.admin, { action: 'admin_run_matching' })).body.made, 0, '차단한 사이 다시 추천 0');
  const hideOnly = world();
  const call2 = loadServer(hideOnly);
  await call2(ID.a, { action: 'my_candidates' });
  const c2 = candOf(hideOnly, ID.a, ID.b);
  const h = await call2(ID.a, { action: 'choose', candidateId: c2.id, choice: 'hide' });
  assert.deepEqual([h.body.blocked, h.body.reported], [false, false], '숨기기만 하면 차단·신고 0');
  assert.equal((hideOnly.tables.user_reports ?? []).length, 0);
});

// 2026-10-01 QA 실측(my_candidates 500 · agent_sessions_failed): 사람 449명의 id 를 in(…) 한 번에 넣어 요청 주소가 한도를 넘었다.
// 449명·17.5KB 는 재현 조건일 뿐 서비스 한도가 아니다 — 경계값·큰 합성 자료·쪽 나누기·일부 실패·동시 요청·로그를 같은 검사로 본다.
const uid = (i) => `9${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`;
const many = (n) => Array.from({ length: n }, (_, i) => uid(i));
const server = () => loadServer(world());

test('규모 · 경계값: 0·1·99·100·101·449·460·5000명 — 묶음 ≤100 · 누락·중복 0 · 묶음 수 = ⌈n/100⌉ · 중복 id 는 한 번만', async () => {
  const { inChunks, IN_CHUNK } = server().exports;
  assert.equal(IN_CHUNK, 100);
  for (const n of [0, 1, 99, 100, 101, 449, 460, 5000]) {
    const ids = many(n); const seen = [];
    const r = await inChunks([...ids, ...ids.slice(0, 3)], (part, after) => { if (after === null) seen.push(part.length); return Promise.resolve({ data: after === null ? part.map((id) => ({ id })) : [], error: null }); });
    assert.equal(r.error, null);
    assert.equal(seen.length, Math.ceil(n / 100), `n=${n} 묶음 수`);
    assert.ok(seen.every((k) => k <= 100), `n=${n} 묶음 크기`);
    assert.equal(JSON.stringify([...r.data].map((x) => x.id).sort()), JSON.stringify([...ids].sort()), `n=${n} 누락·중복 0`);
    assert.equal(r.requests, Math.ceil(n / 100) * 2, '묶음마다 자료 쪽 + 끝 확인 빈 쪽');
  }
});

test('규모 · 실제 인코딩 주소 길이: 449명 한 번 = 약 17KB(재현) · 100명 묶음 = 5KB 이하', async () => {
  const { PostgrestClient } = await import('@supabase/postgrest-js');
  const urls = [];
  const db = new PostgrestClient('https://mutniujeiyujhkobadkd.supabase.co/rest/v1', { fetch: async (u) => { urls.push(String(u)); return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const q = (ids) => db.from('doit_request_events').select('id, user_id, created_at, updated_at, profile:response_payload->profile, phase:response_payload->state->phase').eq('action', 'agent_session').eq('status', 'applied').in('user_id', ids).order('updated_at', { ascending: false }).order('id').range(0, 999);
  await q(many(449)); await q(many(100));
  assert.ok(urls[0].length > 16_000, `449명 한 번 ${urls[0].length}자`);
  assert.ok(urls[1].length < 5_000, `100명 묶음 ${urls[1].length}자`);
});

test('규모 · 쪽 나누기: 서버 max-rows(300)가 쪽 크기보다 작아도 끝까지 읽는다 · 한 사람이 많아도 다른 사람이 밀려나지 않는다', async () => {
  const s = world(); s.maxRows = 300;
  // D(사진 부족 · 후보 아님)가 같은 묶음에서 최근 기록 3000줄 — 예전 「묶음 × 24줄」 제한이면 A·B 의 답이 밀려 자격을 잃었다.
  for (let i = 0; i < 3000; i++) s.tables.doit_records.push({ id: `r${i}`, user_id: ID.d, status: 'confirmed', text: `최근 기록 ${i}`, created_at: '2026-09-30T00:00:00Z' });
  const call = loadServer(s);
  const r = await call(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.eligible, true, 'A 의 답이 밀려나지 않는다');
  assert.equal(r.body.candidates.length, 1);
  assert.ok(s.ranges.filter(([t]) => t === 'doit_records').length >= 11, '3000+ 줄을 300줄 쪽으로 끝까지');
});

test('규모 · Agent 세션이 한 사람에게 여러 줄 · 최신 줄이 여러 쪽 뒤에 있어도 그 줄로 판정', async () => {
  const s = world({ env: { MATCH_SOURCE: 'agent' } }); s.maxRows = 200;
  const notes = ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요'];
  s.tables.doit_request_events = [
    ...Array.from({ length: 900 }, (_, i) => ({ ...agentRow(ID.d, notes, 'talk', `2026-09-30T00:${String(i % 60).padStart(2, '0')}:00Z`), id: `d${i}` })),
    { ...agentRow(ID.a, notes, 'talk', '2026-09-20T00:00:00Z'), id: 'a-old' },
    { ...agentRow(ID.a, notes, 'done', '2026-09-25T00:00:00Z'), id: 'a-new' },
    { ...agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요']), id: 'b1' },
  ];
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.readiness.conversation.ready, true, 'A 의 최신(done) 줄이 900줄 뒤에 있어도 반영');
  assert.equal(r.body.candidates.length, 1);
});

test('규모 · 일부 묶음 실패 = 전체 실패(500 · 「후보 0명」으로 숨기지 않음) · 차단 자료 실패면 고르기도 멈춤', async () => {
  const s = world(); s.failOn = (t) => (t === 'doit_records' ? { code: '57014', message: 'canceling statement due to statement timeout' } : null);
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 500);
  assert.ok(!('candidates' in r.body));
  const log = s.logs.map((l) => JSON.parse(l)).find((l) => l.evt_error);
  assert.equal(log.evt_error, 'records_failed'); assert.equal(log.db_code, '57014');
  const s2 = world(); const call2 = loadServer(s2);
  await call2(ID.a, { action: 'my_candidates' });
  const c = candOf(s2, ID.a, ID.b);
  s2.failOn = (t) => (t === 'blocks' ? { code: 'PGRST301' } : null);
  const ch = await call2(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' });
  assert.equal(ch.status, 500, '차단 자료를 못 읽으면 연결 판단을 하지 않는다');
  assert.equal(s2.tables.doit_matches.length, 0);
});

test('규모 · 동시 요청 ≤4 · 쪽 상한에 닿으면 실패(무한 반복 0)', async () => {
  const { inChunks, IN_CONCURRENCY, IN_MAX_PAGES } = server().exports;
  let live = 0, peak = 0;
  const r = await inChunks(many(1000), async (part, after) => { live++; peak = Math.max(peak, live); await new Promise((ok) => setTimeout(ok, 2)); live--; return { data: after === null ? [{ id: part[0] }] : [], error: null }; });
  assert.equal(r.error, null); assert.equal(r.data.length, 10); assert.ok(peak <= IN_CONCURRENCY, `동시 ${peak}`);
  let calls = 0;
  const endless = await inChunks(many(5), () => { calls++; return Promise.resolve({ data: [{ id: `x${String(calls).padStart(5, '0')}` }], error: null }); });
  assert.equal(endless.error.code, 'PAGE_LIMIT'); assert.equal(calls, IN_MAX_PAGES); assert.equal(endless.data.length, 0, '일부만 읽은 자료를 돌려주지 않는다');
  // 커서 정체: 같은 마지막 id 가 되풀이되면(서버가 gt 를 무시한 것과 같음) 두 번째 쪽에서 바로 실패 — 쪽 상한까지 돌지 않는다
  calls = 0;
  const stuck = await inChunks(many(5), () => { calls++; return Promise.resolve({ data: [{ id: 'x' }], error: null }); });
  assert.equal(stuck.error.code, 'CURSOR_STALL'); assert.equal(calls, 2); assert.equal(stuck.data.length, 0);
  const noId = await inChunks(many(5), () => Promise.resolve({ data: [{ user_id: 'u' }], error: null }));
  assert.equal(noId.error.code, 'CURSOR_STALL', 'id 없는 줄이면 커서를 만들 수 없다 → 실패');
});

test('오류 기록: 민감한 모양의 예외에서도 원문·URL·id·토큰·전화번호 0 · 단계·종류·코드·추적 id·시간은 남음', async () => {
  const secret = 'user 010-1234-5678 token=eyJhbGciOiJIUzI1NiJ9.x.y url=https://db/rest/v1/x?user_id=in.(10000000-0000-4000-8000-00000000000a) 원문 대화: 비밀이에요';
  for (const fail of [{ code: '57014', message: secret, details: secret, hint: secret }, new TypeError(secret)]) {
    const s = world(); s.failOn = (t) => { if (t !== 'doit_insights') return null; if (fail instanceof Error) throw fail; return fail; };
    const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
    assert.equal(r.status, 500);
    const all = s.logs.join('\n');
    for (const bad of ['010-1234', 'eyJ', 'rest/v1', '10000000-0000', '비밀', 'token', 'statement']) assert.ok(!all.includes(bad), `로그에 ${bad}`);
    const log = s.logs.map((l) => JSON.parse(l)).find((l) => l.evt_error);
    assert.ok(log && /^[0-9a-f]{8}$/.test(log.trace) && typeof log.ms === 'number', JSON.stringify(log));
    assert.equal(log.evt_error, fail instanceof Error ? 'unexpected' : 'insights_failed');
    assert.equal(log.type, fail instanceof Error ? 'TypeError' : 'StageError');
    assert.ok(s.logs.every((l) => !l.trim().includes('\n')), '로그는 한 줄');
  }
});

test('규모 · 관리자 후보: 사람 460명이어도 요청마다 in 목록 ≤100 · 결과는 나누기 전과 같다', async () => {
  const s = world();
  for (let i = 0; i < 455; i++) {
    const id = uid(i);
    s.users[id] = { id, phone: '', phone_confirmed_at: null, user_metadata: {} };
    s.tables.profiles.push({ id, role: 'user', nickname: `p${i}`, purpose_id: 'hobby', purpose_label: '취미', bio: '', verification_status: 'pending' });
  }
  const call = loadServer(s);
  const adm = await call(ID.admin, { action: 'admin_candidates' });
  assert.equal(adm.status, 200);
  assert.deepEqual(adm.body.candidates.map((c) => [c.user_a, c.user_b]), [[ID.a, ID.b]]);
  assert.ok(Math.max(...s.inSizes) <= 100, `가장 긴 in 목록 ${Math.max(...s.inSizes)}`);
  assert.equal(adm.body.pool, 460 - 1, '목적이 있는 사람 수(관리자 제외)');
});

test('v2.1 안전 · 재시도: 같은 숨기기·신고를 다시 보내면 200 · 신고 1건 · 다른 사유는 따로 남음 · 바꿔 고르기는 여전히 409', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  const first = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', block: true, reason: 'scam' });
  const again = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', block: true, reason: 'scam' });
  assert.deepEqual([first.status, again.status], [200, 200]);
  assert.deepEqual([again.body.status, again.body.blocked, again.body.reported], ['declined', true, true]);
  assert.equal(s.tables.user_reports.length, 1, '같은 신고 재시도 = 1건');
  const more = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', reason: 'threat' });
  assert.equal(more.status, 200);
  assert.equal(s.tables.user_reports.length, 2, '다른 사유(추가 증거)는 버리지 않는다');
  assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' })).status, 409, '넘긴 뒤 이어지고 싶어요로 바꾸기 0');
  assert.equal((await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'hide' })).status, 409, '상대가 끝낸 후보를 내가 다시 고르기 0');
});

test('v2.1 안전 · 두 탭 동시 같은 신고 = 1건(2026-10-02: 사건 범위 고정 id + DB 기본키 · 지우기 보완 없음) · 다른 사유는 그대로', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const matchId = s.tables.doit_matches[0].id;
  const rs = await Promise.all([1, 2, 3].map(() => call(ID.b, { action: 'leave', matchId, block: true, report: true, reason: 'threat' })));
  assert.ok(rs.every((r) => r.status === 200 && r.body.reported === true));
  assert.equal(s.tables.user_reports.filter((r) => r.reason === 'connection:threat 위협·강요').length, 1, '동시 3번 = 1건');
  await call(ID.b, { action: 'leave', matchId, report: true, reason: 'scam' });
  assert.equal(s.tables.user_reports.length, 2, '다른 사유는 따로');
});

test('신고 고정 id: 같은 신고자·대상·사유·사건 = 같은 id(기본키가 중복 차단) · 다른 연결의 새 사건·다른 사유 = 다른 id · 삭제 동작 0', async () => {
  const { reportIdOf } = loadServer(world()).exports;
  const a = await reportIdOf(ID.a, ID.b, 'connection:threat 위협·강요', 'm1');
  assert.equal(a, await reportIdOf(ID.a, ID.b, 'connection:threat 위협·강요', 'm1'));
  assert.notEqual(a, await reportIdOf(ID.a, ID.b, 'connection:threat 위협·강요', 'm2'), '다른 연결에서 생긴 새 사건은 막지 않는다');
  assert.notEqual(a, await reportIdOf(ID.a, ID.b, 'connection:scam 사기·금전 요구', 'm1'));
  assert.notEqual(a, await reportIdOf(ID.b, ID.a, 'connection:threat 위협·강요', 'm1'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const src = readFileSync('supabase/functions/doit-connect/index.ts', 'utf8');
  assert.doesNotMatch(src.slice(src.indexOf('async function recordSafety'), src.indexOf('const OUTCOME_FIELDS')), /\.delete\(/, '보완 삭제 0');
});

test('신고 · 같은 상대의 새 연결에서 같은 사유 = 새 신고로 저장 · 같은 연결 재시도·동시 = 1건 · 저장 실패면 reported=false', async () => {
  const s = world();
  const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  const m1 = s.tables.doit_matches[0].id;
  await Promise.all([1, 2].map(() => call(ID.b, { action: 'leave', matchId: m1, report: true, reason: 'threat' })));
  assert.equal(s.tables.user_reports.length, 1);
  // 같은 두 사람의 다른 사건(새 연결 id)을 흉내 — 실제로는 차단 뒤 재연결이 없지만, 고정 id 가 사건 범위를 포함하는지 본다
  s.tables.doit_matches.push({ ...s.tables.doit_matches[0], id: '99999999-0000-4000-8000-000000000099', status: 'approved' });
  await call(ID.b, { action: 'leave', matchId: '99999999-0000-4000-8000-000000000099', report: true, reason: 'threat' });
  assert.equal(s.tables.user_reports.length, 2, '새 사건은 막지 않는다');
  const s2 = world(); const call2 = loadServer(s2); await approveBoth(s2, call2, ID.a, ID.b);
  s2.failOn = (t) => (t === 'user_reports' ? { code: '08006' } : null);
  const bad = await call2(ID.b, { action: 'leave', matchId: s2.tables.doit_matches[0].id, report: true, reason: 'spam' });
  assert.equal(bad.body.reported, false, '저장 실패면 접수 아님');
});

test('쪽 읽기 정합성: 읽는 사이 갱신된 최신 정정 줄이 빠지지 않음(id 순 쪽) · 겹친 쪽의 같은 줄은 한 번만', async () => {
  const s = world({ env: { MATCH_SOURCE: 'agent' } }); s.maxRows = 200;
  const notes = ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요'];
  s.tables.doit_request_events = [
    ...Array.from({ length: 900 }, (_, i) => ({ ...agentRow(ID.d, notes, 'talk', '2026-09-30T00:00:00Z'), id: `d${String(i).padStart(4, '0')}` })),
    { ...agentRow(ID.a, notes, 'talk', '2026-09-20T00:00:00Z'), id: 'z-a' },
    { ...agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요']), id: 'b1' },
  ];
  let reads = 0;
  // 첫 쪽을 읽은 직후 A 가 대화를 마쳐(정정 반영) 줄이 가장 최근으로 갱신된다 — 갱신 시각 순 쪽이면 앞쪽(이미 읽은 쪽)으로 옮겨 가 빠진다.
  s.beforeRead = (name) => { if (name === 'doit_request_events' && ++reads === 2) Object.assign(s.tables.doit_request_events.find((r) => r.id === 'z-a'), { phase: 'done', updated_at: '2026-10-02T00:00:00Z' }); };
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.readiness.conversation.ready, true, '읽는 사이 갱신된 최신 줄 반영');
  const { inChunks } = loadServer(world()).exports;
  const pages = [[{ id: 'x1' }, { id: 'x2' }], [{ id: 'x2' }, { id: 'x3' }], []]; // 끼어든 새 줄로 경계 줄이 다음 쪽에 한 번 더 온 경우
  const got = await inChunks(['u1'], (_p, after) => Promise.resolve({ data: pages[after === null ? 0 : after === 'x2' ? 1 : 2], error: null }));
  assert.equal(JSON.stringify([...got.data].map((x) => x.id)), JSON.stringify(['x1', 'x2', 'x3']));
});

// 2026-10-02 정정: offset 쪽 → 마지막 id 커서 쪽. 읽는 사이 이미 읽은 줄이 지워지거나 새 줄이 들어와도 남은 줄이 밀려 빠지지 않는다.
test('쪽 읽기 · id 커서: 첫 쪽을 읽은 뒤 앞쪽 줄 삭제·새 줄 삽입이 있어도 남은 줄 누락 0 · 중복 0 · 요청은 gt(id) + limit', async () => {
  const s = world(); s.maxRows = 1000;
  s.tables.blocks = Array.from({ length: 2500 }, (_, i) => ({ id: `b${String(i).padStart(5, '0')}`, blocker_id: ID.d, blocked_user_id: uid(i) }));
  const call = loadServer(s);
  const { inChunks, afterId } = call.exports;
  const db = (() => { let n = 0; return { from: (t) => { if (t === 'blocks' && ++n === 2) { s.tables.blocks.splice(0, 5); s.tables.blocks.push({ id: 'a-new', blocker_id: ID.d, blocked_user_id: uid(9999) }); } return fakeDbFor(s).from(t); } }; })();
  const r = await inChunks([ID.d], (part, after, size) => afterId(db.from('blocks').select('id').in('blocker_id', part), after, size));
  assert.equal(r.error, null);
  const ids = r.data.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, '중복 0');
  for (let i = 5; i < 2500; i++) assert.ok(ids.includes(`b${String(i).padStart(5, '0')}`), `b${i} 누락`);
});

test('추천 직전 재확인: 목록을 읽은 뒤 생긴 차단은 후보를 만들지 않는다', async () => {
  const s = world(); let added = false;
  s.beforeRead = (name) => { if (name === 'doit_match_candidates' && !added) { added = true; s.tables.blocks.push({ id: 'zz-late', blocker_id: ID.b, blocked_user_id: ID.a, reason: 'candidate' }); } };
  const r = await loadServer(s)(ID.a, { action: 'my_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates.length, 0, '늦게 생긴 차단 → 후보 0');
  assert.equal(s.tables.doit_match_candidates.length, 0, '저장도 0');
});

test('보여 주기 직전 재확인: 후보를 만든 뒤 내가 거절·정정한 말은 추천 이유에서 빠진다 · 상대가 자격을 잃으면 그 후보를 보여 주지 않는다', async () => {
  const s = world(); const call = loadServer(s);
  const first = await call(ID.a, { action: 'my_candidates' });
  assert.equal(first.body.candidates.length, 1);
  assert.ok(first.body.candidates[0].reasons.some((t) => t.includes(COMMON[0])));
  s.tables.doit_insights.find((r) => r.user_id === ID.a && r.text === COMMON[0]).status = 'rejected';
  const again = await call(ID.a, { action: 'my_candidates' });
  assert.equal(again.body.candidates.length, 1);
  assert.ok(again.body.candidates[0].reasons.every((t) => !t.includes(COMMON[0])), '거절한 말은 이유로 쓰지 않는다');
  s.tables.profile_photos = s.tables.profile_photos.filter((p) => p.user_id !== ID.b);
  const gone = await call(ID.a, { action: 'my_candidates' });
  assert.equal(gone.body.candidates.length, 0, '상대가 지금 자격 없음 → 보여 주지 않음');
});

test('연결 직전 재확인: 한쪽이 「이어지고 싶어요」를 누른 뒤 상대가 자격을 잃으면 연결을 열지 않는다(409 · 연결 0)', async () => {
  const s = world(); const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' })).body.status, 'waiting');
  s.tables.profile_photos = s.tables.profile_photos.filter((p) => p.user_id !== ID.a);
  const r = await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' });
  assert.equal(r.status, 409);
  assert.equal(s.tables.doit_matches.length, 0);
});

// 2026-10-02 정정: 신고 한 줄 = 「한 번의 제출」. 화면이 보낸 신고 요청 id 로 재시도와 새 사건을 가른다.
test('신고 요청 id: 같은 제출 재시도·동시 = 1건 · 새 제출(새 id) = 같은 상대·사유여도 새 줄 · 같은 id 다른 내용 = 충돌(접수 아님·덮어쓰기 0) · 다른 사람의 같은 id = 별개', async () => {
  const s = world(); const call = loadServer(s);
  await call(ID.a, { action: 'my_candidates' });
  const c = candOf(s, ID.a, ID.b);
  const r1 = 'aaaaaaaa-0000-4000-8000-000000000001', r2 = 'aaaaaaaa-0000-4000-8000-000000000002';
  const first = await Promise.all([1, 2].map(() => call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', reason: 'spam', reportRequestId: r1 })));
  assert.ok(first.every((x) => x.status === 200 && x.body.reported === true));
  assert.equal(s.tables.user_reports.length, 1, '같은 제출 = 1건');
  assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', reason: 'spam', reportRequestId: r1 })).body.reported, true, '재시도 = 기존 결과');
  assert.equal(s.tables.user_reports.length, 1);
  const second = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', reason: 'spam', reportRequestId: r2 });
  assert.equal(second.body.reported, true);
  assert.equal(s.tables.user_reports.length, 2, '새 제출은 같은 상대·사유여도 보존');
  const before = JSON.stringify(s.tables.user_reports);
  const clash = await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', reason: 'threat', reportRequestId: r1 });
  assert.equal(clash.status, 200);
  assert.deepEqual([clash.body.reported, clash.body.report_conflict], [false, true], '같은 id 에 다른 내용 → 접수로 숨기지 않음');
  assert.equal(JSON.stringify(s.tables.user_reports), before, '기존 신고를 바꾸지 않음');
  assert.ok(s.tables.user_reports.every((r) => r.reporter_id === ID.a && r.target_user_id === ID.b), '신고자·대상은 서버가 정함');
  assert.equal((await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'hide', reason: 'spam', reportRequestId: 'not-a-uuid' })).status, 400);
  const { reportIdOf } = call.exports;
  assert.notEqual(await reportIdOf('request', ID.a, r1), await reportIdOf('request', ID.b, r1), '다른 사람의 같은 요청 id 는 다른 줄');
  assert.notEqual(await reportIdOf('request', ID.a, r1), await reportIdOf(ID.a, ID.b, 'candidate:spam 스팸', c.id), '요청 id 방식과 예전 방식은 id 가 겹치지 않음');
});

test('신고 요청 id · 연결 그만하기: 재시도는 1건 · 남의 연결은 404(쓰기 0) · 기존 임의 id 신고 줄과 공존', async () => {
  const s = world(); const call = loadServer(s);
  await approveBoth(s, call, ID.a, ID.b);
  s.tables.user_reports.push({ id: '0f0f0f0f-0000-4000-8000-000000000000', reporter_id: ID.c, target_user_id: ID.b, reason: 'connection', detail: null });
  const m = s.tables.doit_matches[0].id, rid = 'bbbbbbbb-0000-4000-8000-000000000001';
  for (let i = 0; i < 3; i++) assert.equal((await call(ID.b, { action: 'leave', matchId: m, reason: 'threat', reportRequestId: rid })).body.reported, true);
  assert.equal(s.tables.user_reports.length, 2, '기존 줄 1 + 이번 제출 1');
  assert.ok(s.tables.user_reports.some((r) => r.id === '0f0f0f0f-0000-4000-8000-000000000000'), '기존 신고 그대로');
  const other = await call(ID.c, { action: 'leave', matchId: m, reason: 'threat', reportRequestId: 'bbbbbbbb-0000-4000-8000-000000000002' });
  assert.equal(other.status, 404);
  assert.equal(s.tables.user_reports.length, 2);
});
