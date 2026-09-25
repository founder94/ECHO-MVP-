import { useEffect, useRef } from 'react';

// 온보딩 3D 연출(2026-09-21 대표 지시): 별 워프 + 공식 심볼이 점에서 모여 완성 + 기울기 + 100% 빛 번짐.
// - 라이브러리 없음(캔버스 2D). 390px 60fps 를 목표로 점 개수·해상도를 제한한다.
// - 심볼은 다시 그리지 않는다. 점은 공식 원본 PNG(/brand/doit-symbol-original.png)에서 샘플링한다.
// - progress(1~100)는 부모(intro 페이지)의 타임라인이 정한다. 여기서는 그리기만 한다.
// - 캔버스·이미지 읽기에 실패하면 아무것도 그리지 않는다(기존 온보딩이 그대로 보인다).

interface Props { progress: number; leaving: boolean; symbolSrc?: string }

const STAR_COUNT = 320;
const DOT_TARGET = 700;
const SAMPLE_SIZE = 128;
const KEYED_SIZE = 512; // 표시 크기(최대 220px × 2배 해상도)보다 큰 정사각형에 배경을 뺀 심볼을 준비한다.
const DPR_MAX = 2;
const SYMBOL_BOX_CSS = 'clamp(144px, 38vw, 220px)'; // DoItIntroFrame 의 심볼 크기와 같아야 점이 PNG 위에 정확히 겹친다.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Star { x: number; y: number; z: number; tw: number }
interface Dot { sx: number; sy: number; sz: number; tx: number; ty: number; r: number; ph: number }

function symbolBoxPx(viewportWidth: number): number {
  // clamp(144px, 38vw, 220px)
  return Math.max(144, Math.min(220, viewportWidth * 0.38));
}

// 공식 파일은 배경이 '거의 검정'(순검정 아님)이라 그대로 합성하면 빛 번짐 위에 네모가 비친다.
// 배경 픽셀(밝기 28 이하)을 투명으로 빼고 그 경계는 부드럽게 섞는다. 심볼과 그림자는 그대로 둔다.
function keyOutBackground(img: HTMLImageElement): HTMLCanvasElement | null {
  const keyed = document.createElement('canvas');
  keyed.width = KEYED_SIZE; keyed.height = KEYED_SIZE;
  const kctx = keyed.getContext('2d', { willReadFrequently: true });
  if (!kctx) return null;
  kctx.drawImage(img, 0, 0, KEYED_SIZE, KEYED_SIZE);
  const image = kctx.getImageData(0, 0, KEYED_SIZE, KEYED_SIZE);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const alpha = clamp01((lum - 12) / 16); // 12 이하 = 완전 투명, 28 이상 = 그대로
    d[i + 3] = Math.round(d[i + 3] * alpha);
  }
  kctx.putImageData(image, 0, 0);
  return keyed;
}

async function sampleSymbol(src: string, rnd: () => number): Promise<{ dots: Dot[]; img: HTMLImageElement | HTMLCanvasElement }> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const off = document.createElement('canvas');
  off.width = SAMPLE_SIZE; off.height = SAMPLE_SIZE;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  const keyed = keyOutBackground(img) ?? img;
  if (!ctx) return { dots: [], img: keyed };
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const candidates: Array<[number, number]> = [];
  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < SAMPLE_SIZE; x += 1) {
      const i = (y * SAMPLE_SIZE + x) * 4;
      const alpha = data[i + 3];
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      // 공식 파일은 검은 배경(알파 없음). 흰 종이 부분(밝기 150 이상)만 점으로 뽑고 그림자는 제외한다.
      if (alpha > 96 && lum > 150) candidates.push([x, y]);
    }
  }
  if (!candidates.length) return { dots: [], img: keyed };
  const stride = Math.max(1, Math.floor(candidates.length / DOT_TARGET));
  const dots: Dot[] = [];
  for (let i = 0; i < candidates.length; i += stride) {
    const [x, y] = candidates[i];
    // 시작 위치: 심볼 주변 구(球) 안 무작위(깊이 포함). 도착 위치: 원본 픽셀 자리(-0.5~0.5 정규화).
    const a = rnd() * Math.PI * 2;
    const b = Math.acos(2 * rnd() - 1);
    const radius = 0.9 + rnd() * 1.4;
    dots.push({
      sx: Math.sin(b) * Math.cos(a) * radius,
      sy: Math.sin(b) * Math.sin(a) * radius,
      sz: Math.cos(b) * radius,
      tx: x / SAMPLE_SIZE - 0.5 + (rnd() - 0.5) / SAMPLE_SIZE,
      ty: y / SAMPLE_SIZE - 0.5 + (rnd() - 0.5) / SAMPLE_SIZE,
      r: 0.9 + rnd() * 1.1,
      ph: rnd() * Math.PI * 2,
    });
  }
  return { dots, img: keyed };
}

export default function IntroUniverse({ progress, leaving, symbolSrc = '/brand/doit-symbol-original.png' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);
  const leavingRef = useRef(leaving);
  progressRef.current = progress;
  leavingRef.current = leaving;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const rnd = mulberry32(20260921);
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: 0.08 + rnd() * 0.92, tw: rnd() * Math.PI * 2 }));
    let dots: Dot[] = [];
    let symbolImg: HTMLImageElement | HTMLCanvasElement | null = null;
    let width = 0, height = 0, dpr = 1;
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const onPointer = (event: PointerEvent) => {
      tilt.tx = (event.clientX / Math.max(1, width) - 0.5) * 2;
      tilt.ty = (event.clientY / Math.max(1, height) - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    void sampleSymbol(symbolSrc, rnd).then((sampled) => { if (alive) { dots = sampled.dots; symbolImg = sampled.img; } }).catch(() => { /* 점 없이 별만 그린다 */ });

    let last = performance.now();
    let travel = 0; // 별 워프 누적 이동량
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = clamp01((progressRef.current - 1) / 99);
      // 속도: 1→22% 천천히, 22→100% 가속, 100%에서 멈춤(leaving 이면 앞으로 밀림).
      const speed = leavingRef.current ? 2.4 : p < 0.21 ? 0.12 + p * 0.6 : 0.25 + easeOut((p - 0.21) / 0.79) * 1.15 * (1 - Math.pow(p, 8));
      travel += speed * dt;
      // 기울기: 포인터가 있으면 따라가고, 없으면 느린 자동 흔들림.
      const auto = { x: Math.sin(now / 2600) * 0.35, y: Math.cos(now / 3100) * 0.25 };
      const targetX = tilt.tx || auto.x, targetY = tilt.ty || auto.y;
      tilt.x += (targetX - tilt.x) * 0.04; tilt.y += (targetY - tilt.y) * 0.04;

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2 + tilt.x * 8, cy = height * 0.47 + tilt.y * 6;
      const focal = Math.min(width, height) * 0.9;

      // 별 워프
      for (const s of stars) {
        s.z -= speed * dt * 0.35;
        if (s.z <= 0.06) { s.z = 1; s.x = rnd() * 2 - 1; s.y = rnd() * 2 - 1; }
        const px = cx + (s.x / s.z) * focal * 0.5;
        const py = cy + (s.y / s.z) * focal * 0.5;
        if (px < -4 || py < -4 || px > width + 4 || py > height + 4) continue;
        const depth = 1 - s.z;
        const size = 0.6 + depth * 2.1;
        const twinkle = 0.75 + 0.25 * Math.sin(now / 700 + s.tw);
        ctx.globalAlpha = Math.min(1, (0.18 + depth * 0.7) * twinkle);
        // 빠를수록 꼬리(선)로 그려 속도감을 낸다.
        if (speed > 0.6) {
          const tail = Math.min(26, (speed - 0.5) * 14 * depth);
          const dirx = px - cx, diry = py - cy;
          const len = Math.hypot(dirx, diry) || 1;
          ctx.strokeStyle = '#f4f3ef'; ctx.lineWidth = size * 0.9;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - (dirx / len) * tail, py - (diry / len) * tail); ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(px, py, size * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // 100% 빛 번짐: 96% 부터 심볼 뒤에 부드러운 원광이 커진다(점·심볼보다 먼저 그린다).
      const bloom = clamp01((progressRef.current - 96) / 4);
      if (bloom > 0) {
        const box = symbolBoxPx(width);
        const radius = box * (0.7 + bloom * 0.9);
        const bx = width / 2 + tilt.x * 8, by = height / 2 - box * 0.03 + tilt.y * 6;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
        g.addColorStop(0, `rgba(244,243,239,${0.32 * bloom})`);
        g.addColorStop(0.45, `rgba(244,243,239,${0.10 * bloom})`);
        g.addColorStop(1, 'rgba(244,243,239,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(bx - radius, by - radius, radius * 2, radius * 2);
      }

      // 심볼 점: 8%~88% 사이에 흩어진 자리에서 원본 자리로 모인다. 88% 이후 원본 이미지가 위에 떠오르고 점은 사라진다.
      if (dots.length) {
        const box = symbolBoxPx(width);
        const gather = easeInOut(clamp01((progressRef.current - 8) / 80));
        const fade = 1 - clamp01((progressRef.current - 88) / 12);
        const swirl = (1 - gather) * Math.PI * 0.9;
        // 원본 PNG 는 화면 세로 중앙에 놓이고 자기 높이의 3% 만큼 올라간다(DoItIntroFrame). 점도 정확히 같은 자리로 모인다.
        const symbolCy = height / 2 - box * 0.03 + tilt.y * 6;
        for (const d of dots) {
          // 시작점을 살짝 회전시켜 모이는 동안 소용돌이가 생긴다.
          const ca = Math.cos(swirl), sa = Math.sin(swirl);
          const sx = d.sx * ca - d.sy * sa, sy = d.sx * sa + d.sy * ca;
          const x = sx + (d.tx - sx) * gather;
          const y = sy + (d.ty - sy) * gather;
          const z = d.sz * (1 - gather);
          const persp = 1 / (1 + z * 0.45);
          const px = width / 2 + tilt.x * 8 + (x * box + tilt.x * (1 - gather) * 40) * persp;
          const py = symbolCy + (y * box + tilt.y * (1 - gather) * 30) * persp;
          const pulse = 0.7 + 0.3 * Math.sin(now / 900 + d.ph);
          ctx.globalAlpha = fade * (0.35 + 0.65 * gather) * pulse;
          ctx.fillStyle = '#f4f3ef';
          ctx.beginPath(); ctx.arc(px, py, d.r * (0.8 + 0.4 * persp), 0, Math.PI * 2); ctx.fill();
        }
      }

      // 원본 심볼(공식 파일 그대로)을 캔버스 안에서 'screen' 으로 합성한다: 검은 배경은 사라지고 흰 종이만 별·빛 위에 떠오른다.
      // DOM <img> 의 blend 는 캔버스 위에서 일정하지 않아(네모 비침) 여기서 직접 그린다. 88%→100% 에서 떠오른다.
      const reveal = clamp01((progressRef.current - 88) / 12);
      if (symbolImg && reveal > 0) {
        const box = symbolBoxPx(width) * (0.96 + 0.04 * p);
        const sx = width / 2 + tilt.x * 8 - box / 2;
        const sy = height / 2 - symbolBoxPx(width) * 0.03 + tilt.y * 6 - box / 2;
        // 배경을 뺀 심볼이라 보통 합성(source-over)으로 그린다. 그림자도 원본 그대로 빛 위에 얹힌다.
        ctx.globalAlpha = reveal;
        ctx.drawImage(symbolImg, sx, sy, box, box);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [symbolSrc]);

  return (
    <canvas
      ref={canvasRef}
      data-doit-intro-universe=""
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  );
}

export const INTRO_SYMBOL_BOX_CSS = SYMBOL_BOX_CSS;
