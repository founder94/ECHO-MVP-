// 2026-10-05 대표 「ECHO · 실기기 디자인 불일치 긴급 수정」 — 승인 시안과 같은 제품처럼 보이게 하는 규칙(소스 검사 · 실제 화면 수치는 qa-browser 비교판).
// 범위: 화면·문구만. 서버 계약·질문 로직·정정 4종 의미·매칭 규칙은 건드리지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const css = src('src/doit/components/feature/ref-parity.css');
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('판 색: 짙은 회청색(30 42 48) 판을 시안의 청록 유리로 — 흐림은 -webkit- 와 함께', () => {
  assert.doesNotMatch(rules, /rgb\(30 42 48/, '회청색 판 0');
  assert.match(rules, /--echo-glass:rgb\(16 78 86\/\.30\)/);
  const blurs = (rules.match(/backdrop-filter:var\(--echo-glass-blur\)/g) ?? []).length;
  const webkit = (rules.match(/-webkit-backdrop-filter:var\(--echo-glass-blur\)/g) ?? []).length;
  assert.ok(blurs > 0 && webkit * 2 === blurs, `iPhone Safari 흐림(-webkit-) 짝 ${webkit}/${blurs / 2}`);
});

test('범위: 파스텔 사용자 화면 루트 안쪽만(body·html·:root 값 0)', () => {
  for (const sel of rules.split('}').map((r) => r.split('{')[0].trim()).filter(Boolean)) {
    if (sel.startsWith('@')) continue;
    assert.match(sel, /^:root:root (?::is\(\.doit-app-pastel|\.doit-app-pastel|\.echo-dialogue|\.echo-chat)/, sel);
    assert.doesNotMatch(sel, /\b(body|html)\b/, sel);
  }
});

test('윗줄 짙은 띠 0 · 메뉴(≡)·뒤로 알약은 화면 위에 따로 떠 있지 않음(글·말풍선 겹침 0)', () => {
  assert.match(rules, /\.doit-product-topbar\{position:relative!important;background:transparent!important/);
  assert.match(src('src/components/app-corner-menu.css'), /\.echo-corner-button\{position:absolute;/);
  assert.match(src('src/components/app-back-button.css'), /\.doit-back-pill\{position:absolute;/);
  assert.match(rules, /\.doit-product-nav\{background:rgb\(18 84 92\/\.30\)!important/, '아래 탭 검정 판 0');
});

test('홈·무엇부터·프로필: 유리 리본 · 가운데 제목 · 작은 영문/머리글 0 · 안내 줄 축소', () => {
  const home = src('src/doit/pages/do-it/home/page.tsx');
  assert.match(home, /<div className="echo-ref-hero echo-ref-hero--home" aria-hidden="true"><img src="\/doit\/echo-ribbon\.webp" alt=""/);
  assert.doesNotMatch(home, /DO IT · 만나기 전에|잘못 알아들었으면 바로 고쳐 주세요/);
  const profile = src('src/doit/pages/do-it/profile/page.tsx');
  assert.doesNotMatch(profile, /MY OWN WORDS|DO IT · PROFILE|연결 준비<\/span>/);
  assert.match(profile, /<div className="doit-product-head">\n\s*<h2 className="doit-product-title">내 프로필<\/h2>/);
  const journey = src('src/doit/pages/do-it/start-journey/page.tsx');
  assert.match(journey, /echo-dialogue echo-dialogue--pastel echo-hub"><div className="echo-ref-hero echo-ref-hero--home"/);
});

test('대화 시작: 목적은 칩, 제목은 한 문장(「…원해요 편하게…」로 붙지 않음)', () => {
  const ui = src('src/doit/components/feature/AgentConversation.tsx');
  assert.doesNotMatch(ui, /purposeLabel\}<br \/>편하게 몇 가지만/);
  assert.match(ui, /<p className="echo-goal-chip">\{session\?\.goal_label \?\? purposeLabel\}<\/p>\}\n\s*<h1>편하게 몇 가지만<br \/>물어볼게요\.<\/h1>/);
});

test('정정 4종: 버튼 문구·순서 그대로(색만 — 맞아요 흰 판 · 나머지 청록 유리)', () => {
  assert.match(rules, /\.echo-check>\.echo-done-actions \.echo-secondary\{background:var\(--echo-glass-deep\)!important/);
  assert.doesNotMatch(rules, /content:"(맞아요|조금 달라요|그게 아니에요|직접 설명할게요)"/);
});
