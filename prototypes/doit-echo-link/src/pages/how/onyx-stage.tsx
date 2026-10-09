import { useEffect, useRef, useState } from "react";

import type { OnyxHandle, OnyxMode } from "@fx/onyx/onyx-engine";

import { howCopy as c } from "./content";

/**
 * Onyx Cubes 효과 영역. 엔진(three 0.170 + cannon-es)은 이 영역이 화면 가까이 왔을 때 처음 불러온다 —
 * 첫 진입에 모든 엔진을 함께 싣지 않는다(대표 지시 §3). 글자는 이 영역 안에 두지 않는다(겹침 0).
 */
export const OnyxStage = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<OnyxHandle | null>(null);
  const [mode, setMode] = useState<OnyxMode>("watch");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const load = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        load.disconnect();
        import("@fx/onyx/onyx-engine")
          .then(({ createOnyx }) => {
            if (cancelled) return;
            const handle = createOnyx(canvas, host, { reducedMotion: reduced, mode: "watch" });
            if (!handle) setFailed(true);
            engine.current = handle;
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      { rootMargin: "200px 0px" },
    );
    load.observe(host);
    // 체험 중에 영역이 화면 밖으로 나가면 체험을 끝낸다(다시 스크롤 우선).
    const leave = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) setMode("watch");
    });
    leave.observe(host);
    return () => {
      cancelled = true;
      load.disconnect();
      leave.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setMode(mode);
    if (mode !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode("watch");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  return (
    <div className="how-stage-wrap">
      <div ref={hostRef} className={`onyx-stage${mode === "play" ? " is-playing" : ""}`}>
        {failed ? (
          <p className="onyx-fallback">{c.fallback}</p>
        ) : (
          <canvas ref={canvasRef} className="onyx-canvas" role="img" aria-label={c.stageLabel} />
        )}
      </div>
      {failed ? null : (
        <div className="onyx-controls">
          <button type="button" className="onyx-toggle" aria-pressed={mode === "play"} onClick={() => setMode(mode === "play" ? "watch" : "play")}>
            {mode === "play" ? c.stop : c.play}
          </button>
          <p className="onyx-hint" aria-live="polite">
            {mode === "play" ? c.playing : c.watching}
          </p>
        </div>
      )}
    </div>
  );
};
