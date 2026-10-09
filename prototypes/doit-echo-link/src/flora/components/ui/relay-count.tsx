"use client";

/**
 * The live count of relays in the header's chip.
 *
 * It is not a picture of a number. A relay network gains and loses nodes, so
 * this one drifts — and it does not simply swap digits: the new figure is
 * pulled out of a run of noise, the way a value is before it has been relayed
 * and after it has been observed. The design's own reading.
 *
 * Nothing runs until the header has arrived, and nothing runs while the tab is
 * hidden: a counter ticking in a background tab is work nobody is watching.
 */

import { useEffect, useRef, useState } from "react";

import { useArrived } from "@flora/components/common/flight/arrival";

export interface RelayCountProps {
  /** The figure the design sets; the drift starts from it. */
  value: string;
  className?: string;
}

/**
 * How long before the first reading, how long between the rest, and how fast
 * the noise runs. The first comes quickly: a counter that sits still for four
 * seconds is a counter nobody believes is live.
 */
const FIRST = 1400;
const EVERY = 3000;
const FRAME = 46;
const FRAMES = 11;

const DIGITS = "0123456789";
const noise = () => DIGITS[Math.floor(Math.random() * 10)];

/** A relay count wanders; it does not jump. */
const drift = (from: number): number => {
  const step = Math.random() < 0.72 ? 1 : 2;
  const next = from + (Math.random() < 0.5 ? -step : step);
  return Math.min(399, Math.max(301, next));
};

export const RelayCount = ({ value, className = "" }: RelayCountProps) => {
  const live = useArrived();
  const [shown, setShown] = useState(value);
  const count = useRef(Number.parseInt(value, 10) || 340);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    let frame = 0;
    let timer = 0;

    const settle = (target: string) => {
      frame += 1;
      const known = Math.floor((frame / FRAMES) * target.length);
      setShown(
        target
          .split("")
          .map((digit, index) => (index < known ? digit : noise()))
          .join(""),
      );
      if (frame < FRAMES) {
        timer = window.setTimeout(() => settle(target), FRAME);
      } else {
        setShown(target);
        timer = window.setTimeout(reading, EVERY);
      }
    };

    const reading = () => {
      if (stopped || document.hidden) {
        timer = window.setTimeout(reading, EVERY);
        return;
      }
      count.current = drift(count.current);
      frame = 0;
      settle(String(count.current).padStart(value.length, "0"));
    };

    timer = window.setTimeout(reading, FIRST);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [live, value]);

  return (
    <span className={className} aria-live="off">
      {shown}
    </span>
  );
};
