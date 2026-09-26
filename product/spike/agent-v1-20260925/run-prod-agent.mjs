// 운영판 에이전트(product/supabase/functions/doit-agent/agent.ts) 실제 AI 재생(2026-09-25, 대표 「구현 → 운영배포 → 운영검증」).
// - 운영 서버가 쓰는 agent.ts 파일을 글자 그대로 옮겨(typescript 변환만) OpenAI 로 돌린다. 운영 서버와 같게: 첫 질문 = 앱의 목적 타일 화면(seedFirstQuestion) → 첫 줄이 첫 답.
// - agent.ts·test-flows.json·Golden·모델 목록이 FROZEN_INPUTS.json 의 prod_agent_gate 와 다르면 실제 AI 로 돌지 않는다(종료 3). 키가 없으면 종료 2.
// - 입력은 고정 문장이라 새 질문에 맞춰 바뀌지 않는다. 기계로 세는 것: 질문 수·끝난 뒤 질문·항의 저장·말투(HEURISTIC)·내부 이름·금지어·오류·
//   말투 예시 베끼기(v1.1 에서 본 「편한 게 제일 중요」)·같은 반응 되풀이·먼저 답한 뒤 질문 수 그대로. 이어짐·자연스러움은 사람이 본다.
// 실행: NODE_PATH=도구 node spike/agent-v1-20260925/run-prod-agent.mjs --models gpt-4o-mini [--require-real] [--out 결과.md] [--json 결과.json]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { REAL, GOLDEN_SHA, recorder, BANNED } from '../ab-20260925/harness-lib.mjs';
import { flowOf } from './run-agent.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const HERE = path.dirname(fileURLToPath(import.meta.url));
// 2026-09-26 대표 「ECHO FINAL CLOSEOUT」: 배포 전 후보판(예: candidates/agent-v2.3.ts)을 운영 agent.ts 를 바꾸지 않고 실제 AI 로 검증할 수 있게,
// run-request.json 의 agent_file(product 기준 경로)이 있으면 그 파일을 쓴다. 없으면 운영 agent.ts. 사전 등록(agent_ts_sha256)은 실제로 읽은 파일로 비교한다.
const REQUEST = JSON.parse(readFileSync(path.resolve(HERE, '../ab-20260925/run-request.json'), 'utf8'));
const AGENT_FILE = REQUEST.agent_file ? path.resolve(HERE, '../..', REQUEST.agent_file) : path.resolve(HERE, '../../supabase/functions/doit-agent/agent.ts');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
export const AGENT_TS_SHA = shaOf(AGENT_FILE);
export const FLOWS_SHA = shaOf(path.join(HERE, 'test-flows.json'));
const FLOWS = JSON.parse(readFileSync(path.join(HERE, 'test-flows.json'), 'utf8'));

// 2026-09-27 대표 「3-MODEL ROUTER LOCAL BUILD + OPENAI BASELINE RUN」: run-request.json 의 router=true 면 모든 모델 호출이 Model Router(router/router.ts)를 거친다.
// run 34 역할 = PRIMARY(OpenAI · 시험 모델) 하나 · Gemini·Anthropic 자리는 미연결(notConnected — 실제 호출 0). 실제 HTTP 는 run 33 과 같은 기록기(harness-lib recorder)가 한다(같은 요청·같은 집계).
const ROUTER_ON = REQUEST.router === true;
export async function loadRouter() {
  const dir = mkdtempSync(path.join(tmpdir(), 'echo-router-'));
  const tr = (f) => ts.transpileModule(readFileSync(path.join(HERE, 'router', f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from\s+["']\.\/providers\.ts["']/g, 'from "./providers.mjs"');
  writeFileSync(path.join(dir, 'providers.mjs'), tr('providers.ts'));
  writeFileSync(path.join(dir, 'router.mjs'), tr('router.ts'));
  return { R: await import(pathToFileURL(path.join(dir, 'router.mjs')).href), P: await import(pathToFileURL(path.join(dir, 'providers.mjs')).href) };
}
const RT = ROUTER_ON ? await loadRouter() : null;
/** 기록기(recorder)를 OpenAI 업체 부품으로 감싼다 — 요청 본문·집계가 run 33 과 같다(모델 이름은 기록기가 정한 시험 모델). */
function recorderProvider(rec, P) {
  return { id: 'openai', kind: 'real', call: async (req) => {
    const n = rec.calls.length; let text;
    try { text = await rec.llm(req.system, JSON.stringify(req.input), { temperature: req.temperature, top_p: req.topP, max_tokens: req.maxTokens }); }
    catch { const c = rec.calls[rec.calls.length - 1]; const st = Number(String(c?.error ?? '').replace('http_', '')); throw new P.ProviderError('openai', st === 429 ? 'http_429' : st >= 500 ? 'http_5xx' : st >= 400 ? 'http_4xx' : 'network', c?.ms ?? 0); }
    const c = rec.calls.length > n ? rec.calls[rec.calls.length - 1] : {};
    return { text: String(text ?? ''), provider: 'openai', model_requested: req.model, model_served: c.served_model ?? null, input_tokens: c.in_real ?? null, cached_tokens: c.cached_real ?? null, output_tokens: c.out_real ?? null, latency_ms: c.ms ?? 0 };
  } };
}

export async function loadAgent() {
  const js = ts.transpileModule(readFileSync(AGENT_FILE, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'echo-agent-')), 'agent.mjs');
  writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}

const KIND_OF = { answer: 'answer', repair: 'repair', correction: 'correction', ask: 'ask', help: 'help', unsure: 'unsure', fatigue: 'stop', mixed: 'answer' };
let seq = 0;
const INPUT_OF = { answer: 'NORMAL_ANSWER', repair: 'COMPLAINT', correction: 'CORRECTION', ask: 'META_QUESTION', help: 'HELP', unsure: 'UNSURE', fatigue: 'END_INTENT', mixed: 'NORMAL_ANSWER', topic: 'TOPIC_CHANGE', smalltalk: 'SMALL_TALK', reject: 'REJECTION' };
// v3 TURN CONTRACT 가짜 모델: 이해(분류·사실) · 말하기(행동에 맞는 받아주기·질문). 구조 확인용(실제 AI 아님).
const SYL = '가나다라마바사아자차카타파하고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후';
const uniq = (n) => { let x = n * 7919 + 13, o = ''; for (let i = 0; i < 6; i++) { o += SYL[x % SYL.length]; x = Math.floor(x / SYL.length) + i * 31 + n; } return o; };
const mockV3 = (expect, sys, input) => {
  if (input.action) {
    const a = input.action; const n = ++seq;
    const reply = `[MOCK] 받아주기 ${n}.`;
    if (a === 'AFTER_ACK' || a === 'BRIDGE') return JSON.stringify({ reply, question: '', purpose: '' });
    if (a === 'ASK_GAP') return JSON.stringify({ reply, question: `${uniq(n)}?`, purpose: input.gaps?.[0]?.purpose ?? '' });
    return JSON.stringify({ reply, question: `${uniq(n + 500)}?`, purpose: '' });
  }
  const it = INPUT_OF[expect] ?? 'NORMAL_ANSWER'; const q = input.current_question;
  const extracted = ['NORMAL_ANSWER', 'CORRECTION'].includes(it) ? [{ purpose: ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'][seq % 5], note: `m${seq}`, quote: String(input.latest).replace(/\s/g, '').slice(0, 2) }] : [];
  return JSON.stringify({ input_type: it, extracted, wrong: [], content_rejected: false, declared: null, inferred: [], about: '' });
};
const mock = (expect) => (_sys, input) => {
  if (String(_sys).includes('ECHO Agent 의 이해 단계') || input.action) return mockV3(expect, _sys, input);
  if (Array.isArray(input.statements)) return JSON.stringify({ lines: input.statements.map((x) => ({ id: x.id, text: `저는 ${x.quote} 쪽이 좋아요.` })) }); // v3.1 소개 다시 만들기
  if (input.latest === undefined || String(_sys).includes('대화를 자연스럽게 마친다')) { const h = (input.heard ?? []).find((x) => x.quote); return JSON.stringify({ summary: [], closing: '[MOCK] 정리해 둘게요.', intro: h ? [{ text: '[MOCK] 저는 소개 문장이에요.', basis: h.quote }] : [] }); }
  const kind = KIND_OF[expect] ?? 'answer'; const open = input.open_purposes ?? [];
  return JSON.stringify({ kind, understood: '', reply: `[MOCK] 받아주기 ${++seq}.`, inferred: [], declared: null, wrong: [],
    extracted: ['answer', 'correction'].includes(kind) && input.current_question ? [{ purpose: input.current_question.purpose, note: `m${seq}`, quote: String(input.latest).replace(/\s/g, '').slice(0, 2) }] : [],
    next: kind === 'help' && input.current_question && (input.current_question.helps ?? 0) < 2 ? { type: 'core', purpose: input.current_question.purpose, question: `[MOCK] 쉬운 질문 ${seq}?`, hint: '[MOCK] 예: 가, 나' } : kind === 'stop' || !open.length ? { type: 'none' } : kind === 'ask' && input.current_question ? { type: 'core', purpose: input.current_question.purpose, question: `[MOCK] 다시 ${seq}?` } : { type: 'core', purpose: open[0].purpose, question: `[MOCK] 질문 ${++seq}?` } });
};

const NEW_V211 = new Set(['S3', 'T3', 'T4']); // run 29 에서 새로 넣은 판 — 비용 비교는 이것을 뺀 같은 입력으로
const REBUT = /아니|아닌데|오히려/;
const CASUAL_END = /(야|어|아|지|해|돼|거든|네|좋아|싫어|없어|있어|다)[.!~]*$/;
const overlapK = (a, b) => { const g = (t) => { const x = plainK(t).replace(/[?？.!~,]/g, ''); const o = new Set(); for (let i = 0; i < x.length - 1; i++) o.add(x.slice(i, i + 2)); return o; }; const A = g(a), B = g(b); let n = 0; for (const v of A) if (B.has(v)) n++; return n / Math.max(1, Math.min(A.size, B.size)); };
const plainK = (t) => String(t ?? '').replace(/\s+/g, '').replace(/[「」『』"'“”‘’]/g, '');
const SAJU_PHRASE = { peer_many: '부대끼', peer_none: '혼자정리', peer_some: '거리를스스로조절' };
const seedPhrase = (seed) => !seed ? null : seed.source === 'SAJU' ? SAJU_PHRASE[seed.key] ?? null : `${plainK(seed.card)}카드`;
const FREQ = /매일|날마다|맨날|자주|가끔|주말|한\s*번|하루에|매주|일주일|한\s*달/;
const EMO = [[/힘들|힘드|힘겨/, /힘/], [/불편/, /불편/], [/부담/, /부담/], [/속상/, /속상/], [/서운|섭섭/, /서운|섭섭/], [/아쉽|아쉬/, /아쉽|아쉬/], [/외로/, /외로|외롭/], [/슬프|슬퍼|슬픈/, /슬/], [/화나|화가|화났/, /화/], [/답답/, /답답/], [/무겁|무거/, /무겁|무거/], [/걱정/, /걱정/], [/불안/, /불안/], [/지치|지쳤|지친/, /지치|지쳤|지친|지쳐/], [/피곤/, /피곤/], [/괴로/, /괴로|괴롭/], [/스트레스/, /스트레스/], [/짜증/, /짜증/], [/곤란/, /곤란/], [/당황/, /당황/], [/지루/, /지루/], [/귀찮/, /귀찮/]];
export async function runFlow(A, flowId, tone, model) {
  const flow = flowOf(flowId);
  const rec = recorder(model);
  const direct = (kind, prompt, input) => rec.llm(prompt, JSON.stringify(input), A.AGENT_PARAMS);
  const router = RT ? RT.R.createRouter({ registry: { version: `run${REQUEST.run}-openai-primary-only`, provisional: true, roles: { PRIMARY: { provider: 'openai', model } }, timeout_ms: 60_000, max_tokens: A.AGENT_PARAMS.max_tokens, temperature: A.AGENT_PARAMS.temperature, top_p: A.AGENT_PARAMS.top_p },
    providers: { openai: recorderProvider(rec, RT.P), gemini: RT.P.notConnected('gemini'), anthropic: RT.P.notConnected('anthropic') }, budget: { max_calls_per_conversation: 200, max_tokens_per_conversation: 5e6 } }) : null;
  const llm = router ? router.llm : direct;
  const st = A.newState({ tone, seed: flow.seed ?? null }); // v2.10: 사주·타로 이야기 거리(없으면 null · 예전 판은 무시)
  A.seedFirstQuestion(st);
  const rows = [];
  for (const [i, s] of flow.steps.entries()) {
    rec.mockFor.current = mock(s.expect); rec.mockFor.key = `T${i}`;
    const before = rec.calls.length; const t1 = Date.now();
    const wasDone = st.phase !== 'talk'; const coreBefore = A.coreAsked(st).length; const confirmedBefore = A.PURPOSES.filter((p) => st.slots[p.id].status === 'CONFIRMED').map((p) => p.id); const overCap = wasDone && st.after_turns >= A.MAX_AFTER_TURNS; const recoveryUsedBefore = !!st.correction_recovery_used; const prevQ = st.phase === 'talk' ? st.current : null;
    const { obs, response } = await A.runTurn(st, s.text, llm);
    rows.push({ i: i + 1, text: s.text, expect: s.expect, origin: s.origin, kind: response.kind ?? null, saved: !!response.saved, extracted: (response.extracted ?? []).map((e) => e.purpose),
      reply: [response.reply, response.closing].filter(Boolean).join(' ') || null, question: response.question ?? null, qtype: response.question_type ?? null, qpurpose: response.question_purpose ?? null,
      finish: !!response.finish, after: wasDone, recovered: response.recovered ?? [], hint: response.question ? st.current?.hint ?? null : null, error: response.error ?? null, retry: obs.retry, calls: rec.calls.slice(before), total_ms: Date.now() - t1, core_before: coreBefore, core_after: A.coreAsked(st).length, confirmed_before: confirmedBefore, intro_status: st.intro?.status ?? null, over_cap: overCap, recovery_used_before: recoveryUsedBefore, recovery: !!response.correction_recovery, input_type: response.input_type ?? null, action: response.action ?? null, speak_recovery: response.recovery ?? null, raw_kept: !!response.raw_kept, notes: obs.notes ?? [], ack: response.reply ?? null, prev_qtext: prevQ?.text ?? null, prev_qpurpose: prevQ?.purpose ?? null, confirmed_after: A.PURPOSES.filter((p) => st.slots[p.id].status === 'CONFIRMED').map((p) => p.id), open_after: A.openPurposes(st).length });
  }
  return { flow: flowId, tone, rows, profile: A.matchingProfile(st), core: A.coreAsked(st).length, clarify: st.clarify.total, phase: st.phase, intro: st.intro ?? null, items: A.PURPOSES.flatMap((p) => st.slots[p.id].items.map((i) => ({ status: i.status, quote: i.quote, note: i.note, source_type: i.source_type ?? null, source: i.source ?? null, turn: i.turn }))), seed: flow.seed ?? null, handoff: A.matchingHandoff ? A.matchingHandoff(A.matchingProfile(st)) : null, pending: (st.pending ?? []).map((p) => ({ turn: p.turn, status: p.status, reason: p.reason })), router_log: router ? router.log : null, performance: router ? RT.R.performanceRows(router.log).map((x) => ({ flow: flowId, tone, ...x })) : null };
}

// v2.13 판정식 도우미(에이전트와 따로 씀). 메타 = 대화·질문 방식에 대한 물음 · 불만 = 내 말과 상관없다는 말.
const META_H = /질문\s*(이|은)?\s*(뭐|머|뭔)|고정\s*질문|무슨\s*질문|정해진\s*질문/;
const COMPLAINT_H = /상관\s*없이|말이\s*안\s*(돼|된|되)|엉뚱|딴\s*소리|(내|제)\s*말\s*(을|은)?\s*(안|못)\s*(듣|들)|반영\s*(이|을)?\s*(안|못)|(내|제)\s*(말|내용)\s*(을|를)?\s*반영|(질문|물어\S*)\s*(했|봤)는데\s*답|언제\s*그(렇게|런)\s*(말|얘기)/;
const isRedirectH = (t) => META_H.test(t ?? '') || COMPLAINT_H.test(t ?? '');
const sentK = (t) => String(t ?? '').split(/(?<=[.!?？~…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
function unconfirmedSentence(reply, userText) {
  const g = (s) => { const q = plainK(s).replace(/[?？.!~,]/g, ''); const o = new Set(); for (let k = 0; k < q.length - 1; k++) o.add(q.slice(k, k + 2)); return o; };
  const U = g(userText);
  return String(reply).split(/(?<=[.!~…])\s+/).some((t) => { const B = g(t); let m = 0; for (const v of B) if (U.has(v)) m++; if (/것\s*같(아요|네요|군요|아|다|습니다)|(신가|는가|나|인가)\s*보(네요|네|군요|다|아요|구나)|나\s*봐요|듯(해요|하네요|하군요|합니다)/.test(t)) return m / Math.max(1, B.size) < 0.3; if (/(군요|구나|네요|시네|셨네|군)[.!~…]*$/.test(t.trim())) return m === 0; return false; });
}
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
// ── v3.2 판정식(2026-09-27 대표 「v3.2 SERVER FINAL FIX」 §4 · 결과를 보기 전 수정 · 에이전트 코드와 따로 씀).
// 질문 발화(물음표 없어도): 확실한 질문 끝 · 또는 물음말 + 부드러운 끝 · 또는 「…는지 궁금해요」. 들은 것을 짚는 말(알겠·하셨·거예요·것 같)은 빼고 마지막 절로 본다.
const QH_SURE = /((?<!니)까|(?<!니)까요|(?<!(기억|생각|화|짜증))나요|[신인은는던한]가요|습니까|냐|어때|어때요|뭐야|뭐예요|있나|없나|있니|했니)$/;
const QH_WH = /어떤|어떻|무엇|뭐|뭘|언제|어디|왜|얼마나|무슨|누구|어느/;
export function questionActH(sentence) {
  const t = String(sentence ?? '').trim(); if (!t) return false;
  if (/[?？]\s*$/.test(t)) return true;
  const e = t.replace(/[.!~…\s]+$/g, ''); const last = e.split(/[,，]\s*/).pop() ?? e;
  if (QH_SURE.test(e)) return true;
  if (/(있으세요|좋으세요|편하세요|어떠세요)$/.test(e)) return true;
  if (/(알겠|알 것 같|알았|하셨|했지|했구나|이해|들었|거예요|거야|것\s*같|[가나]\s*봐요)/.test(last)) return false;
  if (/궁금(해|해요|합니다)$/.test(e)) return QH_WH.test(e) || /(는지|은지|인지|을지)/.test(e);
  return /(세요|어|아|야|해|돼|요|있어|편해|좋아)$/.test(e) && QH_WH.test(e);
}
const qActsH = (t) => String(t ?? '').split(/(?<=[.!~…?？])\s+/).filter(questionActH).length;
const PAUSE_H = /질문.{0,8}(너무|넘|진짜|좀)\s*많(아|네|다|아요|네요)?\s*[.!~]*$|그만\s*(물어|묻|할래|하자)|여기까지|할\s*말\s*(이|은)?\s*없|나중에\s*(할래|하자)|다른\s*(거|것)\s*(볼래|할래)/;
const MANY_H = /질문.{0,8}(많|길)/;
// 소개 뒤집힘: 나를 「… 사람/편입니다」로 설명(바람 낱말 없음)하는데, 근거 말이 바라는 상대(…사람 · …사람이 좋아)인 문장.
const SELF_H = /(사람|편|성격)(입니다|이에요|예요|이며|이고)/; const WISH_H = /좋아|좋겠|원하|원해|바라|찾|끌|만나|싫|중요하게|좋다고/;
const PARTNER_H = (q) => /(사람|분)\s*[.!~요]*$|(사람|분)(이|을)?\s*(좋|원)/.test(String(q ?? '').replace(/\s+$/, '')) && !/^(나는|난|저는|제가|내가)/.test(String(q ?? '').replace(/^(아니|맞아)[,\s]*/, ''));
const EMO_V32 = EMO.map(([r, u]) => [r.source.includes('화나') ? /(?<!대)화(나|가\s|났)/ : r, u]); // 「대화가」의 「화가」 오탐 제거
const LISTEN_H = new Set(['네, 이어서 편하게 말해 주세요.', '응, 이어서 편하게 말해 줘.', '네, 이어서 편하게 말씀해 주세요.']); // v3.1 판정용(에이전트 상수를 가져오지 않음)
const pct = (xs, p) => { if (!xs.length) return null; const v = [...xs].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
const lines = (r) => [r.reply, r.question].filter(Boolean).join(' ');
export function stats(A, runs) {
  const rows = runs.flatMap((r) => r.rows); const calls = rows.flatMap((x) => x.calls); const real = calls.filter((c) => c.in_real != null);
  const repeatedReply = runs.reduce((n, r) => { const seen = new Set(); let k = 0; for (const x of r.rows) { const t = (x.reply ?? '').replace(/\s+/g, ''); if (t && seen.has(t)) k++; if (t) seen.add(t); } return n + k; }, 0);
  return {
    runs: runs.length, turns: rows.length, calls: calls.length, http_errors: calls.filter((c) => c.error).length, errors: rows.filter((x) => x.error).length, retries: sum(rows.map((x) => (x.retry ?? []).length)),
    input_tokens: real.length ? sum(real.map((c) => c.in_real)) : '확인 불가(MOCK)', output_tokens: real.length ? sum(real.map((c) => c.out_real ?? 0)) : '확인 불가(MOCK)',
    served_models: [...new Set(calls.map((c) => c.served_model).filter(Boolean))].join(',') || '확인 불가(MOCK)',
    max_core_questions: Math.max(...runs.map((r) => r.core)), over_5: runs.filter((r) => r.core > A.MAX_CORE_QUESTIONS).length, max_clarify: Math.max(...runs.map((r) => r.clarify)),
    finished_runs: runs.filter((r) => r.phase !== 'talk').length, questions_after_finish: rows.filter((x) => x.after && x.question).length,
    complaint_saved: rows.filter((x) => x.saved && ['repair', 'ask', 'fatigue'].includes(x.expect)).length,
    // v1.4(2026-09-25 실제 외부 사용자 피드백): 「예를 들면?」류 = help. 저장·질문 수 증가는 0 이어야 한다. 예시(hint)는 형식만 서버가 보고, 뜻(답 유도 여부)은 아래 목록을 사람이 본다.
    help_turns: rows.filter((x) => x.expect === 'help').length,
    help_classified: rows.filter((x) => x.expect === 'help' && x.kind === 'help').length,
    help_saved: rows.filter((x) => x.expect === 'help' && x.saved).length,
    help_counted: rows.filter((x) => x.kind === 'help' && !x.after && x.core_after > x.core_before).length,
    questions_with_hint: `${rows.filter((x) => x.question && x.hint).length}/${rows.filter((x) => x.question).length}`,
    hint_max_len: Math.max(0, ...rows.map((x) => (x.hint ?? '').length)),
    // [관측 전용 · HEURISTIC] 추상 낱말만으로 묻는 질문(가치·방식·스타일·느낌·성향) 개수 — 막거나 고치지 않는다(run 10 과 비교용)
    abstract_questions: rows.filter((x) => x.question && /가치|방식|스타일|느낌|성향/.test(x.question)).length,
    question_len_p50: pct(rows.filter((x) => x.question).map((x) => x.question.length), 50),
    ask_added_question: rows.filter((x) => x.kind === 'ask' && !x.after && x.core_after > x.core_before).length,
    tone_mismatch_turns: runs.reduce((n, r) => n + r.rows.filter((x) => lines(x) && A.toneMismatch(r.tone, lines(x))).length, 0),
    sample_copy: rows.filter((x) => /편한\s*게\s*제일\s*중요/.test(lines(x))).length,
    repeated_reply: repeatedReply,
    // v1.3(2026-09-25): 같은 질문 글자가 한 대화에서 다시 나온 횟수(먼저 답하기로 한 번 다시 보인 것 포함) · 앞선 말에서 되살린 턴 수 · F2(합성)의 「꼭 있었으면 하는 것」이 끝에 채워졌는지
    same_question_again: runs.reduce((n, r) => { const seen = new Set(); let k = 0; for (const x of r.rows) { const q = (x.question ?? '').replace(/\s+/g, ''); if (q && seen.has(q)) k++; if (q) seen.add(q); } return n + k; }, 0),
    recovered_turns: rows.filter((x) => (x.recovered ?? []).length).length,
    f2_boundaries_confirmed: `${runs.filter((r) => r.flow === 'F2' && r.profile.boundaries.status === 'CONFIRMED').length}/${runs.filter((r) => r.flow === 'F2').length}`,
    id_leak: rows.filter((x) => A.leaksId(lines(x))).length,
    banned: rows.filter((x) => BANNED.test(lines(x))).length,
    confirmed_items: sum(runs.map((r) => r.profile.confirmed_preferences.length)), inferred_items: sum(runs.map((r) => r.profile.inferred_candidates.length)),
    // v1.6(2026-09-25 대표 MASTER §2·§4): 소개 초안 · 무거운 말투(관측) · 말투 예시를 그대로 옮긴 질문(관측)
    intro_ready: `${runs.filter((r) => r.intro?.status === 'ready').length}/${runs.filter((r) => r.phase !== 'talk' && r.profile.confirmed_preferences.length).length}`,
    intro_status: runs.map((r) => r.intro?.status ?? 'none').join(','),
    intro_dropped: JSON.stringify(runs.reduce((a, r) => { for (const [k, v] of Object.entries(r.intro?.dropped ?? {})) a[k] = (a[k] ?? 0) + v; return a; }, {})),
    intro_chars_max: Math.max(0, ...runs.map((r) => (r.intro?.lines ?? []).map((l) => l.text).join(' ').length)),
    // v1.8 판정 ④(사전 등록): 소개 초안 중 「저는 … 사람이에요/입니다/이라고」처럼 나를 사람으로 설명하는데 바람 낱말(좋·원·바라·찾·끌·만나)이 없는 문장 수 [HEURISTIC · 대표 run 14 사례 「저는 다정한 사람이라고 생각해요」]
    intro_self_claim: runs.reduce((n, r) => n + (r.intro?.lines ?? []).filter((l) => /저는/.test(l.text) && /사람(이에요|입니다|이라고|이야|이다)/.test(l.text) && !/(좋|원하|원해|바라|찾|끌|만나)/.test(l.text)).length, 0),
    heavy_questions: rows.filter((x) => x.question && /느끼(나요|세요|시나요)|중요하게|어떤 편|성향|가치관|의미/.test(x.question)).length,
    example_copy: rows.filter((x) => x.question && /같이있어도부담없고편하다싶은사람은어떤사람|이런건좋고,?이런건싫다싶은게있나요/.test(x.question.replace(/\s+/g, ''))).length,
    questions_total: rows.filter((x) => x.question).length,
    // v2.3 사전 등록 판정(2026-09-26 대표 「사람 말투」): 받아주기의 평가·칭찬·상담사 말 · 질문의 금지어
    evaluative_ack: rows.filter((x) => x.reply && /좋은\s*(방법|선택|생각)|멋지|훌륭|자연스러워요|좋네요|좋아요[.!~]?\s*$|그랬군요|힘드셨|대단|인상적|힘들었(구나|군요|겠)|불편하셨|불편했(구나|군요|겠)|부담스러우셨|부담스러웠(구나|군요|겠)|속상하셨|속상했(구나|군요)|서운하셨|아쉬운\s*마음/.test(x.reply)).length, // run 25 사전 등록: 감정 짐작 문장 추가
    stiff_word_reply_intro: rows.filter((x) => x.reply && /선호/.test(x.reply)).length + runs.reduce((n, r) => n + (r.intro?.lines ?? []).filter((l) => /선호/.test(l.text)).length, 0),
    // v2.4(run 21 사전 등록): 「아니 … / 그게 아니라 … / 그런 뜻 아니야 …」+ 새 뜻인데 정정(correction)으로 처리되지 않은 턴 수
    correction_lead_missed: A.correctionRemainder ? rows.filter((x) => { const r = A.correctionRemainder(x.text); return r !== null && r.replace(/\s/g, '').length >= 4 && !/[?？]\s*$/.test(r) && x.kind !== 'correction'; }).length : '해당 없음(이 판에 정정 가드 없음)',
    // v2.6 사전 등록(run 24): ⑦ 정정으로 밀린 옛 값이 소개 초안에 남은 문장 수 · ⑧ F5 의 옛 값 「매일 연락하는 게 좋아」가 지금 값(CONFIRMED)으로 남은 판 수
    intro_has_superseded: runs.reduce((n, r) => { const old = (r.items ?? []).filter((i) => i.status === 'SUPERSEDED').map((i) => i.quote.replace(/\s+/g, '').slice(0, 6)).filter((q) => q.length >= 4); return n + (r.intro?.lines ?? []).filter((l) => old.some((q) => l.text.replace(/\s+/g, '').includes(q))).length; }, 0),
    f5_old_value_active: runs.filter((r) => r.flow === 'F5' && (r.items ?? []).some((i) => i.status === 'CONFIRMED' && /매일연락/.test(i.quote.replace(/\s+/g, '')))).length,
    // v2.8 사전 등록(run 26 · 대표 「구현 명세표 FINAL」 §12) — 판정식은 에이전트 코드를 쓰지 않고 여기서 따로 센다.
    emotion_assumption_ack: rows.filter((x) => x.reply && x.reply.split(/(?<=[.!~…])\s+/).some((snt) => EMO.some(([r, u]) => r.test(snt) && !u.test((x.text ?? '').replace(/\s+/g, '')) && !(x.finish || x.after ? u.test(runs.find((rr) => rr.rows.includes(x)).rows.map((y) => y.text).join('').replace(/\s+/g, '')) : false)))).length,
    correction_to_stop: rows.filter((x) => { const r = A.correctionRemainder ? A.correctionRemainder(x.text) : null; return r !== null && r.replace(/\s/g, '').length >= 4 && !/[?？]\s*$/.test(r) && !/^(이제\s*)?(됐어|그만)/.test(r) && x.kind === 'stop'; }).length,
    superseded_in_intro: runs.reduce((n, r) => { const old = (r.items ?? []).filter((i) => i.status === 'SUPERSEDED').map((i) => i.quote.replace(/\s+/g, '').slice(0, 6)).filter((q) => q.length >= 4); return n + (r.intro?.lines ?? []).filter((l) => old.some((q) => l.text.replace(/\s+/g, '').includes(q)) && !/부담|아니|말고|대신|보다|싫|않/.test(l.text)).length; }, 0),
    f6_old_value_active: runs.filter((r) => r.flow === 'F6' && (r.items ?? []).some((i) => i.status === 'CONFIRMED' && /매일연락하는게좋/.test(i.quote.replace(/\s+/g, '')))).length,
    empty_profile: runs.filter((r) => r.phase !== 'talk' && (r.items ?? []).some((i) => i.status === 'CONFIRMED') && r.intro?.status !== 'ready').length,
    already_answered_reask: rows.filter((x) => x.question && x.qtype === 'core' && (x.confirmed_before ?? []).includes(x.qpurpose)).length,
    // v2.9 사전 등록(run 27 · 대표 「v2.9 FINAL CORRECTION RECOVERY」 §6·§7) — 에이전트 코드와 따로 센다.
    correction_lead_missed_v29: rows.filter((x) => { const r = A.correctionRemainder ? A.correctionRemainder(x.text) : null; return r !== null && r.replace(/\s/g, '').length >= 4 && !/[?？]\s*$/.test(r) && x.kind !== 'correction' && !(x.kind === 'closed' && x.recovery_used_before); }).length,
    correction_raw_lost: rows.filter((x) => x.kind === 'correction' && !x.saved && (A.correctionRemainder?.(x.text) ?? '').replace(/\s/g, '').length >= 4).length,
    reask_after_correction: rows.filter((x) => x.kind === 'correction' && x.question && (/이유|왜/.test(x.question) || (FREQ.test(A.correctionRemainder?.(x.text) ?? x.text) && FREQ.test(x.question)))).length,
    recovery_turns: rows.filter((x) => x.recovery).length,
    recovery_calls: sum(rows.filter((x) => x.recovery).map((x) => x.calls.length)),
    max_recovery_per_run: Math.max(0, ...runs.map((r) => r.rows.filter((x) => x.recovery).length)),
    unnecessary_after_calls: sum(rows.filter((x) => x.over_cap && !x.recovery).map((x) => x.calls.length)),
    after_calls_total: sum(rows.filter((x) => x.after).map((x) => x.calls.length)),
    f7_recovered: `${runs.filter((r) => r.flow === 'F7' && r.rows.some((x) => x.recovery && x.saved) && !(r.items ?? []).some((i) => i.status === 'CONFIRMED' && /매일연락하는게좋/.test(i.quote.replace(/\s+/g, '')))).length}/${runs.filter((r) => r.flow === 'F7').length}`,
    // v2.10 사전 등록(run 28 · 대표 「FINAL IMPLEMENTATION MASTER」 §32·§33) — 에이전트 코드와 따로 센다.
    content_bridge_shown: `${runs.filter((r) => r.seed && r.rows.some((x) => /결과에서는|카드에서는/.test(x.question ?? ''))).length}/${runs.filter((r) => r.seed).length}`,
    content_result_as_fact: runs.reduce((n, r) => { const ph = seedPhrase(r.seed); if (!ph) return n; const said = r.rows.some((x) => plainK(x.text).includes(ph)); return n + (said ? 0 : (r.items ?? []).filter((i) => i.status === 'CONFIRMED' && (plainK(i.quote).includes(ph) || plainK(i.note ?? '').includes(ph))).length); }, 0),
    content_in_intro: runs.reduce((n, r) => { const ph = seedPhrase(r.seed); if (!ph) return n; return n + (r.intro?.lines ?? []).filter((l) => plainK(l.text).includes(ph) || /사주|타로|카드/.test(l.text)).length; }, 0),
    content_matching: runs.filter((r) => { const ph = seedPhrase(r.seed); if (!ph) return false; const j = plainK(JSON.stringify([r.profile, r.handoff])); return j.includes(ph) || /사주|타로/.test(j); }).length,
    rebuttal_reappearance: runs.reduce((n, r) => { const ph = seedPhrase(r.seed); if (!ph) return n; const k = r.rows.findIndex((x) => x.text.trim().startsWith('아니')); if (k < 0) return n; return n + r.rows.slice(k).filter((x) => [x.reply, x.question].some((t) => t && (plainK(t).includes(ph) || /사주|타로|카드에서/.test(t)))).length + (r.intro?.lines ?? []).filter((l) => plainK(l.text).includes(ph)).length; }, 0),
    rebuttal_user_words_kept: `${runs.filter((r) => r.seed && r.rows.some((x) => x.text.trim().startsWith('아니') && x.saved)).length}/${runs.filter((r) => r.seed && r.rows.some((x) => x.text.trim().startsWith('아니'))).length}`,
    latest_correction_missing_in_intro: runs.filter((r) => { const cs = (r.items ?? []).filter((i) => i.status === 'CONFIRMED' && i.source_type === 'USER_CORRECTED'); if (!cs.length || r.phase === 'talk') return false; const last = Math.max(...cs.map((i) => i.turn)); const qs = cs.filter((i) => i.turn === last).map((i) => plainK(i.quote)); return !(r.intro?.lines ?? []).some((l) => { const b = plainK(l.basis); return qs.some((q) => (b.length >= 2 && (q.includes(b) || b.includes(q))) || plainK(l.text).includes(q.slice(0, 6))); }); }).length,
    // v2.11 사전 등록(run 29 · 대표 「FINAL EXECUTION MASTER」 §28·§35·§46) — 비용 실측과 새 시나리오.
    cached_input_tokens: real.length ? sum(real.map((c) => c.cached_real ?? 0)) : '확인 불가(MOCK)',
    retry_reasons: JSON.stringify(rows.flatMap((x) => x.retry ?? []).reduce((a, r) => { const k = String(r).replace(/:kept$/, ''); a[k] = (a[k] ?? 0) + 1; return a; }, {})),
    cost_same_set: JSON.stringify((() => { const base = runs.filter((r) => !NEW_V211.has(r.flow)); const rw = base.flatMap((r) => r.rows); const cl = rw.flatMap((x) => x.calls); const rl = cl.filter((c) => c.in_real != null); return { runs: base.length, turns: rw.length, calls: cl.length, retries: sum(rw.map((x) => (x.retry ?? []).length)), input_tokens: rl.length ? sum(rl.map((c) => c.in_real)) : null, cached_tokens: rl.length ? sum(rl.map((c) => c.cached_real ?? 0)) : null, output_tokens: rl.length ? sum(rl.map((c) => c.out_real ?? 0)) : null }; })()),
    rebuttal2_reappearance: runs.reduce((n, r) => { const ph = seedPhrase(r.seed); if (!ph) return n; const k = r.rows.findIndex((x) => REBUT.test(x.text)); if (k < 0) return n; return n + r.rows.slice(k).filter((x) => [x.reply, x.question].some((t) => t && (plainK(t).includes(ph) || /사주|타로|카드에서/.test(t)))).length + (r.intro?.lines ?? []).filter((l) => plainK(l.text).includes(ph)).length; }, 0),
    rebuttal2_user_words_kept: `${runs.filter((r) => r.seed && r.rows.some((x) => REBUT.test(x.text) && x.saved)).length}/${runs.filter((r) => r.seed && r.rows.some((x) => REBUT.test(x.text))).length}`,
    covered_reask: runs.reduce((n, r) => { if (!r.seed) return n; const k = r.rows.findIndex((x) => x.saved && FREQ.test(x.text)); if (k < 0) return n; return n + r.rows.slice(k).filter((x) => x.question && FREQ.test(x.question)).length; }, 0),
    // v2.11-p0 사전 등록(run 30 · 대표 「PROFILE/CORRECTION P0 ONLY」) — 에이전트 코드와 따로 센다.
    intro_overwrite: runs.filter((r) => { const s = r.rows.map((x) => x.intro_status); const k = s.indexOf('ready'); return k >= 0 && s.slice(k).some((v) => v === 'failed' || v === 'none'); }).length,
    raw_verbatim_leak: runs.reduce((n, r) => { const raws = (r.items ?? []).filter((i) => /_raw$/.test(i.source ?? '') && CASUAL_END.test(i.quote.trim())).map((i) => plainK(i.quote)); return n + (r.intro?.lines ?? []).filter((l) => raws.some((q) => q.length >= 4 && plainK(l.text).includes(q))).length; }, 0),
    intro_casual_line: runs.reduce((n, r) => n + (r.intro?.lines ?? []).filter((l) => !/(요|니다|죠)[.!~…]*$/.test(l.text.trim())).length, 0),
    semantic_reask: runs.reduce((n, r) => n + r.rows.filter((x, i) => x.question && (x.qtype === 'core' || x.qtype === 'clarify') && (r.rows.slice(0, i).some((y) => y.question && y.question !== x.question && (x.confirmed_before ?? []).includes(y.qpurpose) && overlapK(y.question, x.question) >= 0.3) || (FREQ.test(x.question) && r.rows.slice(0, i).some((y) => y.saved && FREQ.test(y.text))))).length, 0),
    ack_question_completion: rows.filter((x) => x.finish && x.reply && x.reply.split(/(?<=[.!~…?？])\s+/).some((t) => /[?？]\s*$|(나요|까요|을까|는지|니|냐|어때)[.]?\s*$/.test(t.trim()))).length,
    // v2.12 사전 등록(run 31 · 대표 「FINAL IMPLEMENTATION + DEPLOYMENT READINESS」 §9·§15) — 에이전트 코드와 따로 센다.
    unconfirmed_fact_ack: runs.reduce((n, r) => n + r.rows.filter((x, i) => x.reply && !['help', 'ask'].includes(x.kind) && x.reply.split(/(?<=[.!~…])\s+/).some((t) => { const u = [x.text, ...r.rows.slice(Math.max(0, i - 2), i).map((y) => y.text)].join(' '); const g = (s) => { const q = plainK(s).replace(/[?？.!~,]/g, ''); const o = new Set(); for (let k = 0; k < q.length - 1; k++) o.add(q.slice(k, k + 2)); return o; }; const B = g(t), U = g(u); let m = 0; for (const v of B) if (U.has(v)) m++; if (/것\s*같(아요|네요|군요|아|다|습니다)|(신가|는가|나|인가)\s*보(네요|네|군요|다|아요|구나)|나\s*봐요|듯(해요|하네요|하군요|합니다)/.test(t)) return m / Math.max(1, B.size) < 0.3; if (/(군요|구나|네요|시네|셨네|군)[.!~…]*$/.test(t.trim())) return m === 0; return false; })).length, 0),
    early_finish_runs: runs.filter((r) => r.phase !== 'talk' && r.core < 5 && !r.rows.some((x) => ['stop', 'skip', 'unsure'].includes(x.kind) && !x.after)).length,
    question_banned_words: rows.filter((x) => x.question && /당신|귀하|관계에서|가치관|성향|선호|이상형|조건|분석|진단/.test(x.question)).length,
    ack_example_copy: rows.filter((x) => x.reply && /편하게이어지는쪽이좋군요|자주보기보다주말에편하게만나는쪽이군요/.test(x.reply.replace(/\s+/g, ''))).length,
    // v2.13 사전 등록(run 32 · 대표 「FINAL INTEGRATED AUDIT」 · 판정식 결함 먼저 고침) — 에이전트 코드와 따로 센다. 메타·불만 모양은 여기서 따로 쓴 식(에이전트 식을 가져오지 않음).
    //  ① unconfirmed_fact_ack_v213: run 31 식은 마무리 고정 문장(closing 「이제 조금 알 것 같아요」)까지 셌다 → 받아주기(reply)만 센다(식은 같음).
    unconfirmed_fact_ack_v213: runs.reduce((n, r) => n + r.rows.filter((x, i) => (x.ack ?? x.reply) && !['help', 'ask'].includes(x.kind) && unconfirmedSentence(x.ack ?? x.reply, [x.text, ...r.rows.slice(Math.max(0, i - 2), i).map((y) => y.text)].join(' '))).length, 0),
    //  ② early_finish_v213: run 31 식은 핵심 질문 4개로 정상 마친 판까지 셌다 → 대화 중(끝난 뒤 아님) 마친 턴에서, 방금 질문의 목적을 아직 못 들었고(그 턴 뒤에도 CONFIRMED 아님) 사용자가 그만·넘기기·모르겠다·위기가 아니며 턴 상한이 아닌 경우만.
    early_finish_v213: runs.filter((r) => r.rows.some((x) => x.finish && !x.after && x.prev_qpurpose && !(x.confirmed_after ?? []).includes(x.prev_qpurpose) && !['stop', 'skip', 'unsure'].includes(x.kind) && x.core_after < A.MAX_CORE_QUESTIONS)).length,
    //  ③ 메타·불만(대표 실기기 P0-A): 그 턴에 같은(거의 같은) 질문을 다시 밀었나 · 대화를 끝냈나 · 메타·불만 문장이 사용자 사실로 저장됐나 · 불만 뒤 첫 답이 저장되지 않았나 · 받아주기(메타 물음에 대한 답)가 비었나
    redirect_turns: rows.filter((x) => !x.after && isRedirectH(x.text)).length,
    complaint_forced_question: rows.filter((x) => !x.after && isRedirectH(x.text) && x.question && x.prev_qtext && (plainK(x.question) === plainK(x.prev_qtext) || overlapK(x.question, x.prev_qtext) >= 0.6)).length,
    redirect_finish: rows.filter((x) => !x.after && isRedirectH(x.text) && x.finish && x.kind !== 'stop').length,
    meta_saved_as_fact: runs.reduce((n, r) => { const bad = r.rows.flatMap((x) => sentK(x.text).filter(isRedirectH)).map(plainK); const good = r.rows.flatMap((x) => sentK(x.text).filter((t) => !isRedirectH(t))).map(plainK); return n + (r.items ?? []).filter((i) => { const q = plainK(i.quote); return i.status === 'CONFIRMED' && q.length >= 2 && bad.some((b) => b.includes(q)) && !good.some((g) => g.includes(q)); }).length; }, 0),
    post_redirect_answer_lost: runs.reduce((n, r) => { const lost = new Set(); r.rows.forEach((x, i) => { if (!isRedirectH(x.text)) return; const nx = r.rows.slice(i + 1).find((y) => !isRedirectH(y.text)); if (nx && nx.expect === 'answer' && !nx.saved) lost.add(nx); }); return n + lost.size; }, 0), // 불만이 이어져도 같은 답 턴은 한 번만
    redirect_empty_reply: rows.filter((x) => !x.after && isRedirectH(x.text) && !(x.ack ?? '').trim()).length,
    // v3 사전 등록(run 33 · 대표 「v3 FINAL GUARD」): 질문 수를 채우려 묻지 않았나(H_RICH: 첫 답에 여러 정보 → 목적 질문 2개 이하) · 같은 질문 글자가 다시 나왔나 · 행동·입력 종류 분포(관측)
    rich_answer_padding: runs.filter((r) => r.flow === 'H_RICH' && r.core > 2).length,
    input_types: JSON.stringify(rows.reduce((a, x) => { const k = x.input_type ?? '-'; a[k] = (a[k] ?? 0) + 1; return a; }, {})),
    actions: JSON.stringify(rows.reduce((a, x) => { const k = x.action ?? (x.after ? 'AFTER' : '-'); a[k] = (a[k] ?? 0) + 1; return a; }, {})),
    speak_fallback_turns: rows.filter((x) => (x.retry ?? []).some((r) => /:dropped$|understand_fallback/.test(r))).length,
    // v3.1 사전 등록(대표 「v3.1 SERVER FIX + OPENAI MODEL COMPARISON」 · run 33 실패 7개) — 에이전트 코드와 따로 센다. 위 판정식은 그대로 둔다(같은 기준 비교).
    //  P0-1 빈 턴: 끝내기·닫힘·막힘·오류가 아닌데 받아주기도 질문도 없는 턴
    blank_turns: rows.filter((x) => !x.error && !x.finish && !['closed', 'blocked'].includes(x.kind) && !(x.ack ?? '').trim() && !x.question).length,
    //  P0-2 일반 듣기 문장: 전체 수(관측) · 불만·메타·지적 턴에 나간 수(0 이어야 함)
    generic_listen_lines: rows.filter((x) => LISTEN_H.has((x.ack ?? '').trim())).length,
    generic_listen_after_redirect: rows.filter((x) => LISTEN_H.has((x.ack ?? '').trim()) && (['REPAIR', 'ANSWER_USER'].includes(x.action) || ['repair', 'ask', 'fatigue'].includes(x.expect) || isRedirectH(x.text))).length,
    speak_recovery_types: JSON.stringify(rows.reduce((a, x) => { if (x.speak_recovery) a[x.speak_recovery] = (a[x.speak_recovery] ?? 0) + 1; return a; }, {})),
    //  P0-3 질문 살려 쓰기(관측): 살려 씀 · 살렸지만 되풀이 등으로 버림
    salvaged_questions: rows.filter((x) => (x.notes ?? []).includes('speak_salvaged')).length,
    salvage_dropped: rows.filter((x) => (x.notes ?? []).some((r) => String(r).startsWith('speak_salvage_dropped'))).length,
    //  P0-4 「다음 질문으로 넘어가」로 대화가 끝난 턴(0 이어야 함)
    skip_closed: rows.filter((x) => !x.after && x.finish && (x.input_type === 'SKIP' || /다음\s*질문\s*(으로)?\s*(넘어|가)/.test(x.text))).length,
    //  P0-5 밀린 값만의 내용이 소개에 남은 문장 수(두 글자 묶음 식 · 위 superseded_in_intro 의 「싫·않」 예외 없음)
    superseded_stale_in_intro: runs.reduce((n, r) => { const bg = (t) => { const q = plainK(t).replace(/[?？.!~,]/g, ''); const o = new Set(); for (let k = 0; k < q.length - 1; k++) o.add(q.slice(k, k + 2)); return o; }; const live = new Set((r.items ?? []).filter((i) => i.status === 'CONFIRMED').flatMap((i) => [...bg(i.quote)])); const gen = new Set(['저는', '나는', '제가', '내가', '좋아', '아요', '어요', '해요', '에요', '예요', '니다', '습니']); const marks = (r.items ?? []).filter((i) => i.status === 'SUPERSEDED').map((i) => [...bg(i.quote)].filter((g) => !live.has(g) && !gen.has(g))).filter((d) => d.length >= 2); return n + (r.intro?.lines ?? []).filter((l) => { const tb = bg(l.text); return marks.some((d) => d.filter((g) => tb.has(g)).length >= Math.max(2, Math.ceil(d.length / 2))); }).length; }, 0),
    //  P0-6 질문 없이 듣는 중의 직접 답이 사실로도 보존으로도 남지 않은 턴(0 이어야 함) · 보존 원문 수 · 뒤에 확인으로 올라간 수
    listen_answer_lost: rows.filter((x) => !x.after && x.i > 1 && !x.prev_qtext && x.expect === 'answer' && plainK(x.text).length >= 4 && !x.saved && !x.raw_kept).length,
    raw_kept_unconfirmed: sum(runs.map((r) => (r.pending ?? []).filter((p) => p.status === 'UNCONFIRMED').length)),
    raw_kept_promoted: sum(runs.map((r) => (r.pending ?? []).filter((p) => p.status === 'PROMOTED').length)),
    //  P0-7 불만·메타·지적 말(모양 또는 사전 기대)이 저장된 턴 — 위 complaint_saved 에 모양 판정을 더한 것
    redirect_saved: rows.filter((x) => x.saved && (['repair', 'ask', 'fatigue'].includes(x.expect) || (isRedirectH(x.text) && !sentK(x.text).some((t) => !isRedirectH(t))))).length,
    server_emptied_reply: JSON.stringify(rows.flatMap((x) => x.notes ?? []).filter((r) => String(r).startsWith('emptied_by:')).reduce((a, r) => { a[r] = (a[r] ?? 0) + 1; return a; }, {})),
    recovery_calls_v31: rows.filter((x) => (x.retry ?? []).some((r) => String(r).startsWith('recovery_call:'))).length, // 복구로 더 부른 말하기 호출(비용 관측)
    intro_rebuild_calls: sum(rows.map((x) => x.calls.filter((c) => c.fields && 'statements' in c.fields).length)), // 소개 다시 만들기 호출(비용 관측)
    // v3.2 사전 등록 지표(판정식 수정 · 결과 보기 전): ① 감정 짐작(「대화가」 오탐 제거 · 사용자가 이 대화에서 앞서 쓴 말도 근거로 인정)
    emotion_assumption_v32: runs.reduce((n, r) => n + r.rows.filter((x, i) => x.reply && x.reply.split(/(?<=[.!~…])\s+/).some((snt) => EMO_V32.some(([rr, u]) => rr.test(snt) && !u.test(r.rows.slice(0, i + 1).map((y) => y.text).join('').replace(/\s+/g, ''))))).length, 0),
    //  ② 조기 종료(최신 종료 계약: 질문 수·목적 칸이 기준 아님) = 대화 중 마침인데 (a) 사용자가 방금 물었거나 불만을 말했는데 끝냄(그만 요청 제외) 또는 (b) 확인된 목적이 2개 미만인데 그만·넘기기·모르겠다가 아니고, 「더 듣기」 턴 뒤 새 사실 0 도 아님 · 턴 상한 제외
    early_finish_v32: rows.filter((x, i, all) => x.finish && !x.after && x.i < A.MAX_TALK_TURNS && x.kind !== 'stop' && ((/[?？]\s*$/.test(x.text) || isRedirectH(x.text)) || ((x.confirmed_after ?? []).length < 2 && !['skip', 'unsure'].includes(x.kind) && !(all[i - 1] && all[i - 1].i === x.i - 1 && all[i - 1].action === 'FOLLOW' && !x.saved)))).length,
    //  ③ 한 턴 질문 2개 이상(받아주기 속 질문 발화 + question)
    double_question_turns: rows.filter((x) => qActsH(x.ack) + (x.question ? 1 : 0) > 1).length,
    //  ④ 끝난 뒤 사용자에게 간 질문 발화(받아주기 속 포함)
    after_close_question_acts: rows.filter((x) => x.after && (x.question || qActsH(x.ack) > 0)).length,
    //  ⑤ 멈춤·끝내기 말(질문 너무 많아·그만·여기까지·할 말 없어·나중에·다른 거) 뒤 대화 중 계속(마치지 않음) · 질문 양 지적 턴에 질문
    fatigue_continued: rows.filter((x) => !x.after && PAUSE_H.test(x.text) && !x.finish).length + rows.filter((x) => !x.after && !PAUSE_H.test(x.text) && MANY_H.test(x.text) && (x.question || qActsH(x.ack) > 0)).length,
    //  ⑥ 끝난 뒤 불만·메타(질문 양 지적 포함)에 일반 듣기 문장
    close_complaint_generic: rows.filter((x) => x.after && (isRedirectH(x.text) || MANY_H.test(x.text) || /왜\s*(또|자꾸|이렇게)/.test(x.text)) && LISTEN_H.has((x.ack ?? '').trim())).length,
    //  ⑦ 소개 뒤집힘(바라는 상대 → 「저는 그런 사람」)
    role_reversal_in_intro: runs.reduce((n, r) => n + (r.intro?.lines ?? []).filter((l) => SELF_H.test(l.text) && !WISH_H.test(l.text) && PARTNER_H(l.basis)).length, 0),
    // Router 관측(2026-09-27 · 관측만): 업체별 호출 · 역할 · 대체 · 업체 오류 · 서버 채택
    router: ROUTER_ON ? 'on' : 'off',
    router_calls_by_provider: JSON.stringify(runs.flatMap((r) => r.router_log ?? []).reduce((a, x) => { const k = `${x.provider}:${x.error ? 'error' : 'ok'}`; a[k] = (a[k] ?? 0) + 1; return a; }, {})),
    router_roles: JSON.stringify(runs.flatMap((r) => r.router_log ?? []).filter((x) => !x.error).reduce((a, x) => { a[x.role] = (a[x.role] ?? 0) + 1; return a; }, {})),
    router_fallbacks: runs.flatMap((r) => r.router_log ?? []).filter((x) => x.chain_index > 0 && !x.error).length,
    router_real_calls_non_openai: runs.flatMap((r) => r.router_log ?? []).filter((x) => x.provider !== 'openai' && !x.error).length,
    router_server_rejected: runs.flatMap((r) => r.performance ?? []).filter((x) => x.validation === 'rejected_by_server').length,
    turn_ms_p50: REAL ? pct(rows.map((x) => x.total_ms), 50) : '판정 불가(MOCK)', turn_ms_p95: REAL ? pct(rows.map((x) => x.total_ms), 95) : '판정 불가(MOCK)',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const MODELS = String(arg('--models') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!MODELS.length) { console.error('--models 필요'); process.exit(1); }
  if (process.argv.includes('--require-real') && !REAL) { console.log(JSON.stringify({ REAL_AI: 'BLOCKED_BY_ENVIRONMENT' })); process.exit(2); }
  const FROZEN = JSON.parse(readFileSync(path.resolve(HERE, '../ab-20260925/FROZEN_INPUTS.json'), 'utf8')).prod_agent_gate ?? {};
  const frozenOk = FROZEN.agent_ts_sha256 === AGENT_TS_SHA && FROZEN.flows_sha256 === FLOWS_SHA && FROZEN.golden_sha256 === GOLDEN_SHA && JSON.stringify(FROZEN.models ?? []) === JSON.stringify(MODELS);
  if (REAL && !frozenOk) { console.error('FROZEN_MISMATCH — 운영 에이전트·입력·모델 목록이 사전 등록과 다르면 실제 AI 를 돌리지 않는다'); process.exit(3); }
  const A = await loadAgent();
  const out = {};
  for (const m of MODELS) { out[m] = []; for (const r of FLOWS.runs) out[m].push(await runFlow(A, r.flow, r.tone, m)); }
  const S = Object.fromEntries(MODELS.map((m) => [m, stats(A, out[m])]));
  const mode = REAL ? '실제 OpenAI' : '[MOCK] 가짜 AI — 구조 확인용';
  const flat = (x) => String(x ?? '').replace(/\n/g, ' ⏎ ').replace(/\|/g, '/');
  const L = [`# 운영판 에이전트(${A.AGENT_VERSION}) 재생 — ${mode}`, '', `- agent.ts SHA-256 ${AGENT_TS_SHA.slice(0, 16)}… · test-flows ${FLOWS_SHA.slice(0, 16)}… · Golden ${GOLDEN_SHA.slice(0, 16)}… · 사전 등록 일치: ${frozenOk ? '예' : '아니오'}`,
    `- 모델: ${MODELS.join(' · ')} · temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 한 턴 상한 2(+마칠 때 1) · 첫 질문 = 목적 타일(고정)`, '',
    '## 합계', '', `| 항목 | ${MODELS.join(' | ')} |`, `|---|${MODELS.map(() => '---').join('|')}|`, ...Object.keys(S[MODELS[0]]).map((k) => `| ${k} | ${MODELS.map((m) => S[m][k]).join(' | ')} |`), ''];
  for (const m of MODELS) for (const r of out[m]) {
    L.push(`## ${m} · ${r.flow} · 말투 ${r.tone} · 핵심 질문 ${r.core} · 되묻기 ${r.clarify} · ${r.phase !== 'talk' ? '마침' : '안 끝남'}`, '', '| # | 사용자 | 종류·저장 | 출력 |', '|---|---|---|---|');
    for (const x of r.rows) L.push(`| ${x.i} | ${flat(x.text)} | ${x.kind ?? '-'}${x.saved ? '·저장' : ''}${x.qtype ? `·${x.qtype}:${x.qpurpose}` : ''}${x.after ? '·끝난 뒤' : ''}${x.speak_recovery ? `·복구:${x.speak_recovery}` : ''}${x.raw_kept ? '·원문보존' : ''} | ${flat([x.reply && `💬 ${x.reply}`, x.question && `❓ ${x.question}`, x.hint && `💡 ${x.hint}`, x.finish && '(마무리)', x.error && `⚠️ ${x.error}`].filter(Boolean).join(' / '))} |`);
    if (r.intro) L.push(`- 소개 초안: ${r.intro.status}${r.intro.lines.length ? ` — ${flat(r.intro.lines.map((l) => l.text).join(' '))}` : ''}${Object.keys(r.intro.dropped ?? {}).length ? ` · 버림 ${JSON.stringify(r.intro.dropped)}` : ''}`, '');
    L.push('');
  }
  const text = L.join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, models: MODELS, frozen_ok: frozenOk, agent_ts_sha: AGENT_TS_SHA, router: ROUTER_ON, stats: S }));
  // Model Performance Dataset(시험 결과 파일 · 대화 원문 0 · 운영 DB 적재 0): 호출 한 줄씩. 로그에도 찍는다(첨부물은 7일).
  if (arg('--perf') && ROUTER_ON) writeFileSync(arg('--perf'), MODELS.flatMap((m) => out[m].flatMap((r) => r.performance ?? [])).map((x) => JSON.stringify(x)).join('\n') + '\n');
}
