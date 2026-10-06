// 소개글 「AI가 대신 작성하기」 + 사진 다 안 채워도 넘어가기 (2026-09-23 대표 지시).
// 서버 쪽 판단(재료·거르기·200자)은 qa/server-conversation-flow.test.mjs 가 가짜 AI 로 돌린다. 여기서는 화면 쪽 약속을 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (p) => readFileSync(p, 'utf8');
const BUILD = 'src/doit/app/plan-a/screens/ProfileBuild.tsx';
const PHOTO = 'src/doit/app/plan-a/screens/PhotoCapture.tsx';
const JOURNEY = 'src/doit/pages/do-it/start-journey/page.tsx';

class UnderstandingError extends Error { constructor(code, message) { super(message); this.code = code; } }
function loadIntroDraft(agent = {}) {
  const out = ts.transpileModule(read('src/doit/lib/introDraft.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const stubs = { '@/doit/lib/coreConversation': { createCoreConversation: () => ({}) }, '@/doit/lib/understandingApi': { understandingRequest: () => null, UnderstandingError }, '@/doit/lib/withTimeout': { withTimeout: (p) => p },
    '@/doit/lib/agentApi': { agentGet: agent.get ?? (async () => null), agentIntro: agent.intro ?? (async () => { throw new Error('no'); }) } };
  vm.runInNewContext(out, { exports, require: (n) => { if (!(n in stubs)) throw new Error(`Unexpected dependency ${n}`); return stubs[n]; } });
  return exports;
}

test('초안 줄은 한 칸 소개로 이어 붙이고 200자를 넘기지 않는다', () => {
  const { draftToIntro, INTRO_MAX } = loadIntroDraft();
  assert.equal(INTRO_MAX, 200);
  assert.equal(draftToIntro([{ text: ' 저는 조용해요. ', basis: 'a' }, { text: '산책을 좋아해요.', basis: 'b' }]), '저는 조용해요. 산책을 좋아해요.');
  assert.equal(draftToIntro([{ text: '가'.repeat(150), basis: 'a' }, { text: '나'.repeat(150), basis: 'b' }]).length, 200);
  assert.equal(draftToIntro([{ text: '   ', basis: 'a' }]), '');
});

test('소개란 상한은 화면·도우미·서버가 같은 200자', () => {
  assert.match(read(BUILD), /maxLength=\{INTRO_MAX\}/);
  assert.match(read('supabase/functions/doit-understanding/index.ts'), /INTRO_MAX: 200,/);
});

test('「AI가 대신 작성하기」 버튼 — 빈 소개란은 바로 채우고, 이미 적은 글은 덮어쓰지 않는다', () => {
  const s = read(BUILD);
  assert.match(s, /"AI가 대신 작성하기"/);
  assert.match(s, /if \(intro\.trim\(\)\) \{ setDraftState\(\{ kind: "preview", text \}\); return; \}/, '적은 글이 있으면 미리보기만');
  assert.match(s, /이 글로 바꾸기/);
  assert.match(s, /지금 글 그대로 두기/);
  assert.match(s, /draftState\.kind === "busy" \|\| saving/, '쓰는 중·저장 중에는 버튼 잠금');
  assert.match(s, /if \(!onDraftIntro \|\| draftState\.kind === "busy"\) return;/, '연타 방지');
  assert.match(s, /내가 한 답과 맞다고 한 말로만 써요/);
});

test('답이 모자라면 빠져나갈 문(질문에 답하러 가기), 시간 초과·실패는 다시 누를 수 있다', () => {
  const s = read(BUILD);
  assert.match(s, /e\.code === "NOT_ENOUGH"/);
  assert.match(s, /질문에 답하러 가기/);
  assert.match(s, /e\.name === "TimeoutError"/);
  assert.match(s, /role="alert"/);
  const j = read(JOURNEY);
  // 2026-09-25 MASTER §4: 운영 앱(대화 에이전트 켜짐)은 그 대화의 초안을, 아니면 예전 경로를 쓴다.
  assert.match(j, /onDraftIntro=\{A_STRUCTURE_SERVER_ENABLED && user \? \(ECHO_AGENT_ENABLED\s*\? async \(\) => \{ const r = await requestAgentIntroDraft\(user\.id\); agentDraftRef\.current = r; return r\.text; \}\s*: \(\) => requestIntroDraft\(user\.id\)\) : undefined\}/);
  assert.match(j, /agentIntroMark\(user\.id, agentDraft\.sessionId, draft\.intro\.trim\(\) === agentDraft\.text\.trim\(\) \? "as_is" : "edited"\)/, '저장한 뒤 출처 기록(그대로/고침)');
  assert.match(j, /onGoAnswer=\{\(\) => navigate\("\/doit\/conversation\?from=journey"\)\}/);
  assert.doesNotMatch(j, /ECHO 대화로 돌아가기/, '앱 이름은 DO IT');
});

test('대화 화면의 소개 초안도 같은 규칙 — 다섯 가지를 다 답하면 보이고, 같은 방식으로 이어 붙인다', () => {
  const s = read('src/doit/components/feature/CoreConversation.tsx');
  // v15 다섯 가지를 다 답하면 통합 이해 카드를 먼저 정하고(맞아요·고치기·직접 설명), 그 뒤에 소개 초안을 보인다.
  assert.match(s, /const draftReady = !!onUseDraft && \(finished \? synth\.phase === 'done' : remembered\.length >= DRAFT_MIN_CONFIRMED\);/);
  assert.match(s, /onUseDraft\(draftToIntro\(draftLines\)\)/);
  assert.doesNotMatch(s, /맞다고 한 말로만 쓴 소개 초안/, '이제 재료에 내 답도 들어가니 문구가 사실과 맞아야 한다');
});

test('사진은 다 안 채워도 넘어간다 — 올리는 중에만 잠그고, 연결 자격 안내는 남긴다', () => {
  const s = read(PHOTO);
  const proceed = s.slice(s.indexOf('const canProceed ='), s.indexOf(';', s.indexOf('const canProceed =')));
  assert.doesNotMatch(proceed, /photoSetComplete|primarySlot/, '다 채웠는지로 막지 않는다');
  assert.match(proceed, /!uploading && !primaryBusy && !saveBusy/, '올리는 중·저장 중에는 넘어가지 않는다');
  assert.match(s, /\{photosComplete \? "프로필 확인하기" : "사진은 나중에 채우고 넘어가기"\}/);
  assert.match(s, /연결을 받으려면 필수 세 장과 대표 사진 한 장이 있어야 해요/);
  assert.doesNotMatch(s, /세 장은 꼭/);
  // 연결 자격 정의는 바뀌지 않았다
  assert.match(read('src/doit/lib/photoPolicy.ts'), /return PHOTO_REQUIRED_SLOTS\.every\(\(slot\) => filled\.has\(slot\)\) && photos\.some\(\(p\) => p\.isPrimary\);/);
  assert.match(read('supabase/functions/doit-understanding/index.ts'), /CONNECT_PHOTOS_NEEDED: 3,/);
});

test('운영 앱 「AI가 대신 작성하기」 = 대화 에이전트 초안: 마친 대화의 초안을 먼저 · 없으면 한 번 다시 쓰기 · 대화 전이면 빠져나갈 문(NOT_ENOUGH) · 못 쓰면 직접 쓰기 안내', async () => {
  const done = (intro) => ({ id: 's1', phase: 'done', intro });
  let calls = 0;
  let m = loadIntroDraft({ get: async () => done({ status: 'ready', text: '저는 편한 친구를 찾아요.' }), intro: async () => { calls++; return {}; } });
  assert.deepEqual({ ...(await m.requestAgentIntroDraft('u')) }, { text: '저는 편한 친구를 찾아요.', sessionId: 's1' }); assert.equal(calls, 0, '이미 쓴 초안이 있으면 AI 를 다시 부르지 않는다');
  m = loadIntroDraft({ get: async () => ({ id: 's1', phase: 'talk' }) });
  await assert.rejects(m.requestAgentIntroDraft('u'), (e) => e.code === 'NOT_ENOUGH');
  m = loadIntroDraft({ get: async () => null });
  await assert.rejects(m.requestAgentIntroDraft('u'), (e) => e.code === 'NOT_ENOUGH');
  m = loadIntroDraft({ get: async () => done({ status: 'none', text: '' }) });
  await assert.rejects(m.requestAgentIntroDraft('u'), (e) => e.code === 'NOT_ENOUGH');
  m = loadIntroDraft({ get: async () => done({ status: 'failed', text: '' }), intro: async () => { calls++; return { session: done({ status: 'ready', text: '저는 천천히 알아가요.' }) }; } });
  assert.equal((await m.requestAgentIntroDraft('u')).text, '저는 천천히 알아가요.'); assert.equal(calls, 1);
  m = loadIntroDraft({ get: async () => done({ status: 'failed', text: '' }), intro: async () => ({ session: done({ status: 'failed', text: '' }), limited: true }) });
  await assert.rejects(m.requestAgentIntroDraft('u'), (e) => e.code === 'AI_ERROR' && /직접 써도/.test(e.message));
});

test('대화 끝 화면 소개 카드: 이대로 사용·조금 고칠게요·직접 쓰기 · 출처 표시 · 덮어쓰기 알림 · 한 번에 할 일 하나', () => {
  const c = read('src/doit/components/feature/AgentIntroCard.tsx');
  for (const t of ['이대로 사용할게요', '조금 고칠게요', '직접 쓸게요', '직접 쓰기', 'AI가 대화에서 정리 · 확인 필요', 'AI가 대화에서 정리 · 내가 확인함', 'AI 초안을 내가 고침', '내가 직접 씀', '지금 있는 내 소개가 이 글로 바뀌어요.', '내가 고친 글이 가장 먼저예요.']) assert.ok(c.includes(t), t);
  assert.match(c, /saveIntroText\(userId, clean\)/, '저장은 내 소개 한 칸뿐');
  assert.match(c, /if \(err\) \{ setBusy\(null\); setError\(SAVE_ERROR\); return; \}/, '저장 실패면 적은 글이 남고 다시 누를 수 있다');
  assert.match(c, /intro\.status === 'failed' && intro\.tries_left > 0/, '다시 쓰기는 남은 횟수 안에서만');
  const a = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(a, /\{introChosen && <button className="echo-primary"/, '소개를 고른 뒤에만 사진이 주요 행동');
  assert.match(a, /소개는 나중에 · 사진 채우기/, '소개를 건너뛰는 빠져나갈 문');
});
