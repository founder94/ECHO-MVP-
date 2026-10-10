// 2026-10-01 대표 승인: 연결 흐름 주요 CTA = 흰 단색 + 깊은 청록 글씨(그라데이션·유리 0 · 과한 그림자 0 · 작은 누름). 범위는 연결 흐름만.
// 2026-10-10 대표 「모바일웹 = Flora」: 글씨 = Flora 잉크 #050b14(청록 → 거의 검은 남색) · 누름 = Flora 연두 #bbfc9e. 흰 단색·작은 누름은 그대로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/doit/components/feature/connect.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1].includes('.doit-product-action:not(.doit-product-action--secondary)'));
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

test('주요 CTA: 흰 단색 바탕 + Flora 잉크 글씨 · 대비 ≥ 7:1', () => {
  const base = rules.find((m) => /^\s*\.doit-app-pastel :is\(\.doit-connect,\.doit-match\) \.doit-product-action:not\(\.doit-product-action--secondary\)\s*$/.test(m[1]));
  assert.ok(base, '기본 규칙');
  assert.match(base[2], /background:#fff!important/);
  assert.match(base[2], /color:#050b14!important/);
  const ratio = (lum('#ffffff') + 0.05) / (lum('#050b14') + 0.05);
  assert.ok(ratio >= 7, `대비 ${ratio.toFixed(1)}`);
});

test('주요 CTA: 그라데이션·유리(흐림·반투명 판) 0 · 그림자 하나(아주 얕게) · 누름 0.99', () => {
  for (const [, , body] of rules) {
    assert.doesNotMatch(body, /gradient\(|backdrop-filter|rgb\(255 255 255\/\.[0-9]/);
    for (const [, a] of body.matchAll(/box-shadow:[^;]*rgb\([^/]+\/\.(\d+)\)/g)) assert.ok(Number(`0.${a}`) <= 0.12, '그림자 진함');
  }
  assert.ok(rules.some((m) => /:active/.test(m[1]) && /transform:scale\(\.99\)/.test(m[2]) && /background:#bbfc9e!important/.test(m[2])), '누름 = 0.99 + Flora 연두');
  // 누름 연두(#bbfc9e) 위 잉크 글씨도 7:1 이상
  assert.ok((lum('#bbfc9e') + 0.05) / (lum('#050b14') + 0.05) >= 7);
});

test('범위: 연결 흐름(.doit-connect · .doit-match)만 — 보조 버튼·다른 화면 버튼 규칙은 그대로', () => {
  for (const [, sel] of rules) assert.match(sel, /:is\(\.doit-connect,\.doit-match\)/);
  const ui = readFileSync('src/doit/components/feature/echo-ui.css', 'utf8');
  // 2026-10-04 대표 디자인 교체: 앱 전체 주요 버튼도 같은 흰 바탕 + 짙은 글자(토큰) — 연결 흐름 규칙과 같은 모양(2026-10-10 Flora 잉크)
  assert.match(ui, /\.doit-product-action:not\(\.doit-product-action--secondary\)[^{]*\{background:#fff!important;border:1px solid #fff!important;color:var\(--echo-cta-ink\)!important/, '앱 전체 주요 버튼 = 흰 바탕 + 짙은 글자');
  assert.match(ui, /--echo-cta-ink:#050b14;/);
});
