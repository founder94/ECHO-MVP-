// 대표 전달 효과 4개(2026-10-10 「효과들을 코드로 줄테니까 훅킹박고 로딩시간 지루하지 않게 · 적재적소에」) 검사.
// 값은 대표가 준 원본 CONFIG 그대로인지, 자리는 기다리는 화면인지, 바깥 주소·금지어·가짜 숫자가 없는지 본다(화면 그림 자체는 qa-browser 캡처).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const FX = ['house', 'storm', 'dna', 'planet', 'glass'].map((n) => [n, read(`src/doit/fx/${n}.ts`)]);
// 설명 주석(원본에서 바꾼 이유 — 바깥 주소 이름이 나온다)은 빼고 실제 코드만 본다
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('원본 CONFIG 값 그대로(대표 전달 값)', () => {
  const storm = read('src/doit/fx/storm.ts'), dna = read('src/doit/fx/dna.ts'), planet = read('src/doit/fx/planet.ts'), glass = read('src/doit/fx/glass.ts');
  for (const kv of ['bgColor: "#1a0418"', 'coreColor: "#6a0a2a"', 'midColor: "#ff2d6b"', 'rimColor: "#ffd36b"', 'pointSize: 80', 'brightness: 1.6', 'repelStrength: 4', 'scrollDive: 3', 'parallax: 0.7']) assert.ok(storm.includes(kv), `storm ${kv}`);
  for (const kv of ['bgColor: "#03142e"', 'colorLow: "#04123a"', 'colorHigh: "#27043e"', 'atmoCount: 780', 'pointSize: 4', 'twist: 0.65', 'scrollClimb: 9.5', 'scrollSpin: 1.8', 'pointerRadius: 2.2']) assert.ok(dna.includes(kv), `dna ${kv}`);
  for (const kv of ['rimColor: "#c1faff"', 'nightLights: 10', 'glowIntensity: 3.35', 'planetRadius: 1.95', 'initRotation: 2.07', 'tilt: 0.37', 'starCount: 1400', 'markerCount: 60', 'markerColor: "#ffd27a"']) assert.ok(planet.includes(kv), `planet ${kv}`);
  for (const kv of ['samples: 5', 'resolution: 256', 'transmission: 0.94', 'roughness: 0.53', 'ior: 1.36', 'chromaticAberration: 0.36', 'spinSpeed: 0.06', 'bgTop: "#f6f8fb"', 'bgBottom: "#d7dce4"']) assert.ok(glass.includes(kv), `glass ${kv}`);
  // 셰이더 핵심 줄(원본과 글자 같음)
  assert.ok(storm.includes('float strength = pow(1.0 - d * 2.0, 4.5);'));
  assert.ok(dna.includes('float discreteT = floor(t * 2.5) / 2.5;'));
  assert.ok(planet.includes('float glint = pow(ndh, 140.0);'));
  assert.ok(glass.includes('totalDiffuse = mix( totalDiffuse, transmission.rgb, material.transmission );'));
  assert.equal((glass.match(/CARD_DEFS = \[[\s\S]*?\];/)[0].match(/angle:/g) || []).length, 7, '유리판 7장');
});

test('바깥 주소 0 — CDN·Draco 해제기·외부 글꼴 없이 우리 주소의 파일만', () => {
  for (const [n, src] of FX) assert.doesNotMatch(code(src), /https?:\/\//, `${n}.ts 바깥 주소`);
  for (const [n, src] of FX) assert.doesNotMatch(code(src), /DRACOLoader|gstatic|unpkg|rsms\.me/, n);
  for (const f of ['planet.glb', 'planet-lights.glb', 'planet-clouds.png']) assert.ok(existsSync(path.join(root, 'public/doit/fx', f)), f);
  for (const f of ['planet.glb', 'planet-lights.glb']) {
    const head = readFileSync(path.join(root, 'public/doit/fx', f)).subarray(0, 4096).toString('latin1');
    assert.ok(head.startsWith('glTF'), `${f} glb`);
    assert.doesNotMatch(head, /KHR_draco_mesh_compression/, `${f} Draco 압축 없음(CSP 안에서 열림)`);
  }
});

test('자리: 기다리는 화면 — 대화(DNA) · 타로 해석(유리) · 아직 사람 없음(지구) · 찌릿 = Storm 두 구슬(대표 B안)', () => {
  const agent = read('src/doit/components/feature/AgentConversation.tsx');
  assert.equal((agent.match(/<FxStage fx="dna"/g) || []).length, 2, '대화 불러오기 · 시작 준비');
  assert.match(read('src/doit/components/feature/CoreConversation.tsx'), /\{busy && <div className="doit-fx-wait"><FxStage fx="dna" delayMs=\{700\} \/><div className="echo-thinking" role="status"><SymbolLoader size=\{64\} \/>/);
  assert.match(read('src/doit/app/plan-a/screens/FreeResult.tsx'), /mode === "taro" && tarotLoading && \(\s*<div className="doit-fx-wait">\s*<FxStage fx="glass"/);
  assert.match(read('src/doit/components/feature/ConnectionCandidates.tsx'), /load\.candidates\.length === 0 && <div className="doit-fx-wait"><FxStage fx="planet" \/>/);
  const zz = read('src/doit/components/feature/ZzaritMoment.tsx');
  assert.match(zz, /<FxStage fx="storm-pair" className="echo-zzarit-stage" \/>/, '찌릿 = 대표 B안(2026-10-10 「B로 채택」)');
  assert.doesNotMatch(zz, /LatticeStage/, 'A안 Lattice 는 찌릿에서 빠짐');
  // 심볼은 그대로 남는다(대표 「심볼만 살려」)
  assert.ok((agent.match(/<SymbolLoader size=\{64\} \/>/g) || []).length >= 2);
});

test('가벼움·움직임 줄이기·실패 대체', () => {
  const stage = read('src/doit/fx/FxStage.tsx');
  assert.match(stage, /import\("\.\/dna"\)/, '엔진은 그림 칸이 보일 때만 불러온다');
  assert.match(stage, /sceneShouldFreeze\(readTier\(\)\) \? "still" : "live"/, '움직임 줄이기·절전 = 한 장');
  assert.match(stage, /state === "failed" \? <div className="doit-fx-fallback" \/>/, 'WebGL 안 되면 은은한 빛');
  assert.match(stage, /if \(!armed\) return null;/, '짧은 기다림은 안 띄움(번쩍임 0)');
  const house = read('src/doit/fx/house.ts');
  assert.match(house, /const want = !still && !document\.hidden && inView;/, '탭 숨김·화면 밖이면 멈춤');
  assert.match(house, /renderer\.forceContextLoss\(\);/, '나갈 때 GPU 자원 풀기');
  assert.match(read('src/doit/fx/glass.ts'), /renderer\.forceContextLoss\(\);/);
  // 상자 크기 고정(글자가 효과 위에 얹히지 않음 · 가로 넘침 0)
  const css = read('src/doit/fx/fx.css');
  assert.match(css, /\.doit-fx\{position:relative;width:100%;height:220px;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[^}]*transition:none/);
});

test('한 줄 안내: 사실인 말 · 금지어 0 · 가격 숫자 0', async () => {
  const hooksSrc = read('src/doit/fx/hooks.ts');
  const lines = [...hooksSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(lines.length >= 6);
  for (const l of lines) {
    assert.doesNotMatch(l, /데이팅|소개팅|궁합|점술|심리치료|성격검사/, l);
    assert.doesNotMatch(l, /\d/, `숫자 0: ${l}`);
    assert.doesNotMatch(l, /보장|반드시|100%|운명/, `단정 0: ${l}`);
  }
  assert.ok(lines.includes('당신이 잠든 사이, AI가 먼저 만나봅니다.'), '지구 = 승인 첫 화면 문구');
});
