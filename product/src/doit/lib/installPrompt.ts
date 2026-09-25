// 갤럭시(크롬·삼성 인터넷)가 보내는 "설치할 수 있어요" 신호(beforeinstallprompt)를 앱 시작 때부터 붙잡아 둔다.
// 이 신호는 앱 홈이 열리기 전(온보딩 중)에 올 수 있어서, 화면이 아니라 앱 시작 시점에 듣는다.
//
// preventDefault 는 부르지 않는다. 대표 갤럭시에서 이미 뜬 브라우저 자체 설치 창을 막지 않기 위해서다.
// 우리 버튼으로 창을 띄우지 못하면(브라우저가 거절) 화면이 메뉴에서 직접 받는 방법으로 바꿔 보여 준다.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Listener = () => void;

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();
let started = false;

function emit(): void {
  listeners.forEach((listener) => {
    try { listener(); } catch { /* 화면 하나의 실패가 다른 화면을 막지 않게 한다 */ }
  });
}

export function startInstallPromptCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    deferred = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function wasInstalledNow(): boolean {
  return installed;
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export type PromptResult = 'accepted' | 'dismissed' | 'unavailable';

// 설치 창을 띄운다. 한 번 쓴 신호는 다시 쓸 수 없어서 비운다.
// 창을 못 띄우면 'unavailable' — 화면은 메뉴에서 받는 방법을 보여 준다(빠져나갈 문).
export async function promptInstall(): Promise<PromptResult> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  emit();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}
