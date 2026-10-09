"use client";

// 📖 Docs: obsidian/frontend/components/clarix.md

import { animated, useSpring } from "@react-spring/web";
import { useEffect } from "react";

import { useRobot } from "@clarix/components/common/robot-view";
import { useStage } from "@clarix/hooks/use-stage";
import { cssEase } from "@clarix/lib/animation/cubic-bezier";

/**
 * The odometer preloader — `[ 000 / 100 ]` in the top-left corner while the
 * WebGL blob behind it fills and shatters. The column of numbers is rolled by
 * the scene's frame loop (`#odometer-numbers`, 4 rem per step, as shipped);
 * the fade-out when the preloader finishes is the shipped `opacity 1s ease`
 * transition as a spring.
 */
/** No preloader on the robot form (D-016). */
export const Preloader = (props: { total: number }) => (useRobot() ? null : <LivePreloader {...props} />);

const LivePreloader = ({ total }: { total: number }) => {
  const done = useStage((s) => s.preloaderDone);
  const [spring, api] = useSpring(() => ({ o: 1 }));
  useEffect(() => {
    if (done) void api.start({ o: 0, config: { duration: 1000, easing: cssEase } });
  }, [done, api]);

  return (
    <animated.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-9999 h-screen w-full"
      style={{ opacity: spring.o }}
    >
      <div className="absolute top-10 left-12.5 max-md:left-gutter font-extralight text-c4 leading-none tracking-tight2 text-ink">
        {"[   "}
        <div className="relative inline-block h-16 w-26 overflow-hidden align-top">
          <div
            id="odometer-numbers"
            className="absolute top-0 left-0 w-full text-center transition-transform duration-[var(--duration-odometer)] ease-linear"
          >
            {Array.from({ length: total + 1 }, (_, i) => (
              <div key={i} className="flex h-16 items-center justify-center leading-16">
                {String(i).padStart(3, "0")}
              </div>
            ))}
          </div>
        </div>
        {"   / 100 ]"}
      </div>
    </animated.div>
  );
};
