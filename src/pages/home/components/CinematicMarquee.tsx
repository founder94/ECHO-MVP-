import { useRef, useEffect, useState, useCallback } from 'react';

interface CinematicMarqueeProps {
  texts: string[];
  isDarkMode: boolean;
  direction?: 'forward' | 'reverse';
  variant?: 'default' | 'accent';
  speed?: number; // seconds for one full cycle
}

/**
 * Cinematic 3D marquee with light sweep, speed particles, and depth.
 * Uses CSS transforms + requestAnimationFrame for performant animation.
 */
export default function CinematicMarquee({
  texts,
  isDarkMode,
  direction = 'forward',
  variant = 'default',
  speed = 16,
}: CinematicMarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const speedRef = useRef(speed);
  const animFrameRef = useRef<number>(0);

  // Duplicate texts for seamless loop
  const doubledTexts = [...texts, ...texts];

  const separator = variant === 'accent' ? '●' : '◆';
  const bgColor = variant === 'accent' ? 'bg-[#060606]' : 'bg-[#080808]';
  const textOpacity = variant === 'accent' ? 'text-white/15' : 'text-white/20';
  const sepOpacity = variant === 'accent' ? 'text-white/08' : 'text-white/10';

  // RAF-based smooth animation
  const animate = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const currentSpeed = speedRef.current;
    const progress = (performance.now() % (currentSpeed * 1000)) / (currentSpeed * 1000);
    const trackWidth = track.scrollWidth / 2; // half because we duplicated

    if (direction === 'forward') {
      track.style.transform = `translateX(${-progress * trackWidth}px)`;
    } else {
      track.style.transform = `translateX(${-(1 - progress) * trackWidth}px)`;
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [direction]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  // Speed up on hover (keeping base speed multiple for smooth transition)
  useEffect(() => {
    speedRef.current = isHovered ? speed * 0.5 : speed;
  }, [isHovered, speed]);

  return (
    <section
      ref={containerRef}
      className={`relative w-full py-10 md:py-16 overflow-hidden ${bgColor} border-y ${
        isDarkMode ? 'border-white/[0.04]' : 'border-black/[0.04]'
      } z-[15]`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ perspective: '800px' }}
    >
      {/* Light sweep overlay */}
      <div
        className="absolute inset-y-0 pointer-events-none z-10"
        style={{
          width: '120px',
          background: `linear-gradient(90deg, transparent, ${isDarkMode ? 'rgba(212,212,212,0.04)' : 'rgba(61,61,61,0.04)'}, transparent)`,
          animation: `marquee-sweep ${speed * 0.7}s linear infinite`,
          opacity: isHovered ? 1 : 0.4,
          transition: 'opacity 0.6s ease',
        }}
      />

      {/* Edge fade vignettes */}
      <div
        className="absolute inset-y-0 left-0 w-16 md:w-24 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${isDarkMode ? '#080808' : '#f3f3f3'}, transparent)`,
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-16 md:w-24 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(270deg, ${isDarkMode ? '#080808' : '#f3f3f3'}, transparent)`,
        }}
      />

      {/* 3D perspective wrapper */}
      <div
        className="relative overflow-hidden"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${isHovered ? 2 : 0}deg)`,
          transition: 'transform 0.6s ease',
        }}
      >
        <div
          ref={trackRef}
          className="flex gap-10 md:gap-16 whitespace-nowrap"
          style={{
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {doubledTexts.map((text, i) => (
            <span
              key={i}
              className={`text-[13px] md:text-base font-mono tracking-[0.3em] uppercase flex items-center gap-10 md:gap-16 transition-all duration-300 ${textOpacity} ${
                isHovered ? 'opacity-100' : ''
              }`}
              style={{
                transform: `translateZ(${isHovered ? 10 : 0}px)`,
                transition: 'transform 0.6s ease, opacity 0.3s',
                textShadow: isHovered && isDarkMode
                  ? '0 0 20px rgba(212,212,212,0.15)'
                  : 'none',
              }}
            >
              {text}
              <span className={`text-[6px] ${sepOpacity} transition-all duration-300 ${isHovered ? 'scale-150' : ''}`}>
                {separator}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Speed particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={`mp-${i}`}
            className="absolute rounded-full"
            style={{
              top: `${10 + Math.random() * 80}%`,
              left: 0,
              width: `${1 + Math.random() * 1.5}px`,
              height: `${1 + Math.random() * 1.5}px`,
              background: isDarkMode ? '#D4D4D4' : '#3D3D3D',
              opacity: 0,
              animation: `marquee-particle ${4 + Math.random() * 5}s ${Math.random() * 4}s infinite linear`,
            }}
          />
        ))}
      </div>
    </section>
  );
}