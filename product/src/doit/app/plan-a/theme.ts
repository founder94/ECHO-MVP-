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