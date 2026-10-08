// 3D 층을 켤지 정하는 문지기. 하나라도 걸리면 층을 켜지 않고 원래 첫 화면(지구 그림·CSS 별)으로 둔다.
import type { SceneId } from './registry';

export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export type GateReason = 'off' | 'no-window' | 'reduced-motion' | 'save-data' | 'low-memory' | 'no-webgl';
export interface GateResult { ok: boolean; reason?: GateReason }

const matches = (q: string) => { try { return typeof window.matchMedia === 'function' && window.matchMedia(q).matches; } catch { return false; } };

interface NetInfo { saveData?: boolean; effectiveType?: string }
const connection = (): NetInfo | undefined => (navigator as Navigator & { connection?: NetInfo }).connection;
const deviceMemory = (): number | undefined => (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function heroLayerGate(id: SceneId): GateResult {
  if (id === 'none') return { ok: false, reason: 'off' };
  if (typeof window === 'undefined' || typeof document === 'undefined') return { ok: false, reason: 'no-window' };
  // 움직임 줄이기: CSS 는 brand-home.css 가 끄지만 WebGL 은 JS 가 끈다(켜지 않는다).
  if (matches(REDUCED_QUERY)) return { ok: false, reason: 'reduced-motion' };
  const net = connection();
  if (net?.saveData === true || net?.effectiveType === 'slow-2g' || net?.effectiveType === '2g') return { ok: false, reason: 'save-data' };
  const mem = deviceMemory();
  if (typeof mem === 'number' && mem <= 2) return { ok: false, reason: 'low-memory' };
  if (!hasWebGL()) return { ok: false, reason: 'no-webgl' };
  return { ok: true };
}

/** 첫 그림(지구·워드마크 fetchPriority high)이 다 뜬 뒤 한가할 때 한 번 부른다. 되돌리기 함수를 돌려준다. */
export function whenIdleAfterLoad(run: () => void, timeoutMs = 1500): () => void {
  let cancelled = false;
  let idleId: number | null = null;
  let timer: number | null = null;
  const idle = () => {
    if (cancelled) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === 'function') idleId = w.requestIdleCallback(() => { if (!cancelled) run(); }, { timeout: timeoutMs });
    else timer = window.setTimeout(() => { if (!cancelled) run(); }, 200);
  };
  const onLoad = () => idle();
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', onLoad, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', onLoad);
    const w = window as Window & { cancelIdleCallback?: (id: number) => void };
    if (idleId !== null && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId);
    if (timer !== null) window.clearTimeout(timer);
  };
}
