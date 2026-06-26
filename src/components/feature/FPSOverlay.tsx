import { useEffect, useRef, useState } from 'react';

interface FPSOverlayProps {
  isActive: boolean;
  onComplete: () => void;
}

const CROSSHAIR_LINES = 4;
const VACUUM_PARTICLE_COUNT = 120;

interface Particle {
  id: number;
  startX: number;
  startY: number;
  size: number;
  delay: number;
  angle: number;
  speed: number;
  opacity: number;
}

const generateParticles = (): Particle[] => {
  return Array.from({ length: VACUUM_PARTICLE_COUNT }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.8 + Math.random() * 0.25;
    return {
      id: i,
      startX: 50 + Math.cos(angle) * dist * 70,
      startY: 50 + Math.sin(angle) * dist * 70,
      size: 1 + Math.random() * 5,
      delay: Math.random() * 0.2,
      angle,
      speed: 0.3 + Math.random() * 1.0,
      opacity: 0.3 + Math.random() * 0.7,
    };
  });
};

export default function FPSOverlay({ isActive, onComplete }: FPSOverlayProps) {
  const [phase, setPhase] = useState<'idle' | 'crosshair' | 'tunnel' | 'suction' | 'flash' | 'complete'>('idle');
  const [particles] = useState<Particle[]>(generateParticles);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    const t1 = setTimeout(() => setPhase('crosshair'), 30);
    const t2 = setTimeout(() => setPhase('tunnel'), 200);
    const t3 = setTimeout(() => setPhase('suction'), 350);
    const t4 = setTimeout(() => setPhase('flash'), 650);
    const t5 = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [isActive, onComplete]);

  if (phase === 'idle') return null;

  const isActivePhase = phase !== 'complete';

  return (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ perspective: '1200px' }}
    >
      <div
        className={`absolute inset-0 bg-[#050505] transition-opacity duration-300 ${
          isActivePhase ? 'opacity-0' : 'opacity-0'
        }`}
      />

      <div
        className={`absolute inset-0 transition-all duration-500 ${
          phase === 'tunnel' || phase === 'suction' || phase === 'flash'
            ? 'opacity-100'
            : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(5,5,5,0.75) 50%, rgba(5,5,5,0.95) 80%, #050505 100%)',
        }}
      />

      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-400 ${
          phase === 'crosshair' || phase === 'tunnel' || phase === 'suction'
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-[0.2]'
        }`}
        style={{ width: 120, height: 120 }}
      >
        <div
          className="absolute inset-0 rounded-full border border-[#D4D4D4]/40"
          style={{
            animation: phase === 'crosshair' ? 'crosshair-pulse 0.6s ease-out forwards' : 'none',
          }}
        />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#D4D4D4]/60 -translate-y-1/2" />
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#D4D4D4]/60 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-[3px] h-[3px] bg-[#D4D4D4] rounded-full -translate-x-1/2 -translate-y-1/2" />
        {[
          { top: 0, left: 0, rot: 0 },
          { top: 0, right: 0, rot: 90 },
          { bottom: 0, right: 0, rot: 180 },
          { bottom: 0, left: 0, rot: 270 },
        ].map((b, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: b.top ?? 'auto',
              left: b.left ?? 'auto',
              right: b.right ?? 'auto',
              bottom: b.bottom ?? 'auto',
              width: 16,
              height: 16,
              transform: `rotate(${b.rot}deg)`,
            }}
          >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-[#D4D4D4]/50" />
            <div className="absolute top-0 left-0 w-[1px] h-full bg-[#D4D4D4]/50" />
          </div>
        ))}
      </div>

      {phase === 'tunnel' || phase === 'suction' || phase === 'flash' ? (
        <div className="absolute inset-0">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={`tunnel-${i}`}
              className="absolute top-1/2 left-1/2 rounded-full border border-[#D4D4D4]/20 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: `${40 + i * 70}px`,
                height: `${40 + i * 70}px`,
                transform: `translate(-50%, -50%) scale(${phase === 'suction' ? 1 + i * 0.3 : 0.3 + i * 0.15})`,
                opacity: phase === 'suction' ? 0.15 - i * 0.015 : 0.3 - i * 0.03,
                transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                animation: phase === 'suction' ? `tunnel-ripple ${0.8 + i * 0.1}s ease-out forwards` : 'none',
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="absolute inset-0 overflow-hidden">
        {particles.map((p) => {
          const isSuction = phase === 'suction' || phase === 'flash';
          return (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.startX}%`,
                top: `${p.startY}%`,
                width: isSuction ? p.size * 2.5 : p.size,
                height: isSuction ? p.size * 2.5 : p.size,
                background: isSuction ? '#D4D4D4' : 'rgba(212,212,212,0.3)',
                opacity: isSuction ? 0 : p.opacity * 0.08,
                transform: isSuction
                  ? 'translate(-50%, -50%) scale(0.3)'
                  : 'translate(0, 0) scale(1)',
                transition: `all ${p.speed * 0.6}s cubic-bezier(0.05, 0.9, 0.2, 1) ${p.delay}s`,
                boxShadow: isSuction ? `0 0 ${p.size * 3}px rgba(212,212,212,0.4)` : 'none',
              }}
            />
          );
        })}
      </div>

      {(phase === 'suction' || phase === 'flash') && (
        <div className="absolute inset-0">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={`suction-ring-${i}`}
              className="absolute top-1/2 left-1/2 rounded-full border border-[#D4D4D4]/30 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: `${80 + i * 60}px`,
                height: `${80 + i * 60}px`,
                animation: `suction-collapse ${0.5 + i * 0.05}s cubic-bezier(0.05, 0.9, 0.2, 1) forwards`,
                animationDelay: `${i * 0.02}s`,
              }}
            />
          ))}
        </div>
      )}

      {phase === 'suction' || phase === 'flash' ? (
        <div className="absolute inset-0">
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 360;
            return (
              <div
                key={`streak-${i}`}
                className="absolute top-1/2 left-1/2 origin-left"
                style={{
                  width: '50vw',
                  height: '1px',
                  transform: `rotate(${angle}deg) translateY(-50%)`,
                  background: `linear-gradient(90deg, rgba(212,212,212,0.25) 0%, rgba(212,212,212,0.05) 50%, transparent 100%)`,
                  opacity: phase === 'flash' ? 0.6 : 0.3,
                  animation: `streak-draw ${0.4 + i * 0.02}s ease-out forwards`,
                }}
              />
            );
          })}
        </div>
      ) : null}

      {phase === 'flash' ? (
        <div
          className="absolute inset-0 bg-white"
          style={{
            opacity: 0,
            animation: 'flash-burst 0.3s ease-out forwards',
          }}
        />
      ) : null}

      {(phase === 'crosshair' || phase === 'tunnel' || phase === 'suction') && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#D4D4D4]/15 animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D4D4D4]/15 animate-pulse" />
          <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-[#D4D4D4]/10" />
          <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-[#D4D4D4]/10" />
        </>
      )}
    </div>
  );
}