"use client";

/**
 * The call to action, wherever it stands — the opening screen, the closing one,
 * and the menu. One component rather than three copies, because the hover is a
 * single state that both halves answer: the plate takes the lime from the left
 * and the square, arriving at the end of it, holds a finished packet.
 *
 * The hover is held in React rather than read from `:hover` alone: the square
 * is sprung, and a spring cannot be started by a CSS state. The plate's own
 * sweep is a transition, which is what `plate-fill` is for.
 *
 * Focus counts as hover here. The keyboard reaches this button too, and a
 * button that answers the pointer and ignores the tab key is half a button.
 */

import { useState } from "react";

import { CtaIcon } from "@flora/components/ui/cta-icon";

export interface CtaButtonProps {
  href: string;
  label: string;
  /** The button's own box — every frame sets its width. */
  className?: string;
  /** The plate's box inside it, which the design measures separately. */
  plateClassName?: string;
  onClick?: () => void;
}

export const CtaButton = ({
  href,
  label,
  className = "",
  plateClassName = "",
  onClick,
}: CtaButtonProps) => {
  const [pointed, setPointed] = useState(false);

  return (
    <a
      href={href}
      onClick={onClick}
      onPointerEnter={() => setPointed(true)}
      onPointerLeave={() => setPointed(false)}
      onFocus={() => setPointed(true)}
      onBlur={() => setPointed(false)}
      className={`group flex h-[3.0625rem] gap-[0.125rem] ${className}`}
    >
      <span
        className={`plate-fill rounded-panel font-display text-label tracking-label text-on-accent flex h-full items-center leading-none uppercase ${plateClassName}`}
      >
        {label}
      </span>
      <CtaIcon firing={pointed} className="size-[3.0625rem] shrink-0" />
    </a>
  );
};
