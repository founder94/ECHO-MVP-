import { useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';

interface FloatingAuthPillProps {
  isDarkMode: boolean;
  onActivate: () => void;
}

const ORBIT_RINGS = 3;
const ORBIT_PARTICLES = 12;

const FloatingAuthPill = ({ isDarkMode, onActivate }: FloatingAuthPillProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const ringsRef = useRef<(HTMLDivElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const breatheRef = useRef<gsap.core.Tween | null>(null);
  const orbitRefs = useRef<gsap.core.Tween[]>([]);
  const enterTlRef = useRef<gsap.core.Timeline | null>(null);

  // Show after scrolling past hero
  useEffect(() => {
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.35);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Entrance animation
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      enterTlRef.current = gsap.fromTo(containerRef.current,
        { opacity: 0, y: 30, scale: 0.85 },
        { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.6)', delay: 0.4 },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Breathing glow animation
  useEffect(() => {
    if (!glowRef.current) return;
    breatheRef.current = gsap.to(glowRef.current, {
      opacity: 0.35,
      scale: 1.25,
      duration: 2.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    return () => { breatheRef.current?.kill(); };
  }, []);

  // Hover: ring orbits
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (!containerRef.current) return;

    // Kill breathing during hover
    breatheRef.current?.pause();

    // Glow intensifies
    if (glowRef.current) {
      gsap.to(glowRef.current, { opacity: 0.65, scale: 2.8, duration: 0.5, ease: 'power2.out' });
    }

    // Label reveals
    if (labelRef.current) {
      gsap.to(labelRef.current, {
        opacity: 1,
        x: 0,
        duration: 0.5,
        ease: 'power3.out',
        delay: 0.1,
      });
    }

    // Pill expands slightly
    if (pillRef.current) {
      gsap.to(pillRef.current, {
        scale: 1.06,
        duration: 0.4,
        ease: 'power2.out',
      });
    }

    // Orbit rings appear
    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;
      gsap.set(ring, { opacity: 0, scale: 0.4, rotate: 0 });
      orbitRefs.current[i] = gsap.to(ring, {
        opacity: 0.3 - i * 0.08,
        scale: 1 + i * 0.35,
        rotate: 360,
        duration: 3 + i * 0.8,
        repeat: -1,
        ease: 'linear',
        delay: i * 0.08,
      });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);

    // Resume breathing
    breatheRef.current?.play();
    if (glowRef.current) {
      gsap.to(glowRef.current, { opacity: 0.35, scale: 1.25, duration: 0.8, ease: 'power3.out' });
    }

    // Label hides
    if (labelRef.current) {
      gsap.to(labelRef.current, { opacity: 0, x: -8, duration: 0.3, ease: 'power2.in' });
    }

    // Pill normalizes
    if (pillRef.current) {
      gsap.to(pillRef.current, { scale: 1, duration: 0.4, ease: 'power2.out' });
    }

    // Remove orbit rings
    orbitRefs.current.forEach((t) => t?.kill());
    ringsRef.current.forEach((ring) => {
      if (ring) gsap.to(ring, { opacity: 0, scale: 0.3, duration: 0.4, ease: 'power2.in' });
    });
  }, []);

  const handleClick = useCallback(() => {
    if (isPressed) return;
    setIsPressed(true);

    if (pillRef.current) {
      gsap.to(pillRef.current, {
        scale: 0.92,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      });
    }

    // Quick pulse out
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 1,
        scale: 5,
        duration: 0.3,
        ease: 'power3.out',
        onComplete: () => {
          onActivate();
          setTimeout(() => setIsPressed(false), 500);
        },
      });
    } else {
      onActivate();
      setTimeout(() => setIsPressed(false), 500);
    }
  }, [isPressed, onActivate]);

  return (
    <div
      ref={containerRef}
      className="fixed z-40 flex items-center"
      style={{
        bottom: 'clamp(20px, 4vh, 36px)',
        right: 'clamp(16px, 3vw, 28px)',
        opacity: scrolledPastHero ? (isDarkMode ? 1 : 0.85) : 0.35,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Orbit rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {Array.from({ length: ORBIT_RINGS }, (_, i) => (
          <div
            key={`orbit-${i}`}
            ref={(el) => { ringsRef.current[i] = el; }}
            className="absolute rounded-full border"
            style={{
              width: '18px',
              height: '18px',
              borderColor: isDarkMode ? 'rgba(212,212,212,0.2)' : 'rgba(61,61,61,0.2)',
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Ambient particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {Array.from({ length: ORBIT_PARTICLES }, (_, i) => (
          <div
            key={`op-${i}`}
            className="absolute rounded-full"
            style={{
              width: '2px',
              height: '2px',
              background: isDarkMode ? '#D4D4D4' : '#3D3D3D',
              opacity: isHovered ? 0.35 : 0.08,
              animation: `float-auth-particle ${2.5 + (i % 4) * 0.8}s ${i * 0.25}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      {/* Glow aura */}
      <div
        ref={glowRef}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '40px',
          height: '40px',
          top: '50%',
          left: '50%',
          marginLeft: '-20px',
          marginTop: '-20px',
          background: isDarkMode
            ? 'radial-gradient(circle, rgba(212,212,212,0.25) 0%, rgba(212,212,212,0.06) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(61,61,61,0.18) 0%, rgba(61,61,61,0.04) 40%, transparent 70%)',
          opacity: 0.35,
          transform: 'scale(1.25)',
        }}
      />

      {/* Main pill button */}
      <button
        ref={pillRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`relative flex items-center gap-2 rounded-full cursor-pointer whitespace-nowrap transition-colors duration-500 ${
          isDarkMode
            ? 'bg-[#0a0a0a]/90 border-white/15 hover:border-white/30'
            : 'bg-white/90 border-black/10 hover:border-black/25'
        }`}
        style={{
          padding: '7px 16px 7px 7px',
          border: '1px solid',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        aria-label="ECHO 시작하기"
      >
        {/* Inner pulse dot */}
        <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #FF6B9D, #9B59B6)',
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 60%)',
            }}
          />
          <i className="ri-arrow-right-line text-white text-sm relative z-10" />
          {/* Inner pulse ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1.5px solid rgba(255,255,255,0.3)',
              animation: 'auth-pill-pulse 2s ease-out infinite',
            }}
          />
        </div>

        {/* Label - hidden until hover */}
        <span
          ref={labelRef}
          className={`text-xs font-medium tracking-[0.08em] ${
            isDarkMode ? 'text-white/70' : 'text-black/60'
          }`}
          style={{ opacity: 0, transform: 'translateX(-4px)' }}
        >
          시작하기
        </span>
      </button>

      <style>{`
        @keyframes auth-pill-pulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes float-auth-particle {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.08;
          }
          25% {
            transform: translate(4px, -6px) scale(1.4);
            opacity: 0.4;
          }
          50% {
            transform: translate(-2px, -12px) scale(0.8);
            opacity: 0.12;
          }
          75% {
            transform: translate(-6px, -4px) scale(1.2);
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingAuthPill;