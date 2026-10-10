import { useEffect, useRef } from "react";
import {
  BRANCHES, BRANCHES_KO, STEMS, STEMS_KO, elementOfBranch, elementOfStem, hiddenStemsOf, tenGodOf, twelveStageOf,
  type FlowCell, type Pillar,
} from "@/doit/lib/saju/engine";
import { EL_COLOR } from "@/doit/lib/saju/words";

// 2026-10-10 대표 「사주 예시처럼 후킹박고 자세하게 설명」: 대표가 보낸 만세력 예시(원국 표 · 대운 · 연운 · 월운 · 오행 상생상극)를
// 같은 정보 구조로 그린다. 그림·화면은 우리 것(다른 서비스 화면을 옮기지 않음) · 값은 engine.ts 계산값만 · 해설은 아래 규칙 문장만(AI 0).

function Cell({ ch, ko, el, small, me }: { ch: string; ko: string; el: string; small?: boolean; me?: boolean }) {
  const c = EL_COLOR[el];
  return <span className={`saju-cell${small ? " is-small" : ""}${me ? " is-me" : ""}`} style={{ background: c.bg, color: c.fg, ["--el-fg" as string]: c.fg }}>
    <b>{ch}</b><i>{ko}</i>
  </span>;
}

/** 원국 표: 위 칸 천간(십신) · 아래 칸 지지(십신) · 지장간 · 12운성 — 대표 예시 4·5번과 같은 구조 */
export function PillarBoard({ cols, dayStem }: { cols: { label: string; p: Pillar | null; isDay?: boolean }[]; dayStem: number }) {
  return <div className="saju-board" role="table" aria-label="사주 원국">
    {cols.map(({ label, p, isDay }) => <div key={label} className={`saju-board-col${isDay ? " is-day" : ""}`} role="rowgroup">
      <p className="saju-board-head">{label}</p>
      {p ? <>
        <p className="saju-board-god">{isDay ? "나" : tenGodOf(dayStem, p.stem)}</p>
        <Cell ch={STEMS[p.stem]} ko={STEMS_KO[p.stem]} el={elementOfStem(p.stem)} me={isDay} />
        <Cell ch={BRANCHES[p.branch]} ko={BRANCHES_KO[p.branch]} el={elementOfBranch(p.branch)} />
        <p className="saju-board-god">{tenGodOf(dayStem, hiddenStemsOf(p.branch)[hiddenStemsOf(p.branch).length - 1])}</p>
        <div className="saju-hidden" aria-label="지장간">
          {hiddenStemsOf(p.branch).map((s, i) => <span key={i} style={{ background: EL_COLOR[elementOfStem(s)].bg, color: EL_COLOR[elementOfStem(s)].fg, ["--el-fg" as string]: EL_COLOR[elementOfStem(s)].fg }}>
            <b>{STEMS[s]}</b><small>{tenGodOf(dayStem, s)}</small>
          </span>)}
        </div>
        <p className="saju-board-stage">{twelveStageOf(dayStem, p.branch)}</p>
      </> : <div className="saju-board-empty">모름</div>}
    </div>)}
  </div>;
}

/** 대운·연운·월운 칸 줄 — 대표 예시 3·5번 구조(위 숫자 · 십신 · 천간 · 지지 · 십신 · 12운성). 지금 칸은 테두리 · 처음에 지금 칸이 보이게 */
export function FlowGrid({ cells, nowIndex, label, onPick, picked }: {
  cells: FlowCell[]; nowIndex: number; label: string; onPick?: (i: number) => void; picked?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(".is-now");
    if (el && ref.current) ref.current.scrollLeft = Math.max(0, el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2);
  }, [nowIndex]);
  return <div className="saju-flow" ref={ref} role="list" aria-label={label}>
    {cells.map((c, i) => {
      const body = <>
        <span className="saju-flow-top"><b>{c.label}</b><small>{c.sub}</small></span>
        <span className="saju-flow-god">{c.stemGod}</span>
        <Cell small ch={STEMS[c.pillar.stem]} ko={STEMS_KO[c.pillar.stem]} el={elementOfStem(c.pillar.stem)} />
        <Cell small ch={BRANCHES[c.pillar.branch]} ko={BRANCHES_KO[c.pillar.branch]} el={elementOfBranch(c.pillar.branch)} />
        <span className="saju-flow-god">{c.branchGod}</span>
        <span className="saju-flow-stage">{c.stage}</span>
      </>;
      const cls = `saju-flow-col${i === nowIndex ? " is-now" : ""}${picked === i ? " is-picked" : ""}`;
      return onPick
        ? <div key={i} role="listitem" className="saju-flow-item"><button type="button" className={cls} aria-pressed={picked === i} onClick={() => onPick(i)}>{body}</button></div>
        : <div key={i} role="listitem" className={cls}>{body}</div>;
    })}
  </div>;
}


const ORDER = ["wood", "fire", "earth", "metal", "water"] as const;
const KO = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" } as const;

/** 오행 상생·상극 그림 — 둘레 실선 화살표 = 살려 줌(목→화→토→금→수→목) · 안쪽 점선 화살표 = 눌러 줌(목→토→수→화→금→목). 원 크기 = 내 명식 속 개수 */
export function ElementCycle({ counts }: { counts: Record<string, number> }) {
  const P: Record<string, [number, number]> = { wood: [150, 46], fire: [250, 118], earth: [212, 236], metal: [88, 236], water: [50, 118] };
  const R = (k: string) => 22 + Math.min(counts[k] ?? 0, 4) * 3;
  const edge = (a: string, b: string, pad = 6) => {
    const [x1, y1] = P[a], [x2, y2] = P[b]; const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    const ra = R(a) + pad, rb = R(b) + pad + 4;
    return { x1: x1 + (dx / d) * ra, y1: y1 + (dy / d) * ra, x2: x2 - (dx / d) * rb, y2: y2 - (dy / d) * rb, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  };
  const gen = ORDER.map((k, i) => [k, ORDER[(i + 1) % 5]] as const);
  const ctl = ORDER.map((k, i) => [k, ORDER[(i + 2) % 5]] as const);
  return <svg className="saju-cycle" viewBox="0 0 300 290" role="img"
    aria-label={`오행 상생·상극 · ${ORDER.map((k) => `${EL_COLOR[k].name} ${counts[k] ?? 0}개`).join(", ")}`}>
    <defs>
      <marker id="saju-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.85)" /></marker>
      <marker id="saju-arrow-ctl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.55)" /></marker>
    </defs>
    {ctl.map(([a, b]) => { const e = edge(a, b); return <line key={`c${a}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="rgba(255,255,255,.5)" strokeWidth="1.2" strokeDasharray="4 4" markerEnd="url(#saju-arrow-ctl)" />; })}
    {gen.map(([a, b]) => { const e = edge(a, b); return <g key={`g${a}`}>
      <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="rgba(255,255,255,.85)" strokeWidth="1.6" markerEnd="url(#saju-arrow)" />
      <text x={e.mx + (e.mx - 150) * 0.16} y={e.my + (e.my - 150) * 0.16 + 4} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.75)">상생</text>
    </g>; })}
    <text x="150" y="160" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,.7)">상극</text>
    {ORDER.map((k) => { const [x, y] = P[k]; const n = counts[k] ?? 0; return <g key={k} opacity={n ? 1 : 0.45}>
      <circle cx={x} cy={y} r={R(k)} fill={EL_COLOR[k].bg} stroke="#fff" strokeWidth="1.5" />
      <text x={x} y={y + 2} textAnchor="middle" fontSize="15" fontWeight="700" fill={EL_COLOR[k].fg}>{KO[k]}</text>
      <text x={x} y={y + 16} textAnchor="middle" fontSize="10" fill={EL_COLOR[k].fg}>{n}개</text>
    </g>; })}
  </svg>;
}
