// ECHO Human Continuity Engine v0.1 검사(대표 「IMPLEMENTATION ORDER」 §5 · §10).
// 실제 회사 실패 기록(docs/failure-intelligence/data)을 그대로 읽는다 — 합성 이력 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MATCHING_ELIGIBLE,
  SAFE_POLICY,
  UNKNOWN,
  checkRegistryInvariants,
  checkStateInvariants,
  compileFailure,
  compileFailures,
  compileHumanState,
  createRegistry,
  effortEventsFromFailure,
  emptyState,
  evaluateHumanEffort,
  isUncertainStatement,
  linkedEngineOf,
  loadFailureCorpus,
  matchingSafeProjection,
  normalizeFailure,
  promote,
  replayEvents,
  runReplay,
  type CompilerPolicy,
  type DefenseCandidate,
  type HumanStateEvent,
  type LoadedCorpus,
} from '../src/lib/human-continuity/index.ts';

const REPO = new URL('../../', import.meta.url).pathname;
const DATA = join(REPO, 'docs/failure-intelligence/data');
const json = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const rawInput = () => ({ failures: json('failures.json'), dataset: json('echo-failure-dataset.json'), failedSolutions: json('failed-solutions.json'), graph: json('failure-graph.json'), actionLedger: json('action-ledger.json') });
const corpus: LoadedCorpus = loadFailureCorpus(rawInput());

const USER = (text: string, slot?: string, meaning?: string): HumanStateEvent => ({ type: 'USER_MESSAGE', text, slot, meaning, proposedBy: 'USER' });
const MODEL = (text: string, slot: string, meaning: string): HumanStateEvent => ({ type: 'USER_MESSAGE', text, slot, meaning, proposedBy: 'MODEL' });

// ── 말뭉치 적재 ────────────────────────────────────────────────────────────
test('말뭉치: 실제 실패 기록 전부 적재(failures 96 + dataset 44) · 중복 id 0 · 결정적', () => {
  const f = json('failures.json').failures.length;
  const d = json('echo-failure-dataset.json').records.length;
  assert.equal(corpus.records.length, f + d);
  assert.deepEqual(corpus.duplicateIds, []);
  assert.equal(corpus.ledger.length, json('action-ledger.json').items.length);
  assert.deepEqual(loadFailureCorpus(rawInput()).records, corpus.records, '두 번 읽어도 같은 결과');
  for (const r of corpus.records) assert.ok(['ACTUAL', 'FOUNDER_STATEMENT', 'REAL_AI_SCRIPTED', 'CODE', 'HYPOTHESIS'].includes(r.evidenceLevel), r.id);
});

test('실패 → 방어 후보: 모든 기록이 결정적으로 후보를 만든다(수준은 전부 CANDIDATE) · 지시 §3.3 필수 매핑 10개가 실제 기록에서 나온다', () => {
  const a = compileFailures(corpus.records);
  const b = compileFailures(loadFailureCorpus(rawInput()).records);
  assert.deepEqual(a, b, '같은 입력 → 같은 출력');
  assert.ok(a.every((c) => c.defenseCandidate.defense_level === 'CANDIDATE'));
  assert.ok(a.every((c) => c.defenseCandidate.failure_ids[0] === c.failure.id && c.counterTestCandidate && c.qaTestCandidate));
  const engines = new Set(a.map((c) => c.linkedEngine));
  for (const e of ['Context Memory', 'Correction Engine', 'Rejection Firewall', 'Information Status', 'Direction Lock', 'Action Router / Action Ledger', 'Release Gate', 'Verification Gate', 'Agent Orchestration', 'Cost Visibility Gate']) assert.ok(engines.has(e as never), `엔진 ${e} 에 묶인 실제 기록이 없다`);
  // 지시의 대표 매핑(실제 기록 기준)
  const eng = (id: string) => a.find((c) => c.failure.id === id)!.linkedEngine;
  assert.equal(eng('GF-01'), 'Context Memory');           // 같은 뜻 반복 → Context Memory
  assert.equal(eng('GF-25'), 'Correction Engine');        // 정정 무시
  assert.equal(eng('GF-21'), 'Rejection Firewall');       // 거절 뜻 재등장
  assert.equal(eng('GF-30'), 'Information Status');       // 미확정 사실화
  assert.equal(eng('GF-54'), 'Action Router / Action Ledger'); // 끝난 행동 재요구
  assert.equal(eng('GF-15'), 'Verification Gate');        // Mock PASS / 실AI FAIL
  assert.equal(eng('GF-58'), 'Agent Orchestration');      // 대표 중계 과부하
  assert.equal(eng('GF-57'), 'Cost Visibility Gate');     // 비용 가시성 부족
});

test('매핑 못 하는 실패는 억지로 붙이지 않고 UNMAPPED(근거 없는 연결 0)', () => {
  assert.equal(linkedEngineOf({ types: ['문장 파손'], family: 'F-SENTENCE' }), 'UNMAPPED');
  assert.equal(linkedEngineOf({ types: [], family: 'UNKNOWN' }), 'UNMAPPED');
});

// ── §5 필수 검사 1~10 ──────────────────────────────────────────────────────
test('§5-1 USER_CORRECTED 가 예전 USER_DIRECT 를 이긴다', () => {
  const r = replayEvents([USER('연락은 매일이 좋아요', 'contact', '매일 연락'), { type: 'CORRECT', text: '매일은 부담이고 주말에 한두 번이요', targetId: 'F1', meaning: '주말에 한두 번 연락' }]);
  assert.equal(r.state.facts[0].status, 'SUPERSEDED');
  assert.equal(r.state.facts[1].status, 'USER_CORRECTED');
  assert.deepEqual(r.matchingSafe.map((m) => m.meaning), ['주말에 한두 번 연락']);
  // 대상 id 없이 칸만 준 정정도 같은 칸의 충돌 값을 민다.
  const r2 = replayEvents([USER('서울 살아요', 'region', '서울'), { type: 'CORRECT', text: '아니 부산이요', slot: 'region', meaning: '부산' }]);
  assert.deepEqual(r2.matchingSafe.map((m) => m.meaning), ['부산']);
  assert.deepEqual(checkStateInvariants([USER('서울 살아요', 'region', '서울'), { type: 'CORRECT', text: '아니 부산이요', slot: 'region', meaning: '부산' }], r2), []);
});

test('§5-2 REJECTED 는 매칭 안전 투영에 절대 나오지 않는다(직접 말한 것 · 모델 해석 · 뜻으로 거절 모두)', () => {
  const byId = replayEvents([USER('운동 좋아해요', 'hobby', '운동'), { type: 'REJECT', text: '그건 아니에요', targetId: 'F1' }]);
  const byMeaning = replayEvents([USER('운동 좋아해요', 'hobby', '운동'), { type: 'REJECT', text: '운동은 빼 주세요', targetMeaning: '운동' }]);
  const implicit = replayEvents([MODEL('주말엔 쉬어요', 'energy', '내향적'), { type: 'REJECT', text: '그런 뜻 아니야' }]);
  for (const r of [byId, byMeaning, implicit]) {
    assert.equal(r.matchingSafe.length, 0);
    assert.ok(r.state.facts.every((f) => f.status === 'REJECTED'));
  }
  // 모델이 같은 뜻을 다시 내도 막힌다(방화벽).
  const again = compileHumanState(implicit.state, MODEL('혼자가 편해요', 'energy', '내향적'));
  assert.ok(again.transitions.some((t) => t.kind === 'BLOCKED_REJECTED_MEANING'));
  assert.equal(again.matchingSafe.length, 0);
});

test('§5-3 AI_INFERRED 는 명시적 확인 전에는 매칭 투영에 없다 · 확인하면 USER_CONFIRMED 로 들어간다', () => {
  const a = replayEvents([MODEL('사람 많은 곳은 피곤해요', 'energy', '사람 많은 곳을 피함')]);
  assert.equal(a.state.facts[0].status, 'AI_INFERRED');
  assert.equal(a.matchingSafe.length, 0);
  const b = compileHumanState(a.state, { type: 'CONFIRM', text: '맞아요', targetId: 'F1' });
  assert.deepEqual(b.matchingSafe.map((m) => [m.meaning, m.status]), [['사람 많은 곳을 피함', 'USER_CONFIRMED']]);
  // 모호한 거절(해석 여럿)은 지우지 않고 DISPUTED — 매칭에도 안 나간다.
  const d = replayEvents([MODEL('a', 'x', '해석1'), MODEL('b', 'y', '해석2'), { type: 'REJECT', text: '그런 뜻 아니야' }]);
  assert.deepEqual(d.state.facts.map((f) => f.status), ['DISPUTED', 'DISPUTED']);
  assert.equal(d.matchingSafe.length, 0);
});

test('§5-4 사용자 원문은 모든 사건에서 글자 그대로 보존된다(거절·정정·거둠·불확실 포함)', () => {
  const events: HumanStateEvent[] = [USER('매일 연락해요', 'c', '매일'), MODEL('활발해요', 'e', '외향적'), { type: 'REJECT', text: '아니 그런 뜻 아니야', targetId: 'F2' },
    { type: 'CORRECT', text: '주말에만 연락해요', targetId: 'F1', meaning: '주말' }, { type: 'RETRACT', text: '그 말은 취소할게요', targetId: 'F4' }, USER('잘 모르겠어', 'h', '모름')];
  const r = replayEvents(events);
  assert.deepEqual(r.state.statements.map((s) => s.text), events.map((e) => e.text));
  assert.deepEqual(checkStateInvariants(events, r), []);
  assert.equal(r.state.facts.find((f) => f.id === 'F4')?.status, 'RETRACTED');
});

test('§5-5 정정 계보가 남는다(A→B→C: C 의 계보 = [A, B] · 밀린 값은 새 값을 가리킨다)', () => {
  const r = replayEvents([USER('서울', 'region', '서울'), { type: 'CORRECT', text: '부산', targetId: 'F1', meaning: '부산' }, { type: 'CORRECT', text: '대구', targetId: 'F2', meaning: '대구' }]);
  const [a, b, c] = r.state.facts;
  assert.deepEqual([a.status, b.status, c.status], ['SUPERSEDED', 'SUPERSEDED', 'USER_CORRECTED']);
  assert.equal(a.supersededBy, b.id); assert.equal(b.supersededBy, c.id);
  assert.deepEqual(c.lineage, [a.id, b.id]);
  assert.deepEqual(r.corrections.map((e) => [e.from, e.to]), [['F1', 'F2'], ['F2', 'F3']]);
  assert.deepEqual(r.matchingSafe.map((m) => m.meaning), ['대구']);
});

test('§5-6 실패 컴파일러는 입력·제품 동작을 바꾸지 않는다(얼린 입력 · 부수 효과 코드 0 · 제품 코드에서 불러 쓰지 않음)', () => {
  const deepFreeze = <T,>(o: T): T => { if (o && typeof o === 'object') { Object.values(o as object).forEach(deepFreeze); Object.freeze(o); } return o; };
  const raw = deepFreeze(json('failures.json').failures[0]);
  const before = JSON.stringify(raw);
  const out = compileFailure(normalizeFailure(raw)); // 얼린 객체를 고치려 하면 strict mode 에서 TypeError
  assert.equal(JSON.stringify(raw), before);
  assert.equal(out.defenseCandidate.defense_level, 'CANDIDATE');
  const dir = new URL('../src/lib/human-continuity/', import.meta.url).pathname;
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert.doesNotMatch(src, /\bfetch\(|@supabase|createClient|supabase\.(from|auth|rpc|functions|storage)|localStorage|sessionStorage|node:fs|process\.|Deno\.|XMLHttpRequest|import\(|Date\.now|Math\.random|new Date/, `${f}: 부수 효과·비결정 코드 0`);
    for (const m of src.matchAll(/from '([^']+)'/g)) assert.ok(m[1].startsWith('./'), `${f}: 이 층 밖 모듈을 불러오지 않는다(${m[1]})`);
  }
  // 제품 화면·서버 어디서도 아직 이 층을 불러 쓰지 않는다(v0.1 = 내부 R&D).
  const src = new URL('../src/', import.meta.url).pathname;
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (p.includes('human-continuity') ? [] : walk(p)) : [p]; });
  for (const f of walk(src).filter((p) => /\.(ts|tsx)$/.test(p))) assert.doesNotMatch(readFileSync(f, 'utf8'), /human-continuity/, `${f} 가 R&D 층을 불러 씀`);
  const fnDir = new URL('../supabase/functions/', import.meta.url).pathname;
  for (const f of walk(fnDir).filter((p) => /\.ts$/.test(p))) assert.doesNotMatch(readFileSync(f, 'utf8'), /human-continuity/, `${f} 가 R&D 층을 불러 씀`);
});

test('§5-7 사람 수고 점수는 시스템 부담만 센다 — 사람의 성격·태도 평가는 받지 않는다', () => {
  const r = evaluateHumanEffort([
    { type: 'repeated_explanation', causedBy: 'AI', evidence: 'GF-01' },
    { type: 'user_is_impatient', causedBy: 'AI', evidence: '대표가 화를 냄' },          // 사람 성격 평가 → 거절
    { type: 'correction_required', causedBy: 'USER', evidence: '사용자가 말을 바꿈' },    // 사람 탓 → 거절
    { type: 'wrong_navigation', causedBy: 'APP', evidence: '' },                           // 근거 없음 → 거절
  ]);
  assert.equal(r.subject, 'SYSTEM');
  assert.equal(r.scope, 'INTERNAL_RD_ONLY');
  assert.deepEqual(r.events.map((e) => e.type), ['repeated_explanation']);
  assert.equal(r.rejectedInputs.length, 3);
  assert.ok(r.events.every((e) => ['AI', 'APP', 'DEV_AI', 'RELEASE'].includes(e.causedBy)));
  assert.doesNotMatch(JSON.stringify(Object.keys(r)), /personality|trait|user_score|성격/);
  // 실제 기록에서 뽑은 사건: GF-01(같은 뜻 반복) → 시스템(AI)이 만든 반복 설명 부담
  const gf01 = corpus.records.find((x) => x.id === 'GF-01')!;
  assert.deepEqual(effortEventsFromFailure(gf01).map((e) => [e.type, e.causedBy]), [['repeated_explanation', 'AI']]);
  assert.equal(evaluateHumanEffort([]).band, 'NONE');
});

test('§5-8 모르는 비용(시간·돈)은 UNKNOWN 그대로 — 잰 값은 지어내지 않는다', () => {
  const gf01 = corpus.records.find((x) => x.id === 'GF-01')!;
  assert.equal(gf01.humanCost.time.note, UNKNOWN);
  assert.equal(gf01.humanCost.financial.note, UNKNOWN);
  assert.equal(gf01.humanCost.time.evidence, UNKNOWN);
  assert.notEqual(gf01.humanCost.emotional.note, UNKNOWN, '적힌 설명은 원문 그대로 보관');
  for (const r of corpus.records) for (const k of ['emotional', 'time', 'financial', 'mental'] as const) {
    assert.equal(r.humanCost[k].quantity, UNKNOWN, `${r.id}.${k}: 잰 값이 없으니 UNKNOWN`);
    if (r.humanCost[k].note === UNKNOWN) assert.equal(r.humanCost[k].evidence, UNKNOWN);
  }
});

test('§5-9 방어 후보는 저절로 오르지 않는다 — 원본 주장 무시 · 한 칸씩 · 근거 필수 · 지름길 0', () => {
  const claimed = corpus.records.filter((r) => r.claimedDefenseLevel === 'MOCK_VERIFIED');
  assert.ok(claimed.length > 0, '원본에 MOCK_VERIFIED 를 주장하는 기록이 있다');
  let reg = createRegistry(compileFailures(claimed).map((c) => c.defenseCandidate));
  assert.ok(reg.entries.every((e) => e.defense_level === 'CANDIDATE'), '원본 주장으로 자동 승격 0');
  const id = reg.entries[0].id;
  reg = promote(reg, id, 'REAL_AI_VERIFIED', { realAiPass: true, realAiRunRef: 'run' });   // 지름길
  assert.equal(reg.entries[0].defense_level, 'CANDIDATE');
  reg = promote(reg, id, 'MOCK_VERIFIED', { mockPass: true });                              // 반대 검사 근거 없음
  assert.equal(reg.entries[0].defense_level, 'CANDIDATE');
  reg = promote(reg, id, 'MOCK_VERIFIED', { mockPass: true, counterTestFailsWhenDisabled: true });
  assert.equal(reg.entries[0].defense_level, 'MOCK_VERIFIED');
  reg = promote(reg, id, 'CANDIDATE', {});                                                   // 내리기 없음
  assert.equal(reg.entries[0].defense_level, 'MOCK_VERIFIED');
  reg = promote(reg, id, 'REAL_AI_VERIFIED', { realAiPass: true });                          // 실행 참조 없음
  assert.equal(reg.entries[0].defense_level, 'MOCK_VERIFIED');
  assert.deepEqual(checkRegistryInvariants(reg), []);
  assert.deepEqual(reg.history.map((h) => h.accepted), [false, false, true, false, false]);
});

test('§5-10 기존 제품 흐름에 연결하지 않는다 — 매칭 투영은 MATCHING_ELIGIBLE 밖을 내보내지 않는다(정책 기본값 고정)', () => {
  assert.deepEqual([...MATCHING_ELIGIBLE], ['USER_DIRECT', 'USER_CONFIRMED', 'USER_CORRECTED']);
  assert.ok(Object.isFrozen(SAFE_POLICY));
  const s = emptyState();
  assert.deepEqual(matchingSafeProjection(s), []);
});

test('불확실한 답(「잘 모르겠어」·「딱히 생각 안 나」)은 사실이 되지 않는다 — 원문만 남는다', () => {
  for (const t of ['잘 모르겠어', '딱히 생각 안 나', '딱히 생각 안 나요', '글쎄요', '모르겠어요']) assert.ok(isUncertainStatement(t), t);
  for (const t of ['운동을 좋아해요', '모르는 사람과 대화하는 게 좋아요']) assert.equal(isUncertainStatement(t), false, t);
  const r = replayEvents([USER('잘 모르겠어', 'hobby', '모름'), MODEL('딱히 생각 안 나', 'values', '가치관 없음')]);
  assert.equal(r.state.facts.length, 0);
  assert.ok(r.transitions.filter((t) => t.kind === 'UNCERTAIN_NOT_PROMOTED').length === 2);
});

test('사용자가 거절했던 뜻을 스스로 다시 말하면 사용자의 최신 말이 이긴다(모델만 막는다)', () => {
  const r = replayEvents([MODEL('a', 'e', '내향적'), { type: 'REJECT', text: '아니야', targetId: 'F1' }, USER('생각해 보니 저 내향적이에요', 'e', '내향적')]);
  assert.deepEqual(r.matchingSafe.map((m) => [m.meaning, m.status]), [['내향적', 'USER_DIRECT']]);
  assert.equal(r.state.facts[0].status, 'REJECTED', '예전 모델 해석은 거절 그대로(이력)');
});

// ── 재생 말뭉치 §4 ────────────────────────────────────────────────────────
test('재생 사례 11개 모두 PASS — RC-07 을 뺀 전부가 실제 실패 기록에 묶여 있다', () => {
  const results = runReplay(corpus);
  assert.equal(results.length, 11);
  for (const r of results) assert.ok(r.pass, `${r.id} ${r.title}: ${r.detail}`);
  for (const r of results.filter((x) => x.id !== 'RC-07')) assert.ok(r.corpusIds.length > 0, `${r.id} 실제 기록 없음`);
  const rc07 = results.find((x) => x.id === 'RC-07')!;
  assert.deepEqual(rc07.corpusIds, [], 'QA/PROD 혼입은 실패 기록(JSON)에 아직 없다 — 코드 근거로 대신(합성 기록 만들지 않음)');
  assert.match(rc07.evidence, /brand-origin-guard\.test\.mjs/);
  assert.deepEqual(runReplay(loadFailureCorpus(rawInput())), results, '재생도 결정적');
});

// ── 반대 검사: 핵심 제외 규칙을 하나씩 끄면 검사가 실제로 실패한다 ─────────────
const SCENARIO: HumanStateEvent[] = [
  USER('연락은 매일이 좋아요', 'contact', '매일 연락'),
  MODEL('주말엔 조용히 쉬어요', 'energy', '내향적'),
  { type: 'REJECT', text: '그런 뜻 아니야', targetId: 'F2' },
  MODEL('혼자가 편해요', 'energy', '내향적'),
  { type: 'CORRECT', text: '매일은 부담이고 주말에 한 번이요', targetId: 'F1', meaning: '주말 연락' },
  MODEL('영화를 자주 봐요', 'hobby', '영화 좋아함'),
  USER('잘 모르겠어', 'values', '모름'),
];
const broken: [string, Partial<CompilerPolicy>][] = [
  ['REJECTED 를 매칭에 허용', { eligibleStatuses: [...MATCHING_ELIGIBLE, 'REJECTED'], rejectionFirewall: false }],
  ['AI_INFERRED 를 매칭에 허용', { eligibleStatuses: [...MATCHING_ELIGIBLE, 'AI_INFERRED'] }],
  ['SUPERSEDED 를 매칭에 허용', { eligibleStatuses: [...MATCHING_ELIGIBLE, 'SUPERSEDED'] }],
  ['거절 방화벽 끔', { rejectionFirewall: false }],
  ['원문 보존 끔', { preserveRawText: false }],
  ['정정 시 옛 값 밀기 끔', { supersedeOnCorrect: false }],
  ['모델 해석 자동 확정', { modelAutoConfirm: true }],
  ['불확실한 답을 사실로', { uncertainAsFact: true }],
];

test('반대 검사 기준선: 안전 정책에서는 같은 시나리오의 불변식 위반 0', () => {
  assert.deepEqual(checkStateInvariants(SCENARIO, replayEvents(SCENARIO)), []);
});

for (const [name, patch] of broken) {
  test(`반대 검사: 「${name}」으로 규칙을 끄면 불변식 검사가 실패한다`, () => {
    const policy: CompilerPolicy = { ...SAFE_POLICY, ...patch };
    const violations = checkStateInvariants(SCENARIO, replayEvents(SCENARIO, policy));
    assert.ok(violations.length > 0, `${name}: 위반을 잡지 못함 — 규칙이 진짜가 아니다`);
  });
}

test('반대 검사: 근거 없이 수준을 올린(위조한) 방어 장부는 장부 불변식이 잡는다', () => {
  const reg = createRegistry([compileFailures(corpus.records.slice(0, 1))[0].defenseCandidate]);
  const forged = { entries: reg.entries.map((e): DefenseCandidate => ({ ...e, defense_level: 'REAL_AI_VERIFIED' })), history: reg.history };
  assert.ok(checkRegistryInvariants(forged).length > 0);
});

test('반대 검사: 매칭 투영 필터를 우회하면(모든 사실을 내보내면) 불변식 검사가 실패한다', () => {
  const r = replayEvents(SCENARIO);
  const leaked = { ...r, matchingSafe: r.state.facts.map((f) => ({ factId: f.id, slot: f.slot, meaning: f.meaning, status: f.status })) };
  assert.ok(checkStateInvariants(SCENARIO, leaked).length > 0);
});
