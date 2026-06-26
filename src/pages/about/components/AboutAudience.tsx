import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function AboutAudience() {
  const sectionRef = useRef<HTMLDivElement>(null);
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
            section.querySelector('.aud-label'),
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
          )
            .fromTo(
              section.querySelector('.aud-title'),
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
              '-=0.4'
            )
            .fromTo(
              section.querySelector('.aud-body'),
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
              '-=0.6'
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
      className="relative py-32 md:py-40 bg-[#050505] overflow-hidden px-6"
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[30%] right-[15%] w-[200px] h-[200px] rounded-full border border-white/[0.03]" />
        <div className="absolute bottom-[25%] left-[10%] w-[150px] h-[150px] rounded-full border border-white/[0.02]" />
      </div>

      <div className="max-w-[680px] mx-auto text-center relative z-10">
        <p
          className="aud-label text-[10px] md:text-[11px] font-mono tracking-[0.4em] uppercase text-white/30 mb-10 md:mb-14"
          style={{ opacity: 0 }}
        >
          누구를 위한 것인가
        </p>

        <h2
          className="aud-title text-[20px] sm:text-[24px] md:text-[30px] font-normal leading-[1.7] md:leading-[1.8] text-white/90 mb-10 md:mb-14 tracking-[-0.01em]"
          style={{ fontFamily: 'var(--font-heading, Georgia, serif)', opacity: 0, wordBreak: 'keep-all' }}
        >
          상처받은 사람도,
          <br />
          평범하게 잘 지내는 사람도,
          <br />
          그저 나를 더 알고 싶은 사람도.
        </h2>

        <p
          className="aud-body text-[14px] md:text-[16px] leading-[1.9] md:leading-[2] text-white/50"
          style={{ opacity: 0, wordBreak: 'keep-all' }}
        >
          관계의 모양과 상관없이,
          <br />
          <span className="text-white/75">'나를 다시 만나고 싶은'</span>
          {' '}
          모든 사람을 위한 곳입니다.
        </p>
      </div>
    </section>
  );
}