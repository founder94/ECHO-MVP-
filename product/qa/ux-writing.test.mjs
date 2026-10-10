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
  assert.match(opening, /같이 하고 싶은 일이<br \/>있나요\?/); // 2026-10-04 대표 디자인 교체 문구(서버 첫 질문 기록은 그대로)
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
  assert.match(a, /const firstLeft = rows\.find\(row => !row\.done && row\.label !== '전화 인증'\)/, '전화 인증은 다음 할 일로 내밀지 않는다(대표 2026-09-25 · 2026-09-27 P0-1 선택 항목)');
  // 2026-09-28 대표 「처음부터 다시 시작하기 UX」: 주소(?restart=1) 이동이 아니라 앱 공통 동작(새 회차 → 곧바로 ECHO 첫 대화)을 부른다.
  assert.match(a, /\{answersDone && <button type="button" className="doit-product-action doit-product-action--secondary" disabled=\{restarting\} onClick=\{\(\) => void restart\(\)\}>처음부터 다시 답하기/);
  assert.match(a, /useRestartConversation\(userId\)/);
  assert.doesNotMatch(a, /restart=1/);
  assert.match(read('src/doit/pages/do-it/start-journey/page.tsx'), /onNext=\{\(\) => navigate\("\/doit\/connections"\)\}/, '프로필 확인 다음은 준비 중인 공간이 아니라 연결 준비');
});

test('글꼴 — 2026-10-09 대표 승인: 앱 화면 글은 주아체(Jua) 하나(고운바탕·고운돋움 0), 화면을 멈추지 않게 저장소 안 파일로 받는다', () => {
  const type = read('src/doit/components/feature/doit-type.css');
  assert.match(type, /"Jua", "Pretendard"/);
  assert.doesNotMatch(type.replace(/\/\*[\s\S]*?\*\//g, ''), /Gowun|Noto Serif/);
  const body = type.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(body, /(^|[\s,}])(body|html|:root)\s*[{,]/);
  assert.doesNotMatch(body, /doit-brand-|doit-editorial|doit-landing/);
  for (const f of ['product-brand.css', 'core-conversation.css', 'install-app.css']) {
    assert.match(read(`src/doit/components/feature/${f}`), /^@import "\.\/doit-type\.css";/m, f);
  }
  const html = read('index.html');
  assert.doesNotMatch(html, /fonts\.googleapis\.com/, '구글 글꼴 링크 0 — 주아체는 src/fonts/jua.css(public/fonts/jua)');
  assert.match(read('src/index.css'), /@import '\.\/fonts\/jua\.css';/);
  // PR #149 보안 보강: 화면 안 직접 스크립트(onload 등) 0 — 아이콘 글꼴은 data-echo-deferred-font + /font-styles.js 로 뒤에서 받는다.
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  assert.match(html, /<script src="\/font-styles\.js" defer><\/script>/);
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
