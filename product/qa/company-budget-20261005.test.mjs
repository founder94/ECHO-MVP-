// 2026-10-05 회사 한 달 AI 예산 장부 연결(company-budget.ts) — 가짜 DB·가짜 장부·가짜 AI(실제 DB·장부·제공사 0). 장부 표·함수는 아직 초안(대표 승인 전).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const source = fileURLToPath(new URL('../../', import.meta.url));
let helper = readFileSync(path.join(source, 'product/qa/agent-server.test.mjs'), 'utf8');
helper = helper.slice(0, helper.indexOf("test('로그인 안 함"));
const once = (a, b) => { assert.equal(helper.split(a).length, 2, a); helper = helper.replace(a, b); };
once("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)};`);
once("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source, 'product/supabase/functions/doit-agent/')).href + '/')});`);
once("let filters = []; let op = 'select';", "let filters = []; let faultAction = null; let op = 'select';");
once("eq: (col, v) => { filters.push", "eq: (col, v) => { if (col === 'action') faultAction = v; filters.push");
once("const run = () => {", "const run = () => { if (state.zeroClaimFinish && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.status === 'applied' && !patch.action) { state.injected = (state.injected ?? 0) + 1; return { data: [], error: null }; } if (state.failClaimFinish && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.status === 'applied' && !patch.action) { state.injected = (state.injected ?? 0) + 1; return { data: null, error: { code: 'SYNTHETIC_WRITE' } }; } if (state.failClaimUpdate && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.action === 'agent_turn') { state.injected = (state.injected ?? 0) + 1; return { data: null, error: { code: 'SYNTHETIC_WRITE' } }; }");
once("rpc: async (fn, args) => {", "rpc: async (fn, args) => { if (String(fn).startsWith('company_ai_')) { (state.ledgerCalls ??= []).push({ fn, args }); return state.ledger ? state.ledger(fn, args) : { data: null, error: { code: 'NO_LEDGER' } }; }");
helper += '\nexport {load,newState,T,Q,X,rid,ID};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'replay-durability-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid, ID } = await import(file.href);
const POLICY = JSON.stringify({ version: 'synthetic-replay', providers: { openai: { model: 'fixture', allow_user_text: true } }, tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 60000 } });
// 단가·요청당 금액 상한이 적힌 정책(회사 예산을 켤 때 필요) — 숫자는 검사용(실제 단가 아님)
const PRICED = JSON.stringify({ version: 'synthetic-priced', providers: { openai: { model: 'fixture', allow_user_text: true, price: { in_usd_per_1m: 1, out_usd_per_1m: 4 } } }, tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 60000, max_cost_usd_per_request: 0.05 } });

// 장부 흉내(초안 SQL 과 같은 규칙): 열린 달 · 중지 아님 · 확정+예약+최대 ≤ 예산 · 같은 시도 토큰만 정산
function ledger({ open = true, budget = 30000, committed = 0, paused = false } = {}) {
  const L = { open, budget, committed, reserved: 0, paused, rows: new Map() };
  const fn = (name, a) => {
    if (name === 'company_ai_reserve') {
      if (!/^[0-9a-f]{64}$/.test(a.p_request_key) || !/^[0-9a-f]{64}$/.test(a.p_fingerprint) || !a.p_attempt || !(a.p_max_krw > 0)) return { data: 'INVALID', error: null };
      if (!L.open) return { data: 'NOT_OPEN', error: null };
      if (L.paused) return { data: 'PAUSED', error: null };
      if (L.rows.has(a.p_request_key)) return { data: `DUPLICATE:${L.rows.get(a.p_request_key).status}`, error: null };
      const used = L.committed + L.reserved + a.p_max_krw;
      if (used > L.budget) return { data: 'OVER_BUDGET', error: null };
      L.rows.set(a.p_request_key, { attempt: a.p_attempt, max: a.p_max_krw, status: 'reserved' }); L.reserved += a.p_max_krw;
      return { data: `RESERVED:${used * 100 >= L.budget * 80 ? 'WARN80' : used * 100 >= L.budget * 50 ? 'CHECK50' : 'OK'}`, error: null };
    }
    if (name === 'company_ai_settle') {
      const r = L.rows.get(a.p_request_key);
      if (!r) return { data: 'NOT_FOUND', error: null };
      if (r.attempt !== a.p_attempt) return { data: 'NOT_OWNER', error: null };
      if (r.status !== 'reserved') return { data: `ALREADY:${r.status}`, error: null };
      const cost = a.p_actual_krw ?? r.max;
      r.status = a.p_actual_krw == null ? 'uncertain' : a.p_actual_krw > r.max ? 'overrun' : a.p_actual_krw === 0 ? 'released' : 'settled'; r.actual = a.p_actual_krw;
      L.reserved -= r.max; L.committed += cost; if (r.status === 'overrun') L.paused = true;
      return { data: r.status.toUpperCase(), error: null };
    }
    return { data: null, error: { code: 'UNKNOWN_FN' } };
  };
  return { L, fn };
}
const ON = { AI_POLICY: PRICED, COMPANY_AI_BUDGET: 'on', COMPANY_AI_KRW_PER_USD: '1400' };
const READING = { summary: '오늘은 조용히 마음을 정리하기 좋은 흐름이에요.', tags: ['정리'], cards: [{ label: '현재의 에너지', value: '차분함' }] };
async function start(env) {
  const s = newState(); s.env = { AI_POLICY: POLICY }; const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  s.env = env; return { s, h, sid: r.body.session.id };
}
const card = (h) => h.call({ action: 'agent_card', requestId: rid(), cardName: '별', purpose: '' });

test('회사 예산 ① 꺼져 있으면(기본) 장부 호출 0 · 지금 동작 그대로', async () => {
  const { s, h } = await start({ AI_POLICY: POLICY });
  s.ai.push(READING);
  const r = await card(h);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((s.ledgerCalls ?? []).length, 0);
});

test('회사 예산 ② 켜짐: 첫 업체 호출 직전 예약 한 번(최대 = 요청당 상한 0.05달러 × 1,400원 = 70원) → 응답 전 같은 시도 토큰으로 실제 금액 정산', async () => {
  const { s, h } = await start(ON);
  const { L, fn } = ledger(); s.ledger = fn;
  s.ai.push(READING);
  const r = await card(h);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const calls = s.ledgerCalls.map((c) => c.fn);
  assert.deepEqual(calls, ['company_ai_reserve', 'company_ai_settle']);
  const [res, set] = s.ledgerCalls.map((c) => c.args);
  assert.equal(res.p_max_krw, 70);
  assert.equal(set.p_request_key, res.p_request_key); assert.equal(set.p_attempt, res.p_attempt);
  assert.ok(set.p_actual_krw === null || (Number.isInteger(set.p_actual_krw) && set.p_actual_krw >= 0 && set.p_actual_krw <= 70), `정산 금액 ${set.p_actual_krw}`);
  assert.equal(L.reserved, 0); assert.ok(L.committed <= 70);
});

test('회사 예산 ③ 켜짐 + 장부가 막음(달 안 열림 · 중지 · 예산 초과 · 장부 응답 없음) = 503 AI_COMPANY_BUDGET · 업체 호출 0 · 정산 0', async () => {
  for (const [why, setup] of [['NOT_OPEN', (s) => { s.ledger = ledger({ open: false }).fn; }], ['PAUSED', (s) => { s.ledger = ledger({ paused: true }).fn; }],
    ['OVER_BUDGET', (s) => { s.ledger = ledger({ committed: 29990 }).fn; }], ['LEDGER_UNAVAILABLE', (s) => { s.ledger = null; }]]) {
    const { s, h } = await start(ON);
    setup(s);
    const calls = s.providerCalls?.length ?? 0;
    s.ai.push(READING);
    const r = await card(h);
    assert.equal(r.status, 503, `${why} ${JSON.stringify(r.body)}`); assert.equal(r.body.code, 'AI_COMPANY_BUDGET');
    assert.equal((s.providerCalls?.length ?? 0) - calls, 0, why);
    assert.deepEqual((s.ledgerCalls ?? []).map((c) => c.fn), ['company_ai_reserve'], why);
    s.ai.length = 0;
  }
});

test('회사 예산 ④ 켜짐 + 금액을 정할 수 없음(요청당 상한·환율 없음) = 예약 안 함 · 업체 호출 0 · 503', async () => {
  for (const env of [{ ...ON, AI_POLICY: POLICY }, { ...ON, COMPANY_AI_KRW_PER_USD: '' }, { ...ON, COMPANY_AI_KRW_PER_USD: '99999' }]) {
    const { s, h } = await start(env);
    s.ledger = ledger().fn;
    const calls = s.providerCalls?.length ?? 0;
    s.ai.push(READING);
    const r = await card(h);
    assert.equal(r.status, 503, JSON.stringify(r.body)); assert.equal(r.body.code, 'AI_COMPANY_BUDGET');
    assert.equal((s.providerCalls?.length ?? 0) - calls, 0);
    assert.equal((s.ledgerCalls ?? []).length, 0, '금액 미정이면 장부도 부르지 않음');
    s.ai.length = 0;
  }
});

test('회사 예산 ⑤ 대화 턴도 같은 보호: 예산 초과면 503 · 업체 호출 0 · 대화 상태 그대로 · 모델이 필요 없는 요청(참고 이야기 여는 줄)은 예약 0', async () => {
  const { s, h, sid } = await start(ON);
  s.ledger = ledger({ committed: 29990 }).fn;
  const before = JSON.stringify(s.tables.doit_request_events.filter((x) => x.action === 'agent_session').map((x) => x.response_payload));
  const calls = s.providerCalls?.length ?? 0;
  s.ai.push(T({ ...Q('values_character', '어떤 사람이 편해요?') }));
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '조용한 사람이 좋아요' });
  assert.equal(r.status, 503, JSON.stringify(r.body)); assert.equal(r.body.code, 'AI_COMPANY_BUDGET');
  assert.equal((s.providerCalls?.length ?? 0) - calls, 0);
  assert.equal(JSON.stringify(s.tables.doit_request_events.filter((x) => x.action === 'agent_session').map((x) => x.response_payload)), before, '대화 상태 그대로(다시 보내면 됨)');
  s.ai.length = 0; s.ledgerCalls = [];
  const o = await h.call({ action: 'agent_ref', requestId: rid(), ref: { kind: 'card', label: '별' }, history: [], text: '' });
  assert.equal(o.status, 200); assert.equal(s.ledgerCalls.length, 0);
});

test('회사 예산 ⑥ 소스: 기본 꺼짐 · 실패하면 닫힌 쪽(호출 0) · 응답 전 정산 · 장부 초안은 실행 전(PENDING) 그대로', () => {
  const dir = path.join(source, 'product/supabase/functions/doit-agent/');
  const cb = readFileSync(dir + 'company-budget.ts', 'utf8'); const ix = readFileSync(dir + 'index.ts', 'utf8');
  assert.match(cb, /if \(\(get\("COMPANY_AI_BUDGET"\) \?\? ""\)\.trim\(\)\.toLowerCase\(\) !== "on"\) return null;/);
  assert.match(ix, /if \(stop\) throw new Error\("company_budget"\);\n\s*return router\.llm\(kind, system, input\);/);
  assert.match(ix, /\} finally \{\n[^\n]*\n\s*if \(budgetDone\) await budgetDone\(\)/);
  assert.ok(existsSync(path.join(source, 'product/supabase/drafts/PENDING_20261005_company_ai_budget.sql')), '장부 초안(실행 전)');
  assert.ok(!readdirSync(path.join(source, 'product/supabase/migrations')).some((f) => /company_ai/.test(f)), '마이그레이션으로 옮기지 않음(대표 승인 전)');
});
