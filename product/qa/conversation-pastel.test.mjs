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
// 괄호 깊이를 세며 맨 바깥 쉼표에서만 나눈다(:is(… :not(…)) 안의 쉼표는 그대로)
const splitTop = (list) => { const out = []; let depth = 0, cur = ''; for (const ch of list) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const rules = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');

test('파스텔 규칙은 대화 경로 루트(.echo-dialogue--pastel) 아래로만 — 전역·다른 화면 0', () => {
  assert.ok(start > 0 && block.length > 500);
  let n = 0;
  for (const m of rules.matchAll(/([^{}]+)\{[^}]*\}/g)) for (const sel of splitTop(m[1])) {
    const s = sel.trim(); if (!s) continue; n++;
    assert.match(s, /^\.echo-dialogue\.echo-dialogue--pastel\b/, s);
  }
  assert.ok(n >= 8);
  for (const f of ['src/doit/components/feature/CoreConversation.tsx', 'src/doit/components/feature/ConversationOpening.tsx', 'src/doit/pages/do-it/conversation/page.tsx']) assert.match(read(f), /echo-dialogue echo-dialogue--pastel/, f);
  for (const f of ['src/doit/pages/do-it/start-journey/page.tsx', 'src/doit/app/plan-a/screens/SignupConsent.tsx', 'src/pages/do-it/landing/page.tsx', 'src/components/DoItBrandHero.tsx', 'src/index.css']) assert.doesNotMatch(read(f), /echo-dialogue--pastel/, f);
});

test('배경만: 바깥 사진·날씨·입자 0 · 글꼴·크기·배치 규칙 0 · 굵기는 500·600만', () => {
  assert.doesNotMatch(rules, /url\(|readdy|helloreaddy|weather|particle|parallax/i); // 설명 주석은 빼고 실제 규칙만
  assert.doesNotMatch(rules, /font-family|font-size|letter-spacing|line-height|margin|padding|width|height|grid-template|display:/);
  // 굵기는 대표 지시 「안내 글씨 굵기 한 단계」(2026-09-25)로 500·600만 허용 · 700/800 금지
  for (const [, w] of rules.matchAll(/font-weight:\s*([^;}]+)/g)) assert.match(w.trim(), /^(500|600)$/, `font-weight:${w}`);
  assert.match(block, /--echo-pastel-veil:0;/, '대표 결정: 캡처 색 그대로(덮개 0)');
});

test('움직임은 옛 float-bg 하나 · 움직임 줄이기면 멈춤', () => {
  assert.equal((block.match(/animation:float-bg 20s ease-in-out infinite/g) ?? []).length, 1);
  assert.match(block, /@media\(prefers-reduced-motion:reduce\)\{\.echo-dialogue\.echo-dialogue--pastel::before\{animation:none\}\}/);
  assert.match(read('src/index.css'), /@keyframes float-bg/);
});

test('글자색 = 대표 이미지 글씨색 #fff 하나로 통일(대표 2026-09-25 「그냥 이미지 글씨색 똑같이」): 남색 0 · 검은 그림자 0', () => {
  assert.doesNotMatch(rules, /#0c1526|--echo-pastel-ink/, '남색 글자 규칙은 없앴다');
  assert.match(block, /--conversation-text:#fff;/);
  for (const k of ['secondary', 'secondary-on-pastel', 'strong', 'eyebrow']) assert.match(block, new RegExp(`--conversation-text-${k}:#fff;`), k);
  assert.match(block, /--conversation-text-placeholder:rgb\(255 255 255\/\.7\);/, '입력창 안내 글씨만 흐리게');
  assert.match(block, /--conversation-text-halo:none;/, '1번 이미지 글자에는 그림자가 없다');
  assert.doesNotMatch(rules, /#dbe0e7|#f2f3f5|drop-shadow|rgb\(0 0 0/, '옛 회청색 글자·검은 그림자 값 0');
  const onPastel = [...rules.matchAll(/([^{}]+)\{[^}]*text-shadow:var\(--conversation-text-halo\)[^}]*\}/g)].map((m) => m[1]);
  assert.equal(onPastel.length, 3);
  for (const sel of onPastel) assert.match(sel, /:not\(:is\(\.echo-brief,\.echo-done,\.echo-synthesis,\.echo-restart,\.echo-pause,\.echo-insight,\.echo-editor,\.echo-opening-tile\) \*\)$/, '판 안 글자는 따로');
  assert.match(block, /textarea::placeholder\{color:var\(--conversation-text-placeholder\)\}/);
});

test('판 = 투명(대표 2026-09-25 「TRANSPARENT BUTTON / SURFACE PATCH」): 입력창·하단 카드·처음부터·목적 카드·안내/확인 카드·보내기 · 채움 0 · 흐림 0 · 테두리만', () => {
  assert.match(block, /--conversation-surface-bg:transparent;/);
  assert.match(block, /--conversation-surface-border:#d9dfe8a6;/);
  assert.doesNotMatch(rules, /--conversation-glass|rgb\(23 26 32|rgb\(34 38 46/, '어두운 유리 값 0');
  const surf = [...rules.matchAll(/([^{}]+)\{background:var\(--conversation-surface-bg\)[^}]*\}/g)].map((m) => m[1].trim());
  assert.equal(surf.length, 1, '판 규칙은 한 곳');
  for (const part of ['textarea', '.echo-secondary', '.echo-restart-pill', '.echo-opening-tile', '.echo-brief', '.echo-done', '.echo-synthesis', '.echo-restart', '.echo-pause', '.echo-insight', '.echo-editor', '.echo-reactions button:not(:first-child)']) assert.ok(surf[0].includes(part), part);
  assert.match(rules, /\.echo-dialogue\.echo-dialogue--pastel \.echo-composer-footer button\{background:transparent;border-color:var\(--conversation-surface-border\)\}/);
  assert.equal([...rules.matchAll(/backdrop-filter:blur/g)].length, 0, '흐림 0');
  assert.match(rules, /\.echo-opening-tile\.is-selected\{border-color:#fff;box-shadow:inset 0 0 0 1px #fff\}/, '선택 표시는 테두리로');
  // 원래 규칙(파스텔 밖)은 그대로
  assert.match(css, /\.echo-opening-tile\{[^}]*background:#171a20/);
  assert.match(css, /\.echo-dialogue textarea\{[^}]*background:#101216/);
});
