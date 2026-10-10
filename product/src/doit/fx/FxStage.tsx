import { useEffect, useRef, useState } from "react";
import { readTier, sceneShouldFreeze } from "@/doit/flora/scene/device";
import type { FxHandle, FxPlay } from "./house";
import "./fx.css";

/**
 * 대표 전달 효과 4개(2026-10-10)를 기다리는 자리에 붙이는 그림 칸.
 *  - dna    : ECHO가 내 말을 읽는 동안(대화 기다림)
 *  - glass  : 타로 해석을 기다리는 동안
 *  - planet : 아직 보여 드릴 사람이 없을 때(잠든 사이 기다림)
 *  - storm-pair : 찌릿 화면 가운데(서로 선택 확인 뒤 · 2026-10-10 대표 B안 채택)
 * 엔진은 이 칸이 실제로 보일 때만 불러온다(첫 화면 무게 0). 짧은 기다림(delayMs 안에 끝남)이면 아예 만들지 않는다 — 번쩍임 방지.
 * 움직임 줄이기·절전이면 다 나타난 한 장(still). WebGL 이 안 되면 그림 칸만 은은한 빛으로 바뀌고 글·버튼은 그대로.
 * 글자는 이 칸 밖(아래)에 둔다 — 효과 위에 글을 얹지 않아 대비 문제 0.
 */
export type FxKind = "dna" | "glass" | "planet" | "storm" | "storm-pair";

type Create = (c: HTMLCanvasElement, h: HTMLElement, play: FxPlay, onReady: () => void, onFail: () => void) => FxHandle | null;
const load = (fx: FxKind): Promise<Create> => {
  switch (fx) {
    case "dna": return import("./dna").then((m) => (c, h, play, onReady) => { const r = m.createDna(c, h, { play, progress: { max: 0.35, seconds: 24 } }); onReady(); return r; });
    case "glass": return import("./glass").then((m) => (c, h, play, onReady) => m.createGlass(c, h, { play, onReady }));
    case "planet": return import("./planet").then((m) => (c, h, play, onReady, onFail) => m.createPlanet(c, h, { play, onReady, onFail }));
    case "storm": return import("./storm").then((m) => (c, h, play, onReady) => { const r = m.createStorm(c, h, { play }); onReady(); return r; });
    case "storm-pair": return import("./storm").then((m) => (c, h, play, onReady) => { const r = m.createStorm(c, h, { play, layout: "pair" }); onReady(); return r; });
  }
};

export default function FxStage({ fx, delayMs = 0, className = "" }: { fx: FxKind; delayMs?: number; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [armed, setArmed] = useState(delayMs <= 0);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (armed) return;
    const t = window.setTimeout(() => setArmed(true), delayMs);
    return () => window.clearTimeout(t);
  }, [armed, delayMs]);

  useEffect(() => {
    if (!armed) return;
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let handle: FxHandle | null = null;
    const play: FxPlay = sceneShouldFreeze(readTier()) ? "still" : "live";
    const start = () => {
      load(fx)
        .then((create) => {
          if (cancelled) return;
          handle = create(canvas, host, play, () => { if (!cancelled) setState("ready"); }, () => { if (!cancelled) setState("failed"); });
          if (!handle) setState("failed");
        })
        .catch(() => { if (!cancelled) setState("failed"); });
    };
    // 엔진·모형은 이 칸이 실제로 화면에 들어올 때 처음 불러온다(아래에 있으면 내려야 받음 · Codex #159 P2)
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io?.disconnect(); io = null;
        start();
      });
      io.observe(host);
    } else start();
    return () => { cancelled = true; io?.disconnect(); handle?.dispose(); };
  }, [armed, fx]);

  if (!armed) return null;
  return (
    <div ref={hostRef} className={`doit-fx doit-fx--${fx} ${className}`} data-state={state} aria-hidden="true">
      {state === "failed" ? <div className="doit-fx-fallback" /> : <canvas ref={canvasRef} className="doit-fx-canvas" />}
    </div>
  );
}

/** 기다리는 동안 한 줄씩 바뀌는 안내(후킹). 사실인 말만 — 정해진 문장 목록(서버 대화 질문과 무관한 화면 안내). 읽어 주기는 첫 줄만(바뀔 때마다 읽지 않음). */
export function WaitHook({ lines, everyMs = 3200 }: { lines: readonly string[]; everyMs?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % lines.length), everyMs);
    return () => window.clearInterval(t);
  }, [lines, everyMs]);
  return <p className="doit-fx-hook" aria-hidden={i > 0 ? "true" : undefined} key={i}>{lines[i]}</p>;
}
