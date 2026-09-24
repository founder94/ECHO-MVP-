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

test('흰 글자(대표 2026-09-25): 남색 0 · 1순위 흰색 · 2순위 흰색 계열 · 파스텔 위 글자만 그림자', () => {
  assert.doesNotMatch(rules, /#0c1526|--echo-pastel-ink/, '남색 글자 규칙은 없앴다');
  assert.match(block, /--conversation-text:#fff;/);
  assert.match(block, /--conversation-text-secondary:#dbe0e7;/);
  assert.match(block, /--conversation-text-secondary-on-pastel:#f2f3f5;/);
  assert.match(block, /--conversation-text-halo:0 0 1px rgb\(0 0 0\/\.8\),0 0 3px rgb\(0 0 0\/\.7\),0 0 8px rgb\(0 0 0\/\.45\);/);
  const halo = [...rules.matchAll(/([^{}]+)\{[^}]*text-shadow:var\(--conversation-text-halo\)[^}]*\}/g)].map((m) => m[1]);
  assert.equal(halo.length, 2);
  for (const sel of halo) assert.match(sel, /:not\(:is\(\.echo-brief,\.echo-done,\.echo-synthesis,\.echo-restart,\.echo-pause,\.echo-insight,\.echo-editor,\.echo-opening-tile\) \*\)$/, '유리 안 글자에는 그림자 없음');
  assert.match(block, /textarea::placeholder\{color:var\(--conversation-text-secondary\)\}/);
});

test('어두운 판 = 하나의 유리 토큰: 입력창·하단 카드·처음부터·목적 카드·안내/확인 카드 · 투명도 .65 · 흐림 10px · 테두리 white/14', () => {
  assert.match(block, /--conversation-glass-alpha:\.65;/);
  assert.match(block, /--conversation-glass-bg:rgb\(23 26 32\/var\(--conversation-glass-alpha\)\);/);
  assert.match(block, /--conversation-glass-border:rgb\(255 255 255\/\.14\);/);
  assert.match(block, /--conversation-glass-blur:10px;/);
  const glassRules = [...rules.matchAll(/([^{}]+)\{[^}]*backdrop-filter:blur\(var\(--conversation-glass-blur\)\)[^}]*\}/g)].map((m) => m[1].trim());
  assert.equal(glassRules.length, 1, '유리 규칙은 한 곳');
  for (const part of ['textarea', '.echo-secondary', '.echo-restart-pill', '.echo-opening-tile', '.echo-brief', '.echo-done', '.echo-synthesis', '.echo-restart', '.echo-pause', '.echo-insight', '.echo-editor', '.echo-reactions button:not(:first-child)']) assert.ok(glassRules[0].includes(part), part);
  assert.doesNotMatch(glassRules[0], /echo-primary|echo-composer-footer/, '밝은 주요 버튼·보내기 버튼은 그대로');
  assert.equal([...rules.matchAll(/backdrop-filter:blur\((?!var)/g)].length, 0, '따로 노는 흐림 값 0');
  // 원래 규칙(파스텔 밖)은 그대로
  assert.match(css, /\.echo-opening-tile\{[^}]*background:#171a20/);
  assert.match(css, /\.echo-dialogue textarea\{[^}]*background:#101216/);
});
