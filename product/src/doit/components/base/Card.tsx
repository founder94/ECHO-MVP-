import type { ReactNode } from "react";

type Padding = "none" | "sm" | "md" | "lg";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: Padding;
  onClick?: () => void;
}

const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export default function Card({
  children,
  className = "",
  padding = "md",
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-background-200 bg-background-50 ${
        paddings[padding]
      } ${
        onClick
          ? "cursor-pointer transition-colors hover:bg-background-100"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}