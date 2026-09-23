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

function loadIntroDraft() {
  const out = ts.transpileModule(read('src/doit/lib/introDraft.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const stubs = { '@/doit/lib/coreConversation': { createCoreConversation: () => ({}) }, '@/doit/lib/understandingApi': { understandingRequest: () => null }, '@/doit/lib/withTimeout': { withTimeout: (p) => p } };
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
  assert.match(j, /onDraftIntro=\{A_STRUCTURE_SERVER_ENABLED && user \? \(\) => requestIntroDraft\(user\.id\) : undefined\}/);
  assert.match(j, /onGoAnswer=\{\(\) => navigate\("\/doit\/conversation\?from=journey"\)\}/);
  assert.doesNotMatch(j, /ECHO 대화로 돌아가기/, '앱 이름은 DO IT');
});

test('대화 화면의 소개 초안도 같은 규칙 — 다섯 가지를 다 답하면 보이고, 같은 방식으로 이어 붙인다', () => {
  const s = read('src/doit/components/feature/CoreConversation.tsx');
  assert.match(s, /const draftReady = !!onUseDraft && \(remembered\.length >= DRAFT_MIN_CONFIRMED \|\| finished\);/);
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
