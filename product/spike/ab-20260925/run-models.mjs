// MODEL GATE 실행기(2026-09-25). B-1.0(구조·Prompt·Context·파라미터 그대로)을 같은 Golden 입력으로 모델만 바꿔 돌린다.
// - 바꾸는 것은 모델 하나뿐이다. agentB.mjs·golden-failures.json·golden-specs.json 은 사전 고정 지문과 같아야 하고,
//   모델 목록도 FROZEN_INPUTS.json 의 model_gate.models 와 같아야 실제 AI 로 돈다(다르면 종료 코드 3). 키가 없으면 종료 코드 2(가짜로 돌지 않음).
// - 기록: 모델마다 호출·입력/출력 토큰(API usage 정본)·지연·재시도·응답이 알려 준 실제 세부판 · Golden 기계 판정 · 객관 FAIL.
//   비용은 공식 단가를 환경 변수(ECHO_PRICE_<모델>_IN/OUT, 달러/100만 토큰)로 넣었을 때만 계산한다.
// - 「활동」 등장 횟수 같은 값은 관측 숫자일 뿐 Guard·판정 규칙이 아니다(대표 LOCK: 낱말 금지 패치 금지).
// 실행: node spike/ab-20260925/run-models.mjs --models gpt-4o-mini,gpt-4.1-mini [--require-real] [--out 결과.md] [--json 결과.json]
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { B_PROMPT_VERSION } from './agentB.mjs';
import { REAL, GOLDEN, GOLDEN_SHA, SPECS_SHA, HERE, runB, objectiveFails, evaluateSpecs } from './harness-lib.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MODELS = String(arg('--models') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
if (MODELS.length < 2) { console.error('--models 기준모델,후보… (둘 이상)'); process.exit(1); }
const B_SHA = createHash('sha256').update(readFileSync(path.join(HERE, 'agentB.mjs'))).digest('hex');
if (process.argv.includes('--require-real') && !REAL) { const m = { REAL_AI: 'BLOCKED_BY_ENVIRONMENT' }; if (arg('--slim')) writeFileSync(arg('--slim'), JSON.stringify(Object.fromEntries(MODELS.map((m) => [m, runs[m].map((r) => r.rows.map((x) => [x.kind, x.saved ? 1 : 0, x.reply ?? '', x.question ?? '', x.kept_question ?? '', x.finished ? 1 : 0, x.dropped ?? '', x.error ?? '']))]))));
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(m)); console.log(JSON.stringify(m)); process.exit(2); }
const FROZEN = JSON.parse(readFileSync(path.join(HERE, 'FROZEN_INPUTS.json'), 'utf8'));
const gate = FROZEN.model_gate ?? {};
export const frozenOk = FROZEN.b.sha256 === B_SHA && FROZEN.golden.sha256 === GOLDEN_SHA && FROZEN.specs?.sha256 === SPECS_SHA && JSON.stringify(gate.models ?? []) === JSON.stringify(MODELS);
if (REAL && !frozenOk) { console.error('FROZEN_MISMATCH — B·입력·판정 기준·모델 목록이 사전 등록과 다르면 실제 AI 를 돌리지 않는다'); process.exit(3); }

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (xs, p) => { if (!xs.length) return null; const v = [...xs].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
const runs = {};
for (const m of MODELS) { runs[m] = []; for (const flow of GOLDEN) { const r = await runB(flow, { model: m }); objectiveFails(r.rows); runs[m].push({ flow, rows: r.rows }); } }

const JUMP_WORD = /활동/; // 관측용 숫자 — 판정·차단에 쓰지 않는다
const stat = (m) => { const rows = runs[m].flatMap((r) => r.rows); const calls = rows.flatMap((x) => x.calls); const real = calls.filter((c) => c.in_real != null);
  const inP = Number(process.env[`ECHO_PRICE_${m.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_IN`] ?? ''), outP = Number(process.env[`ECHO_PRICE_${m.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_OUT`] ?? '');
  const inT = real.length ? sum(real.map((c) => c.in_real)) : null, outT = real.length ? sum(real.map((c) => c.out_real ?? 0)) : null;
  return { model: m, served: [...new Set(calls.map((c) => c.served_model).filter(Boolean))].join(', ') || (REAL ? '기록 없음' : '[MOCK]'),
    turns: rows.length, llm_turns: rows.filter((x) => x.calls.length).length, calls: calls.length, http_errors: calls.filter((c) => c.error).length,
    input_tokens: inT ?? '확인 불가(MOCK)', output_tokens: outT ?? '확인 불가(MOCK)', total_tokens: inT != null ? inT + outT : '확인 불가(MOCK)',
    api_cost_usd: inT != null && inP > 0 && outP > 0 ? +((inT * inP + outT * outP) / 1e6).toFixed(4) : '확인 불가(공식 단가 미입력)',
    retries: rows.reduce((n, x) => n + x.retry.length, 0), question_dropped: rows.filter((x) => x.dropped).length, read_failed: rows.filter((x) => x.error).length,
    no_question_turns: rows.filter((x) => !x.question && !x.kept_question && !x.finished).length, objective_fail_turns: rows.filter((x) => x.fail.length).length,
    complaint_saved: rows.filter((x) => x.saved && ['repair', 'ask', 'fatigue'].includes(x.expect)).length, answer_not_saved: rows.filter((x) => !x.saved && ['answer', 'correction'].includes(x.expect) && !x.finished).length,
    jump_word_questions: rows.filter((x) => JUMP_WORD.test(x.question ?? '')).length,
    turn_ms_p50: REAL ? pct(rows.map((x) => x.total_ms), 50) : '판정 불가(MOCK)', turn_ms_p95: REAL ? pct(rows.map((x) => x.total_ms), 95) : '판정 불가(MOCK)', turn_ms_max: REAL ? Math.max(...rows.map((x) => x.total_ms)) : '판정 불가(MOCK)' }; };
const S = MODELS.map(stat);
const base = MODELS[0];
const verdicts = Object.fromEntries(MODELS.slice(1).map((m) => [m, evaluateSpecs(GOLDEN.map((flow, k) => ({ flow, A: runs[base][k].rows, B: { rows: runs[m][k].rows } })), REAL)]));
const tally = (vs, side) => ({ PASS: vs.filter((v) => v[`${side}_verdict`] === 'PASS').length, FAIL: vs.filter((v) => v[`${side}_verdict`] === 'FAIL').length, other: vs.filter((v) => !['PASS', 'FAIL'].includes(v[`${side}_verdict`])).length });

const flat = (x) => String(x ?? '').replace(/\n/g, ' ⏎ ').replace(/\|/g, '/');
const outText = (x) => [x.reply ? `💬 ${x.reply}` : '', x.question ? `❓ ${x.question}` : '', x.kept_question ? `(같은 질문 유지) ${x.kept_question}` : '', x.dropped ? `(질문 버림:${x.dropped})` : '', x.finished ? '(대화 끝)' : '', x.error ? `⚠️ ${x.error}` : ''].filter(Boolean).join(' / ');
const mode = REAL ? '실제 OpenAI' : '[MOCK] 가짜 AI — 구조 확인용';
const L = [`# MODEL GATE — B-1.0 모델만 바꾼 비교 · ${mode}`, '',
  `- B = agentB.mjs (Prompt ${B_PROMPT_VERSION}, SHA-256 ${B_SHA.slice(0, 16)}…) · 입력 golden-failures.json ${GOLDEN_SHA.slice(0, 16)}… · 판정 golden-specs.json ${SPECS_SHA.slice(0, 16)}… · 사전 등록 일치: ${frozenOk ? '예' : '아니오'}`,
  `- 모델(요청 이름): ${MODELS.join(' · ')} — 첫 번째가 기준(run1 과 같은 gpt-4o-mini). 파라미터는 모두 같다: temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 한 턴 상한 2.`, '',
  '## 합계', '', `| 항목 | ${MODELS.join(' | ')} |`, `|---|${MODELS.map(() => '---').join('|')}|`,
  ...Object.keys(S[0]).filter((k) => k !== 'model').map((k) => `| ${k} | ${S.map((s) => s[k]).join(' | ')} |`), '',
  '- jump_word_questions 는 질문에 「활동」이 들어간 횟수(관측 숫자) · complaint_saved = 문제제기·되묻기·지친 말로 표시된 입력을 답으로 저장한 수 · answer_not_saved = 답·정정으로 표시된 입력을 저장하지 않은 수(대화 끝 뒤 제외).', '',
  '## Golden 기계 판정(기준 모델 대비)', '', '| 후보 | 기준 PASS/FAIL | 후보 PASS/FAIL |', '|---|---|---|',
  ...MODELS.slice(1).map((m) => { const a = tally(verdicts[m], 'A'), b = tally(verdicts[m], 'B'); return `| ${m} | ${a.PASS}/${a.FAIL} | ${b.PASS}/${b.FAIL} |`; }), ''];
for (const [k, flow] of GOLDEN.entries()) {
  L.push(`## ${flow.id} — 목적: ${flow.purpose}`, '', `| # | 사용자 | ${MODELS.map((m) => `${m} 종류·저장 | ${m} 출력`).join(' | ')} |`, `|---|---|${MODELS.map(() => '---|---').join('|')}|`);
  flow.steps.forEach((st, i) => L.push(`| ${i + 1} | ${flat(st[0])} | ${MODELS.map((m) => { const x = runs[m][k].rows[i]; return `${x.kind ?? '-'}·${x.saved ? '저장' : '비저장'} | ${flat(outText(x))}`; }).join(' | ')} |`));
  L.push('');
}
const text = L.join('\n');
if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
const slim = (x) => ({ i: x.i, text: x.text, expect: x.expect, origin: x.origin, kind: x.kind, saved: x.saved, reply: x.reply, question: x.question, kept_question: x.kept_question, dropped: x.dropped, finished: x.finished, error: x.error, intent: x.intent, retry: x.retry, total_ms: x.total_ms, calls: x.calls.map((c) => ({ model: c.model, served_model: c.served_model ?? null, in: c.in_real ?? null, out: c.out_real ?? null, ms: c.ms, error: c.error ?? null })) });
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, models: MODELS, frozen_ok: frozenOk, b_sha: B_SHA, golden_sha: GOLDEN_SHA, specs_sha: SPECS_SHA, stats: S, verdicts, runs: Object.fromEntries(MODELS.map((m) => [m, runs[m].map((r) => ({ flow: r.flow.id, rows: r.rows.map(slim) }))])) }));
