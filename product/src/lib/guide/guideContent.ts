// 이용 안내 공통 내용(2026-10-04 대표 「전체 디자인 교체 + 사용자 이용 안내 통합」) — 홈페이지·앱이 이 한 곳만 읽는다(복사 0).
// 지금 실제로 되는 것과 준비 중인 것을 나눠 쓴다. 사용자 원문·상대 응답·내부 구조·옛 가격·결제는 싣지 않는다.
// 공개 순서는 서버(doit-connect)가 지키는 규칙과 같은 말이고, KEY 는 releaseScope 에서 숨김(= 준비 중)일 때 준비 중으로 쓴다.
import { detectInstallContext, type InstallContext } from '@/doit/lib/installContext';

export type GuideTopic = 'start' | 'talk' | 'correct' | 'choose' | 'key' | 'zzarit' | 'install' | 'safety';

export interface GuideSection {
  id: GuideTopic;
  title: string;
  /** 줄바꿈은 \n */
  intro?: string;
  points?: readonly string[];
  note?: string;
  /** 설치·KEY 처럼 상태에 따라 달라지는 항목 */
  kind?: 'install' | 'key' | 'start';
}

export const GUIDE_TITLE = '이용 안내';
export const GUIDE_CONTACT = '0423doit@gmail.com';

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: 'start', title: '처음이라면, 여기부터 보세요.',
    intro: '어떤 만남을 원하는지 들려주세요.\nECHO와 이야기를 나누고, 마음이 가는 사람을 직접 선택해요.',
    points: [
      '어떤 만남을 원하는지 고르고',
      '프로필을 준비하고 ECHO와 이야기해요',
      'ECHO가 이해한 내용이 내 생각과 맞는지 확인해요',
      '추천을 살펴보고 직접 선택해요',
      '서로 선택하면 화면 안내에 따라 다음 단계로 가요',
    ],
    kind: 'start',
  },
  {
    id: 'talk', title: '잘 정리해서 말하지 않아도 괜찮아요.',
    intro: '떠오르는 대로 편하게 적어주세요.\nECHO가 다르게 이해했다면 바로 고칠 수 있어요.',
    points: ['질문은 한 번에 하나씩 해요.', '「잘 모르겠어요」도 괜찮은 답이에요.'],
  },
  {
    id: 'correct', title: '내 생각과 다르면, 고쳐주세요.',
    points: [
      '맞아요 — 내 뜻과 맞을 때',
      '조금 달라요 — 일부만 고칠 때',
      '그게 아니에요 — ECHO가 다르게 이해했을 때',
      '직접 설명할게요 — 내 말로 다시 적을 때',
    ],
    note: 'ECHO가 이해한 내용을 확인할 때에만 이 버튼이 나와요. 내가 맞다고 한 것만 기억해요.',
  },
  {
    id: 'choose', title: '추천을 받아도, 선택은 내가 해요.',
    intro: '마음이 가는 사람이 있으면 선택해 주세요.\n상대도 선택하면 다음 단계가 열려요.',
    points: [
      '한 사람만 선택하면 기다리는 상태예요. 이때는 서로의 이름·사진·소개가 보이지 않아요.',
      '두 사람이 모두 선택하면 같은 질문이 가요.',
      '두 사람이 모두 답하고 공개에 동의한 뒤에야 닉네임·대표 사진·소개·목적·첫 답이 서로 보여요.',
    ],
    note: '추천을 받았다고 바로 연결되는 것은 아니에요.',
  },
  {
    id: 'key', title: 'KEY, 어디에 쓰나요?', kind: 'key',
    intro: '사용하기 전에 필요한 KEY와 이용할 기능을 확인해 주세요.',
  },
  {
    id: 'zzarit', title: '‘찌릿!’은 서로 선택했다는 뜻이에요.',
    intro: '두 분 모두 선택하면\n‘텔레파시가 통했어요’라는 표시가 나타나요.',
    note: '다음 단계는 화면 안내에 따라 진행해 주세요.',
  },
  { id: 'install', title: '홈 화면에서 바로 시작하세요.', kind: 'install' },
  {
    id: 'safety', title: '불편한 일이 있으면 알려주세요.',
    points: [
      '후보 카드의 「불편해요 · 차단 · 신고」에서 차단하거나 사유를 골라 신고할 수 있어요.',
      '연결 카드의 「이 연결 그만하기」로 언제든 나갈 수 있어요.',
      '신고는 사유를 남기는 것이고, 차단은 그 사람이 다시 추천되지 않게 하는 거예요. 둘은 따로 고를 수 있어요.',
      '계정·프로필·탈퇴는 설정에서 확인 뒤에 진행해요.',
    ],
    note: '문의는 ' + GUIDE_CONTACT + ' 로 보내 주세요. 안내 화면에서 자동으로 보내지 않아요.',
  },
];

// 시작 항목 끝 문장: 실제 출시 범위(연결 화면이 열려 있는지)에서 읽는다. 열려 있어도 내 준비 상태(전화 인증·사진·소개 등)는 연결 화면이 보여 준다.
export const START_NOTE_READY = '추천과 연결은 내 준비가 끝나면 열려요. 내 준비 상태는 연결 화면에서 확인할 수 있어요.';
export const START_NOTE_PENDING = '추천과 연결은 아직 준비 중이에요. 지금은 대화와 프로필 준비까지 쓸 수 있어요.';
export const KEY_READY_TEXT = '필요한 KEY와 이용할 기능은 해당 화면에서 확인해 주세요.';
export const KEY_PENDING_TEXT = '현재 KEY 사용 기능은 준비 중이에요.';

// 설치 항목 — 기기별 문구(실제 PWA 지원 기준 · 가짜 스토어 배지/링크 0).
export const INSTALL_STEPS: Record<InstallContext, string> = {
  installed: '이미 앱으로 열려 있어요.',
  'in-app': '지금 열린 앱 안 브라우저에서는 설치할 수 없어요. 사파리나 크롬 같은 브라우저로 열어 주세요.',
  'ios-safari': 'iPhone 사파리: 앱 주소를 연 뒤 공유 버튼 → 「홈 화면에 추가」를 눌러 주세요. 공유 버튼 위치는 iOS 버전에 따라 달라요.',
  'ios-other': 'iPhone: 사파리에서는 공유 → 「홈 화면에 추가」로 설치할 수 있어요. 지금 쓰는 브라우저 메뉴에 공유나 홈 화면 추가가 있으면 그걸 써도 돼요. 메뉴 위치는 버전에 따라 달라요.',
  android: 'Android 크롬: 앱 주소를 연 뒤 더보기(⋮) → 「설치 및 바로가기 만들기」 → 「설치」를 눌러 주세요(「앱 설치」·「홈 화면에 추가」로 보일 수도 있어요).',
  desktop: '컴퓨터에서는 휴대폰으로 앱 주소를 열어 설치해요. 아래에서 기기를 골라 주세요.',
};
export const INSTALL_IPHONE = INSTALL_STEPS['ios-safari'];
export const INSTALL_ANDROID = INSTALL_STEPS.android;
export const INSTALL_CONTINUE_WEB = '웹으로 계속 이용하기';

const matches = (query: string) => { try { return typeof window.matchMedia === 'function' && window.matchMedia(query).matches; } catch { return false; } };

export function currentInstallContext(): InstallContext {
  try {
    const standalone = matches('(display-mode: standalone)') || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return detectInstallContext({ ua: navigator.userAgent, standalone, maxTouchPoints: navigator.maxTouchPoints || 0 });
  } catch { return 'desktop'; }
}

// 기기를 알 수 없을 때(컴퓨터) 사용자가 iPhone/Android 를 직접 고른다.
export function installNeedsPicker(ctx: InstallContext): boolean { return ctx === 'desktop'; }

// 화면 어디서든 안내를 열 수 있는 작은 신호(창 이벤트). 안내 호스트 하나만 듣는다.
export const GUIDE_OPEN_EVENT = 'echo:open-guide';
// mode: 'short' = 기능 곁 작은 도움말(그 항목 하나만 아래 시트) · 'full'(기본) = 메뉴·푸터에서 여는 전체 이용 안내.
export type GuideMode = 'short' | 'full';
export function openGuide(topic?: GuideTopic, mode: GuideMode = 'full'): void {
  try { window.dispatchEvent(new CustomEvent(GUIDE_OPEN_EVENT, { detail: { topic, mode } })); } catch { /* 안내를 못 열어도 이용은 계속된다 */ }
}
