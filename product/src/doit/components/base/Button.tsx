import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  to?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-label font-semibold transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-primary-500 text-background-50 hover:bg-primary-600",
  accent: "bg-accent-500 text-background-50 hover:bg-accent-600",
  secondary: "bg-secondary-100 text-secondary-900 hover:bg-secondary-200",
  outline:
    "border border-background-300 text-foreground-800 hover:bg-background-100",
  ghost: "text-foreground-600 hover:bg-background-200/70",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-full",
  md: "h-11 px-5 text-sm rounded-full",
  lg: "h-14 px-7 text-base rounded-full",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  loading = false,
  disabled = false,
  to,
  onClick,
  type = "button",
  className = "",
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${
    full ? "w-full" : ""
  } ${className}`;

  const content = (
    <>
      {loading && (
        <i className="ri-loader-4-line animate-spin-slow text-base" aria-hidden />
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={classes}
    >
      {content}
    </button>
  );
}