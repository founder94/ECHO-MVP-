// 2026-09-26 데이터 자산 분리 — 대표 AI 실패(A) · 대표 리서치(B) · Agent 실패/실AI run(C)는 실제 사용자 상태(D)와 섞이지 않는다.
// 앱·서버 코드가 A·B·C 저장 위치를 읽거나 그 dataset 이름을 쓰면 실패한다(사용자 사실로 가는 길 0).
// 그리고 doit_insights 의 확인(confirmed)·정정(corrected) 상태를 쓰는 서버 경로를 지금 확인된 것으로 고정한다
// (P0 전수검사 2026-09-26: 사용자 버튼/직접 입력 요청 없이는 confirmed·corrected 가 생기지 않음). 새 쓰기 경로가 생기면 이 검사를 고치며 다시 검토한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|mjs|jsx)$/.test(n) ? [p] : [];
});
const RUNTIME = [...walk(path.join(PRODUCT, 'src')), ...walk(path.join(PRODUCT, 'supabase/functions'))];
const rel = (p) => path.relative(PRODUCT, p);

test('앱·서버 코드는 A·B·C 데이터 위치를 읽지 않는다', () => {
  const banned = [/failure-intelligence/, /docs\/research/, /observations\.json/, /failures\.json/, /runs\/run-\d/, /FROZEN_INPUTS/, /golden-failures/];
  const hits = RUNTIME.flatMap((f) => { const t = readFileSync(f, 'utf8'); return banned.filter((re) => re.test(t)).map((re) => `${rel(f)} ${re}`); });
  assert.deepEqual(hits, []);
});

test('앱·서버 코드에 A·B·C dataset 이름이 없다(사용자 상태로 승격하는 코드 0)', () => {
  const names = /FOUNDER_AI_FAILURE|FOUNDER_PRODUCT_RESEARCH|AGENT_FAILURE/;
  assert.deepEqual(RUNTIME.filter((f) => names.test(readFileSync(f, 'utf8'))).map(rel), []);
});

const FN = path.join(PRODUCT, 'supabase/functions');
const src = (f) => readFileSync(path.join(FN, f), 'utf8');
const count = (re) => walk(FN).reduce((n, f) => n + (readFileSync(f, 'utf8').match(re) ?? []).length, 0);

test('[P0] doit_insights 직접 쓰기는 get-step-question 의 이해 확인 저장 한 곳뿐 · 「맞아요」만 confirmed', () => {
  assert.equal(count(/from\("doit_insights"\)\s*\.(insert|update|upsert|delete)\(/g), 1);
  const gsq = src('get-step-question/index.ts');
  assert.match(gsq, /const status = choice === "agree" \? "confirmed" : choice === "no" \? "rejected" : "corrected";/);
  // 저장 함수는 사용자의 choose(SCENE 3 버튼) 요청 안에서만 불린다.
  const calls = [...gsq.matchAll(/await saveConfirmedMemory\(/g)].map((m) => m.index);
  const choose = gsq.indexOf('if (action === "choose")');
  assert.ok(calls.length === 2 && calls.every((i) => i > choose), 'choose 처리 밖에서 저장하지 않음');
});

test('[P0] AI 후보 생성은 언제나 candidate · 확인 전이는 사용자 요청(insight_confirm · synthesis_decide confirm)에서만', () => {
  const du = src('doit-understanding/index.ts');
  // 후보 생성 RPC 에는 상태를 넘기지 않는다(DB 함수가 candidate·ai 로 고정).
  for (const m of du.matchAll(/rpc\("doit_apply_insight_generate", \{([^}]*)\}/g)) assert.doesNotMatch(m[1], /status/);
  assert.equal(count(/rpc\("doit_apply_insight_transition"/g), 2);
  assert.match(du, /if \(transitionKey === "confirm"\) newStatus = "confirmed";/);
  assert.match(du, /const decision = body\.decision === "confirm" \? "confirmed" : body\.decision === "reject" \? "rejected" : "";/);
  // Agent·연결 서버는 doit_insights 를 쓰지 않는다.
  for (const f of ['doit-agent/index.ts', 'doit-agent/agent.ts', 'doit-connect/index.ts']) assert.doesNotMatch(src(f), /doit_apply_insight|from\("doit_insights"\)\s*\.(insert|update|upsert)/, f);
});

test('[P0] Profile·Matching 은 confirmed·corrected 만 읽는다', () => {
  assert.match(src('doit-connect/index.ts'), /from\("doit_insights"\)[^;]*\.in\("status", \["confirmed", "corrected"\]\)/);
  assert.match(src('echo-journey/index.ts'), /from\("doit_insights"\)[^;]*\.in\("status", \["confirmed", "corrected"\]\)/);
});
