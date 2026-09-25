// Core 재생(2026-09-25): core-0.1 을 Golden 34 입력으로 실제 OpenAI 모델에 돌려, 같은 모델의 B-1.0 실측(MODEL GATE run 36108344306)과 짝지어 비교한다.
// - 모델마다 바뀌는 것은 구조(B-1.0 → core-0.1) 하나다. 파라미터는 B-1.0 과 같다(temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 한 턴 상한 2).
// - core.mjs·Golden·판정 기준·모델 목록이 FROZEN_INPUTS.json 의 core_gate 와 다르면 실제 AI 로 돌지 않는다(종료 3). 키가 없으면 종료 2.
// - 「저장」 뜻이 B 와 다르다: core 는 원문을 늘 남기고, 「저장」 = 매칭 정보(들은 정보)로 남긴 것이 있음.
// - 질문 품질(이어짐·자연스러움)은 이 기계 숫자로 판정하지 않는다. 대표 휴대폰 대화로 본다.
// 실행: node spike/core-20260925/run-core.mjs --models gpt-4o-mini,gpt-4.1-mini [--require-real] [--out 결과.md] [--json 결과.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REAL, GOLDEN, GOLDEN_SHA, SPECS_SHA, recorder, evaluateSpecs, normQ, BANNED } from '../ab-20260925/harness-lib.mjs';
import { parseModelsMd } from '../ab-20260925/model-blind.mjs';
import * as C from './core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AB = path.resolve(HERE, '../ab-20260925');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
export const CORE_SHA = createHash('sha256').update(readFileSync(path.join(HERE, 'core.mjs'))).digest('hex');
const B_GATE_MD = path.resolve(HERE, '../../../docs/failure-intelligence/evidence/MODEL_GATE_20260925/models-result.md');

// [MOCK] 응답 — 구조 확인용. Golden 의 기대 종류를 그대로 돌려주고, 이번 말 첫 두 글자를 인용한다.
const KIND_OF = { answer: 'answer', repair: 'repair', correction: 'correction', ask: 'ask', unsure: 'unsure', fatigue: 'stop' };
let seq = 0;
const mockCore = (expect) => (_sys, input) => (input.latest === undefined
  ? JSON.stringify({ summary: [], closing: '[MOCK] 정리해 둘게요.' })
  : JSON.stringify({ kind: KIND_OF[expect] ?? 'answer', understood: '', reply: '[MOCK] 네.', wrong: [],
    remember: KIND_OF[expect] === 'answer' || KIND_OF[expect] === 'correction' ? [{ area: C.AREAS[seq % 4].id, note: `m${seq}`, quote: String(input.latest).replace(/\s/g, '').slice(0, 2) }] : [],
    question: KIND_OF[expect] === 'stop' ? null : `[MOCK] 질문 ${++seq}?` }));

export async function runCoreFlow(flow, model) {
  const rec = recorder(model);
  const st = C.newState({ purpose: flow.purpose, firstQuestion: '어떤 만남을 원하세요?' });
  const llm = (kind, prompt, input) => rec.llm(prompt, JSON.stringify(input), C.CORE_PARAMS);
  const rows = [];
  for (const [i, [text, expect, origin]] of flow.steps.entries()) {
    rec.mockFor.current = mockCore(expect); rec.mockFor.key = `C${i}`;
    const before = rec.calls.length; const t0 = Date.now();
    const { obs, response } = await C.runTurn(st, text, llm);
    rows.push({ i: i + 1, text, expect, origin, kind: response.kind ?? null, saved: !!response.saved, reply: [response.reply, response.closing].filter(Boolean).join(' ') || null,
      question: response.question ?? null, kept_question: null, finished: !!response.finish, error: response.error ?? null, facts: (response.facts ?? []).map((f) => `${f.area}:${f.note}`),
      calls: rec.calls.slice(before), retry: obs.retry, total_ms: Date.now() - t0 });
  }
  return { rows, profile: C.profile(st) };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (xs, p) => { if (!xs.length) return null; const v = [...xs].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
export function stats(runs) {
  const rows = runs.flatMap((r) => r.rows); const calls = rows.flatMap((x) => x.calls); const real = calls.filter((c) => c.in_real != null);
  const seen = new Map(); let sameQ = 0;
  for (const r of runs) { const s = new Set(); for (const x of r.rows) { if (!x.question) continue; const k = normQ(x.question); if (s.has(k)) sameQ++; s.add(k); } seen.set(r, s); }
  return { turns: rows.length, calls: calls.length, http_errors: calls.filter((c) => c.error).length, read_failed: rows.filter((x) => x.error).length, retries: sum(rows.map((x) => x.retry.length)),
    input_tokens: real.length ? sum(real.map((c) => c.in_real)) : '확인 불가(MOCK)', output_tokens: real.length ? sum(real.map((c) => c.out_real ?? 0)) : '확인 불가(MOCK)',
    complaint_saved: rows.filter((x) => x.saved && ['repair', 'ask', 'fatigue'].includes(x.expect)).length,
    answer_not_saved: rows.filter((x) => !x.saved && ['answer', 'correction'].includes(x.expect) && !x.finished).length,
    questions: rows.filter((x) => x.question).length, no_question_turns: rows.filter((x) => !x.question && !x.finished && !x.error).length,
    after_repair_or_correction_question: rows.filter((x) => ['repair', 'correction'].includes(x.expect) && x.question).length,
    same_question_in_flow: sameQ, jump_word_questions: rows.filter((x) => /활동/.test(x.question ?? '')).length, banned: rows.filter((x) => BANNED.test(`${x.reply ?? ''}${x.question ?? ''}`)).length,
    finished_turns: rows.filter((x) => x.finished).length,
    turn_ms_p50: REAL ? pct(rows.map((x) => x.total_ms), 50) : '판정 불가(MOCK)', turn_ms_p95: REAL ? pct(rows.map((x) => x.total_ms), 95) : '판정 불가(MOCK)' };
}

// B-1.0 실측(같은 모델·같은 입력)을 행으로 되살린다 — 비교 기준.
export function bRows(model) {
  const slim = parseModelsMd(readFileSync(B_GATE_MD, 'utf8'))[model];
  return slim?.map((flowRows, k) => flowRows.map(([kind, saved, reply, question, kept, finished, dropped, error], i) => ({ i: i + 1, text: GOLDEN[k].steps[i][0], kind, saved: !!saved, reply, question: question || null, kept_question: kept || null, finished: !!finished, error: error || null })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const MODELS = String(arg('--models') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!MODELS.length) { console.error('--models 필요'); process.exit(1); }
  if (process.argv.includes('--require-real') && !REAL) { console.log(JSON.stringify({ REAL_AI: 'BLOCKED_BY_ENVIRONMENT' })); process.exit(2); }
  const FROZEN = JSON.parse(readFileSync(path.join(AB, 'FROZEN_INPUTS.json'), 'utf8')).core_gate ?? {};
  const frozenOk = FROZEN.core_sha256 === CORE_SHA && FROZEN.golden_sha256 === GOLDEN_SHA && FROZEN.specs_sha256 === SPECS_SHA && JSON.stringify(FROZEN.models ?? []) === JSON.stringify(MODELS);
  if (REAL && !frozenOk) { console.error('FROZEN_MISMATCH — core·입력·판정 기준·모델 목록이 사전 등록과 다르면 실제 AI 를 돌리지 않는다'); process.exit(3); }
  const runs = {};
  for (const m of MODELS) { runs[m] = []; for (const flow of GOLDEN) runs[m].push({ flow, ...(await runCoreFlow(flow, m)) }); }
  const S = Object.fromEntries(MODELS.map((m) => [m, stats(runs[m])]));
  const verdicts = Object.fromEntries(MODELS.map((m) => { const b = bRows(m); return [m, b ? evaluateSpecs(GOLDEN.map((flow, k) => ({ flow, A: b[k], B: { rows: runs[m][k].rows } })), REAL) : []]; }));
  const tally = (vs, side) => `${vs.filter((v) => v[`${side}_verdict`] === 'PASS').length}/${vs.filter((v) => v[`${side}_verdict`] === 'FAIL').length}`;
  const mode = REAL ? '실제 OpenAI' : '[MOCK] 가짜 AI — 구조 확인용';
  const flat = (x) => String(x ?? '').replace(/\n/g, ' ⏎ ').replace(/\|/g, '/');
  const L = [`# Core 재생 — core-0.1 · Golden 34 · ${mode}`, '', `- core.mjs SHA-256 ${CORE_SHA.slice(0, 16)}… · Golden ${GOLDEN_SHA.slice(0, 16)}… · 판정 ${SPECS_SHA.slice(0, 16)}… · 사전 등록 일치: ${frozenOk ? '예' : '아니오'}`,
    `- 모델: ${MODELS.join(' · ')} · 파라미터 B-1.0 과 같음 · 비교 기준 = 같은 모델의 B-1.0 실측(MODEL GATE run 36108344306)`, '',
    '## 합계(core-0.1)', '', `| 항목 | ${MODELS.join(' | ')} |`, `|---|${MODELS.map(() => '---').join('|')}|`,
    ...Object.keys(S[MODELS[0]]).map((k) => `| ${k} | ${MODELS.map((m) => S[m][k]).join(' | ')} |`), '',
    '## Golden 기계 판정(같은 모델 B-1.0 → core-0.1, PASS/FAIL)', '', '| 모델 | B-1.0 | core-0.1 |', '|---|---|---|', ...MODELS.map((m) => `| ${m} | ${tally(verdicts[m], 'A')} | ${tally(verdicts[m], 'B')} |`), ''];
  for (const [k, flow] of GOLDEN.entries()) {
    L.push(`## ${flow.id} — 목적: ${flow.purpose}`, '', `| # | 사용자 | ${MODELS.map((m) => `${m} 종류·저장 | ${m} 출력`).join(' | ')} |`, `|---|---|${MODELS.map(() => '---|---').join('|')}|`);
    flow.steps.forEach((st, i) => L.push(`| ${i + 1} | ${flat(st[0])} | ${MODELS.map((m) => { const x = runs[m][k].rows[i]; return `${x.kind ?? '-'}·${x.saved ? '저장' : '비저장'} | ${flat([x.reply && `💬 ${x.reply}`, x.question && `❓ ${x.question}`, x.finished && '(마무리)', x.error && `⚠️ ${x.error}`].filter(Boolean).join(' / '))}`; }).join(' | ')} |`));
    L.push('');
  }
  const text = L.join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, models: MODELS, frozen_ok: frozenOk, core_sha: CORE_SHA, stats: S, verdicts, runs: Object.fromEntries(MODELS.map((m) => [m, runs[m].map((r) => ({ flow: r.flow.id, profile: r.profile, rows: r.rows.map(({ calls, ...x }) => ({ ...x, calls: calls.map((c) => ({ in: c.in_real ?? null, out: c.out_real ?? null, ms: c.ms, served: c.served_model ?? null, error: c.error ?? null })) })) }))])) }));
}
