/**
 * ECHO 도입(Flora) 글 — 대표 「최종 연결 시안 제작 지시서」 §8 확정 문장 그대로.
 * 장면의 창(window)·스크롤 구간(run)·문장 이동 방식은 Flora 원본 값을 그대로 쓰고 글만 바꾼다.
 *
 * 지운 원본 요소: 금융·네트워크 문구, ETH/GWEI/Relay 숫자, 접속 수 칩(340), 중계 패널(가짜 실시간 값),
 * 바닥글 링크 묶음(갈 곳 없는 #링크), SNS. 가짜 이름·사진·점수·매칭 확률은 만들지 않는다.
 */
import type { MigrationContent, FluffContent, PreloaderContent } from "@flora/data/mocks/home";
import { homeHeroScene } from "@flora/data/mocks/home";
import type { DandelionSceneConfig } from "@flora/lib/scene/dandelion/dandelion-scene";

export const ECHO = "ECHO";
export const OPERATOR = "by DOIT COMPANY";
export const COMPANY = "DOIT COMPANY";

export const echoPreloader: PreloaderContent = {
  lines: ["당신을 이해하는 이야기에서,", "서로를 선택하는 만남까지."],
  mark: `${ECHO} ${OPERATOR}`,
  note: `© ${new Date().getFullYear()} ${COMPANY}`,
  status: "여는 중",
};

export const echoIntro = {
  headline: ["당신이 잠든 사이", "AI가 먼저 만나봅니다"] as [string, string],
  lead: "당신을 이해하는 이야기에서,\n서로를 선택하는 만남까지.",
  cta: "내 이야기 시작하기",
  /** 기존 이용자 경로(대표 지시 §7). 인증은 이 시안에 연결돼 있지 않다 — 작동하는 로그인처럼 꾸미지 않는다. */
  returning: {
    title: "이미 쓰던 이야기가 있나요?",
    resume: "이어서 쓰기",
    resumeHint: "이 기기에 저장된 임시 글로 이어서 씁니다.",
    noDraft: "이 기기에 저장된 임시 글이 없어요.",
    login: "로그인은 이 시안에 아직 연결되지 않았어요.",
  },
  backHome: "DOIT COMPANY 홈페이지",
};

/*
 * 장면의 창(window)·글 이동 구간(run/scrub)·막(scrim)은 Flora 원본 data/mocks/home.ts 의 값을 그대로 옮겨 적었다.
 * (원본 객체를 펼쳐 쓰면 원본의 영어 금융 문구까지 번들에 실려 가서, 숫자만 옮긴다.)
 */
export const heroWindow = { leave: [0.0554, 0.09] as [number, number] };
export const navLeave: [number, number] = [0.8616, 0.9031];

/** 2 · Leak 자리 */
export const echoLeak: MigrationContent = {
  layout: "leak",
  scrim: "veil",
  phrases: ["당신의", "이야기를", "들려주세요."],
  run: [0.1765, 0.2872],
  window: { enter: [0.128, 0.1765], leave: [0.2872, 0.308] },
};
/** 3 · Stem 자리 — AI가 이해한 내용을 사용자가 확인하는 가치 */
export const echoStem: MigrationContent = {
  layout: "stem",
  scrim: "haze",
  phrases: ["내 뜻과 다르면,", "바로 고칠 수", "있어요."],
  run: [0.3356, 0.5017],
  window: { enter: [0.3218, 0.3356], leave: [0.5017, 0.5225] },
};
/** 5 · Integrate 자리 */
export const echoIntegrate: MigrationContent = {
  layout: "integrate",
  scrim: "haze",
  phrases: ["추천은 시작일 뿐,", "선택은 당신의 몫이에요."],
  scrub: { arrive: [0.7439, 0.79], depart: [0.8616, 0.9031] },
  window: { enter: [0.7439, 0.7647], leave: [0.8616, 0.9031] },
};

/**
 * 4 · Fluff 자리 — 꽃과 문구의 회전 구조 유지. 원본 열 값(ETH·GWEI)은 설명용 단어로.
 * 한 열에 11칸(원본 바퀴 칸 수 그대로)이라 여섯 단어를 돌려 쓴다.
 */
const WORDS = ["이야기", "관심사", "생활 리듬", "관계의 속도", "중요한 가치", "편안한 대화"];
const wheel = (start: number) => Array.from({ length: 11 }, (_, i) => WORDS[(start + i) % WORDS.length]);
export const echoFluff: FluffContent = {
  run: [0.5779, 0.7024],
  window: { enter: [0.5225, 0.5779], leave: [0.7024, 0.7439] },
  left: wheel(0),
  right: wheel(3),
  split: ["나와 맞는 가능성을", "살펴보세요."],
};

/** 6 · Connect 자리 */
export const echoConnect = {
  window: { enter: [0.9308, 0.9585] as [number, number], leave: [1.0, 1.0] as [number, number] },
  headline: ["서로 선택하면,", "연결이", "시작됩니다."] as [string, string, string],
  lead: "",
  columns: [],
  legal: [],
  mark: `© ${new Date().getFullYear()} ${COMPANY}`,
};

/** 꽃잎과 함께 나는 카드: 설명용 단어만 — 글은 Flora 데이터 파일(data/mocks/home.ts cards)에 바로 넣었다. */
export const echoScene: DandelionSceneConfig = homeHeroScene;
