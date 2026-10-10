"use client";

// 📖 Docs: obsidian/frontend/components/ui.md

import type { ReactNode } from "react";

import { GHOST } from "@vesper/lib/springs/interaction";
import { PressableButton, PressableLink } from "./pressable";

export interface ButtonProps {
  children: ReactNode;
  /** Renders an `<a>` via `next/link` when set, a `<button>` otherwise. */
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}

const BASE =
  "inline-flex items-center justify-center gap-hud-inline rounded-card border px-cta-x py-cta-y font-hud-mono text-hud-xs tracking-hud uppercase shadow-glass backdrop-blur-glass";

/**
 * The generic call to action.
 *
 * Hover and press are springs (`GHOST`, via {@link PressableButton}) and they move
 * **colour, not size**. This used to wrap the button in a `<Hover>` that scaled it
 * to `1.03` — a control that grows under the cursor is motion added for its own
 * sake, and it shoulders whatever sits next to it. A border that firms up and a
 * surface that takes light says the same thing without moving the box.
 *
 * Border and background colours come from the spring, so `BASE` carries width and
 * style only.
 */
export const Button = ({
  children,
  href,
  onClick,
  type = "button",
  className = "",
}: ButtonProps) => {
  const classes = `${BASE} ${className}`;

  if (href) {
    return (
      <PressableLink href={href} interaction={GHOST} className={classes}>
        {children}
      </PressableLink>
    );
  }

  return (
    <PressableButton
      type={type}
      onClick={onClick}
      interaction={GHOST}
      className={classes}
    >
      {children}
    </PressableButton>
  );
};
