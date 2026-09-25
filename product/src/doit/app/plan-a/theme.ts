export const colors = {
  bg: "#0A0D14",
  bgDeep: "#07090f",
  surface: "#161921",
  violet: "#7C5CFF",
  violetLight: "#A98BFF",
  violetDark: "#4C32B5",
  cyan: "#59E7FF",
  cyanSoft: "#A7F3FF",
  pink: "#FF7BD5",
  gold: "#c7aa69",
  accent: "#c7aa69",
  accentSoft: "rgba(199, 170, 105, 0.16)",
  onAccent: "#0A0D14",
  white: "#F5F3EF",
  text: "#F5F3EF",
  textSoft: "rgba(245, 243, 239, 0.72)",
  textMuted: "#9CA3AF",
  textFaint: "#6B7280",
  glass: "rgba(255, 255, 255, 0.06)",
  glassStrong: "rgba(255, 255, 255, 0.12)",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.18)",
  success: "#6EF0AA",
  warning: "#FFD66B",
  danger: "#FF7188",
} as const;

// 2026-09-25 대표 MASTER §12~13 「사용자 APP 전면 파스텔」: 시작 흐름 화면의 바탕·카드·입력창만 바깥 틀(.doit-app-pastel)이 정한 색을 따른다.
// 틀 밖(예전 plan-a 화면)에서는 괄호 안 원래 색 그대로다. 글자·아이콘 색은 바꾸지 않는다(아이콘 색 속성은 CSS 변수를 못 받을 수 있다).
export const surfaces = {
  page: `var(--app-page, ${colors.bg})`,
  card: `var(--app-surface, ${colors.surface})`,
  field: `var(--app-surface, ${colors.bg})`,
  // 파스텔 위에 바로 놓인 머리글·설명 글자(카드 밖). 틀 안에서는 흰색, 틀 밖에서는 원래 회색.
  onPage: `var(--app-on-page, ${colors.textMuted})`,
  onPageFaint: `var(--app-on-page, ${colors.textFaint})`,
} as const;

export const serif =
  '"Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", Georgia, serif';

export const sans =
  'Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export type GradeTone =
  | "violet"
  | "cyan"
  | "pink"
  | "gold"
  | "success";

export const gradeColors: Record<GradeTone, string> = {
  violet: colors.violetLight,
  cyan: colors.cyan,
  pink: colors.pink,
  gold: colors.gold,
  success: colors.success,
};