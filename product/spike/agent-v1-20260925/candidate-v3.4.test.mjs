// ECHO Agent v3.1 검사(v3 검사 전부 + run 33 실패 재현 A~H). ECHO Agent v3 TURN CONTRACT 검사(AI 호출 0 · 모델 자리에 대본을 넣어 서버 결정만 본다).
// 골든 실패 세트(golden-failure-set-v3.json)의 사례마다: 서버 행동 · 금지 동작 0 · 상태 변화.
// 실행: node --experimental-strip-types --test spike/agent-v1-20260925/candidate-v3.4.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const A = await import('./candidates/agent-v3.4.ts');
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

test('v3.1 P0-6(v2.13 대체): 질문 없이 들은 뒤의 답은 모델이 못 뽑으면 원문을 UNCONFIRMED 로 보존(사실 확정 0)', async () => {
  const st = await begun();
  const pid = st.current.purpose;
  await A.runTurn(st, '질문이 뭐야?', scripted({ understand: [{ input_type: 'META_QUESTION' }], speakOverride: () => ({ reply: '정해진 질문 목록은 없어요.', question: '', purpose: '' }) }).llm);
  assert.equal(st.current, null);
  const r = await A.runTurn(st, '말 잘 통하고 차분한 사람이 좋아요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER' }] }).llm);
  assert.equal(r.response.saved, false, '사실 저장 0');
  assert.equal(r.response.raw_kept, true, '원문 보존');
  assert.ok(!st.slots[pid].items.some((i) => i.quote === '말 잘 통하고 차분한 사람이 좋아요'));
  assert.ok(st.pending.some((p) => p.quote === '말 잘 통하고 차분한 사람이 좋아요' && p.status === 'UNCONFIRMED' && p.source_type === 'USER_DIRECT'));
});

test('v2.12 보존: 소개 다시 쓰기가 비면 기존 정상 소개 유지 · 최근 정정 소개 반영', async () => {
  const st = await begun({ first: '친구처럼 편한 만남이요 매일 연락하는 게 좋아요', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구처럼 편한 만남' }, { purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }] } });
  st.phase = 'done'; st.current = null;
  st.intro = { status: 'ready', lines: [{ text: '저는 친구처럼 편한 만남이 좋아요.', basis: '친구처럼 편한 만남' }], dropped: {}, tries: 1, error: null, used: null, used_at: null };
  const base = scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말', quote: '주말에 보는 게 좋다' }] }] }).llm;
  const llm = async (kind, sys, input) => kind === 'intro' ? (input.statements ? JSON.stringify({ lines: input.statements.map((x) => ({ id: x.id, text: /주말/.test(x.quote) ? '매일보다 주말에 보는 게 좋아요.' : '' })) }) : JSON.stringify({ intro: [{ text: '', basis: '' }] })) : base(kind, sys, input);
  await A.runTurn(st, '아니 내가 말한 건 매일 연락이 아니라 주말에 보는 게 좋다는 뜻이야', llm);
  assert.equal(st.intro.status, 'ready');
  assert.ok(st.intro.lines.some((l) => /친구처럼/.test(l.text)), '기존 정상 문장 유지');
  assert.ok(st.intro.lines.some((l) => /주말/.test(l.text)), '최근 정정 반영');
  assert.ok(!active(st).includes('매일 연락하는 게 좋아요'));
});

test('서비스 설명에 질문 개수 약속 0', () => {
  assert.ok(!A.SERVICE_FACTS.some((f) => /다섯|5개/.test(f)));
  assert.equal(A.AGENT_VERSION, 'echo-agent-v3.4');
});

// ── v3.1 run 33 실패 재현(대표 「v3.1 SERVER FIX」 §6 A~H + P0-1~7). 모델 자리 = 대본(서버 규칙 확인 · 사람다움 판정 아님).
const LISTEN = ['네, 이어서 편하게 말해 주세요.', '응, 이어서 편하게 말해 줘.', '네, 이어서 편하게 말씀해 주세요.'];
const visible = (r) => [r.response.reply, r.response.question].filter(Boolean).join(' ').trim();
const EMPTY_SPEAK = () => ({ reply: '', question: '', purpose: '' });

test('A · P0-1 빈 출력(FOLLOW) → 서버 복구 · 빈 턴 0', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '요즘 회사 개발 얘기만 해', scripted({ understand: [{ input_type: 'TOPIC_CHANGE' }], speakOverride: EMPTY_SPEAK }).llm);
  assert.equal(r.response.action, 'FOLLOW');
  assert.ok(visible(r).length > 0, '사용자에게 보이는 말 있음');
  assert.match(r.response.recovery, /^EMPTY_REPLY:/);
  assert.equal(st.turns.at(-1).reply || st.turns.at(-1).question ? true : false, true);
});
test('A2 · P0-1 받아주기가 서버 검사로 모두 지워지고 질문도 없으면 다시 청한다(빈 턴 통과 0)', async () => {
  const st = await begun();
  let n = 0;
  const r = await A.runTurn(st, '요즘 회사 일 때문에 정신이 없어요', scripted({ understand: [{ input_type: 'TOPIC_CHANGE' }], speakOverride: () => (n++ === 0 ? { reply: '좋은 선택이네요.', question: '', purpose: '' } : { reply: '회사 일로 정신이 없으시군요.', question: '요즘 어떤 일이 제일 바빠요?', purpose: '' }) }).llm);
  assert.equal(r.response.question, '요즘 어떤 일이 제일 바빠요?');
  assert.ok(visible(r).length > 0);
});
test('A3 · P0-1 모델 세 번 모두 빈 출력이어도 사용자에게 빈 말 0', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '그냥 요즘 좀 바빠요', scripted({ understand: [{ input_type: 'SMALL_TALK' }], speakOverride: EMPTY_SPEAK }).llm);
  assert.ok(visible(r).length > 0);
});

test('P0-2 · 불만 복구: 말하기가 계속 실패해도 일반 듣기 문장 0 · 사용자가 앞서 한 말을 짚는다', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '몇번째 같은말이야!!', scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: EMPTY_SPEAK }).llm);
  assert.equal(r.response.action, 'REPAIR');
  assert.ok(!LISTEN.includes(r.response.reply), '일반 듣기 문장 0');
  assert.match(r.response.reply, /친구처럼 편한 만남/, '앞서 한 말을 짚음');
  assert.match(r.response.recovery, /^COMPLAINT:server$/);
});
test('P0-2 · 불만 복구: 복구 호출에서 모델 후보가 검사를 통과하면 그 문장을 쓴다', async () => {
  const st = await begun();
  let n = 0;
  const r = await A.runTurn(st, '내가 적는거랑 상관없이 질문하네', scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: (input) => (input.recovery ? { reply: '앞에서 친구처럼 편한 만남이라고 한 말을 놓쳤어요.', question: '', purpose: '' } : (n++, EMPTY_SPEAK())) }).llm);
  assert.equal(r.response.reply, '앞에서 친구처럼 편한 만남이라고 한 말을 놓쳤어요.');
  assert.match(r.response.recovery, /^COMPLAINT:model$/);
});
test('P0-2 · 불만 받아주기 근거는 대화 전체(최근 3턴 밖의 앞선 말을 짚어도 지우지 않는다)', async () => {
  const st = await begun();
  for (const t of ['음 그렇네요', '글쎄요 잘 모르겠네요', '그냥 그래요']) await A.runTurn(st, t, scripted({ understand: [{ input_type: 'SMALL_TALK' }] }).llm);
  const r = await A.runTurn(st, '내 말은 안 듣네', scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: () => ({ reply: '친구처럼 편한 만남이라고 하셨는데 제가 놓쳤네요.', question: '', purpose: '' }) }).llm);
  assert.equal(r.response.reply, '친구처럼 편한 만남이라고 하셨는데 제가 놓쳤네요.');
  assert.equal(r.response.recovery, undefined);
});
test('P0-2 · 메타 복구: 일반 듣기 문장 0 · 서비스 사실로 답', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '고정질문으로 바뀐거니?', scripted({ understand: [{ input_type: 'META_QUESTION' }], speakOverride: EMPTY_SPEAK }).llm);
  assert.ok(!LISTEN.includes(r.response.reply));
  assert.match(r.response.reply, /정해진 질문 목록은 없/);
});
test('P0-2 · 질문만 문제였으면 질문 없이 받아주기만(복구 종류 기록)', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '약속 잘 지키는 사람이요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '약속', quote: '약속 잘 지키는 사람' }] }], speakOverride: () => ({ reply: '약속 잘 지키는 사람이군요.', question: '', purpose: '' }) }).llm);
  assert.equal(r.response.question, null);
  assert.equal(r.response.reply, '약속 잘 지키는 사람이군요.');
  assert.match(r.response.recovery, /^QUESTION_GENERATION_FAILURE:reply_only$/);
});

test('B · P0-7 불만을 모델이 답으로 읽어도(듣는 중) 관계 사실 저장 0 — run 33 FLOW1 「적었자네」', async () => {
  const st = await begun();
  await A.runTurn(st, '행동으로 보여줄때', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '행동', quote: '행동으로 보여줄때' }] }], speakOverride: () => ({ reply: '행동으로 보여 줄 때군요.', question: '', purpose: '' }) }).llm);
  assert.equal(st.current, null, '듣는 중');
  const r = await A.runTurn(st, '적었자네', scripted({ understand: [{ input_type: 'NORMAL_ANSWER' }] }).llm);
  assert.equal(r.response.saved, false);
  assert.ok(!active(st).includes('적었자네'));
});
test('B2 · P0-7 불만·메타로 이해된 말 전체를 덮는 인용은 사실 0 · 따로 있는 자기 이야기는 받는다', async () => {
  const st = await begun();
  const r1 = await A.runTurn(st, '내용이 이상하잖아', scripted({ understand: [{ input_type: 'COMPLAINT', extracted: [{ purpose: 'boundaries', note: '이상한 내용 싫음', quote: '내용이 이상하잖아' }] }] }).llm);
  assert.equal(r1.response.saved, false);
  assert.ok(!active(st).includes('내용이 이상하잖아'));
  const r2 = await A.runTurn(st, '질문이 뭐야? 나는 조용한 사람이 좋아', scripted({ understand: [{ input_type: 'META_QUESTION', extracted: [{ purpose: 'attraction_comfort', note: '조용한 사람', quote: '나는 조용한 사람이 좋아' }] }] }).llm);
  assert.equal(r2.response.saved, true);
  assert.ok(active(st).includes('나는 조용한 사람이 좋아'));
});

test('C · P0-4 「다음 질문으로 넘어가」는 끝내지 않는다(모델이 END_INTENT 로 읽어도) — run 33 F1', async () => {
  const st = await begun({ first: '친구같이 편한사람', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구 같은', quote: '친구같이 편한사람' }, { purpose: 'attraction_comfort', note: '편한 사람', quote: '친구같이 편한사람' }] } });
  await A.runTurn(st, '깉이 있을때 어색하지않는', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '어색하지 않음', quote: '깉이 있을때 어색하지않는' }, { purpose: 'boundaries', note: '어색함 싫음', quote: '깉이 있을때 어색하지않는' }] }] }).llm);
  assert.equal(st.phase, 'talk');
  for (const it of ['SKIP', 'END_INTENT']) {
    const s2 = structuredClone(st);
    const r = await A.runTurn(s2, '다음질문으로 넘어가 잘문이 너무 무겁다', scripted({ understand: [{ input_type: it }] }).llm);
    assert.equal(r.response.finish, false, `${it}: 끝내지 않음`);
    assert.equal(r.response.input_type, 'SKIP');
    assert.ok(['ASK_GAP', 'FOLLOW'].includes(r.response.action));
    assert.ok(visible(r).length > 0);
  }
});
test('P0-4 · 같은 인용이 두 목적에 겹쳐도 한 번만 센다 · 넘긴 목적은 세지 않는다', () => {
  const st = A.newState({ tone: 'polite' });
  const put = (id, q, t) => { st.slots[id].items.push({ note: q, quote: q, turn: t, source: 'answer', status: 'CONFIRMED' }); st.slots[id].status = 'CONFIRMED'; };
  put('relationship_intent', '친구같이 편한사람', 1); put('attraction_comfort', '친구같이 편한사람', 1); put('values_character', '어색하지않는', 2); put('boundaries', '어색하지않는', 2);
  st.slots.relationship_style.status = 'SKIPPED';
  assert.equal(A.coverage(st).confirmed, 2);
  assert.equal(A.enoughKnown(st), false);
});
test('D · P0-4 「여기까지만 할래」 → 바로 정리(새 질문 0)', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '여기까지만 할래', scripted({ understand: [{ input_type: 'END_INTENT' }] }).llm);
  assert.equal(r.response.finish, true);
  assert.equal(r.response.question, null);
});

// F7 반말 재현용: 대화를 마친 뒤 소개가 준비된 상태.
function doneState(lines, items) {
  const st = A.newState({ tone: 'casual' });
  let n = 0;
  for (const [id, q] of items) { n++; st.turns.push({ n, ai: null, question_purpose: null, question_type: null, user: q, kind: 'answer', saved: true }); st.slots[id].items.push({ note: q, quote: q, turn: n, source: 'answer', status: 'CONFIRMED', source_type: 'AI_EXTRACTED' }); st.slots[id].status = 'CONFIRMED'; }
  st.phase = 'done'; st.after_turns = 1; st.asked = [{ type: 'core', purpose: 'relationship_intent', text: A.FIRST_QUESTION }];
  st.intro = { status: 'ready', lines, dropped: {}, tries: 1, error: null, used: null, used_at: null };
  return st;
}
const F7_ITEMS = [['relationship_intent', '연애로 이어질 만남이면 좋겠어요'], ['attraction_comfort', '대화가 잘 통하는 사람'], ['values_character', '거짓말 안 하는 사람'], ['relationship_style', '매일 연락하는 게 좋아요'], ['boundaries', '담배는 싫어요']];
const F7_LINES = [{ text: '저는 연애로 이어질 만남이면 좋겠어요.', basis: '연애로 이어질 만남이면 좋겠어요' }, { text: '대화가 잘 통하는 사람을 좋아하고, 거짓말 안 하는 사람을 좋아해요.', basis: '대화가 잘 통하는 사람' }, { text: '담배는 싫고, 매일 연락하는 게 좋습니다.', basis: '담배는 싫어요' }];
function introLlm(base, { draft = null, rebuild = true } = {}) {
  return async (kind, sys, input) => {
    if (kind !== 'intro') return base(kind, sys, input);
    if (input.statements) return JSON.stringify({ lines: rebuild ? input.statements.map((x) => ({ id: x.id, text: /주말/.test(x.quote) ? '주말에 만나는 게 좋아요.' : /담배/.test(x.quote) ? '담배는 싫어요.' : `${x.quote.replace(/[.!~]$/, '')}이 좋아요.` })) : [] });
    return JSON.stringify({ intro: draft ?? [] });
  };
}

test('E · P0-5 최신 정정 → 소개에 최신 값 · 옛 값 0(run 33 F7 반말 「담배는 싫고, 매일 연락하는 게 좋습니다」)', async () => {
  const st = doneState(F7_LINES, F7_ITEMS);
  const base = scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말에 봄', quote: '주말에 보는 게 좋다' }] }] }).llm;
  await A.runTurn(st, '아니 내가 말한 건 매일 연락이 아니라 주말에 보는 게 좋다는 뜻이야', introLlm(base, { draft: F7_LINES }));
  const text = A.introText(st.intro);
  assert.equal(st.intro.status, 'ready');
  assert.ok(!/매일\s*연락하는/.test(text), `옛 값 0: ${text}`);
  assert.match(text, /주말/, '최신 정정 포함');
  assert.match(text, /연애로 이어질/, '다른 정상 문장 유지');
});
test('E2 · P0-5 같은 뜻을 다시 말해 앞 정정이 밀려도 지금 값 문장은 거절로 버리지 않는다(run 33 F6 빈 소개)', async () => {
  const st = doneState([{ text: '저는 연애로 이어질 만남이면 좋겠어요.', basis: '연애로 이어질 만남이면 좋겠어요' }], [['relationship_intent', '연애로 이어질 만남이면 좋겠어요'], ['relationship_style', '매일 연락하는 게 좋아요']]);
  const c1 = scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말에 한 번 보는 게 좋음', quote: '주말에 한 번 보는 게 좋아' }] }] }).llm;
  await A.runTurn(st, '아니 그게 아니라 주말에 한 번 보는 게 좋아', introLlm(c1, { draft: [{ text: '저는 연애로 이어질 만남이면 좋겠어요.', basis: '연애로 이어질 만남이면 좋겠어요' }, { text: '주말에 한 번 보는 게 좋아요.', basis: '주말에 한 번 보는 게 좋아' }] }));
  const c2 = scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말에 보는 게 좋음', quote: '주말에 보는 게 좋다' }], wrong: ['주말에 한 번 보는 게 좋음'] }] }).llm;
  await A.runTurn(st, '아니 내가 말한 건 매일 연락이 아니라 주말에 보는 게 좋다는 뜻이야', introLlm(c2, { draft: [{ text: '저는 연애로 이어질 만남이면 좋겠어요.', basis: '연애로 이어질 만남이면 좋겠어요' }, { text: '주말에 보는 게 좋아요.', basis: '주말에 보는 게 좋다' }] }));
  assert.equal(st.intro.status, 'ready');
  assert.match(A.introText(st.intro), /주말/);
  assert.ok(!/매일/.test(A.introText(st.intro)));
});
test('F · P0-5 소개 다시 쓰기가 비면 기존 정상 소개 유지(준비 → 실패 덮어쓰기 0)', async () => {
  const st = doneState(F7_LINES.slice(0, 2), F7_ITEMS.slice(0, 3));
  const base = scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'boundaries', note: '담배 싫음', quote: '담배는 좀 싫어요' }] }] }).llm;
  await A.runTurn(st, '담배는 좀 싫어요', introLlm(base, { draft: [], rebuild: false }));
  assert.equal(st.intro.status, 'ready');
  assert.match(A.introText(st.intro), /연애로 이어질/);
});
test('F2 · P0-5 반말 원문을 끝만 바꿔 그대로 옮긴 소개 문장은 버린다(원문 누출 0)', () => {
  const st = A.newState({ tone: 'casual' });
  st.turns.push({ n: 1, ai: null, question_purpose: null, question_type: null, user: '그냥 바빠서 못 만났어', kind: 'answer' });
  st.slots.relationship_style.items.push({ note: '그냥 바빠서 못 만났어', quote: '그냥 바빠서 못 만났어', turn: 1, source: 'answer_raw', status: 'CONFIRMED', source_type: 'USER_DIRECT' }); st.slots.relationship_style.status = 'CONFIRMED';
  const c = A.cleanIntro(st, [{ text: '그냥 바빠서 못 만났어요.', basis: '그냥 바빠서 못 만났어' }, { text: '요즘 바빠서 사람을 못 만났어요.', basis: '바빠서 못 만났어' }]);
  assert.deepEqual(c.lines.map((l) => l.text), ['요즘 바빠서 사람을 못 만났어요.']);
  assert.equal(c.dropped.raw_copy, 1);
});
test('P0-5 · 밀린 값만의 내용이 남은 문장은 다른 절에 「싫」이 있어도 버린다 · 정정 말에서 온 대비 문장은 남긴다', () => {
  const st = A.newState({ tone: 'polite' });
  st.turns.push({ n: 1, ai: null, question_purpose: null, question_type: null, user: '매일 연락하는 게 좋아요', kind: 'answer' }, { n: 2, ai: null, question_purpose: null, question_type: null, user: '아니 매일은 부담스럽고 주말에 한 번 보면 좋겠어', kind: 'correction' }, { n: 3, ai: null, question_purpose: null, question_type: null, user: '담배는 싫어요', kind: 'answer' });
  st.slots.relationship_style.items.push({ note: '매일 연락', quote: '매일 연락하는 게 좋아요', turn: 1, source: 'answer', status: 'SUPERSEDED' }, { note: '주말에 한 번', quote: '매일은 부담스럽고 주말에 한 번 보면 좋겠어', turn: 2, source: 'correction', status: 'CONFIRMED', source_type: 'USER_CORRECTED' });
  st.slots.boundaries.items.push({ note: '담배 싫음', quote: '담배는 싫어요', turn: 3, source: 'answer', status: 'CONFIRMED' });
  st.slots.relationship_style.status = 'CONFIRMED'; st.slots.boundaries.status = 'CONFIRMED';
  const c = A.cleanIntro(st, [{ text: '담배는 싫고, 매일 연락하는 게 좋습니다.', basis: '담배는 싫어요' }, { text: '매일은 부담스럽고 주말에 한 번 보면 좋겠어요.', basis: '매일은 부담스럽고 주말에 한 번 보면 좋겠어' }]);
  assert.deepEqual(c.lines.map((l) => l.text), ['매일은 부담스럽고 주말에 한 번 보면 좋겠어요.']);
});

test('G · P0-6 듣는 중(잡담 분류) 다음 직접 말 → 원문 보존(UNCONFIRMED) · 뒤에 인용되면 확인으로 올린다 — run 33 H_JOKE', async () => {
  const st = await begun();
  await A.runTurn(st, '농담이야 ㅎㅎ', scripted({ understand: [{ input_type: 'SMALL_TALK' }], speakOverride: () => ({ reply: '농담이었군요.', question: '', purpose: '' }) }).llm);
  const r = await A.runTurn(st, '편하게 대화 잘 되는 사람', scripted({ understand: [{ input_type: 'SMALL_TALK' }], speakOverride: () => ({ reply: '편하게 대화 잘 되는 사람이군요.', question: '', purpose: '' }) }).llm);
  assert.equal(r.response.raw_kept, true);
  const p = st.pending.find((x) => x.quote === '편하게 대화 잘 되는 사람');
  assert.equal(p.status, 'UNCONFIRMED');
  assert.ok(!active(st).includes('편하게 대화 잘 되는 사람'), '자동 확정 0');
  assert.ok(!JSON.stringify(A.matchingProfile(st).confirmed_preferences).includes('편하게 대화'), '매칭 0');
  let seenUnconfirmed = null;
  const u = scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'attraction_comfort', note: '대화 잘 되는 사람', quote: '편하게 대화 잘 되는 사람' }] }] }).llm;
  await A.runTurn(st, '응 그런 사람이 좋아', async (k, sys, input) => { if (sys.includes('이해 단계')) seenUnconfirmed = input.unconfirmed; return u(k, sys, input); });
  assert.ok(seenUnconfirmed.includes('편하게 대화 잘 되는 사람'), '이해 단계에 보존 원문 전달');
  assert.equal(p.status, 'PROMOTED');
  assert.ok(active(st).includes('편하게 대화 잘 되는 사람'));
});
test('G2 · P0-6 따라가기 질문(open)에 대한 답은 관계 사실로 바로 확정하지 않는다(보존만)', async () => {
  const st = await begun();
  await A.runTurn(st, '요즘 회사 개발 얘기만 해', scripted({ understand: [{ input_type: 'TOPIC_CHANGE' }], speakOverride: () => ({ reply: '', question: '그 프로젝트는 어떤 점이 제일 흥미로워요?', purpose: '' }) }).llm);
  assert.equal(st.current.type, 'open');
  const r = await A.runTurn(st, '배포 자동화가 재밌어요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER' }] }).llm);
  assert.equal(r.response.saved, false);
  assert.ok(!active(st).includes('배포 자동화가 재밌어요'));
  assert.ok(st.pending.some((x) => x.quote === '배포 자동화가 재밌어요'));
});

test('H · P0-3 질문을 reply 칸에 쓰면 서버가 살려 쓴다', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '약속 잘 지키는 사람이요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '약속', quote: '약속 잘 지키는 사람' }] }], speakOverride: (input) => ({ reply: '약속 잘 지키는 사람이군요. 주말에는 보통 어떻게 지내요?', question: '', purpose: input.gaps[0].purpose }) }).llm);
  assert.equal(r.response.question, '주말에는 보통 어떻게 지내요?');
  assert.equal(r.response.reply, '약속 잘 지키는 사람이군요.');
  assert.equal(r.response.action, 'ASK_GAP');
});
test('H2 · P0-3 살려 쓴 질문이 이미 한 질문이면 버린다(되풀이 0 · 받아주기는 남김)', async () => {
  const st = await begun();
  const prev = st.current.text;
  const r = await A.runTurn(st, '약속 잘 지키는 사람이요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '약속', quote: '약속 잘 지키는 사람' }] }], speakOverride: (input) => ({ reply: `약속 잘 지키는 사람이군요. ${prev}`, question: '', purpose: input.gaps[0].purpose }) }).llm);
  assert.notEqual(A.questionOverlap(r.response.question ?? '', prev) >= 0.6, true);
  assert.ok(r.response.reply.startsWith('약속 잘 지키는 사람이군요'));
});
test('H3 · v3.2 P0-A(v3.1 H3 대체): 받아주기에 질문이 둘이면 마지막 하나만 질문으로 · 받아주기에 질문 0 · 너무 짧은 되물음은 승격 0', () => {
  const r = A.salvageQuestion({ reply: '그렇군요. 뭐 좋아해요? 주말엔 뭐 해요?', question: '', purpose: '' });
  assert.equal(r.salvaged, true);
  assert.equal(r.spoken.question, '주말엔 뭐 해요?');
  assert.equal(r.spoken.reply, '그렇군요.');
  assert.equal(A.salvageQuestion({ reply: '그래요?', question: '', purpose: '' }).salvaged, false, '너무 짧은 되물음 0');
});
test('P0-4 · 물을 목적이 없어도 정보가 얇으면 끝내지 않고 더 듣는다 · 더 들은 턴에 새 사실이 없으면 그때 마친다 · 이미 들은 목적은 다시 묻지 않는다', async () => {
  const st = await begun({ first: '친구같이 편한사람', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구 같은', quote: '친구같이 편한사람' }, { purpose: 'attraction_comfort', note: '편한 사람', quote: '친구같이 편한사람' }, { purpose: 'values_character', note: '편함', quote: '친구같이 편한사람' }] } });
  const r1 = await A.runTurn(st, '깉이 있을때 어색하지않는', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_style', note: '어색하지 않음', quote: '깉이 있을때 어색하지않는' }, { purpose: 'boundaries', note: '어색함 싫음', quote: '깉이 있을때 어색하지않는' }] }] }).llm);
  assert.equal(A.openPurposes(st).length, 0, '물을 목적 없음');
  assert.equal(A.coverage(st).confirmed, 2);
  assert.equal(r1.response.finish, false, '정보가 얇아 끝내지 않음');
  assert.equal(r1.response.action, 'FOLLOW');
  assert.ok(!r1.response.question_type || r1.response.question_type === 'open', '목적 질문(core) 다시 묻기 0');
  const r2 = await A.runTurn(st, '음 그냥 그래요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER' }] }).llm);
  assert.equal(r2.response.finish, true, '더 들은 턴에 새 사실 0 → 마침');
});
test('P0-4 · 더 들은 턴에서 새 사실이 나오면 계속 · 서로 다른 인용 3개가 되면 마친다', async () => {
  const st = await begun({ first: '친구같이 편한사람', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구 같은', quote: '친구같이 편한사람' }, { purpose: 'attraction_comfort', note: '편한 사람', quote: '친구같이 편한사람' }, { purpose: 'values_character', note: '편함', quote: '친구같이 편한사람' }] } });
  await A.runTurn(st, '깉이 있을때 어색하지않는', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_style', note: '어색하지 않음', quote: '깉이 있을때 어색하지않는' }, { purpose: 'boundaries', note: '어색함 싫음', quote: '깉이 있을때 어색하지않는' }] }] }).llm);
  const r = await A.runTurn(st, '약속 잘 지키는 사람이면 좋겠어요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '약속', quote: '약속 잘 지키는 사람' }] }] }).llm);
  assert.equal(A.coverage(st).confirmed, 3);
  assert.equal(r.response.finish, true);
});

// ── v3.2 run 34 서버 결함 재현(대표 「v3.2 SERVER FINAL FIX」 P0-A~D). 모델 자리 = 대본(서버 규칙 확인 · 사람다움 판정 아님).
const acts = (r) => A.questionActs(r.response.reply ?? '') + (r.response.question ? 1 : 0);

test('P0-A1 · 받아주기에 물음표 없는 질문 + question → 사용자에게 질문 1개(run 34 F1 1턴)', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '친구같이 편한사람', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'attraction_comfort', note: '편한 사람', quote: '친구같이 편한사람' }] }], speakOverride: (input) => ({ reply: '친구처럼 편한 사람과 있으면 어떤 순간이 가장 좋으세요', question: '요즘 만남에서 특히 중요하게 생각하는 점은 뭐예요?', purpose: input.gaps[0].purpose }) }).llm);
  assert.equal(acts(r), 1);
  assert.equal(r.response.question, '요즘 만남에서 특히 중요하게 생각하는 점은 뭐예요?');
  assert.ok((r.response.reply ?? '') === '' || A.questionActs(r.response.reply) === 0);
});
test('P0-A2 · 간접 질문(「…는지 궁금해요」)도 질문으로 센다 · 받아주기의 다른 문장은 남긴다', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '매일 연락하는 게 좋아요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }] }], speakOverride: (input) => ({ reply: '매일 연락하는 걸 좋아하시는군요. 어떤 이야기를 주로 나누는지 궁금해요.', question: '연락할 때 주로 어떤 주제로 이야기하나요?', purpose: input.gaps[0].purpose }) }).llm);
  assert.equal(acts(r), 1);
  assert.equal(r.response.reply, '매일 연락하는 걸 좋아하시는군요.');
});
test('P0-A3 · question 칸 안에 질문이 둘(물음표 없음)이면 다시 청한다', async () => {
  const st = await begun();
  let n = 0;
  const r = await A.runTurn(st, '약속 잘 지키는 사람이요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '약속', quote: '약속 잘 지키는 사람' }] }], speakOverride: (input) => (n++ === 0 ? { reply: '약속이 중요하군요.', question: '어떤 약속을 자주 하나요. 약속을 어기면 어떤 기분이에요', purpose: input.gaps[0].purpose } : { reply: '약속이 중요하군요.', question: '주말엔 보통 뭐 하고 지내요?', purpose: input.gaps[0].purpose }) }).llm);
  assert.equal(r.response.question, '주말엔 보통 뭐 하고 지내요?');
  assert.equal(acts(r), 1);
});
test('P0-A4 · 질문이 받아주기에만 있으면(물음표 없음) 질문으로 살려 한 개만 · 빈 턴 0', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '대화가 잘 통하는 사람', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'attraction_comfort', note: '대화', quote: '대화가 잘 통하는 사람' }] }], speakOverride: (input) => ({ reply: '대화가 잘 통하는 사람이라면 어떤 점을 가장 먼저 보게 되나요', question: '', purpose: input.gaps[0].purpose }) }).llm);
  assert.equal(r.response.question, '대화가 잘 통하는 사람이라면 어떤 점을 가장 먼저 보게 되나요?');
  assert.equal(acts(r), 1);
});
test('P0-A5 · 끝난 뒤 받아주기 속 질문도 0(run 34 F5 「주말에는 주로 어떤 시간을 보내세요」)', async () => {
  const st = await begun(); st.phase = 'done'; st.current = null;
  const r = await A.runTurn(st, '담배는 싫어요', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'boundaries', note: '담배 싫음', quote: '담배는 싫어요' }] }], speakOverride: () => ({ reply: '담배는 싫다고 하셨네요. 평소에 담배 냄새가 나는 곳은 피하는 편이신가요', question: '', purpose: '' }) }).llm);
  assert.equal(r.response.question, null);
  assert.equal(A.questionActs(r.response.reply), 0);
  assert.equal(r.response.reply, '담배는 싫다고 하셨네요.');
});
test('P0-A6 · 사주·타로 다리 턴: 받아주기 속 질문을 빼고 다리 질문 하나만', async () => {
  const st = await begun({ seed: { source: 'TAROT', card: '달' } });
  const res = st.turns.at(-1);
  assert.ok(st.seed.asked, '다리 질문이 나감');
  assert.equal(A.questionActs(res.reply ?? ''), 0);
});

test('P0-B1 · 끝난 뒤 불만 → 수리(REPAIR) · 질문 0 · 일반 듣기 문장 0 · 사실 저장 0(run 34 F1 「느낌 근데 질문이 왜케 많아?」)', async () => {
  const st = await begun(); st.phase = 'done'; st.current = null;
  const r = await A.runTurn(st, '느낌 근데 질문이 왜케 많아?', scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: () => ({ reply: '질문이 많았죠. 이미 정리해 뒀으니 더 묻지 않을게요.', question: '', purpose: '' }) }).llm);
  assert.equal(r.response.action, 'REPAIR');
  assert.equal(r.response.question, null);
  assert.ok(!LISTEN.includes(r.response.reply));
  assert.equal(r.response.saved, false);
});
test('P0-B2 · 끝난 뒤 메타 물음 → 답하기(ANSWER_USER) · 질문 0', async () => {
  const st = await begun(); st.phase = 'done'; st.current = null;
  const r = await A.runTurn(st, '고정질문이었어?', scripted({ understand: [{ input_type: 'META_QUESTION' }], speakOverride: () => ({ reply: '정해진 질문 목록은 없었어요. 하신 말을 보고 이어 갔어요. 더 궁금한 게 있나요?', question: '', purpose: '' }) }).llm);
  assert.equal(r.response.action, 'ANSWER_USER');
  assert.equal(A.questionActs(r.response.reply), 0);
  assert.equal(r.response.question, null);
});
test('P0-B3 · 끝난 뒤 불만에 모델이 계속 실패해도 일반 듣기 문장 0 · 「이어 갈게요」 0', async () => {
  const st = await begun(); st.phase = 'done'; st.current = null;
  const r = await A.runTurn(st, '질문이 왜 이렇게 많아?', scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: EMPTY_SPEAK }).llm);
  assert.ok(!LISTEN.includes(r.response.reply));
  assert.ok(!/이어\s*갈/.test(r.response.reply));
  assert.match(r.response.reply, /더 묻지 않을게요/);
});

test('P0-C1 · 「질문이 너무 많아」 → 모델이 불만으로 읽어도 바로 정리(질문 강행 0 · run 34 F6 존댓말)', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '질문이 너무 많아', scripted({ understand: [{ input_type: 'COMPLAINT' }] }).llm);
  assert.equal(r.response.finish, true);
  assert.equal(r.response.input_type, 'END_INTENT');
  assert.equal(r.response.question, null);
});
test('P0-C2 · 멈춤·끝내기 계열은 모두 정리 — 여기까지만 · 나중에 할래 · 다른 거 볼래 · 이제 그만 물어봐 · 할 말 없어', async () => {
  for (const t of ['여기까지만 할래', '나중에 할래', '다른 거 볼래', '이제 그만 물어봐', '할 말 없어']) {
    const st = await begun();
    const r = await A.runTurn(st, t, scripted({ understand: [{ input_type: 'NORMAL_ANSWER' }] }).llm);
    assert.equal(r.response.finish, true, t);
  }
});
test('P0-C3 · 「다음 질문으로 넘어가」는 SKIP_CURRENT(모델이 END·불만으로 읽어도 대화 계속)', async () => {
  for (const it of ['END_INTENT', 'COMPLAINT', 'NORMAL_ANSWER']) {
    const st = await begun();
    const r = await A.runTurn(st, '다음 질문으로 넘어가', scripted({ understand: [{ input_type: it }] }).llm);
    assert.equal(r.response.finish, false, it); assert.equal(r.response.input_type, 'SKIP', it);
  }
});
test('P0-C4 · 질문 양 지적(「질문이 왜케 많아?」)은 COMPLAINT_ONLY — 답하고 그 턴 질문 0 · 끝내지 않음', async () => {
  const st = await begun();
  const r = await A.runTurn(st, '근데 질문이 왜케 많아?', scripted({ understand: [{ input_type: 'COMPLAINT' }], speakOverride: () => ({ reply: '질문이 많게 느껴졌군요. 편하게 하고 싶은 얘기만 해 주세요.', question: '그럼 요즘 어떤 만남이 좋아요?', purpose: '' }) }).llm);
  assert.equal(r.response.action, 'REPAIR');
  assert.equal(r.response.finish, false);
  assert.equal(r.response.question, null);
  assert.equal(acts(r), 0);
});
test('P0-C5 · 「딱히 없어요」·「이 질문 어렵네」는 멈춤이 아니다', async () => {
  const st = await begun();
  const r1 = await A.runTurn(st, '딱히 없어요', scripted({ understand: [{ input_type: 'UNSURE' }] }).llm);
  assert.equal(r1.response.finish, false);
  const r2 = await A.runTurn(st, '이 질문 어렵네', scripted({ understand: [{ input_type: 'HELP' }] }).llm);
  assert.equal(r2.response.finish, false);
});

test('P0-D1 · 바라는 상대를 「저는 그런 사람」으로 뒤집은 소개 문장은 버린다(run 34 F5 · F6 · T2 · T4)', () => {
  const st = A.newState({ tone: 'polite' });
  const add = (id, q, n) => { st.turns.push({ n, ai: null, question_purpose: null, question_type: null, user: q, kind: 'answer' }); st.slots[id].items.push({ note: q, quote: q, turn: n, source: 'answer', status: 'CONFIRMED' }); st.slots[id].status = 'CONFIRMED'; };
  add('values_character', '약속 잘 지키는 사람', 1); add('attraction_comfort', '성격 밝은 사람', 2); add('relationship_style', '나는 오히려 먼저 다가가는 편이야', 3);
  const c = A.cleanIntro(st, [
    { text: '저는 약속을 잘 지키는 사람입니다.', basis: '약속 잘 지키는 사람' },
    { text: '성격이 밝고 솔직한 편입니다.', basis: '성격 밝은 사람' },
    { text: '약속을 잘 지키는 사람이 좋아요.', basis: '약속 잘 지키는 사람' },
    { text: '저는 먼저 다가가는 편이에요.', basis: '나는 오히려 먼저 다가가는 편이야' },
  ]);
  assert.deepEqual(c.lines.map((l) => l.text), ['약속을 잘 지키는 사람이 좋아요.', '저는 먼저 다가가는 편이에요.']);
  assert.equal(c.dropped.role_reversal, 2);
});
test('P0-D2 · 마칠 때 모델 소개가 모두 뒤집혀 버려져도 빈 소개 0(확인된 말로 다시 만들기) · 뒤집힘 0', async () => {
  const st = await begun({ first: '약속 잘 지키는 사람이요', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '약속', quote: '약속 잘 지키는 사람' }] } });
  const llm = async (kind, sys, input) => {
    if (kind === 'closing') return JSON.stringify({ summary: [], closing: '이제 조금 알 것 같아요.', intro: [{ text: '저는 약속을 잘 지키는 사람입니다.', basis: '약속 잘 지키는 사람' }] });
    if (kind === 'intro' && input.statements) { assert.equal(input.statements[0].role, 'PARTNER_PREFERENCE'); return JSON.stringify({ lines: input.statements.map((x) => ({ id: x.id, text: '약속을 잘 지키는 사람이 좋아요.' })) }); }
    return scripted({ understand: [{ input_type: 'END_INTENT' }] }).llm(kind, sys, input);
  };
  const r = await A.runTurn(st, '여기까지만 할래', llm);
  assert.equal(r.response.finish, true);
  assert.equal(st.intro.status, 'ready');
  assert.ok(!st.intro.lines.some((l) => A.isSelfClaim(l.text)));
  assert.match(A.introText(st.intro), /약속을 잘 지키는 사람이 좋아요/);
});

// ── v3.3(대표 「FINAL IMPLEMENTATION MASTER」 PHASE 2·3) — 모델 자리 = 대본(서버 규칙만).
test('v3.3 ① 모델이 불만을 정정으로 읽어도 앞선 말 가리키기·새 뜻 없는 물음은 불만 — 사실 저장 0(run 34 FLOW1·FLOW3)', async () => {
  for (const [t, q] of [['나 진심이라고 적은거 같은데', '진심'], ['아니 같은 취미생활 너가 어떤 취미가 있냐고 나한테 물어봐야 하는 거 아니야?', '같은 취미생활']]) {
    const st = await begun();
    const r = await A.runTurn(st, t, scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'values_character', note: q, quote: q }] }] }).llm);
    assert.equal(r.response.saved, false, t);
    assert.ok(['ALREADY_ANSWERED', 'COMPLAINT'].includes(r.response.input_type), t);
    assert.equal(r.response.action, 'REPAIR', t);
    assert.ok(!active(st).some((x) => x.includes(q)), t);
  }
  const st = await begun();
  const r = await A.runTurn(st, '아니 매일은 부담스럽고 주말에 한 번 보면 좋겠어', scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말', quote: '주말에 한 번 보면 좋겠어' }] }] }).llm);
  assert.equal(r.response.input_type, 'CORRECTION', '새 뜻이 있는 진짜 정정은 그대로');
  assert.equal(r.response.saved, true);
});

test('v3.3 ② 화자 구분: 남의 말·인용은 사용자 사실 0 · 사용자 자신의 말은 저장', async () => {
  assert.deepEqual(A.speakerSpans("걔가 '싫어'라고 했어").map((x) => x.speaker), ['QUOTED', 'OTHER_PERSON']);
  assert.equal(A.speakerSpans('친구가 다정한 사람이 좋대')[0].speaker, 'OTHER_PERSON');
  assert.equal(A.speakerSpans('나는 다정한 사람이 좋아')[0].speaker, 'USER');
  assert.equal(A.speakerSpans('친구처럼 편한 사람이 좋아')[0].speaker, 'USER', '「친구처럼」은 주어가 아님');
  const cases = [["걔가 '연락 자주 하는 사람 싫어'라고 했어", '연락 자주 하는 사람 싫어'], ['친구가 다정한 사람이 좋대', '다정한 사람이 좋대']];
  for (const [t, q] of cases) {
    const st = await begun();
    const r = await A.runTurn(st, t, scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'boundaries', note: q, quote: q }] }] }).llm);
    assert.equal(r.response.saved, false, t);
    assert.ok(!active(st).includes(q), t);
  }
  const st = await begun();
  const r = await A.runTurn(st, '친구가 다정한 사람이 좋대. 나는 솔직한 사람이 좋아', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'attraction_comfort', note: '다정', quote: '다정한 사람이 좋대' }, { purpose: 'values_character', note: '솔직', quote: '솔직한 사람이 좋아' }] }] }).llm);
  assert.equal(r.response.saved, true);
  assert.ok(active(st).includes('솔직한 사람이 좋아'));
  assert.ok(!active(st).includes('다정한 사람이 좋대'), '같은 말 안의 남의 말은 빼고 자기 말만');
});

test('v3.3 ③ 근거 없는 바람: 자기 상태를 바람으로 바꾼 소개 문장은 버린다(「외롭진 않지」 → 「외롭지 않은 관계를 원해요」)', () => {
  const st = A.newState({ tone: 'polite' });
  const add = (id, q, n) => { st.turns.push({ n, ai: null, question_purpose: null, question_type: null, user: q, kind: 'answer' }); st.slots[id].items.push({ note: q, quote: q, turn: n, source: 'answer', status: 'CONFIRMED' }); st.slots[id].status = 'CONFIRMED'; };
  add('boundaries', '외롭진 않지', 1); add('relationship_style', '나는 사람 만나는 거 좋아해', 2);
  const c = A.cleanIntro(st, [
    { text: '저는 외롭지 않은 관계를 원해요.', basis: '외롭진 않지' },
    { text: '요즘 외롭지는 않아요.', basis: '외롭진 않지' },
    { text: '저는 사람 만나는 것을 좋아해요.', basis: '나는 사람 만나는 거 좋아해' },
  ]);
  assert.deepEqual(c.lines.map((l) => l.text), ['요즘 외롭지는 않아요.', '저는 사람 만나는 것을 좋아해요.']);
  assert.equal(c.dropped.unsupported_wish, 1);
});

test('v3.3 ④ 턴 처리 중 예기치 않은 오류 → 마지막 정상 상태로 복구 · RECOVERED(가짜 성공 0)', async () => {
  const st = await begun();
  st.slots.values_character.items = null; // 일부러 깨진 상태 → applyState 에서 예외
  const before = JSON.stringify(st);
  const r = await A.runTurn(st, '약속 잘 지키는 사람', scripted({ understand: [{ input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'values_character', note: '약속', quote: '약속 잘 지키는 사람' }] }] }).llm);
  assert.equal(r.response.error, 'RECOVERED');
  assert.equal(JSON.stringify(st), before, '상태는 턴 전과 같다');
  assert.ok(r.obs.notes.includes('state_restored'));
});

test('v3.3 ④ state_version · checkpoint · 지금 의도 · 정정 충돌 기록 · canonicalView 5가지 상태', async () => {
  const st = await begun({ first: '친구처럼 편한 만남이요 매일 연락하는 게 좋아요', firstU: { input_type: 'NORMAL_ANSWER', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구처럼 편한 만남' }, { purpose: 'relationship_style', note: '매일 연락', quote: '매일 연락하는 게 좋아요' }] } });
  assert.equal(st.state_version, 1);
  await A.runTurn(st, '아니 매일은 부담스럽고 주말에 한 번 보면 좋겠어', scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말에 한 번', quote: '주말에 한 번 보면 좋겠어' }] }] }).llm);
  await A.runTurn(st, '농담이야 ㅎㅎ 편하게 대화 잘 되는 사람', scripted({ understand: [{ input_type: 'SMALL_TALK' }] }).llm);
  assert.equal(st.state_version, 3);
  assert.deepEqual(st.current_user_intent.input_type, 'SMALL_TALK');
  assert.equal(st.conflicting_information.length, 1);
  assert.equal(st.conflicting_information[0].superseded, '매일 연락');
  const v = A.canonicalView(st);
  assert.ok(v.CONFIRMED.some((i) => i.note === '주말에 한 번'));
  assert.ok(v.SUPERSEDED.some((i) => i.note === '매일 연락'));
  assert.ok(v.UNKNOWN.length >= 1);
  assert.equal(v.last_confirmed_checkpoint.state_version, 3);
  assert.ok(Array.isArray(v.UNCONFIRMED) && Array.isArray(v.REJECTED));
  const err = await A.runTurn(st, '천천히요', scripted({ understand: ['PROVIDER_ERROR'] }).llm);
  assert.equal(err.response.error, 'PROVIDER');
  assert.equal(st.state_version, 3, '오류 턴은 판 번호를 올리지 않는다');
});

// ── v3.4(대표 「FINAL CORE LOCK」 §20 · PHASE 2) — 모델이 불만을 정정으로 읽어도 서버가 되돌린다(사실 저장 0 · 기존 확정 값 밀기 0).
// 근거 규칙(글자 패턴 추가가 아니라 구조): 정정 머리가 없는 정정은 「고칠 대상(wrong)이 지금 확정 값」일 때만 정정 · ECHO 에게 하는 말(주어 = 너/에코)은 사용자 사실이 아니다(화자·대상 구분).
test('v3.4 ① 머리 없는 「정정」인데 고칠 대상이 없으면 불만 — 저장 0 · 기존 값 유지', async () => {
  for (const [t, q] of [['대충 듣는 것 같네', '대충 듣는'], ['좀 딱딱하다 말투가', '딱딱하다'], ['재미없어 이 대화', '재미없어']]) {
    const st = await begun();
    const before = active(st);
    const r = await A.runTurn(st, t, scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_intent', note: q, quote: q }] }] }).llm);
    assert.equal(r.response.saved, false, t);
    assert.equal(r.response.input_type, 'COMPLAINT', t);
    assert.ok(!active(st).some((x) => x.includes(q)), t);
    assert.deepEqual(active(st), before, `${t}: 기존 확정 값이 밀리지 않는다`);
  }
});

test('v3.4 ② 정정 머리가 있어도 ECHO 에게 하는 말(「아니 너 왜 이렇게 딱딱해」)은 불만 — 원문 정정 저장 0', async () => {
  for (const t of ['아니 너 왜 이렇게 딱딱해', '아니 넌 내 얘기를 제대로 안 듣잖아', '그게 아니라 에코가 너무 길게 말해']) {
    const st = await begun();
    const before = active(st);
    const r = await A.runTurn(st, t, scripted({ understand: [{ input_type: 'CORRECTION', extracted: [] }] }).llm);
    assert.equal(r.response.saved, false, t);
    assert.deepEqual(active(st), before, t);
    assert.ok(!(st.corrections ?? []).includes(t), `${t}: 정정 목록 0`);
  }
});

test('v3.4 ③ 진짜 정정은 그대로 — 머리 있는 새 뜻 · 머리 없어도 고칠 대상(wrong)이 지금 값 · 나를 말하는 문장의 「너」는 막지 않음', async () => {
  let st = await begun();
  let r = await A.runTurn(st, '아니 매일은 부담스럽고 주말에 한 번 보면 좋겠어', scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'relationship_style', note: '주말', quote: '주말에 한 번 보면 좋겠어' }] }] }).llm);
  assert.equal(r.response.input_type, 'CORRECTION'); assert.equal(r.response.saved, true);
  st = await begun();
  const live = active(st)[0]; // 인용 「친구처럼 편한 만남」 · 뜻 정리(note) 「친구 같은 만남」
  r = await A.runTurn(st, '천천히 친구부터 알아가고 싶어', scripted({ understand: [{ input_type: 'CORRECTION', wrong: ['친구 같은 만남'], extracted: [{ purpose: 'relationship_intent', note: '친구부터 천천히', quote: '천천히 친구부터 알아가고 싶어' }] }] }).llm);
  assert.equal(r.response.input_type, 'CORRECTION', '고칠 대상이 지금 값이면 머리 없어도 정정');
  assert.equal(r.response.saved, true);
  assert.ok(!active(st).includes(live), '옛 값은 밀림(SUPERSEDED)');
  st = await begun();
  r = await A.runTurn(st, '아니 네가 말한 거 말고, 나는 조용한 사람이 좋아', scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'attraction_comfort', note: '조용한 사람', quote: '나는 조용한 사람이 좋아' }] }] }).llm);
  assert.equal(r.response.saved, true, '내 이야기(나는 …)가 있는 문장은 사용자 사실');
});

test('v3.4 ④ aboutEcho: ECHO 가 주어이고 내 이야기(나·저)가 없는 문장만', () => {
  for (const t of ['너 왜 이렇게 딱딱해', '넌 대충 듣는 것 같아', '에코가 너무 길게 말해', 'AI가 이상한 소리 해']) assert.equal(A.aboutEcho(t), true, t);
  for (const t of ['네가 말한 것처럼 난 조용한 사람이 좋아', '저는 조용한 사람이 좋아요', '너무 좋아요', '너그러운 사람이 좋아']) assert.equal(A.aboutEcho(t), false, t);
});

test('v3.4 ⑤ 머리 없어도 고쳐 말하는 모양이면 정정 그대로(모의 43판 F2·FLOW 회귀 방지)', async () => {
  for (const [t, q] of [['활동 말고 편하게 대화하는 사람을 원한다는 거예요', '편하게 대화하는 사람'], ['사실은 일보다 사람이 더 힘들어요', '사람이 더 힘들어요'], ['행동이라고!!', '행동'], ['연락 얘기였어. 연락은 자주 하는 게 좋아', '연락은 자주 하는 게 좋아']]) {
    const st = await begun();
    const r = await A.runTurn(st, t, scripted({ understand: [{ input_type: 'CORRECTION', extracted: [{ purpose: 'attraction_comfort', note: q, quote: q }] }] }).llm);
    assert.equal(r.response.input_type, 'CORRECTION', t);
    assert.equal(r.response.saved, true, t);
  }
});
