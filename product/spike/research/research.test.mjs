// 대표 제품 리서치 자산 검사(AI 호출 0). 실행: node --test product/spike/research/research.test.mjs
// 아래 예문(RS-01)은 검사용 가짜 관찰이다. 실제 리서치 데이터가 아니며 observations.json 에 넣지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, validate } from './research-lib.mjs';

const sample = () => ({
  id: 'RS-01', dataset: 'FOUNDER_PRODUCT_RESEARCH', date: '2026-09-26',
  service_category: 'dating', area: 'photo',
  observation: '가입 초기에 사진 6장을 요구', founder_experience: '부담이 컸음', hypothesis: '초기 이탈 가능성 증가',
  echo_candidate: '초기 2~3장 + 이후 추가',
  status: 'UNVALIDATED_HYPOTHESIS',
  validation: { echo_user_data: false, method: null, ref: null, result: null },
  policy_candidate: false, founder_approval: { approved: false, date: null },
  user_fact: false, usable_for_profile: false, usable_for_matching: false,
  pii_check: 'PATTERN_ONLY', refs: [],
});
const doc = (...observations) => ({ schema: 'echo-research-v1', updated: '2026-09-26', observations });
const errsOf = (patch) => { const o = sample(); patch(o); return validate(doc(o)); };

test('정본 파일 검증 통과(현재 관찰 0건 — 지어낸 리서치 없음)', () => {
  const d = load();
  assert.deepEqual(validate(d), []);
  assert.equal(d.observations.length, 0);
});

test('올바른 첫 관찰 = UNVALIDATED_HYPOTHESIS · 사용자 사실 아님 → 통과', () => {
  assert.deepEqual(validate(doc(sample())), []);
});

test('사용자 사실·Profile·Matching 으로 가는 칸은 true 불가', () => {
  for (const k of ['user_fact', 'usable_for_profile', 'usable_for_matching']) {
    assert.ok(errsOf((o) => { o[k] = true; }).some((e) => e.includes(`${k} 는 false`)), k);
    assert.ok(errsOf((o) => { delete o[k]; }).some((e) => e.includes(`${k} 는 false`)), `${k} 빠짐`);
  }
});

test('ECHO 사용자 데이터 없이 검증 완료·정책 후보·대표 승인으로 못 올라감', () => {
  assert.ok(errsOf((o) => { o.status = 'VALIDATED_BY_ECHO_USERS'; }).some((e) => /검증 없이 검증 완료/.test(e)));
  assert.ok(errsOf((o) => { o.status = 'VALIDATED_BY_ECHO_USERS'; o.validation = { echo_user_data: true, method: 'x', ref: null, result: null }; }).some((e) => /근거\(ref·result\) 없음/.test(e)));
  assert.ok(errsOf((o) => { o.policy_candidate = true; }).some((e) => /검증된 가설만 제품 정책 후보/.test(e)));
  assert.ok(errsOf((o) => { o.founder_approval = { approved: true, date: '2026-09-26' }; }).some((e) => /정책 후보가 아닌데 대표 승인/.test(e)));
  assert.ok(errsOf((o) => { o.status = 'IN_VALIDATION'; }).some((e) => /검증 방법/.test(e)));
});

test('검증 근거가 저장소에 있으면 정책 후보 → 대표 승인까지 갈 수 있다(길 자체는 열려 있음)', () => {
  const o = sample();
  o.status = 'VALIDATED_BY_ECHO_USERS';
  o.validation = { echo_user_data: true, method: '가입 단계 이탈 집계(비식별)', ref: 'docs/research/README.md', result: '예시' };
  o.policy_candidate = true; o.founder_approval = { approved: true, date: '2026-09-27' };
  assert.deepEqual(validate(doc(o)), []);
  assert.equal(o.user_fact, false, '정책 후보가 되어도 사용자 사실은 아니다');
});

test('다른 서비스 사용자의 개인정보는 칸 이름·글자 모두 막는다', () => {
  for (const k of ['nickname', 'email', 'phone', 'photo_url', 'screenshot', 'raw_chat']) assert.ok(errsOf((o) => { o[k] = 'x'; }).some((e) => e.includes('개인정보 칸 금지')), k);
  assert.ok(errsOf((o) => { o.extra = { nickname: 'x' }; }).some((e) => e.includes('개인정보 칸 금지')), '깊은 칸');
  const cases = { '이메일': 'abc.def@example.com 으로 연락', '전화번호': '010-1234-5678', '주소(URL)': 'https://example.com/p/1', '이미지 파일': '캡처 profile.jpg', '계정 아이디(@)': '상대 @someone_01 이 먼저' };
  for (const [label, text] of Object.entries(cases)) assert.ok(errsOf((o) => { o.observation = text; }).some((e) => e.includes(label)), label);
  assert.ok(errsOf((o) => { o.observation = '가'.repeat(301); }).some((e) => /300자 초과/.test(e)), '원문 통째');
  assert.ok(errsOf((o) => { o.pii_check = undefined; }).some((e) => /PATTERN_ONLY/.test(e)));
});

test('형식 — ID·dataset·분류·빈 칸', () => {
  assert.ok(errsOf((o) => { o.id = 'X1'; }).some((e) => /ID 형식/.test(e)));
  assert.ok(errsOf((o) => { o.dataset = 'AGENT_FAILURE'; }).some((e) => /dataset/.test(e)));
  assert.ok(errsOf((o) => { o.area = 'vibes'; }).some((e) => /area/.test(e)));
  assert.ok(errsOf((o) => { o.hypothesis = ''; }).some((e) => /hypothesis 비어/.test(e)));
  assert.ok(validate(doc(sample(), sample())).some((e) => /ID 중복/.test(e)));
});
