// PR #12 운영 배포 전 관통 QA(2026-09-27 대표 「FINAL PRE-DEPLOY VALIDATION」).
// 실제 서버 코드(doit-agent index.ts+agent.ts · doit-connect index.ts+agentSource.ts)를 그대로 돌리고, DB 는 메모리(운영 DB·Auth 0),
// AI 는 OPENAI_API_KEY 가 있으면 실제 OpenAI(없으면 구조 확인용 대본). 입력은 모두 합성 문장(실제 사용자 원문 0).
// 실행: NODE_PATH=<typescript 가 있는 node_modules> node qa-real/pr12-e2e.mjs [--out 결과.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const REAL = !!process.env.OPENAI_API_KEY;
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const RID = ['30000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-0000000000c2', '30000000-0000-4000-8000-0000000000c3'];
const REJECT_CASES = ['주말엔 보통 집에 있어요', '사람 많은 데는 좀 그래요', '연락이 너무 잦으면 좀 그래요'];
const ID = { admin: '00000000-0000-4000-8000-000000000001', a: '10000000-0000-4000-8000-00000000000a', b: '20000000-0000-4000-8000-00000000000b' };
const CONSENT = { doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: '2026-09-27T00:00:00Z' };
let seq = 0; const rid = () => `${String(++seq).padStart(8, '0')}-0000-4000-8000-${String(seq).padStart(12, '0')}`;

// ── 메모리 DB(두 함수가 같은 표를 본다)
const state = {
  current: ID.a, aiCalls: 0, writes: [],
  users: {
    [ID.admin]: { id: ID.admin, phone: '', phone_confirmed_at: null, user_metadata: {} },
    [ID.a]: { id: ID.a, phone: '', phone_confirmed_at: null, user_metadata: { ...CONSENT } }, // A: 전화 미인증
    ...Object.fromEntries(RID.map((u) => [u, { id: u, phone: '', phone_confirmed_at: null, user_metadata: { ...CONSENT } }])),
    [ID.b]: { id: ID.b, phone: '821000000000', phone_confirmed_at: '2026-09-27T00:00:00Z', user_metadata: { ...CONSENT } },
  },
  tables: {
    profiles: [
      { id: ID.admin, role: 'admin', nickname: '운영', purpose_id: null, verification_status: 'pending' },
      { id: ID.a, role: 'user', nickname: 'QA-A', purpose_id: 'friend', purpose_label: '친구', bio: '천천히 알아가고 싶어요', verification_status: 'pending' },
      ...RID.map((u, k) => ({ id: u, role: 'user', nickname: `QA-R${k + 1}`, purpose_id: 'dating', purpose_label: '연애', bio: '', verification_status: 'pending' })),
      { id: ID.b, role: 'user', nickname: 'QA-B', purpose_id: 'friend', purpose_label: '친구', bio: '대화가 잘 통하는 사람이 좋아요', verification_status: 'verified' },
    ],
    profile_photos: [ID.a, ID.b].flatMap((u) => [1, 2, 3].map((slot) => ({ user_id: u, slot, storage_path: `${u}/${slot}/x.jpg`, is_primary: slot === 1, updated_at: '2026-09-27T00:00:00Z' }))),
    doit_request_events: [], doit_records: [], doit_insights: [], blocks: [], doit_matches: [], doit_match_answers: [], doit_match_messages: [], user_reports: [], audit_logs: [],
  },
};
const pathGet = (row, expr) => expr.split('->').reduce((v, k, i) => (i === 0 ? row[k] : v?.[k]), undefined);
function fakeDb() {
  const table = (n) => (state.tables[n] ??= []);
  const chain = (name) => {
    const filters = []; let op = 'select', patch = null, order = null, lim = null, cols = null, returning = false;
    const rows = () => { let r = table(name).filter((x) => filters.every((f) => f(x))); if (order) r = r.slice().sort((x, y) => (x[order.col] < y[order.col] ? -1 : x[order.col] > y[order.col] ? 1 : 0) * (order.asc ? 1 : -1)); if (lim != null) r = r.slice(0, lim); return r; };
    const project = (r) => { const o = structuredClone(r); for (const c of cols ?? []) { const m = c.match(/^\s*(\w+):(.+)$/); if (m) o[m[1]] = structuredClone(pathGet(r, m[2].trim())); } return o; };
    const run = () => {
      if (op === 'update') { const hit = rows(); for (const r of hit) Object.assign(r, structuredClone(patch), { updated_at: new Date().toISOString() }); state.writes.push({ name, op }); return { data: returning ? hit.map(project) : null, error: null }; }
      return { data: rows().map(project), error: null };
    };
    const c = {
      select: (s) => { if (op !== 'select') returning = true; cols = typeof s === 'string' ? s.split(',') : null; return c; },
      eq: (col, v) => { filters.push((r) => r[col] === v); return c; },
      neq: (col, v) => { filters.push((r) => r[col] !== v); return c; },
      gte: (col, v) => { filters.push((r) => String(r[col] ?? '') >= String(v)); return c; },
      in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return c; },
      not: (col, _is, v) => { filters.push((r) => r[col] !== v && r[col] !== undefined); return c; },
      order: (col, o) => { order = { col, asc: o?.ascending !== false }; return c; },
      limit: (n) => { lim = n; return c; },
      update: (p) => { op = 'update'; patch = p; return c; },
      maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
      then: (ok, bad) => Promise.resolve(run()).then(ok, bad),
    };
    return c;
  };
  const insert = (name, row) => {
    const t = table(name);
    const dup = (name === 'doit_request_events' && t.some((r) => r.user_id === row.user_id && r.request_id === row.request_id))
      || (name === 'doit_matches' && t.some((r) => r.user_a === row.user_a && r.user_b === row.user_b))
      || (name === 'doit_match_answers' && t.some((r) => r.match_id === row.match_id && r.user_id === row.user_id));
    if (dup) return { data: null, error: { code: '23505' } };
    if (name === 'blocks' && t.some((r) => r.blocker_id === row.blocker_id && r.blocked_user_id === row.blocked_user_id)) return { data: null, error: null };
    const now = new Date(Date.now() + t.length).toISOString();
    t.push({ id: globalThis.crypto.randomUUID(), created_at: now, updated_at: now, ...structuredClone(row) });
    state.writes.push({ name, op: 'insert' });
    return { data: null, error: null };
  };
  return {
    auth: { getUser: async () => ({ data: { user: state.users[state.current] }, error: null }), admin: { listUsers: async () => ({ data: { users: Object.values(state.users) }, error: null }) } },
    from: (name) => Object.assign(chain(name), { insert: async (row) => insert(name, row), upsert: async (row) => insert(name, row) }),
    rpc: async (fn, a) => {
      if (fn !== 'doit_apply_record_create') return { data: null, error: { message: 'unknown rpc' } };
      const recs = table('doit_records'); const dup = recs.find((r) => r.user_id === a.p_user_id && r.request_id === a.p_request_id);
      if (dup) return { data: { ok: true, duplicate: true, record: dup }, error: null };
      const rec = { id: `rec-${recs.length + 1}`, user_id: a.p_user_id, request_id: a.p_request_id, text: a.p_text, status: a.p_status, created_at: new Date().toISOString() };
      recs.push(rec); return { data: { ok: true, record: rec }, error: null };
    },
    storage: { from: () => ({ createSignedUrl: async (p) => ({ data: { signedUrl: `https://signed/${p}` }, error: null }) }) },
  };
}

// ── AI: 실제 OpenAI(시험 키) 또는 대본
const cannedTurn = (input) => {
  const t = String(input?.latest ?? input?.text ?? '');
  const ex = [];
  if (/카페/.test(t)) ex.push({ purpose: 'attraction_comfort', note: '조용한 카페에서 이야기하는 걸 좋아함', quote: '조용한 카페에서 오래 이야기하는 걸 좋아해요' });
  if (/매일/.test(t) && !/부담/.test(t)) ex.push({ purpose: 'relationship_style', note: '매일 연락하는 게 좋음', quote: '연락은 매일 하는 게 좋아요' });
  if (/주말/.test(t)) ex.push({ purpose: 'relationship_style', note: '주말에 한두 번 연락', quote: '주말에 한두 번 연락하는 게 좋아요' });
  if (/친구/.test(t)) ex.push({ purpose: 'relationship_intent', note: '친구처럼 편한 사이', quote: '친구처럼 편하게 대화하는 사이를 원해요' });
  if (/사람 많은/.test(t)) ex.push({ purpose: 'boundaries', note: '사람 많은 곳을 싫어함', quote: '사람 많은 데는 좀 그래요' });
  if (/천천히/.test(t)) ex.push({ purpose: 'values_character', note: '천천히 알아가기', quote: '천천히 알아가고 싶어요' });
  const kind = /그런 뜻 아니/.test(t) ? 'repair' : /여기까지/.test(t) ? 'stop' : 'answer';
  return { kind, understood: '', reply: '그렇군요.', extracted: kind === 'answer' ? ex : [], inferred: [{ trait: '외향적인 편', basis: '카페' }], declared: null, wrong: kind === 'repair' ? ['조용한 카페에서 이야기하는 걸 좋아함', '사람 많은 곳을 싫어함'] : [], next: { type: 'core', purpose: 'values_character', question: `사람을 볼 때 뭘 먼저 봐요 ${seq}?` } };
};
async function canned(url, init) {
  const body = JSON.parse(init.body); const sys = body.messages[0].content; const input = (() => { try { return JSON.parse(body.messages[1].content); } catch { return {}; } })();
  let out;
  if (/첫 질문을 만든다|처음으로 서로에게 답할 질문/.test(sys)) out = { question: '둘이 같이 가 보고 싶은 곳은 어디예요?' };
  else if (input && 'latest' in input) out = cannedTurn(input);
  else if (Array.isArray(input?.heard) && /"closing"/.test(sys)) out = { summary: [], closing: '정리해 둘게요.', intro: input.heard.slice(0, 2).map((h) => ({ text: `${h.quote}.`.replace(/요\.$/, '요.'), basis: h.quote })) };
  else if (Array.isArray(input?.heard)) out = { intro: input.heard.slice(0, 2).map((h) => ({ text: `저는 ${h.note} 편이에요.`, basis: h.quote })) };
  else out = cannedTurn(input);
  return new Response(JSON.stringify({ model: 'canned', usage: { prompt_tokens: 0, completion_tokens: 0 }, choices: [{ message: { content: JSON.stringify(out) } }] }), { status: 200 });
}
const aiFetch = async (url, init) => { state.aiCalls++; return REAL ? fetch(url, init) : canned(url, init); };

// ── 서버 함수 적재(실제 파일 · 의존: supabase 클라이언트 → 메모리 DB, 같은 폴더·옆 함수 순수 모듈만 허용)
function loadFn(dir, env) {
  const compile = (f) => ts.transpileModule(readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const local = (file) => { const mod = { exports: {} }; vm.runInNewContext(compile(file), { exports: mod.exports, module: mod, console, require: (n) => { if (n.startsWith('.')) return local(path.join(path.dirname(file), n)); throw new Error(`Unexpected dependency ${n}`); } }, { filename: file }); return mod.exports; };
  let handler = null;
  const sandbox = {
    exports: {}, module: { exports: {} }, console: { log: () => {}, error: () => {} },
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'canned', OPENAI_MODEL: process.env.OPENAI_MODEL || '', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', ...env })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (n) => { if (n.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb() }; if (n.startsWith('.')) return local(path.join(dir, n)); throw new Error(`Unexpected dependency ${n}`); },
    fetch: aiFetch, crypto: globalThis.crypto, TextEncoder, Request, Response, Headers, URL, AbortController, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, Error, RegExp,
  };
  vm.runInNewContext(compile(path.join(dir, 'index.ts')), sandbox, { filename: path.join(dir, 'index.ts') });
  return async (who, payload) => { state.current = who; const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(payload) })); return { status: res.status, body: await res.json() }; };
}
const FN = path.join(path.dirname(new URL(import.meta.url).pathname), '../supabase/functions');
// 매칭 재료 함수(doit-connect agentSource.ts · MATCH_SOURCE=agent 경로)를 직접 불러 같은 규칙으로 확인한다.
const AS = (() => { const { mkdtempSync } = require('node:fs'); const os = require('node:os'); const d = mkdtempSync(path.join(os.tmpdir(), 'as-'));
  const em = (src, out, fix = (x) => x) => { const f = path.join(d, out); writeFileSync(f, fix(ts.transpileModule(readFileSync(path.join(FN, src), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)); return f; };
  em('doit-agent/matching.ts', 'matching.cjs'); return require(em('doit-connect/agentSource.ts', 'agentSource.cjs', (x) => x.replace('"../doit-agent/matching.ts"', '"./matching.cjs"'))); })();
const agent = loadFn(path.join(FN, 'doit-agent'), {});

// ── 결과
const log = []; const checks = [];
const check = (id, ok, detail = '') => { checks.push({ id, result: ok === null ? 'INVALID' : ok ? 'PASS' : 'FAIL', detail }); };
const rejections = []; const xslot = {};
const say = async (who, sid, text, extra = {}) => {
  const r = await agent(who, { action: 'agent_turn', requestId: rid(), sessionId: sid, text, ...extra });
  log.push({ who: who === ID.a ? 'A' : 'B', text, status: r.status, kind: r.body.turn?.kind ?? null, reply: r.body.turn?.reply ?? null, question: r.body.turn?.question ?? null, saved: r.body.turn?.saved ?? null, error: r.body.code ?? null });
  return r;
};
const sessionOf = (uid) => state.tables.doit_request_events.find((r) => r.user_id === uid && r.action === 'agent_session')?.response_payload;
const live = (st, id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED');
const sq = (t) => String(t ?? '').replace(/\s/g, '');

async function run() {
  // 사용자 A: 일반 답 → A 확정(매일) → AI 오해 거절 → 마침 → 화면 정정(주말) = B
  const sa = await agent(ID.a, { action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구처럼 편하게 대화하는 사이를 원해요' });
  log.push({ who: 'A', text: '(시작) 친구처럼 편하게 대화하는 사이를 원해요', status: sa.status, reply: sa.body.session?.last?.reply ?? null, question: sa.body.session?.question ?? null, error: sa.body.code ?? null });
  const sidA = sa.body.session?.id; if (!sidA) { console.error("START_FAIL", JSON.stringify(sa).slice(0, 600)); }
  await say(ID.a, sidA, '조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(ID.a, sidA, '연락은 매일 하는 게 좋아요');
  const beforeReject = structuredClone(sessionOf(ID.a).state);
  await say(ID.a, sidA, '아니 그런 뜻 아니야');
  await say(ID.a, sidA, '오늘은 여기까지 할게요');
  const stA1 = sessionOf(ID.a).state;
  const oldDaily = live(stA1, 'relationship_style').map((i) => ({ note: i.note, quote: i.quote, turn: i.turn }));
  const fix = await say(ID.a, sidA, '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요', { correction: { purpose: 'relationship_style' } });
  const A = sessionOf(ID.a);

  // 사용자 B: 일반 답 → A 와 겹치는 확정 정보 → 마침
  const sb = await agent(ID.b, { action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구처럼 편하게 대화하는 사이를 원해요' });
  const sidB = sb.body.session?.id;
  await say(ID.b, sidB, '조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(ID.b, sidB, '천천히 알아가고 싶어요');
  await say(ID.b, sidB, '오늘은 여기까지 할게요');
  const B = sessionOf(ID.b);

  // ── 확인: 정정 · 거절 · Profile · 소개
  const styleNow = live(A.state, 'relationship_style');
  check('정정: 화면 정정이 정정으로 확정', fix.body.turn?.kind === 'correction', `kind=${fix.body.turn?.kind}`);
  check('정정: A 최신 값 = 주말(B)', styleNow.length >= 1 && styleNow.every((i) => /주말/.test(i.note + i.quote)), JSON.stringify(styleNow.map((i) => i.note)));
  check('정정: 옛 값(매일)이 지금 값에서 빠짐(SUPERSEDED)', oldDaily.every((o) => A.state.slots.relationship_style.items.some((i) => i.turn === o.turn && i.note === o.note && i.status === 'SUPERSEDED')), JSON.stringify({ old: oldDaily, now: A.state.slots.relationship_style.items.map((i) => [i.note, i.status]) }));
  const rejected = A.profile?.rejected_meanings ?? [];
  const retracted = Object.values(A.state.slots).flatMap((s) => s.items.filter((i) => i.status === 'RETRACTED').map((i) => i.note));
  const allLive = Object.values(A.state.slots).flatMap((s) => s.items.filter((i) => i.status === 'CONFIRMED').map((i) => i.note));
  check('거절: 거둔 뜻이 지금 사실에 없음', retracted.every((r) => !allLive.includes(r)), JSON.stringify({ retracted, before: Object.values(beforeReject.slots).flatMap((s) => s.items.map((i) => [i.note, i.status])) }));
  check('거절: 거절 턴은 사실 저장 0', log.find((l) => l.text === '아니 그런 뜻 아니야')?.saved === false, JSON.stringify(log.find((l) => l.text === '아니 그런 뜻 아니야')));
  check('Profile: 매칭 프로필 = 지금 CONFIRMED 만', A.profile && ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'].every((id) => (A.profile[id].items ?? []).every((i) => i.status === 'CONFIRMED')), '');
  check('Profile: 매칭 프로필 relationship_style = 주말만', (A.profile?.relationship_style?.items ?? []).length >= 1 && (A.profile.relationship_style.items).every((i) => /주말/.test(i.note + i.quote)), JSON.stringify(A.profile?.relationship_style?.items?.map((i) => i.note)));
  // 다른 칸 정정(v2.2.2): 옛 「매일」 원문과 같은 출처(같은 턴 · 같은 원문)의 값이 어느 칸에도 지금 값으로 남지 않는다.
  const bq = (t) => sq(t).replace(/[.,!?~…·"'「」]/g, '');
  const oldSrc = oldDaily.map((o) => ({ turn: o.turn, q: bq(o.quote) }));
  const crossCopies = Object.entries(stA1.slots).flatMap(([id, s]) => s.items.filter((i) => id !== 'relationship_style' && oldSrc.some((o) => o.turn === i.turn && o.q === bq(i.quote))).map((i) => ({ id, note: i.note, turn: i.turn })));
  const crossNow = crossCopies.map((c) => ({ ...c, status: A.state.slots[c.id].items.find((i) => i.turn === c.turn && i.note === c.note)?.status }));
  xslot.precondition = crossCopies.length > 0; xslot.copies = crossNow;
  check('다른 칸 정정: 같은 출처 옛 값이 다른 칸에 지금 값으로 남지 않음' + (crossCopies.length ? '' : ' [전제 없음 · 이번 실행은 다른 칸 복제가 생기지 않음]'), crossNow.every((c) => c.status === 'SUPERSEDED'), JSON.stringify(crossNow));
  const srcA = AS.sourceFromProfile(A.profile, A.phase ?? A.state.phase, null);
  check('다른 칸 정정: A 매칭 재료에 옛 「매일」 0 · 최신 「주말」 있음', !srcA.confirmed.some((n) => /매일/.test(n) && !/부담|주말/.test(n)) && srcA.confirmed.some((n) => /주말/.test(n)), JSON.stringify(srcA.confirmed));
  const introA = (A.state.intro?.lines ?? []).map((l) => `${l.text}〔${l.basis}〕`).join(' / ');
  check('소개: 옛 값(매일 연락) 근거 문장 0', !(A.state.intro?.lines ?? []).some((l) => oldDaily.some((o) => sq(l.basis) === sq(o.quote)) || (/매일/.test(l.text) && !/부담|주말/.test(l.text))), introA);
  check('소개: 상태 ready 또는 비어 있음(옛 값 유지 아님)', ['ready', 'failed', 'none'].includes(A.state.intro?.status), `status=${A.state.intro?.status}`);

  // ── Matching(MATCH_SOURCE=agent · 운영 기본 legacy 도 대조)
  const legacyConnect = loadFn(path.join(FN, 'doit-connect'), {});
  const legacy = await legacyConnect(ID.admin, { action: 'admin_candidates' });
  const connect = loadFn(path.join(FN, 'doit-connect'), { MATCH_SOURCE: 'agent' });
  const cand = await connect(ID.admin, { action: 'admin_candidates' });
  const pair = (cand.body.candidates ?? []).find((c) => [c.user_a, c.user_b].sort().join() === [ID.a, ID.b].sort().join());
  const commonAll = [...(pair?.common_a ?? []), ...(pair?.common_b ?? [])];
  check('Matching(legacy · 지금 운영 기본): Agent 사용자 후보 0 = 끊김 재현', (legacy.body.candidates ?? []).length === 0, `candidates=${(legacy.body.candidates ?? []).length}`);
  check('Matching(agent): A-B 후보 생성', !!pair, JSON.stringify({ eligible: cand.body.eligible, missing: cand.body.missing, n: (cand.body.candidates ?? []).length }));
  check('Matching(agent): 겹친 말 > 0', !!pair && pair.no_common === false && commonAll.length > 0, JSON.stringify(commonAll));
  const aStyleOld = oldDaily.map((o) => o.note);
  const commonA = pair ? (pair.user_a === ID.a ? pair.common_a : pair.common_b) : []; // A 쪽 재료(B 가 스스로 한 같은 말은 B 의 사실)
  check('Matching: A 의 밀린 값(매일)·거둔 뜻 사용 0', !commonA.some((c) => aStyleOld.includes(c) || retracted.includes(c)), JSON.stringify({ commonA, aStyleOld, retracted }));
  const inferred = [...(A.profile?.inferred_candidates ?? []), ...(B.profile?.inferred_candidates ?? [])].map((x) => x.trait);
  check('Matching: AI 추정 사용 0', !commonAll.some((c) => inferred.includes(c)), JSON.stringify({ inferred }));
  check('Matching: 사주·타로 사용 0', !commonAll.some((c) => /사주|타로|운세|궁합/.test(c)), '');
  check('전화: A 는 전화 미인증인데 후보에 포함', !!pair && pair[pair.user_a === ID.a ? 'a' : 'b']?.phone_verified === false, JSON.stringify(pair ? { a: pair.a, b: pair.b } : null));
  check('전화: verification_status 그대로', state.tables.profiles.find((p) => p.id === ID.a).verification_status === 'pending' && !state.writes.some((w) => w.name === 'profiles'), '');

  // ── 상호 공개(현재 구현: 대표 승인 → 두 사람이 모두 첫 질문에 답하면 서로 열림 · 사용자 간 「선택」 버튼은 없음)
  const dec = await connect(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve', ...(pair?.no_common ? { noCommonOk: true } : {}) });
  const match = state.tables.doit_matches[0];
  check('연결: 대표 승인 → 연결 생성 · 첫 질문', dec.status === 200 && !!match?.first_question, JSON.stringify({ status: dec.status, code: dec.body.code ?? null, first_question: match?.first_question ?? null, source: dec.body.question_source ?? null }));
  if (match) {
    const before = await connect(ID.a, { action: 'my_matches' });
    await connect(ID.a, { action: 'answer', matchId: match.id, text: '한강 산책길이요' });
    const mid = await connect(ID.a, { action: 'my_matches' });
    await connect(ID.b, { action: 'answer', matchId: match.id, text: '조용한 북카페요' });
    const both = await connect(ID.a, { action: 'my_matches' });
    check('상호 공개: 둘 다 답하기 전에는 상대 정보 0', before.body.matches?.[0]?.revealed === false && mid.body.matches?.[0]?.revealed === false && !('partner' in (mid.body.matches?.[0] ?? {})), '');
    check('상호 공개: 둘 다 답하면 서로 열림(이야기 가능)', both.body.matches?.[0]?.revealed === true, JSON.stringify({ revealed: both.body.matches?.[0]?.revealed }));
    const msg = await connect(ID.a, { action: 'message', matchId: match.id, text: '반가워요' });
    check('연결 열림: 이야기 보내기', msg.status === 200, `status=${msg.status}`);
    const blockedContent = await connect(ID.a, { action: 'message', matchId: match.id, text: '010-1234-5678 로 연락 주세요' });
    check('안전: 연락처 막기', blockedContent.body.code === 'BLOCKED_CONTENT', '');
    const leave = await connect(ID.b, { action: 'leave', matchId: match.id, block: true, report: true });
    const after = await connect(ID.admin, { action: 'admin_candidates' });
    const again = await connect(ID.admin, { action: 'admin_decide', userA: ID.a, userB: ID.b, decision: 'approve', noCommonOk: true });
    check('안전: 그만하기·차단·신고 → 닫힘 · 신고 기록 · 다시 후보 0 · 재승인 409', leave.status === 200 && state.tables.doit_matches[0].status === 'closed' && state.tables.user_reports.length === 1 && (after.body.candidates ?? []).length === 0 && again.status === 409, JSON.stringify({ leave: leave.status, reports: state.tables.user_reports.length, cands: (after.body.candidates ?? []).length, again: again.status }));
  }

  // ── 실제 AI 거절(재설계): ① 사용자 말 → ② AI 가 해석 A 저장 → ③ A 가 서버 상태에 실제로 있는지 ASSERT(없으면 TEST INVALID) → ④ 「아니, 그런 뜻 아니야」 → ⑤ A 거둠 → ⑥ 다음 응답·Profile·소개·Matching 에 A 0
  for (const [k, utter] of REJECT_CASES.entries()) {
    const uid = RID[k];
    const st0 = await agent(uid, { action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구처럼 편하게 대화하는 사이를 원해요' });
    const sid = st0.body.session?.id;
    const r1 = await say(uid, sid, utter);
    const s1 = structuredClone(sessionOf(uid).state);
    const n1 = s1.turns.length;
    const interp = Object.entries(s1.slots).flatMap(([id, s]) => s.items.filter((i) => i.turn === n1 && i.status === 'CONFIRMED' && i.source_type === 'AI_EXTRACTED').map((i) => ({ id, note: i.note, quote: i.quote })));
    const rec = { case: `R${k + 1}`, utter, ai_reply: r1.body.turn?.reply ?? null, interpretation: interp, precondition: interp.length > 0 };
    rejections.push(rec);
    if (!rec.precondition) { rec.verdict = 'TEST INVALID(확인 불가)'; check(`거절 R${k + 1}: 전제(AI 해석 저장) 성립`, null, JSON.stringify(rec)); continue; }
    const r2 = await say(uid, sid, '아니, 그런 뜻 아니야');
    const s2 = sessionOf(uid).state;
    rec.reject_kind = r2.body.turn?.kind ?? null; rec.next_reply = r2.body.turn?.reply ?? null; rec.next_question = r2.body.turn?.question ?? null;
    rec.after = interp.map((a) => ({ ...a, status: s2.slots[a.id].items.find((i) => i.turn === n1 && i.note === a.note)?.status }));
    const retractedAll = rec.after.every((a) => a.status === 'RETRACTED');
    const mentions = (t) => interp.some((a) => sq(a.note).length >= 4 && sq(t).includes(sq(a.note)));
    const r3 = await say(uid, sid, '오늘은 여기까지 할게요');
    const fin = sessionOf(uid);
    const prof = fin.profile ?? {};
    const intro = (fin.state.intro?.lines ?? []);
    const src = AS.sourceFromProfile(prof, fin.state.phase, null);
    rec.profile_confirmed = prof.confirmed_preferences ?? []; rec.rejected_meanings = prof.rejected_meanings ?? []; rec.intro = intro.map((l) => `${l.text}〔${l.basis}〕`); rec.matching = src.confirmed; rec.closing_reply = r3.body.turn?.reply ?? null;
    const reused = [rec.next_reply, rec.next_question, r3.body.turn?.reply, ...intro.map((l) => l.text)].some((t) => t && mentions(t));
    const inProfile = interp.some((a) => (prof.confirmed_preferences ?? []).includes(a.note));
    const inMatch = interp.some((a) => src.confirmed.includes(a.note));
    rec.verdict = retractedAll && !reused && !inProfile && !inMatch ? 'PASS' : 'FAIL';
    check(`거절 R${k + 1}: 해석 A 거둠(RETRACTED)`, retractedAll, JSON.stringify(rec.after));
    check(`거절 R${k + 1}: 다음 응답·소개에 A 재등장 0`, !reused, JSON.stringify({ reply: rec.next_reply, question: rec.next_question, intro: rec.intro }));
    check(`거절 R${k + 1}: Profile·Matching 에 A 0`, !inProfile && !inMatch, JSON.stringify({ profile: rec.profile_confirmed, matching: rec.matching }));
  }

  // ── 관리자(대표 화면이 부르는 서버 응답)
  const adm = await agent(ID.admin, { action: 'admin_sessions' });
  const sessions = adm.body.sessions ?? [];
  check('관리자: 대화 목록에 모든 시험 사용자 · Agent 판', adm.status === 200 && sessions.length === 2 + RID.length && sessions.every((s) => s.stored?.agent === 'echo-agent-v2.2.2'), JSON.stringify({ status: adm.status, n: sessions.length, versions: sessions.map((s) => s.stored?.agent) }));
  check('관리자: 턴 기록(오류 표시 재료)', (adm.body.turns ?? []).length > 0 || sessions.every((s) => (s.turns ?? []).length > 0), `turns=${(adm.body.turns ?? []).length}`);
  const turnErrors = state.tables.doit_request_events.filter((r) => r.action === 'agent_turn' && r.status === 'failed').length;
  check('대화 오류 0(AI 실패 턴 없음)', turnErrors === 0, `failed_turns=${turnErrors}`);

  const summary = { mode: REAL ? 'REAL_OPENAI' : 'CANNED(구조 확인용)', model_env: process.env.OPENAI_MODEL || '(기본값 → gpt-4o-mini)', served_models: [...new Set(state.tables.doit_request_events.flatMap((r) => (r.response_payload?.record?.calls ?? []).map((c) => c.model)).filter(Boolean))], ai_calls: state.aiCalls,
    pass: checks.filter((c) => c.result === 'PASS').length, fail: checks.filter((c) => c.result === 'FAIL').length, invalid: checks.filter((c) => c.result === 'INVALID').length, rejections, cross_slot: xslot, checks, conversation: log,
    profiles: { A: { style: A.state.slots.relationship_style.items.map((i) => [i.note, i.status, i.source_type]), all: Object.fromEntries(Object.entries(A.state.slots).map(([k, s]) => [k, s.items.map((i) => [i.note, i.status])])), intro: introA, rejected_meanings: rejected }, B: { all: Object.fromEntries(Object.entries(B.state.slots).map(([k, s]) => [k, s.items.map((i) => [i.note, i.status])])) } },
    matching: { legacy_candidates: (legacy.body.candidates ?? []).length, agent_candidate: pair ?? null } };
  const text = JSON.stringify(summary, null, 1);
  if (OUT) writeFileSync(OUT, text);
  console.log(text);
  process.exitCode = summary.fail ? 1 : 0;
}
await run();
