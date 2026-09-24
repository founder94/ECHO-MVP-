// 대화 화면 파스텔 배경 + 목적 카드 유리 검사 (2026-09-24~25, 대표 「CONVERSATION BACKGROUND ONLY」 · 「CARD TRANSPARENCY PATCH」).
// 파일 규칙 검사다. 화면 대비·겹침은 브라우저 실측(docs/.../PATCH-20260924-conversation-pastel)에서 따로 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const css = read('src/doit/components/feature/core-conversation.css');
const start = css.indexOf('/* ── 2026-09-24 대화 화면 파스텔 배경');
const block = css.slice(start);
const rules = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');

test('파스텔 규칙은 대화 경로 루트(.echo-dialogue--pastel) 아래로만 — 전역·다른 화면 0', () => {
  assert.ok(start > 0 && block.length > 500);
  let n = 0;
  for (const m of rules.matchAll(/([^{}]+)\{[^}]*\}/g)) for (const sel of m[1].split(/,(?![^(]*\))/)) {
    const s = sel.trim(); if (!s) continue; n++;
    assert.match(s, /^\.echo-dialogue\.echo-dialogue--pastel\b/, s);
  }
  assert.ok(n >= 8);
  for (const f of ['src/doit/components/feature/CoreConversation.tsx', 'src/doit/components/feature/ConversationOpening.tsx', 'src/doit/pages/do-it/conversation/page.tsx']) assert.match(read(f), /echo-dialogue echo-dialogue--pastel/, f);
  for (const f of ['src/doit/pages/do-it/start-journey/page.tsx', 'src/doit/app/plan-a/screens/SignupConsent.tsx', 'src/pages/do-it/landing/page.tsx', 'src/components/DoItBrandHero.tsx', 'src/index.css']) assert.doesNotMatch(read(f), /echo-dialogue--pastel/, f);
});

test('배경만: 바깥 사진·날씨·입자 0 · 글꼴·크기·굵기·배치 규칙 0', () => {
  assert.doesNotMatch(rules, /url\(|readdy|helloreaddy|weather|particle|parallax/i); // 설명 주석은 빼고 실제 규칙만
  assert.doesNotMatch(rules, /font-family|font-size|font-weight|letter-spacing|line-height|margin|padding|width|height|grid-template|display:/);
  assert.match(block, /--echo-pastel-veil:0;/, '대표 결정: 캡처 색 그대로(덮개 0)');
});

test('움직임은 옛 float-bg 하나 · 움직임 줄이기면 멈춤', () => {
  assert.equal((block.match(/animation:float-bg 20s ease-in-out infinite/g) ?? []).length, 1);
  assert.match(block, /@media\(prefers-reduced-motion:reduce\)\{\.echo-dialogue\.echo-dialogue--pastel::before\{animation:none\}\}/);
  assert.match(read('src/index.css'), /@keyframes float-bg/);
});

test('글자 남색(대표 선택 D)은 배경 위 글자만 — 어두운 카드 안은 제외', () => {
  assert.match(block, /--echo-pastel-ink:#0c1526/);
  assert.match(block, /:not\(:is\(\.echo-brief,\.echo-done,\.echo-synthesis,\.echo-restart,\.echo-pause,\.echo-insight,\.echo-editor,\.echo-opening-tile\) \*\)/);
});

test('목적 카드 유리: 이 카드에만 · 투명도 .65 · 흐림 10px · 선택 테두리 유지', () => {
  assert.match(block, /\.echo-dialogue\.echo-dialogue--pastel \.echo-opening-tile\{background:rgb\(23 26 32\/\.65\);-webkit-backdrop-filter:blur\(10px\);backdrop-filter:blur\(10px\);border-color:rgb\(255 255 255\/\.14\)\}/);
  assert.match(block, /\.echo-dialogue\.echo-dialogue--pastel \.echo-opening-tile\.is-selected\{background:rgb\(34 38 46\/\.65\);border-color:#ffffff9c\}/);
  const glassRules = [...rules.matchAll(/([^{}]+)\{[^}]*backdrop-filter[^}]*\}/g)].map((m) => m[1].trim());
  assert.deepEqual(glassRules, ['.echo-dialogue.echo-dialogue--pastel .echo-opening-tile'], '흐림 유리는 목적 카드 하나뿐');
  // 원래 카드 규칙(다른 화면·파스텔 밖)은 그대로
  assert.match(css, /\.echo-opening-tile\{[^}]*background:#171a20/);
});
