import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());
const startModule = await import(pathToFileURL(resolve(projectRoot, 'src/lib/echo/startSave.ts')).href);
const journeyModule = await import(pathToFileURL(resolve(projectRoot, 'src/lib/echo/journeySave.ts')).href);
const { StartSaveController } = startModule;
const { JourneySaveController } = journeyModule;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('start: timeout keeps token, blocks overlap, and retries idempotently', async () => {
  const first = deferred<{ ok: boolean; conversationId?: string }>();
  const tokens: string[] = [];
  let call = 0;
  const controller = new StartSaveController({
    timeoutMs: 5,
    newToken: () => 'token-a',
    start: async (_text, token) => {
      tokens.push(token);
      call += 1;
      if (call === 1) return first.promise;
      return { ok: true, conversationId: 'conversation-1' };
    },
  });

  assert.equal((await controller.submit('same text')).kind, 'timeout');
  // 2026-09-16: 시간 초과 뒤에는 잠기지 않고(busy 아님) 같은 토큰으로 다시 보낸다. 서버가 토큰으로 중복을 판정한다.
  assert.equal(controller.isInFlight, false);
  assert.equal((await controller.submit('same text')).kind, 'success');
  first.resolve({ ok: true, conversationId: 'conversation-1' });
  await tick();
  assert.deepEqual(tokens, ['token-a', 'token-a']);
  assert.equal(controller.requestToken, '');
});

test('start: changed text receives a new token after a timed-out request settles', async () => {
  const first = deferred<{ ok: boolean; conversationId?: string }>();
  const tokens = ['token-a', 'token-b'];
  const seen: string[] = [];
  let call = 0;
  const controller = new StartSaveController({
    timeoutMs: 5,
    newToken: () => tokens.shift() ?? 'unexpected',
    start: async (_text, token) => {
      seen.push(token);
      call += 1;
      if (call === 1) return first.promise;
      return { ok: true, conversationId: 'conversation-2' };
    },
  });

  assert.equal((await controller.submit('before')).kind, 'timeout');
  first.resolve({ ok: true, conversationId: 'conversation-2' });
  await tick();
  assert.equal((await controller.submit('after')).kind, 'success');
  assert.deepEqual(seen, ['token-a', 'token-b']);
});

test('start: a server failure preserves the token for a safe retry', async () => {
  const seen: string[] = [];
  let call = 0;
  const controller = new StartSaveController({
    newToken: () => 'stable-token',
    start: async (_text, token) => {
      seen.push(token);
      call += 1;
      return call === 1 ? { ok: false, error: 'failed' } : { ok: true, conversationId: 'conversation-3' };
    },
  });

  assert.equal((await controller.submit('keep me')).kind, 'failure');
  assert.equal((await controller.submit('keep me')).kind, 'success');
  assert.deepEqual(seen, ['stable-token', 'stable-token']);
});

test('journey: only a successful server result advances and clears the token', async () => {
  const seen: string[] = [];
  let call = 0;
  const controller = new JourneySaveController({
    newToken: () => 'journey-token',
    submit: async (_text, token) => {
      seen.push(token);
      call += 1;
      return call === 1 ? { ok: false, status: 'step7', error: 'save failed' } : { ok: true, status: 'report_ready' };
    },
  });

  const failed = await controller.save('step seven answer');
  assert.equal(failed.kind, 'failure');
  assert.equal(failed.result.status, 'step7');
  const succeeded = await controller.save('step seven answer');
  assert.equal(succeeded.kind, 'success');
  assert.equal(succeeded.result.status, 'report_ready');
  assert.deepEqual(seen, ['journey-token', 'journey-token']);
});

test('journey: cancel marks a late response stale', async () => {
  const pending = deferred<{ ok: boolean; status: string }>();
  const controller = new JourneySaveController({
    timeoutMs: 100,
    newToken: () => 'journey-token',
    submit: () => pending.promise,
  });
  const result = controller.save('answer');
  controller.cancel();
  pending.resolve({ ok: true, status: 'step4' });
  assert.equal((await result).kind, 'stale');
});
