import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';

// ── supabase 클라이언트 모의 (네트워크 없음) ──
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };
const selectQueue: QueryResult[] = [];
const insertQueue: QueryResult[] = [];
const calls = { select: 0, insert: 0 };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.select += 1;
            return selectQueue.shift() ?? { data: null, error: { message: 'queue empty' } };
          },
        }),
      }),
      insert: async () => {
        calls.insert += 1;
        return insertQueue.shift() ?? { data: null, error: { message: 'queue empty' } };
      },
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));
vi.mock('@/hooks/useAnalytics', () => ({
  recordAuthEvent: () => {},
  linkVisitorToUser: () => {},
  getVisitorId: () => null,
}));

const { loadUserProfile, buildOAuthRedirectUrl, rememberReturnPath, consumeReturnPath } = await import('./useAuth');

const user = { id: 'u-1', email: 'a@b.c', user_metadata: { full_name: '홍길동' } } as unknown as User;
const row = { id: 'u-1', email: 'a@b.c', name: '홍길동', age_group: null, onboarding_answers: [], role: 'admin', payment_status: 'paid' };

beforeEach(() => {
  selectQueue.length = 0;
  insertQueue.length = 0;
  calls.select = 0;
  calls.insert = 0;
});

describe('PROFILE_EXISTS 판정 (loadUserProfile)', () => {
  it('행이 있으면 exists — INSERT 하지 않는다', async () => {
    selectQueue.push({ data: row, error: null });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('exists');
    expect(r.profile?.role).toBe('admin');
    expect(calls.insert).toBe(0);
  });

  it('조회가 실패하면 error — 행 없음으로 오인하지 않고 INSERT도 하지 않는다', async () => {
    selectQueue.push({ data: null, error: { message: 'network' } });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('error');
    expect(r.profile).toBeNull();
    expect(calls.insert).toBe(0);
  });

  it('행이 없으면 INSERT 후 created (role은 null — 프론트가 admin을 만들지 않는다)', async () => {
    selectQueue.push({ data: null, error: null });
    insertQueue.push({ data: null, error: null });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('created');
    expect(r.profile?.role).toBeNull();
    expect(calls.insert).toBe(1);
  });

  it('동시 생성으로 23505가 나면 다시 읽어 exists로 수렴한다', async () => {
    selectQueue.push({ data: null, error: null });
    insertQueue.push({ data: null, error: { code: '23505', message: 'duplicate key' } });
    selectQueue.push({ data: row, error: null });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('exists');
    expect(r.profile?.role).toBe('admin');
    expect(calls.select).toBe(2);
  });

  it('INSERT가 다른 이유로 실패하면 missing (기존 데이터 덮어쓰기 없음)', async () => {
    selectQueue.push({ data: null, error: null });
    insertQueue.push({ data: null, error: { code: '42501', message: 'rls' } });
    const r = await loadUserProfile(user);
    expect(r.status).toBe('missing');
    expect(r.profile).toBeNull();
  });
});

describe('REDIRECT_TARGET 판정 (buildOAuthRedirectUrl)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://ixxrjb.readdy.co' } });
    vi.stubGlobal('__BASE_PATH__', '/');
  });

  it('VITE_PUBLIC_SITE_URL이 있으면 현재 origin(미리보기 도메인)이 아니라 운영 도메인으로 복귀한다', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://do-it.company/');
    expect(buildOAuthRedirectUrl()).toBe('https://do-it.company/');
  });

  it('VITE_PUBLIC_SITE_URL이 없으면 현재 origin으로 복귀한다 (미리보기 도메인 잔류 원인)', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '');
    expect(buildOAuthRedirectUrl()).toBe('https://ixxrjb.readdy.co/');
  });

  it('http(s)가 아닌 값은 무시한다', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'do-it.company');
    expect(buildOAuthRedirectUrl()).toBe('https://ixxrjb.readdy.co/');
  });

  it('하위 경로 배포(__BASE_PATH__=/app/)면 접두사를 붙인다', () => {
    vi.stubGlobal('__BASE_PATH__', '/app/');
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://do-it.company');
    expect(buildOAuthRedirectUrl()).toBe('https://do-it.company/app/');
  });
});

describe('복귀 경로 (rememberReturnPath / consumeReturnPath)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('앱 내부 경로는 한 번만 꺼내진다', () => {
    rememberReturnPath('/admin');
    expect(consumeReturnPath()).toBe('/admin');
    expect(consumeReturnPath()).toBeNull();
  });

  it('외부 URL·프로토콜 상대 경로는 저장하지 않는다 (오픈 리다이렉트 차단)', () => {
    rememberReturnPath('https://evil.example');
    expect(consumeReturnPath()).toBeNull();
    rememberReturnPath('//evil.example');
    expect(consumeReturnPath()).toBeNull();
  });

  it('/auth 로 되돌아가는 경로는 무시한다 (로그인 루프 방지)', () => {
    rememberReturnPath('/auth?mode=login');
    expect(consumeReturnPath()).toBeNull();
  });
});
