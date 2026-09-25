import { useEffect, useRef, useState } from 'react';
import { SYMBOL_DISPLAY_SRC, SYMBOL_ORIGINAL_SRC, fallbackToOriginal } from '@/components/symbolAssets';
import { SAMPLE_SIZE, readSymbol, type SymbolSample } from '@/components/symbolSampling';
import { metalTone } from '@/components/metalSilver';
import './symbol-loader.css';

// 기다리는 동안 보여 주는 심볼 3D 효과 (대표 2026-09-23 "심볼 생성해서 3D 효과 애니메이션 섞어서
// 사용자가 기다리는 동안 지루하지 않게 멋있게 … 로딩 시간일 때").
// 한 바퀴(CYCLE_S): 공간에 흩어진 빛의 점들이 돌며 공식 D 심볼로 모인다 → 완성된 심볼이 입체로 흔들리며
// 앞을 본다(뒤로 빛 번짐, 궤도를 도는 빛 한 점) → 다시 흩어진다.
// - 진행률(%)·남은 시간은 만들지 않는다. 서버가 알려 준 값이 아니면 거짓이 된다.
// - 심볼은 다시 그리지 않는다. 공식 그림에서 점 자리를 뽑는다(symbolSampling).
// - 심볼을 못 읽으면(아이폰 빈 그림 등) 원래 심볼 그림이 숨쉬듯 보인다(빠져나갈 문).
// - 동작 줄이기 설정이면 움직이지 않는 심볼만 보인다.

const CYCLE_S = 4.2;
const DOT_TARGET = 420;
const DPR_MAX = 2;
const TILT = 0.2; // 위에서 살짝 내려다보는 각도(라디안)

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 여러 로딩 화면이 같은 심볼을 매번 다시 읽지 않도록 한 번 읽은 결과를 나눠 쓴다. 실패하면 다음에 다시 읽는다.
let cached: Promise<SymbolSample> | null = null;
function sampleOnce(): Promise<SymbolSample> {
  if (!cached) {
    const attempt = readSymbol(SYMBOL_DISPLAY_SRC).catch(() => readSymbol(SYMBOL_ORIGINAL_SRC));
    cached = attempt;
    attempt.catch(() => { if (cached === attempt) cached = null; });
  }
  return cached;
}

function reducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
}

interface Point { tx: number; ty: number; tz: number; sx: number; sy: number; sz: number; r: number; ph: number; tone: string }

interface Props {
  size?: number; // 한 변(px)
  label?: string; // 아래에 적는 한 줄(무엇을 기다리는지)
  className?: string;
}

export default function SymbolLoader({ size = 120, label, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;
    let raf = 0;
    const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const points: Point[] = [];
    let keyed: HTMLCanvasElement | null = null;
    const t0 = performance.now();
    const c = size / 2;
    const box = size * 0.6; // 완성된 심볼 크기
    const dotScale = size / 120;
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);

    const frame = (now: number) => {
      if (!alive) return;
      const t = (now - t0) / 1000;
      const u = (t % CYCLE_S) / CYCLE_S;
      // 0~0.38 모임 · 0.38~0.72 완성 · 0.72~1 흩어짐
      const gather = u < 0.38 ? easeInOut(u / 0.38) : u < 0.72 ? 1 : 1 - easeInOut((u - 0.72) / 0.28);
      // 흩어져 있을 때는 크게 돌고, 모이면서 앞을 보도록 풀리며, 완성된 동안은 입체로 살짝 흔들린다.
      const angle = (1 - gather) * (Math.PI * 1.3 + t * 0.9) + gather * 0.38 * Math.sin(t * 1.9);
      const cosA = Math.cos(angle), sinA = Math.sin(angle);

      ctx.clearRect(0, 0, size, size);

      // 뒤쪽 빛 번짐 — 모일수록 밝아진다.
      const glow = ctx.createRadialGradient(c, c, 0, c, c, size * 0.5);
      // 차가운 은빛 번짐(가운데 밝은 반사 → 회청 은 → 사라짐)
      glow.addColorStop(0, `rgba(240,243,247,${0.06 + 0.22 * gather})`);
      glow.addColorStop(0.45, `rgba(169,176,186,${0.03 + 0.08 * gather})`);
      glow.addColorStop(1, 'rgba(169,176,186,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // 기울어진 궤도와 그 위를 도는 빛 한 점(뒤로 갈 때는 흐려진다) — 입체감.
      const rx = size * 0.44, ry = size * 0.12;
      // 금속 궤도: 반사 띠가 있는 은빛 선
      const ring = ctx.createLinearGradient(c - rx, c, c + rx, c);
      ring.addColorStop(0, '#8e959f'); ring.addColorStop(0.45, '#f5f6f8'); ring.addColorStop(0.7, '#b2b8c1'); ring.addColorStop(1, '#eef0f2');
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = ring;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(c, c, rx, ry, -0.32, 0, Math.PI * 2); ctx.stroke();
      const orbit = t * 2.2;
      const ox = Math.cos(orbit) * rx, oy = Math.sin(orbit) * ry;
      const rot = -0.32;
      const opx = c + ox * Math.cos(rot) - oy * Math.sin(rot);
      const opy = c + ox * Math.sin(rot) + oy * Math.cos(rot);
      ctx.globalAlpha = Math.sin(orbit) > 0 ? 0.95 : 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(opx, opy, 1.8 * dotScale, 0, Math.PI * 2); ctx.fill();

      // 다 모였을 때 떠오르는 공식 심볼의 진하기. 옆으로 돌면 얇아지고, 뒤를 보면 사라진다(점만 남음).
      const symbolAlpha = keyed && gather > 0.8 ? Math.pow((gather - 0.8) / 0.2, 2) * clamp01(cosA * 1.6) : 0;
      // 심볼이 떠오르는 동안 점은 물러난다 — 완성된 모습이 깔끔하게 보이도록(온보딩과 같은 방식).
      const dotFade = 1 - 0.92 * symbolAlpha;

      // 빛의 점: 흩어진 자리 → 심볼 자리. Y축으로 돌리고 살짝 내려다본 뒤 원근을 준다.
      for (const p of points) {
        const x0 = p.sx + (p.tx - p.sx) * gather;
        const y0 = p.sy + (p.ty - p.sy) * gather;
        const z0 = p.sz + (p.tz - p.sz) * gather;
        const x1 = x0 * cosA + z0 * sinA;
        const z1 = -x0 * sinA + z0 * cosA;
        const y2 = y0 * cosT - z1 * sinT;
        const z2 = y0 * sinT + z1 * cosT;
        const persp = 1.8 / (1.8 + z2);
        const px = c + x1 * box * persp;
        const py = c + y2 * box * persp;
        const twinkle = 0.75 + 0.25 * Math.sin(t * 3 + p.ph);
        ctx.globalAlpha = clamp01((0.3 + 0.7 * gather) * twinkle * (0.55 + 0.45 * persp) * dotFade);
        ctx.fillStyle = p.tone; // 메탈 실버 결
        ctx.beginPath(); ctx.arc(px, py, p.r * dotScale * (0.55 + 0.45 * persp), 0, Math.PI * 2); ctx.fill();
      }

      // 다 모였을 때 공식 심볼이 점 자리에 또렷하게 떠오른다.
      if (keyed && symbolAlpha > 0) {
        ctx.save();
        ctx.translate(c, c);
        ctx.scale(cosA, cosT);
        ctx.globalAlpha = symbolAlpha * 0.96;
        ctx.drawImage(keyed, -box / 2, -box / 2, box, box);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    void sampleOnce().then((sample) => {
      if (!alive) return;
      const rnd = mulberry32(20260923);
      const stride = Math.max(1, Math.floor(sample.candidates.length / DOT_TARGET));
      for (let i = 0; i < sample.candidates.length; i += stride) {
        const [x, y] = sample.candidates[i];
        const a = rnd() * Math.PI * 2;
        const b = Math.acos(2 * rnd() - 1);
        const radius = 0.55 + rnd() * 0.6;
        points.push({
          tx: x / SAMPLE_SIZE - 0.5, ty: y / SAMPLE_SIZE - 0.5, tz: (rnd() - 0.5) * 0.06,
          sx: Math.sin(b) * Math.cos(a) * radius, sy: Math.sin(b) * Math.sin(a) * radius * 0.8, sz: Math.cos(b) * radius,
          r: 0.7 + rnd() * 0.9, ph: rnd() * Math.PI * 2, tone: metalTone(points.length),
        });
      }
      keyed = sample.keyed;
      setReady(true);
      raf = requestAnimationFrame(frame);
    }).catch(() => { /* 원래 심볼 그림이 숨쉬듯 보인다 */ });

    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [size]);

  return (
    <div className={`doit-symbol-loader${ready ? ' doit-symbol-loader--ready' : ''} ${className}`.trim()} role={label ? 'status' : undefined} aria-live={label ? 'polite' : undefined}>
      <div className="doit-symbol-loader-stage" style={{ width: size, height: size }} aria-hidden="true">
        <canvas ref={canvasRef} />
        <img className="doit-symbol-loader-fallback" src={SYMBOL_DISPLAY_SRC} onError={(event) => fallbackToOriginal(event.currentTarget)} alt="" draggable={false} />
      </div>
      {label && <p className="doit-symbol-loader-label">{label}</p>}
    </div>
  );
}
