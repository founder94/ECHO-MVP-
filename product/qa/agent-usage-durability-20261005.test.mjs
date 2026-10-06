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
const source = fileURLToPath(new URL('../../', import.meta.url));
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
async function started() {
  const s = newState(); s.env = { AI_POLICY: POLICY }; const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { s, h, sid: r.body.session.id };
}
const claims = (s) => s.tables.doit_request_events.filter((r) => r.action === 'agent_turn_claim');

test('① 보기(rescue) 사용 기록 쓰기 실패 → 자리는 TURN_UNCERTAIN(하루 한도에 셈) · applied 로 끝내지 않음', async () => {
  const { s, h, sid } = await started();
  s.rescue = [{ choices: ['잘 웃는 사람', '말을 잘 들어주는 사람'] }];
  s.failInsert = (name, row) => name === 'doit_request_events' && row.action === 'agent_usage';
  const r = await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid });
  assert.ok(s.injected > 0, '사용 기록 쓰기 오류가 실제로 들어감');
  const c = claims(s).at(-1);
  assert.equal(c.error_code, 'TURN_UNCERTAIN', JSON.stringify({ status: r.status, claim: c }));
  assert.notEqual(c.status, 'applied');
});

test('② 24시간 지난 결과 모름 자리 + 오늘 199회 → 다시 잡아도 업체 호출 0 · 앞선 시도 기록은 남음', async () => {
  const { s, h, sid } = await started();
  const rows = s.tables.doit_request_events;
  const used = rows.filter((r) => r.action === 'agent_usage' || (r.action === 'agent_turn' && (r.response_payload?.record?.ai_usage?.attempts ?? 0) > 0)).length;
  rows.push(...Array.from({ length: 199 - used }, () => ({ user_id: ID.user, request_id: rid(), action: 'agent_turn', status: 'applied', created_at: new Date().toISOString(), response_payload: { record: { ai_usage: { attempts: 1 } } } })));
  const text = '조용한 사람', requestId = rid();
  const payload_hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sid}:${text}`))).toString('hex');
  const old = new Date(Date.now() - 25 * 3600_000).toISOString();
  rows.push({ user_id: ID.user, request_id: requestId, action: 'agent_turn_claim', target_id: sid, status: 'pending', error_code: 'PAID', applied_revision: 7, created_at: old, updated_at: old, payload_hash });
  s.ai.push(T({ extracted: [X('attraction_comfort', '조용함', '조용한')], ...Q('values_character', '뭘 봐요?') }));
  const before = s.providerCalls?.length ?? 0;
  const r = await h.call({ action: 'agent_turn', requestId, sessionId: sid, text });
  assert.equal((s.providerCalls?.length ?? 0) - before, 0, `HTTP ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.status, 429);
  assert.equal(rows.filter((x) => x.action === 'agent_usage' && x.response_payload?.usage?.why === 'claim_uncertain').length, 1, '앞선 시도 기록 1줄');
});

test('③ 실패 턴 기록 쓰기 실패 → 자리는 TURN_UNCERTAIN(실패로 놓지 않음)', async () => {
  const { s, h, sid } = await started();
  s.fail = { openai: ['bad', 'bad', 'bad', 'bad'] };
  s.failInsert = (name, row) => name === 'doit_request_events' && row.action === 'agent_turn' && row.status === 'failed';
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '조용한 사람' });
  assert.ok(r.status >= 500, `HTTP ${r.status}`);
  assert.ok(s.injected > 0, '실패 턴 기록 쓰기 오류가 실제로 들어감');
  assert.equal(claims(s).at(-1).error_code, 'TURN_UNCERTAIN', JSON.stringify(claims(s).at(-1)));
});
