// 2026-10-08 대표 「홈페이지 = 회사 얼굴 · GetLayers 구매(Vesper·Solaris·Einstein–Rosen) · 3D·600KB 허용 · 모바일도 같은 계열 · 틀(Vite+React) 유지 · 갈아끼우는 구조 · 온보딩 유지」
// 3D 그림층(layers/)의 소스 규칙 검사(모의 · 실제 WebGL 렌더·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const read = (f) => readFileSync(f, 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const DIR = 'src/pages/do-it/brand-home/layers';
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const HCSS = read('src/pages/do-it/brand-home/brand-home.css');
const REG = read(`${DIR}/registry.ts`);
const GATE = read(`${DIR}/gate.ts`);
const HOST = read(`${DIR}/SceneHost.tsx`);
const INPUTS = read(`${DIR}/shared/inputs.ts`);
const SCENES = ['vesper/VesperHero.tsx', 'solaris/SolarisHero.tsx', 'lattice/LatticeScene.tsx'].map((f) => [f, read(`${DIR}/${f}`)]);
const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('갈아끼우는 구조: 고정층(page.tsx)은 three.js 를 모른다 · 자리(hero·making)마다 registry 한 곳에서 동적 import · 호스트는 별 뒤·지구/영상 앞', () => {
  assert.doesNotMatch(noComments(HOME), /from ['"](three|@react-three)/, 'page.tsx 에 three 정적 import 0');
  assert.match(HOME, /import SceneHost from '\.\/layers\/SceneHost';/);
  const hero = HOME.slice(HOME.indexOf('className="bh-sec bh-hero"'), HOME.indexOf('id="bh-story"'));
  assert.ok(hero.indexOf('<div className="bh-stars"') < hero.indexOf('<SceneHost slot="hero" />') && hero.indexOf('<SceneHost slot="hero" />') < hero.indexOf('<img className="bh-earth"'), '첫 화면: 별 → 층 → 지구');
  const making = HOME.slice(HOME.indexOf('id="bh-making"'), HOME.indexOf('id="bh-install"'));
  assert.ok(making.indexOf('<div className="bh-stars"') < making.indexOf('<SceneHost slot="making" />') && making.indexOf('<SceneHost slot="making" />') < making.indexOf('<BrandFilm />'), '제작 과정: 별 → 층 → 영상');
  assert.equal((HOME.match(/<SceneHost slot=/g) ?? []).length, 2, '자리 2곳(첫 화면·제작 과정) · 이야기·설치 사진 화면은 그대로');
  assert.match(REG, /hero: \{ id: '(none|vesper|solaris)', loaders: \{ vesper: \(\) => import\('\.\/vesper\/VesperHero'\), solaris: \(\) => import\('\.\/solaris\/SolarisHero'\) \} \}/);
  assert.match(REG, /making: \{ id: '(none|lattice)', loaders: \{ lattice: \(\) => import\('\.\/lattice\/LatticeScene'\) \} \}/);
  assert.match(REG, /previewParam: 'scene_'/, '미리보기 전환 ?scene_hero=solaris');
  assert.match(HOST, /whenIdleAfterLoad\(/, '첫 그림(지구·워드마크) 뒤 한가할 때');
  assert.match(GATE, /document\.readyState === 'complete'/);
  // 온보딩(인트로 입자 D)은 그대로 — 층은 홈페이지 섹션 안에만.
  assert.doesNotMatch(read('src/router/config.tsx'), /layers\//);
  for (const f of walk(DIR)) assert.doesNotMatch(noComments(read(f)), /<a |<button|appUrl\(|START_PATH|intro\/page/, `${f}: 층에 링크·버튼·인트로 수정 0`);
});

test('문지기: 움직임 줄이기·절약 모드·2GB 이하·WebGL 없음이면 안 켬 · 보는 중 바뀌면 내림 · WebGL 유실이면 내림 · 섹션에 data-scene-layer', () => {
  assert.match(GATE, /REDUCED_QUERY = '\(prefers-reduced-motion: reduce\)'/);
  for (const r of ["'reduced-motion'", "'save-data'", "'low-memory'", "'no-webgl'"]) assert.ok(GATE.includes(r), r);
  assert.match(GATE, /getContext\('webgl2'\) \|\| c\.getContext\('webgl'\)/);
  assert.match(HOST, /mq\.addEventListener\?\.\('change', onChange\)/, '움직임 줄이기 변경 감지');
  assert.match(HOST, /sec\.setAttribute\('data-scene-layer', state\)/);
  assert.match(HOST, /return \(\) => sec\.removeAttribute\('data-scene-layer'\)/, '내리면 원래 모습');
  for (const [f, s] of SCENES) { assert.match(s, /webglcontextlost/, f); assert.match(s, /onFail\('context-lost'\)/, f); }
});

test('그리기 비용: frameloop="demand" + 폭별 fps·dpr 상한 · 탭 숨김·화면 밖 0 · 휴대폰 점 수·걸음 수 가장 적게 · 격자는 dpr ≤ 1.25', () => {
  for (const [f, s] of SCENES) { assert.match(s, /frameloop="demand"/, f); assert.match(s, /dpr=\{(params|tier)\.dpr\}/, f); assert.match(s, /bindSceneInputs\(host, clocks/, f); }
  assert.match(INPUTS, /document\.hidden/); assert.match(INPUTS, /new IntersectionObserver/);
  assert.match(read(`${DIR}/shared/FrameGate.tsx`), /if \(!clocks\.shouldDraw\(\)\) return;/);
  assert.match(read(`${DIR}/shared/clocks.ts`), /shouldDraw: \(\) => c\.visible && !c\.hidden && c\.out < 0\.999/);
  const ad = read(`${DIR}/vesper/adaptive.ts`);
  const counts = [...ad.matchAll(/orbCount: (\d+)/g)].map((m) => Number(m[1]));
  assert.equal(counts.length, 4); assert.ok(counts.every((c, i) => i === 0 || c < counts[i - 1]) && counts.at(-1) <= 6000, '폭이 좁을수록 점 수 감소 · 휴대폰 6,000 이하');
  assert.match(ad, /targetFps: 30 \}/, '휴대폰 30fps');
  const lat = read(`${DIR}/lattice/LatticeScene.tsx`);
  const steps = [...lat.matchAll(/steps: (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(steps.length === 3 && steps[2] < steps[0], '격자 걸음 수 휴대폰 감소');
  assert.doesNotMatch(lat, /dpr: \[[^\]]*, (1\.[3-9]|[2-9])\]/, '격자 dpr 상한 1.25 이하');
  assert.match(lat, /defines: \{ STEPS: tier\.steps, BISECT: tier\.bisect \}/);
  assert.match(read(`${DIR}/lattice/lattice-shaders.ts`), /#define STEPS 72/);
});

test('색: 모든 층이 홈페이지 검수안(검정·흰·은+파랑) — 보라·네온·민트·주황·금빛 0 · 자전은 설정 한 줄(대표 결정 대기)', () => {
  for (const f of walk(DIR)) {
    const s = noComments(read(f));
    assert.doesNotMatch(s, /#(8|9|a)[0-9a-f]{2}(f|e)[0-9a-f]{2}\b|purple|violet|magenta|neon/i, `${f}: 보라·네온 0`);
    assert.doesNotMatch(s, /#ff4c33|#ffd9a6|#52ffa5|#582eff|#6cf3a3|#170a2b/, `${f}: 원본 주황·금·민트·보라 값 0`);
  }
  assert.match(read(`${DIR}/vesper/constants.ts`), /colorEdge: '#6fa8ff'/, '가장자리 = --bh-blue');
  assert.match(read(`${DIR}/solaris/SolarisHero.tsx`), /colorBottom: '#2b63ff'/);
  assert.match(read(`${DIR}/lattice/LatticeScene.tsx`), /throatTint: '#dfe9ff'/, '금빛 목 → 얼음빛');
  assert.match(REG, /spin: (true|false),/);
  assert.match(read(`${DIR}/vesper/Orb.tsx`), /points\.rotation\.y = spin \? t \* ORB_CONFIG\.spin : 0;/);
});

test('CSS: 층 규칙은 brand-home.css 안에만(새 .css 0) · 켜진 뒤에만 지구·별 희미·글 앞 · 회전·옆 스침·무한 반복 0', () => {
  for (const f of walk(DIR)) assert.ok(!f.endsWith('.css'), `${f}: 층 폴더에 css 0(qa/background-lock 허용 목록)`);
  assert.match(HCSS, /\.bh-scene-layer \{ position: absolute; inset: 0; z-index: 0; pointer-events: none;/);
  assert.match(HCSS, /\.bh-sec\[data-scene-layer="on"\] \.bh-content \{ z-index: 1; \}/, '글은 층 위');
  assert.match(HCSS, /\.bh-hero-copy \{ width: 100%; max-width: 460px; position: relative; z-index: 1;/);
  assert.match(HCSS, /\.bh-hero\[data-scene-layer="on"\] \.bh-earth \{ opacity: 0\.3; \}/);
  assert.match(HCSS, /\.bh-hero\[data-scene-layer="on"\] \{ justify-content: flex-end;/);
  assert.match(HCSS, /\.bh-making\[data-scene-layer="on"\] \.bh-stars \{ opacity: 0\.45; \}/);
  const tail = noComments(HCSS.slice(HCSS.indexOf('2026-10-08 대표')));
  assert.doesNotMatch(tail, /rotate\(|translateX\(|marquee|infinite|purple|violet|magenta/);
});

test('의존성·보안: three · @react-three/fiber 고정 버전 · 원본의 Next 전용 부속·CDN·localStorage·제어판 0', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.dependencies.three, /^\d/); assert.match(pkg.dependencies['@react-three/fiber'], /^\d/);
  for (const d of ['@react-three/drei', '@react-three/postprocessing', 'postprocessing', 'lenis', '@react-spring/web', 'next', 'zustand', 'spring-text-engine']) assert.ok(!(d in pkg.dependencies) && !(d in (pkg.devDependencies ?? {})), `${d} 0`);
  for (const f of walk(DIR)) {
    const s = noComments(read(f));
    assert.doesNotMatch(s, /from ['"](next|@react-three\/drei|@react-three\/postprocessing|lenis|@react-spring|zustand)/, f);
    assert.doesNotMatch(s, /https?:\/\/|unpkg|cdn|localStorage|ui-panel|importmap/, `${f}: 외부 주소·저장·제어판 0`);
  }
});
