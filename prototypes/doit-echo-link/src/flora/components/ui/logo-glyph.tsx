"use client";

/**
 * The mark inside the header's lime tile — a seed head drawn as eight rays
 * around a core, with the stem running down.
 *
 * It opens the way the flower does: the core first, then the rays one after
 * the next, swinging out from the middle. Under the pointer the whole glyph
 * turns a few degrees, as the head does when it catches the light.
 *
 * Drawn here rather than loaded as a file because the rays have to move
 * separately, and an `<img>` has no inside.
 */

import { animated, useSprings, useSpring } from "@react-spring/web";
import { useEffect } from "react";

import { useArrived } from "@flora/components/common/flight/arrival";

/** The eight rays and the stem, in the order they open. */
const RAYS = [
  "M12 5.88V1.44",
  "M14.46 6.9L17.6 3.76",
  "M15.48 9.36H19.92",
  "M14.46 11.82L17.6 14.96",
  "M9.54 11.82L6.4 14.96",
  "M8.52 9.36H4.08",
  "M9.54 6.9L6.4 3.76",
  "M12 12.84V22.8",
];

const STEP = 52;
const OPENING = { tension: 220, friction: 20 };

export const LogoGlyph = ({ className = "" }: { className?: string }) => {
  const live = useArrived();

  const [core] = useSpring(
    () => ({ shown: live ? 1 : 0, config: { tension: 260, friction: 22 } }),
    [live],
  );

  const [rays, api] = useSprings(RAYS.length, () => ({
    out: 0,
    config: OPENING,
  }));

  useEffect(() => {
    if (!live) return;
    api.start((index) => ({ out: 1, delay: 120 + index * STEP }));
  }, [live, api]);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      /* The turn belongs to the whole mark, so it lives on the group and not
         on the rays, which are busy opening. */
    >
      <g className="origin-center transition-transform duration-[var(--duration-normal)] ease-[var(--ease-entrance)] group-hover:rotate-45">
        {RAYS.map((d, index) => (
          <animated.path
            key={d}
            d={d}
            stroke="#04090E"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{
              opacity: rays[index].out,
              transformOrigin: "12px 9.36px",
              transform: rays[index].out.to(
                (value) => `rotate(${(1 - value) * -38}deg) scale(${0.3 + value * 0.7})`,
              ),
            }}
          />
        ))}
        <animated.circle
          cx="12"
          cy="9.36"
          r="0.9"
          fill="#04090E"
          style={{ opacity: core.shown, transform: core.shown.to((v) => `scale(${v})`), transformOrigin: "12px 9.36px" }}
        />
      </g>
    </svg>
  );
};
