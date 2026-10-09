"use client";

import { useEffect, useState } from "react";

/** The four frames the design is drawn at. */
export type Frame = "wide" | "laptop" | "tablet" | "phone";

/**
 * Which of the design's frames the viewport is being drawn to.
 *
 * Nearly everything adaptive here is a measure, and a measure belongs in CSS —
 * a token the media queries re-set, or a `max-laptop:` variant on the block it
 * moves. This is for the rest: readings the design takes by eye that a screen
 * has to interpolate between in JS, where a class name cannot reach. The
 * fluff's arc is the one such place.
 *
 * The thresholds are the media queries in `globals.css`, one past each frame's
 * own width, and must be changed with them.
 */
const QUERIES: readonly (readonly [Frame, string])[] = [
  ["phone", "(max-width: 640px)"],
  ["tablet", "(max-width: 768px)"],
  ["laptop", "(max-width: 1024px)"],
];

export const useFrame = (): Frame => {
  /* The server has no viewport, so it draws the wide frame; the first client
     render says the same and hydration has nothing to disagree about. The
     effect below then settles on the real one, before paint. */
  const [frame, setFrame] = useState<Frame>("wide");

  useEffect(() => {
    const lists = QUERIES.map(([name, query]) => {
      const list = window.matchMedia(query);
      return [name, list] as const;
    });
    const read = () => {
      const hit = lists.find(([, list]) => list.matches);
      setFrame(hit ? hit[0] : "wide");
    };

    read();
    lists.forEach(([, list]) => list.addEventListener("change", read));
    return () =>
      lists.forEach(([, list]) => list.removeEventListener("change", read));
  }, []);

  return frame;
};
