import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const PASTEL = {
  gold: '#F5D4A1',
  cyan: '#7DD8E4',
  pink: '#F2A2B1',
  lavender: '#C9A0DC',
  mint: '#98D4C8',
  peach: '#F4C8A5',
  sky: '#A8D0F0',
  rose: '#E8B0C0',
  lemon: '#F0E8A0',
};

const twinkles = Array.from({ length: 30 }, (_, i) => ({
  x: `${(i * 37 + 7) % 100}%`,
  y: `${(i * 43 + 13) % 100}%`,
  size: 1.2 + (i % 4) * 0.8,
  color: Object.values(PASTEL)[i % Object.values(PASTEL).length],
  dur: 2 + (i % 5) * 0.5,
  delay: (i * 0.2) % 4,
}));

const rings = [
  { size: 200, top: '-10%', left: '-5%', color: PASTEL.gold, dur: 8, delay: 0 },
  { size: 140, top: '60%', right: '-3%', color: PASTEL.cyan, dur: 7, delay: 1.5 },
  { size: 100, bottom: '-5%', left: '40%', color: PASTEL.pink, dur: 6, delay: 0.8 },
  { size: 80, top: '20%', right: '20%', color: PASTEL.lavender, dur: 5.5, delay: 2 },
];

export default function ThankYouPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 60, scale: 0.92 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'power4.out' }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      window.location.href = '/';
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-[#050505]"
      style={{ perspective: '1400px' }}
    >
      {/* Floating Rings */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
        {rings.map((r, i) => (
          <div
            key={`ty-ring-${i}`}
            className="rounded-full border"
            style={{
              position: 'absolute',
              top: r.top,
              left: r.left,
              right: r.right,
              bottom: r.bottom,
              width: r.size,
              height: r.size,
              borderColor: r.color,
              borderWidth: '1.5px',
              opacity: 0.12,
              boxShadow: `0 0 ${r.size / 3}px ${r.color}15`,
              animation: `ds-float-spin ${r.dur}s ${r.delay}s infinite linear`,
              transform: `translateZ(-${200 + i * 50}px)`,
              transformStyle: 'preserve-3d',
            }}
          />
        ))}
      </div>

      {/* Twinkles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {twinkles.map((t, i) => (
          <div
            key={`ty-tw-${i}`}
            className="rounded-full"
            style={{
              position: 'absolute',
              left: t.x,
              top: t.y,
              width: t.size,
              height: t.size,
              background: t.color,
              opacity: 0.25,
              animation: `ds-particle-drift ${t.dur}s ${t.delay}s infinite ease-in-out, ds-twinkle ${t.dur * 0.7}s ${t.delay * 0.7}s infinite ease-in-out`,
              boxShadow: `0 0 ${t.size * 5}px ${t.color}35`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>

      {/* Background Gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 40%, ${PASTEL.gold}06 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 30% 60%, ${PASTEL.cyan}06 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 70% 60%, ${PASTEL.pink}06 0%, transparent 50%)
          `,
        }}
      />

      {/* Content */}
      <div ref={contentRef} className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* Icon */}
        <div className="mb-8">
          <div
            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${PASTEL.gold}20, ${PASTEL.cyan}15, ${PASTEL.pink}20)`,
              boxShadow: `0 0 80px ${PASTEL.gold}20, 0 0 120px ${PASTEL.cyan}15`,
            }}
          >
            <i
              className="ri-check-line text-5xl"
              style={{
                background: `linear-gradient(135deg, ${PASTEL.gold}, ${PASTEL.cyan})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            />
          </div>
        </div>

        {/* Title */}
        <h1
          className="font-display font-bold tracking-tighter leading-[1.1] mb-5 text-white"
          style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontFamily: 'var(--font-heading, sans-serif)' }}
        >
          신청이 완료되었습니다
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg leading-relaxed text-white/35 mb-3">
          ECHO에 관심을 가져주셔서 감사합니다
        </p>
        <p className="text-sm text-white/20 mb-10">
          입력하신 연락처로 24시간 이내에 맞춤형 안내를 드리겠습니다
        </p>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="w-10 h-[1px] bg-white/10" />
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <div className="w-10 h-[1px] bg-white/10" />
        </div>

        {/* Back to Home */}
        <a
          href="/"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer text-white/50 border border-white/10 hover:text-white/80 hover:border-white/20 hover:scale-105"
        >
          <i className="ri-arrow-left-line" />
          홈으로 돌아가기
        </a>

        {/* Timer */}
        <p className="mt-6 text-xs font-mono text-white/12">
          {secondsLeft}초 후 자동으로 홈으로 이동합니다
        </p>
      </div>
    </div>
  );
}