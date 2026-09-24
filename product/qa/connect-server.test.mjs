// 연결 서버(doit-connect) 실제 코드를 가짜 DB·가짜 AI로 끝까지 돌리는 검사 (가짜 서버 기준).
// 목적: 연결 원칙(대표 확정 2026-09-21)의 약속이 코드에서 지켜지는지 — 자격·같은 목적·겹친 말·차단·대표 승인·
//       blind-first(둘 다 답하기 전엔 상대 정보 0)·저장 금지 입력·로그에 원문 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

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
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      state.aiCalls.push(JSON.parse(init.body));
      const answer = ai();
      if (answer === 'HTTP500') return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: { content: typeof answer === 'string' ? answer : JSON.stringify(answer) } }] }), { status: 200 });
    },
  };
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
      blocks: [], doit_matches: [], doit_match_answers: [], doit_match_messages: [], user_reports: [],
    },
    ...over,
  };
  return state;
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
  for (const action of ['admin_candidates', 'admin_matches', 'admin_decide']) {
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

test('후보: 전화 인증이 없는 사람은 자격이 없다(프로필도 pending, Auth 확인도 없음)', async () => {
  const s = world();
  s.users[ID.a] = { ...s.users[ID.a], phone: '', phone_confirmed_at: null };
  const r = await loadServer(s)(ID.admin, { action: 'admin_candidates' });
  assert.equal(r.body.candidates.length, 0);
  assert.equal(r.body.missing.phone, 1);
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
  const r = await call(ID.admin, { action: 'admin_decide', userA: ID.b, userB: ID.a, decision: 'approve' });
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
    const r = await loadServer(s, () => answer)(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
  const r = await call(ID.c, { action: 'answer', matchId: s.tables.doit_matches[0].id, text: '끼어들기' });
  assert.equal(r.status, 404);
  assert.equal(s.tables.doit_match_answers.length, 0);
});

test('저장 금지 입력(전화번호·링크)은 보내지 않고 안내한다', async () => {
  const s = world();
  const call = loadServer(s);
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  r = await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID_E, decision: 'approve', noCommonOk: true });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
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
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve' });
  await call(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID_E, decision: 'approve', noCommonOk: true });
  const [ab, ae] = s.tables.doit_matches.map((m) => m.id);
  let r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body, { ok: true, open: 2, turns: { answer: 2, reply: 0, opened: 0 } });
  await call(ID.a, { action: 'answer', matchId: ab, text: '숲길이요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 0, opened: 0 }, '내가 답하고 상대를 기다리는 건 내 차례가 아니다');
  await call(ID.b, { action: 'answer', matchId: ab, text: '한강이요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 0, opened: 1 }, '둘 다 답해 열렸고 아직 아무 말 없음');
  await call(ID.b, { action: 'message', matchId: ab, text: '반가워요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 1, opened: 0 }, '상대가 마지막으로 말함');
  await call(ID.a, { action: 'message', matchId: ab, text: '저도요' });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body.turns, { answer: 1, reply: 0, opened: 0 }, '내가 마지막으로 말하면 내 차례 아님');
  for (const x of [NICK_B, '새벽', '한강이요', '반가워요', ID.b, ID_E]) assert.ok(!JSON.stringify(r.body).includes(x), `my_turns 에 "${x}" 없음`);
  await call(ID.a, { action: 'leave', matchId: ae, block: false, report: false });
  r = await call(ID.a, { action: 'my_turns' });
  assert.deepEqual(r.body, { ok: true, open: 1, turns: { answer: 0, reply: 0, opened: 0 } }, '끝난 연결은 세지 않는다');
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
