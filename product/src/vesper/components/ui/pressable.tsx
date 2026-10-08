"use client";

// 📖 Docs: obsidian/frontend/components/ui.md

import { animated, useSpring } from "@react-spring/web";
import Link from "next/link";
import {
  ComponentPropsWithoutRef,
  FocusEvent,
  PointerEvent,
  useMemo,
  useState,
} from "react";

import {
  HOVER_CONFIG,
  Interaction,
  NAV_LINK,
  PRESS_CONFIG,
} from "@vesper/lib/springs/interaction";

/**
 * Spring-driven hover **and press** state for one interactive element.
 *
 * The existing `<Hover>` spring only covers mouse enter/leave, and it styles its
 * own wrapper — which is the wrong shape for a control whose trigger and its
 * painted surface are different elements (the Send Request CTA is a `<Link>` whose
 * fill lives on an inner `<span>`, with the arrow icon outside it). This hook hands
 * back the two halves separately: spread `bind` on whatever the pointer meets, and
 * put `style` on whatever should react.
 *
 * See [[design-system]] for the interaction language itself.
 */
export const usePressable = (interaction: Interaction = NAV_LINK) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const target = useMemo(() => {
    const { rest, hover, press } = interaction;
    if (pressed) return { ...rest, ...hover, ...press };
    if (hovered) return { ...rest, ...hover };
    return rest;
  }, [interaction, hovered, pressed]);

  // `ReducedMotion` flips react-spring's global `skipAnimation`, so these jump
  // straight to their end state for anyone who asked for that.
  const style = useSpring({
    to: target,
    config: pressed ? PRESS_CONFIG : HOVER_CONFIG,
  });

  const bind = {
    // Guarded on `pointerType`: a touch tap fires `pointerenter` too, and without
    // this the control would light up and *stay* lit after the finger left —
    // there is no `pointerleave` to follow it.
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse") setHovered(true);
    },
    onPointerLeave: () => {
      setHovered(false);
      setPressed(false);
    },
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    // Keyboard users get the hover state too — otherwise tabbing through the nav
    // shows nothing but the focus ring.
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.target.matches(":focus-visible")) setHovered(true);
    },
    onBlur: () => {
      setHovered(false);
      setPressed(false);
    },
  };

  return { style, bind };
};

/**
 * Focus ring for every pressable. The hover state is a colour shift, which is
 * invisible to a keyboard user mid-tab if nothing else marks the control — and
 * several of these sit on a live WebGL scene, where the UA default outline
 * disappears entirely.
 */
const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

const join = (...classes: (string | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const AnimatedLink = animated(Link);

export interface PressableLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "style"> {
  interaction?: Interaction;
}

/**
 * A `next/link` that answers the pointer. Safe to render from a Server Component —
 * `interaction` is a plain object, so it crosses the boundary.
 */
export const PressableLink = ({
  interaction = NAV_LINK,
  className,
  children,
  ...props
}: PressableLinkProps) => {
  const { style, bind } = usePressable(interaction);

  return (
    <AnimatedLink
      style={style}
      className={join(FOCUS_RING, className)}
      {...bind}
      {...props}
    >
      {children}
    </AnimatedLink>
  );
};

export interface PressableButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "style"> {
  interaction?: Interaction;
}

/** A `<button>` that answers the pointer. Pass `type` — there is no default. */
export const PressableButton = ({
  interaction = NAV_LINK,
  className,
  children,
  ...props
}: PressableButtonProps) => {
  const { style, bind } = usePressable(interaction);

  return (
    <animated.button
      style={style}
      className={join(FOCUS_RING, className)}
      {...bind}
      {...props}
    >
      {children}
    </animated.button>
  );
};
