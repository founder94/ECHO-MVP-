import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const LINES = [
  '우리는 매일 누군가와 연결되지만,',
  "정작 '나'와는 점점 멀어집니다.",
  '맞춰주고, 견디고, 양보하는 사이에',
  '진짜 내가 어떤 사람이었는지 흐려지죠.',
];

export default function AboutIntro() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          gsap.fromTo(
            lineRefs.current.filter(Boolean),
            { opacity: 0, y: 40, filter: 'blur(6px)' },
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 1.4,
              stagger: 0.75,
              ease: 'power3.out',
            }
          );
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center bg-[#0a0a0a] overflow-hidden px-6"
    >
      {/* Subtle ring decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full border border-white/[0.04]"
          style={{
            width: 600,
            height: 600,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute rounded-full border border-white/[0.03]"
          style={{
            width: 800,
            height: 800,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute rounded-full border border-white/[0.02]"
          style={{
            width: 1000,
            height: 1000,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-[720px] text-center">
        {LINES.map((line, i) => (
          <p
            key={i}
            ref={(el) => { lineRefs.current[i] = el; }}
            className="text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[2] tracking-[-0.01em] text-white/80 mb-2 md:mb-3"
            style={{
              fontFamily: 'var(--font-heading, Georgia, serif)',
              opacity: 0,
              wordBreak: 'keep-all',
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none" />
    </section>
  );
}