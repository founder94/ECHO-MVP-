// 기억 영수증 · 「ECHO가 아는 나」(2026-10-06 대표 승인) — 가짜 AI(Mock) 기준 · 실제 AI 품질 판정 아님. 실행: node --test qa/memory-receipt-20261006.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'mem-'));
const emit = (src, out, fix = (x) => x) => { const f = path.join(dir, out); writeFileSync(f, fix(ts.transpileModule(readFileSync(new URL(src, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)); return pathToFileURL(f).href; };
const A = await import(emit('../supabase/functions/doit-agent/agent.ts', 'agent.mjs'));
const M = await import(emit('../supabase/functions/doit-connect/agentSource.ts', 'agentSource.mjs', (x) => x.replace('"../doit-agent/agent.ts"', '"./agent.mjs"')));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const X = (purpose, note, quote) => ({ purpose, note, quote });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '알겠어요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '친구랑 뭐 하면서 놀고 싶어요?' }, ...o });
const live = (st) => A.PURPOSES.flatMap((p) => st.slots[p.id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.note));

function base() {
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남')], inferred: [{ trait: '조용한 편', basis: '편한 만남' }] }));
  return st;
}

test('① 정정이 상태에 반영된 뒤에만 영수증(고정 문장 · AI 0): 「옛 뜻」이 아니라 「고친 내용」으로 기억할게요', () => {
  const st = base();
  const r1 = A.applyTurn(st, '매일 연락하는 게 좋아요', T({ extracted: [X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요')], next: { type: 'core', purpose: 'values_character', question: '친구 볼 때 뭘 먼저 봐요?' } }));
  assert.equal(r1.receipt, null, '보통 답에는 영수증 0');
  const r2 = A.applyTurn(st, '아니 그게 아니라 연락은 주말에만 하는 게 좋아', T({ kind: 'correction', extracted: [X('relationship_style', '주말에만 연락', '연락은 주말에만 하는 게 좋아')], wrong: ['매일 연락'], next: { type: 'core', purpose: 'boundaries', question: '주말에 만나면 뭐 하고 싶어요?' } }));
  assert.equal(r2.kind, 'correction');
  assert.equal(r2.receipt.line, '알겠어요. 「매일 연락」이 아니라 「주말에만 연락」으로 기억할게요.');
  assert.deepEqual([r2.receipt.before, r2.receipt.after], [['매일 연락'], ['주말에만 연락']]);
  assert.ok(!live(st).includes('매일 연락'), '옛 뜻은 지금 값에서 빠짐');
  // 다음 장면 증거: 정정 직후 다음 질문 한 번에 고친 내용 인용
  assert.equal(r2.cite, '「주말에만 연락」으로 알아들었어요.');
  assert.equal(st.current.cite, r2.cite);
  // 다음 보통 답의 질문에는 인용 0(한 번만)
  const r3 = A.applyTurn(st, '산책이요', T({ extracted: [X('boundaries', '산책', '산책이요')], next: { type: 'core', purpose: 'values_character', question: '산책하다 무슨 얘기가 제일 좋아요?' } }));
  assert.equal(r3.cite, null); assert.equal(r3.receipt, null);
  assert.equal(st.current.cite, undefined);
});

test('② 조사·빈 칸: 새 뜻만 / 옛 뜻만 / 둘 다 없음 → null · 도움 행동(모르겠다)에는 영수증 0', () => {
  assert.equal(A.makeReceipt([], ['산책']).line, '알겠어요. 「산책」으로 기억할게요.');
  assert.equal(A.makeReceipt([], ['조용한 카페']).line, '알겠어요. 「조용한 카페」로 기억할게요.');
  assert.equal(A.makeReceipt(['매일 연락'], []).line, '알겠어요. 「매일 연락」은 아니라고 기억할게요.');
  assert.equal(A.makeReceipt(['카페'], ['산책']).line, '알겠어요. 「카페」가 아니라 「산책」으로 기억할게요.');
  assert.equal(A.makeReceipt([], []), null);
  const st = base();
  const r = A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure', next: { type: 'core', purpose: 'values_character', question: '사람 볼 때 뭘 먼저 봐요?' } }));
  assert.equal(r.receipt, null);
});

test('③ 「ECHO가 아는 나」 네 칸: 확인 / AI 짐작(확정 아님) / 고친 것 / 아니라고 한 것 — 거절 원문은 보이되 지금 값(CONFIRMED)이 아니다', () => {
  const st = base();
  A.applyTurn(st, '매일 연락하는 게 좋아요', T({ extracted: [X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요')] }));
  A.applyTurn(st, '아니 그게 아니라 연락은 주말에만 하는 게 좋아', T({ kind: 'correction', extracted: [X('relationship_style', '주말에만 연락', '연락은 주말에만 하는 게 좋아')], wrong: ['매일 연락'] }));
  const k = A.knownView(st);
  assert.deepEqual(k.guesses.map((l) => l.text).sort(), ['조용한 편', '친구 같은 만남'].sort(), 'AI 정리·추측은 짐작 칸');
  assert.deepEqual(k.corrected.map((l) => l.text), ['주말에만 연락']);
  assert.deepEqual(k.corrected[0].from, ['매일 연락'], '무엇을 고쳤는지');
  assert.deepEqual(k.rejected.map((l) => l.text), ['매일 연락']);
  assert.equal(k.confirmed.length, 0, '사용자 직접·확인 값이 아직 없음');
  assert.ok(!A.matchingProfile(st).confirmed_preferences.includes('매일 연락'), '거절 원문은 매칭 지금 값이 아님');
  // 「맞아요」 → AI 정리가 사용자 확인으로
  assert.equal(A.confirmKnown(st), 1);
  const k2 = A.knownView(st);
  assert.deepEqual(k2.confirmed.map((l) => l.text), ['친구 같은 만남']);
  assert.ok(k2.confirmed_at);
  assert.equal(M.sourceFromProfile(A.matchingProfile(st), 'done', null).corrected[0], '주말에만 연락', '연결 서버 재료에도 고친 값 표시');
});

test('④ 줄 지우기: 지운 줄은 네 칸·이력·매칭에서 사라지고 AI 가 같은 뜻을 다시 만들지 않는다(재등장 0)', () => {
  const st = base();
  const k = A.knownView(st);
  const guess = k.guesses.find((l) => l.text === '친구 같은 만남');
  assert.equal(A.forgetKnown(st, guess.key), true);
  assert.equal(A.forgetKnown(st, guess.key), false, '두 번째는 못 찾음');
  assert.ok(!A.knownView(st).guesses.some((l) => l.text === '친구 같은 만남'));
  assert.equal(A.matchingProfile(st).relationship_intent.history.length, 0, '이력에도 0');
  assert.equal(st.slots.relationship_intent.status, 'UNKNOWN');
  // AI 가 같은 뜻을 다시 뽑아도 저장 0
  A.applyTurn(st, '편하게 보는 친구요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '편하게 보는 친구')] }));
  assert.ok(!live(st).includes('친구 같은 만남'), '지운 뜻 재등장 0');
  // 추측 지우기
  const inf = A.knownView(st).guesses.find((l) => l.origin === 'ai_guess');
  assert.equal(A.forgetKnown(st, inf.key), true); assert.equal(st.inferred.length, 0);
  assert.equal(A.knownView(st).forgotten, 2);
});

test('⑤ 민감 주제 표시 · 서버 응답·화면 계약(코드 검사)', () => {
  assert.equal(A.SENSITIVE_TOPIC.test('연봉은 높았으면'), true); assert.equal(A.SENSITIVE_TOPIC.test('산책 좋아함'), false);
  const idx = read('supabase/functions/doit-agent/index.ts');
  for (const a of ['agent_confirm', 'agent_forget', 'agent_self_note']) assert.ok(idx.includes(`"${a}"`), a);
  assert.match(idx, /receipt: \(response\.receipt/, '영수증은 상태 저장 뒤 턴 응답으로만');
  assert.match(idx, /known: knownWith\(st/, 'sessionView 에 네 칸');
  const check = read('src/doit/components/feature/AgentProfileCheck.tsx');
  assert.match(check, /r\.turn\.receipt\?\.line\) setReceipt/, '화면은 서버 영수증만 보임(먼저 만들지 않음)');
  assert.match(check, /agentConfirm\(userId, session\.id\)/, '맞아요 = 서버 확인');
  assert.doesNotMatch(check, /알겠어요\. 「/, '화면에 영수증 문장 하드코딩 0');
  const conv = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(conv, /r\.turn\.receipt\?\.line/, '자유 입력 정정도 같은 영수증 줄');
  const page = read('src/doit/pages/do-it/understanding/page.tsx');
  for (const t of ['내가 확인한 것', 'AI 짐작 · 확정 아님', '내가 고친 것', '아니라고 한 것', '지우기']) assert.ok(page.includes(t), t);
  assert.match(page, /agentForget\(userId, line\.key/);
  const connect = read('supabase/functions/doit-connect/index.ts');
  assert.match(connect, /고쳐 주신 대로 「\$\{t\}」/, '후보 이유 1줄');
  assert.match(connect, /me\?\.corrected \?\? \[\]/, '내 화면의 내 말에만(상대 노출 0)');
});

// ── 2026-10-06 독립 검수 반영(P1-1 · P2-1 · P2-2 · P2-5)
test('⑥ P1 지우기: 같은 말의 원문 복사본도 함께 FORGOTTEN — 확인 칸 재등장 0 · 매칭 재료 0', () => {
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  st.current = { type: 'core', purpose: 'relationship_style', text: '연락은 어떻게?' };
  A.applyTurn(st, '매일 연락하는 게 좋아요', T({ extracted: [X('relationship_style', '매일 연락 선호', '매일 연락하는 게 좋아요')] }));
  assert.ok(st.slots.relationship_style.items.some((i) => i.source_type === 'USER_DIRECT'), '전제: 원문 복사본이 함께 저장됨');
  const k = A.knownView(st); const line = k.guesses.find((l) => l.text === '매일 연락 선호');
  assert.ok(line, '화면에는 정리 한 줄'); assert.equal(k.confirmed.length, 0, '복사본은 숨김');
  assert.equal(A.forgetKnown(st, line.key), true);
  const k2 = A.knownView(st);
  assert.equal(k2.confirmed.length + k2.guesses.length, 0, JSON.stringify(k2.confirmed));
  assert.ok(st.slots.relationship_style.items.every((i) => i.status === 'FORGOTTEN'));
  assert.equal(M.sourceFromProfile(A.matchingProfile(st), 'done', null).confirmed.length, 0, '매칭 재료 0');
  assert.equal(st.slots.relationship_style.status, 'UNKNOWN');
});

test('⑦ P2 인용은 정정 직후 한 번만 — 다음 턴(모르겠다)의 질문에는 인용 0 · 영수증 없는 정정은 옛 영수증 재료 0', () => {
  const st = base();
  A.applyTurn(st, '매일 연락하는 게 좋아요', T({ extracted: [X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요')], next: { type: 'core', purpose: 'values_character', question: '친구 볼 때 뭘 먼저 봐요?' } }));
  const r = A.applyTurn(st, '아니 그게 아니라 주말에만 연락이 좋아', T({ kind: 'correction', extracted: [X('relationship_style', '주말에만 연락', '주말에만 연락이 좋아')], wrong: ['매일 연락'], next: { type: 'core', purpose: 'boundaries', question: '주말에 뭐 하고 싶어요?' } }));
  assert.ok(r.cite && st.current.cite);
  const r2 = A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure', next: { type: 'core', purpose: 'values_character', question: '친구한테 서운했던 적 있어요?' } }));
  assert.equal(r2.cite, null); assert.equal(st.current?.cite, undefined, '다음 질문에는 인용 0');
  assert.ok(!('user_corrected' in A.turnInput(st, '아무 말')), '정정 턴이 아니면 재료 0');
  // 영수증 없는 정정(바뀐 것 0)
  st.last_receipt = { line: 'x', before: [], after: ['옛것'], turn: 1 };
  A.applyTurn(st, '아니', T({ kind: 'correction', extracted: [], wrong: [] }));
  assert.equal(st.last_receipt, null); assert.ok(!('user_corrected' in A.turnInput(st, '다음')));
});

test('⑧ P2-5 해석 부정 판정: 물음이 든 말·보통 서술은 정정 아님', async () => {
  const R = await import(emit('../supabase/functions/doit-agent/reference-talk.ts', 'ref.mjs', (x) => x.replace('"./agent.ts"', '"./agent.mjs"')));
  assert.equal(R.denyInterpretation('나는 그런 사람 아닌데, 왜 그렇게 나와요?'), null);
  assert.equal(R.denyInterpretation('요즘 좀 달라요'), null);
  assert.equal(R.denyInterpretation('친구랑 저는 성격이 반대예요'), null);
  assert.deepEqual(R.denyInterpretation('나 그런 사람 아닌데, 저는 사람 많은 데를 좋아해요'), { text: '저는 사람 많은 데를 좋아해요' });
  assert.deepEqual(R.denyInterpretation('사람 많은 데 싫어하는 거 아닌데'), { text: '사람 많은 데 싫어하는 거 아닌데' });
});

test('⑨ 민감 주제(돈·건강·성) 정정의 영수증은 글자를 되풀이하지 않는 일반 문장 · 다음 질문 인용 0', () => {
  const st = base();
  A.applyTurn(st, '연봉 높은 사람이 좋아요', T({ extracted: [X('values_character', '연봉 높은 사람', '연봉 높은 사람이 좋아요')], next: { type: 'core', purpose: 'relationship_style', question: '연락은 어떻게 하고 싶어요?' } }));
  const r = A.applyTurn(st, '아니 연봉이 아니라 월급보다 성실함이 중요해요', T({ kind: 'correction', extracted: [X('values_character', '월급보다 성실함', '월급보다 성실함이 중요해요')], wrong: ['연봉 높은 사람'], next: { type: 'core', purpose: 'boundaries', question: '싫은 건 뭐예요?' } }));
  assert.ok(r.receipt, '정정 저장 뒤 영수증은 있다');
  assert.equal(r.receipt.line, '알겠어요. 고친 내용으로 기억할게요.');
  assert.doesNotMatch(r.receipt.line, /연봉|월급/, '민감 글자 되풀이 0');
  assert.equal(r.cite ?? null, null, '다음 질문 인용 0'); assert.equal(st.current?.cite, undefined);
  assert.equal(A.makeReceipt(['매일 연락'], ['주말 연락']).line, '알겠어요. 「매일 연락」이 아니라 「주말 연락」으로 기억할게요.', '보통 주제는 그대로');
});
