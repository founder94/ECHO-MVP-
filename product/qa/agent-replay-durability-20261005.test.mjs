// 2026-10-05 Codex 리뷰(PR #132 56ae439) P2 3건 — 가짜 DB 쓰기 오류·가짜 AI(실제 DB·제공사 0).
// ① 턴 기록 마무리(자리 → agent_turn) 실패 뒤 같은 요청 재전송 = 상태 속 결과로 답함 · 업체 호출 0 · 앞선 상태에 다시 돌리기 0(4182589941)
// ② 끝난 같은 보기 요청 = 지금 저장된 상태로 답함(먼저 읽은 옛 상태 0)(4182589949)
// ③ 입력 칸 지시 줄도 prompt_version 에 들어감(4182589936)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const source = fileURLToPath(new URL('../../', import.meta.url));
let helper = readFileSync(path.join(source, 'product/qa/agent-server.test.mjs'), 'utf8');
helper = helper.slice(0, helper.indexOf("test('로그인 안 함"));
const once = (a, b) => { assert.equal(helper.split(a).length, 2, a); helper = helper.replace(a, b); };
once("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)};`);
once("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source, 'product/supabase/functions/doit-agent/')).href + '/')});`);
once("let filters = []; let op = 'select';", "let filters = []; let faultAction = null; let op = 'select';");
once("eq: (col, v) => { filters.push", "eq: (col, v) => { if (col === 'action') faultAction = v; filters.push");
once("const run = () => {", "const run = () => { if (state.zeroClaimFinish && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.status === 'applied' && !patch.action) { state.injected = (state.injected ?? 0) + 1; return { data: [], error: null }; } if (state.failClaimFinish && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.status === 'applied' && !patch.action) { state.injected = (state.injected ?? 0) + 1; return { data: null, error: { code: 'SYNTHETIC_WRITE' } }; } if (state.failClaimUpdate && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.action === 'agent_turn') { state.injected = (state.injected ?? 0) + 1; return { data: null, error: { code: 'SYNTHETIC_WRITE' } }; }");
helper += '\nexport {load,newState,T,Q,X,rid,ID};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'replay-durability-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid, ID } = await import(file.href);
const POLICY = JSON.stringify({ version: 'synthetic-replay', providers: { openai: { model: 'fixture', allow_user_text: true } }, tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 60000 } });
async function started() {
  const s = newState(); s.env = { AI_POLICY: POLICY }; const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { s, h, sid: r.body.session.id };
}

test('① 턴 기록 마무리 실패 → 같은 요청 재전송은 상태 속 결과(업체 호출 0 · 같은 질문)', async () => {
  const { s, h, sid } = await started();
  s.ai.push(T({ extracted: [X('attraction_comfort', '조용함', '조용한')], ...Q('values_character', '뭘 봐요?') }));
  s.failClaimUpdate = true;
  const req = { action: 'agent_turn', requestId: rid(), sessionId: sid, text: '조용한 사람' };
  const first = await h.call(req);
  assert.ok(s.injected >= 1, '마무리 쓰기 오류가 실제로 들어감');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  s.failClaimUpdate = false;
  const before = s.providerCalls?.length ?? 0;
  s.ai.push(T({ extracted: [X('values_character', '다른 답', '다른')], ...Q('relationship_style', '다른 질문?') }));
  const again = await h.call(req);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal((s.providerCalls?.length ?? 0) - before, 0, '재전송에 업체 호출 0');
  assert.equal(again.body.duplicate, true);
  assert.deepEqual(again.body.turn, first.body.turn, '같은 결과');
  assert.equal(again.body.session.current_question, first.body.session.current_question, '앞선 상태에 다시 돌리지 않음');
});

test('② 끝난 같은 보기 요청은 지금 저장된 상태로 답함', () => {
  const ix = readFileSync(path.join(source, 'product/supabase/functions/doit-agent/index.ts'), 'utf8');
  assert.match(ix, /if \(admit\.done\) \{ const now = await reloadSession\(sid\); return json\(\{ ok: true, session: sessionView\(sid, now \?\? stored\), limited: false, duplicate: true \}/);
  assert.match(ix, /if \(admit\.done\) \{ const now = await reloadSession\(sid\); return json\(\{ ok: true, session: sessionView\(sid, now \?\? stored\), duplicate: true \}/);
});

test('③ 입력 칸 지시 줄이 바뀌면 prompt_version 도 바뀜', () => {
  const ag = readFileSync(path.join(source, 'product/supabase/functions/doit-agent/agent.ts'), 'utf8');
  assert.match(ag, /export const PROMPT_VERSION = "p-" \+ fnv\([^\n]*\+ "\|flags:" \+ TURN_FLAG_RULES\.map/);
});

// Codex 리뷰(PR #132 5e61302) P2 3건
test('④ 보기 자리 끝내기(applied)를 못 쓰면 200 으로 답하지 않음(503 · 자리는 처리 중으로 남음)', async () => {
  const { s, h, sid } = await started();
  s.rescue = [{ choices: ['잘 웃는 사람', '말을 잘 들어주는 사람'] }];
  s.failClaimFinish = true;
  const r = await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid });
  assert.ok(s.injected >= 1, '끝내기 쓰기 오류가 실제로 들어감');
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(r.body.code, 'CLAIM_UNCONFIRMED');
});

test('⑤ 결과가 상태에서 밀려난 옛 요청 + 그 뒤 대화가 이어짐 → 옛 말을 다시 돌리지 않음(409 · 업체 호출 0)', async () => {
  const { s, h, sid } = await started();
  const text = '조용한 사람', requestId = rid();
  const payload_hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sid}:${text}`))).toString('hex');
  const old = new Date(Date.now() - 600000).toISOString();
  s.tables.doit_request_events.push({ user_id: ID.user, request_id: requestId, action: 'agent_turn_claim', target_id: sid, status: 'pending', error_code: 'PAID', applied_revision: 3, created_at: old, updated_at: old, payload_hash, response_payload: { base_turns: 0 } });
  s.ai.push(T({ extracted: [X('attraction_comfort', '조용함', '조용한')], ...Q('values_character', '뭘 봐요?') }));
  const before = s.providerCalls?.length ?? 0;
  const r = await h.call({ action: 'agent_turn', requestId, sessionId: sid, text });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.code, 'STATE_CHANGED');
  assert.equal((s.providerCalls?.length ?? 0) - before, 0);
});

test('⑥ 「A 아니면 B」 뒤 두 경우를 모두 담은 질문은 나뉨을 지킨 것으로 봄', async () => {
  const ag = readFileSync(path.join(source, 'product/supabase/functions/doit-agent/agent.ts'), 'utf8');
  const block = ag.match(/const COND_WORDS[\s\S]*?\n\/\/ 2026-10-04 QA\(목적/)[0];
  const ts = (await import(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)).default;
  const js = ts.transpileModule(block.replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const { keepsCondition } = new Function(js + '\nreturn { keepsCondition };')();
  assert.equal(keepsCondition('조용한 사람 아니면 활발한 사람이 좋아요', '조용한 사람이랑 활발한 사람 중 누구와 말이 편해요?'), true);
  assert.equal(keepsCondition('카페 또는 술집이요', '카페랑 술집 중 어디가 대화가 잘 돼요?'), true);
  assert.equal(keepsCondition('조용한 사람 아니면 활발한 사람이 좋아요', '활발한 사람이랑 있으면 뭐 해요?'), false, '한쪽만 고른 질문은 여전히 막힘');
});

test('⑦ 보기 자리 끝내기가 0행(자리가 그사이 바뀜)이어도 200 으로 답하지 않음(503)', async () => {
  const { s, h, sid } = await started();
  s.rescue = [{ choices: ['잘 웃는 사람', '말을 잘 들어주는 사람'] }];
  s.zeroClaimFinish = true;
  const r = await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid });
  assert.ok(s.injected >= 1, '0행 끝내기가 실제로 들어감');
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(r.body.code, 'CLAIM_UNCONFIRMED');
});


test('⑧ Codex P2(4183132885): 보기 저장 뒤 끝내기 실패(503) → 같은 요청 다시 보냄 = 모델 0 · 자리 끝냄 · 사용 기록 한 줄', async () => {
  const { s, h, sid } = await started();
  s.rescue = [{ choices: ['잘 웃는 사람', '말을 잘 들어주는 사람'] }];
  s.failClaimFinish = true;
  const requestId = rid();
  const r1 = await h.call({ action: 'agent_rescue', requestId, sessionId: sid });
  assert.equal(r1.status, 503, JSON.stringify(r1.body));
  const rows = () => s.tables.doit_request_events;
  const claim = () => rows().find((x) => x.action === 'agent_turn_claim' && x.target_id === sid && x.error_code !== null && x.status === 'pending' || (x.action === 'agent_turn_claim' && x.target_id === sid && x.status === 'applied'));
  const usage = () => rows().filter((x) => x.action === 'agent_usage' && x.target_id === sid).length;
  const usageBefore = usage();
  assert.equal(claim()?.status, 'pending', '첫 시도 자리는 처리 중으로 남음');
  s.failClaimFinish = false;
  const calls = s.providerCalls?.length ?? 0;
  const r2 = await h.call({ action: 'agent_rescue', requestId, sessionId: sid });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal((s.providerCalls?.length ?? 0) - calls, 0, '모델 호출 0');
  assert.equal(claim()?.status, 'applied', '앞선 유료 자리를 끝냄(하루 한도 이중 셈 0)');
  assert.equal(usage(), usageBefore, '첫 시도의 사용 기록 한 줄 그대로(같은 id · 새 줄 0)');
  const r3 = await h.call({ action: 'agent_rescue', requestId, sessionId: sid });
  assert.equal(r3.status, 200);
  assert.equal(usage(), usageBefore, '세 번째도 새 줄 0');
});
