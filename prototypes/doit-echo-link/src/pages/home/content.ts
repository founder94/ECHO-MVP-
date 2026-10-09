/**
 * 줄 규칙(대표 지시 2026-10-09): 설명 글은 「문장 하나 = 항목 하나 = 한 줄」. 문장 중간에서 줄을 나누지 않는다.
 * 휴대폰에서 한 문장이 화면 폭보다 길면 자동 줄바꿈하되 두 줄 길이를 고르게(text-wrap: balance).
 * 제목은 의미 단위(쉼표로 나뉜 두 마디 = 두 줄), 한 단어만 따로 떨어지는 줄은 만들지 않는다.
 *
 * DOIT COMPANY 홈페이지 글 — 대표 「최종 연결 시안 제작 지시서」(2026-10-09) §4 확정 카피 그대로.
 * 화면 코드에는 글을 두지 않는다(원본 Clarix 규칙: 글은 데이터 파일에만).
 *
 * 쓰지 않는 원본 요소(사실이 아닌 것으로 보일 수 있어 뺐다): 고객사 로고 띠, 200+ / 97% / 10X 숫자,
 * 이메일 구독 칸, 바닥글 링크 묶음, 원본 로고. 확인되지 않은 계열사·실적·이용자 수·요금은 만들지 않는다.
 */
import type { TitleLines } from "@clarix/data/mocks/home";

export const COMPANY = "DOIT COMPANY";
export const TAGLINE = "JUST TRY.";
export const SERVICE = "ECHO";

export const homeCopy = {
  brand: { name: COMPANY, symbolAlt: "DOIT COMPANY 심볼" },
  nav: [
    { id: "company", label: "회사 소개" },
    { id: "echo", label: "ECHO" },
    { id: "how", label: "만드는 방식" },
    { id: "start", label: "서비스 시작" },
  ] as const,
  navArrow: "↗",
  hero: {
    label: "DOIT COMPANY PRESENTS ECHO",
    title: [[{ text: "당신이 잠든 사이" }], [{ text: "AI가 먼저 만나봅니다", weight: "regular" }]] as TitleLines,
    text: [
      "당신의 이야기를 바탕으로 ECHO\u00A0Agent가 만남의 가능성을 먼저 살펴봅니다.",
      "연결은 두 사람이 서로 선택했을 때 시작됩니다.",
    ],
  },
  story: {
    title: [[{ text: "당신을 알아가는 시작은" }], [{ text: "당신의 이야기에서", weight: "medium" }]] as TitleLines,
    text: ["좋아하는 것, 중요하게 여기는 것, 편하게 느끼는 관계를 들려주세요."],
  },
  words: ["이야기", "이해", "연결"],
  glass: {
    label: "ECHO가 일하는 방식",
    title: [[{ text: "이야기를 듣고," }], [{ text: "뜻을 확인하고," }], [{ text: "가능성을 연결합니다." }]] as TitleLines,
    steps: [
      { index: "01", name: "이야기", desc: "내가 직접 들려주는 나" },
      { index: "02", name: "확인", desc: "내 뜻과 다르면 바로 수정" },
      { index: "03", name: "선택", desc: "추천 이후에도 결정은 내가" },
    ],
  },
  control: {
    title: [[{ text: "AI가 먼저 살펴보고," }], [{ text: "결정은 당신이 합니다.", weight: "medium" }]] as TitleLines,
    text: [
      "ECHO\u00A0Agent가 이해한 내용을 확인하고 고칠 수 있습니다.",
      "당신의 최신 이야기와 선택을 기준으로 다음 만남의 가능성을 살펴봅니다.",
    ],
  },
  company: {
    top: [[{ text: COMPANY }]] as TitleLines,
    bottom: [[{ text: TAGLINE, weight: "medium" }]] as TitleLines,
    text: ["새로운 가능성을, 실제로 경험할 수 있게."],
  },
  finale: {
    /* 대표 지시: 한 문장은 한 줄 — 「이제,」가 홀로 떨어지지 않게 한 줄(휴대폰은 화면 폭에 맞춰 글자 크기를 줄인다). */
    title: [[{ text: "이제, " }, { text: "당신의 이야기를 시작할 차례.", weight: "regular" }]] as TitleLines,
  },
  footer: {
    service: SERVICE,
    text: ["당신다운 만남을 향해, 첫 이야기를 들려주세요."],
    cta: "내 이야기 시작하기",
    ctaArrow: "↗",
    sign: `${COMPANY} · ${TAGLINE}`,
    copyright: `© ${new Date().getFullYear()} ${COMPANY}`,
  },
} as const;

/**
 * 메뉴가 데려가는 장면 — 원본 스크롤 진행값(0→1)의 자리. 2800vh 중 26 화면이 0→1 이므로
 * 진행값 p 의 위치는 p × 26 화면이다(clarix.ts PACE_ORIGINAL).
 *   회사 소개 → ⑥ D 심볼이 조립돼 머무는 구간(0.80–0.86)
 *   ECHO     → ④ 유리 패널이 자리 잡은 때(0.52)
 */
export const SCENE_AT = { company: 0.83, echo: 0.52 } as const;
export const ANIMATED_VIEWPORTS = 26;
