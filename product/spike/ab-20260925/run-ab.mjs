// CTO A/B Spike 하네스(2026-09-25). Current Agent A(운영 v27 원본 · 동결) 와 Minimal Agent B(B-1.0) 를 같은 입력·같은 모델 조건으로 돌린다.
// - 입력 = golden-failures.json(고정·지문 기록). 부품 = harness-lib.mjs.
// - OPENAI_API_KEY 가 환경 변수에 있으면 실제 OpenAI(같은 모델·temperature·top_p·max_tokens). 없으면 [MOCK] — 구조·토큰·호출 수만 의미가 있고 품질 판정 불가.
// - --require-real: 키가 없으면 MOCK 으로 돌지 않고 REAL_AI=BLOCKED_BY_ENVIRONMENT 를 적고 끝낸다(가짜 결과가 실AI 로 오인되지 않게).
//
// 실행: node spike/ab-20260925/run-ab.mjs [--require-real] [--flows FLOW1,FLOW3] [--out 결과.md] [--json 결과.json] [--blind 검수표.md --key 열쇠.json]
//       (NODE_PATH 에 typescript·js-tiktoken 이 있어야 한다)
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { B_PROMPT_VERSION } from './agentB.mjs';
import { A_SHA, REAL, MODEL, GOLDEN, GOLDEN_SHA, HERE, runA, runB, objectiveFails } from './harness-lib.mjs';
import path from 'node:path';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const B_SHA = createHash('sha256').update(readFileSync(path.join(HERE, 'agentB.mjs'))).digest('hex');
if (process.argv.includes('--require-real') && !REAL) {
  const msg = { REAL_AI: 'BLOCKED_BY_ENVIRONMENT', reason: 'OPENAI_API_KEY 가 이 실행 환경 변수에 없다', golden_sha: GOLDEN_SHA, b_sha: B_SHA, a_sha: A_SHA };
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(msg, null, 1));
  console.log(JSON.stringify(msg));
  process.exit(2);
}
const pick = arg('--flows') ? new Set(arg('--flows').split(',')) : null;
const FLOWS = GOLDEN.filter((f) => !pick || pick.has(f.id));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const results = [];
for (const flow of FLOWS) { const A = objectiveFails(await runA(flow)); const B = await runB(flow); objectiveFails(B.rows); results.push({ flow, A, B }); }

const mode = REAL ? `실제 OpenAI · 모델 ${MODEL}` : '[MOCK] 가짜 AI — 호출 수·입력 토큰·서버 결정만 의미 있음 · 출력 문장·품질·지연은 판정 불가';
const flat = (x) => String(x ?? '').replace(/\n/g, ' ⏎ ').replace(/\|/g, '/');
const outText = (x) => [x.reply ? `💬 ${x.reply}` : '', x.question ? `❓ ${x.question}` : '', x.kept_question ? `(같은 질문 유지) ${x.kept_question}` : '', x.dropped ? `(질문 버림:${x.dropped})` : '', x.error ? `⚠️ ${x.error}` : ''].filter(Boolean).join(' / ');
const inTok = (c) => c.sys_tokens + c.user_tokens;
const L = [`# A/B Spike 하네스 결과 — ${mode}`, '', `- A = 운영 v27 원본(SHA-256 ${A_SHA.slice(0, 16)}…, 저장소 rollback/doit-understanding.v27.ts · 실행 전 지문 확인) · B = spike/ab-20260925/agentB.mjs (Prompt ${B_PROMPT_VERSION})`,
  `- 고정 입력 golden-failures.json SHA-256 ${GOLDEN_SHA.slice(0, 16)}… · B 파일 SHA-256 ${B_SHA.slice(0, 16)}…`,
  `- 모델 조건(A·B 같음): temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 모델 ${MODEL}`,
  '- 토큰: o200k_base 로 센 값(요청 본문 system+user). REAL 실행이면 API usage(prompt/completion)를 따로 적는다 — 그것이 정본. 비용은 공식 가격표 확인 전 계산하지 않는다.',
  '- 출처: ACTUAL = 운영 기록·대표 실기기 실제 입력 · SYNTHETIC = 지시서·검사표 예문. 기대 = 사람이 붙인 표시(객관 FAIL 판정에만 씀).', ''];
for (const r of results) {
  L.push(`## ${r.flow.id} — ${r.flow.note}`, `목적: ${r.flow.purpose}`, '', '| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  r.A.forEach((a, k) => { const b = r.B.rows[k];
    L.push(`| ${a.i} | ${a.origin} | ${flat(a.text)} | ${a.expect} | ${a.kind ?? '-'}(${a.by || '-'})·${a.saved ? '저장' : '비저장'} | ${flat(outText(a))} | ${a.calls.length} | ${a.retry.join(',')} | ${a.fail.join(', ')} | ${b.kind ?? '-'}·${b.saved ? '저장' : '비저장'} | ${flat(outText(b))} | ${flat(b.intent ?? '')} | ${b.calls.length} | ${b.retry.join(',')} | ${b.fail.join(', ')} |`); });
  L.push('');
}
const all = (side) => results.flatMap((r) => (side === 'A' ? r.A : r.B.rows));
const pct = (xs, p) => { if (!xs.length) return null; const v = [...xs].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
const stat = (side) => { const rows = all(side); const calls = rows.flatMap((x) => x.calls); const llmTurns = rows.filter((x) => x.calls.length);
  const real = calls.filter((c) => c.in_real != null);
  return { turns: rows.length, llm_turns: llmTurns.length, calls: calls.length, calls_per_llm_turn: +(calls.length / Math.max(1, llmTurns.length)).toFixed(2), max_calls_in_turn: Math.max(0, ...rows.map((x) => x.calls.length)),
    sys_tokens_per_call: calls.length ? Math.round(sum(calls.map((c) => c.sys_tokens)) / calls.length) : 0, user_tokens_per_call: calls.length ? Math.round(sum(calls.map((c) => c.user_tokens)) / calls.length) : 0,
    input_tokens_total_o200k: sum(calls.map(inTok)), output_tokens_total_o200k: sum(calls.map((c) => c.out_tokens ?? 0)),
    usage_prompt_tokens: real.length ? sum(real.map((c) => c.in_real)) : '확인 불가(MOCK)', usage_completion_tokens: real.length ? sum(real.map((c) => c.out_real ?? 0)) : '확인 불가(MOCK)',
    retries: rows.reduce((n, x) => n + x.retry.length, 0), question_failed: rows.filter((x) => x.error === 'QUESTION_FAILED').length, question_dropped: rows.filter((x) => x.dropped).length,
    no_question_turns: rows.filter((x) => !x.question && !x.kept_question).length, objective_fail_turns: rows.filter((x) => x.fail.length).length,
    turn_ms_p50: REAL ? pct(rows.map((x) => x.total_ms), 50) : '판정 불가(MOCK)', turn_ms_p95: REAL ? pct(rows.map((x) => x.total_ms), 95) : '판정 불가(MOCK)', turn_ms_max: REAL ? Math.max(...rows.map((x) => x.total_ms)) : '판정 불가(MOCK)',
    llm_ms_p50: REAL ? pct(calls.map((c) => c.ms), 50) : '판정 불가(MOCK)', llm_ms_max: REAL ? Math.max(0, ...calls.map((c) => c.ms)) : '판정 불가(MOCK)' }; };
const SA = stat('A'), SB = stat('B');
const fieldAvg = (side) => { const calls = all(side).flatMap((x) => x.calls); const acc = {}; for (const c of calls) for (const [k, v] of Object.entries(c.fields ?? {})) acc[k] = (acc[k] ?? 0) + v; return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v / Math.max(1, calls.length))]).sort((x, y) => y[1] - x[1])); };
const FA = fieldAvg('A'), FB = fieldAvg('B');
L.push('## 합계', '', '| 항목 | A | B |', '|---|---|---|', ...Object.keys(SA).map((k) => `| ${k} | ${SA[k]} | ${SB[k]} |`), '',
  '- 지연 p95 는 표본이 작아 사실상 최댓값에 가깝다(표본 수 = turns · calls).', '');
L.push('## Context 구성 — 호출 1번당 평균 토큰(입력 JSON 항목별 · system 프롬프트 제외)', '', `- A system 프롬프트 ${SA.sys_tokens_per_call} 토큰 · B system 프롬프트 ${SB.sys_tokens_per_call} 토큰`, '', '| A 항목 | 토큰 |', '|---|---|', ...Object.entries(FA).map(([k, v]) => `| ${k} | ${v} |`), '', '| B 항목 | 토큰 |', '|---|---|', ...Object.entries(FB).map(([k, v]) => `| ${k} | ${v} |`), '');
if (!REAL) L.push('> [MOCK] 출력 문장은 가짜 AI 가 만든 모양일 뿐이다. 질문 품질·반복·자연스러움·지연은 이 표로 판정하지 않는다. 객관 FAIL 도 MOCK 에서는 구조 확인용이다.');
// 블라인드 검수표: 입력마다 USER / OUTPUT X / OUTPUT Y. X·Y 가 A·B 중 무엇인지는 입력마다 무작위, 열쇠는 따로(검수 전 열지 않는다). Claude 는 승자를 고르지 않는다.
if (arg('--blind')) {
  const B = ['# 대표 블라인드 검수표 — A/B Spike', '', `- 모드: ${mode}`, ...(REAL ? [] : ['- ⚠️ [MOCK] 이 표는 모양 확인용이다. 가짜 AI 문장이라 검수하지 않는다.']),
    '- 입력마다 X·Y 중 하나를 고른다: **X가 낫다 / Y가 낫다 / 둘 다 별로다**. 이름(A/B)은 검수가 끝난 뒤 열쇠 파일로만 확인한다.',
    '- 보는 기준: 방금 말에 먼저 반응했나 · 이미 말한 걸 다시 묻지 않았나 · 문제제기 뒤 방향을 바꿨나 · 사람처럼 들리나. 질문이 없어도 괜찮다(질문은 의무가 아니다).', ''];
  const key = [];
  for (const r of results) {
    B.push(`## ${r.flow.id} (목적: ${r.flow.purpose})`, '');
    r.A.forEach((a, k) => { const b = r.B.rows[k]; const flip = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 1;
      const o = (x) => flat([x.reply ?? '', x.question ?? '', x.kept_question ? `(같은 질문 다시: ${x.kept_question})` : '', x.error ? '(다음 질문을 만들지 못함)' : ''].filter(Boolean).join(' / ')) || '(출력 없음)';
      const [x, y] = flip ? [o(b), o(a)] : [o(a), o(b)];
      key.push({ flow: r.flow.id, turn: a.i, X: flip ? 'B' : 'A', Y: flip ? 'A' : 'B' });
      B.push(`**${r.flow.id}-${a.i}** (${a.origin})`, '', `- USER: ${flat(a.text)}`, `- OUTPUT X: ${x}`, `- OUTPUT Y: ${y}`, '- 선택: ☐ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다', '- 메모:', ''); });
  }
  writeFileSync(arg('--blind'), B.join('\n'));
  if (arg('--key')) writeFileSync(arg('--key'), JSON.stringify(key, null, 1));
}
const text = L.join('\n');
if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ mode, model: MODEL, prompt_b: B_PROMPT_VERSION, golden_sha: GOLDEN_SHA, b_sha: B_SHA, a_sha: A_SHA, A: SA, B: SB, contextA: FA, contextB: FB, results: results.map((r) => ({ flow: r.flow.id, A: r.A.map(({ calls, ...x }) => ({ ...x, calls: calls.map(({ params, ...c }) => c) })), B: r.B.rows.map(({ calls, ...x }) => ({ ...x, calls: calls.map(({ params, ...c }) => c) })) })) }, null, 1));

