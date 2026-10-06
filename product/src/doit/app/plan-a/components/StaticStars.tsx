import { useMemo } from "react";

interface Star {
  top: number;
  left: number;
  size: number;
  opacity: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const TOTAL = 90;

/**
 * Minimal static starfield — faint white dots only.
 * No twinkle animation, no shooting stars, no nebula.
 * Matches the subtle background dots in the reference screenshot.
 */
export function StaticStars() {
  const stars = useMemo<Star[]>(() => {
    const rand = seededRandom(7);
    const list: Star[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const r = rand();
      const size = r > 0.92 ? 1.6 : r > 0.7 ? 1.1 : 0.7;
      list.push({
        top: Math.round(rand() * 1000) / 10,
        left: Math.round(rand() * 1000) / 10,
        size,
        opacity: 0.15 + rand() * 0.5,
      });
    }
    return list;
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            backgroundColor: "#ffffff",
          }}
        />
      ))}
    </div>
  );
}