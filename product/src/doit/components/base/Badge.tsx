import type { ReactNode } from "react";

type BadgeTone = "primary" | "accent" | "secondary" | "neutral";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  primary: "bg-primary-100 text-primary-800",
  accent: "bg-accent-100 text-accent-900",
  secondary: "bg-secondary-100 text-secondary-900",
  neutral: "bg-background-200 text-foreground-700",
};

export default function Badge({
  children,
  tone = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-label text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}