// 2026-10-10 갤럭시(저·중급 A 포함 · 삼성 인터넷/크롬/설치 앱) · 아이폰(사파리/설치 앱) 사진·카메라·3D 대체·망 끊김 보강 검사.
// 사진 머리 크기 읽기는 실제 파일(recentPhoto.ts)을 손으로 만든 작은 바이트로 돌린다. 나머지는 원본 줄 검사(기존 qa 방식).
// 네트워크·AI·계정·운영 쓰기·실제 사람 사진 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const compile = (p) => ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function loadPhoto(extras = {}) {
  const exports = {};
  vm.runInNewContext(compile('src/doit/lib/recentPhoto.ts'), { exports, Blob, Uint8Array, DataView, Date, Error, Promise, ...extras });
  return exports;
}
const photo = loadPhoto();

// ── 손으로 만든 머리 바이트 ──
const be16 = (v) => [(v >> 8) & 255, v & 255];
const be32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const le24 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
function jpeg({ width, height, sof = 0xc0, app1 = 40 }) {
  const app = [0xff, 0xe1, ...be16(app1 + 2), ...Array(app1).fill(0)]; // SOF 앞의 큰 APP 조각은 건너뛰어야 한다
  const dht = [0xff, 0xc4, ...be16(4), 0, 0]; // 허프만 표(C4)는 SOF 가 아니다
  const frame = [0xff, sof, ...be16(17), 8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app, ...dht, ...frame, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}
const png = (width, height) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...be32(13), ...Buffer.from('IHDR'), ...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
const riff = (chunk, body) => new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), ...Buffer.from(chunk), ...le24(body.length), 0, ...body]);
const vp8 = (w, h) => riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, (w >> 8) & 0x3f, h & 255, (h >> 8) & 0x3f]);
function vp8l(w, h) {
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  return riff('VP8L', [0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255]);
}
const vp8x = (w, h) => riff('VP8X', [0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]);

test('머리 크기 읽기: JPEG SOF0·SOF1·SOF2(APP·DHT 건너뜀) · PNG IHDR · WebP VP8/VP8L/VP8X', () => {
  for (const sof of [0xc0, 0xc1, 0xc2]) assert.deepEqual({ ...photo.readPhotoSize(jpeg({ width: 12000, height: 9000, sof })) }, { width: 12000, height: 9000 }, `SOF ${sof.toString(16)}`);
  assert.deepEqual({ ...photo.readPhotoSize(jpeg({ width: 16320, height: 12240, app1: 60000 })) }, { width: 16320, height: 12240 }, '2억 화소 · 큰 EXIF 뒤');
  assert.deepEqual({ ...photo.readPhotoSize(png(4000, 3000)) }, { width: 4000, height: 3000 });
  assert.deepEqual({ ...photo.readPhotoSize(vp8(1920, 1080)) }, { width: 1920, height: 1080 });
  assert.deepEqual({ ...photo.readPhotoSize(vp8l(16383, 2)) }, { width: 16383, height: 2 });
  assert.deepEqual({ ...photo.readPhotoSize(vp8x(12000, 9000)) }, { width: 12000, height: 9000 });
});

test('머리 크기 읽기: 모르는 형식·SOF 없음·잘린 파일은 null(예외 0) — 그때는 예전처럼 푼 뒤 크기를 본다', () => {
  assert.equal(photo.readPhotoSize(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null);
  assert.equal(photo.readPhotoSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9])), null, 'SOF 전에 SOS');
  assert.equal(photo.readPhotoSize(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), null, 'IHDR 없는 PNG');
  assert.equal(photo.readPhotoSize(png(0, 10)), null, '0 크기');
  for (const bytes of [jpeg({ width: 4000, height: 3000 }), png(10, 10), vp8(10, 10), vp8l(10, 10), vp8x(10, 10)]) {
    for (let i = 0; i < bytes.length; i++) assert.doesNotThrow(() => photo.readPhotoSize(bytes.subarray(0, i)));
  }
  // 헤더가 SOF 를 말하는 HEIC 는 처음부터 형식 거절(기존 HEIC 안내)
  const heic = new Uint8Array([0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0]);
  assert.equal(photo.readPhotoSize(heic), null);
});

const now = new Date('2026-10-10T12:00:00Z');
test('2억 화소를 넘는 머리 = 풀기 전에 거절 · 넘지 않으면 크기를 정리 단계로 넘긴다', async () => {
  let calls = 0;
  const huge = new Blob([jpeg({ width: 20000, height: 15000 })], { type: 'image/jpeg' });
  await assert.rejects(photo.prepareAlbumPhoto(huge, now, async () => { calls++; return new Blob(['x'], { type: 'image/jpeg' }); }), /해상도가 너무 커요\. 2억 화소 이하/);
  assert.equal(calls, 0, '풀기(정리) 0번');
  let seen = null;
  const ok = new Blob([jpeg({ width: 12000, height: 9000 })], { type: 'image/jpeg' });
  await photo.prepareAlbumPhoto(ok, now, async (_b, size) => { seen = size; return new Blob(['x'], { type: 'image/jpeg' }); });
  assert.deepEqual({ ...seen }, { width: 12000, height: 9000 });
  // HEIC(갤럭시 고효율 사진)는 기존 안내 문구 그대로
  await assert.rejects(photo.prepareAlbumPhoto(new Blob([new Uint8Array([0, 0, 0, 24, ...Buffer.from('ftypheic')])], { type: 'image/heic' }), now), /HEIC 사진은 JPG로 바꾼 뒤 선택해 주세요/);
});

function canvasMock(calls) {
  return { width: 0, height: 0, getContext() { return { fillStyle: '', fillRect() {}, drawImage() {} }; }, toBlob(cb, type) { calls.push(['encode', type]); cb(new Blob(['p'], { type })); } };
}

test('큰 사진은 푸는 순간 줄인다(resizeWidth · 비율 유지 · EXIF 회전 유지) — 줄이기를 지키는 브라우저에서만', async () => {
  const calls = [];
  const canvas = canvasMock(calls);
  const browser = loadPhoto({
    ImageData: class { constructor(w, h) { this.width = w; this.height = h; } },
    createImageBitmap: async (src, options = {}) => {
      calls.push(['decode', src instanceof Blob ? 'blob' : 'probe', { ...options }]);
      if (!(src instanceof Blob)) return { width: options.resizeWidth, height: options.resizeHeight, close() {} };
      return { width: options.resizeWidth ?? 12000, height: options.resizeWidth ? Math.round(9000 * options.resizeWidth / 12000) : 9000, close() {} };
    },
    document: { createElement() { return canvas; } },
  });
  await browser.normalizeAlbumPhoto(new Blob([jpeg({ width: 12000, height: 9000 })]), { width: 12000, height: 9000 });
  const decode = calls.find((c) => c[0] === 'decode' && c[1] === 'blob')[2];
  assert.equal(decode.imageOrientation, 'from-image');
  assert.equal(decode.resizeWidth, 2400);
  assert.equal(decode.resizeHeight, undefined, '세로는 비우기 = 비율 유지(회전돼도 찌그러지지 않음)');
  assert.equal(decode.resizeQuality, 'high');
  assert.equal(canvas.width, 2400); assert.equal(canvas.height, 1800);
});

test('줄이기를 못 하는 휴대폰은 2천5백만 화소 넘는 사진을 전체로 풀기 전에 막는다 · 작은 사진은 그대로', async () => {
  const decoded = [];
  const browser = loadPhoto({
    window: { matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }) },
    ImageData: class {},
    createImageBitmap: async (src, options = {}) => {
      if (!(src instanceof Blob)) return { width: 2, height: 2, close() {} }; // resize 무시 = 미지원
      decoded.push(options); return { width: 4000, height: 3000, close() {} };
    },
    document: { createElement() { return canvasMock([]); } },
  });
  await assert.rejects(browser.normalizeAlbumPhoto(new Blob(['x']), { width: 8160, height: 6120 }), /2천5백만 화소 이하/);
  assert.equal(decoded.length, 0, '풀기 0번');
  await browser.normalizeAlbumPhoto(new Blob(['x']), { width: 4000, height: 3000 });
  assert.equal(decoded.length, 1);
});

test('사진 밝기: iOS 사파리 캔버스 filter 미지원이면 픽셀마다 같은 계산(미리보기 = 저장 결과)', async () => {
  const exports = {};
  const ops = [];
  const pixels = new Uint8ClampedArray([100, 200, 250, 255, 10, 20, 30, 128]);
  const ctx = { translate() {}, rotate() {}, drawImage() { ops.push('draw'); }, getImageData() { ops.push('get'); return { data: pixels }; }, putImageData(img, x, y) { ops.push(['put', x, y]); } }; // filter 속성 없음 = 사파리
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob(cb, type) { cb(new Blob(['j'], { type })); } };
  vm.runInNewContext(compile('src/doit/lib/photoCorrect.ts'), { exports, Blob, Promise, Error, Math, createImageBitmap: async () => ({ width: 2, height: 1, close() {} }), document: { createElement: () => canvas } });
  await exports.correctBlob(new Blob(['x']), 0, 1.2);
  assert.deepEqual(ops, ['draw', 'get', ['put', 0, 0]]);
  assert.deepEqual([...pixels], [120, 240, 255, 255, 12, 24, 36, 128], '곱하고 255 로 자름 · 알파 그대로');
  // filter 를 지키는 브라우저(크롬·삼성 인터넷)는 예전처럼 ctx.filter
  const ops2 = [];
  const ctx2 = { _f: 'none', get filter() { return this._f; }, set filter(v) { this._f = v; ops2.push(v); }, translate() {}, rotate() {}, drawImage() {}, getImageData() { throw new Error('픽셀 계산 안 함'); }, putImageData() {} };
  const exports2 = {};
  vm.runInNewContext(compile('src/doit/lib/photoCorrect.ts'), { exports: exports2, Blob, Promise, Error, Math, createImageBitmap: async () => ({ width: 2, height: 1, close() {} }), document: { createElement: () => ({ ...canvas, getContext: () => ctx2 }) } });
  await exports2.correctBlob(new Blob(['x']), 90, 0.8);
  assert.equal(ops2.at(-1), 'brightness(0.8)');
});

test('서버 함수: 시간 상한(SDK timeout) · 끊긴 요청 = TIMEOUT · 오프라인 = 연결 확인 안내', async () => {
  const run = async (navigator, error) => {
    const u = { exports: {} };
    let opts = null;
    const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' }, access_token: 't' } } }) }, functions: { invoke: async (_fn, o) => { opts = o; return { data: null, error }; } } };
    const code = ts.transpileModule(read('src/doit/lib/understandingApi.ts').replace(/import\.meta\.env\.[A-Z_]+/g, 'undefined'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module: u, exports: u.exports, Response, Error, Promise, ...(navigator ? { navigator } : {}), require: (n) => { assert.equal(n, '@/lib/supabase/client'); return { supabase }; } });
    const e = await u.exports.serverFunctionRequest('doit-connect', { action: 'my_matches' }, 'u1').catch((x) => x);
    return { e, opts };
  };
  const aborted = await run({ onLine: true }, { name: 'FunctionsFetchError', context: { name: 'AbortError' } });
  assert.equal(aborted.opts.timeout, 30_000);
  assert.equal(aborted.e.code, 'TIMEOUT');
  assert.match(aborted.e.message, /다시 시도해 주세요/);
  const offline = await run({ onLine: false }, { name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') });
  assert.equal(offline.e.code, 'NETWORK_ERROR'); assert.equal(offline.e.message, '인터넷 연결을 확인해 주세요.');
  const src = read('src/doit/lib/understandingApi.ts');
  assert.match(src, /'doit-understanding': 60_000/, '대화 = 서버 예산(50초)보다 길게');
});

test('사진 올리기: 30초 상한 + 취소 신호 · 넘으면 TIMEOUT(화면의 다시 시도)', () => {
  const s = read('src/doit/lib/photoStorage.ts');
  assert.match(s, /export const UPLOAD_TIMEOUT_MS = 30_000;/);
  assert.match(s, /withTimeout\(cancelled \? Promise\.race\(\[work, cancelled\]\) : work, UPLOAD_TIMEOUT_MS, "uploadPhoto"\)/);
  assert.match(s, /if \(error instanceof TimeoutError\) throw new PhotoStorageError\("TIMEOUT"\);/);
  assert.match(s, /await uploadObject\(path, input\.blob, input\.signal\);/);
  assert.match(s, /await uploadObject\(path, blob\);/);
  assert.equal((s.match(/\.upload\(path/g) || []).length, 1, 'Storage upload 는 한 곳(상한 안)에서만');
});

test('카메라: 1920×1440 바람 · 끊김/화면 숨김 = 멈추고 대기 + 안내 · 오류는 모든 상태에서 보임 · 안전 영역', () => {
  const cam = read('src/pages/do-it/photo/camera.ts');
  assert.match(cam, /width: \{ ideal: 1920 \}, height: \{ ideal: 1440 \}/);
  assert.match(cam, /track\.onended = \(\) => \{\s*if \(generation !== this\.generation\) return;\s*this\.close\(\);\s*this\.onInterrupted\?\.\(\);/);
  const sheet = read('src/doit/app/plan-a/components/CameraSheet.tsx');
  assert.match(sheet, /const CAMERA_STOPPED_TEXT = "카메라가 멈췄어요\. 다시 켜 주세요\.";/);
  assert.match(sheet, /document\.addEventListener\("visibilitychange", onVisibility\);/);
  assert.match(sheet, /\{cameraError && cameraState !== "idle" && \(/);
  assert.match(sheet, /paddingTop: "calc\(16px \+ env\(safe-area-inset-top, 0px\)\)"/);
  assert.match(sheet, /paddingBottom: "calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\)"/);
});

test('앨범: 안드로이드는 HEIC 도 보이게(고른 뒤 JPG 안내) · 아이폰은 자동 JPG 변환 유지 · 오프라인 안내', () => {
  const pc = read('src/doit/app/plan-a/screens/PhotoCapture.tsx');
  assert.match(pc, /const ALBUM_ACCEPT = isAppleTouch\(\) \? "image\/jpeg,image\/png,image\/webp" : "image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif";/);
  assert.match(pc, /accept=\{ALBUM_ACCEPT\}/);
  assert.match(pc, /offlineAware\("사진을 저장하지 못했어요\./);
});

test('연결 화면: 돌아옴(visible)·다시 연결(online) = 한 번 새로 읽기 · 읽는 중/방금 읽음이면 건너뜀', () => {
  for (const p of ['src/doit/components/feature/ConnectionMatches.tsx', 'src/doit/components/feature/ConnectionCandidates.tsx']) {
    const s = read(p);
    assert.match(s, /document\.addEventListener\('visibilitychange', resume\);\s*window\.addEventListener\('online', resume\);/, p);
    assert.match(s, /document\.visibilityState !== 'visible' \|\| inFlight\.current/, p);
    assert.match(s, /Date\.now\(\) - lastRun\.current < RESUME_GAP_MS/, p);
    assert.match(s, /finally \{\s*if \(mine === seq\.current\) inFlight\.current = false;/, p);
    assert.match(s, /offlineAware\('/, p);
  }
});

test('3D: 문맥 잃음 = 멈춤 + 대체 · 확인용 문맥은 바로 반납 · 민들레 dispose 가 문맥 반납 · 지구 모형 15초 상한', () => {
  const house = read('src/doit/fx/house.ts'), glass = read('src/doit/fx/glass.ts');
  for (const [n, s] of [['house', house], ['glass', glass]]) {
    assert.match(s, /getExtension\("WEBGL_lose_context"\)\?\.loseContext\(\);/, n);
    assert.match(s, /canvas\.addEventListener\("webglcontextlost", onContextLost\);/, n);
    assert.match(s, /canvas\.removeEventListener\("webglcontextlost", onContextLost\);/, n);
    assert.match(s, /e\.preventDefault\(\);/, n);
  }
  const stage = read('src/doit/fx/FxStage.tsx');
  assert.match(stage, /m\.createGlass\(c, h, \{ play, onReady, onFail \}\)/);
  assert.match(stage, /m\.createDna\(c, h, \{ play, progress: \{ max: 0\.35, seconds: 24 \}, onFail \}\)/);
  const backdrop = read('src/doit/flora/FloraBackdrop.tsx');
  assert.match(backdrop, /canvas\.addEventListener\("webglcontextlost", onLost\);\s*canvas\.addEventListener\("webglcontextrestored", onRestored\);/);
  assert.match(read('src/doit/flora/FloraBloom.tsx'), /canvas\.addEventListener\("webglcontextlost", onLost\);/);
  assert.match(read('src/doit/flora/scene/dandelion/dandelion-scene.ts'), /this\.renderer\.dispose\(\);\s*\/\/[^\n]*\n\s*this\.renderer\.forceContextLoss\(\);/);
  const planet = read('src/doit/fx/planet.ts');
  assert.match(planet, /const LOAD_TIMEOUT_MS = 15_000;\s*const loadTimer = setTimeout\(\(\) => \{ if \(!loaded\) fail\(\); \}, LOAD_TIMEOUT_MS\);/);
  assert.match(planet, /dispose: \(\) => \{ disposed = true; clearTimeout\(loadTimer\);/);
});

test('새 문구: 금지어 0 · 가격 숫자 0', () => {
  const files = ['src/doit/lib/recentPhoto.ts', 'src/doit/lib/photoCorrect.ts', 'src/doit/lib/photoStorage.ts', 'src/doit/lib/understandingApi.ts', 'src/doit/app/plan-a/components/CameraSheet.tsx', 'src/doit/app/plan-a/screens/PhotoCapture.tsx', 'src/pages/do-it/photo/camera.ts'];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /데이팅|소개팅|궁합|점술|심리치료|성격검사/, f);
    assert.doesNotMatch(s, /\d[\d,]*\s*원\b|₩/, f);
  }
});
