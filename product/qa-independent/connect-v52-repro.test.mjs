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
      is: (col, v) => { rows = rows.filter((r) => (r[col] ?? null) === v); return c; },
      range: (from, to) => { (state.ranges ??= []).push([name, from, to]); window = [from, Math.min(to, from + (state.maxRows ?? 1000) - 1)]; return c; },
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      in: (col, vals) => { (state.inSizes ??= []).push(vals.length); rows = rows.filter((r) => vals.includes(r[col])); return c; },
      not: (col, _is, v) => { rows = rows.filter((r) => r[col] !== v && r[col] !== undefined); return c; },
      update: (p) => { op = 'update'; patch = p; return c; },
      delete: () => { op = 'delete'; return c; },
      maybeSingle: () => {
        if (op === 'update') { const fail = state.failOn?.(name); if (fail) return Promise.resolve({ data: null, error: fail }); const hit = rows[0] ?? null; if (hit) { Object.assign(hit, patch); state.writes.push({ name, op, patch }); } return Promise.resolve({ data: hit, error: null }); }
        const failRead = state.failOn?.(name); if (failRead) return Promise.resolve({ data: null, error: failRead });
        return Promise.resolve({ data: sorted()[0] ?? null, error: null });
      },
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
    return { status: res.status, body: await res.json(), headers: Object.fromEntries(res.headers) };
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


test('independent: connection read error must not become successful empty list', async () => {
 const s=world(); const call=loadServer(s);
 s.failOn=t=>t==='doit_matches'?{code:'08006'}:null;
 const r=await call(ID.a,{action:'my_matches'});
 console.log(JSON.stringify({probe:'connection_read_failure',http:r.status,ok:r.body.ok,count:r.body.matches?.length}));
 assert.equal(r.status,500);
});
test('independent: consent withdrawn during asset lookup must suppress full partner', async () => {
 const s=world();const call=loadServer(s);await approveBoth(s,call,ID.a,ID.b);
 const m=s.tables.doit_matches[0].id;
 await call(ID.a,{action:'answer',matchId:m,text:'answer A'});await call(ID.b,{action:'answer',matchId:m,text:'answer B'});
 let revoked=false;s.beforeRead=t=>{if(t==='profile_photos'&&!revoked){revoked=true;s.users[ID.b].user_metadata={};}};
 const r=await call(ID.a,{action:'my_matches'});const item=r.body.matches[0];
 console.log(JSON.stringify({probe:'consent_during_asset_lookup',http:r.status,revoked,reveal:item.reveal_state,partner_present:!!item.partner,photo_present:!!item.partner?.photo_url}));
 assert.equal(revoked,true);assert.equal(item.revealed,false);assert.equal('partner' in item,false);
});
