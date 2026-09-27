// 2026-09-26 P0 「그게 아니에요」 정정 역전 결함 — 회귀 검사(가짜 AI · 가짜 DB 기준, 실제 OpenAI 호출 0).
//
// 결함: 옛 흐름(get-step-question choose=no)이 사용자가 쓴 정정 B 를 self/rejected 로, 틀린 AI 해석 A 를 ai_text 에만 저장했다.
//   doit-understanding 은 거절 행의 text·ai_text 를 모두 거절 목록에 넣어, 사용자 자신의 말(B)이 차단 목록에 들어갔다.
// 고친 뒤: A = ai/rejected, B = self/corrected(insert 한 번). 과거 서명 행(self · rejected · ai_text 있음 · text ≠ ai_text)은
//   읽을 때 ai_text 만 거절로 본다(DB UPDATE 0).
// 이 검사가 보지 못하는 것: 실제 OpenAI 가 쓰는 문장, 운영 DB(과거 54행은 건드리지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

const A = '인정받고 싶은 마음이 크신 것 같아요.';         // 틀린 AI 해석
const B = '사실은 몸이 피곤해서 그런 거예요';              // 사용자 정정

// ── 옛 흐름(get-step-question) — 실제 서버 코드를 가짜 DB 로 끝까지 돈다 ──
function createAiFetch() {
  const fetch = async (_url, options = {}) => {
    const request = JSON.parse(options.body);
    const system = String(request.messages?.[0]?.content ?? '');
    let content;
    if (request.response_format) {
      content = JSON.stringify({ candidates: [{ acknowledgement: '피곤하셨군요.', question: '그 피곤함은 하루 중 언제 가장 크게 올라오나요?', anchor: '피곤해서', assumptions: [], meaning: '피로가 드러나는 때', keys: ['피로'], reply: '' }] });
    } else if (system.includes('요약해라')) {
      content = A;
    } else {
      content = ['1. 오늘 편안한 마음은 어떤 순간에 가장 크게 느껴지나요?', '2. 일이 끝나서 달라진 점은 무엇인가요?', '3. 정리가 되니까 좋다는 건 어떤 뜻인가요?'].join('\n');
    }
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch };
}

async function atUnderstanding(label) {
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, createAiFetch());
  const u = `user-${label}`;
  const started = await invoke(early, u, { action: 'start', mindText: '오늘은 마음이 편안해요', token: token(`${label}-start`) });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token(`${label}-ask1`) });
  await invoke(early, u, { action: 'answer', conversationId, answer: '일이 끝나서 그런 것 같아요', token: token(`${label}-ans1`) });
  await invoke(early, u, { action: 'ask', conversationId, token: token(`${label}-ask2`) });
  await invoke(early, u, { action: 'answer', conversationId, answer: '정리가 되니까 좋아요', token: token(`${label}-ans2`) });
  const summary = await invoke(early, u, { action: 'ask', conversationId, token: token(`${label}-under`) });
  assert.equal(summary.body.understanding, A);
  const choose = (choice, text, tok = `${label}-${choice}`) => invoke(early, u, { action: 'choose', conversationId, choice, text, token: token(tok) });
  const insights = () => db.rows.doit_insights.filter((r) => r.user_id === u);
  return { db, choose, insights };
}

test('T1 맞아요 → AI 해석이 ai/confirmed 한 행', async () => {
  const s = await atUnderstanding('t1');
  const res = await s.choose('agree', '');
  assert.equal(res.body.status, 'step3');
  const rows = s.insights();
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].text, rows[0].origin, rows[0].status, rows[0].category], [A, 'ai', 'confirmed', 'memory']);
});

test('T2 그게 아니에요 + 글 없음 → BAD_REQUEST · 새 이해 0', async () => {
  const s = await atUnderstanding('t2');
  const res = await s.choose('no', '');
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, 'BAD_REQUEST');
  assert.equal(s.insights().length, 0);
});

test('T3 그게 아니에요 + 정정 B → A = ai/rejected, B = self/corrected (B 는 거절 행이 아님)', async () => {
  const s = await atUnderstanding('t3');
  const res = await s.choose('no', B);
  assert.equal(res.body.status, 'followup');
  const rows = s.insights();
  assert.equal(rows.length, 2, 'insert 한 번에 두 행');
  const rejected = rows.filter((r) => r.status === 'rejected');
  const corrected = rows.filter((r) => r.status === 'corrected');
  assert.equal(rejected.length, 1);
  assert.deepEqual([rejected[0].text, rejected[0].origin, rejected[0].ai_text, rejected[0].source_text], [A, 'ai', A, A]);
  assert.equal(corrected.length, 1);
  assert.deepEqual([corrected[0].text, corrected[0].origin, corrected[0].ai_text, corrected[0].source_text], [B, 'self', A, A]);
  assert.ok(!rejected.some((r) => r.text === B), '사용자 정정은 거절 행이 아니다');
  // 옛 흐름 전용 표(understanding_results)는 그대로: 거절한 해석 = A, 정정 = B
  const und = s.db.rows.understanding_results.at(-1);
  assert.deepEqual([und.rejected_interpretation, und.correction_text], [A, B]);
});

test('T4 조금 달라요 + B → B = self/corrected 한 행 · 직접 설명도 그대로(기존 동작 변화 0)', async () => {
  const s = await atUnderstanding('t4');
  await s.choose('alittle', B);
  assert.deepEqual(s.insights().map((r) => [r.text, r.origin, r.status, r.ai_text]), [[B, 'self', 'corrected', A]]);
  const e = await atUnderstanding('t4e');
  await e.choose('explain', B);
  assert.deepEqual(e.insights().map((r) => [r.text, r.origin, r.status, r.ai_text]), [[B, 'self', 'corrected', A]]);
});

test('T8 같은 요청 다시 보내기 → 이해 행 증가 0', async () => {
  const s = await atUnderstanding('t8');
  await s.choose('no', B, 't8-same');
  const before = s.insights().length;
  const again = await s.choose('no', B, 't8-same');
  assert.equal(again.body.ok, true);
  assert.equal(s.insights().length, before, '중복 저장 0');
  assert.equal(before, 2);
});

// ── doit-understanding 읽기 보정 ──
const DU = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
function extractFn(name) {
  const start = DU.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} 없음`);
  let depth = 0; let i = DU.indexOf('{', DU.indexOf(')', start));
  for (; i < DU.length; i++) { if (DU[i] === '{') depth++; else if (DU[i] === '}' && --depth === 0) break; }
  const js = ts.transpileModule(DU.slice(start, i + 1), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(`(${js.replace(/^function/, 'function')})`);
}
let sandboxed = null; // 검사마다 따로 실패하도록 처음 쓸 때 꺼낸다
const rejectedMeaningTexts = (row) => [...(sandboxed ??= extractFn('rejectedMeaningTexts'))(row)]; // vm 안에서 만든 배열을 이쪽 배열로(deepStrictEqual 은 프로토타입까지 본다)
const fixedRows = [
  { text: A, ai_text: A, source_text: A, status: 'rejected', origin: 'ai' },
  { text: B, ai_text: A, source_text: A, status: 'corrected', origin: 'self' },
];
const LEGACY_B = '저는 주말에 산책하는 걸 좋아해요';
const legacyRow = { text: LEGACY_B, ai_text: A, source_text: A, status: 'rejected', origin: 'self' };

test('T5 T3 뒤 거절 목록(followupEvidence · userMeanings 공용 규칙) → A 는 거절, B 는 아님', () => {
  const blocked = fixedRows.flatMap((r) => rejectedMeaningTexts(r));
  assert.deepEqual(blocked, [A]);
  // 세 곳이 모두 같은 규칙을 쓰고, 옛 방식(text·ai_text 를 둘 다 막기)은 남아 있지 않다.
  assert.equal((DU.match(/rejectedMeaningTexts\(/g) ?? []).length, 4, '정의 1 + followupEvidence · userMeanings · profile_draft 3');
  assert.doesNotMatch(DU, /for \(const value of \[text, row\.ai_text\]\)/);
  assert.doesNotMatch(DU, /for \(const t of \[text, String\(row\.ai_text \?\? ""\)\.trim\(\)\]\)/);
  assert.match(DU, /select\("text, ai_text, status, origin, created_at"\)\.eq\("user_id", userId\)\.in\("status", \["confirmed", "corrected", "rejected"\]\)/, 'profile_draft 가 origin·ai_text 를 읽어야 보정이 동작한다');
  // 다른 모양은 그대로: AI 거절 = 그 문장 / 새 규칙 없는 상태는 막지 않음
  assert.deepEqual(rejectedMeaningTexts({ text: '혼자 있는 시간을 싫어하는 사람', status: 'rejected', origin: 'ai' }), ['혼자 있는 시간을 싫어하는 사람']);
  assert.deepEqual(rejectedMeaningTexts({ text: '내 말', status: 'rejected', origin: 'self' }), ['내 말'], 'ai_text 없는 self 거절(사용자가 자기 말을 거둠)은 그대로 막는다');
  assert.deepEqual(rejectedMeaningTexts({ text: B, ai_text: A, status: 'corrected', origin: 'self' }), []);
});

test('T9 과거 서명 행(self/rejected + ai_text) → ai_text 만 거절, 사용자 text 는 막지 않음', () => {
  assert.deepEqual(rejectedMeaningTexts(legacyRow), [A]);
  assert.ok(!rejectedMeaningTexts(legacyRow).includes(LEGACY_B));
});

// profile_draft — 실제 서버 코드를 가짜 AI·가짜 DB 로 돈다(server-conversation-flow 와 같은 방식).
const USER = '11111111-1111-4111-8111-111111111111';
const ANSWERS = [
  '친구처럼 편하게 지낼 사람을 만나고 싶어요', '말이 잘 통하고 약속을 잘 지키는 사람이 좋아요', '주말에 같이 산책하고 전시 보러 가고 싶어요',
  '저는 처음엔 조용한데 친해지면 말이 많아요', '천천히 알아가는 게 좋아요',
].map((text, i) => ({ id: `a${i}`, text, created_at: `2026-09-23T01:0${i}:00Z` }));
function loadDraft(insights, lines) {
  const state = { records: ANSWERS, insights, events: [], profiles: [{ id: USER, purpose_label: '친구' }], sent: null };
  const chain = (rows) => {
    let f = rows;
    const c = {
      select: () => c, order: () => c, limit: () => c,
      in: (col, vals) => { f = f.filter((r) => !(col in r) || vals.includes(r[col])); return c; },
      eq: (col, v) => { f = f.filter((r) => !(col in r) || r[col] === v); return c; },
      gte: (col, v) => { f = f.filter((r) => !(col in r) || r[col] >= v); return c; },
      maybeSingle: () => Promise.resolve({ data: f[0] ?? null, error: null }),
      then: (ok) => ok({ data: f, error: null }),
    };
    return c;
  };
  const tables = { doit_records: state.records, doit_insights: state.insights, profiles: state.profiles, doit_request_events: state.events };
  const db = { auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: {} } }, error: null }) }, from: (t) => chain(tables[t] ?? []), rpc: async () => ({ data: null, error: null }) };
  let handler = null;
  const compiled = ts.transpileModule(DU, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, {
    exports: {}, console: { log: () => {}, error: () => {} }, setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => db }; throw new Error(name); },
    fetch: async (_u, init) => {
      const body = JSON.parse(init.body);
      state.sent = JSON.parse(body.messages[1].content);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ lines }) } }] }), { status: 200 });
    },
  }, { filename: 'doit-understanding.ts' });
  const call = async () => {
    const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), action: 'profile_draft' }) }));
    return res.json();
  };
  return { call, state };
}
const at = (row, i) => ({ ...row, user_id: USER, created_at: `2026-09-23T01:1${i}:00Z` });

test('T6 profile_draft: T3 뒤 B 는 재료·문장으로 쓰이고 A 는 쓰이지 않는다', async () => {
  const { call, state } = loadDraft(fixedRows.map(at), [
    { text: '저는 인정받고 싶은 마음이 크신 것 같아요.', basis: '천천히 알아가는 게 좋아요' },     // A 와 같은 문장 → 버림
    { text: '사실은 몸이 피곤해서 그런 거예요.', basis: B },                                     // B 근거 → 통과
  ]);
  const body = await call();
  assert.equal(body.ok, true);
  assert.deepEqual(body.lines.map((l) => l.text), ['사실은 몸이 피곤해서 그런 거예요.']);
  assert.deepEqual(state.sent.confirmed, [B], '재료(confirmed)에 B 는 있고 A 는 없다');
});

test('T9 profile_draft: 과거 서명 행의 사용자 말은 막지 않고 AI 해석만 막는다', async () => {
  const { call } = loadDraft([at(legacyRow, 0)], [
    { text: '저는 주말에 산책하는 걸 좋아해요.', basis: '주말에 같이 산책하고 전시 보러 가고 싶어요' },   // 사용자 말과 같은 문장 → 이제 통과
    { text: '저는 인정받고 싶은 마음이 크신 것 같아요.', basis: '천천히 알아가는 게 좋아요' },          // AI 해석 → 버림
  ]);
  const body = await call();
  assert.equal(body.ok, true);
  assert.deepEqual(body.lines.map((l) => l.text), ['저는 주말에 산책하는 걸 좋아해요.']);
});

// doit-connect — 매칭이 읽는 상태 필터를 실제 코드에서 꺼내 T3 의 행에 적용한다(연결 서버 전체를 돌리지는 않는다).
test('T7 doit-connect: T3 뒤 B 는 매칭 재료 · A 는 제외', async () => {
  const src = readFileSync('supabase/functions/doit-connect/index.ts', 'utf8');
  const m = src.match(/from\("doit_insights"\)\.select\([^)]*\)\.in\("user_id", ids\)\.in\("status", (\[[^\]]*\])\)/);
  assert.ok(m, 'doit-connect 의 doit_insights 읽기 필터를 찾지 못함');
  const statuses = JSON.parse(m[1]);
  const s = await atUnderstanding('t7');
  await s.choose('no', B);
  const used = s.insights().filter((r) => statuses.includes(r.status)).map((r) => r.text);
  assert.deepEqual(used, [B]);
});
