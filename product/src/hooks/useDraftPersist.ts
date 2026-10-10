import { useCallback, useEffect, useRef } from 'react';

// 2026-10-10 기기 호환: 적던 말 지키기. Android 는 사진 고르기·카메라·다른 앱을 여는 동안 이 탭을 내려놓았다가(메모리 부족)
// 돌아오면 화면을 새로 그린다 — 그때 입력칸에 적던 말이 사라졌다.
// - 이 탭의 sessionStorage 에만 둔다(탭을 닫으면 사라짐 · 서버 전송 0). localStorage 에는 두지 않는다(같은 기기의 다른 사람·다음 방문에 남지 않게).
// - 이름 = 사용자 id(있을 때) + 화면/대화 id. 다른 계정·다른 대화의 글이 섞이지 않는다.
// - 적는 동안 잠깐 쉬면(0.4초) 저장 · 화면이 가려질 때(visibilitychange hidden·pagehide) 바로 저장 · 다시 열면 비어 있는 칸에만 되살림.
// - 보내기에 성공하면 clear() 로 지운다(빈 칸이 되어도 지운다). 저장이 막힌 환경(사생활 보호 모드 등)에서는 조용히 넘어간다.
const PREFIX = 'echo:draft:';
const SAVE_DELAY_MS = 400;

export function draftKey(screen: string, userId?: string | null, sessionId?: string | null): string {
  return `${PREFIX}${screen}:${userId || 'anon'}${sessionId ? `:${sessionId}` : ''}`;
}

export function readDraft(key: string): string {
  try { return window.sessionStorage.getItem(key) ?? ''; } catch { return ''; }
}

export function writeDraft(key: string, value: string): void {
  try {
    if (value.trim()) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch { /* 저장이 막힌 환경 */ }
}

// key 가 null 이면(아직 대화를 불러오는 중 등) 아무것도 하지 않는다. enabled=false 면 저장만 멈춘다(직전 답 고치기처럼 「새 말」이 아닌 글).
export function useDraftPersist(key: string | null, value: string, restore: (saved: string) => void, enabled = true) {
  const restoredRef = useRef<string | null>(null);
  const pendingRestoreRef = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const latest = useRef({ key, value, enabled });
  latest.current = { key, value, enabled };

  useEffect(() => {
    if (!key || restoredRef.current === key) return;
    restoredRef.current = key;
    const saved = readDraft(key);
    pendingRestoreRef.current = !!saved;
    if (saved) restoreRef.current(saved);
  }, [key]);

  useEffect(() => {
    if (!key || !enabled || restoredRef.current !== key) return;
    // 비었으면(보냈거나 지웠음) 바로 지운다 — 그 사이 탭이 내려가도 보낸 말이 되살아나지 않게.
    // 단, 되살리는 바로 그 순간(아직 빈 칸)에는 지우지 않는다.
    if (!value.trim()) { if (!pendingRestoreRef.current) writeDraft(key, ''); return; }
    pendingRestoreRef.current = false;
    const timer = window.setTimeout(() => writeDraft(key, value), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, value, enabled]);

  useEffect(() => {
    const flush = () => {
      const { key: k, value: v, enabled: on } = latest.current;
      if (k && on && restoredRef.current === k) writeDraft(k, v);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', flush); };
  }, []);

  return useCallback(() => { const k = latest.current.key; if (k) writeDraft(k, ''); }, []);
}

export default useDraftPersist;
