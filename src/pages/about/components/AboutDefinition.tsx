import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function AboutDefinition() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const tl = gsap.timeline();
          tl.fromTo(
            section.querySelector('.def-label'),
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
          )
            .fromTo(
              section.querySelector('.def-line-left'),
              { scaleX: 0 },
              { scaleX: 1, duration: 1, ease: 'power2.inOut' },
              '-=0.4'
            )
            .fromTo(
              section.querySelector('.def-line-right'),
              { scaleX: 0 },
              { scaleX: 1, duration: 1, ease: 'power2.inOut' },
              '-=0.9'
            )
            .fromTo(
              contentRef.current,
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' },
              '-=0.6'
            );
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 md:py-40 bg-[#080808] overflow-hidden px-6"
    >
      <div className="max-w-[860px] mx-auto text-center relative">
        {/* Label */}
        <p
          className="def-label text-[10px] md:text-[11px] font-mono tracking-[0.4em] uppercase text-white/30 mb-10 md:mb-14"
          style={{ opacity: 0 }}
        >
          ECHO란
        </p>

        {/* Decorative lines */}
        <div className="flex items-center justify-center gap-4 md:gap-6 mb-10 md:mb-14">
          <div
            className="def-line-left h-[1px] w-12 md:w-20 bg-white/15 origin-right"
            style={{ transform: 'scaleX(0)' }}
          />
          <div className="w-[5px] h-[5px] rounded-full border border-white/20" />
          <div
            className="def-line-right h-[1px] w-12 md:w-20 bg-white/15 origin-left"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>

        {/* Definition text */}
        <div ref={contentRef} style={{ opacity: 0 }}>
          <h2
            className="text-[17px] sm:text-[20px] md:text-[24px] font-normal leading-[1.8] md:leading-[1.9] text-white/90 tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
          >
            ECHO는 AI를 통해 당신의 관계를 읽고,
            <br className="hidden md:block" />
            {' '}
            그 속에서 만나는
            {' '}
            <span className="text-white">'진짜 나'</span>
            {' '}
           를 더 깊이 이해하게 하는
            <br className="hidden md:block" />
            {' '}
            Human Relationship OS입니다.
          </h2>
        </div>

        {/* Subtle ring */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full border border-white/[0.03] pointer-events-none"
        />
      </div>
    </section>
  );
}