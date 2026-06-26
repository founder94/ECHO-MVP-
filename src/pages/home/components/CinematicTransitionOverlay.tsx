import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

interface CinematicTransitionOverlayProps {
  isActive: boolean;
  onTransitionComplete: () => void;
}

const RING_COUNT = 6;
const PARTICLE_COUNT = 80;

function createParticleDOM(count: number): HTMLElement[] {
  const particles: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'transition-particle';
    const size = Math.random() * 3 + 1;
    el.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: #D4D4D4;
      opacity: 0;
      top: 50%;
      left: 50%;
      pointer-events: none;
    `;
    particles.push(el);
  }
  return particles;
}

const CinematicTransitionOverlay = ({ isActive, onTransitionComplete }: CinematicTransitionOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement[]>([]);
  const particlesRef = useRef<HTMLElement[]>([]);
  const wormholeRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const hasTriggeredRef = useRef(false);

  const runTransition = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => onTransitionComplete(), 150);
        },
      });
      tlRef.current = tl;

      // Phase 1: Vignette closes in (0-0.35s)
      if (vignetteRef.current) {
        tl.fromTo(vignetteRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.25, ease: 'power3.in' },
          0,
        );
      }

      // Phase 2: Wormhole rings collapse inward (0.1-0.5s)
      ringsRef.current.forEach((ring, i) => {
        if (!ring) return;
        const scale = 2.5 + i * 0.6;
        tl.fromTo(ring,
          {
            scale,
            opacity: 0.7,
            borderWidth: '1px',
          },
          {
            scale: 0.05,
            opacity: 0,
            borderWidth: '7px',
            duration: 0.55,
            ease: 'power3.in',
          },
          0.08 + i * 0.04,
        );
      });

      // Phase 3: Particles stream to center (0.12-0.55s)
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      particlesRef.current.forEach((particle, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 600;
        const startX = cx + Math.cos(angle) * dist;
        const startY = cy + Math.sin(angle) * dist;

        gsap.set(particle, { x: startX - cx, y: startY - cy, opacity: 0 });
        tl.to(particle, {
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20,
          opacity: 0.7,
          duration: 0.15,
          ease: 'power2.out',
        }, 0.12 + i * 0.002);
        tl.to(particle, {
          x: 0,
          y: 0,
          opacity: 0,
          scale: 0,
          duration: 0.35,
          ease: 'power3.in',
        }, 0.22 + i * 0.003);
      });

      // Phase 4: Brief white flash (0.45-0.55s)
      if (flashRef.current) {
        tl.fromTo(flashRef.current,
          { opacity: 0 },
          { opacity: 0.9, duration: 0.08, ease: 'power2.out' },
          0.45,
        );
        tl.to(flashRef.current,
          { opacity: 0, duration: 0.15, ease: 'power2.in' },
          0.5,
        );
      }

      // Phase 5: Wormhole spin effect (0.3-0.6s)
      if (wormholeRef.current) {
        tl.fromTo(wormholeRef.current,
          { opacity: 0, rotate: 0, scale: 0.3 },
          { opacity: 0.25, rotate: 180, scale: 1.2, duration: 0.4, ease: 'power2.inOut' },
          0.2,
        );
        tl.to(wormholeRef.current,
          { opacity: 0, scale: 0, duration: 0.3, ease: 'power3.in' },
          0.5,
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [onTransitionComplete]);

  useEffect(() => {
    if (isActive) {
      hasTriggeredRef.current = false;
      setTimeout(runTransition, 50);
    }

    return () => {
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
    };
  }, [isActive, runTransition]);

  // Initialize particles
  useEffect(() => {
    if (!containerRef.current) return;
    const particles = createParticleDOM(PARTICLE_COUNT);
    particles.forEach((p) => containerRef.current!.appendChild(p));
    particlesRef.current = particles;

    return () => {
      particles.forEach((p) => p.remove());
      particlesRef.current = [];
    };
  }, []);

  const setRingRef = (i: number) => (el: HTMLDivElement | null) => {
    ringsRef.current[i] = el!;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ opacity: isActive ? 1 : 0, visibility: isActive ? 'visible' : 'hidden' }}
    >
      {/* Dark vignette overlay */}
      <div
        ref={vignetteRef}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.85) 60%, #000 100%)',
          opacity: 0,
        }}
      />

      {/* Wormhole concentric rings */}
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <div
          key={`ring-${i}`}
          ref={setRingRef(i)}
          className="absolute rounded-full border-white/30"
          style={{
            top: '50%',
            left: '50%',
            width: '200px',
            height: '200px',
            marginLeft: '-100px',
            marginTop: '-100px',
            borderColor: `rgba(212,212,212,${0.15 + i * 0.04})`,
            opacity: 0,
            transform: 'scale(3)',
          }}
        />
      ))}

      {/* Wormhole spin gradient */}
      <div
        ref={wormholeRef}
        className="absolute rounded-full"
        style={{
          top: '50%',
          left: '50%',
          width: '300px',
          height: '300px',
          marginLeft: '-150px',
          marginTop: '-150px',
          background: 'conic-gradient(from 0deg, transparent, rgba(212,212,212,0.08), transparent, rgba(212,212,212,0.05), transparent, rgba(212,212,212,0.08), transparent)',
          opacity: 0,
        }}
      />

      {/* White flash */}
      <div
        ref={flashRef}
        className="absolute inset-0 bg-white"
        style={{ opacity: 0 }}
      />
    </div>
  );
};

export default CinematicTransitionOverlay;