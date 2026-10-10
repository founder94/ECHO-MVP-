import { IS_APP_SITE } from '@/lib/siteRole';

// 앱 시작 때 한 번 거는 안전장치 두 가지(2026-10-10 갤럭시·아이폰 호환).

// 1) 배포 직후 옛 화면이 사라진 코드 조각(/assets/*.js)을 부르면 Vite 가 vite:preloadError 를 알린다.
//    그때 한 번만 새로 고쳐 새 화면을 받는다. 30초 안에 또 실패하면 다시 고치지 않는다(무한 새로 고침 방지).
const CHUNK_RELOAD_KEY = 'echo:chunk-reload-at';
const CHUNK_RELOAD_GUARD_MS = 30_000;

export function reloadOnceOnStaleChunk(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
      if (Date.now() - last < CHUNK_RELOAD_GUARD_MS) return; // 방금 고쳤는데 또 실패 → 원래 오류 화면에 맡긴다
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      return; // 기록이 막힌 환경에서는 반복을 막을 수 없어 고치지 않는다
    }
    event.preventDefault();
    window.location.reload();
  });
}

// 2) 서비스 워커(public/sw.js): 삼성 인터넷이 「앱 설치」를 띄우는 조건. 캐시 없음 · 통과만.
//    운영 앱 빌드에서만, 화면을 다 받은 뒤(load) 등록한다. 브랜드·관리자·통합 빌드와 개발 서버에서는 등록하지 않는다.
export function registerAppServiceWorker(): void {
  if (!IS_APP_SITE || !import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const base = (__BASE_PATH__ || '/').replace(/\/$/, '');
  const register = () => {
    try {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/`, updateViaCache: 'none' }).catch(() => {
        /* 등록 실패해도 앱은 그대로 쓴다 */
      });
    } catch {
      /* 등록 실패해도 앱은 그대로 쓴다 */
    }
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
