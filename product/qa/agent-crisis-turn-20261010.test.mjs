// 2026-10-10 MVP 마감(대표 「실제 ECHO MVP 완성」 · 회사 기준 「위기 신호가 확인되면 분석·질문 생성을 멈추고 안전 안내 · 강제 종료 아님 · 원문은 개인화 재료로 쓰지 않음」):
// 본 대화(agent_start 첫 답 · agent_turn)에도 위기 신호 가드가 있어야 한다(전에는 agent_ref · agent_free_talk · agent_self_note 에만 있었음).
// 가짜 DB·가짜 AI(qa/agent-server.test.mjs 의 장치를 그대로 씀) — 실제 DB·제공사 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
let helper = readFileSync(new URL('./agent-server.test.mjs', import.meta.url), 'utf8');
helper = helper.slice(0, helper.indexOf("test('로그인 안 함"));
helper = helper.replace("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.resolve('node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(new URL('../supabase/functions/doit-agent/', import.meta.url).href)});`);
helper += '\nexport {load,newState,T,Q,X,rid};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'crisis-turn-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid } = await import(file.href);

const CRISIS = '요즘 너무 힘들어서 죽고 싶어요';
const turnRows = (s) => s.tables.doit_request_events.filter((r) => r.action === 'agent_turn');

test('agent_turn 위기 신호 → 안전 안내 · 모델 0 · 상태·판 번호 그대로 · 턴 기록 0 · 다음 말은 평소대로', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(start.status, 200); const sid = start.body.session.id;
  const sessionRow = () => s.tables.doit_request_events.find((r) => r.request_id === sid && r.action === 'agent_session');
  const revBefore = sessionRow().applied_revision; const turnsBefore = sessionRow().response_payload.state.turns.length;
  const callsBefore = s.providerCalls?.length ?? 0; const turnLogsBefore = turnRows(s).length;
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: CRISIS });
  assert.equal(r.status, 200);
  assert.equal(r.body.crisis, true);
  assert.equal(r.body.turn.kind, 'crisis');
  assert.equal(r.body.turn.saved, false);
  assert.match(r.body.turn.reply, /109/);
  assert.equal(s.providerCalls?.length ?? 0, callsBefore, '모델 호출 0');
  assert.equal(sessionRow().applied_revision, revBefore, '상태 판 번호 그대로');
  assert.equal(sessionRow().response_payload.state.turns.length, turnsBefore, '턴 저장 0');
  assert.equal(turnRows(s).length, turnLogsBefore, '턴 기록 0');
  assert.ok(!JSON.stringify(sessionRow().response_payload).includes('죽고 싶'), '원문이 상태에 남지 않음');
  assert.equal(r.body.session.current_question, start.body.session.current_question, '같은 질문에서 계속(강제 종료 아님)');
  // 다음 평범한 말은 평소대로 이어진다
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const next = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '잘 웃는 사람' });
  assert.equal(next.status, 200); assert.equal(next.body.turn.saved, true);
});

test('agent_start 첫 답 위기 신호 → 첫 답은 쓰지 않고(저장·모델 재료 0) 안전 안내와 함께 평소 첫 질문으로 시작', async () => {
  const s = newState(); const h = load(s);
  s.ai.push({ reply: '반가워요', question: '어떤 만남을 찾아요?' }); // 첫 질문 만들기(opening) 가짜 응답 — 첫 답 없이 시작했다는 뜻
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: CRISIS });
  assert.equal(r.status, 200);
  assert.equal(r.body.crisis, true);
  assert.match(r.body.reply, /109/);
  assert.ok(!r.body.session.messages.some((m) => m.role === 'user'), '첫 답이 대화에 들어가지 않음');
  const all = JSON.stringify(s.tables.doit_request_events);
  assert.ok(!all.includes('죽고 싶'), '어디에도 원문 저장 0');
  assert.equal(r.body.session.current_question, '어떤 만남을 찾아요?', '첫 답 없는 평소 시작(opening) 경로')
});
