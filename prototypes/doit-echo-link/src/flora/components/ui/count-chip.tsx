"use client";

/**
 * The live relay count in the header, in the chip the design fills with lime.
 *
 * Under the pointer the chip turns itself inside out: the fill drains, the
 * digits take the accent, and the edge it leaves behind is **drawn** — a single
 * stroke that starts at the top left and travels the whole way round. The chip
 * is the one thing on the header that claims to be live, so its outline is laid
 * the way the panel lays its track and the logo opens its rays: a path being
 * travelled, not a border being switched on. Leaving, the stroke retraces
 * itself back to where it started.
 *
 * The outline is an SVG rather than a ring on the box because a box cannot be
 * drawn part of the way round. Its viewBox is the chip's own measure — 37.5 ×
 * 20 at the frame's base, and the chip keeps that ratio at every width because
 * both its type and its padding are rem — so the stroke sits on the chip's edge
 * without being scaled off it.
 */

import { animated, useSpring } from "@react-spring/web";

import { RelayCount } from "@flora/components/ui/relay-count";

export interface CountChipProps {
  value: string;
  /** Whether the thing the chip sits in is under the pointer or focused. */
  traced: boolean;
  className?: string;
}

/** The chip's own box and corner, in the units the design draws it at. */
const BOX = { width: 37.5, height: 20, corner: 2 };

/** Quick, and still when it arrives: an edge that wobbles is not an edge. */
const DRAWING = { tension: 210, friction: 32 };

export const CountChip = ({
  value,
  traced,
  className = "",
}: CountChipProps) => {
  const [{ drawn }] = useSpring(
    () => ({ drawn: traced ? 1 : 0, config: DRAWING }),
    [traced],
  );

  return (
    <span className={`relative ${className}`}>
      <RelayCount value={value} />
      {/* `overflow-visible`: the stroke straddles the chip's edge, and half of
          it falls outside the box it is drawn on. */}
      <svg
        aria-hidden
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        preserveAspectRatio="none"
        className="text-accent pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {/* `pathLength` normalises the run to 1, so the offset is simply how
            much of the way round is still to go — whatever the chip measures.
            `non-scaling-stroke` keeps the line a hairline while the box it is
            drawn on is stretched to the chip. */}
        <animated.rect
          x="0"
          y="0"
          width={BOX.width}
          height={BOX.height}
          rx={BOX.corner}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray={1}
          vectorEffect="non-scaling-stroke"
          style={{ strokeDashoffset: drawn.to((value) => 1 - value) }}
        />
      </svg>
    </span>
  );
};
