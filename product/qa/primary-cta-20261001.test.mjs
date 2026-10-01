// 2026-10-01 대표 승인: 연결 흐름 주요 CTA = 흰 단색 + 깊은 청록 글씨(그라데이션·유리 0 · 과한 그림자 0 · 작은 누름). 범위는 연결 흐름만.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/doit/components/feature/connect.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1].includes('.doit-product-action:not(.doit-product-action--secondary)'));
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

test('주요 CTA: 흰 단색 바탕 + 깊은 청록 글씨 · 대비 ≥ 7:1', () => {
  const base = rules.find((m) => /^\s*\.doit-app-pastel :is\(\.doit-connect,\.doit-match\) \.doit-product-action:not\(\.doit-product-action--secondary\)\s*$/.test(m[1]));
  assert.ok(base, '기본 규칙');
  assert.match(base[2], /background:#fff!important/);
  assert.match(base[2], /color:#0f4a4a!important/);
  const ratio = (lum('#ffffff') + 0.05) / (lum('#0f4a4a') + 0.05);
  assert.ok(ratio >= 7, `대비 ${ratio.toFixed(1)}`);
});

test('주요 CTA: 그라데이션·유리(흐림·반투명 판) 0 · 그림자 하나(아주 얕게) · 누름 0.99', () => {
  for (const [, , body] of rules) {
    assert.doesNotMatch(body, /gradient\(|backdrop-filter|rgb\(255 255 255\/\.[0-9]/);
    for (const [, a] of body.matchAll(/box-shadow:[^;]*rgb\([^/]+\/\.(\d+)\)/g)) assert.ok(Number(`0.${a}`) <= 0.12, '그림자 진함');
  }
  assert.ok(rules.some((m) => /:active/.test(m[1]) && /transform:scale\(\.99\)/.test(m[2])));
});

test('범위: 연결 흐름(.doit-connect · .doit-match)만 — 보조 버튼·다른 화면 버튼 규칙은 그대로', () => {
  for (const [, sel] of rules) assert.match(sel, /:is\(\.doit-connect,\.doit-match\)/);
  const ui = readFileSync('src/doit/components/feature/echo-ui.css', 'utf8');
  assert.match(ui, /\.doit-product-action:not\(\.doit-product-action--secondary\)[^{]*\{background:var\(--echo-glass-strong\)!important;border:1px solid #fff!important;color:#fff!important/, '앱 전체 버튼 3단계는 그대로');
});
