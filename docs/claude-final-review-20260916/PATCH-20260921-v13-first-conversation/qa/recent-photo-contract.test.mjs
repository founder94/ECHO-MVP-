import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Real parser/preparation source. No network, AI, accounts, production writes, or personal photos.
const source = readFileSync('src/doit/lib/recentPhoto.ts', 'utf8');
function load(extras = {}) {
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, Blob, Uint8Array, DataView, Date, Error, Promise, ...extras });
  return exports;
}
const api = load();
const now = new Date('2026-09-20T12:00:00Z');

function jpeg(date = '2026:09:10 12:00:00', offset = '+09:00', little = true) {
  const fields = date === null ? [] : [[0x9003, date], ...(offset === null ? [] : [[0x9011, offset]])];
  const textStart = 26 + 2 + fields.length * 12 + 4;
  const strings = fields.map(([, value]) => Buffer.from(value + '\0'));
  const tiff = Buffer.alloc(textStart + strings.reduce((n, b) => n + b.length, 0));
  const u16 = (p, v) => little ? tiff.writeUInt16LE(v, p) : tiff.writeUInt16BE(v, p);
  const u32 = (p, v) => little ? tiff.writeUInt32LE(v, p) : tiff.writeUInt32BE(v, p);
  tiff.write(little ? 'II' : 'MM', 0); u16(2, 42); u32(4, 8);
  u16(8, 1); u16(10, 0x8769); u16(12, 4); u32(14, 1); u32(18, 26);
  u16(26, fields.length);
  let cursor = textStart;
  fields.forEach(([tag], i) => {
    const p = 28 + i * 12;
    u16(p, tag); u16(p + 2, 2); u32(p + 4, strings[i].length); u32(p + 8, cursor);
    strings[i].copy(tiff, cursor); cursor += strings[i].length;
  });
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0, 69, 120, 105, 102, 0, 0]);
  header.writeUInt16BE(tiff.length + 8, 4);
  return Buffer.concat([header, tiff, Buffer.from([0xff, 0xd9])]);
}
const normalize = async () => new Blob(['normalized pixels'], { type: 'image/jpeg' });
const file = (bytes, type = 'image/jpeg') => new Blob([bytes], { type });
const check = (date, offset = '+00:00', at = now) => api.assessCaptureDate({ kind: 'date', original: date, offset }, at);

test('JPEG TIFF little- and big-endian DateTimeOriginal + offset are read', () => {
  for (const little of [true, false]) {
    const result = api.readJpegCaptureDate(jpeg('2026:08:05 09:10:11', '+09:00', little));
    assert.equal(result.kind, 'date'); assert.equal(result.original, '2026:08:05 09:10:11'); assert.equal(result.offset, '+09:00');
  }
});
test('JPEG with no original capture date requires confirmation', () => {
  assert.equal(api.readJpegCaptureDate(jpeg(null)).kind, 'missing');
  assert.equal(api.assessCaptureDate({ kind: 'missing' }, now).kind, 'needs-confirmation');
});
test('recent JPEG is normalized and classified without claiming verification', async () => {
  const result = await api.prepareAlbumPhoto(file(jpeg()), now, normalize);
  assert.equal(result.blob.type, 'image/jpeg'); assert.equal(result.dateCheck.kind, 'recent');
});
test('more than two calendar months old is blocked before decoding or uploading', async () => {
  let calls = 0;
  await assert.rejects(api.prepareAlbumPhoto(file(jpeg('2026:07:19 12:00:00')), now, async () => { calls++; return normalize(); }), /최근 2개월/);
  assert.equal(calls, 0);
});
test('exact two-month calendar day is accepted, previous day is rejected', () => {
  assert.equal(check('2026:07:20 00:00:00').kind, 'recent');
  assert.throws(() => check('2026:07:19 23:59:59'), /최근 2개월/);
});
test('month-end cutoff clamps to the actual day in the earlier month', () => {
  const at = new Date('2026-08-31T12:00:00Z');
  assert.equal(check('2026:06:30 01:00:00', '+00:00', at).kind, 'recent');
  assert.throws(() => check('2026:06:29 23:59:59', '+00:00', at), /최근 2개월/);
});
test('future EXIF timestamp is blocked with positive and negative offsets', () => {
  assert.throws(() => check('2026:09:20 22:00:00', '+09:00'), /미래/);
  assert.equal(check('2026:09:20 20:59:59', '+09:00').kind, 'recent');
  assert.throws(() => check('2026:09:20 06:00:01', '-06:00'), /미래/);
});
test('invalid calendar dates, times and offsets do not silently become accepted', () => {
  for (const date of ['2026:02:30 10:00:00', '2026:13:01 10:00:00', '2026:09:01 25:00:00', '2026:09:01 10:61:00', '2026-09-01']) assert.throws(() => check(date), /촬영 날짜/);
  for (const offset of ['+15:00', '+14:01', '+09:99', 'KST']) assert.throws(() => check('2026:09:01 10:00:00', offset), /촬영 날짜/);
});
test('offset-less original dates use the device calendar, not file modification date', () => {
  const at = new Date(2026, 8, 20, 12, 0, 0);
  assert.equal(check('2026:08:01 09:00:00', null, at).kind, 'recent');
  assert.throws(() => check('2026:09:21 09:00:00', null, at), /미래/);
});
test('file lastModified never substitutes for missing or old EXIF', async () => {
  const old = file(jpeg('2026:01:01 12:00:00'));
  Object.defineProperty(old, 'lastModified', { value: now.getTime() });
  await assert.rejects(api.prepareAlbumPhoto(old, now, normalize), /최근 2개월/);
  const missing = file(jpeg(null));
  Object.defineProperty(missing, 'lastModified', { value: now.getTime() });
  assert.equal((await api.prepareAlbumPhoto(missing, now, normalize)).dateCheck.kind, 'needs-confirmation');
});
test('PNG and WebP remain unconfirmed even when the container has no readable JPEG EXIF', async () => {
  const fixtures = [[Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'], [Buffer.from('RIFF0000WEBP'), 'image/webp']];
  for (const [bytes, type] of fixtures) assert.equal((await api.prepareAlbumPhoto(file(bytes, type), now, normalize)).dateCheck.kind, 'needs-confirmation');
});
test('empty files, oversized files, renamed non-images and mismatched MIME are rejected', async () => {
  await assert.rejects(api.prepareAlbumPhoto(new Blob([]), now, normalize), /20MB/);
  await assert.rejects(api.prepareAlbumPhoto(new Blob([new Uint8Array(api.MAX_ALBUM_BYTES + 1)]), now, normalize), /20MB/);
  await assert.rejects(api.prepareAlbumPhoto(file(Buffer.from('<svg/>')), now, normalize), /JPG, PNG, WebP/);
  await assert.rejects(api.prepareAlbumPhoto(file(jpeg(), 'image/png'), now, normalize), /JPG, PNG, WebP/);
});
test('missing browser MIME is supported only when file magic identifies a supported format', async () => {
  assert.equal((await api.prepareAlbumPhoto(file(jpeg(), ''), now, normalize)).dateCheck.kind, 'recent');
});
test('malformed TIFF offsets, oversized entry counts, truncated segments are bounded', () => {
  const badOffset = jpeg(); badOffset.writeUInt32LE(0xffffffff, 12 + 36);
  const hugeCount = jpeg(); hugeCount.writeUInt16LE(65535, 12 + 26);
  const truncated = jpeg().subarray(0, 35);
  for (const bytes of [badOffset, hugeCount, truncated]) {
    assert.equal(api.readJpegCaptureDate(bytes).kind, 'invalid');
    assert.throws(() => api.assessCaptureDate(api.readJpegCaptureDate(bytes), now), /촬영 날짜/);
  }
});
test('truncation at every byte does not cause out-of-bounds exceptions', () => {
  const bytes = jpeg();
  for (let i = 0; i < bytes.length; i++) assert.doesNotThrow(() => api.readJpegCaptureDate(bytes.subarray(0, i)));
});
test('normalized payload must really be nonempty JPEG below storage limit', async () => {
  for (const output of [new Blob(['x'], { type: 'image/png' }), new Blob([], { type: 'image/jpeg' }), new Blob([new Uint8Array(api.MAX_UPLOAD_PHOTO_BYTES + 1)], { type: 'image/jpeg' })]) {
    await assert.rejects(api.prepareAlbumPhoto(file(jpeg()), now, async () => output), /5MB 이하 JPG/);
  }
});
test('canvas normalization keeps aspect ratio, honors EXIF orientation and emits JPEG', async () => {
  const calls = []; let closed = false;
  const canvas = { width: 0, height: 0, getContext() { return { fillStyle: '', fillRect(...args) { calls.push(['fill', ...args]); }, drawImage(...args) { calls.push(['draw', ...args]); } }; }, toBlob(callback, type, quality) { calls.push(['encode', type, quality]); callback(new Blob(['pixels only'], { type })); } };
  const browser = load({ createImageBitmap: async (_blob, options) => { calls.push(['decode', options.imageOrientation]); return { width: 4000, height: 3000, close() { closed = true; } }; }, document: { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } } });
  const output = await browser.normalizeAlbumPhoto(file(jpeg()));
  assert.equal(output.type, 'image/jpeg'); assert.equal(canvas.width, 2400); assert.equal(canvas.height, 1800);
  assert.equal(calls[0][1], 'from-image'); assert.equal(calls.at(-1)[1], 'image/jpeg'); assert.equal(closed, true);
});
test('oversized decoded image is rejected and bitmap is released', async () => {
  let closed = false;
  const browser = load({ createImageBitmap: async () => ({ width: 10000, height: 10000, close() { closed = true; } }) });
  await assert.rejects(browser.normalizeAlbumPhoto(file(jpeg())), /해상도/);
  assert.equal(closed, true);
});
test('canvas encoding failures release the decoded image', async () => {
  let closed = false;
  const browser = load({ createImageBitmap: async () => ({ width: 10, height: 10, close() { closed = true; } }), document: { createElement() { return { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob(callback) { callback(null); } }; } } });
  await assert.rejects(browser.normalizeAlbumPhoto(file(jpeg())), /저장 형식/); assert.equal(closed, true);
});

function photoScreen({ checkKind = 'needs-confirmation', existing = null, failUpload = false } = {}) {
  let cursor = 0;
  const hooks = [];
  const calls = [];
  const photoBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
  class Drafts {
    photos = Array(6).fill(null);
    snapshot() { return { photos: this.photos }; }
    setCapture(slot, blob) { calls.push(['capture', slot, blob]); this.photos[slot] = { captureId: 'new-id', previewUrl: 'blob:draft', status: 'local' }; }
    async upload(slot) { calls.push(['upload', slot]); if (failUpload) throw new Error('offline'); this.photos[slot].status = 'uploaded'; return { slot, captureId: 'new-id', photoId: 'new-photo' }; }
    dispose() {}
  }
  const React = {
    useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial === 'loading' ? 'ready' : initial; return [hooks[i], (next) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; },
    useEffect() {}, useCallback(fn) { return fn; },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const exports = {};
  const compiled = ts.transpileModule(readFileSync('src/doit/app/plan-a/screens/PhotoCapture.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, {
    exports, Blob, Error, Promise, crypto: { randomUUID: () => 'replace-id' }, URL: { createObjectURL: () => 'blob:prepared', revokeObjectURL() {} },
    require(name) {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === 'motion/react') return { motion: { div: 'div' } };
      if (name === 'lucide-react') return { Camera: 'icon', ImagePlus: 'icon', Loader2: 'icon', Star: 'icon', X: 'icon' };
      if (name.endsWith('/photoDrafts')) return { PhotoDrafts: Drafts };
      if (name.endsWith('/theme')) return { colors: {}, serif: 'serif' };
      if (name.endsWith('/PrimaryButton')) return { PrimaryButton: 'primary-button' };
      if (name.endsWith('/CameraSheet')) return { CameraSheet: 'camera-sheet' };
      if (name.endsWith('/recentPhoto')) return { MAX_UPLOAD_PHOTO_BYTES: api.MAX_UPLOAD_PHOTO_BYTES, RecentPhotoError: api.RecentPhotoError, prepareAlbumPhoto: async () => ({ blob: photoBlob, dateCheck: { kind: checkKind } }) };
      // 2026-09-21 사진 정책(필수 3장·종류·AI 판별)은 qa/photo-policy.test.mjs 가 따로 검사한다. 여기서는 최소 흉내만 낸다.
      if (name.endsWith('/photoPolicy')) return {
        PHOTO_SLOTS: [0, 1, 2, 3, 4, 5].map((slot) => ({ slot, category: slot < 3 ? ['full_body', 'fashion', 'hobby'][slot] : 'free', required: slot < 3, label: ['전신', '패션', '취미', '자유 1', '자유 2', '자유 3'][slot], hint: '' })),
        PHOTO_REQUIRED_COUNT: 3,
        VERDICT_LABEL: { ok: 'ok', review: 'review', rejected: 'rejected', unchecked: 'unchecked' },
        photoSetComplete: (photos) => [0, 1, 2].every((slot) => photos.some((p) => p.slot === slot)) && photos.some((p) => p.isPrimary),
        requiredFilledCount: (photos) => [0, 1, 2].filter((slot) => photos.some((p) => p.slot === slot)).length,
        requestPhotoCheck: async () => ({ verdict: 'unchecked', reasons: [] }),
      };
      if (name.endsWith('/photoStorage')) return { SupabasePhotoAdapter: class {}, restorePhotos: async () => [], setPrimaryPhoto: async () => null, replacePhoto: async (...args) => { calls.push(['replace', ...args]); if (failUpload) throw new Error('offline'); return { photoId: 'replacement', storagePath: 'owner/1/new.jpg', url: 'private:new' }; }, signedUrlFor: async () => 'private:new', buildStoragePath: (owner, slot, id) => `${owner}/${slot + 1}/${id}.jpg`, PHOTO_SLOT_COUNT: 6 };
      throw new Error('Unexpected import: ' + name);
    },
  });
  const wrapper = exports.PhotoCapture({ userId: 'owner', onNext() {} });
  let first = true;
  const render = () => {
    cursor = 0;
    const tree = wrapper.type(wrapper.props);
    if (first && existing) {
      // Identify the saved photo state by its hook index: 8 refs, version, restore state/error, then saved.
      hooks[11] = { 0: existing };
      first = false;
      cursor = 0;
      return wrapper.type(wrapper.props);
    }
    first = false;
    return tree;
  };
  const nodes = (tree) => { const result = []; const visit = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(visit); return; } if (node.props) { result.push(node); visit(node.props.children); } }; visit(tree); return result; };
  const label = (node) => { const children = node?.props?.children; return typeof children === 'string' ? children : Array.isArray(children) ? children.map((c) => typeof c === 'string' ? c : '').join('') : ''; };
  const byText = (tree, text) => nodes(tree).find((node) => label(node) === text);
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const chooseAlbum = async () => {
    let tree = render();
    nodes(tree).find((node) => node.type === 'button' && node.props['aria-label']?.startsWith('전신')).props.onClick();
    tree = render(); byText(tree, '앨범에서 선택').props.onClick();
    tree = render(); nodes(tree).find((node) => node.type === 'input' && node.props.type === 'file').props.onChange({ currentTarget: { files: [new Blob(['file'])], value: 'photo.jpg' } });
    await flush(); return render();
  };
  return { render, nodes, byText, calls, flush, chooseAlbum };
}

test('unknown-date album selection cannot upload before explicit self-confirmation', async () => {
  const h = photoScreen(); let tree = await h.chooseAlbum();
  let confirm = h.byText(tree, '이 사진 올리기');
  assert.equal(confirm.props.disabled, true);
  confirm.props.onClick(); await h.flush(); assert.equal(h.calls.length, 0);
  const checkbox = h.nodes(tree).find((node) => node.type === 'input' && node.props.type === 'checkbox');
  checkbox.props.onChange({ target: { checked: true } });
  tree = h.render(); confirm = h.byText(tree, '이 사진 올리기'); assert.equal(confirm.props.disabled, false);
  confirm.props.onClick(); confirm.props.onClick(); await h.flush();
  assert.equal(h.calls.filter((call) => call[0] === 'upload').length, 1);
});

test('metadata-dated album still waits for preview confirmation before upload', async () => {
  const h = photoScreen({ checkKind: 'recent' }); const tree = await h.chooseAlbum();
  assert.equal(h.calls.length, 0);
  assert.equal(h.byText(tree, '이 사진 올리기').props.disabled, false);
  h.byText(tree, '이 사진 올리기').props.onClick(); await h.flush();
  assert.equal(h.calls.filter((call) => call[0] === 'upload').length, 1);
});

test('album replacement reuses the existing slot/path and preserves the old preview on failure', async () => {
  const previous = { slot: 0, photoId: 'old', storagePath: 'owner/1/old.jpg', url: 'private:old', isPrimary: true };
  const h = photoScreen({ checkKind: 'recent', existing: previous, failUpload: true });
  let tree = await h.chooseAlbum();
  h.byText(tree, '이 사진 올리기').props.onClick(); await h.flush();
  const replacement = h.calls.find((call) => call[0] === 'replace');
  assert.ok(replacement); assert.equal(replacement[2], 0); assert.equal(replacement[5], previous.storagePath);
  assert.equal(h.calls.filter((call) => call[0] === 'upload').length, 0);
  tree = h.render(); assert.ok(h.nodes(tree).some((node) => node.type === 'img' && node.props.src === 'private:old'));
  assert.ok(h.nodes(tree).some((node) => node.props.role === 'alert'));
});
