import { useEffect, useRef, useState } from "react";

import type { ErlHandle, ErlPlay } from "@fx/erl/erl-engine";

import { connectedCopy as c } from "./content";

/**
 * Einstein–Rosen Lattice 효과 영역 — 화면 가운데 띠. 글자·버튼은 이 영역 밖(위·아래)에만 둔다.
 * 엔진(three 0.143)은 서버가 확인한 연결 상태에서 이 영역이 그려질 때만 불러온다.
 */
export const LatticeStage = ({ play }: { play: ErlPlay }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let handle: ErlHandle | null = null;
    import("@fx/erl/erl-engine")
      .then(({ createLattice }) => {
        if (cancelled) return;
        handle = createLattice(canvas, host, play);
        if (!handle) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [play]);

  return (
    <div ref={hostRef} className="erl-stage" aria-hidden={failed ? undefined : true}>
      {failed ? <div className="erl-fallback" /> : <canvas ref={canvasRef} className="erl-canvas" role="img" aria-label={c.stageLabel} />}
    </div>
  );
};
