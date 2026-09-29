interface GradeBadgeProps {
  grade: string;
  size?: "sm" | "md";
}

const gradeColors: Record<string, string> = {
  red: "bg-[#C4453C] text-white",
  gold: "bg-[#C9A24B] text-white",
  silver: "bg-[#A8B0B8] text-white",
  perfume: "bg-[#D9A7A0] text-white",
  platinum: "bg-[#6E7A84] text-white",
  black: "bg-[#1A1A1A] text-white",
};

const gradeLabels: Record<string, string> = {
  red: "레드",
  gold: "골드",
  silver: "실버",
  perfume: "퍼퓸",
  platinum: "플래티늄",
  black: "블랙",
};

export default function GradeBadge({ grade, size = "md" }: GradeBadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses} ${
        gradeColors[grade] || gradeColors.silver
      }`}
    >
      <span className={`${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"} rounded-full bg-white/60`} />
      {gradeLabels[grade] || grade}
    </span>
  );
}