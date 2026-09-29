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

function fakeDb(state) {
  const table = (name) => (state.tables[name] ??= []);
  const chain = (name) => {
    let rows = table(name).slice();
    let op = 'select', patch = null;
    const c = {
      select: () => c, order: (col, o) => { rows.sort((x, y) => (x[col] < y[col] ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return c; }, limit: (n) => { rows = rows.slice(0, n); return c; },
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      in: (col, vals) => { rows = rows.filter((r) => vals.includes(r[col])); return c; },
      not: (col, _is, v) => { rows = rows.filter((r) => r[col] !== v && r[col] !== undefined); return c; },
      update: (p) => { op = 'update'; patch = p; return c; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (ok, bad) => {
        if (op === 'update') { for (const r of rows) Object.assign(r, patch); state.writes.push({ name, op, patch }); return Promise.resolve({ data: null, error: null }).then(ok, bad); }
        return Promise.resolve({ data: rows, error: null }).then(ok, bad);
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
    t.push({ id: globalThis.crypto.randomUUID(), created_at: new Date(Date.now() + t.length).toISOString(), common: [], ...row });
    state.writes.push({ name, op: 'insert' });
    return { error: null };
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: state.users[state.current] }, error: null }),
      admin: { listUsers: async () => ({ data: { users: Object.values(state.users) }, error: null }) },
    },
    from: (name) => Object.assign(chain(name), {
      insert: async (row) => insert(name, row),
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
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', ...state.env })[k] }, serve: (h) => { handler = h; } },
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
  return async (who, payload, { auth = true } = {}) => {
    state.current = who;
    const headers = { 'content-type': 'application/json' };
    if (auth) headers.Authorization = 'Bearer t';
    const res = await handler(new Request('http://fn/', { method: 'POST', headers, body: JSON.stringify(payload) }));
    return { status: res.status, body: await res.json() };
  };
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
    current: ID.a, logs: [], writes: [], aiCalls: [], env: { MATCH_SOURCE: 'legacy' },
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

// Matching Integration: 기존 테스트는 명시적 legacy 복구 경로, 기본값은 Agent 확정 상태(CONFIRMED)를 재료로 쓴다.
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

test('Matching Integration: 설정값이 없으면 Agent 완료 상태로 판정하고 대화 중 사용자는 후보가 아니다', async () => {
  const s = world({ env: {} });
  s.tables.doit_request_events = [agentRow(ID.a, ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요'], 'talk')];
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates.length, 0);
  assert.equal(r.body.missing.answers, 1);
});

test('Matching Integration: 기본 Agent 경로에서 옛 답이 없어도 완료한 두 사람을 후보로 찾는다', async () => {
  const s = world({ env: {} });
  s.tables.doit_insights = []; s.tables.doit_records = [];
  s.tables.doit_request_events = [
    agentRow(ID.a, ['천천히 알아가고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '약속을 잘 지키는 사람이 편해요']),
    agentRow(ID.b, ['친구부터 시작하고 싶어요', '조용한 곳에서 대화하는 걸 좋아해요', '거짓말 안 하는 사람이 좋아요']),
  ];
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates.length, 1);
  assert.ok(JSON.stringify(r.body.candidates[0]).includes('조용한 곳에서 대화하는 걸 좋아해요'));
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
  assert.equal(r.body.missing.answers, 1, 'b 는 answers 가 모자란 것으로 센다');
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
