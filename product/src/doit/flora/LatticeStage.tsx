import { useEffect, useRef, useState } from "react";
import type { ErlHandle, ErlPlay } from "./erl-engine";

/**
 * Einstein–Rosen Lattice(두 사람을 잇는 빛의 통로) — 서버가 「서로 선택」을 확인한 뒤 첫 대화로 들어가는 화면의 가운데 띠
 * (대표 2026-10-09 「추가 효과 배치」 §2 · 2026-10-10 「이 효과도 후킹 받아서 3D 효과 넣어라」).
 * 글자·버튼은 이 띠 밖(위·아래)에만 둔다. 엔진은 이 띠가 그려질 때만 불러온다. 움직임 줄이기면 멈춘 한 장('still').
 */
export default function LatticeStage({ play }: { play: ErlPlay }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let handle: ErlHandle | null = null;
    import("./erl-engine")
      .then(({ createLattice }) => {
        if (cancelled) return;
        handle = createLattice(canvas, host, play);
        if (!handle) setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; handle?.dispose(); };
  }, [play]);
  return (
    <div ref={hostRef} className="doit-erl-stage" aria-hidden="true">
      {failed ? <div className="doit-erl-fallback" /> : <canvas ref={canvasRef} className="doit-erl-canvas" />}
    </div>
  );
}
