import { ReactNode } from "react";
import { motion } from "motion/react";

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
      className="w-full rounded-full px-6 flex items-center justify-center transition-opacity whitespace-nowrap"
      style={{
        height: 54,
        fontFamily: "'Do Hyeon', sans-serif",
        fontSize: 15,
        color: solid ? "#F5F3EF" : "#9CA3AF",
        background: solid
          ? "linear-gradient(180deg, #3C414D 0%, #363B47 100%)"
          : "transparent",
        border: solid
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(255,255,255,0.18)",
        boxShadow: solid
          ? "inset 0 1px 0 rgba(255,255,255,0.20), 0 4px 16px rgba(0,0,0,0.35)"
          : "none",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled
          ? "not-allowed"
          : "pointer",
      }}
    >
      {children}
    </motion.button>
  );
}