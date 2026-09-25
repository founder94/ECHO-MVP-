// A/B Spike 하네스 공용 부품(2026-09-25). run-ab.mjs(A/B 실행)·replay-decisions.mjs(서버 판정 재생)가 함께 쓴다.
// - A = 운영 v27 원본 파일을 지문 확인 뒤 그대로 읽어 메모리 가짜 DB 로 돌린다(수정 0). 운영 DB·운영 함수·운영 Secret 을 쓰지 않는다.
// - 키는 환경 변수 OPENAI_API_KEY 로만 받는다(파일·로그·결과에 쓰지 않는다). 없으면 [MOCK].
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// typescript·js-tiktoken 은 제품 의존성이 아니다: NODE_PATH(검사 도구 폴더)로 찾는다(require 는 NODE_PATH 를 따른다).
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { getEncoding } = require('js-tiktoken');
import { newBState, runBTurn } from './agentB.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const A_FILE = path.resolve(HERE, '../../../docs/claude-final-review-20260916/PATCH-20260924-agent-v1.1/rollback/doit-understanding.v27.ts');
export const A_SHA = '1aab64236bb7c9a41aa40459f0c320abca296e1c928fd76007de2d26b790c450';
const KEY = process.env.OPENAI_API_KEY ?? '';
export const REAL = !!KEY;
export const MODEL = ((m) => (!m || m === 'gpt-40-mini' ? 'gpt-4o-mini' : m))((process.env.OPENAI_MODEL ?? '').trim()); // A 의 resolveModel 과 같은 규칙
const enc = getEncoding('o200k_base'); // gpt-4o 계열 토크나이저. 실제 과금 토큰은 API usage 값이 정본이다(REAL 일 때 함께 적는다).
export const tok = (s) => enc.encode(String(s ?? '')).length;

// ── LLM 가로채기 ──
export function recorder() {
  const calls = [];
  const mockFor = { current: null };
  async function llm(system, userJson, params) {
    const started = Date.now();
    let parsedIn = {}; try { parsedIn = JSON.parse(userJson); } catch { parsedIn = {}; }
    const fields = Object.fromEntries(Object.entries(parsedIn).map(([k, v]) => [k, tok(JSON.stringify(v))])); // §30 Context 구성(항목별 토큰)
    const rec = { fields, sys_tokens: tok(system), user_tokens: tok(userJson), sys_chars: system.length, user_chars: userJson.length, params, out_tokens: null, usage: null, ms: 0, mock: !REAL };
    let content;
    if (REAL) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, temperature: params.temperature, top_p: params.top_p, max_tokens: params.max_tokens, messages: [{ role: 'system', content: system }, { role: 'user', content: userJson }], response_format: { type: 'json_object' } }) });
      const data = await res.json();
      if (!res.ok) { rec.ms = Date.now() - started; rec.error = `http_${res.status}`; calls.push(rec); throw new Error('OPENAI_HTTP'); }
      content = String(data?.choices?.[0]?.message?.content ?? '');
      rec.usage = data?.usage ?? null; rec.in_real = rec.usage?.prompt_tokens ?? null; rec.out_real = rec.usage?.completion_tokens ?? null;
    } else {
      content = mockFor.current(system, JSON.parse(userJson), calls.filter((c) => c.turnKey === mockFor.key).length);
    }
    rec.ms = Date.now() - started; rec.out_tokens = tok(content); rec.turnKey = mockFor.key;
    rec.content = content; // 2026-09-25(run1 뒤): 막힌 후보 질문의 원문을 남겨 과차단을 뜻으로 볼 수 있게 한다(result.json 에만 · 키·사용자 원문 외 정보 없음)
    calls.push(rec);
    return content;
  }
  return { calls, llm, mockFor };
}

// [MOCK] 응답 — 실제 AI 가 아니다. A·B 모두 "정상 경로"만 타게 만든다(공정성): 질문은 턴·시도마다 서로 겹치지 않는 임의 음절,
//   A 의 단서는 A 서버가 고른 출발 문장 안의 글자, B 의 의도는 턴마다 다른 값. 그래서 MOCK 표의 재시도·실패는 구조 차이가 아니라 0 이 정상이다.
//   반복·단서·자기표시로 떨어지는 실제 실패는 운영 로그(실제 AI)로만 본다.
const firstWords = (s) => (String(s ?? '').match(/[가-힣A-Za-z]{2,}/g) ?? ['이야기']);
const SYL = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후';
function uniqueQuestion(seed) { let x = seed * 2654435761 % 4294967296; let out = ''; for (let i = 0; i < 10; i++) { x = (x * 1103515245 + 12345) % 2147483648; out += SYL[x % SYL.length]; } return `${out}요?`; }
let mockSeq = 0;
export function mockA(type) {
  return (_system, input) => {
    const eff = input.server_turn_type ?? (type === 'repair' ? 'complaint' : type);
    const source = ['answer', 'unsure', 'correction'].includes(eff) ? input.user_text : (input.last_answer ?? input.user_text ?? ''); // A 서버 sourceFor 와 같은 출발 문장(정정 = 고친 설명)
    const clue = firstWords(source)[0];
    return JSON.stringify({ turn_type: eff, correction_rest: eff === 'correction' ? (input.user_text ?? '') : '', interesting_clue: clue, acknowledgement: '',
      answer_to_user: eff === 'ask' ? '어떤 사람을 소개할지 정하려고 여쭤봐요.' : '', next_question: ['ask', 'fatigue'].includes(eff) ? '' : `[MOCK] ${uniqueQuestion(++mockSeq)}`,
      memory_candidates: [], confidence: 0.5, reason: 'mock', repeats_asked: false, uses_rejected_meaning: false, assumes_unconfirmed_fact: false, off_purpose: false });
  };
}
export function mockB(type) {
  return () => JSON.stringify({ user_signal: type, reaction: type === 'ask' ? '어떤 사람을 소개할지 정하려고 여쭤봐요.' : type === 'repair' ? '맞아요, 제가 같은 걸 물었어요.' : '',
    understanding: '', curiosity: '', question_intent: `mock-intent-${++mockSeq}`, same_intent_as: '', next_question: ['ask', 'fatigue'].includes(type) ? null : `[MOCK] ${uniqueQuestion(++mockSeq)}`, memory_candidate: { text: '', quote: '' } });
}

// ── A: v27 원본을 그대로 읽어 메모리 가짜 DB 로 돌린다 ──
const USER = '11111111-1111-4111-8111-111111111111';
export function loadA(purpose, rec, logs) {
  const source = readFileSync(A_FILE, 'utf8');
  const sha = createHash('sha256').update(source).digest('hex');
  if (sha !== A_SHA) throw new Error(`A 원본 지문이 다르다: ${sha}`);
  let clock = Date.UTC(2026, 8, 25, 0, 0);
  const now = () => new Date((clock += 1000)).toISOString();
  const state = { records: [], insights: [], events: [], profiles: [{ id: USER, purpose_label: purpose }] };
  const tables = { doit_records: state.records, doit_insights: state.insights, doit_request_events: state.events, profiles: state.profiles };
  const chain = (table) => {
    let rows = [...(tables[table] ?? [])]; let insertRow = null;
    const c = { select: () => c, order: () => c, limit: () => c, not: () => c,
      eq: (k, v) => { rows = rows.filter((r) => r[k] === v); return c; }, in: (k, vs) => { rows = rows.filter((r) => vs.includes(r[k])); return c; },
      gte: (k, v) => { rows = rows.filter((r) => String(r[k] ?? '') >= v); return c; }, insert: (row) => { insertRow = row; return c; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (ok) => { if (insertRow) { if (tables[table].some((r) => r.user_id === insertRow.user_id && r.request_id === insertRow.request_id)) return ok({ data: null, error: { code: '23505' } }); tables[table].push({ ...insertRow, created_at: now() }); return ok({ data: null, error: null }); } return ok({ data: rows, error: null }); } };
    return c;
  };
  const db = { auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: {} } }, error: null }) }, from: chain,
    rpc: async (name, a) => {
      if (name === 'doit_apply_record_create') { const row = { id: globalThis.crypto.randomUUID(), user_id: USER, request_id: a.p_request_id, text: a.p_text, original_text: a.p_original_text, status: a.p_status, revision: 1, created_at: now(), updated_at: now() }; state.records.push(row); return { data: { ok: true, record: row }, error: null }; }
      if (name === 'doit_begin_followup') { const done = state.events.find((e) => e.request_id === a.p_request_id && e.status === 'applied'); if (done) return { data: { ok: true, duplicate: true, question: done.response_payload.question }, error: null }; return { data: { ok: true, duplicate: false, lease_token: a.p_lease_token, context: { context_hash: 'h', record: state.records.find((r) => r.id === a.p_record_id), insights: [] } }, error: null }; }
      if (name === 'doit_finish_followup') { if (!a.p_question) return { data: { ok: false, code: a.p_error_code }, error: null }; const q = { text: a.p_question, sourceRecordId: a.p_record_id }; state.events.push({ user_id: USER, request_id: a.p_request_id, action: 'followup_generate', status: 'applied', target_id: a.p_record_id, created_at: now(), response_payload: { question: q } }); return { data: { ok: true, duplicate: false, question: q }, error: null }; }
      throw new Error(`unexpected rpc ${name}`);
    } };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const env = { OPENAI_API_KEY: REAL ? KEY : 'mock', OPENAI_MODEL: process.env.OPENAI_MODEL ?? '', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' };
  const sandbox = { exports: {}, console: { log: (l) => logs.push(String(l)), error: () => {}, warn: () => {} }, setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => env[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (n) => { if (n.startsWith('npm:@supabase/supabase-js')) return { createClient: () => db }; throw new Error(`dep ${n}`); },
    fetch: async (_url, init) => { const b = JSON.parse(init.body); const content = await rec.llm(b.messages[0].content, b.messages[1].content, { temperature: b.temperature, top_p: b.top_p, max_tokens: b.max_tokens }); return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }); } };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-understanding.v27.ts' });
  return { state, sandbox, call: async (payload) => { const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'turn', requestId: globalThis.crypto.randomUUID(), ...payload }) })); return { status: res.status, body: await res.json() }; } };
}
export const splitAck = (t) => { const s = String(t ?? ''); const i = s.indexOf('\n'); return i < 0 ? { ack: '', body: s } : { ack: s.slice(0, i).trim(), body: s.slice(i + 1).trim() }; };

// 42/44차 앱(CoreConversation)과 같은 순서로 A 를 부른다: text · answeredQuestion(떠 있던 질문 본문) · recordId(이어 받는 기록) · pendingCorrection.
export async function runA(flow, { mock = mockA } = {}) { // mock: [MOCK] 검사에서만 바꾼다(실AI 에서는 쓰이지 않음)
  const rec = recorder(); const logs = [];
  const a = loadA(flow.purpose, rec, logs);
  let shown = '어떤 만남을 원하세요?'; let activeId = null; let pendingCorrection = null;
  const rows = [];
  for (const [i, [text, type, origin]] of flow.steps.entries()) {
    rec.mockFor.current = mock(type); rec.mockFor.key = `A${i}`;
    const before = rec.calls.length; const logBefore = logs.length;
    const t0 = Date.now();
    const { body: shownBody } = splitAck(shown);
    const r = await a.call({ text, answeredQuestion: shownBody, ...(activeId ? { recordId: activeId } : {}), ...(pendingCorrection ? { pendingCorrection } : {}) });
    const ms = Date.now() - t0;
    const diag = logs.slice(logBefore).map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((l) => l?.action === 'turn') ?? {};
    const b = r.body;
    if (b.record?.id) activeId = b.record.id;
    pendingCorrection = b.kind === 'correction' && !b.saved ? shownBody : null;
    const q = b.question?.text ?? null;
    if (q) shown = q;
    rows.push({ i: i + 1, text, expect: type, origin, kind: b.kind ?? null, saved: !!b.saved, reply: b.reply ?? null, question: q, kept_question: !q && b.kind === 'ask' ? shownBody : null, // 앱은 되묻기 뒤 떠 있던 질문을 그대로 둔다(B 와 같은 표시)
      error: b.questionError ? 'QUESTION_FAILED' : (b.ok === false ? b.code : null), // 2026-09-25 수정(GF-63): 이 칸이 위 주석 안에 들어가 A 오류가 한 번도 기록되지 않았다
      calls: rec.calls.slice(before), retry: diag.retry_reason ?? [], result: diag.result ?? null, by: diag.by ?? null, total_ms: ms });
  }
  return rows;
}
export async function runB(flow) {
  const rec = recorder(); const s = newBState(flow.purpose); s.lastQuestion = '어떤 만남을 원하세요?';
  const rows = [];
  for (const [i, [text, type, origin]] of flow.steps.entries()) {
    rec.mockFor.current = mockB(type); rec.mockFor.key = `B${i}`;
    const before = rec.calls.length; const t0 = Date.now(); const prevQ = s.lastQuestion;
    const { obs, response } = await runBTurn(s, text, rec.llm);
    const keep = response.signal === 'ask' && response.question && response.question === prevQ;
    rows.push({ i: i + 1, text, expect: type, origin, kind: response.signal ?? null, saved: !!response.saved, reply: response.reaction ?? null,
      question: keep ? null : (response.question ?? null), kept_question: keep ? response.question : null,
      intent: response.intent ?? null, dropped: response.dropped ?? null, error: response.error ?? null, calls: rec.calls.slice(before), retry: obs.retry, result: s.audit.at(-1)?.result ?? null, total_ms: Date.now() - t0 });
  }
  return { rows, state: s };
}

// ── 객관 FAIL(사람 판단 없이 기계적으로 셀 수 있는 것만). 품질·자연스러움·같은 뜻 반복(표현을 바꾼 것)은 블라인드 검수로만 본다.
export const BANNED = /데이팅|소개팅|궁합|점술|심리치료|성격검사/;
export const normQ = (q) => String(q ?? '').replace(/^\[MOCK\]\s*/, '').replace(/\s+/g, '');
export function objectiveFails(rows) {
  const seen = [];
  for (const r of rows) {
    const f = [];
    if (r.error) f.push(`오류:${r.error}`);
    if (r.saved && ['repair', 'ask', 'fatigue'].includes(r.expect)) f.push(`${r.expect} 입력을 답으로 저장`);
    if (r.question) {
      if (seen.includes(normQ(r.question))) f.push('앞과 글자까지 같은 질문');
      if ((r.question.match(/[?？]/g) ?? []).length > 1) f.push('물음표 2개 이상');
      if (BANNED.test(r.question) || BANNED.test(r.reply ?? '')) f.push('금지어');
      seen.push(normQ(r.question));
    }
    r.fail = f;
  }
  return rows;
}


// ── 고정 입력(Golden Failure Set) — golden-failures.json 이 정본이다. A/B 실행 전 지문을 결과에 남긴다.
export const GOLDEN_FILE = path.resolve(HERE, 'golden-failures.json');
export const GOLDEN_RAW = readFileSync(GOLDEN_FILE, 'utf8');
export const GOLDEN_SHA = createHash('sha256').update(GOLDEN_RAW).digest('hex');
export const GOLDEN = JSON.parse(GOLDEN_RAW).flows.map((f) => ({ ...f, steps: f.steps.map((st) => [st.text, st.expect, st.origin, st.source]) }));

// ── Golden Failure 판정 기준(golden-specs.json · 사전 고정). 결과를 본 뒤 기준을 바꾸지 않는다.
export const SPECS_FILE = path.resolve(HERE, 'golden-specs.json');
export const SPECS_RAW = readFileSync(SPECS_FILE, 'utf8');
export const SPECS_SHA = createHash('sha256').update(SPECS_RAW).digest('hex');
export const SPECS = JSON.parse(SPECS_RAW);

// 한 칸(행)에 대해 기계 판정. server 층 = 저장·오류 · model 층 = 반응 유무·고정 문장.
// MOCK 에서는 model 층이 가짜 AI 문장이라 판정하지 않는다(N/A). server 층도 MOCK 에서는 구조 확인일 뿐이다.
export function checkRow(row, check, { real, fixedLines }) {
  const layer = SPECS.check_types[check]?.layer;
  if (!layer) return 'UNKNOWN_CHECK';
  if (!real && layer === 'model') return 'N/A(MOCK)';
  const text = [row.reply ?? '', row.question ?? '', row.kept_question ?? ''].join('\n');
  switch (check) {
    case 'saved': return row.saved ? 'PASS' : 'FAIL';
    case 'not_saved': return row.saved ? 'FAIL' : 'PASS';
    case 'no_error': return row.error ? 'FAIL' : 'PASS';
    case 'reply_present': return row.reply && String(row.reply).trim() ? 'PASS' : 'FAIL';
    case 'no_fixed_line': return fixedLines.some((l) => text.includes(l)) ? 'FAIL' : 'PASS';
    default: return 'UNKNOWN_CHECK';
  }
}

// 결과 전체 → spec 별 A·B 판정. review_question 은 사람(블라인드) 몫이라 여기서 판정하지 않는다.
export function evaluateSpecs(results, real) {
  const out = [];
  for (const s of SPECS.specs) {
    const r = results.find((x) => x.flow.id === s.flow);
    if (!r) continue;
    for (const turn of s.turns) {
      const a = r.A.find((x) => x.i === turn); const b = r.B.rows.find((x) => x.i === turn);
      if (!a || !b) continue;
      const judge = (row) => Object.fromEntries(s.checks.map((c) => [c, checkRow(row, c, { real, fixedLines: SPECS.fixed_lines })]));
      const ja = judge(a), jb = judge(b);
      const verdict = (j) => (Object.values(j).includes('FAIL') ? 'FAIL' : Object.values(j).every((v) => v === 'PASS') ? 'PASS' : 'PARTIAL');
      out.push({ fail_id: s.fail_id, flow: s.flow, turn, text: a.text, A: ja, B: jb, A_verdict: real ? verdict(ja) : 'MOCK', B_verdict: real ? verdict(jb) : 'MOCK', review: s.review_question });
    }
  }
  return out;
}
