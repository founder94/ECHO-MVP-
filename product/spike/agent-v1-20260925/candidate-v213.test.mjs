// v2.13 후보 검사(대표 「FINAL INTEGRATED AUDIT」 QA A~I). AI 호출 0 — 가짜 AI 응답으로 서버 규칙만 본다.
// 실행: node --experimental-strip-types --test spike/agent-v1-20260925/candidate-v213.test.mjs
// 대표 실기기 문장(메타·불만)은 대표가 보고한 표현 그대로 쓴다(개인정보 없음).
import test from 'node:test';
import assert from 'node:assert/strict';
const A = await import('./candidates/agent-v2.13.ts');
const PIDS = A.PURPOSES.map((p) => p.id);
const P = (kind, ex = [], q = '', purpose = '', reply = '네.', type = null) => ({ kind, understood: '', reply, extracted: ex, inferred: [], declared: null, wrong: [], next: { type: q ? (type ?? 'core') : 'none', purpose, question: q, hint: '' } });
const begun = (tone = 'polite') => { const st = A.newState({ tone }); A.seedFirstQuestion(st); return st; };
const active = (st) => PIDS.flatMap((id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.quote));
const sq = (t) => String(t ?? '').replace(/\s/g, '');

test('모양 인식: 대표 실기기 메타·불만 문장 4개를 알아본다 · 보통 답은 아니다', () => {
  assert.equal(A.redirectOf('우리회사 개발얘기했는데 질문이 뭐야?'), 'meta');
  assert.equal(A.redirectOf('고정질문으로 바뀐거니?'), 'meta');
  assert.equal(A.redirectOf('내용은 말이 안된다'), 'complaint');
  assert.equal(A.redirectOf('내가 적는거랑 상관없이 질문하네'), 'complaint');
  for (const t of ['편한 사람이 좋아요', '연락은 가끔이면 돼', '상관없어요 아무나 괜찮아요', '질문 좋네요 천천히 알아가는 게 좋아요', '말이 잘 통하는 사람']) assert.equal(A.redirectOf(t), null, t);
});

test('A: 불만(「내가 적는 거랑 상관없이 질문하네」) → 같은 질문을 다시 밀지 않는다 · 답으로 저장 0', () => {
  const st = begun();
  const q0 = st.current.text;
  const r = A.applyTurn(st, '내가 적는거랑 상관없이 질문하네', P('answer', [{ purpose: st.current.purpose, note: '상관없음', quote: '상관없이 질문하네' }], q0, st.current.purpose));
  assert.equal(r.kind, 'repair', '서버가 불만으로 바로잡음');
  assert.notEqual(sq(r.question), sq(q0), '같은 질문 강요 0');
  assert.equal(r.finish, false, '대화를 끝내지 않음');
  assert.equal(r.saved, false, '불만 문장 저장 0');
  assert.deepEqual(active(st), []);
});

test('B: 메타(「우리회사 개발얘기했는데 질문이 뭐야?」) → 답하고 사용자 말에 이어지는 열린 질문 · 핵심 질문 수 0 · 저장 0', () => {
  const st = begun();
  A.applyTurn(st, '요즘 회사에서 개발 얘기만 해요', P('answer', [], '일할 때 어떤 사람이 편해요?', PIDS[1]));
  const core = A.coreAsked(st).length;
  const r = A.applyTurn(st, '우리회사 개발얘기했는데 질문이 뭐야?', P('answer', [{ purpose: PIDS[2], note: '회사 개발', quote: '우리회사 개발얘기했는데' }], '회사 개발 얘기 하셨는데, 같이 일하기 편한 사람은 어떤 사람이에요?', PIDS[1], '정해진 질문 목록은 없어요. 방금 하신 말을 보고 다음을 정해요.', 'open'));
  assert.equal(r.kind, 'ask');
  assert.ok(r.reply.includes('정해진 질문'), '메타 물음에 먼저 답함');
  assert.equal(r.question_type, 'open');
  assert.equal(A.coreAsked(st).length, core, '열린 질문은 핵심 질문 수에 안 셈');
  assert.equal(r.saved, false, '메타 문장 저장 0');
  assert.ok(!active(st).some((q) => /질문이\s*뭐/.test(q)));
});

test('B-2: 메타 턴에 AI 가 질문을 못 내면 질문 없이 듣는다(끝내지 않음 · 같은 질문 강요 0)', () => {
  const st = begun();
  const r = A.applyTurn(st, '고정질문으로 바뀐거니?', P('ask', [], '', '', '아니에요, 정해진 질문 목록은 없어요.'));
  assert.equal(r.question, null); assert.equal(r.finish, false);
  assert.equal(st.turns.at(-1).decision, 'redirect_listen');
  assert.equal(st.phase, 'talk');
});

test('C: 뜻으로 이미 답한 것을 다시 묻지 않도록 다시 청한다(semantic_reask) · 불만 턴은 redirect_same 로 다시 청한다', () => {
  const st = begun();
  A.applyTurn(st, '일주일에 한 번 보는 게 좋아요', P('answer', [{ purpose: PIDS[3], note: '주 1회', quote: '일주일에 한 번 보는 게 좋아요' }], '끌리는 사람은요?', PIDS[1]));
  assert.equal(A.retryReason(st, P('answer', [], '연락은 자주 하는 게 좋아요?', PIDS[4]), A.openPurposes(st), false, '음'), 'semantic_reask', '이미 말한 만남 빈도 다시 묻기');
  assert.equal(A.retryReason(st, P('repair', [], st.current.text, st.current.purpose), A.openPurposes(st), false, '내가 적는거랑 상관없이 질문하네'), 'redirect_same');
  assert.equal(A.retryReason(st, P('repair', [], '', ''), A.openPurposes(st), false, '내용은 말이 안된다'), 'redirect_question');
});

test('D: 한 답이 여러 목적을 채우면 남은 목적만 묻고, 다 채우면 5개를 채우려 덧대지 않는다(3개로도 끝)', () => {
  const st = begun();
  A.applyTurn(st, '가볍게 친구처럼 만나고 싶어요', P('answer', [{ purpose: PIDS[0], note: '친구처럼', quote: '가볍게 친구처럼 만나고 싶어요' }], '같이 있으면 편한 사람은요?', PIDS[1]));
  A.applyTurn(st, '말 잘 들어주고 약속 잘 지키는 사람, 연락은 가끔, 거짓말은 절대 싫어요', P('answer', [
    { purpose: PIDS[1], note: '말 잘 들어줌', quote: '말 잘 들어주고' }, { purpose: PIDS[2], note: '약속', quote: '약속 잘 지키는 사람' },
    { purpose: PIDS[3], note: '연락 가끔', quote: '연락은 가끔' }, { purpose: PIDS[4], note: '거짓말 싫음', quote: '거짓말은 절대 싫어요' }]));
  assert.deepEqual(A.openPurposes(st), []);
  assert.equal(st.turns.at(-1).decision, 'finish');
  assert.ok(A.coreAsked(st).length <= 3, `핵심 질문 ${A.coreAsked(st).length}개로 끝`);
});

test('H·P0-B: 새 질문이 빠져도(이미 한 질문) 물을 목적이 남았으면 끝내지 않는다(run 31 FLOW6)', () => {
  const st = begun();
  const q0 = st.current.text;
  A.applyTurn(st, '친구처럼 편한 만남', P('answer', [{ purpose: PIDS[0], note: '친구처럼', quote: '친구처럼 편한 만남' }], '끌리는 사람은요?', PIDS[1]));
  const r = A.applyTurn(st, '질문이 너무 많네', P('repair', [], q0, PIDS[2]));
  assert.equal(st.turns.at(-1).dropped, 'asked_before');
  assert.equal(r.finish, false, '조기 종료 0');
  assert.equal(st.phase, 'talk');
  // 그만하자는 말은 존중한다
  const r2 = A.applyTurn(st, '그만할래', P('stop'));
  assert.equal(r2.finish, true);
});

test('H: 후보 생성 실패(AI 오류·읽을 수 없는 응답) → 상태 그대로', async () => {
  const st = begun();
  const before = JSON.stringify(st);
  assert.equal((await A.runTurn(st, '내가 적는거랑 상관없이 질문하네', async () => { throw new Error('boom'); })).response.error, 'PROVIDER');
  assert.equal((await A.runTurn(st, '내가 적는거랑 상관없이 질문하네', async () => 'not json')).response.error, 'READ_FAILED');
  assert.equal(JSON.stringify(st), before);
});

test('I: 불만 뒤 답은 프로필에 들어간다 · 불만 문장 속 자기 이야기(다른 문장)만 받는다', () => {
  const st = begun();
  A.applyTurn(st, '내용은 말이 안된다. 나는 조용하고 차분한 사람이 좋아', P('repair', [{ purpose: PIDS[1], note: '말이 안 됨', quote: '내용은 말이 안된다' }, { purpose: PIDS[1], note: '차분한 사람', quote: '조용하고 차분한 사람이 좋아' }], '조용한 사람이랑은 주로 뭐 하면서 시간 보내요?', PIDS[1], '엉뚱하게 물었네요.', 'open'));
  assert.ok(active(st).includes('조용하고 차분한 사람이 좋아'), '다른 문장의 자기 이야기는 저장');
  assert.ok(!active(st).some((q) => /말이\s*안/.test(q)), '불만 문장 저장 0');
  A.applyTurn(st, '같이 산책하거나 카페 가는 거', P('answer', [{ purpose: PIDS[3], note: '산책·카페', quote: '같이 산책하거나 카페 가는 거' }], '이건 좀 힘들겠다 싶은 건요?', PIDS[4]));
  const prof = JSON.stringify(A.matchingProfile(st));
  assert.ok(prof.includes('같이 산책하거나 카페 가는 거'), '불만 뒤 답이 프로필에 있음');
});

test('P0-1: 끝난 뒤 받은 답(정정 아님)이 저장되면 소개 초안을 다시 쓴다', async () => {
  const st = begun();
  A.applyTurn(st, '마음 따뜻한 사람', P('answer', [{ purpose: PIDS[1], note: '따뜻한 사람', quote: '마음 따뜻한 사람' }]));
  st.phase = 'done'; st.current = null;
  st.intro = { status: 'ready', lines: [{ text: '저는 마음 따뜻한 사람이 좋아요.', basis: '마음 따뜻한 사람' }], dropped: {}, tries: 1, error: null, used: null, used_at: null };
  let intro = 0;
  const llm = async (kind) => { if (kind === 'turn') return JSON.stringify(P('answer', [{ purpose: PIDS[3], note: '주말', quote: '주말에 한 번 보는 게 좋아요' }])); intro++; return JSON.stringify({ intro: [{ text: '저는 마음 따뜻한 사람이 좋아요.', basis: '마음 따뜻한 사람' }, { text: '주말에 한 번 보는 게 좋아요.', basis: '주말에 한 번 보는 게 좋아요' }] }); };
  await A.runTurn(st, '주말에 한 번 보는 게 좋아요', llm);
  assert.ok(intro >= 1, '소개 다시 쓰기 호출');
  assert.ok(st.intro.lines.some((l) => /주말/.test(l.text)), '끝난 뒤 답이 소개에 반영');
});

test('정정은 여전히 불만보다 먼저다(「아니 그게 아니라 …」)', () => {
  const st = begun();
  A.applyTurn(st, '매일 연락하는 게 좋아요', P('answer', [{ purpose: PIDS[3], note: '매일 연락', quote: '매일 연락하는 게 좋아요' }], '끌리는 사람은요?', PIDS[1]));
  const r = A.applyTurn(st, '아니 그게 아니라 주말에만 보는 게 좋아', P('correction', [{ purpose: PIDS[3], note: '주말', quote: '주말에만 보는 게 좋아' }], '같이 있으면 편한 사람은요?', PIDS[1]));
  assert.equal(r.kind, 'correction');
  assert.ok(!active(st).includes('매일 연락하는 게 좋아요'));
});

test('서비스 설명에 「다섯 개까지만」 약속 0 · 상한은 서버 값 그대로', () => {
  assert.ok(!A.SERVICE_FACTS.some((f) => /다섯 개까지만/.test(f)));
  assert.equal(A.MAX_CORE_QUESTIONS, 5);
});

test('I-2: 질문 없이 들은 턴 다음의 답은 AI 가 못 뽑아도 사용자 원문으로 남는다', () => {
  const st = begun();
  const pid = st.current.purpose;
  A.applyTurn(st, '고정질문으로 바뀐거니?', P('ask', [], '', '', '아니에요, 정해진 질문 목록은 없어요.'));
  assert.equal(st.current, null);
  const r = A.applyTurn(st, '말 잘 통하고 차분한 사람이 좋아요', P('answer', [], '연락은 어느 정도가 편해요?', PIDS[3]));
  assert.equal(r.saved, true);
  assert.ok(st.slots[pid].items.some((i) => i.quote === '말 잘 통하고 차분한 사람이 좋아요' && i.source_type === 'USER_DIRECT'));
  assert.equal(st.listening, null, '새 질문을 하면 듣기 목적은 비움');
});
