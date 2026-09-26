// echo-agent-v1 실제 AI 재생(2026-09-25). 같은 agent.mjs 를 OpenAI 모델로 돌려 다섯 질문 계약·말투·저장·끝남을 기계로 센다.
// - agent.mjs·test-flows.json·golden-failures.json·모델 목록이 FROZEN_INPUTS.json 의 agent_gate 와 다르면 실제 AI 로 돌지 않는다(종료 3). 키가 없으면 종료 2.
// - 입력은 고정 문장이라 에이전트의 새 질문에 맞춰 바뀌지 않는다. 그래서 여기서는 계약의 기계적인 부분만 판정한다(질문 수·끝남·말투·저장·새어 나온 이름·오류).
//   이어짐·자연스러움은 대표 휴대폰 대화로 본다. 말투 판정은 문장 끝으로 보는 [HEURISTIC] 관측이다.
// 실행: node spike/agent-v1-20260925/run-agent.mjs --models gpt-4o-mini,gpt-4.1 [--require-real] [--out 결과.md] [--json 결과.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REAL, GOLDEN, GOLDEN_SHA, recorder, BANNED } from '../ab-20260925/harness-lib.mjs';
import * as A from './agent.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const sha = (f) => createHash('sha256').update(readFileSync(path.join(HERE, f))).digest('hex');
export const AGENT_SHA = sha('agent.mjs');
export const FLOWS_SHA = sha('test-flows.json');
const FLOWS = JSON.parse(readFileSync(path.join(HERE, 'test-flows.json'), 'utf8'));
export function flowOf(id) {
  const own = FLOWS.flows.find((f) => f.id === id);
  if (own) return { id, seed: own.seed ?? null, steps: own.steps.map(([text, expect]) => ({ text, expect, origin: own.origin })) };
  const g = GOLDEN.find((f) => f.id === id);
  return { id, steps: g.steps.map(([text, expect, origin]) => ({ text, expect, origin })) };
}

const KIND_OF = { answer: 'answer', repair: 'repair', correction: 'correction', ask: 'ask', unsure: 'unsure', fatigue: 'stop', mixed: 'answer' };
let seq = 0;
const mock = (expect) => (_sys, input) => {
  if (input.purpose) return JSON.stringify({ reply: '', question: '[MOCK] 어떤 만남을 원하는지 말해 줄래요?' });
  if (input.latest === undefined) return JSON.stringify({ summary: [], closing: '[MOCK] 정리해 둘게요.' });
  const kind = KIND_OF[expect] ?? 'answer'; const open = input.open_purposes ?? [];
  return JSON.stringify({ kind, understood: '', reply: '[MOCK] 그렇군요.', inferred: [], declared: null, wrong: [],
    extracted: ['answer', 'correction'].includes(kind) && input.current_question ? [{ purpose: input.current_question.purpose, note: `m${++seq}`, quote: String(input.latest).replace(/\s/g, '').slice(0, 2) }] : [],
    next: kind === 'stop' || !open.length ? { type: 'none' } : { type: 'core', purpose: open[0].purpose, question: `[MOCK] 질문 ${++seq}?` } });
};

export async function runFlow(flowId, tone, model) {
  const flow = flowOf(flowId);
  const rec = recorder(model);
  const llm = (kind, prompt, input) => rec.llm(prompt, JSON.stringify(input), A.AGENT_PARAMS);
  const st = A.newState({ tone });
  rec.mockFor.current = mock('answer'); rec.mockFor.key = 'open';
  const t0 = Date.now(); let opening = null; let openError = null;
  try { opening = await A.runOpening(st, llm); } catch (e) { openError = String(e?.message ?? e); }
  const rows = [{ i: 0, text: null, kind: 'opening', reply: opening?.reply ?? null, question: opening?.question ?? null, error: opening ? null : (openError ?? 'OPENING_FAILED'), calls: rec.calls.slice(), total_ms: Date.now() - t0, phase: st.phase }];
  for (const [i, s] of flow.steps.entries()) {
    rec.mockFor.current = mock(s.expect); rec.mockFor.key = `T${i}`;
    const before = rec.calls.length; const t1 = Date.now();
    const wasDone = st.phase === 'done';
    const { obs, response } = await A.runTurn(st, s.text, llm);
    rows.push({ i: i + 1, text: s.text, expect: s.expect, origin: s.origin, kind: response.kind ?? null, saved: !!response.saved, extracted: (response.extracted ?? []).map((e) => e.purpose),
      reply: [response.reply, response.closing].filter(Boolean).join(' ') || null, question: response.question ?? null, qtype: response.question_type ?? null, qpurpose: response.question_purpose ?? null,
      finish: !!response.finish, after: wasDone, error: response.error ?? null, retry: obs.retry, calls: rec.calls.slice(before), total_ms: Date.now() - t1, phase: st.phase });
  }
  return { flow: flowId, tone, rows, profile: A.matchingProfile(st), core: st.asked.filter((q) => q.type === 'core').length, clarify: st.clarify.total, phase: st.phase };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (xs, p) => { if (!xs.length) return null; const v = [...xs].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
const lines = (r) => [r.reply, r.question].filter(Boolean).join(' ');
export function stats(runs) {
  const rows = runs.flatMap((r) => r.rows); const calls = rows.flatMap((x) => x.calls); const real = calls.filter((c) => c.in_real != null);
  return {
    runs: runs.length, turns: rows.length, calls: calls.length, http_errors: calls.filter((c) => c.error).length, errors: rows.filter((x) => x.error).length, retries: sum(rows.map((x) => (x.retry ?? []).length)),
    input_tokens: real.length ? sum(real.map((c) => c.in_real)) : '확인 불가(MOCK)', output_tokens: real.length ? sum(real.map((c) => c.out_real ?? 0)) : '확인 불가(MOCK)',
    max_core_questions: Math.max(...runs.map((r) => r.core)), over_5: runs.filter((r) => r.core > A.MAX_CORE_QUESTIONS).length, max_clarify: Math.max(...runs.map((r) => r.clarify)),
    finished_runs: runs.filter((r) => r.phase === 'done').length, questions_after_finish: rows.filter((x) => x.after && x.question).length,
    complaint_saved: rows.filter((x) => x.saved && ['repair', 'ask', 'fatigue'].includes(x.expect)).length,
    tone_mismatch_turns: runs.reduce((n, r) => n + r.rows.filter((x) => lines(x) && A.toneMismatch(r.tone, lines(x))).length, 0),
    id_leak: rows.filter((x) => /relationship_|attraction_comfort|values_character|boundaries/i.test(lines(x))).length,
    banned: rows.filter((x) => BANNED.test(lines(x))).length,
    confirmed_items: sum(runs.map((r) => r.profile.confirmed_preferences.length)), inferred_items: sum(runs.map((r) => r.profile.inferred_candidates.length)),
    turn_ms_p50: REAL ? pct(rows.map((x) => x.total_ms), 50) : '판정 불가(MOCK)', turn_ms_p95: REAL ? pct(rows.map((x) => x.total_ms), 95) : '판정 불가(MOCK)',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const MODELS = String(arg('--models') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!MODELS.length) { console.error('--models 필요'); process.exit(1); }
  if (process.argv.includes('--require-real') && !REAL) { console.log(JSON.stringify({ REAL_AI: 'BLOCKED_BY_ENVIRONMENT' })); process.exit(2); }
  const FROZEN = JSON.parse(readFileSync(path.resolve(HERE, '../ab-20260925/FROZEN_INPUTS.json'), 'utf8')).agent_gate ?? {};
  const frozenOk = FROZEN.agent_sha256 === AGENT_SHA && FROZEN.flows_sha256 === FLOWS_SHA && FROZEN.golden_sha256 === GOLDEN_SHA && JSON.stringify(FROZEN.models ?? []) === JSON.stringify(MODELS);
  if (REAL && !frozenOk) { console.error('FROZEN_MISMATCH — 에이전트·입력·모델 목록이 사전 등록과 다르면 실제 AI 를 돌리지 않는다'); process.exit(3); }
  const out = {};
  for (const m of MODELS) { out[m] = []; for (const r of FLOWS.runs) out[m].push(await runFlow(r.flow, r.tone, m)); }
  const S = Object.fromEntries(MODELS.map((m) => [m, stats(out[m])]));
  const mode = REAL ? '실제 OpenAI' : '[MOCK] 가짜 AI — 구조 확인용';
  const flat = (x) => String(x ?? '').replace(/\n/g, ' ⏎ ').replace(/\|/g, '/');
  const L = [`# echo-agent-v1 재생 — ${mode}`, '', `- agent.mjs SHA-256 ${AGENT_SHA.slice(0, 16)}… · test-flows ${FLOWS_SHA.slice(0, 16)}… · Golden ${GOLDEN_SHA.slice(0, 16)}… · 사전 등록 일치: ${frozenOk ? '예' : '아니오'}`,
    `- 모델: ${MODELS.join(' · ')} · 파라미터 temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 한 턴 상한 2(+마칠 때 1)`, '',
    '## 합계', '', `| 항목 | ${MODELS.join(' | ')} |`, `|---|${MODELS.map(() => '---').join('|')}|`, ...Object.keys(S[MODELS[0]]).map((k) => `| ${k} | ${MODELS.map((m) => S[m][k]).join(' | ')} |`), ''];
  for (const m of MODELS) for (const r of out[m]) {
    L.push(`## ${m} · ${r.flow} · 말투 ${r.tone} · 핵심 질문 ${r.core} · 되묻기 ${r.clarify} · ${r.phase === 'done' ? '마침' : '안 끝남'}`, '', '| # | 사용자 | 종류·저장 | 출력 |', '|---|---|---|---|');
    for (const x of r.rows) L.push(`| ${x.i} | ${flat(x.text ?? '(시작)')} | ${x.kind ?? '-'}${x.saved ? '·저장' : ''}${x.qtype ? `·${x.qtype}:${x.qpurpose}` : ''}${x.after ? '·끝난 뒤' : ''} | ${flat([x.reply && `💬 ${x.reply}`, x.question && `❓ ${x.question}`, x.finish && '(마무리)', x.error && `⚠️ ${x.error}`].filter(Boolean).join(' / '))} |`);
    L.push('');
  }
  const text = L.join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, models: MODELS, frozen_ok: frozenOk, agent_sha: AGENT_SHA, stats: S, runs: Object.fromEntries(MODELS.map((m) => [m, out[m].map((r) => ({ ...r, rows: r.rows.map(({ calls, ...x }) => ({ ...x, calls: calls.map((c) => ({ in: c.in_real ?? null, out: c.out_real ?? null, ms: c.ms, served: c.served_model ?? null, error: c.error ?? null })) })) }))])) }));
}
