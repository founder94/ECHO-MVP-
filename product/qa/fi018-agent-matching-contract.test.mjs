// FI-018(2026-10-01 대표 「AGENT ↔ MATCHING CONTRACT FINAL CLOSE」) — Agent 완료 ↔ 연결 자격 공통 계약(Single Source of Truth) 검사. DB·AI 호출 0.
// 공통 함수: doit-agent/agent.ts conversationReadiness — Agent(충분·더 묻기·준비 미완료 멈춤)와 doit-connect agentSource(대화 자격)가 같은 함수를 쓴다.
// CASE 1·2·3·9(연결) = connect-server.test.mjs · CASE 3·7·8·9(Agent) = agent-server.test.mjs · 여기서는 CASE 4·5·6 + 단일 기준(SSOT) 구조.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'fi018-'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const emit = (p, out, fix = (x) => x) => { const f = path.join(dir, out); writeFileSync(f, fix(ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)); return pathToFileURL(f).href; };
const A = await import(emit('supabase/functions/doit-agent/agent.ts', 'agent.mjs'));
const M = await import(emit('supabase/functions/doit-connect/agentSource.ts', 'agentSource.mjs', (x) => x.replace('"../doit-agent/agent.ts"', '"./agent.mjs"')));
const code = (p) => read(p).replace(/^\s*\/\/.*$/gm, '');

const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '네.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: 'Q?' }, ...o });
const X = (purpose, note, quote) => ({ purpose, note, quote });
const at = (st, purpose) => { st.current = { type: 'core', purpose, text: `${purpose} 질문` }; };
function three() { // 사용자 출처 3칸(intent · attraction · values) — 물은 칸에 말 전체를 정리
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')] }));
  at(st, 'attraction_comfort'); A.applyTurn(st, '연락은 매일 하는 게 좋아요', T({ extracted: [X('attraction_comfort', '매일 연락', '연락은 매일 하는 게 좋아요')] }));
  at(st, 'values_character'); A.applyTurn(st, '약속을 잘 지키는 사람이 좋아요', T({ extracted: [X('values_character', '약속을 지킴', '약속을 잘 지키는 사람이 좋아요')] }));
  return st;
}
const done = (st) => { st.phase = 'done'; st.current = null; return st; };
const both = (st) => { const p = A.matchingProfile(st); return { agent: A.conversationReadiness(p, st.phase), connect: M.sourceFromProfile(p, st.phase, null) }; };

test('SSOT: 연결 서버 재료 함수는 Agent 공통 계약을 그대로 부른다(자체 칸 세기·출처 규칙 0) · 화면은 서버 readiness 만', () => {
  const src = code('supabase/functions/doit-connect/agentSource.ts');
  assert.match(src, /import \{ conversationReadiness[^}]*\} from "\.\.\/doit-agent\/agent\.ts"/);
  assert.doesNotMatch(src, /USER_DIRECT|AI_EXTRACTED|SUPERSEDED|RETRACTED|>= *3|signals\(/, '연결 쪽에 두 번째 기준 없음');
  const agent = code('supabase/functions/doit-agent/agent.ts');
  assert.match(agent, /export const needsMoreAnswers = \(st: AgentState\) => !stateReadiness\(st\)\.areas_ready;/, 'Agent 더 묻기 = 같은 함수');
  assert.match(agent, /readiness: readiness\(st\)/);
  assert.doesNotMatch(agent, /savedAnswers\(st\) < READY_SAVED_ANSWERS/, '답 수로 준비 판단 0');
  const connect = code('supabase/functions/doit-connect/index.ts');
  assert.match(connect, /MATCH_SOURCE === "agent"\s*\? \{ ready: !!agent\?\.ready, source: "agent"/, 'Agent 매칭: 대화 준비는 공통 계약만(옛 답 다섯 개 대체 0)');
  const ui = code('src/doit/components/feature/AsleepConnections.tsx');
  assert.match(ui, /server\?\.readiness/, '연결 화면은 연결 서버 readiness 를 그대로 그린다');
});

test('같은 상태 → Agent 판단과 연결 판단이 언제나 같다(대화 중 · 마침 · 칸 부족)', () => {
  for (const st of [three(), done(three()), done((() => { const s = A.newState({ tone: 'polite' }); A.seedFirstQuestion(s); return s; })())]) {
    const { agent, connect } = both(st);
    assert.equal(connect.ready, agent.conversation_ready); assert.equal(connect.confirmedAreas, agent.confirmed_areas); assert.deepEqual(connect.confirmed, agent.confirmed);
  }
  assert.equal(both(done(three())).agent.conversation_ready, true);
  assert.equal(both(three()).agent.conversation_ready, false, '대화 중이면 대화 조건 미충족(칸이 차도)');
  assert.equal(A.readiness(three()).ready, true, 'Agent 는 칸이 찼으니 더 묻지 않아도 됨');
});

test('FI-018 CASE 4: 정정으로 밀린 옛 값(SUPERSEDED) → Matching 재료 0 · 최신 정정 값만', async () => {
  const st = done(three());
  await A.runTurn(st, '주말에 한두 번 연락하는 게 좋아요', async (k) => JSON.stringify(k === 'turn' ? T({ kind: 'correction', extracted: [X('attraction_comfort', '주말에 한두 번 연락', '주말에 한두 번 연락하는 게 좋아요')] }) : {}), { ui: { correction: true, purpose: 'attraction_comfort' } });
  const { agent } = both(st);
  assert.ok(!agent.confirmed.some((n) => /매일/.test(n)), JSON.stringify(agent.confirmed));
  assert.ok(agent.confirmed.some((n) => /주말/.test(n)), JSON.stringify(agent.confirmed));
});

test('FI-018 CASE 5: 거절한 뜻(RETRACTED) → Matching 재료 0 · 준비 칸에도 안 셈', () => {
  const p = A.matchingProfile(done(three()));
  p.boundaries = { status: 'CONFIRMED', items: [], history: [{ note: '거짓말 싫음', quote: '거짓말', status: 'RETRACTED', source_type: 'USER_DIRECT', source_turn: 4 }] };
  const r = A.conversationReadiness(p, 'done');
  assert.ok(!r.confirmed.includes('거짓말 싫음')); assert.ok(!r.ready_areas.includes('boundaries')); assert.ok(r.excluded.superseded_or_rejected >= 1);
});

test('FI-018 CASE 6: 사용자 확인 없는 AI 정리(AI_EXTRACTED) · 추정(INFERRED) · 사주/타로 → Matching 재료 0 · 준비 칸 0', () => {
  const it = (note, source_type) => ({ note, quote: note, status: 'CONFIRMED', source_type, source_turn: 1 });
  const p = { relationship_intent: { status: 'CONFIRMED', items: [it('AI 가 정리한 목적', 'AI_EXTRACTED')] }, attraction_comfort: { status: 'CONFIRMED', items: [it('추정 성격', 'AI_INFERRED')] }, values_character: { status: 'CONFIRMED', items: [it('타로 카드 결과', 'USER_DIRECT')] }, relationship_style: { status: 'UNKNOWN', items: [] }, boundaries: { status: 'UNKNOWN', items: [] } };
  const r = A.conversationReadiness(p, 'done');
  assert.deepEqual(r.confirmed, []); assert.equal(r.confirmed_areas, 0); assert.equal(r.conversation_ready, false);
  assert.equal(r.excluded.ai_only, 1); assert.equal(r.excluded.inferred_or_unconfirmed, 1); assert.equal(r.excluded.content, 1);
  assert.equal(M.sourceFromProfile(p, 'done', null).ready, false);
});

test('FI-018 CASE 6b: AI 가 이번 말을 여러 칸으로 나눠 정리하면 원문을 통째로 사용자 값으로 남기지 않는다(AI 해석 승격 0)', () => {
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요. 매일 연락하는 게 좋아요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남'), X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요')] }));
  assert.ok(!st.slots.relationship_intent.items.some((i) => i.source_type === 'USER_DIRECT'));
  assert.equal(A.stateReadiness(st).confirmed_areas, 0);
});

test('Agent 더 묻기: 사용자 출처가 없는 칸(AI 정리뿐)을 빈 칸 다음 순서로 다시 묻는다 · 상한 2', () => {
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요. 매일 연락하는 게 좋아요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남'), X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요')] }));
  const targets = A.fillTargets(st);
  const firstAiOnly = targets.findIndex((id) => ['relationship_intent', 'relationship_style'].includes(id));
  assert.ok(firstAiOnly > targets.indexOf('boundaries'), JSON.stringify(targets));
  assert.ok(targets.includes('relationship_intent') && targets.includes('relationship_style'));
  assert.equal(A.MAX_FILL_QUESTIONS, 2);
});

test('질문 피로(v2.5.6): 모델이 넘기기(skip)로 읽어도 항의 · 「다음 질문으로」가 함께 있으면 넘기기 그대로', () => {
  assert.deepEqual(A.guardKind('질문이 너무 많아요', 'skip'), { kind: 'repair', rule: 'fatigue' });
  assert.deepEqual(A.guardKind('다음질문으로 넘어가 질문이 너무 무겁다', 'skip'), { kind: 'skip', rule: null });
  assert.deepEqual(A.guardKind('이 질문은 패스', 'skip'), { kind: 'skip', rule: null });
  assert.deepEqual(A.guardKind('질문이 너무 많아요', 'stop'), { kind: 'stop', rule: null });
});
