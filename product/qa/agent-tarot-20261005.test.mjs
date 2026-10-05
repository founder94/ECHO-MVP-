// 2026-10-05 대표 「타로 해석 실패 이유를 알아내서 최종 완성」 · Codex echo-spec 20261005 카드 해석 A — agent_card(가짜 DB·가짜 AI · 실제 DB·제공사 0).
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

const READING = { summary: '오늘은 조용히 마음을 정리하기 좋은 흐름이에요. 서두르지 않아도 괜찮아요.', tags: ['정리', '여유', '대화'], cards: [{ label: '현재의 에너지', value: '차분함' }, { label: '흐름의 방향', value: '천천히 다가감' }, { label: '놓치지 말 것', value: '내 속도' }] };
const claims = (s) => s.tables.doit_request_events.filter((x) => x.action === 'agent_turn_claim' && x.target_id == null);
const usage = (s) => s.tables.doit_request_events.filter((x) => x.action === 'agent_usage').length;

test('타로 ① 해석 = 카드·목적만 받아 한 번 부르고 해석을 돌려줌 · 사용 기록 한 줄 · 자리 끝남(해석 보관) · 대화 상태 쓰기 0', async () => {
  const { s, h } = await started();
  const sessionsBefore = s.tables.doit_request_events.filter((x) => x.action === 'agent_session').map((x) => JSON.stringify(x.response_payload));
  const used = usage(s), calls = s.providerCalls?.length ?? 0;
  s.ai.push(READING);
  const r = await h.call({ action: 'agent_card', requestId: rid(), cardName: '별', purpose: '편하게 만날 친구' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.reading.summary, READING.summary);
  assert.deepEqual(r.body.reading.tags, READING.tags);
  assert.equal((s.providerCalls?.length ?? 0) - calls, 1);
  assert.equal(usage(s) - used, 1, '사용 기록 한 줄');
  const c = claims(s).at(-1);
  assert.equal(c.status, 'applied'); assert.equal(c.error_code, null); assert.equal(c.response_payload.card.summary, READING.summary);
  assert.deepEqual(s.tables.doit_request_events.filter((x) => x.action === 'agent_session').map((x) => JSON.stringify(x.response_payload)), sessionsBefore, '대화 상태 그대로');
});

test('타로 ② 같은 요청 다시 보냄 = 보관한 해석 · 업체 호출 0 · 사용 기록 새 줄 0', async () => {
  const { s, h } = await started();
  s.ai.push(READING);
  const req = { action: 'agent_card', requestId: rid(), cardName: '달', purpose: '' };
  assert.equal((await h.call(req)).status, 200);
  const calls = s.providerCalls?.length ?? 0, used = usage(s);
  const again = await h.call(req);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.reading.summary, READING.summary);
  assert.equal((s.providerCalls?.length ?? 0) - calls, 0);
  assert.equal(usage(s), used);
});

test('타로 ②-b Codex P2(4184790634): 끝난 요청 다시 보냄 = AI 키·정책이 없어져도 보관한 해석(AI_NOT_CONFIGURED 0) · 새 요청은 설정 필요', async () => {
  const { s, h } = await started();
  s.ai.push(READING);
  const req = { action: 'agent_card', requestId: rid(), cardName: '별', purpose: '' };
  assert.equal((await h.call(req)).status, 200);
  s.env = { AI_POLICY: POLICY, OPENAI_API_KEY: '' };
  const calls = s.providerCalls?.length ?? 0;
  const again = await h.call(req);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.reading.summary, READING.summary);
  const fresh = await h.call({ ...req, requestId: rid() });
  assert.equal(fresh.status, 500); assert.equal(fresh.body.code, 'AI_NOT_CONFIGURED');
  assert.equal((s.providerCalls?.length ?? 0) - calls, 0);
  // 같은 요청 id 에 다른 카드 = 보관한 해석을 주지 않음(409)
  s.env = { AI_POLICY: POLICY };
  const other = await h.call({ ...req, cardName: '달' });
  assert.equal(other.status, 409, JSON.stringify(other.body));
});

test('타로 ③ 모양이 틀린 답 = 502 AI_FORMAT(가짜 성공 0) · 자리 놓음 · 사용 기록은 남김', async () => {
  const { s, h } = await started();
  const used = usage(s);
  s.ai.push({ hello: 'world' });
  const r = await h.call({ action: 'agent_card', requestId: rid(), cardName: '태양', purpose: '' });
  assert.equal(r.status, 502, JSON.stringify(r.body));
  assert.equal(r.body.code, 'AI_FORMAT');
  assert.equal(claims(s).at(-1).status, 'failed');
  assert.equal(usage(s) - used, 1);
});

test('타로 ④ 잘못된 입력(빈 카드 · 긴 카드 이름 · 목적에 연락처) = 400 · 업체 호출 0', async () => {
  const { s, h } = await started();
  const calls = s.providerCalls?.length ?? 0;
  for (const b of [{ cardName: '' }, { cardName: 'ㄱ'.repeat(51) }, { cardName: '별', purpose: '010-1234-5678 로 연락 주세요' }]) {
    const r = await h.call({ action: 'agent_card', requestId: rid(), ...b });
    assert.equal(r.status, 400, JSON.stringify(b));
  }
  assert.equal((s.providerCalls?.length ?? 0) - calls, 0);
});

test('타로 ⑤ 지시문 = 미래·결혼·건강·투자·성격 단정 금지 · 화면 모양(summary·tags·cards) · 다른 경로와 같은 보호(admitClaim · usageOnce · finishClaim 보관)', () => {
  const cr = readFileSync(path.join(source, 'product/supabase/functions/doit-agent/card-reading.ts'), 'utf8');
  const ix = readFileSync(path.join(source, 'product/supabase/functions/doit-agent/index.ts'), 'utf8');
  assert.match(cr, /미래·결혼·건강·투자를 단정하지 마/);
  assert.match(cr, /사용자의 성격이나 감정을 단정하지 마/);
  const block = ix.slice(ix.indexOf('if (action === "agent_card")'), ix.indexOf('if (action === "agent_ref")'));
  const helper = ix.slice(ix.indexOf('const paidOnce = async'), ix.indexOf('if (action === "agent_card")'));
  assert.ok(block.length > 0 && helper.length > 0, 'agent_card 블록 · 공통 보호');
  for (const t of ['paidOnce<CR.CardReading>', 'tag: "card", key: "card"', 'kind: "card_reading"']) assert.ok(block.includes(t), t);
  for (const t of ['admitClaim(', 'paid: true, capped: dailyCapped', 'usageOnce(ctx, null, o.tag', 'finishClaim(admin, userId, claimId, attempt, { [o.key]:', 'aiReady(o.kind)']) assert.ok(helper.includes(t), t);
  assert.doesNotMatch(helper, /SESSION_ACTION|stored\.state|profile/, '공통 보호도 대화 상태·프로필 쓰기 0');
  assert.doesNotMatch(block, /SESSION_ACTION|stored\.state|profile/, '대화 상태·프로필 쓰기 0');
});
