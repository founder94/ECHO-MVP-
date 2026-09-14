/** 마음 날씨 저장 상태 모듈 검사 — Readdy src/lib/echo/startSave.ts 사본 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StartSaveController, START_TIMEOUT_MS } from './startSave';

type R = { ok: boolean; conversationId?: string; status?: string; reason?: string; error?: string };
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }

describe('StartSaveController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('성공: 결과 반환 · 토큰 소모(다음 저장은 새 토큰)', async () => {
    const tokens = ['tok-000000001', 'tok-000000002']; const calls: string[] = [];
    const c = new StartSaveController<R>({ start: async (_t, token) => { calls.push(token); return { ok: true, conversationId: 'c1', status: 'step1' }; }, newToken: () => tokens.shift()! });
    const out = await c.submit('화창해');
    expect(out.kind).toBe('success'); expect(calls).toEqual(['tok-000000001']); expect(c.requestToken).toBe(''); expect(c.isInFlight).toBe(false);
    await c.submit('둘째'); expect(calls[1]).toBe('tok-000000002');
  });

  it('실패(ok:false): failure 반환 · 같은 토큰 유지 → 재시도는 같은 토큰', async () => {
    const calls: string[] = []; let n = 0;
    const c = new StartSaveController<R>({ start: async (_t, token) => { calls.push(token); n++; return n === 1 ? { ok: false, reason: 'error', error: 'AI 응답을 받지 못했어요.' } : { ok: true, conversationId: 'c2' }; }, newToken: () => 'tok-fixed-0001' });
    const a = await c.submit('x'); expect(a.kind).toBe('failure'); expect(c.requestToken).toBe('tok-fixed-0001'); expect(c.isInFlight).toBe(false);
    const b = await c.submit('x'); expect(b.kind).toBe('success'); expect(calls).toEqual(['tok-fixed-0001', 'tok-fixed-0001']);
  });

  it('네트워크 예외(reject): failure 로 종료(무한 대기 없음)', async () => {
    const c = new StartSaveController<R>({ start: async () => { throw new Error('fetch failed'); }, newToken: () => 'tok-fixed-0001' });
    const out = await c.submit('x'); expect(out.kind).toBe('failure'); if (out.kind === 'failure') expect(out.result.error).toBe('fetch failed');
  });

  it('시간 초과: 30초 뒤 timeout 반환 · 토큰 유지 · 서버 응답 전 재시도는 busy(새 요청 0건) · 응답 후 같은 토큰으로 재시도', async () => {
    const d = deferred<R>(); const calls: string[] = [];
    const c = new StartSaveController<R>({ start: (_t, token) => { calls.push(token); return d.promise; }, newToken: () => 'tok-fixed-0001' });
    const p = c.submit('x'); await vi.advanceTimersByTimeAsync(START_TIMEOUT_MS + 1);
    const out = await p; expect(out.kind).toBe('timeout'); expect(c.requestToken).toBe('tok-fixed-0001'); expect(c.isInFlight).toBe(true);
    const busy = await c.submit('x'); expect(busy.kind).toBe('busy'); expect(calls.length).toBe(1);
    d.resolve({ ok: true, conversationId: 'late' }); await vi.advanceTimersByTimeAsync(0); expect(c.isInFlight).toBe(false);
    const c2 = new StartSaveController<R>({ start: async (_t, token) => { calls.push(token); return { ok: true, conversationId: 'c-retry' }; }, newToken: () => 'never' });
    void c2; // 같은 컨트롤러로 재시도 시 토큰이 유지되는지 확인
    const retryCalls: string[] = []; (c as unknown as { deps: { start: (t: string, k: string) => Promise<R> } }).deps.start = async (_t, token) => { retryCalls.push(token); return { ok: true, conversationId: 'c-retry' }; };
    const r = await c.submit('x'); expect(r.kind).toBe('success'); expect(retryCalls).toEqual(['tok-fixed-0001']);
  });

  it('시간 초과 뒤 늦게 도착한 응답은 화면 결과를 바꾸지 않는다(이미 timeout 반환)', async () => {
    const d = deferred<R>();
    const c = new StartSaveController<R>({ start: () => d.promise, newToken: () => 'tok-fixed-0001' });
    const p = c.submit('x'); await vi.advanceTimersByTimeAsync(START_TIMEOUT_MS + 1); const out = await p; expect(out.kind).toBe('timeout');
    d.resolve({ ok: false, error: 'late' }); await vi.advanceTimersByTimeAsync(0); expect(c.isInFlight).toBe(false); expect(c.requestToken).toBe('tok-fixed-0001');
  });

  it('취소(화면 이탈) 뒤 도착한 응답은 stale', async () => {
    const d = deferred<R>();
    const c = new StartSaveController<R>({ start: () => d.promise, newToken: () => 'tok-fixed-0001' });
    const p = c.submit('x'); c.cancel(); d.resolve({ ok: true, conversationId: 'c9' }); await vi.advanceTimersByTimeAsync(0);
    expect((await p).kind).toBe('stale');
  });

  it('진행 중 연속 클릭: 두 번째는 busy · 서버 호출 1회', async () => {
    const d = deferred<R>(); let n = 0;
    const c = new StartSaveController<R>({ start: () => { n++; return d.promise; }, newToken: () => 'tok-fixed-0001' });
    const p1 = c.submit('x'); const p2 = await c.submit('x'); expect(p2.kind).toBe('busy'); expect(n).toBe(1);
    d.resolve({ ok: true, conversationId: 'c1' }); await vi.advanceTimersByTimeAsync(0); expect((await p1).kind).toBe('success');
  });
});
