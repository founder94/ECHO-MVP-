"use client";

import { useEffect, useState } from "react";

import { whenIdle } from "@flora/lib/animation/idle-queue";

/**
 * False on the server and at hydration; true once an idle period has been
 * spent on this block (see `idle-queue.ts`) — or at once when `now` is true,
 * because a block that has to move this instant cannot wait for idle.
 */
export const useIdleReady = (now: boolean): boolean => {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (idle || now) return;
    return whenIdle(() => setIdle(true));
  }, [idle, now]);
  return idle || now;
};
