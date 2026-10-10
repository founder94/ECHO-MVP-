// Google 로그인처럼 외부 페이지를 거쳐 돌아오는 동안만 잠깐 들고 있는 값(돌아갈 경로·약관 동의).
// 2026-10-10 갤럭시·아이폰 호환: 예전에는 sessionStorage(탭 하나)에 두어, 홈 화면 앱이 로그인을 브라우저로 넘기거나
// 다른 탭으로 돌아오면 값이 사라졌다. 이제 localStorage 에 저장 시각과 함께 두고 10분이 지나면 버린다.
// 비밀번호·토큰은 다루지 않는다.

export const ROUNDTRIP_TTL_MS = 10 * 60 * 1000;

export function saveRoundtripValue(key: string, value: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(key, JSON.stringify({ value, savedAt: now }));
  } catch {
    /* 저장이 막힌 환경: 돌아온 뒤 기본값으로 */
  }
}

// 한 번 꺼내면 지운다. 10분이 지났거나 깨진 값은 버린다.
// 예전 판이 sessionStorage 에 값 그대로 둔 것도 한 릴리스 동안 함께 읽는다(배포 직전에 Google 로 떠난 사람).
export function takeRoundtripValue(key: string, now: number = Date.now()): string | null {
  let fresh: string | null = null;
  try {
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { value?: unknown; savedAt?: unknown } | null;
      const age = typeof parsed?.savedAt === 'number' ? now - parsed.savedAt : -1;
      if (typeof parsed?.value === 'string' && age >= 0 && age <= ROUNDTRIP_TTL_MS) fresh = parsed.value;
    }
  } catch {
    fresh = null;
  }
  let legacy: string | null = null;
  try {
    legacy = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
  } catch {
    legacy = null;
  }
  return fresh ?? legacy;
}
