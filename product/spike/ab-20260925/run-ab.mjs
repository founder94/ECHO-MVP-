// CTO A/B Spike 하네스(2026-09-25). Current Agent A(운영 v27 원본 · 동결) 와 Minimal Agent B 를 같은 입력·같은 모델 조건으로 돌린다.
// - 운영 DB·운영 함수·운영 키를 쓰지 않는다. A 는 저장소의 v27 원본 파일(SHA-256 1aab6423…)을 그대로 읽어 메모리 가짜 DB 로 돌린다.
// - 모든 LLM 요청을 가로채 기록한다(호출 수·입력/출력 토큰·지연·재시도). 원문·키는 파일 밖으로 로그하지 않는다(결과 파일에는 검사 문장과 AI 출력만).
// - OPENAI_API_KEY 가 있으면 실제 OpenAI(같은 모델·temperature·top_p·max_tokens). 없으면 [MOCK] — 구조·토큰·호출 수만 의미가 있고 품질 판정 불가.
//
// 실행: node --experimental-strip-types spike/ab-20260925/run-ab.mjs [--out 결과.md] [--json 결과.json]
//       (NODE_PATH 에 typescript·js-tiktoken 이 있어야 한다)
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const A_FILE = path.resolve(HERE, '../../../docs/claude-final-review-20260916/PATCH-20260924-agent-v1.1/rollback/doit-understanding.v27.ts');
const A_SHA = '1aab64236bb7c9a41aa40459f0c320abca296e1c928fd76007de2d26b790c450';
const KEY = process.env.OPENAI_API_KEY ?? '';
const REAL = !!KEY;
const MODEL = ((m) => (!m || m === 'gpt-40-mini' ? 'gpt-4o-mini' : m))((process.env.OPENAI_MODEL ?? '').trim()); // A 의 resolveModel 과 같은 규칙
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const enc = getEncoding('o200k_base'); // gpt-4o 계열 토크나이저. 실제 과금 토큰은 API usage 값이 정본이다(REAL 일 때 함께 적는다).
const tok = (s) => enc.encode(String(s ?? '')).length;

// ── GOLDEN FAILURE SET(대표 실제 문장 · 새 예문으로 덮지 않는다). mockType 은 MOCK 응답을 만들 때만 쓴다(실제 AI 에는 전달하지 않음).
export const GOLDEN = [
  { id: 'FLOW1', note: '운영 Galaxy 2026-09-25 04:20~04:26 KST — 같은 의미 질문 반복 후 질문 생성 실패', purpose: '아직 정하지 않았어요', steps: [
    ['가볍게 우선 사람을 알아가고 싶어', 'answer'], ['나 진심이라고 적은거 같은데', 'repair'], ['마음이지머', 'answer'], ['행동으로 보여줄때', 'answer'],
    ['적었자네', 'repair'], ['몇번째 같은말이야!!', 'repair'], ['행동이라고!!', 'correction'] ] },
  { id: 'FLOW2', note: '실제 실패/경계 입력(2026-09-24 LEVEL 3 FAIL #1~#3·지시서)', purpose: '편하게 지낼 친구를 원해요', steps: [
    ['그냥 편한친구 부담없이', 'answer'], ['활동?갑자기?', 'repair'], ['취미생활?', 'answer'], ['왜 그걸 물어봐?', 'ask'], ['그게 아니에요', 'correction'],
    ['활동 말고 편하게 대화하는 친구를 원한다는 거예요', 'correction'], ['모르겠어요', 'unsure'], ['할말이없다 휴', 'fatigue'] ] },
  { id: 'FLOW3', note: '짧은 정상 답(LEVEL 3 FAIL #3 실제) · 긴 정상 답(LEVEL 3 실제)', purpose: '연애로 이어질 만남을 원해요', steps: [
    ['싸이클 테니스 골프', 'answer'], ['나는 사람을 빨리 만나는 것보다 천천히 알아가고 싶어.', 'answer'] ] },
];

// ── LLM 가로채기 ──
function recorder() {
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
      rec.usage = data?.usage ?? null;
    } else {
      content = mockFor.current(system, JSON.parse(userJson), calls.filter((c) => c.turnKey === mockFor.key).length);
    }
    rec.ms = Date.now() - started; rec.out_tokens = tok(content); rec.turnKey = mockFor.key;
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
function mockA(type) {
  return (_system, input) => {
    const eff = input.server_turn_type ?? (type === 'repair' ? 'complaint' : type);
    const source = ['answer', 'unsure', 'correction'].includes(eff) ? input.user_text : (input.last_answer ?? input.user_text ?? ''); // A 서버 sourceFor 와 같은 출발 문장(정정 = 고친 설명)
    const clue = firstWords(source)[0];
    return JSON.stringify({ turn_type: eff, correction_rest: eff === 'correction' ? (input.user_text ?? '') : '', interesting_clue: clue, acknowledgement: '',
      answer_to_user: eff === 'ask' ? '어떤 사람을 소개할지 정하려고 여쭤봐요.' : '', next_question: ['ask', 'fatigue'].includes(eff) ? '' : `[MOCK] ${uniqueQuestion(++mockSeq)}`,
      memory_candidates: [], confidence: 0.5, reason: 'mock', repeats_asked: false, uses_rejected_meaning: false, assumes_unconfirmed_fact: false, off_purpose: false });
  };
}
function mockB(type) {
  return () => JSON.stringify({ turn_type: type, answer_to_user: type === 'ask' ? '어떤 사람을 소개할지 정하려고 여쭤봐요.' : type === 'repair' ? '맞아요, 제가 같은 걸 물었어요.' : '',
    basis_quote: '', understanding: '', curiosity: '', question_intent: `mock-intent-${++mockSeq}`, same_intent_as: '', next_question: ['ask', 'fatigue'].includes(type) ? '' : `[MOCK] ${uniqueQuestion(++mockSeq)}`, memory_candidate: { text: '', quote: '' } });
}

// ── A: v27 원본을 그대로 읽어 메모리 가짜 DB 로 돌린다 ──
const USER = '11111111-1111-4111-8111-111111111111';
function loadA(purpose, rec, logs) {
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
  return { state, call: async (payload) => { const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'turn', requestId: globalThis.crypto.randomUUID(), ...payload }) })); return { status: res.status, body: await res.json() }; } };
}
const splitAck = (t) => { const s = String(t ?? ''); const i = s.indexOf('\n'); return i < 0 ? { ack: '', body: s } : { ack: s.slice(0, i).trim(), body: s.slice(i + 1).trim() }; };

// 42/44차 앱(CoreConversation)과 같은 순서로 A 를 부른다: text · answeredQuestion(떠 있던 질문 본문) · recordId(이어 받는 기록) · pendingCorrection.
async function runA(flow) {
  const rec = recorder(); const logs = [];
  const a = loadA(flow.purpose, rec, logs);
  let shown = '어떤 만남을 원하세요?'; let activeId = null; let pendingCorrection = null;
  const rows = [];
  for (const [i, [text, type]] of flow.steps.entries()) {
    rec.mockFor.current = mockA(type); rec.mockFor.key = `A${i}`;
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
    rows.push({ i: i + 1, text, kind: b.kind ?? null, saved: !!b.saved, reply: b.reply ?? null, question: q, error: b.questionError ? 'QUESTION_FAILED' : (b.ok === false ? b.code : null),
      calls: rec.calls.slice(before), retry: diag.retry_reason ?? [], result: diag.result ?? null, by: diag.by ?? null, total_ms: ms });
  }
  return rows;
}
async function runB(flow) {
  const rec = recorder(); const s = newBState(flow.purpose); s.lastQuestion = '어떤 만남을 원하세요?';
  const rows = [];
  for (const [i, [text, type]] of flow.steps.entries()) {
    rec.mockFor.current = mockB(type); rec.mockFor.key = `B${i}`;
    const before = rec.calls.length; const t0 = Date.now();
    const { obs, response } = await runBTurn(s, text, rec.llm);
    rows.push({ i: i + 1, text, kind: response.type ?? null, saved: !!response.saved, reply: response.reply ?? null, question: response.question && response.question !== s.turns.at(-1)?.ai ? response.question : (response.type === 'ask' ? `(같은 질문 유지) ${response.question}` : response.question ?? null),
      intent: response.intent ?? null, error: response.error ?? null, calls: rec.calls.slice(before), retry: obs.retry, result: s.audit.at(-1)?.result ?? null, total_ms: Date.now() - t0 });
  }
  return { rows, state: s };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const results = [];
for (const flow of GOLDEN) results.push({ flow, A: await runA(flow), B: await runB(flow) });

const mode = REAL ? `실제 OpenAI · 모델 ${MODEL}` : '[MOCK] 가짜 AI — 호출 수·입력 토큰·서버 결정만 의미 있음 · 출력 문장·품질·지연은 판정 불가';
const L = [`# A/B Spike 하네스 결과 — ${mode}`, '', `- A = 운영 v27 원본(SHA-256 ${A_SHA.slice(0, 16)}…, 저장소 rollback/doit-understanding.v27.ts) · B = spike/ab-20260925/agentB.mjs`, `- 모델 조건(A·B 같음): temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 모델 ${MODEL}`, '- 토큰: o200k_base 로 센 값(요청 본문 system+user). 실제 과금 토큰은 REAL 실행의 API usage 가 정본.', ''];
for (const r of results) {
  L.push(`## ${r.flow.id} — ${r.flow.note}`, `목적: ${r.flow.purpose}`, '', '| # | 사용자 | A 종류·저장 | A 출력 | A 호출 | A 입력토큰 | A 재시도 | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 입력토큰 | B 재시도 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  r.A.forEach((a, k) => { const b = r.B.rows[k];
    const out = (x) => [x.reply ? `💬 ${x.reply}` : '', x.question ? `❓ ${x.question}` : '', x.error ? `⚠️ ${x.error}` : ''].filter(Boolean).join(' / ').replace(/\n/g, ' ⏎ ').replace(/\|/g, '/');
    L.push(`| ${a.i} | ${a.text} | ${a.kind ?? '-'}(${a.by || '-'})·${a.saved ? '저장' : '비저장'} | ${out(a)} | ${a.calls.length} | ${sum(a.calls.map((c) => c.sys_tokens + c.user_tokens))} | ${a.retry.join(',')} | ${b.kind ?? '-'}·${b.saved ? '저장' : '비저장'} | ${out(b)} | ${b.intent ?? ''} | ${b.calls.length} | ${sum(b.calls.map((c) => c.sys_tokens + c.user_tokens))} | ${b.retry.join(',')} |`); });
  L.push('');
}
const all = (side) => results.flatMap((r) => (side === 'A' ? r.A : r.B.rows));
const stat = (side) => { const rows = all(side); const calls = rows.flatMap((x) => x.calls); const llmTurns = rows.filter((x) => x.calls.length);
  return { turns: rows.length, llm_turns: llmTurns.length, calls: calls.length, calls_per_llm_turn: +(calls.length / Math.max(1, llmTurns.length)).toFixed(2),
    sys_tokens_per_call: calls.length ? Math.round(sum(calls.map((c) => c.sys_tokens)) / calls.length) : 0, user_tokens_per_call: calls.length ? Math.round(sum(calls.map((c) => c.user_tokens)) / calls.length) : 0,
    input_tokens_total: sum(calls.map((c) => c.sys_tokens + c.user_tokens)), retries: rows.reduce((n, x) => n + x.retry.length, 0), question_failed: rows.filter((x) => x.error === 'QUESTION_FAILED').length }; };
const SA = stat('A'), SB = stat('B');
const fieldAvg = (side) => { const calls = all(side).flatMap((x) => x.calls); const acc = {}; for (const c of calls) for (const [k, v] of Object.entries(c.fields ?? {})) acc[k] = (acc[k] ?? 0) + v; return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v / Math.max(1, calls.length))]).sort((x, y) => y[1] - x[1])); };
const FA = fieldAvg('A'), FB = fieldAvg('B');
L.push('## 합계', '', '| 항목 | A | B |', '|---|---|---|', ...Object.keys(SA).map((k) => `| ${k} | ${SA[k]} | ${SB[k]} |`), '');
L.push('## Context 구성 — 호출 1번당 평균 토큰(입력 JSON 항목별 · system 프롬프트 제외)', '', `- A system 프롬프트 ${SA.sys_tokens_per_call} 토큰 · B system 프롬프트 ${SB.sys_tokens_per_call} 토큰`, '', '| A 항목 | 토큰 |', '|---|---|', ...Object.entries(FA).map(([k, v]) => `| ${k} | ${v} |`), '', '| B 항목 | 토큰 |', '|---|---|', ...Object.entries(FB).map(([k, v]) => `| ${k} | ${v} |`), '');
if (!REAL) L.push('> [MOCK] 출력 문장은 가짜 AI 가 만든 모양일 뿐이다. 질문 품질·반복·자연스러움·지연은 이 표로 판정하지 않는다.');
// 블라인드 검수표(§20): 턴마다 A/B 를 OUTPUT 1 / OUTPUT 2 에 무작위로 놓고, 어느 쪽이 A 인지는 따로 적는다(검수 전 열지 않는다).
if (arg('--blind')) {
  const B = ['# 대표 블라인드 검수표 — A/B Spike', '', `- 모드: ${mode}`, '- 칸마다 두 출력 중 더 나은 쪽에 ○, 둘 다 나쁘면 ✕. 이름(A/B)은 검수가 끝난 뒤 열쇠 파일로만 확인한다.', '- 기준: 최신 말 반영 · 먼저 반응 · 같은 뜻 재질문 없음 · 한 걸음 전진 · 문제제기 뒤 방향 바꿈 · 사람다움', ''];
  const key = [];
  for (const r of results) {
    B.push(`## ${r.flow.id}`, '', '| # | 사용자 | OUTPUT 1 | OUTPUT 2 | 더 나은 쪽(1/2/둘 다 ✕) | 메모 |', '|---|---|---|---|---|---|');
    r.A.forEach((a, k) => { const b = r.B.rows[k]; const flip = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 1;
      const out = (x) => [x.reply ?? '', x.question ?? '', x.error ? `(${x.error})` : ''].filter(Boolean).join(' / ').replace(/\n/g, ' ').replace(/\|/g, '/') || '(출력 없음)';
      const [o1, o2] = flip ? [out(b), out(a)] : [out(a), out(b)];
      key.push({ flow: r.flow.id, turn: a.i, output1: flip ? 'B' : 'A', output2: flip ? 'A' : 'B' });
      B.push(`| ${a.i} | ${a.text} | ${o1} | ${o2} |  |  |`); });
    B.push('');
  }
  writeFileSync(arg('--blind'), B.join('\n'));
  if (arg('--key')) writeFileSync(arg('--key'), JSON.stringify(key, null, 1));
}
const text = L.join('\n');
if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, model: MODEL, A: SA, B: SB, contextA: FA, contextB: FB, results: results.map((r) => ({ flow: r.flow.id, A: r.A.map(({ calls, ...x }) => ({ ...x, calls: calls.map(({ params, ...c }) => c) })), B: r.B.rows.map(({ calls, ...x }) => ({ ...x, calls: calls.map(({ params, ...c }) => c) })) })) }, null, 1));
