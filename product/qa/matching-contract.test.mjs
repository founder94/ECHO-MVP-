// 매칭 결정 계약(2026-09-26 FINAL MISSING CONTRACTS 1~3) — 서버가 후보를 거르고, LLM 이유는 양쪽 근거가 있을 때만.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const js = ts.transpileModule(readFileSync(new URL('../supabase/functions/doit-agent/matching.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const file = path.join(mkdtempSync(path.join(tmpdir(), 'match-')), 'matching.mjs'); writeFileSync(file, js);
const M = await import(pathToFileURL(file).href);

const item = (note, quote, source_type = 'AI_EXTRACTED', status = 'CONFIRMED') => ({ note, quote, status, source_type, source_turn: 1 });
const prof = (over = {}) => ({ relationship_intent: { status: 'CONFIRMED', items: [item('천천히 알아가기', '천천히 알아가는')] }, ...over });
const person = (id, over = {}) => ({ user_id: id, real_user: true, conversation_done: true, intro_confirmed: true, photo_primary: true, phone_verified: true, purpose_id: 'friend', profile: prof(), ...over });

test('자격: 전화 인증이 화면만 있고 실제로 안 됐으면 후보가 될 수 없다', () => {
  assert.deepEqual(M.eligibility(person('a', { phone_verified: false })).missing, ['phone_verified']);
  assert.equal(M.eligibility(person('a')).eligible, true);
  assert.ok(M.eligibility(person('a', { profile: prof({ relationship_intent: { status: 'UNKNOWN', items: [] } }) })).missing.includes('confirmed_info'));
});

test('후보 집합: 자격 미달·차단·목적 다름은 서버가 뺀다 · 나 자신 0 · 내가 자격 미달이면 후보 0', () => {
  const me = person('me');
  const r = M.candidateSet(me, [person('me'), person('ok'), person('nophone', { phone_verified: false }), person('blk'), person('other', { purpose_id: 'dating' }), person('fake', { real_user: false })], new Set(['blk:me']));
  assert.deepEqual(r.candidates.map((c) => c.user_id), ['ok']);
  assert.deepEqual(Object.fromEntries(r.excluded.map((e) => [e.user_id, e.reason.split(':')[0]])), { nophone: 'not_eligible', blk: 'blocked', other: 'relationship_intent_differs', fake: 'not_eligible' });
  assert.equal(M.candidateSet(person('me', { phone_verified: false }), [person('ok')], new Set()).candidates.length, 0);
});

test('HARD/SOFT: AI 정리·추측으로는 HARD 를 만들지 않고, 추측만으로 사람을 빼지 않는다', () => {
  const p = prof({ boundaries: { status: 'CONFIRMED', items: [item('흡연 피함', '담배 싫어', 'AI_EXTRACTED'), item('반려동물 필수', '반려동물 꼭', 'USER_CONFIRMED'), item('조용해 보임', '-', 'PHOTO_INFERRED')] } });
  const s = M.signals(p);
  assert.deepEqual(s.hard.map((i) => i.note), ['반려동물 필수']);
  assert.deepEqual(s.hard_candidates.map((i) => i.note), ['흡연 피함']);
  assert.deepEqual(s.soft.map((i) => i.note), ['천천히 알아가기']);
  const r = M.candidateSet(person('me', { profile: p }), [person('ok')], new Set());
  assert.equal(r.candidates.length, 1, '자유 글 HARD 는 자동 제외하지 않고 검토로'); assert.equal(r.review.length, 1);
});

test('연결 이유: 양쪽 지금 값에서 근거를 찾을 때만 · 교체/거절/추측 근거·심리 해석은 막는다', () => {
  const a = prof(); const b = prof({ relationship_intent: { status: 'CONFIRMED', items: [item('천천히', '천천히 알아가고 싶어요')], history: [] } });
  const good = { text: '두 분 모두 천천히 알아가는 방식을 편하게 느낀다고 말씀하셨어요.', evidence: [{ side: 'a', purpose: 'relationship_intent', quote: '천천히 알아가는' }, { side: 'b', purpose: 'relationship_intent', quote: '천천히 알아가고 싶어요' }] };
  assert.deepEqual(M.validateReason(good, a, b), { ok: true, errors: [] });
  assert.ok(M.validateReason({ ...good, evidence: [good.evidence[0]] }, a, b).errors.includes('needs_both_sides'));
  assert.ok(M.validateReason({ ...good, evidence: [good.evidence[0], { side: 'b', purpose: 'relationship_intent', quote: '지어낸 말' }] }, a, b).errors.some((e) => e.startsWith('no_basis:b')));
  const bOld = prof({ relationship_intent: { status: 'CONFIRMED', items: [item('천천히', '천천히 알아가고 싶어요', 'AI_EXTRACTED', 'SUPERSEDED')] } });
  assert.equal(M.validateReason(good, a, bOld).ok, false, '교체된 옛 값은 근거가 아니다');
  assert.ok(M.validateReason({ ...good, text: '두 분은 MBTI 궁합이 좋아요.' }, a, b).errors.includes('psych_or_banned'));
});
