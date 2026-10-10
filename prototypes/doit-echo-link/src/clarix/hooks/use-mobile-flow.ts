"use client";

// 📖 Docs: obsidian/frontend/scene-3d.md

import { useSyncExternalStore } from "react";

import { MOBILE_FLOW_QUERY } from "@clarix/utils/mobile-flow";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(MOBILE_FLOW_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** Whether this screen gets the phone form of the page (`utils/mobile-flow.ts`). False on the server. */
export const useMobileFlow = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_FLOW_QUERY).matches,
    () => false,
  );
