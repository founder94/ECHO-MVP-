import { useEffect, useState, useSyncExternalStore } from 'react';
import { detectInstallContext, isKakaoInApp, kakaoOpenExternalUrl, type InstallContext } from '@/doit/lib/installContext';
import { canPromptInstall, promptInstall, subscribeInstallPrompt, wasInstalledNow } from '@/doit/lib/installPrompt';
import { IS_BRAND_SITE } from '@/lib/siteRole';
import './install-app.css';

// 휴대폰에 DO IT 을 앱으로 받는 안내 (대표 2026-09-23 "아이폰이랑 갤럭시 기계에 어플 받을 수 있게").
// - 이미 앱으로 열려 있으면 아무것도 보이지 않는다.
// - "나중에"를 누르면 한 줄 버튼으로 접어 둔다(다시 펼칠 수 있다). 이 브라우저에만 기억한다.
// - 설치 창을 못 띄우는 경우에도 메뉴에서 직접 받는 방법이 항상 남는다.

const COLLAPSE_KEY = 'doit:install-card';

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === 'collapsed'; } catch { return false; }
}
function writeCollapsed(value: boolean): void {
  try {
    if (value) localStorage.setItem(COLLAPSE_KEY, 'collapsed');
    else localStorage.removeItem(COLLAPSE_KEY);
  } catch { /* 저장이 막힌 환경: 이번 화면에서만 접힌다 */ }
}

function readContext(): InstallContext {
  try {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return detectInstallContext({ ua: navigator.userAgent, standalone: Boolean(standalone), maxTouchPoints: navigator.maxTouchPoints || 0 });
  } catch {
    return 'desktop';
  }
}

function ShareIcon() {
  // 아이폰 사파리의 공유 버튼 모양(네모 위로 화살표). 사용자가 화면에서 같은 모양을 찾게 한다.
  return (
    <svg className="doit-install-share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 10H16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AndroidSteps() {
  return (
    <ul className="doit-install-steps doit-install-steps--choices">
      <li><strong>크롬</strong> — 오른쪽 위 <b>⋮</b> 를 누르고 <b>「앱 설치」</b> 또는 <b>「홈 화면에 추가」</b>를 눌러요.</li>
      <li><strong>삼성 인터넷</strong> — 오른쪽 아래 <b>≡</b> 를 누르고 <b>「현재 페이지 추가」</b> → <b>「홈 화면」</b>을 눌러요.</li>
    </ul>
  );
}

function SafariSteps() {
  return (
    <ol className="doit-install-steps">
      <li>화면 아래 가운데 <b className="doit-install-inline"><ShareIcon /> 공유</b> 버튼을 눌러요.</li>
      <li>목록을 아래로 내려 <b>「홈 화면에 추가」</b>를 눌러요.</li>
      <li>오른쪽 위 <b>「추가」</b>를 누르면 끝이에요.</li>
    </ol>
  );
}

function CopyAddress() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const address = `${window.location.origin}/`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return (
    <div className="doit-install-copy">
      <button type="button" className="doit-install-secondary" onClick={() => void copy()}>
        {state === 'copied' ? '주소를 복사했어요' : '주소 복사하기'}
      </button>
      {/* 복사가 막힌 환경에서도 주소를 직접 보고 옮길 수 있게 늘 보여 준다. */}
      <p className="doit-install-address" aria-live="polite">{state === 'failed' ? '복사가 막혀 있어요. 이 주소를 직접 적어 주세요: ' : ''}<span>{address}</span></p>
    </div>
  );
}

export default function InstallAppCard() {
  const [context] = useState<InstallContext>(readContext);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [result, setResult] = useState<'none' | 'accepted' | 'manual'>('none');
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);
  const justInstalled = useSyncExternalStore(subscribeInstallPrompt, wasInstalledNow, () => false);

  useEffect(() => { writeCollapsed(collapsed); }, [collapsed]);

  if (IS_BRAND_SITE || context === 'installed') return null;
  // 컴퓨터는 브라우저가 설치를 허락할 때만 보여 준다(휴대폰 안내를 컴퓨터에 띄우지 않는다).
  if (context === 'desktop' && !canPrompt && result === 'none' && !justInstalled) return null;

  if (justInstalled || result === 'accepted') {
    return (
      <section className="doit-install" aria-live="polite">
        <h2>앱으로 받았어요</h2>
        <p>이제 휴대폰 홈 화면의 <b>DO IT</b> 아이콘으로 열어 주세요.</p>
      </section>
    );
  }

  if (collapsed) {
    return (
      <button type="button" className="doit-install-reopen" onClick={() => setCollapsed(false)}>
        휴대폰에 앱으로 받기 <span aria-hidden="true">↗</span>
      </button>
    );
  }

  const install = async () => {
    const outcome = await promptInstall();
    setResult(outcome === 'accepted' ? 'accepted' : 'manual');
  };

  const kakaoUrl = context === 'in-app' && isKakaoInApp(navigator.userAgent) ? kakaoOpenExternalUrl(`${window.location.origin}/`) : null;

  return (
    <section className="doit-install" aria-labelledby="doit-install-title">
      <h2 id="doit-install-title">홈 화면에 DO IT을 놓아 두세요</h2>
      <p>아이콘 하나로 바로 열려요. 스토어를 거치지 않아서 업데이트도 따로 할 필요가 없어요.</p>

      {context === 'android' || context === 'desktop' ? (
        canPrompt && result === 'none'
          ? <button type="button" className="doit-install-action" onClick={() => void install()}>앱으로 설치하기</button>
          : <>
              {result === 'manual' && <p className="doit-install-note">설치 창이 닫혔어요. 브라우저 메뉴에서 직접 받을 수 있어요.</p>}
              <AndroidSteps />
            </>
      ) : context === 'ios-safari' ? (
        <SafariSteps />
      ) : context === 'ios-other' ? (
        <>
          <p className="doit-install-note">아이폰은 <b>사파리</b>에서 받는 게 가장 확실해요. 주소를 복사해 사파리 주소창에 붙여 넣은 뒤 아래처럼 해 주세요.</p>
          <CopyAddress />
          <SafariSteps />
        </>
      ) : (
        <>
          <p className="doit-install-note">지금은 다른 앱 안에서 열려 있어서 설치할 수 없어요. 휴대폰 기본 브라우저(아이폰은 사파리, 갤럭시는 크롬·삼성 인터넷)로 열어 주세요.</p>
          {kakaoUrl && <a className="doit-install-action" href={kakaoUrl}>기본 브라우저로 열기</a>}
          {!kakaoUrl && <p className="doit-install-note">오른쪽 위 <b>⋯</b> 메뉴에 <b>「다른 브라우저로 열기」</b>가 있으면 그걸 눌러요. 없으면 주소를 복사해 옮겨 주세요.</p>}
          <CopyAddress />
        </>
      )}

      <button type="button" className="doit-install-later" onClick={() => setCollapsed(true)}>나중에 할게요</button>
    </section>
  );
}
