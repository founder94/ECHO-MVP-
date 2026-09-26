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

export async function loadAgent() {
  const js = ts.transpileModule(readFileSync(AGENT_FILE, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'echo-agent-')), 'agent.mjs');
  writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}

const KIND_OF = { answer: 'answer', repair: 'repair', correction: 'correction', ask: 'ask', help: 'help', unsure: 'unsure', fatigue: 'stop', mixed: 'answer' };
let seq = 0;
const mock = (expect) => (_sys, input) => {
  if (input.latest === undefined) { const h = (input.heard ?? []).find((x) => x.quote); return JSON.stringify({ summary: [], closing: '[MOCK] 정리해 둘게요.', intro: h ? [{ text: '[MOCK] 저는 소개 문장이에요.', basis: h.quote }] : [] }); }
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
  const llm = (kind, prompt, input) => rec.llm(prompt, JSON.stringify(input), A.AGENT_PARAMS);
  const st = A.newState({ tone, seed: flow.seed ?? null }); // v2.10: 사주·타로 이야기 거리(없으면 null · 예전 판은 무시)
  A.seedFirstQuestion(st);
  const rows = [];
  for (const [i, s] of flow.steps.entries()) {
    rec.mockFor.current = mock(s.expect); rec.mockFor.key = `T${i}`;
    const before = rec.calls.length; const t1 = Date.now();
    const wasDone = st.phase !== 'talk'; const coreBefore = A.coreAsked(st).length; const confirmedBefore = A.PURPOSES.filter((p) => st.slots[p.id].status === 'CONFIRMED').map((p) => p.id); const overCap = wasDone && st.after_turns >= A.MAX_AFTER_TURNS; const recoveryUsedBefore = !!st.correction_recovery_used;
    const { obs, response } = await A.runTurn(st, s.text, llm);
    rows.push({ i: i + 1, text: s.text, expect: s.expect, origin: s.origin, kind: response.kind ?? null, saved: !!response.saved, extracted: (response.extracted ?? []).map((e) => e.purpose),
      reply: [response.reply, response.closing].filter(Boolean).join(' ') || null, question: response.question ?? null, qtype: response.question_type ?? null, qpurpose: response.question_purpose ?? null,
      finish: !!response.finish, after: wasDone, recovered: response.recovered ?? [], hint: response.question ? st.current?.hint ?? null : null, error: response.error ?? null, retry: obs.retry, calls: rec.calls.slice(before), total_ms: Date.now() - t1, core_before: coreBefore, core_after: A.coreAsked(st).length, confirmed_before: confirmedBefore, intro_status: st.intro?.status ?? null, over_cap: overCap, recovery_used_before: recoveryUsedBefore, recovery: !!response.correction_recovery });
  }
  return { flow: flowId, tone, rows, profile: A.matchingProfile(st), core: A.coreAsked(st).length, clarify: st.clarify.total, phase: st.phase, intro: st.intro ?? null, items: A.PURPOSES.flatMap((p) => st.slots[p.id].items.map((i) => ({ status: i.status, quote: i.quote, note: i.note, source_type: i.source_type ?? null, source: i.source ?? null, turn: i.turn }))), seed: flow.seed ?? null, handoff: A.matchingHandoff ? A.matchingHandoff(A.matchingProfile(st)) : null };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
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
    question_banned_words: rows.filter((x) => x.question && /당신|귀하|관계에서|가치관|성향|선호|이상형|조건|분석|진단/.test(x.question)).length,
    ack_example_copy: rows.filter((x) => x.reply && /편하게이어지는쪽이좋군요|자주보기보다주말에편하게만나는쪽이군요/.test(x.reply.replace(/\s+/g, ''))).length,
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
    for (const x of r.rows) L.push(`| ${x.i} | ${flat(x.text)} | ${x.kind ?? '-'}${x.saved ? '·저장' : ''}${x.qtype ? `·${x.qtype}:${x.qpurpose}` : ''}${x.after ? '·끝난 뒤' : ''} | ${flat([x.reply && `💬 ${x.reply}`, x.question && `❓ ${x.question}`, x.hint && `💡 ${x.hint}`, x.finish && '(마무리)', x.error && `⚠️ ${x.error}`].filter(Boolean).join(' / '))} |`);
    if (r.intro) L.push(`- 소개 초안: ${r.intro.status}${r.intro.lines.length ? ` — ${flat(r.intro.lines.map((l) => l.text).join(' '))}` : ''}${Object.keys(r.intro.dropped ?? {}).length ? ` · 버림 ${JSON.stringify(r.intro.dropped)}` : ''}`, '');
    L.push('');
  }
  const text = L.join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, models: MODELS, frozen_ok: frozenOk, agent_ts_sha: AGENT_TS_SHA, stats: S }));
}
