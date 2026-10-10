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
  // 2026-10-05 대표 「네가 고쳐!」: ref-parity 는 PR #138 담당으로 넘어옴 · 아래 탭 판 = 공통 유리 토큰(옅은 청록 30% 는 흰 글자 4.5:1 미달, Codex 4183198245)
  assert.match(rules, /\.doit-product-nav\{background:var\(--echo-glass\)!important/);
});

test('겹치는 파일 0: 대화·첫 질문·메뉴 파일은 PR #138 담당이라 이 PR 의 시안 작업에서 바꾸지 않음', () => {
  assert.doesNotMatch(src('src/doit/components/feature/AgentConversation.tsx'), /ref-parity|echo-goal-chip/);
  assert.doesNotMatch(src('src/doit/components/feature/ConversationOpening.tsx'), /ref-parity/);
  assert.match(src('src/components/app-back-button.css'), /\.doit-back-pill\{position:absolute;/, '뒤로 알약은 제목을 가리지 않게');
});

test('홈·무엇부터·프로필: Flora 민들레(예전 유리 리본 자리) · 가운데 제목 · 글은 그대로', () => {
  const home = src('src/doit/pages/do-it/home/page.tsx');
  // 2026-10-10 대표 「모바일웹 = Flora」: 유리 리본 그림 → Flora 민들레(FloraBloom). 자리·글은 그대로.
  assert.match(home, /<div className="echo-ref-hero echo-ref-hero--home" aria-hidden="true"><FloraBloom \/><\/div>/);
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

test('바탕(2026-10-10 대표 「모바일웹 = Flora」 · 예전 「이거면되?」 그림 대체): 그림 0 · 흐림 0 · 덮개 0 · Flora 땅색 한 색', () => {
  const bg = src('src/doit/components/feature/pastel-bg.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bg, /url\(|::after|::before|blur|animation/);
  assert.match(bg, /--pastel-underlay:#010b24;--echo-pastel-veil:0;/);
  assert.throws(() => readFileSync(new URL('../public/doit/bg/echo-mobile-bg.webp', import.meta.url)), '옛 시안 바탕 그림 파일 삭제');
});

test('대표 「키랑 다 같이」: 윗줄 KEY 알약 — 금빛 열쇠 + KEY · 숫자·잔액·차감 0 · 누르면 이용 안내 KEY', () => {
  const chip = src('src/doit/components/feature/KeyChip.tsx');
  assert.match(chip, /<KeyIcon size=\{20\} tone="gold" \/>/);
  assert.match(chip, /openGuide\('key', ref\.current\)/);
  assert.match(chip, /aria-label="KEY 안내 열기"/);
  assert.doesNotMatch(chip.replace(/\/\/.*$/gm, ''), /useKeyWallet|total|balance|deduct|remaining/);
  assert.match(src('src/doit/components/feature/TopBar.tsx'), /<KeyChip \/>/);
  const css = src('src/doit/components/feature/key-chip.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /min-height:44px/);
  assert.match(css, /-webkit-backdrop-filter:blur/);
  assert.match(src('src/doit/components/feature/KeyIcon.tsx'), /tone = 'silver'/, '기존 은색 열쇠 기본값 그대로');
});

test('Codex 5993217604 ①: 프로필 빈 사진 = 가운데 둥근 유리 자리(큰 사각 판 0) · 글·필요 사진 안내 그대로', () => {
  const css = src('src/doit/components/feature/ref-parity.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.doit-product-story \.doit-profile-photos-empty>svg\{[^}]*border-radius:50%/);
  assert.match(css, /\.doit-product-story \.doit-profile-photos-empty\{[^}]*background:transparent!important/);
  const g = src('src/doit/components/feature/ProfilePhotoGallery.tsx');
  assert.ok(g.includes('연결을 받으려면 전신·패션·취미 세 장이 필요해요.'), '필요 사진 안내 그대로');
  assert.ok(g.includes('지금의 나를 한 장씩 담아보세요.'));
});

test('Codex 4183640424 · 대표 「글은 완성」: 가입 안내·첫 질문 안내·보기 실패 안내는 QA 문구 그대로(사실과 다른 「전화 인증까지」 한 구절만 바로잡음)', () => {
  const sc = src('src/doit/app/plan-a/screens/SignupConsent.tsx');
  assert.ok(sc.includes('원하는 관계를 고르고, 다섯 가지 질문에 답하고, 사진과 소개를 준비해요.'));
  assert.ok(!sc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').includes('전화 인증까지 마치면'), '전화 인증은 연결 자격이 아님');
  assert.ok(src('src/doit/components/feature/ConversationOpening.tsx').includes('어떤 만남을 원하는지 들려주세요. 하나 고르고 한 줄 덧붙이면, 거기서부터 이야기할게요.'));
  // 보기 만들기 실패 가지(보기 0개)는 사실대로 — Codex echo-review 5994212141: 「편하게 고를 수 있게」는 보기가 없을 때 약속이 된다
  assert.ok(src('src/doit/components/feature/AgentConversation.tsx').includes('<p className="echo-rescue-lead">보기를 준비하지 못했어요. 직접 적거나 이번 질문을 넘길 수 있어요.</p>'));
});

// 2026-10-10 Flora: 바탕이 밝은 파스텔 그림 → 어두운 Flora 밤 들판으로 바뀌어 「가장 밝은 점」 기준을 다시 잡았다.
// 실측(390×844 · 소프트웨어 그래픽 · 6장면): 바탕 밝기 99.9% 지점 0.0197(흰 글자 15.07:1). 검사는 그보다 밝은 Flora 「mid」(#0a2a7a, 0.031)를 최악 경우로 쓴다.
test('Codex P2(4183198245): #131 모양 파일(brand-parity)의 판 = 흰 글자 4.5:1 이상(Flora 바탕 최악 경우 #0a2a7a 위) · 판은 Flora 유리(흰 6%)', () => {
  const css = src('src/doit/components/feature/brand-parity.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bg = [10, 42, 122];
  const fills = [...css.matchAll(/background:rgb\((\d+) (\d+) (\d+)\/(\.\d+)\)!important/g)].map((m) => [[+m[1], +m[2], +m[3]], +m[4]]);
  assert.match(css, /\.echo-prep \.echo-prep-panel\{background:rgb\(255 255 255\/\.06\)!important/, 'Flora 유리 판');
  assert.match(css, /\.echo-prep-panel :is\(input,textarea\)\{[^}]*background:rgb\(255 255 255\/\.10\)!important/, '판 안 입력 줄');
  assert.ok(fills.length >= 2);
  // 입력 줄은 판 위에 겹친다 — 판을 먼저 섞고 그 위에 입력 줄을 섞은 최악 경우까지 잰다
  const over = (base, [c, a]) => c.map((v, i) => v * a + base[i] * (1 - a));
  const panel = over(bg, fills.find(([, a]) => a === 0.06));
  for (const f of fills) for (const base of [bg, panel]) { const mix = over(base, f); const ratio = 1.05 / (L(mix) + 0.05); assert.ok(ratio >= 4.5, `rgb(${f[0]}/${f[1]}) = ${ratio.toFixed(2)}:1`); }
});

test('Codex 5993217604 ③: 프로필 준비 = 가운데 제목 · Flora 유리 판(4.5:1) · 얇은 유리 입력 줄 · 입력 항목·글 그대로', () => {
  const pb = src('src/doit/app/plan-a/screens/ProfileBuild.tsx');
  assert.match(pb, /className="echo-prep flex flex-col echo-min-h-svh"/); // 2026-10-10 기기 호환: 100vh → 100svh(100vh 폴백) · 모양 그대로
  assert.equal((pb.match(/echo-prep-panel/g) ?? []).length, 3);
  for (const t of ['이제, 실제 나를 보여줄', '닉네임 *', 'id="profile-intro"', '나를 소개할 정보를 입력해요']) assert.ok(pb.includes(t), t);
  const css = src('src/doit/components/feature/brand-parity.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Codex P2(4185618667): 시작 경로는 MobileLayout 을 거치지 않음 → 모양을 쓰는 화면(ProfileBuild · TopBar)이 직접 읽는다
  assert.match(pb, /import "@\/doit\/components\/feature\/brand-parity\.css";/);
  assert.match(src('src/doit/components/feature/TopBar.tsx'), /import "\.\/brand-parity\.css";/);
  assert.match(src('src/doit/pages/do-it/start-journey/page.tsx'), /ProfileBuild/);
  assert.match(css, /\.echo-prep \.echo-prep-head\{text-align:center\}/);
  assert.match(css, /\.echo-prep \.echo-prep-panel\{background:rgb\(255 255 255\/\.06\)!important/); // 2026-10-10 Flora 유리(예전 청록 70%)
});

test('대표 「DO IT = 회사 · ECHO = 모바일 웹」: 윗줄 = D 심볼 + ECHO 글자(DO IT 글자 0) · 화면 제목은 화면 읽기용', () => {
  const top = src('src/doit/components/feature/TopBar.tsx');
  assert.match(top, /<DoItSymbol decorative \/>\s*<span className="echo-wordmark[^"]*" aria-label="ECHO">ECHO<\/span>/);
  assert.doesNotMatch(top.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''), />\s*DO IT\s*</);
  assert.match(top, /\{title && <h1 className="echo-sr">\{title\}<\/h1>\}/);
});
