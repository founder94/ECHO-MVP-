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
once("const run = () => {", "const run = () => { if (state.failClaimUpdate && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch && patch.action === 'agent_turn') { state.injected = (state.injected ?? 0) + 1; return { data: null, error: { code: 'SYNTHETIC_WRITE' } }; }");
helper += '\nexport {load,newState,T,Q,X,rid,ID};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'replay-durability-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid } = await import(file.href);
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
