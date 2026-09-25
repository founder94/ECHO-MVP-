// UX 라이팅·글꼴 규칙 지키기 (2026-09-23, 대표 "폰트가 AI가 만든 느낌, 사람 냄새 나게, 글 품질 개선").
// 원칙 문서: docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_UX_WRITING_GUIDE_20260923.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
// 주석 줄은 빼고 화면에 나가는 코드만 본다.
const code = (p) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).join('\n');

const SCREENS = [
  'src/doit/pages/do-it/home/page.tsx',
  'src/doit/components/feature/CoreConversation.tsx',
  'src/doit/components/feature/ConversationOpening.tsx',
  'src/doit/pages/do-it/conversation/page.tsx',
  'src/doit/pages/do-it/start-journey/page.tsx',
  'src/doit/components/feature/InstallAppCard.tsx',
  'src/doit/components/feature/AsleepConnections.tsx',
];

test('기계 말투·없는 기능 약속이 핵심 화면에 남아 있지 않다', () => {
  const banned = ['AI의 이해', '찾기 시작해요', '재료예요', '이전 회차 이야기', '자격이 갖춰져요', '연결 준비 상태 보기', '사진·소개 준비하기', '내 소개와 사진 준비하기', '이 설명으로 저장하기', '대화는 내 계정에 저장돼요'];
  for (const file of SCREENS) {
    const c = code(file);
    for (const word of banned) assert.ok(!c.includes(word), `${file} 에 "${word}" 가 남아 있다`);
  }
});

test('화면에 쓰지 않는 단어가 없다', () => {
  for (const file of SCREENS) {
    const c = code(file);
    for (const word of ['데이팅', '소개팅', '궁합', '점술', '심리치료', '성격검사']) assert.ok(!c.includes(word), `${file}: ${word}`);
  }
});

test('대표가 정한 문장·버튼은 그대로다', () => {
  const opening = read('src/doit/components/feature/ConversationOpening.tsx');
  assert.match(opening, /어떤 만남을<br \/>원하세요\?/);
  assert.match(opening, /한 줄 더 적기/);
  assert.match(read('src/doit/components/feature/AsleepConnections.tsx'), /당신이 잠든 사이/);
  const conv = read('src/doit/components/feature/CoreConversation.tsx');
  for (const b of ['맞아요', '조금 달라요', '그게 아니에요', '직접 설명할게요']) assert.match(conv, new RegExp(`>${b}</button>`));
  assert.match(conv, /당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요\?/);
});

test('끝 화면·프로필·가입 안내가 연결에 대해 지금 사실만 말한다(2026-09-24 연결 v1 이후)', () => {
  // 전: "연결은 아직 열리지 않았고…"가 사실이었다. 연결 v1 이 운영에 열린 뒤로는 틀린 말이 됐다.
  const files = ['src/doit/components/feature/CoreConversation.tsx', 'src/doit/app/plan-a/screens/ProfileReview.tsx', 'src/doit/pages/do-it/profile/page.tsx',
    'src/doit/app/plan-a/screens/SignupConsent.tsx', 'src/doit/app/plan-a/screens/PurposeSelect.tsx'];
  for (const f of files) assert.doesNotMatch(read(f), /(사람 )?연결은 (아직 열리지 않았|준비 중)|사람 연결과 본인 인증은 아직|공간 준비 소식/, f);
  assert.match(read('src/doit/components/feature/CoreConversation.tsx'), /사진·소개·전화 인증까지 마치면 연결을 받을 수 있어요/);
});

test('연결 화면: 다섯 가지를 다 답했으면 「이어서 답하기」 대신 남은 것 · 「처음부터 다시 답하기」', () => {
  const a = read('src/doit/components/feature/AsleepConnections.tsx');
  assert.doesNotMatch(a, /to="\/doit\/conversation">질문에 이어서 답하기/, '다 답해도 뜨던 고정 버튼 제거');
  assert.match(a, /const firstLeft = rows\.find\(row => !row\.done\)/);
  assert.match(a, /\{answersDone && <Link className="doit-product-action doit-product-action--secondary" to="\/doit\/conversation\?restart=1">처음부터 다시 답하기/);
  assert.match(read('src/doit/pages/do-it/start-journey/page.tsx'), /onNext=\{\(\) => navigate\("\/doit\/connections"\)\}/, '프로필 확인 다음은 준비 중인 공간이 아니라 연결 준비');
});

test('글꼴 — 고운바탕(제목)·고운돋움(안내)을 앱 화면에만, 화면을 멈추지 않게 받는다', () => {
  const type = read('src/doit/components/feature/doit-type.css');
  assert.match(type, /"Gowun Batang"/);
  assert.match(type, /"Gowun Dodum"/);
  const body = type.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(body, /(^|[\s,}])(body|html|:root)\s*[{,]/);
  assert.doesNotMatch(body, /doit-brand-|doit-editorial|doit-landing/);
  for (const f of ['product-brand.css', 'core-conversation.css', 'install-app.css']) {
    assert.match(read(`src/doit/components/feature/${f}`), /^@import "\.\/doit-type\.css";/m, f);
  }
  const html = read('index.html');
  assert.match(html, /family=Gowun\+Batang:wght@400;700&family=Gowun\+Dodum[^"]*" rel="stylesheet" media="print" onload="this\.media='all'"/);
  // 구글 폰트가 막혀도 제품 화면이 멈추지 않도록, 화면 조각 스타일 안에서 글꼴을 @import 하지 않는다.
  assert.doesNotMatch(read('src/doit/doit.css'), /@import url\('https:\/\/fonts\.googleapis\.com/);
  // 한글 머리말 자간을 넓게 두지 않는다.
  assert.match(body, /\.echo-dialogue \.echo-eyebrow \{ letter-spacing: 0\.04em; \}/);
});

test('UX 라이팅 원칙 문서가 있다', () => {
  const doc = 'docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_UX_WRITING_GUIDE_20260923.md';
  assert.ok(existsSync(path.join(root, doc)));
  assert.match(read(doc), /옆 사람에게 말하듯 쓴다/);
});
