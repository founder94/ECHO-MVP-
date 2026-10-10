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

test('agent_start 첫 답 위기 신호 → 모델 0 · 첫 답 저장 0 · 고정 첫 질문으로 시작 + 안전 안내(AI 실패가 줄 서 있어도 200)', async () => {
  // Codex P1(PR #153 cf2c58e 리뷰): AI 설정·한도·첫 질문 만들기 실패와 무관하게 안전 안내가 나가야 한다 → 실패 응답을 줄 세워 둔다
  const s = newState(); const h = load(s);
  s.ai.push('HTTP500', 'HTTP500', 'HTTP500');
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: CRISIS });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.crisis, true);
  assert.match(r.body.reply, /109/);
  assert.equal(s.providerCalls?.length ?? 0, 0, '모델 호출 0');
  assert.ok(!r.body.session.messages.some((m) => m.role === 'user'), '첫 답이 대화에 들어가지 않음');
  assert.equal(r.body.session.current_question, '어떤 만남을 원하세요?', '고정 첫 질문(모델 없이)으로 시작');
  assert.ok(!JSON.stringify(s.tables.doit_request_events).includes('죽고 싶'), '어디에도 원문 저장 0');
  assert.ok(!s.tables.doit_request_events.some((x) => x.action === 'agent_turn_claim'), '비용 자리 잡기 0');
});

test('agent_start 위기 첫 답을 같은 요청으로 다시 보내도(응답 유실 후 재전송) 안전 안내가 다시 붙는다', async () => {
  // Codex P1(PR #153 4235756227)
  const s = newState(); const h = load(s);
  const requestId = rid();
  const a = await h.call({ action: 'agent_start', requestId, tone: 'polite', mode: 'TEXT', firstAnswer: CRISIS });
  assert.equal(a.status, 200);
  const b = await h.call({ action: 'agent_start', requestId, tone: 'polite', mode: 'TEXT', firstAnswer: CRISIS });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.existing, true);
  assert.equal(b.body.session.id, a.body.session.id, '같은 세션');
  assert.equal(b.body.crisis, true, '재전송에도 안전 안내');
  assert.match(b.body.reply, /109/);
  assert.equal(s.tables.doit_request_events.filter((x) => x.action === 'agent_session').length, 1, '세션 1개');
});
