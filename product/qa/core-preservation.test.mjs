// ECHO CORE 6 보존 + 사주·타로 분리 검사(2026-09-26 대표 「PROPRIETARY TECHNOLOGY PRESERVATION FINAL LOCK」).
// 운영 서버 코드(doit-agent v2.2 agent.ts)를 가짜 AI 출력으로 직접 돌려 본다 — 실제 AI 검사가 아니다(실제 AI 는 run 17~19 기록).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'core-'));
writeFileSync(path.join(dir, 'agent.mjs'), ts.transpileModule(read('supabase/functions/doit-agent/agent.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const A = await import(pathToFileURL(path.join(dir, 'agent.mjs')).href);
const out = (o) => ({ kind: 'answer', understood: '', reply: '', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const agentSrc = read('supabase/functions/doit-agent/agent.ts');

test('CORE 1 Context Memory: 앞선 사용자 말을 다음 판단 입력(recent·heard)에 넣고, 앞선 말에서 놓친 답을 되살린다', () => {
  const st = A.newState(); A.seedFirstQuestion(st);
  A.applyTurn(st, '연애로 이어질 만남이요. 연락은 자주 하는 게 좋아요', out({ extracted: [{ purpose: 'relationship_intent', note: '연애', quote: '연애로 이어질 만남이요' }], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' } }));
  const input = A.turnInput(st, '차분한 사람');
  assert.equal(input.recent[0].user, '연애로 이어질 만남이요. 연락은 자주 하는 게 좋아요');
  assert.deepEqual(input.heard.map((h) => h.note), ['연애']);
  A.applyTurn(st, '차분한 사람', out({ extracted: [{ purpose: 'attraction_comfort', note: '차분함', quote: '차분한 사람' }, { purpose: 'relationship_style', note: '연락 자주', quote: '연락은 자주 하는 게 좋아요' }], next: { type: 'core', purpose: 'values_character', question: '사람 볼 때 뭘 먼저 봐요?' } }));
  const recovered = st.slots.relationship_style.items[0];
  assert.equal(recovered.source, 'recovered'); assert.equal(recovered.turn, 1, '앞선 말(1턴)에서 되살림');
  assert.ok(!A.openPurposes(st).includes('relationship_style'), '이미 들은 목적은 다시 묻지 않는다');
});

test('CORE 2 Correction Engine + 원문 보존: 최신 정정이 지금 값 · 옛 값은 SUPERSEDED(삭제 0) · 원문 turns 그대로', () => {
  const st = A.newState(); A.seedFirstQuestion(st);
  A.applyTurn(st, '매일 연락하는 게 좋아요', out({ extracted: [{ purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' } }));
  A.applyTurn(st, '아니, 매일은 부담스러워요. 주말에 한 번이 편해요', out({ kind: 'correction', extracted: [{ purpose: 'relationship_style', note: '주말 한 번', quote: '주말에 한 번이 편해요' }], wrong: ['매일 연락'], next: { type: 'core', purpose: 'attraction_comfort', question: '편한 사람은요?' } }));
  const items = st.slots.relationship_style.items;
  assert.equal(items.find((i) => i.note === '주말 한 번').status, 'CONFIRMED');
  assert.equal(items.find((i) => i.note === '주말 한 번').source_type, 'USER_CORRECTED');
  assert.notEqual(items.find((i) => i.note === '매일 연락').status, 'CONFIRMED', '옛 값은 지금 값에서 빠진다');
  assert.ok(items.some((i) => i.note === '매일 연락'), '옛 값도 이력으로 남는다(삭제 0)');
  assert.equal(st.turns[0].user, '매일 연락하는 게 좋아요', '원문 보존');
  assert.ok(st.corrections.includes('아니, 매일은 부담스러워요. 주말에 한 번이 편해요'));
});

test('CORE 3 Rejected Semantic Block: 거절한 뜻은 다음 입력(disputed·rejected)·매칭 프로필·소개에서 다시 살아나지 않는다', () => {
  const st = A.newState(); A.seedFirstQuestion(st);
  A.applyTurn(st, '매일 연락하는 게 좋아요', out({ extracted: [{ purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' } }));
  A.applyTurn(st, '그런 뜻 아니야, 주말에 한 번이 편해', out({ kind: 'correction', extracted: [{ purpose: 'relationship_style', note: '주말 한 번', quote: '주말에 한 번이 편해' }], wrong: ['매일 연락'], next: { type: 'core', purpose: 'values_character', question: '사람 볼 때 뭘 봐요?' } }));
  const p = A.matchingProfile(st);
  assert.ok(!p.confirmed_preferences.includes('매일 연락'));
  assert.ok(!A.matchingHandoff(p).criteria.relationship_style.includes('매일 연락'));
  assert.ok(A.turnInput(st, '다음').disputed.length >= 1, '다음 질문에 disputed 로 넘긴다');
  const intro = A.cleanIntro(st, [{ text: '저는 매일 연락하는 게 좋아요.', basis: '매일 연락하는 게 좋아요' }, { text: '주말에 한 번 만나는 게 편해요.', basis: '주말에 한 번이 편해' }]);
  assert.ok(!intro.lines.some((l) => /매일 연락/.test(l.text)), '거절 뜻은 소개에서 빠진다');
  assert.match(agentSrc, /rejected: rejectedForAi\(st\)/);
});

test('CORE 4 Information Status: 출처·상태 구분(USER_DIRECT·AI_EXTRACTED·AI_INFERRED·USER_CONFIRMED·USER_CORRECTED · CONFIRMED/SUPERSEDED/RETRACTED) · 추측은 매칭 기준에 안 들어감', () => {
  for (const t of ['USER_DIRECT', 'AI_EXTRACTED', 'AI_INFERRED', 'USER_CONFIRMED', 'USER_CORRECTED']) assert.match(agentSrc, new RegExp(`"${t}"`), t);
  for (const s of ['"CONFIRMED"', '"SUPERSEDED"', '"RETRACTED"', '"UNKNOWN"']) assert.ok(agentSrc.includes(s), s);
  const st = A.newState(); A.seedFirstQuestion(st);
  A.applyTurn(st, '연애하고 싶어요', out({ extracted: [{ purpose: 'relationship_intent', note: '연애', quote: '연애하고 싶어요' }], inferred: [{ trait: '외향적', basis: '추측' }], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' } }));
  const h = A.matchingHandoff(A.matchingProfile(st));
  assert.equal(A.matchingProfile(st).inferred_candidates[0].status, 'INFERRED');
  assert.ok(!JSON.stringify(h.criteria).includes('외향적'), 'AI 추측은 매칭 기준 0');
  assert.deepEqual(h.hard_filters, []); assert.equal(h.decision, 'SERVER');
});

test('CORE 5 Direction Lock: 핵심 질문 5개 · 도움 요청·항의는 답 저장 0 · 질문 수 증가 0', () => {
  assert.equal(A.MAX_CORE_QUESTIONS, 5);
  assert.equal(A.guardKind('예를 들면?', 'answer').kind, 'help');
  assert.equal(A.guardKind('이미 말했잖아', 'answer').kind, 'repair');
  const st = A.newState(); A.seedFirstQuestion(st);
  const before = A.coreAsked(st).length;
  A.applyTurn(st, '무슨 뜻이야?', out({ kind: 'answer', extracted: [{ purpose: 'relationship_intent', note: '무슨 뜻', quote: '무슨 뜻이야?' }], next: { type: 'core', purpose: 'relationship_intent', question: '요즘 어떤 만남이면 좋겠어요?' } }));
  assert.equal(st.slots.relationship_intent.items.length, 0, '도움 요청은 답으로 저장 0');
  assert.equal(A.coreAsked(st).length, before, '질문 수 증가 0');
});

test('CORE 6 Failure Intelligence: 판 추적 · 실패 턴 기록 · 관리자 실패 후보·AI OS 6칸 · 실패 분류표(사주·타로 오염 4종 포함)', () => {
  assert.deepEqual(Object.keys(A.versionTrace()).sort(), ['agent_version', 'pipeline_version', 'policy_version', 'prompt_version']);
  const idx = read('supabase/functions/doit-agent/index.ts');
  assert.match(idx, /status: "failed"|"failed"/, '실패 턴 기록');
  const admin = read('src/doit/lib/agentAdmin.ts');
  for (const k of ["row('memory'", "row('correction'", "row('rejection'", "row('status'", "row('direction'", "row('failure'"]) assert.ok(admin.includes(k), k);
  const tax = read('docs/FAILURE_TAXONOMY.md');
  for (const c of ['DIRECTION_DRIFT', 'CONTEXT_LOSS', 'REPETITION_FATIGUE', 'CORRECTION_IGNORED', 'REJECTED_MEANING_RESURRECTION', 'INFORMATION_STATUS_COLLAPSE', 'QUESTION_INTENT_LOOP', 'REPAIR_FAILURE', 'GENERIC_FALLBACK_FAILURE', 'OVER_GUARDING', 'MOCK_PASS_REAL_FAIL', 'STATE_RESTORE_FAILURE', 'TOOL_ENVIRONMENT_FAILURE', 'AI_MANAGEMENT_FATIGUE', 'SAJU_RESULT_AS_USER_FACT', 'TAROT_RESULT_AS_USER_FACT', 'SAJU_MATCHING_CONTAMINATION', 'TAROT_MATCHING_CONTAMINATION']) assert.ok(tax.includes(c), c);
});

const walk = (d) => readdirSync(path.join(root, d)).flatMap((f) => { const p = `${d}/${f}`; return statSync(path.join(root, p)).isDirectory() ? walk(p) : /\.(tsx?)$/.test(f) ? [p] : []; });
const CORE_DATA = /agentApi|understandingApi|useUnderstanding|connectApi|profileSave|photoStorage|supabase|agentTurn|insight_|record_create/;

test('사주·타로 분리: 사주·타로 화면·계산 코드는 사용자 사실·나의 이해·매칭·서버 저장 경로를 import 하지 않는다', () => {
  const files = ['src/doit/lib/saju/engine.ts', 'src/doit/lib/saju/explain.ts', 'src/doit/app/plan-a/screens/SajuResult.tsx', 'src/doit/app/plan-a/screens/SajuInput.tsx', 'src/doit/app/plan-a/screens/SajuTaroEntry.tsx', 'src/doit/app/plan-a/screens/TaroCardSelect.tsx', 'src/doit/app/plan-a/screens/FreeResult.tsx', 'src/doit/app/plan-a/screens/FreeResult.parts.tsx', 'src/doit/pages/do-it/fortune/page.tsx'];
  for (const f of files) { const imports = (read(f).match(/from\s+["'][^"']+["']/g) ?? []).join(' '); assert.doesNotMatch(imports, CORE_DATA, f); }
  // 타로 해석은 openai-chat 하나 — 이 서버 함수는 호출 제한 기록 외에 아무것도 저장하지 않는다
  const oc = read('supabase/functions/openai-chat/index.ts');
  assert.doesNotMatch(oc, /\.from\(|\.insert\(|\.upsert\(/, 'openai-chat 저장 0');
  assert.match(oc, /openai_rate_limit_allow/);
  // [비슷해요]/[조금 달라요]는 화면 상태(useState)뿐
  assert.match(read('src/doit/app/plan-a/screens/SajuResult.tsx'), /const \[fit, setFit\] = useState/);
  assert.match(read('src/doit/app/plan-a/screens/FreeResult.tsx'), /useState<\s*null \| "similar" \| "different"\s*>/);
});

test('사주·타로 → 매칭·사용자 사실 오염 0: 대화 서버·매칭 계약·연결 서버·나의 이해 화면에 사주·타로 입력 경로 없음', () => {
  for (const f of ['supabase/functions/doit-agent/agent.ts', 'supabase/functions/doit-agent/matching.ts', 'supabase/functions/doit-agent/index.ts', 'supabase/functions/doit-connect/index.ts', 'src/doit/pages/do-it/understanding/page.tsx', 'src/doit/lib/understandingView.ts', 'src/doit/components/feature/AgentProfileCheck.tsx']) {
    assert.doesNotMatch(read(f), /saju|tarot|fortune|SajuResult|사주 결과|타로 결과/i, f);
  }
  // 대화 서버 규칙: 사주·타로를 섞지 않는다(doit-understanding 질문 규칙)
  assert.match(read('supabase/functions/doit-understanding/index.ts'), /사주·타로·진단·미래예측·새 사실·고정 질문 목록을 섞지 않/);
  // 사주 결과 뒤 대화는 기존 대화 화면으로만(사주 값 전달 0)
  assert.match(read('src/doit/pages/do-it/fortune/page.tsx'), /onTalk=\{\(\) => navigate\("\/doit\/conversation"\)\}/);
});

test('UI 단순화 ≠ 엔진 삭제: 숨긴 화면과 상관없이 서버 보호 장치 파일·함수 그대로(v2.2)', () => {
  assert.match(agentSrc, /export const AGENT_VERSION = "echo-agent-v2\.2";/);
  for (const fn of ['guardKind', 'applyTurn', 'matchingProfile', 'matchingHandoff', 'rejectedNotes', 'cleanIntro', 'versionTrace']) assert.match(agentSrc, new RegExp(`export function ${fn}\\(`), fn);
  // 확인 화면의 정정은 서버 정정 턴으로만(화면이 뜻을 바꾸지 않는다)
  assert.match(read('src/doit/components/feature/AgentProfileCheck.tsx'), /agentTurn\(userId, session\.id, t\)/);
});
