// 세션 저장소 (대표 지시 2026-09-22: 브랜드 do-it.company 와 앱 app.do-it.company 가 같은 로그인 상태를 봐야 한다)
// 브라우저의 localStorage 는 주소(origin)마다 따로라서 두 주소가 로그인 상태를 공유하지 못한다.
// 그래서 do-it.company 계열 주소에서는 세션을 도메인 쿠키(Domain=do-it.company)에 저장한다. 두 주소 모두 같은 쿠키를 읽고 쓴다.
// - 쿠키 하나는 4KB 상한이라 값을 조각(chunk)으로 나눠 여러 쿠키에 저장한다.
// - 쿠키를 쓸 수 없는 환경(차단·비대응)이나 다른 호스트(localhost·미리보기 주소)에서는 localStorage 를 그대로 쓴다.
// - 처음 한 번, 예전 localStorage 세션이 있으면 쿠키로 옮긴 뒤 localStorage 쪽은 지운다(두 곳이 어긋나 유령 로그인이 남지 않게).
// 보안: 이 쿠키는 HttpOnly 가 아니다(브라우저 JS가 읽어야 한다). 노출 범위는 localStorage 와 같고, 우리 서브도메인끼리만 공유된다.
export const SHARED_COOKIE_DOMAIN = 'do-it.company';
const CHUNK_SIZE = 3_000; // 쿠키 이름·속성을 더해도 4KB 안에 들어오는 크기
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // 세션 갱신 토큰 수명보다 길게. 실제 만료는 Supabase 가 정한다.
const PROBE_KEY = 'doit-cookie-probe';

export interface SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// 호스트가 공유 도메인에 속하면 그 도메인을, 아니면 null 을 준다.
export function sharedCookieDomain(hostname: string): string | null {
  const host = hostname.toLowerCase();
  return host === SHARED_COOKIE_DOMAIN || host.endsWith(`.${SHARED_COOKIE_DOMAIN}`) ? SHARED_COOKIE_DOMAIN : null;
}

interface CookieJar { read(): string; write(cookie: string): void }

function parseCookies(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of raw.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    if (name) map.set(name, part.slice(at + 1).trim());
  }
  return map;
}

const chunkName = (key: string, index: number) => `${key}.${index}`;

// 쿠키 조각 저장소. jar 를 주입받아 검사에서 가짜 쿠키로 확인할 수 있다.
export function createCookieChunkStorage(jar: CookieJar, domain: string, secure: boolean): SessionStorageAdapter {
  const attrs = `Domain=${domain}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
  const put = (name: string, value: string) => jar.write(`${name}=${value}; Max-Age=${MAX_AGE_SECONDS}; ${attrs}`);
  const drop = (name: string) => jar.write(`${name}=; Max-Age=0; ${attrs}`);
  const readChunks = (key: string): string[] => {
    const all = parseCookies(jar.read());
    const chunks: string[] = [];
    for (let i = 0; ; i++) {
      const value = all.get(chunkName(key, i));
      if (value === undefined) break;
      chunks.push(value);
    }
    return chunks;
  };
  return {
    getItem(key) {
      const chunks = readChunks(key);
      if (!chunks.length) return null;
      try { return decodeURIComponent(chunks.join('')); } catch { return null; }
    },
    setItem(key, value) {
      const encoded = encodeURIComponent(value);
      const before = readChunks(key).length;
      let count = 0;
      for (let at = 0; at < encoded.length; at += CHUNK_SIZE) put(chunkName(key, count++), encoded.slice(at, at + CHUNK_SIZE));
      for (let i = count; i < before; i++) drop(chunkName(key, i)); // 값이 짧아졌으면 남은 조각을 지운다
    },
    removeItem(key) {
      const count = readChunks(key).length;
      for (let i = 0; i < count; i++) drop(chunkName(key, i));
    },
  };
}

// 쿠키를 실제로 쓰고 읽을 수 있는지 한 번 확인한다(차단된 브라우저는 false).
function cookiesUsable(jar: CookieJar, domain: string, secure: boolean): boolean {
  try {
    const probe = createCookieChunkStorage(jar, domain, secure);
    probe.setItem(PROBE_KEY, 'ok');
    const ok = probe.getItem(PROBE_KEY) === 'ok';
    probe.removeItem(PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
}

// 브라우저용 세션 저장소를 만든다. 공유 도메인이 아니거나 쿠키를 못 쓰면 undefined(= Supabase 기본 localStorage).
export function createSharedSessionStorage(win: Window | undefined = typeof window === 'undefined' ? undefined : window): SessionStorageAdapter | undefined {
  if (!win) return undefined;
  const domain = sharedCookieDomain(win.location.hostname);
  if (!domain) return undefined;
  const jar: CookieJar = { read: () => win.document.cookie, write: (cookie) => { win.document.cookie = cookie; } };
  const secure = win.location.protocol === 'https:';
  if (!cookiesUsable(jar, domain, secure)) return undefined;
  const cookies = createCookieChunkStorage(jar, domain, secure);
  let local: Storage | null = null;
  try { local = win.localStorage; } catch { local = null; }
  return {
    getItem(key) {
      const fromCookie = cookies.getItem(key);
      if (fromCookie !== null) return fromCookie;
      // 처음 한 번: 예전 localStorage 세션을 쿠키로 옮긴다.
      const legacy = local?.getItem(key) ?? null;
      if (legacy !== null) {
        cookies.setItem(key, legacy);
        try { local?.removeItem(key); } catch { /* 지우지 못해도 쿠키가 우선이다 */ }
      }
      return legacy;
    },
    setItem(key, value) {
      cookies.setItem(key, value);
      try { local?.removeItem(key); } catch { /* 무시 */ }
    },
    removeItem(key) {
      cookies.removeItem(key);
      try { local?.removeItem(key); } catch { /* 무시 */ }
    },
  };
}
