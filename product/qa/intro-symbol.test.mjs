// 온보딩 심볼이 화면에서 사라지지 않는지 지키는 검사 (2026-09-23).
//
// 실제로 있었던 일: 온보딩은 1536×1536 · 180KB 공식 원본을 받아야만 심볼을 그릴 수 있었고,
// 그 그림이 늦거나 실패하면 별·숫자만 남고 심볼이 통째로 사라졌다. 빠져나갈 문이 없었다.
// 여기서는 (1) 표시용 작은 판을 쓰는지 (2) 3D 연출이 못 맡을 때 <img> 가 남는지
// (3) 심볼을 쓰는 모든 자리가 같은 규칙을 따르는지를 소스와 파일로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const DISPLAY = 'public/brand/doit-symbol-intro.webp';
const ORIGINAL = 'public/brand/doit-symbol-original.png';

test('표시용 작은 판이 있고, 공식 원본보다 확실히 가볍다', () => {
  const small = statSync(path.join(root, DISPLAY)).size;
  const big = statSync(path.join(root, ORIGINAL)).size;
  assert.ok(small > 0, '작은 판 파일이 비어 있다');
  assert.ok(small * 5 < big, `작은 판이 충분히 가볍지 않다: ${small} vs ${big}`);
});

test('공식 원본 파일은 지우지 않고 그대로 둔다', () => {
  assert.ok(statSync(path.join(root, ORIGINAL)).size > 0);
});

test('심볼 주소는 한 곳(symbolAssets)에서만 정한다', () => {
  const assets = read('src/components/symbolAssets.ts');
  assert.match(assets, /SYMBOL_DISPLAY_SRC\s*=\s*'\/brand\/doit-symbol-intro\.webp'/);
  assert.match(assets, /SYMBOL_ORIGINAL_SRC\s*=\s*'\/brand\/doit-symbol-original\.png'/);

  // 심볼을 그리는 파일들이 원본 주소를 직접 박아 두지 않는다(주석은 제외).
  for (const file of ['src/components/DoItSymbol.tsx', 'src/components/DoItIntroFrame.ts', 'src/components/IntroUniverse.tsx']) {
    const code = read(file).split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
    assert.ok(!code.includes("'/brand/doit-symbol-original.png'") && !code.includes('"/brand/doit-symbol-original.png"'),
      `${file} 이 공식 원본 주소를 직접 쓰고 있다`);
    assert.match(code, /symbolAssets/, `${file} 이 symbolAssets 를 쓰지 않는다`);
  }
});

test('작은 판을 못 읽으면 공식 원본으로 한 번만 되돌아간다', () => {
  const assets = read('src/components/symbolAssets.ts');
  assert.match(assets, /dataset\.symbolFallback === '1'/, '되돌리기 1회 제한이 없다');
  assert.match(assets, /el\.src = SYMBOL_ORIGINAL_SRC/);
  // 공식 원본은 검은 배경이 함께 있으므로 합성 방식을 되돌려야 네모가 비치지 않는다.
  assert.match(assets, /mixBlendMode = 'screen'/);

  for (const file of ['src/components/DoItSymbol.tsx', 'src/components/DoItIntroFrame.ts']) {
    assert.match(read(file), /onError/, `${file} 에 되돌아갈 길이 없다`);
  }
});

test('v14.4 심볼은 처음엔 보이지 않고 끝에서 완성된다 (대표 갤럭시 "D가 잠깐 나오고 없어졌다 다시 나온다")', () => {
  const frame = read('src/components/DoItIntroFrame.ts');
  // 3D 연출이 맡으면 캔버스가 점을 모아 완성, 못 맡으면 원래 그림이 끝 무렵(LATE_REVEAL_FROM%)부터 나타난다.
  assert.match(frame, /const symbolReveal = reducedMotion \? 1 : scene && symbolReady \? 0 : lateReveal;/);
  assert.match(frame, /const lateReveal = clamp01\(\(progress - LATE_REVEAL_FROM\) \/ \(100 - LATE_REVEAL_FROM\)\);/);
  const from = Number(frame.match(/const LATE_REVEAL_FROM = (\d+);/)[1]);
  assert.ok(from >= 60 && from <= 90, `끝 무렵이어야 한다: ${from}`);
  // 예전 방식(맡기 전에는 처음부터 보임)으로 돌아가지 않는다.
  assert.doesNotMatch(frame, /scene && symbolReady \? 0 : 1/);
  assert.match(frame, /symbolReady\?: boolean/);
});

test('v14.4 아이폰(사파리) 빈 그림 — "오류 없음"이 아니라 실제로 담긴 칸을 세고, 비면 넘겨받지 않는다', () => {
  const sampling = read('src/components/symbolSampling.ts');
  // 사파리에서 빈 그림이 되는 원인이던 decoding='async' 를 쓰지 않는다.
  const code = sampling.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /decoding\s*=\s*'async'/);
  assert.match(sampling, /visible: shown \/ \(KEYED_SIZE \* KEYED_SIZE\)/);
  assert.match(sampling, /const MIN_VISIBLE_RATIO = /);
  // 비면 한 번만 다시 옮기고, 그래도 비면 실패로 끝낸다.
  assert.equal((sampling.match(/await wait\(REDRAW_WAIT_MS\)/g) || []).length, 1);
  assert.match(sampling, /throw new SymbolReadError\('blank'\)/);
  const universe = read('src/components/IntroUniverse.tsx');
  assert.match(universe, /if \(dots\.length > 0 && symbolImg\) readyRef\.current\?\.\(\)/);
  assert.match(universe, /그림을 못 읽었다: 알리지 않는다/);
  assert.doesNotMatch(universe, /\.catch\([^)]*\)\s*=>\s*\{[^}]*readyRef/, '실패했는데 넘겨받았다고 알리면 안 된다');
  // 온보딩과 로딩 화면이 같은 읽기 도구를 쓴다(한쪽만 고쳐지는 일이 없게).
  assert.match(universe, /from '@\/components\/symbolSampling'/);
  assert.match(read('src/components/SymbolLoader.tsx'), /from '@\/components\/symbolSampling'/);
});

test('늦게 준비되면 화면이 깜빡이지 않도록 넘기지 않는다', () => {
  const page = read('src/pages/do-it/intro/page.tsx');
  assert.match(page, /HANDOFF_LIMIT_MS/);
  assert.match(page, /elapsedRef\.current <= HANDOFF_LIMIT_MS/);
});

test('첫 화면에 필요한 심볼을 다음 화면 배경보다 먼저 받는다', () => {
  const html = read('index.html');
  const symbolAt = html.indexOf('doit-symbol-intro.webp');
  const earthAt = html.indexOf('rel="preload" as="image" href="/brand/doit-earth-original.png"');
  assert.ok(symbolAt > -1, '심볼을 미리 받지 않는다');
  assert.ok(earthAt > -1, '랜딩 배경 미리 받기가 사라졌다');
  assert.ok(symbolAt < earthAt, '심볼이 랜딩 배경보다 뒤에 있다');
  assert.match(html, /doit-symbol-intro\.webp"[^>]*fetchpriority="high"/);
  assert.match(html, /doit-earth-original\.png"[^>]*fetchpriority="low"/);
});

test('진행률(%)을 지어내지 않는다 — 심볼 대기 때문에 가짜로 멈추거나 건너뛰지 않는다', () => {
  const page = read('src/pages/do-it/intro/page.tsx');
  // 준비 신호는 "누가 심볼을 그릴지"만 정한다. 타임라인(progressAt)은 건드리지 않는다.
  assert.ok(!/setProgress\([^)]*symbolReady/.test(page), '심볼 준비 상태가 진행률을 바꾸고 있다');
  assert.match(page, /function progressAt\(dt: number, reduced: boolean\)/);
});

test('v14.4 서버를 기다리는 불러오기 3종에 시간 상한이 있다 (대표 실기기 "프로필을 불러오는 중…"에서 멈춤)', () => {
  for (const [file, fn] of [['src/doit/lib/profileSave.ts', 'loadProfile'], ['src/doit/lib/purposes.ts', 'fetchActivePurposes'], ['src/doit/lib/photoStorage.ts', 'restorePhotos']]) {
    const code = read(file);
    assert.match(code, new RegExp(`export async function ${fn}\\(`), `${file} 의 ${fn} 이 없다`);
    assert.match(code, new RegExp(`withTimeout\\(${fn}Once\\(`), `${fn} 에 시간 상한이 없다`);
  }
  const wt = read('src/doit/lib/withTimeout.ts');
  assert.match(wt, /export const READ_TIMEOUT_MS = /);
});

test('v14.4 프로필 기다림 화면 — 오래 걸리면 다시 시도·홈으로가 나오고, 실패 화면에도 홈으로가 있다', () => {
  const page = read('src/doit/pages/do-it/start-journey/page.tsx');
  assert.match(page, /const SLOW_HINT_MS = /);
  assert.match(page, /setTimeout\(\(\) => setSlow\(true\), SLOW_HINT_MS\)/);
  assert.match(page, /조금 오래 걸리고 있어요/);
  assert.ok((page.match(/navigate\("\/doit\/home"\)\}/g) || []).length >= 3, '기다림·실패·선택 화면 모두 홈으로가 있어야 한다');
  // 목적 저장이 멈춰도 "대화를 준비하고 있어요"에 갇히지 않는다.
  assert.match(page, /withTimeout\(savePurpose\(/);
  // 다시 시도 뒤 늦게 온 이전 결과가 새 결과를 덮지 않는다.
  assert.match(page, /seq !== restoreSeqRef\.current/);
});

test('v14.4 기다림 화면마다 심볼 3D 효과를 쓴다', () => {
  assert.match(read('src/components/RouteFallback.tsx'), /<SymbolLoader /);
  const journey = read('src/doit/pages/do-it/start-journey/page.tsx');
  assert.ok((journey.match(/<SymbolLoader /g) || []).length >= 2, '프로필 불러오기·대화 준비 화면');
  assert.ok((read('src/doit/pages/do-it/conversation/page.tsx').match(/<SymbolLoader /g) || []).length >= 2);
  assert.match(read('src/doit/components/feature/CoreConversation.tsx'), /<SymbolLoader size=\{64\} \/>/);
  const loader = read('src/components/SymbolLoader.tsx');
  // 동작 줄이기면 움직이지 않는다. 못 읽으면 원래 그림이 보인다.
  assert.match(loader, /prefers-reduced-motion: reduce/);
  assert.match(loader, /className="doit-symbol-loader-fallback"/);
  const css = read('src/components/symbol-loader.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of css.split('}').map((b) => b.split('{')[0].trim()).filter(Boolean)) {
    if (block.startsWith('@') || /^(to|from|\d+%)/.test(block)) continue;
    for (const part of block.split(',')) assert.match(part.trim(), /^\.doit-symbol-loader/, part);
  }
});

test('v14.4 시간 상한 도구가 실제로 동작한다 — 제때 오면 그대로, 늦으면 끊는다, 타이머를 남기지 않는다', async () => {
  const ts = (await import('typescript')).default;
  const vm = await import('node:vm');
  const code = ts.transpileModule(read('src/doit/lib/withTimeout.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  // 아직 울리지 않은 타이머만 센다(이미 울린 타이머를 지우는 건 해가 없으므로 세지 않는다).
  const pending = new Set();
  const trackedSet = (fn, ms) => { const id = setTimeout(() => { pending.delete(id); fn(); }, ms); pending.add(id); return id; };
  const trackedClear = (id) => { pending.delete(id); clearTimeout(id); };
  const live = () => pending.size;
  vm.runInNewContext(code, { exports, setTimeout: trackedSet, clearTimeout: trackedClear, Promise, Error });
  const { withTimeout, TimeoutError } = exports;
  assert.equal(await withTimeout(Promise.resolve('ok'), 50, 't'), 'ok');
  assert.equal(live(), 0, '끝난 뒤 타이머가 남으면 안 된다');
  await assert.rejects(withTimeout(new Promise(() => {}), 30, 'hang'), (e) => e instanceof TimeoutError);
  await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 50, 'x'), /boom/);
  assert.equal(live(), 0);
});

test('v14.5 메탈 실버 — 평평한 은색이 아니라 여러 겹 금속 반사 띠를 쓰고, 히어로·랜딩과 전역은 건드리지 않는다', () => {
  const css = read('src/doit/components/feature/metal-silver.css');
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // 금속판: 반사 띠가 여러 겹(7단)인 그라데이션 + 빛 흐름
  const stops = (body.match(/linear-gradient\(115deg,[^)]*\)/) || [''])[0].match(/#[0-9a-f]{6}/gi) || [];
  assert.ok(stops.length >= 6, `금속 반사 띠가 부족하다: ${stops.length}`);
  assert.match(body, /@keyframes doit-metal-sheen/);
  assert.match(body, /-webkit-background-clip: text/);
  // 동작 줄이기면 멈춘다
  assert.match(body, /prefers-reduced-motion: reduce[\s\S]*animation: none/);
  // 전역·히어로·랜딩 금지
  assert.doesNotMatch(body, /(^|[\s,}])(body|html|:root)\s*[{,]/);
  assert.doesNotMatch(body, /doit-brand-|doit-editorial|doit-landing/);
  // 모든 규칙이 앱 화면 루트 클래스 아래에 있다
  for (const block of body.split('}').map((b) => b.split('{')[0].trim()).filter(Boolean)) {
    if (block.startsWith('@') || /^(from|to|\d+%)$/.test(block)) continue;
    for (const part of block.split(',')) assert.match(part.trim(), /^\.(echo-dialogue|doit-product|doit-profile-review|doit-install|doit-understanding-page)\b/, part);
  }
  // 세 화면 스타일이 이 파일을 불러온다
  for (const f of ['product-brand.css', 'core-conversation.css', 'install-app.css']) {
    assert.match(read(`src/doit/components/feature/${f}`), /^@import "\.\/metal-silver\.css";/m, f);
  }
  // 캔버스·온보딩 숫자도 같은 색표를 쓴다
  const tones = read('src/components/metalSilver.ts');
  assert.ok((tones.match(/#[0-9a-f]{6}/gi) || []).length >= 4);
  assert.match(read('src/components/IntroUniverse.tsx'), /metalTone\(di\)/);
  assert.match(read('src/components/SymbolLoader.tsx'), /tone: metalTone\(/);
  assert.match(read('src/components/DoItIntroFrame.ts'), /backgroundImage: METAL_TEXT_GRADIENT/);
});

test('v14.5 아이폰 확인 모드(?check=1) — 넘어가지 않고 멈춰서 결과를 글자로 보여 주고, 아무것도 저장·전송하지 않는다', () => {
  const page = read('src/pages/do-it/intro/page.tsx');
  assert.match(page, /search\.get\('check'\) === '1'/);
  assert.match(page, /if \(checkMode && dt >= fadeAt\)/);
  assert.match(page, /✅ 성공 — 끝 장면에 심볼이 보입니다/);
  assert.match(page, /❌ 실패 — 끝 장면에 심볼이 없습니다/);
  for (const banned of ['fetch(', 'supabase', 'localStorage', 'sessionStorage.setItem', 'console.']) {
    const code = page.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const checkPart = code.slice(code.indexOf('if (!checkMode) return frame;'));
    assert.ok(!checkPart.includes(banned), `확인 모드가 ${banned} 를 쓴다`);
  }
  // 확인 모드가 아니면 예전과 똑같이 그 화면을 그대로 돌려준다.
  assert.match(page, /if \(!checkMode\) return frame;/);
});
