// 휴대폰에 DO IT 을 앱(홈 화면 아이콘)으로 받을 수 있는지, 받는 방법이 무엇인지 정한다 (대표 2026-09-23).
//
// 스토어 앱이 아니라 웹 앱(PWA)이다. 기기·브라우저마다 받는 방법이 다르다.
// - 갤럭시(크롬·삼성 인터넷): 브라우저가 설치 창을 띄울 수 있다. 못 띄우면 메뉴에서 직접 받는다.
// - 아이폰: 설치 창이 없다. 사파리의 공유 버튼 → "홈 화면에 추가"로만 받는다.
// - 카카오톡·인스타그램 같은 앱 안의 브라우저: 설치할 수 없다. 밖의 브라우저로 열어야 한다.
// 순수 함수라 화면 없이 검사할 수 있다(qa/install-app.test.mjs).

export type InstallContext =
  | 'installed' // 이미 홈 화면 앱으로 열려 있다
  | 'in-app' // 다른 앱 안의 브라우저(설치 불가)
  | 'ios-safari' // 아이폰·아이패드 사파리
  | 'ios-other' // 아이폰·아이패드의 다른 브라우저(크롬 등)
  | 'android' // 안드로이드(갤럭시 등) 브라우저
  | 'desktop'; // 컴퓨터

export interface InstallEnv {
  ua: string;
  standalone: boolean; // display-mode: standalone 이거나 iOS navigator.standalone
  maxTouchPoints: number; // 아이패드가 컴퓨터(Mac)처럼 보이는 경우를 가리기 위해
}

// 앱 안 브라우저 표시. 이 브라우저들은 "홈 화면에 추가"가 없거나 막혀 있다.
// "; wv)" 는 안드로이드 앱 안에 박힌 웹뷰(WebView)의 표시다.
const IN_APP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|\bLine\/|DaumApps|everytimeApp|; wv\)/i;
const KAKAO = /KAKAOTALK/i;
const IOS_DEVICE = /iPhone|iPad|iPod/i;
const MAC = /Macintosh/i;
// 아이폰에서 사파리가 아닌 브라우저들의 표시.
const IOS_NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Whale|YaBrowser|DuckDuckGo|GSA\//i;
const ANDROID = /Android/i;

export function isIOS(env: Pick<InstallEnv, 'ua' | 'maxTouchPoints'>): boolean {
  // iPadOS 13 이후 아이패드 사파리는 Mac 처럼 자신을 소개한다. 터치가 되면 아이패드로 본다.
  return IOS_DEVICE.test(env.ua) || (MAC.test(env.ua) && env.maxTouchPoints > 1);
}

export function isKakaoInApp(ua: string): boolean {
  return KAKAO.test(ua);
}

export function detectInstallContext(env: InstallEnv): InstallContext {
  if (env.standalone) return 'installed';
  if (IN_APP.test(env.ua)) return 'in-app';
  if (isIOS(env)) return IOS_NOT_SAFARI.test(env.ua) ? 'ios-other' : 'ios-safari';
  if (ANDROID.test(env.ua)) return 'android';
  return 'desktop';
}

// 카카오톡 앱 안 브라우저에서 휴대폰 기본 브라우저로 여는 카카오 공식 주소 형식.
// http(s) 주소만 받는다(다른 스킴을 끼워 넣지 못하게).
export function kakaoOpenExternalUrl(target: string): string | null {
  if (!/^https?:\/\//i.test(target)) return null;
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`;
}
