import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Real source + mocked transport only. No network, tokens, production writes or photos.
// 2026-09-23: 불러오기에 시간 상한(withTimeout)이 붙었다. 검사에서도 실제 코드를 그대로 쓴다.
function realWithTimeout() {
  const exports = {};
  const path = 'src/doit/lib/withTimeout.ts';
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, { exports, setTimeout, clearTimeout, Promise, Error }, { filename: path });
  return exports;
}
function moduleWithClient(path, getClient) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, require(name) {
      if (name === '@/doit/lib/supabase') return { getSupabase: getClient };
      if (name === '@/doit/lib/withTimeout') return realWithTimeout();
      throw new Error(`Unexpected dependency: ${name}`);
    }, Date, Error, RangeError, Promise,
  }, { filename: path });
  return exports;
}

function harness(responses = [], sessions = ['owner']) {
  const calls = [];
  let authCall = 0;
  const client = {
    auth: { async getSession() {
      const id = sessions[Math.min(authCall++, sessions.length - 1)];
      return { data: { session: id ? { user: { id } } : null }, error: null };
    } },
    from(table) {
      const call = { table, steps: [] }; calls.push(call);
      const chain = {};
      for (const method of ['select', 'update', 'insert', 'eq', 'order']) {
        chain[method] = (...args) => { call.steps.push([method, ...args]); return chain; };
      }
      const resolve = async () => {
        assert.ok(responses.length, 'Unexpected database request');
        const result = responses.shift();
        if (result instanceof Error) throw result;
        return result;
      };
      chain.maybeSingle = resolve;
      chain.then = (yes, no) => resolve().then(yes, no);
      return chain;
    },
    storage: { from(bucket) {
      return { async createSignedUrl(path, expiry) {
        calls.push({ signed: { bucket, path, expiry } });
        if (path.endsWith('broken.jpg')) return { data: null, error: { message: 'failed' } };
        return { data: { signedUrl: `https://private.test/${path}?temporary=yes` }, error: null };
      } };
    } },
  };
  return { client, calls };
}
const source = 'src/doit/lib/profileSave.ts';
const photoSource = 'src/doit/lib/photoStorage.ts';
const draft = { nickname: '직접 쓴 이름', intro: '내가 고른 소개', region: '서울', lifeRhythm: '아침형' };
const result = (data) => ({ data, error: null });
const getBody = (call, method) => call.steps.find((step) => step[0] === method)?.[1];

test('existing profile updates only allowed fields; id remains a filter', async () => {
  const { client, calls } = harness([result({ id: 'owner' })]);
  const { saveProfileText } = moduleWithClient(source, () => client);
  assert.equal(await saveProfileText('owner', draft), null);
  assert.equal(calls.length, 1);
  assert.equal(getBody(calls[0], 'update').nickname, draft.nickname);
  assert.equal(Object.hasOwn(getBody(calls[0], 'update'), 'id'), false);
  assert.equal(Object.hasOwn(getBody(calls[0], 'update'), 'role'), false);
  assert.equal(Object.hasOwn(getBody(calls[0], 'update'), 'verification_status'), false);
  assert.ok(calls[0].steps.some((step) => step[0] === 'eq' && step[1] === 'id' && step[2] === 'owner'));
});

test('missing profile inserts with id only after update returns no row', async () => {
  const { client, calls } = harness([result(null), result({ id: 'owner' })]);
  const { savePurpose } = moduleWithClient(source, () => client);
  assert.equal(await savePurpose('owner', { purposeId: 'friend', purposeLabel: '친구' }), null);
  assert.equal(calls.length, 2);
  assert.equal(getBody(calls[1], 'insert').id, 'owner');
  assert.equal(getBody(calls[1], 'insert').purpose_id, 'friend');
});

test('concurrent initial profile creation retries UPDATE once on unique conflict', async () => {
  const { client, calls } = harness([result(null), { data: null, error: { code: '23505', message: 'duplicate' } }, result({ id: 'owner' })]);
  const { saveProfileText } = moduleWithClient(source, () => client);
  assert.equal(await saveProfileText('owner', draft), null);
  assert.equal(calls.length, 3);
  assert.equal(Object.hasOwn(getBody(calls[2], 'update'), 'id'), false);
});

test('UPDATE permission error never inserts or reports success', async () => {
  const { client, calls } = harness([{ data: null, error: { code: '42501', message: 'denied' } }]);
  const { saveProfileText } = moduleWithClient(source, () => client);
  assert.equal(await saveProfileText('owner', draft), 'denied');
  assert.equal(calls.length, 1);
});

test('unconfirmed INSERT is not success', async () => {
  const { client } = harness([result(null), result(null)]);
  const { saveProfileText } = moduleWithClient(source, () => client);
  assert.notEqual(await saveProfileText('owner', draft), null);
});

test('blocked zero-row UPDATE after conflict is not success and does not loop', async () => {
  const { client, calls } = harness([result(null), { data: null, error: { code: '23505', message: 'duplicate' } }, result(null)]);
  const { saveProfileText } = moduleWithClient(source, () => client);
  assert.notEqual(await saveProfileText('owner', draft), null);
  assert.equal(calls.length, 3);
});

test('logged-out or switched account cannot submit previous owner profile', async () => {
  for (const session of [null, 'other']) {
    const { client, calls } = harness([], [session]);
    const { saveProfileText } = moduleWithClient(source, () => client);
    assert.notEqual(await saveProfileText('owner', draft), null);
    assert.equal(calls.length, 0);
  }
});

test('transport exception becomes a save error, never success', async () => {
  const { client } = harness([new Error('offline')]);
  const { saveProfileText } = moduleWithClient(source, () => client);
  assert.notEqual(await saveProfileText('owner', draft), null);
});

test('restored photos use owner-filtered database rows and private signed URLs', async () => {
  const { client, calls } = harness([result([{ id: 'p1', slot: 2, storage_path: 'owner/2/photo.jpg', is_primary: true }])]);
  const { restorePhotos } = moduleWithClient(photoSource, () => client);
  const photos = await restorePhotos('owner');
  assert.equal(photos.length, 1);
  assert.equal(photos[0].slot, 1);
  assert.equal(photos[0].isPrimary, true);
  assert.ok(photos[0].url.startsWith('https://private.test/owner/'));
  assert.ok(calls[0].steps.some((step) => step[0] === 'eq' && step[1] === 'user_id' && step[2] === 'owner'));
  assert.equal(calls[1].signed.bucket, 'profile-photos');
  assert.equal(calls[1].signed.expiry, 300);
});

test('empty photo collection stays empty; no sample photos', async () => {
  const { client, calls } = harness([result([])]);
  const { restorePhotos } = moduleWithClient(photoSource, () => client);
  assert.equal((await restorePhotos('owner')).length, 0);
  assert.equal(calls.length, 1);
});

test('signed URL failure stays an error rather than an empty photo collection', async () => {
  const { client } = harness([result([{ id: 'p1', slot: 1, storage_path: 'owner/1/broken.jpg', is_primary: false }])]);
  const { restorePhotos } = moduleWithClient(photoSource, () => client);
  await assert.rejects(restorePhotos('owner'), (error) => error.code === 'SIGNED_URL_FAILED');
});

test('foreign storage path is rejected even if returned in a profile row', async () => {
  const { client, calls } = harness([result([{ id: 'p1', slot: 1, storage_path: 'other/1/photo.jpg', is_primary: false }])]);
  const { restorePhotos } = moduleWithClient(photoSource, () => client);
  await assert.rejects(restorePhotos('owner'), (error) => error.code === 'DB_READ_FAILED');
  assert.equal(calls.length, 1);
});

test('account switch during photo query stops URL signing', async () => {
  const { client, calls } = harness([result([{ id: 'p1', slot: 1, storage_path: 'owner/1/photo.jpg', is_primary: false }])], ['owner', 'other']);
  const { restorePhotos } = moduleWithClient(photoSource, () => client);
  await assert.rejects(restorePhotos('owner'), (error) => error.code === 'AUTH_REQUIRED');
  assert.equal(calls.length, 1);
});

test('zero-row primary selection reports failure and attempts previous primary restore', async () => {
  const { client, calls } = harness([result({ slot: 1 }), result({ slot: 1 }), result(null), result(null)]);
  const { setPrimaryPhoto } = moduleWithClient(photoSource, () => client);
  assert.notEqual(await setPrimaryPhoto('owner', 1), null);
  assert.equal(calls.length, 4);
  assert.equal(getBody(calls[3], 'update').is_primary, true);
  assert.ok(calls[3].steps.some((step) => step[0] === 'eq' && step[1] === 'slot' && step[2] === 1));
});
