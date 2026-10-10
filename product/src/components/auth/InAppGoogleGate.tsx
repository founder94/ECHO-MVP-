import { useState, type ReactNode } from 'react';
import { detectInstallContext, externalBrowserUrl } from '@/doit/lib/installContext';

// 2026-10-10 갤럭시·아이폰 호환: 카카오톡·인스타그램 같은 앱 안 브라우저에서는 Google 이 로그인을 막는다(403 disallowed_useragent).
// 그런 곳에서는 Google 버튼(children) 대신 안내를 보여 준다. 이메일 로그인은 그대로 쓸 수 있다(빠져나갈 문).

// 지금 화면이 앱 안 브라우저인지. 판단이 안 되면 막지 않는다(Google 버튼 그대로).
function isGoogleBlockedHere(): boolean {
  try {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return detectInstallContext({ ua: navigator.userAgent, standalone: Boolean(standalone), maxTouchPoints: navigator.maxTouchPoints || 0 }) === 'in-app';
  } catch {
    return false;
  }
}

export default function InAppGoogleGate({ children }: { children: ReactNode }) {
  const [blocked] = useState(isGoogleBlockedHere);
  return blocked ? <InAppGoogleNotice /> : <>{children}</>;
}

function InAppGoogleNotice() {
  const [address] = useState(() => {
    try { return window.location.href; } catch { return ''; }
  });
  const [openUrl] = useState(() => {
    try { return externalBrowserUrl(navigator.userAgent, address); } catch { return null; }
  });
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <div className="p-3 rounded-xl border border-background-200/60 bg-background-100/50 space-y-3" role="note">
      <p className="text-xs leading-relaxed text-foreground-300">
        이 앱 안의 브라우저에서는 Google 로그인이 막혀 있어요. 기본 브라우저(크롬·삼성 인터넷·사파리)에서 열어 주세요.
      </p>
      {openUrl ? (
        <a
          href={openUrl}
          className="echo-glass-btn echo-glass-btn--secondary w-full py-3 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
        >
          기본 브라우저로 열기
        </a>
      ) : (
        <p className="text-[11px] leading-relaxed text-foreground-500">
          오른쪽 위나 아래의 <b>⋯</b> 메뉴에 「다른 브라우저로 열기」가 있으면 그걸 눌러요. 없으면 주소를 복사해 옮겨 주세요.
        </p>
      )}
      <button
        type="button"
        onClick={() => { void copyAddress(); }}
        className="echo-glass-btn echo-glass-btn--secondary w-full py-3 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
      >
        {copy === 'copied' ? '주소를 복사했어요' : '주소 복사'}
      </button>
      {/* 복사가 막힌 환경: 주소를 직접 골라 옮길 수 있게 보여 준다. */}
      {copy === 'failed' && (
        <p className="text-[11px] leading-relaxed text-foreground-500 break-all select-all" aria-live="polite">
          복사가 막혀 있어요. 이 주소를 길게 눌러 복사해 주세요: <span className="text-foreground-300">{address}</span>
        </p>
      )}
    </div>
  );
}
