import { useEffect, useRef } from 'react';

// 2026-10-10 기기 호환: 휴대폰 「뒤로」(Android 하드웨어·제스처 뒤로, iPhone 밀어서 뒤로)가 열린 창(바텀시트·메뉴·선택창)만 닫게 한다.
// 이용 안내 창(GuideHost)에서 이미 쓰던 방식을 여러 창이 함께 쓰도록 꺼냈다.
// - 열 때: 같은 주소의 기록 한 칸을 쌓는다(기존 기록 상태는 그대로 두고 표시만 더함 → 대화 화면의 뒤로 지킴이 echoBackGuard 와 같이 산다).
// - 뒤로: 그 칸이 빠지면(popstate) 창을 닫는다.
// - 닫기 버튼·바깥 누름으로 닫을 때: 내가 쌓은 칸이 지금 맨 위일 때만 한 칸 되돌린다(두 번 이동 0).
//   창 안의 링크로 다른 화면에 가면(그 위에 새 기록) 되돌리지 않고, 남은 칸은 나중에 「뒤로」로 지나갈 때 건너뛴다.
// 사진 창(PhotoDialog·CameraSheet)도 같은 훅을 쓸 수 있게 내보낸다.
const STATE_KEY = 'echoBackClose';
const openIds = new Set<string>();
let seq = 0;
let skipInstalled = false;

type HistoryState = Record<string, unknown> | null;
const readState = (): HistoryState => {
  try { return (window.history.state as HistoryState) ?? null; } catch { return null; }
};
const sameKeys = (a: HistoryState, keys: string) => Object.keys(a ?? {}).sort().join('|') === keys;

// 닫힌 창이 남긴 칸에 「뒤로」로 내려오면 한 칸 더 내려간다(같은 화면이 한 번 더 보이는 「먹통 뒤로」 0).
function installStaleSkip() {
  if (skipInstalled || typeof window === 'undefined') return;
  skipInstalled = true;
  window.addEventListener('popstate', () => {
    const owner = readState()?.[STATE_KEY];
    if (typeof owner === 'string' && !openIds.has(owner)) {
      try { window.history.back(); } catch { /* 기록을 못 다루는 환경 */ }
    }
  });
}

export function useBackClose(open: boolean, onClose: (() => void) | undefined) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const enabled = open && typeof onClose === 'function';

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    installStaleSkip();
    // 새로고침 뒤 남은 칸과 섞이지 않게 시각을 섞은 이름을 쓴다.
    const id = `${Date.now().toString(36)}-${(seq += 1)}`;
    let pushed = false;
    let cancelled = false;
    let keys = '';
    // 개발 모드(StrictMode)의 「켜기→끄기→켜기」가 칸을 두 번 쌓고 하나를 되돌리며 창을 닫지 않게, 쌓기는 이번 일이 끝난 직후로 미룬다.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const next = { ...(readState() ?? {}), [STATE_KEY]: id };
        window.history.pushState(next, '');
        keys = Object.keys(next).sort().join('|');
        pushed = true;
        openIds.add(id);
      } catch { pushed = false; }
    });
    const onPop = () => {
      if (!pushed) return;
      // 내 칸 위에 쌓인 것(이용 안내 창 등)이 닫힌 뒤로면 그대로 둔다.
      if (readState()?.[STATE_KEY] === id) return;
      pushed = false;
      openIds.delete(id);
      onCloseRef.current?.();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', onPop);
      openIds.delete(id);
      if (!pushed) return;
      pushed = false;
      // 화면 안 버튼으로 닫힘: 내가 쌓은 칸이 맨 위(다른 화면 이동·다른 창 0)일 때만 되돌린다.
      const state = readState();
      if (state?.[STATE_KEY] === id && sameKeys(state, keys)) {
        try { window.history.back(); } catch { /* 기록을 못 다루는 환경 */ }
      }
    };
  }, [enabled]);
}

export default useBackClose;
