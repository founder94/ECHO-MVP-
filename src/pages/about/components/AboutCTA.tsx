import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import MagneticButton from '@/components/base/MagneticButton';

export default function AboutCTA() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const tl = gsap.timeline();
          tl.fromTo(
            section.querySelector('.cta-text'),
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }
          )
            .fromTo(
              section.querySelector('.cta-line'),
              { scaleX: 0 },
              { scaleX: 1, duration: 1, ease: 'power2.inOut' },
              '-=0.6'
            )
            .fromTo(
              section.querySelector('.cta-btn-wrap'),
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
              '-=0.4'
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
      className="relative py-36 md:py-48 bg-[#0a0a0a] overflow-hidden px-6"
    >
      {/* Large background ring */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] md:w-[900px] md:h-[900px] rounded-full border border-white/[0.03]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[600px] md:h-[600px] rounded-full border border-white/[0.02]" />
      </div>

      <div className="max-w-[600px] mx-auto text-center relative z-10">
        <h2
          className="cta-text text-[28px] sm:text-[36px] md:text-[44px] font-normal text-white/90 mb-8 md:mb-12 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-heading, Georgia, serif)', opacity: 0, wordBreak: 'keep-all' }}
        >
          이제, 당신 차례입니다.
        </h2>

        <div
          className="cta-line h-[1px] w-16 md:w-24 bg-white/20 mx-auto mb-10 md:mb-14 origin-center"
          style={{ transform: 'scaleX(0)' }}
        />

        <div className="cta-btn-wrap" style={{ opacity: 0 }}>
          <MagneticButton
            onClick={() => navigate('/auth')}
            variant="primary"
            size="lg"
            className="text-[15px] md:text-[17px]"
          >
            작전 시작
          </MagneticButton>
        </div>

        <p className="mt-8 md:mt-10 text-[11px] md:text-[12px] text-white/25 tracking-[0.15em] uppercase">
          ECHO — Human Relationship OS
        </p>
      </div>
    </section>
  );
}