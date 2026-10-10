/**
 * Messages between the page (`scene-host.tsx`) and the scene worker
 * (`scene.worker.tsx`). Kept in a module of its own: the worker must not import
 * the file that launches it (a launcher inside the worker's own module graph
 * hung `next build` on flora).
 */
export type SceneMessage =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      /** `window.innerWidth`, which picks the device tier. */
      viewportWidth: number;
      /** The renderer's pixel ratio, already clamped to the tier's range. */
      dpr: number;
      /** The tier's frame rate — the worker paces its own loop with it. */
      targetFps: number;
      /** Whether to draw: the tab is visible and the scene not yet covered. */
      running: boolean;
    }
  | {
      /** The page's clocks and pointer — sent only when one of them changed. */
      type: "state";
      progress: number;
      target: number;
      intro: number;
      outro: number;
      /** Pointer in normalised device coordinates. */
      x: number;
      y: number;
    }
  | { type: "run"; on: boolean }
  /** 멈춤(움직임 줄이기 · 이용 안내) 중 한 장만: 시계는 멈춘 채 지금 상태(스크롤 등)로 그린다. */
  | { type: "frame" }
  | { type: "resize"; width: number; height: number; dpr: number };

export type SceneReply = { type: "error" };
