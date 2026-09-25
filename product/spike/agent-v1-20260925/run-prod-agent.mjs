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
const AGENT_FILE = path.resolve(HERE, '../../supabase/functions/doit-agent/agent.ts');
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

const KIND_OF = { answer: 'answer', repair: 'repair', correction: 'correction', ask: 'ask', unsure: 'unsure', fatigue: 'stop', mixed: 'answer' };
let seq = 0;
const mock = (expect) => (_sys, input) => {
  if (input.latest === undefined) return JSON.stringify({ summary: [], closing: '[MOCK] 정리해 둘게요.' });
  const kind = KIND_OF[expect] ?? 'answer'; const open = input.open_purposes ?? [];
  return JSON.stringify({ kind, understood: '', reply: `[MOCK] 받아주기 ${++seq}.`, inferred: [], declared: null, wrong: [],
    extracted: ['answer', 'correction'].includes(kind) && input.current_question ? [{ purpose: input.current_question.purpose, note: `m${seq}`, quote: String(input.latest).replace(/\s/g, '').slice(0, 2) }] : [],
    next: kind === 'stop' || !open.length ? { type: 'none' } : kind === 'ask' && input.current_question ? { type: 'core', purpose: input.current_question.purpose, question: `[MOCK] 다시 ${seq}?` } : { type: 'core', purpose: open[0].purpose, question: `[MOCK] 질문 ${++seq}?` } });
};

export async function runFlow(A, flowId, tone, model) {
  const flow = flowOf(flowId);
  const rec = recorder(model);
  const llm = (kind, prompt, input) => rec.llm(prompt, JSON.stringify(input), A.AGENT_PARAMS);
  const st = A.newState({ tone });
  A.seedFirstQuestion(st);
  const rows = [];
  for (const [i, s] of flow.steps.entries()) {
    rec.mockFor.current = mock(s.expect); rec.mockFor.key = `T${i}`;
    const before = rec.calls.length; const t1 = Date.now();
    const wasDone = st.phase !== 'talk'; const coreBefore = A.coreAsked(st).length;
    const { obs, response } = await A.runTurn(st, s.text, llm);
    rows.push({ i: i + 1, text: s.text, expect: s.expect, origin: s.origin, kind: response.kind ?? null, saved: !!response.saved, extracted: (response.extracted ?? []).map((e) => e.purpose),
      reply: [response.reply, response.closing].filter(Boolean).join(' ') || null, question: response.question ?? null, qtype: response.question_type ?? null, qpurpose: response.question_purpose ?? null,
      finish: !!response.finish, after: wasDone, error: response.error ?? null, retry: obs.retry, calls: rec.calls.slice(before), total_ms: Date.now() - t1, core_before: coreBefore, core_after: A.coreAsked(st).length });
  }
  return { flow: flowId, tone, rows, profile: A.matchingProfile(st), core: A.coreAsked(st).length, clarify: st.clarify.total, phase: st.phase };
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
    ask_added_question: rows.filter((x) => x.kind === 'ask' && !x.after && x.core_after > x.core_before).length,
    tone_mismatch_turns: runs.reduce((n, r) => n + r.rows.filter((x) => lines(x) && A.toneMismatch(r.tone, lines(x))).length, 0),
    sample_copy: rows.filter((x) => /편한\s*게\s*제일\s*중요/.test(lines(x))).length,
    repeated_reply: repeatedReply,
    id_leak: rows.filter((x) => A.leaksId(lines(x))).length,
    banned: rows.filter((x) => BANNED.test(lines(x))).length,
    confirmed_items: sum(runs.map((r) => r.profile.confirmed_preferences.length)), inferred_items: sum(runs.map((r) => r.profile.inferred_candidates.length)),
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
    for (const x of r.rows) L.push(`| ${x.i} | ${flat(x.text)} | ${x.kind ?? '-'}${x.saved ? '·저장' : ''}${x.qtype ? `·${x.qtype}:${x.qpurpose}` : ''}${x.after ? '·끝난 뒤' : ''} | ${flat([x.reply && `💬 ${x.reply}`, x.question && `❓ ${x.question}`, x.finish && '(마무리)', x.error && `⚠️ ${x.error}`].filter(Boolean).join(' / '))} |`);
    L.push('');
  }
  const text = L.join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, models: MODELS, frozen_ok: frozenOk, agent_ts_sha: AGENT_TS_SHA, stats: S }));
}
