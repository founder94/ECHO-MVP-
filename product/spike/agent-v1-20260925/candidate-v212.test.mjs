// v2.12 후보 회귀 검사(대표 「FINAL IMPLEMENTATION + DEPLOYMENT READINESS」 §14 A~G). AI 호출 0 — 가짜 AI 응답으로 서버 규칙만 본다.
// 실행: node --experimental-strip-types --test spike/agent-v1-20260925/candidate-v212.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const A = await import('./candidates/agent-v2.12.ts');
const PIDS = A.PURPOSES.map((p) => p.id);
const P = (kind, ex = [], q = '', purpose = '', reply = '네.') => ({ kind, understood: '', reply, extracted: ex, inferred: [], declared: null, wrong: [], next: { type: q ? 'core' : 'none', purpose, question: q, hint: '' } });
const finished = (tone = 'polite') => { const st = A.newState({ tone }); A.seedFirstQuestion(st); return st; };
const active = (st) => PIDS.flatMap((id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.quote));

test('A: 정상 소개가 있을 때 다시 쓰기가 비어 돌아오면 기존 소개를 지킨다', async () => {
  const st = finished();
  A.applyTurn(st, '마음 따뜻한 사람', P('answer', [{ purpose: PIDS[1], note: '따뜻한 사람', quote: '마음 따뜻한 사람' }], '연락은요?', PIDS[3]));
  A.applyTurn(st, '매일 연락하는 게 좋아요', P('answer', [{ purpose: PIDS[3], note: '매일 연락', quote: '매일 연락하는 게 좋아요' }]));
  st.phase = 'done'; st.current = null;
  st.intro = { status: 'ready', lines: [{ text: '저는 마음 따뜻한 사람이 좋아요.', basis: '마음 따뜻한 사람' }], dropped: {}, tries: 1, error: null, used: null, used_at: null };
  const llm = async (kind, sys, input) => kind === 'turn' ? JSON.stringify(P('correction', [{ purpose: PIDS[3], note: '주말', quote: '주말에 한 번 보는 게 좋아' }])) : input.statement ? JSON.stringify({ text: '주말에 한 번 보는 게 좋아요.' }) : JSON.stringify({ intro: [{ text: '', basis: '' }, { text: '  ', basis: '' }] });
  await A.runTurn(st, '아니 그게 아니라 주말에 한 번 보는 게 좋아', llm);
  assert.equal(st.intro.status, 'ready');
  assert.ok(st.intro.lines.some((l) => l.text.includes('마음 따뜻한')), '기존 정상 문장 유지');
  assert.ok(st.intro.lines.every((l) => l.text.trim()), '빈 문장 0');
});

test('B·C: 기존 값 A → 정정 B → 소개에 B 있음 · A 재등장 0 (끝난 뒤 정정 포함)', async () => {
  const st = finished();
  A.applyTurn(st, '매일 연락하는 게 좋아요', P('answer', [{ purpose: PIDS[3], note: '매일 연락', quote: '매일 연락하는 게 좋아요' }]));
  st.phase = 'done'; st.current = null;
  st.intro = { status: 'ready', lines: [{ text: '저는 매일 연락하는 게 좋아요.', basis: '매일 연락하는 게 좋아요' }], dropped: {}, tries: 1, error: null, used: null, used_at: null };
  const llm = async (kind, sys, input) => kind === 'turn' ? JSON.stringify(P('stop', [])) : input.statement ? JSON.stringify({ text: '매일 연락보다 주말에 보는 게 좋아요.' }) : JSON.stringify({ intro: [{ text: '저는 매일 연락하는 게 좋아요.', basis: '매일 연락하는 게 좋아요' }] });
  await A.runTurn(st, '아니 내가 말한 건 매일 연락이 아니라 주말에 보는 게 좋다는 뜻이야', llm);
  assert.ok(!active(st).some((q) => q === '매일 연락하는 게 좋아요'), '옛 값 A 는 SUPERSEDED');
  assert.ok(st.intro.lines.some((l) => /주말/.test(l.text)), '최신 정정 B 가 소개에 있음');
  assert.ok(!st.intro.lines.some((l) => /매일 연락하는 게 좋아요/.test(l.text)), '옛 값 A 문장 재등장 0');
});

for (const [name, seed, phrase] of [['D: 사주', { source: 'SAJU', key: 'peer_none' }, '혼자 정리하는 시간'], ['E: 타로', { source: 'TAROT', card: '달' }, '달 카드']]) {
  test(`${name} 해석 → 사용자 「아니」 → 거절 · 이후 결과 의미 재등장 0 · 결과는 사용자 사실 아님`, () => {
    const st = A.newState({ tone: 'polite', seed }); A.seedFirstQuestion(st);
    A.applyTurn(st, '친구처럼 편한 만남이요', P('answer', [{ purpose: PIDS[0], note: '친구 같은 만남', quote: '친구처럼 편한 만남' }], '끌리는 사람은?', PIDS[1]));
    assert.ok(/결과에서는|카드에서는/.test(st.current.text), '다리 질문');
    A.applyTurn(st, '아니, 난 사람 만나는 거 좋아해', P('answer', [{ purpose: PIDS[3], note: phrase + '이 필요한 사람', quote: '사람 만나는 거 좋아해' }], `${phrase} 얘기 더 해 볼까요?`, PIDS[1]));
    assert.equal(st.seed.rejected, true, '결과 거절');
    assert.ok(!PIDS.some((id) => st.slots[id].items.some((i) => i.status === 'CONFIRMED' && i.source_type === 'USER_CORRECTED')), '결과 반박은 정정으로 세지 않음');
    assert.ok(!PIDS.some((id) => st.slots[id].items.some((i) => (i.note + i.quote).replace(/\s/g, '').includes(phrase.replace(/\s/g, '')))), '결과 문구가 사용자 사실에 0');
    assert.ok(active(st).includes('사람 만나는 거 좋아해'), '사용자 직접 말은 보존');
    const c = A.cleanIntro(st, [{ text: `저는 ${phrase}이 필요해요.`, basis: '사람 만나는 거 좋아해' }, { text: '저는 사람 만나는 걸 좋아해요.', basis: '사람 만나는 거 좋아해' }]);
    assert.equal(c.lines.length, 1, '소개에 결과 문구 0');
    const profile = JSON.stringify([A.matchingProfile(st), A.matchingHandoff(A.matchingProfile(st))]);
    assert.ok(!/사주|타로|카드/.test(profile), '매칭 프로필 오염 0');
  });
}

test('F: 에이전트 후보 생성 실패(AI 오류·읽을 수 없는 응답) → 기존 상태 그대로', async () => {
  const st = finished();
  A.applyTurn(st, '마음 따뜻한 사람', P('answer', [{ purpose: PIDS[1], note: '따뜻한 사람', quote: '마음 따뜻한 사람' }], '연락은요?', PIDS[3]));
  const before = JSON.stringify(st);
  const r1 = await A.runTurn(st, '천천히 연락하는 게 좋아요', async () => { throw new Error('boom'); });
  assert.equal(r1.response.error, 'PROVIDER'); assert.equal(JSON.stringify(st), before, 'AI 오류 → 상태 변화 0');
  const r2 = await A.runTurn(st, '천천히 연락하는 게 좋아요', async () => 'not json');
  assert.equal(r2.response.error, 'READ_FAILED'); assert.equal(JSON.stringify(st), before, '읽을 수 없는 응답 → 상태 변화 0');
});

test('G: 미확정 정보(AI 추측)는 소개·매칭 사실로 올라가지 않는다 · 사용자가 말하지 않은 단정 받아주기는 빠진다', () => {
  const st = finished();
  const out = P('answer', [{ purpose: PIDS[1], note: '돈', quote: '돈때문에' }], '먼저 보는 점은?', PIDS[2], '돈 문제로 고민이 있구나.');
  out.inferred = [{ trait: '경제적 불안', basis: '돈때문에' }];
  A.applyTurn(st, '돈때문에', out);
  assert.equal(st.inferred[0].status, 'INFERRED');
  const prof = A.matchingProfile(st);
  assert.ok(!JSON.stringify(prof.confirmed_preferences).includes('경제적 불안'), '추측은 확인 정보에 0');
  assert.equal(A.dropUngrounded('돈 문제로 고민이 있구나.', '돈때문에'), '', '말하지 않은 고민 단정 0');
  assert.equal(A.dropUngrounded('어떤 만남이 좋을지 고민하고 계신 것 같아요.', '딥하네'), '', '근거 없는 짐작 0');
  assert.equal(A.dropUngrounded('약속을 잘 지키는 사람이 좋군요.', '약속 잘 지키는 사람'), '약속을 잘 지키는 사람이 좋군요.', '사용자 말 되짚기는 남음');
});
