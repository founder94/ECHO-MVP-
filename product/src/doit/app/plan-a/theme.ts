// 2026-10-10 대표 「기존 디자인 다 삭제 · 심볼만 살려」: 색 값을 Flora 로(밤 #010b24 · 강조 연두 #bbfc9e · 빛 #9fc2ff/#dce8ff). 이름은 호출부 유지용.
export const colors = {
  bg: "#010b24",
  bgDeep: "#07090f",
  surface: "#161921",
  violet: "#9fc2ff",
  violetLight: "#dce8ff",
  violetDark: "#2e6bff",
  cyan: "#9fc2ff",
  cyanSoft: "#dce8ff",
  pink: "#dce8ff",
  gold: "#bbfc9e",
  accent: "#bbfc9e",
  accentSoft: "rgba(187, 252, 158, 0.16)",
  onAccent: "#050b14",
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

// 2026-10-09 대표 승인: 앱 사용자 글은 주아체(Jua) 하나. 이름은 옛 호출부를 그대로 두려고 유지.
export const serif = '"Chakra Petch", "Jua", "Pretendard", system-ui, sans-serif';

export const sans = '"Chakra Petch", "Jua", "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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