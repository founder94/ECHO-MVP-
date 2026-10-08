"use client";

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@vesper/lib/animation/ticker";
import { ORB, ORB_CONFIG } from "@vesper/lib/scene/constants";

/** Fall direction, measured from straight down. */
const ANGLE = -0.32; // radians, ~18° — streaks lean left as they fall

const STAR_COUNT = 140;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * The hero orb's gradient — mint (top) → cyan (mid) → violet (bottom) — sampled
 * so the streaks rain down in the first scene's colours. Each star draws one
 * colour from `seed`, so the field spreads across the whole gradient at once.
 */
const ORB_GRADIENT = [
  hexToRgb(ORB_CONFIG.colorTop), // #52ffa5 mint
  hexToRgb(ORB.flameB), //          #6bfdff cyan
  hexToRgb(ORB_CONFIG.colorBottom), // #582eff violet
];

const sampleOrb = (t: number): [number, number, number] => {
  const scaled = Math.min(Math.max(t, 0), 1) * (ORB_GRADIENT.length - 1);
  const i = Math.min(Math.floor(scaled), ORB_GRADIENT.length - 2);
  const f = scaled - i;
  const a = ORB_GRADIENT[i];
  const b = ORB_GRADIENT[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
};

interface Star {
  x: number;
  y: number;
  /** Depth, 0 (far) → 1 (near). Drives speed, length, width and opacity. */
  z: number;
  seed: number;
  /** Streak colour, sampled from the orb gradient by `seed`. */
  r: number;
  g: number;
  b: number;
}

export interface StarFallProps {
  /**
   * 0 → 1 while loading, then climbs past 1 as the curtain leaves. Streaks
   * lengthen and accelerate with it, so the field opens up into warp on exit.
   */
  intensity: () => number;
}

/**
 * The loader's field of falling stars.
 *
 * Long trails, angled, growing longer and faster as the load progresses — a
 * render loop rather than a spring, for the same reason the WebGL scene is: it
 * is a continuous particle field, not a transition between two states. It runs
 * on the shared ticker, so it costs no extra `requestAnimationFrame`.
 */
export const StarFall = ({ intensity }: StarFallProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const dx = Math.sin(ANGLE);
    const dy = Math.cos(ANGLE);

    const spawn = (star: Star, initial: boolean) => {
      star.z = Math.random();
      star.seed = Math.random();
      [star.r, star.g, star.b] = sampleOrb(star.seed);
      // Spawn above the frame, offset so the angled drift still covers it.
      star.x = Math.random() * (width + height * Math.abs(dx)) - height * Math.abs(dx) * 0.5;
      star.y = initial ? Math.random() * height : -Math.random() * height * 0.4 - 40;
    };

    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => {
      const star = { x: 0, y: 0, z: 0, seed: 0, r: 255, g: 255, b: 255 };
      spawn(star, true);
      return star;
    });

    let last = performance.now();

    return subscribeToTicker(() => {
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;

      const boost = intensity();
      // Trails are drawn by fading rather than clearing, so each streak leaves a
      // tail. The fade weakens as `boost` grows, which lengthens the trails.
      ctx.globalCompositeOperation = "source-over";
      // Pure black trail-fade — the loader background is black (was the void
      // purple, which tinted the whole curtain over the container's bg-black).
      // The fade is authored per 1/60 s: scaled by the frame's delta, the
      // trails keep their length at 120 Hz instead of halving.
      const fade = 0.34 - Math.min(boost, 2) * 0.1;
      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - Math.pow(1 - fade, delta * 60)).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";

      for (const star of stars) {
        const depth = 0.25 + star.z * 0.75;
        const speed = (140 + depth * 620) * (0.55 + boost * 1.35);
        const step = speed * delta;

        const px = star.x;
        const py = star.y;
        star.x += dx * step;
        star.y += dy * step;

        // Streak length grows with depth and with the load, up to a warp smear.
        const length = step * (1.1 + boost * 1.6);
        const tailX = px - dx * length;
        const tailY = py - dy * length;

        const alpha = (0.10 + depth * 0.5) * Math.min(1, 0.35 + boost);
        // Trail fades out in the star's orb colour; the leading point pushes a
        // little toward white so the head still reads as a hot comet tip.
        const hr = Math.round(star.r + (255 - star.r) * 0.3);
        const hg = Math.round(star.g + (255 - star.g) * 0.3);
        const hb = Math.round(star.b + (255 - star.b) * 0.3);
        const grad = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
        grad.addColorStop(0, `rgba(${star.r},${star.g},${star.b},0)`);
        grad.addColorStop(1, `rgba(${hr},${hg},${hb},${alpha.toFixed(3)})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.5 + depth * 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(star.x, star.y);
        ctx.stroke();

        if (star.y - length > height || star.x < -height || star.x > width + height) {
          spawn(star, false);
        }
      }

      ctx.globalCompositeOperation = "source-over";
    }, () => 0);
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    return () => void (canvas && (canvas.width = canvas.height = 0));
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};
