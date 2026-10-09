"use client";

// 📖 Docs: obsidian/frontend/components/clarix.md

import { animated, useSpring } from "@react-spring/web";
import { useEffect } from "react";

import { useRobot } from "@clarix/components/common/robot-view";
import { useStage } from "@clarix/hooks/use-stage";
import { cssEase, cubicBezier } from "@clarix/lib/animation/cubic-bezier";

/**
 * The hero chrome (logo, nav, info block) held invisible until the preloader
 * finishes, then eased in from 20 px above or below — the shipped
 * `.preload-hidden.reveal-anim.from-*` transitions as one spring:
 *   transform 1.6 s cubic-bezier(.2,.8,.2,1) 0.6 s · opacity 1.6 s ease 0.6 s
 * Clicks pass through while it is hidden, as before.
 */
const RISE = cubicBezier(0.2, 0.8, 0.2, 1);
const DELAY = 600;
const DURATION = 1600;

type Props = {
  from: "top" | "bottom";
  className?: string;
};

const useReveal = (from: Props["from"]) => {
  const done = useStage((s) => s.preloaderDone);
  // The robot form (D-016): at rest from the server HTML on.
  const robot = useRobot();
  const [spring, api] = useSpring(() => (robot ? { y: 0, o: 1 } : { y: from === "top" ? -20 : 20, o: 0 }));
  useEffect(() => {
    if (robot || !done) return;
    void api.start({
      y: 0,
      o: 1,
      delay: DELAY,
      config: (key: string) => ({ duration: DURATION, easing: key === "y" ? RISE : cssEase }),
    });
  }, [done, api, robot]);
  return {
    style: {
      transform: spring.y.to((v) => `translateY(${v}px)`),
      opacity: spring.o,
      pointerEvents: done ? ("auto" as const) : ("none" as const),
      willChange: "transform, opacity",
    },
  };
};

export const PreloadRevealNav = ({ from, className, children, label }: Props & { children: React.ReactNode; label: string }) => {
  const { style } = useReveal(from);
  return (
    <animated.nav aria-label={label} className={className} style={style}>
      {children}
    </animated.nav>
  );
};

export const PreloadRevealDiv = ({ from, className, children }: Props & { children: React.ReactNode }) => {
  const { style } = useReveal(from);
  return (
    <animated.div className={className} style={style}>
      {children}
    </animated.div>
  );
};

export const PreloadRevealImg = ({ from, className, src, alt }: Props & { src: string; alt: string }) => {
  const { style } = useReveal(from);
  return <animated.img src={src} alt={alt} className={className} style={style} />;
};
