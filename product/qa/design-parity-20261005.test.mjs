// 2026-10-05 대표 「ECHO · 실기기 디자인 불일치 긴급 수정」 — 홈·프로필·「무엇부터」·윗줄·아래 탭을 승인 시안처럼(소스 검사 · 실제 화면 수치는 qa-browser 비교판).
// 담당 경계: 대화·첫 질문·정정·메뉴(≡)·공통 판 색 = PR #138. 이 PR 은 그 파일을 건드리지 않는다. 글은 그대로(대표 「글은 완성」).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const rules = src('src/doit/components/feature/ref-parity.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('판 색: 짙은 회청색(30 42 48) 판 0 · 흐림은 -webkit- 와 짝', () => {
  assert.doesNotMatch(rules, /rgb\(30 42 48/);
  const blurs = (rules.match(/(?<!-webkit-)backdrop-filter:blur/g) ?? []).length;
  const webkit = (rules.match(/-webkit-backdrop-filter:blur/g) ?? []).length;
  assert.ok(blurs > 0 && webkit === blurs, `iPhone Safari 흐림 짝 ${webkit}/${blurs}`);
});

test('범위: 홈·프로필·무엇부터·윗줄·아래 탭만 — 대화·메뉴·공통 토큰(PR #138 담당) 0 · 전역 0', () => {
  for (const sel of rules.split('}').map((r) => r.split('{')[0].trim()).filter(Boolean)) {
    assert.match(sel, /^:root:root (\.doit-app-pastel|\.echo-dialogue\.echo-hub)/, sel);
    assert.doesNotMatch(sel, /\b(body|html)\b|echo-chat|echo-opening|echo-check|echo-corner|--echo-glass/, sel);
  }
  assert.doesNotMatch(rules, /--echo-glass\s*:/, '공통 판 색 토큰 0');
  assert.match(rules, /\.doit-product-topbar\{position:relative!important;background:transparent!important/);
  assert.match(rules, /\.doit-product-nav\{background:rgb\(18 84 92\/\.30\)!important/);
});

test('겹치는 파일 0: 대화·첫 질문·메뉴 파일은 PR #138 담당이라 이 PR 의 시안 작업에서 바꾸지 않음', () => {
  assert.doesNotMatch(src('src/doit/components/feature/AgentConversation.tsx'), /ref-parity|echo-goal-chip/);
  assert.doesNotMatch(src('src/doit/components/feature/ConversationOpening.tsx'), /ref-parity/);
  assert.match(src('src/components/app-back-button.css'), /\.doit-back-pill\{position:absolute;/, '뒤로 알약은 제목을 가리지 않게');
});

test('홈·무엇부터·프로필: 유리 리본 · 가운데 제목 · 글은 그대로', () => {
  const home = src('src/doit/pages/do-it/home/page.tsx');
  assert.match(home, /<div className="echo-ref-hero echo-ref-hero--home" aria-hidden="true"><img src="\/doit\/echo-ribbon\.webp" alt=""/);
  for (const t of ['DO IT · 만나기 전에', '잘못 알아들었으면 바로 고쳐 주세요.']) assert.ok(home.includes(t), t);
  const profile = src('src/doit/pages/do-it/profile/page.tsx');
  for (const t of ['MY OWN WORDS', 'DO IT · PROFILE', '연결 준비</span>', '내 프로필</h2>']) assert.ok(profile.includes(t), t);
  const journey = src('src/doit/pages/do-it/start-journey/page.tsx');
  assert.ok(journey.includes('<section className="echo-dialogue echo-dialogue--pastel echo-hub"><div className="echo-ref-hero echo-ref-hero--home"'));
  assert.ok(journey.includes('<p className="echo-eyebrow">무엇부터 할까요</p><h1>오늘은<br />무엇부터 할까요?</h1>'));
});

test('Codex PR #131 P2: 목적 고르기 화면의 질문·설명 글은 QA 그대로(대표 「글은 완성」)', () => {
  const ps = src('src/doit/app/plan-a/screens/PurposeSelect.tsx');
  assert.match(ps, /이번에는 어떤 관계를\n\s*<br \/>\n\s*만나고 싶나요\?/);
  assert.ok(ps.includes('지금 원하는 관계 하나를 골라주세요.'));
  assert.ok(ps.includes('선택한 목적은 프로필에 반영돼요. 같은 만남을 고른 사람끼리만 연결돼요.'));
  assert.doesNotMatch(ps, /같이 하고 싶은\n\s*<br \/>\n\s*일이 있나요/);
});
