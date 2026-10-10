import { ReactNode } from "react";
import { motion } from "motion/react";
import "@/doit/components/feature/glass-button.css";

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = "solid",
}: PrimaryButtonProps) {
  const solid = variant === "solid";

  return (
    <motion.button
      whileTap={
        disabled ? undefined : { scale: 0.98 }
      }
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      // 2026-09-28 대표 「BUTTON SYSTEM FINAL LOCK」: 채움 버튼 0 — 공통 유리 버튼(glass-button.css) 한 벌에서 파생.
      className={`echo-glass-btn ${solid ? "echo-glass-btn--primary echo-primary-button" : "echo-glass-btn--secondary echo-secondary-button"} w-full rounded-full px-6 flex items-center justify-center transition-opacity whitespace-nowrap`}
      style={{ height: 54, fontFamily: "'Jua', 'Pretendard', sans-serif", fontSize: 15 }}
    >
      {children}
    </motion.button>
  );
}