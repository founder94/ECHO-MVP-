// 2026-10-05 Codex echo-review(PR #132 댓글 5991933980) 재현 — 입력·기대값 그대로. 바꾼 곳은 실행 장치뿐(소스 경로 기본값).
// 2026-10-05 Codex 리뷰(PR #132 ee8f90b) P1 3건 — 가짜 DB 쓰기 오류·오래된 자리·가짜 AI(실제 DB·제공사 0).
// ① 소개·보기 사용 기록 쓰기 실패 → 자리는 「결과 모름」으로 하루 한도에 남는다(4182156210)
// ② 24시간 지난 결과 모름 자리를 199회에서 다시 잡으면 업체 호출 0(4182156201)
// ③ 실패 턴 기록 쓰기 실패 → 자리는 「결과 모름」(4182156216)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const source = process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url)); assert.ok(source, 'Exact independent source root required');
let helper = readFileSync(path.join(source, 'product/qa/agent-server.test.mjs'), 'utf8');
helper = helper.slice(0, helper.indexOf("test('로그인 안 함"));
const once = (a, b) => { assert.equal(helper.split(a).length, 2, a); helper = helper.replace(a, b); };
once("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)};`);
once("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source, 'product/supabase/functions/doit-agent/')).href + '/')});`);
once("      insert: (row) => {\n        const t = table(name);", "      insert: (row) => {\n        if (state.failInsert && state.failInsert(name, row)) { state.injected = (state.injected ?? 0) + 1; return Promise.resolve({ data: null, error: { code: 'SYNTHETIC_WRITE' } }); }\n        const t = table(name);");
helper += '\nexport {load,newState,T,Q,X,rid,ID};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'usage-durability-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid, ID } = await import(file.href);
const POLICY = JSON.stringify({ version: 'synthetic-durability', providers: { openai: { model: 'fixture', allow_user_text: true } }, tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 60000 } });

test('paid first-answer agent_start must retain uncertain usage if successful turn receipt INSERT fails', async () => {
  const s = newState(); s.env = { AI_POLICY: POLICY }; const h = load(s);
  s.failInsert = (name, row) => name === 'doit_request_events' && row.action === 'agent_turn' && row.status === 'applied';
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구. 편하게 만나고 싶어요' });
  const paidCalls = s.providerCalls?.length ?? 0;
  const keeper = s.tables.doit_request_events.filter(row => row.action === 'agent_turn_claim').at(-1);
  const receipts = s.tables.doit_request_events.filter(row => row.action === 'agent_usage' || (row.action === 'agent_turn' && (row.response_payload?.record?.ai_usage?.attempts ?? 0) > 0));
  const observed = { http: r.status, paidCalls, injected: s.injected ?? 0, receiptCount: receipts.length, claimStatus: keeper?.status, claimError: keeper?.error_code };
  console.log('synthetic first-answer start usage durability', JSON.stringify(observed));
  assert.ok(paidCalls > 0, 'Actual synthetic provider path must have executed');
  assert.ok(s.injected > 0, 'Successful paid turn receipt insert was actually rejected');
  assert.equal(receipts.length, 0, 'No alternate durable daily-use receipt was written');
  assert.equal(keeper?.error_code, 'TURN_UNCERTAIN', 'Missing usage receipt must leave this paid attempt counted as uncertain');
  assert.notEqual(keeper?.status, 'applied', 'A failed usage receipt cannot finalize this paid claim');
});

