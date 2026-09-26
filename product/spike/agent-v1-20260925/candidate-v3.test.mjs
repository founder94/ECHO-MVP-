// ECHO Agent v3 TURN CONTRACT 검사(AI 호출 0 · 모델 자리에 대본을 넣어 서버 결정만 본다).
// 골든 실패 세트(golden-failure-set-v3.json)의 사례마다: 서버 행동 · 금지 동작 0 · 상태 변화.
// 실행: node --experimental-strip-types --test spike/agent-v1-20260925/candidate-v3.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const A = await import('./candidates/agent-v3.ts');
const GOLDEN = JSON.parse(readFileSync(new URL('./golden-failure-set-v3.json', import.meta.url), 'utf8'));
const sq = (t) => String(t ?? '').replace(/\s/g, '');
const active = (st) => A.PIDS.flatMap((id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.quote));
const stage = (sys) => sys.includes('이해 단계') ? 'understand' : sys.includes('행동(action)') ? 'speak' : sys.includes('대화를 자연스럽게 마친다') ? 'closing' : 'other';

// 모델 대본: 이해 = 사례가 준 값 · 말하기 = 행동에 맞게 무난히(질문은 매번 새 글자) · 마침 = 들은 말로 소개.
function scripted({ understand = [], speakOverride = null } = {}) {
  let n = 0; const u = [...understand]; const seen = [];
  const llm = async (kind, sys, input) => {
    const s = stage(sys); seen.push(s);
    if (s === 'understand') {
      const x = u.length ? u.shift() : { input_type: 'NORMAL_ANSWER' };
      if (x === 'UNREADABLE') return 'not json';
      if (x === 'PROVIDER_ERROR') throw new Error('boom');
      return JSON.stringify({ extracted: [], wrong: [], content_rejected: false, declared: null, inferred: [], about: '', ...x });
    }
    if (s === 'speak') {
      if (speakOverride) { const o = speakOverride(input, n++); if (o) return JSON.stringify(o); }
      n++;
      const a = input.action;
      const reply = a === 'ANSWER_USER' ? '정해진 질문 목록은 없어요, 방금 하신 말을 보고 이어 가요.' : a === 'REPAIR' ? '앞서 하신 말을 제가 놓쳤네요.' : `들은 말 ${n}.`;
      if (a === 'AFTER_ACK' || a === 'BRIDGE') return JSON.stringify({ reply, question: '', purpose: '' });
      if (a === 'ASK_GAP') return JSON.stringify({ reply, question: `새 질문 ${n}은 어때요?`, purpose: input.gaps[0]?.purpose ?? '' });
      return JSON.stringify({ reply, question: `이어지는 이야기 ${n}은 어때요?`, purpose: '' });
    }
    if (s === 'closing') { const h = (input.heard ?? []).find((x) => x.quote); return JSON.stringify({ summary: [], closing: '이제 조금 알 것 같아요.', intro: h ? [{ text: `저는 ${h.quote}이 좋아요.`, basis: h.quote }] : [] }); }
    return JSON.stringify({ intro: [] });
  };
  return { llm, seen };
}
// 공통 시작: 목적 타일 답(첫 턴) → 첫 목적 질문이 나간 상태.
async function begun({ seed = null, first = '친구처럼 편한 만남이요', firstU = { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구 같은 만남', quote: '친구처럼 편한 만남' }] } } = {}) {
  const st = A.newState({ tone: 'polite', seed }); A.seedFirstQuestion(st);
  await A.runTurn(st, first, scripted({ understand: [firstU] }).llm);
  return st;
}

for (const c of GOLDEN.cases) {
  test(`${c.id} ${c.input} → ${c.expected_action}`, async () => {
    const firstU = c.id === 'G05' || c.id === 'G06'
      ? { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구 같은 만남', quote: '친구처럼 편한 만남' }, { purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }] }
      : undefined;
    const st = await begun({ seed: c.seed ?? null, ...(firstU ? { first: '친구처럼 편한 만남이요 매일 연락하는 게 좋아요', firstU } : {}) });
    const prevQ = st.current?.text ?? null;
    const before = JSON.stringify(st);
    const factsBefore = active(st).length;
    const { llm } = scripted({ understand: [c.understand, c.understand] });
    const r = await A.runTurn(st, c.input, llm);
    if (c.understand === 'PROVIDER_ERROR') { assert.equal(r.response.error, 'PROVIDER'); assert.equal(JSON.stringify(st), before, '상태 변화 0'); return; }
    assert.equal(r.response.error, undefined, '사용자에게 오류 0');
    assert.equal(r.response.action ?? (r.response.finish ? 'CLOSE' : null), c.expected_action);
    const f = new Set(c.forbidden);
    if (f.has('repeat_prev_question') && prevQ) assert.notEqual(sq(r.response.question), sq(prevQ), '앞 질문 되풀이 0');
    if (f.has('save_as_fact')) assert.equal(active(st).length, factsBefore, '사실 저장 0');
    if (f.has('finish')) assert.equal(r.response.finish, false, '끝내기 0');
    if (f.has('empty_reply')) assert.ok(String(r.response.reply).trim(), '빈 받아주기 0');
    if (f.has('old_value_active')) assert.ok(!active(st).includes('매일 연락하는 게 좋아요'), '옛 값 CONFIRMED 0');
    if (f.has('seed_as_fact')) { assert.equal(st.seed.rejected, true); assert.ok(!A.PIDS.some((id) => st.slots[id].items.some((i) => i.status === 'CONFIRMED' && (i.note + i.quote).includes(st.seed.summary)))); }
    if (f.has('seed_reappears')) assert.ok(!sq(r.response.question).includes(sq(st.seed.phrase)));
    if (f.has('padding_question')) assert.equal(r.response.finish, true, '충분하면 질문을 덧대지 않고 정리');
    if (f.has('new_question')) assert.equal(r.response.question ?? null, null);
    if (f.has('error_to_user')) assert.equal(r.response.error, undefined);
  });
}

test('서버가 막는다: 불만 턴에 모델이 앞 질문을 그대로 내면 두 번 다시 청해도 안 되면 질문을 빼고 듣는다(끝내기 0)', async () => {
  const st = await begun();
  const prevQ = st.current.text;
  const { llm } = scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: () => ({ reply: '적어 주신 말과 상관없는 질문이었어요.', question: prevQ, purpose: '' }) });
  const r = await A.runTurn(st, '내가 적는거랑 상관없이 질문하네', llm);
  assert.equal(r.response.question, null); assert.equal(r.response.finish, false);
  assert.ok(r.obs.retry.some((x) => x.startsWith('speak_repeat_question')));
});

test('서버가 막는다: 메타 턴에 모델이 받아주기를 비우면 다시 청하고, 그래도면 짧은 안내(빈 응답 0)', async () => {
  const st = await begun();
  const { llm } = scripted({ understand: [{ input_type: 'META_QUESTION' }], speakOverride: () => ({ reply: '', question: '', purpose: '' }) });
  const r = await A.runTurn(st, '질문이 뭐야?', llm);
  assert.ok(String(r.response.reply).trim()); assert.equal(r.response.finish, false);
});

test('서버가 막는다: 말하지 않은 감정 짐작은 받아주기에서 빠진다', async () => {
  const st = await begun();
  const { llm } = scripted({ understand: [{ input_type: 'TOPIC_CHANGE' }], speakOverride: () => ({ reply: '개발 때문에 많이 지치셨겠어요. 머릿속이 개발로 꽉 찼겠네요.', question: '요즘 제일 붙잡고 있는 건 뭐예요?', purpose: '' }) });
  const r = await A.runTurn(st, '요즘 회사 개발 얘기만 해', llm);
  assert.ok(!/지치/.test(r.response.reply), r.response.reply);
});

test('질문 개수 목표 0: 목적 질문 상한은 약속이 아니고, 따라가기·답하기 질문은 목적 질문 수에 안 센다', async () => {
  const st = await begun();
  const core = A.coreAsked(st).length;
  await A.runTurn(st, '요즘 회사 개발 얘기만 해', scripted({ understand: [{ input_type: 'TOPIC_CHANGE' }] }).llm);
  await A.runTurn(st, '질문이 뭐야?', scripted({ understand: [{ input_type: 'META_QUESTION' }] }).llm);
  assert.equal(A.coreAsked(st).length, core);
  assert.equal(st.phase, 'talk');
});

test('주제 이동이 길어지면(2턴+) 말하기에 다리 허용(bridge_ok)을 준다 — 서버가 억지로 끌고 오지 않는다', async () => {
  const st = await begun();
  let got = null;
  const mk = (it) => scripted({ understand: [{ input_type: it }], speakOverride: (input) => { got = input.bridge_ok; return null; } }).llm;
  await A.runTurn(st, '요즘 회사 개발 얘기만 해', mk('TOPIC_CHANGE'));
  assert.equal(got, false);
  await A.runTurn(st, '배포가 계속 밀려', mk('TOPIC_CHANGE'));
  assert.equal(got, true);
});

test('정정 뒤 같은 것을 다시 캐묻는 질문은 막는다', async () => {
  const st = await begun({ first: '친구처럼 편한 만남이요 매일 연락하는 게 좋아요', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구처럼 편한 만남' }, { purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }] } });
  const { llm } = scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말', quote: '주말에 한 번 보면 좋겠어' }] }], speakOverride: () => ({ reply: '주말에 한 번이 편하군요.', question: '왜 매일은 부담스러워요?', purpose: '' }) });
  const r = await A.runTurn(st, '아니 매일은 부담스럽고 주말에 한 번 보면 좋겠어', llm);
  assert.ok(!/왜/.test(r.response.question ?? ''));
});

test('끝난 뒤 받은 답이 저장되면 소개를 다시 쓴다 · 끝난 뒤에는 질문 0', async () => {
  const st = await begun();
  st.phase = 'done'; st.current = null;
  st.intro = { status: 'ready', lines: [{ text: '저는 친구처럼 편한 만남이 좋아요.', basis: '친구처럼 편한 만남' }], dropped: {}, tries: 1, error: null, used: null, used_at: null };
  let introCalls = 0;
  const base = scripted({ understand: [{ input_type: 'NEW_USER_FACT', extracted: [{ purpose: 'relationship_style', note: '주말', quote: '주말에 한 번 보는 게 좋아요' }] }] }).llm;
  const llm = async (kind, sys, input) => { if (kind === 'intro') { introCalls++; return JSON.stringify({ intro: [{ text: '저는 친구처럼 편한 만남이 좋아요.', basis: '친구처럼 편한 만남' }, { text: '주말에 한 번 보는 게 좋아요.', basis: '주말에 한 번 보는 게 좋아요' }] }); } return base(kind, sys, input); };
  const r = await A.runTurn(st, '주말에 한 번 보는 게 좋아요', llm);
  assert.equal(r.response.question, null); assert.ok(introCalls >= 1); assert.ok(st.intro.lines.some((l) => /주말/.test(l.text)));
});

test('매칭 프로필에는 확정 값만(추측·사주·거절 0)', async () => {
  const st = await begun({ seed: { source: 'TAROT', card: '달' } });
  await A.runTurn(st, '나는 오히려 먼저 다가가는 편이야', scripted({ understand: [{ input_type: 'TAROT_RESPONSE', content_rejected: true, extracted: [{ purpose: 'relationship_style', note: '먼저 다가감', quote: '먼저 다가가는 편이야' }], inferred: [{ trait: '외향적', basis: '먼저' }] }] }).llm);
  const p = A.matchingProfile(st); const j = JSON.stringify([p.confirmed_preferences, A.matchingHandoff(p).criteria]);
  assert.ok(!/카드|타로|사주|외향적/.test(j), j);
});

test('v2.13 보존: 불만 문장은 사실 저장 0 · 같은 말 속 자기 이야기는 저장', async () => {
  const st = await begun();
  const { llm } = scripted({ understand: [{ input_type: 'COMPLAINT', extracted: [{ purpose: 'attraction_comfort', note: '말이 안 됨', quote: '내용은 말이 안된다' }, { purpose: 'attraction_comfort', note: '차분한 사람', quote: '조용하고 차분한 사람이 좋아' }] }] });
  await A.runTurn(st, '내용은 말이 안된다. 나는 조용하고 차분한 사람이 좋아', llm);
  assert.ok(active(st).includes('조용하고 차분한 사람이 좋아'));
  assert.ok(!active(st).some((q) => /말이\s*안/.test(q)));
});

test('v2.13 보존: 질문 없이 들은 뒤의 답은 모델이 못 뽑아도 원문으로 남는다', async () => {
  const st = await begun();
  const pid = st.current.purpose;
  await A.runTurn(st, '질문이 뭐야?', scripted({ understand: [{ input_type: 'META_QUESTION' }], speakOverride: () => ({ reply: '정해진 질문 목록은 없어요.', question: '', purpose: '' }) }).llm);
  assert.equal(st.current, null);
  const r = await A.runTurn(st, '말 잘 통하고 차분한 사람이 좋아요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER' }] }).llm);
  assert.equal(r.response.saved, true);
  assert.ok(st.slots[pid].items.some((i) => i.quote === '말 잘 통하고 차분한 사람이 좋아요'));
});

test('v2.12 보존: 소개 다시 쓰기가 비면 기존 정상 소개 유지 · 최근 정정 소개 반영', async () => {
  const st = await begun({ first: '친구처럼 편한 만남이요 매일 연락하는 게 좋아요', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구처럼 편한 만남' }, { purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }] } });
  st.phase = 'done'; st.current = null;
  st.intro = { status: 'ready', lines: [{ text: '저는 친구처럼 편한 만남이 좋아요.', basis: '친구처럼 편한 만남' }], dropped: {}, tries: 1, error: null, used: null, used_at: null };
  const base = scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말', quote: '주말에 보는 게 좋다' }] }] }).llm;
  const llm = async (kind, sys, input) => kind === 'intro' ? (input.statement ? JSON.stringify({ text: '매일보다 주말에 보는 게 좋아요.' }) : JSON.stringify({ intro: [{ text: '', basis: '' }] })) : base(kind, sys, input);
  await A.runTurn(st, '아니 내가 말한 건 매일 연락이 아니라 주말에 보는 게 좋다는 뜻이야', llm);
  assert.equal(st.intro.status, 'ready');
  assert.ok(st.intro.lines.some((l) => /친구처럼/.test(l.text)), '기존 정상 문장 유지');
  assert.ok(st.intro.lines.some((l) => /주말/.test(l.text)), '최근 정정 반영');
  assert.ok(!active(st).includes('매일 연락하는 게 좋아요'));
});

test('서비스 설명에 질문 개수 약속 0', () => {
  assert.ok(!A.SERVICE_FACTS.some((f) => /다섯|5개/.test(f)));
  assert.equal(A.AGENT_VERSION, 'echo-agent-v3.0');
});
