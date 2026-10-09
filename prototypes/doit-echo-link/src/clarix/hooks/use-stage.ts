// 📖 Docs: obsidian/frontend/scene-3d.md

import { create } from "zustand";

/**
 * The page's choreography state, shared by the WebGL frame loop
 * (`src/lib/scene/clarix.ts`) and the React leaves it drives.
 *
 * - `preloaderDone` — the odometer reached 100 and the blob shattered: the
 *   preloader fades, the hero chrome and the hero title reveal (the shipped
 *   page removed `.preload-hidden` and staggered `.revealed` at this moment).
 * - `revealed` — titles the frame loop has triggered by scroll position (the
 *   shipped page's `triggerTextReveal(selector)`); each fires once.
 */
interface StageState {
  preloaderDone: boolean;
  revealed: Readonly<Record<string, true>>;
  finishPreloader: () => void;
  reveal: (id: string) => void;
}

export const useStage = create<StageState>((set, get) => ({
  preloaderDone: false,
  revealed: {},
  finishPreloader: () => {
    if (!get().preloaderDone) set({ preloaderDone: true });
  },
  reveal: (id) => {
    if (!get().revealed[id]) set({ revealed: { ...get().revealed, [id]: true } });
  },
}));
