// 2026-10-10 Codex 23차 검수 P2 두 건(PR #151) — 고친 자리가 다시 사라지지 않게 지킨다.
//  4236844168: 장면 일꾼(worker)이 준비되기 전에 받은 상태·재생·그리기·크기 메시지를 버리지 않고, 준비되면 마지막 것을 반영한다.
//  4236844170: 휴대폰 메뉴의 같은 페이지 이동이 주소의 #도 맞춘다(「홈」은 # 지움).
// 실제 브라우저 확인(로컬 Chromium · 390)은 PR 기록에 남긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('장면 일꾼: 준비 전 메시지는 종류마다 마지막 것을 모아 두고, 준비되면 크기→상태→재생→그리기 순으로 반영', () => {
  const w = read('src/vesper/views/home/scene/scene.worker.tsx');
  assert.match(w, /const early = new Map<SceneMessage\["type"\], SceneMessage>\(\);/);
  assert.match(w, /REPLAY_ORDER: SceneMessage\["type"\]\[\] = \["resize", "state", "run", "frame"\]/);
  assert.match(w, /if \(!store \|\| !root\) \{\s*early\.set\(message\.type, message\);\s*return;\s*\}\s*apply\(message\);/, '준비 전이면 버리지 않고 모은다');
  assert.doesNotMatch(w, /if \(!store \|\| !root\) return;\n\s*if \(message\.type === "state"\)/, '예전처럼 그냥 버리는 자리 0');
  const start = w.slice(w.indexOf('const start = async'), w.indexOf('const early ='));
  assert.ok(start.indexOf('store = root.render(') < start.indexOf('for (const type of REPLAY_ORDER)'), '장면을 만든 뒤에 반영');
  assert.match(start, /if \(queued\) apply\(queued\);[\s\S]*if \(early\.size\) drawOnce\(\);\s*early\.clear\(\);/, '반영 뒤 멈춤이면 한 장 · 비움');
});

test('휴대폰 메뉴: 같은 페이지 이동은 주소의 #을 맞춘다(Lenis 스크롤은 그대로)', () => {
  const n = read('src/vesper/components/common/mobile-nav.tsx');
  const same = n.slice(n.indexOf('if (hash && !element) return;'), n.indexOf('return () => cancelAnimationFrame(frame);'));
  assert.match(same, /const next = hash \? `\$\{base\}#\$\{hash\}` : base;/, '「홈」(# 없음)은 # 을 지운 주소');
  assert.match(same, /if \(`\$\{base\}\$\{window\.location\.hash\}` !== next\) window\.history\.pushState\(window\.history\.state, "", next\);/);
  assert.ok(same.indexOf('pushState') < same.indexOf('lenis.scrollTo(top'), '주소를 맞춘 뒤 스크롤');
  assert.match(same, /if \(lenis\) lenis\.scrollTo\(top, \{ duration: 1\.2 \}\);/);
});
