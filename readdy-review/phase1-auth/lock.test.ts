/**
 * Readdy src/lib/supabase/client.ts 의 custom acquireLock 을 supabase-js 2.57.4(auth-js 2.71.1)의
 * lock 계약(acquireTimeout: -1 = 무한 대기, 0 = 즉시 시도, >0 = 대기 시간)에 대해 실행 검증한다.
 * 가짜 LockManager(Web Locks 스펙 동작 모사) 위에서 원본 wrapper 와 supabase 기본 navigatorLock 을 비교한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navigatorLock } from '@supabase/auth-js';

type LockCb<R> = (lock: { name: string } | null) => Promise<R>;
interface ReqOpts { ifAvailable?: boolean; signal?: AbortSignal; mode?: string }

class FakeLockManager {
  private held = new Map<string, Promise<void>>();
  async request<R>(name: string, opts: ReqOpts, cb: LockCb<R>): Promise<R> {
    while (this.held.get(name)) {
      if (opts.ifAvailable) return cb(null);
      if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      await this.held.get(name);
    }
    let release!: () => void;
    this.held.set(name, new Promise<void>((r) => (release = r)));
    try {
      return await cb({ name });
    } finally {
      this.held.delete(name);
      release();
    }
  }
  hold(name: string): () => void {
    let release!: () => void;
    this.held.set(name, new Promise<void>((r) => (release = r)));
    return () => { this.held.delete(name); release(); };
  }
}

const captured: { lock?: <R>(n: string, t: number, fn: () => Promise<R>) => Promise<R> } = {};
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_u: string, _k: string, opts: { auth: { lock?: never } }) => {
    captured.lock = opts.auth.lock as never;
    return {};
  },
}));
await import('./original/src/lib/supabase/client');
const originalLock = captured.lock!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function slowFn(counter: { calls: number }, ms = 20) {
  return async () => { counter.calls += 1; await sleep(ms); return 'ok'; };
}

let locks: FakeLockManager;
beforeEach(() => {
  locks = new FakeLockManager();
  vi.stubGlobal('navigator', { locks });
});

describe('Readdy custom acquireLock (원본)', () => {
  it('acquireTimeout=-1(supabase 기본값)에서 fn이 두 번 실행된다 — race가 즉시 거부되고 catch에서 재호출', async () => {
    const c = { calls: 0 };
    const result = await originalLock('lock:sb', -1, slowFn(c));
    await sleep(40);
    expect(result).toBe('ok');
    expect(c.calls).toBe(2);
  });

  it('acquireTimeout=0(autoRefresh tick)에서도 fn이 두 번 실행된다', async () => {
    const c = { calls: 0 };
    await originalLock('lock:sb', 0, slowFn(c));
    await sleep(40);
    expect(c.calls).toBe(2);
  });

  it('다른 탭이 잠금을 쥐고 있어도 기다리지 않고 잠금 없이 실행한다 (ifAvailable 고정)', async () => {
    const release = locks.hold('lock:sb');
    const c = { calls: 0 };
    const p = originalLock('lock:sb', -1, slowFn(c));
    await sleep(5);
    expect(c.calls).toBe(1); // 잠금 해제 전에 이미 실행됨
    release();
    await p;
  });
});

describe('supabase 기본 navigatorLock (패치 후 사용되는 구현)', () => {
  it('acquireTimeout=-1에서 fn이 정확히 한 번 실행된다', async () => {
    const c = { calls: 0 };
    const result = await navigatorLock('lock:sb', -1, slowFn(c));
    await sleep(40);
    expect(result).toBe('ok');
    expect(c.calls).toBe(1);
  });

  it('다른 탭이 잠금을 쥐고 있으면 해제될 때까지 기다린 뒤 실행한다', async () => {
    const release = locks.hold('lock:sb');
    const c = { calls: 0 };
    const p = navigatorLock('lock:sb', -1, slowFn(c));
    await sleep(15);
    expect(c.calls).toBe(0); // 대기 중
    release();
    await p;
    expect(c.calls).toBe(1);
  });

  it('acquireTimeout=0에서 잠금이 바쁘면 실행하지 않고 즉시 실패한다 (refresh 중복 방지)', async () => {
    const release = locks.hold('lock:sb');
    const c = { calls: 0 };
    await expect(navigatorLock('lock:sb', 0, slowFn(c))).rejects.toThrow();
    expect(c.calls).toBe(0);
    release();
  });
});
