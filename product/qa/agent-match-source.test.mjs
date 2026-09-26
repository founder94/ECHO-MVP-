// Matching Integration(2026-09-27 FINAL IMPLEMENTATION MASTER · PHASE 10) — 연결 재료는 ECHO Agent 가 확정한 값(CONFIRMED)만.
// 실행: node --test qa/agent-match-source.test.mjs (DB·AI 호출 0)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// agentSource.ts 는 ../doit-agent/matching.ts 를 그대로 쓴다(중복 구현 0) — 같은 상대 경로로 옮겨 풀어 둔다.
const dir = mkdtempSync(path.join(tmpdir(), 'agentsrc-'));
const emit = (src, out) => {
  const code = ts.transpileModule(readFileSync(new URL(src, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const file = path.join(dir, out); writeFileSync(file, code.replace('"../doit-agent/matching.ts"', '"./matching.mjs"')); return file;
};
emit('../supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const A = await import(pathToFileURL(emit('../supabase/functions/doit-connect/agentSource.ts', 'agentSource.mjs')).href);

const item = (note, over = {}) => ({ note, quote: note, status: 'CONFIRMED', source_type: 'AI_EXTRACTED', source_turn: 1, ...over });
const slot = (items, status = 'CONFIRMED') => ({ status, items, history: [] });
const full = () => ({
  relationship_intent: slot([item('천천히 알아가고 싶다')]),
  attraction_comfort: slot([item('말이 통하면 편하다')]),
  values_character: slot([item('약속을 지키는 사람')]),
  relationship_style: slot([], 'OPEN'),
  boundaries: slot([], 'OPEN'),
  inferred_candidates: [{ trait: '내향적', source_type: 'AI_INFERRED' }],
});

test('확정 정보 영역 3칸(임시 기준) + 대화 끝 = 준비됨 · 관계 목적 개수와 무관 · 확정 값만 재료', () => {
  const s = A.sourceFromProfile(full(), 'done', '2026-09-27T00:00:00Z');
  assert.equal(s.ready, true); assert.equal(s.confirmedAreas, 3);
  assert.deepEqual([...s.confirmed].sort(), ['말이 통하면 편하다', '약속을 지키는 사람', '천천히 알아가고 싶다'].sort());
  assert.ok(!s.confirmed.includes('내향적'), 'AI 추정은 재료가 아니다');
});

test('대화 중(talk)이면 확정 값이 있어도 준비 아님', () => {
  assert.equal(A.sourceFromProfile(full(), 'talk', null).ready, false);
  assert.equal(A.sourceFromProfile(full(), 'post', null).ready, true, '끝난 뒤 고치기(post)도 끝난 대화');
});

test('추정·밀린 값·미확정 영역은 세지 않는다', () => {
  const p = full();
  p.values_character = slot([item('추정 성향', { source_type: 'AI_INFERRED' }), item('옛 값', { status: 'SUPERSEDED' })]);
  const s = A.sourceFromProfile(p, 'done', null);
  assert.equal(s.confirmedAreas, 2); assert.equal(s.ready, false);
  assert.ok(!s.confirmed.includes('추정 성향') && !s.confirmed.includes('옛 값'));
  p.values_character = slot([item('약속을 지키는 사람')], 'PENDING');
  assert.equal(A.sourceFromProfile(p, 'done', null).confirmedAreas, 2, '영역 자체가 CONFIRMED 가 아니면 세지 않음');
});

test('사주·타로 결과는 매칭 재료가 아니다', () => {
  const p = full(); p.relationship_style = slot([item('타로에서 나온 연애운')]);
  const s = A.sourceFromProfile(p, 'done', null);
  assert.equal(s.confirmedAreas, 3); assert.ok(!s.confirmed.some((n) => /타로/.test(n)));
});

test('경계(boundaries)는 사용자 직접 확인·AI 정리 모두 확정이면 센다(기존 signals 계약)', () => {
  const p = full(); p.boundaries = slot([item('담배는 피하고 싶다', { source_type: 'USER_CONFIRMED' })]);
  assert.equal(A.sourceFromProfile(p, 'done', null).confirmedAreas, 4);
});

test('틀린 모양 · 빈 profile 은 빈 재료(오류 없이 매칭 제외)', () => {
  for (const bad of [null, 'x', [], { relationship_intent: 'x' }, { relationship_intent: { status: 'CONFIRMED', items: 'x' } }]) {
    const s = A.sourceFromProfile(bad, 'done', null);
    assert.deepEqual([s.confirmed, s.confirmedAreas, s.ready], [[], 0, false]);
  }
});

test('사용자마다 이번 회차의 가장 최근 세션 하나만', () => {
  const rows = [
    { user_id: 'u1', created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T01:00:00Z', profile: full(), phase: 'done' },
    { user_id: 'u1', created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T01:00:00Z', profile: null, phase: 'talk' },
    { user_id: 'u2', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', profile: full(), phase: 'done' },
  ];
  const m = A.agentSources(rows, (uid) => (uid === 'u2' ? '2026-09-10T00:00:00Z' : null));
  assert.equal(m.get('u1').ready, false, '최근 세션(대화 중)이 기준');
  assert.equal(m.has('u2'), false, '지난 회차 세션은 쓰지 않음 → legacy 재료로 돌아감');
});
