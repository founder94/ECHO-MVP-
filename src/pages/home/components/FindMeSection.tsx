import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface FindMeSectionProps {
  isDarkMode: boolean;
}

gsap.registerPlugin(ScrollTrigger);

const floatingObjects = [
  { type: 'ring', size: 240, top: '5%', left: '3%', dur: 22, delay: 0, z: -280, parallax: 0.15 },
  { type: 'ring', size: 160, top: '65%', right: '4%', dur: 19, delay: 2.3, z: -200, parallax: 0.12 },
  { type: 'ring', size: 100, top: '18%', right: '10%', dur: 17, delay: 1.1, z: -240, parallax: 0.1 },
  { type: 'square', size: 70, top: '75%', left: '8%', dur: 21, delay: 3.1, z: -160, parallax: 0.08 },
  { type: 'square', size: 90, top: '12%', left: '45%', dur: 18, delay: 0.7, z: -220, parallax: 0.14 },
  { type: 'ring', size: 130, top: '48%', left: '82%', dur: 23, delay: 1.8, z: -190, parallax: 0.11 },
  { type: 'square', size: 55, top: '82%', right: '22%', dur: 20, delay: 2.7, z: -150, parallax: 0.07 },
  { type: 'ring', size: 80, top: '35%', left: '12%', dur: 16, delay: 0.4, z: -260, parallax: 0.13 },
  { type: 'square', size: 110, top: '55%', right: '8%', dur: 19, delay: 1.5, z: -180, parallax: 0.09 },
  { type: 'ring', size: 60, top: '8%', right: '30%', dur: 24, delay: 3.8, z: -210, parallax: 0.16 },
];

const particles = Array.from({ length: 50 }, (_, i) => ({
  x: `${(i * 29 + 5) % 100}%`,
  y: `${(i * 23 + 11) % 100}%`,
  size: 0.8 + (i % 6) * 0.5,
  dur: 14 + (i % 18),
  delay: (i * 0.3) % 6,
  opacity: 0.012 + (i % 7) * 0.007,
  parallax: 0.03 + (i % 5) * 0.02,
}));

const bodyLines = [
  '누군가와의 관계에 지친 사람도,',
  '겉으로는 아무 문제 없어 보이는 사람도.',
  '',
  '관계가 멀쩡해도 우리는 조금씩 나를 잃어요.',
  '맞춰주고, 챙겨주고, 양보하는 사이에',
  '"나는 어떤 사람이었지?"를 놓치곤 하죠.',
  '',
  '그래서 이건, 나를 다시 찾고 싶은',
  '모든 사람을 위한 거예요.',
];

export default function FindMeSection({ isDarkMode }: FindMeSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  const bodyLineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const bottomLineRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const floatingRefs = useRef<(HTMLDivElement | null)[]>([]);
  const particleRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (gsap.getProperty(section, 'scrollTrigger') !== undefined) {
      ScrollTrigger.getAll().forEach(st => { if (st.trigger === section) st.kill(); });
    }

    const ctx = gsap.context(() => {
      // Background text
      if (bgTextRef.current) {
        gsap.fromTo(bgTextRef.current,
          { y: 160, opacity: 0, scale: 0.82 },
          {
            y: 0, opacity: 1, scale: 1,
            duration: 2.4, ease: 'power3.out',
            scrollTrigger: { trigger: bgTextRef.current, start: 'top 88%', toggleActions: 'play none none none' },
          },
        );
      }
      // Label
      if (labelRef.current) {
        gsap.fromTo(labelRef.current,
          { y: 50, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 1.1, ease: 'power4.out', delay: 0.15,
            scrollTrigger: { trigger: labelRef.current, start: 'top 85%', toggleActions: 'play none none none' },
          },
        );
      }
      // Heading
      if (headingRef.current) {
        gsap.fromTo(headingRef.current,
          { y: 100, opacity: 0, scale: 0.92, filter: 'blur(12px)' },
          {
            y: 0, opacity: 1, scale: 1, filter: 'blur(0px)',
            duration: 1.5, ease: 'power4.out', delay: 0.25,
            scrollTrigger: { trigger: headingRef.current, start: 'top 82%', toggleActions: 'play none none none' },
          },
        );
      }
      // Sub
      if (subRef.current) {
        gsap.fromTo(subRef.current,
          { y: 60, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 1.2, ease: 'power3.out', delay: 0.4,
            scrollTrigger: { trigger: subRef.current, start: 'top 86%', toggleActions: 'play none none none' },
          },
        );
      }
      // Body lines
      if (bodyContainerRef.current) {
        const validRefs = bodyLineRefs.current.filter(Boolean) as HTMLParagraphElement[];
        if (validRefs.length > 0) {
          gsap.fromTo(validRefs,
            { y: 45, opacity: 0 },
            {
              y: 0, opacity: 1,
              duration: 0.9, stagger: 0.14, ease: 'power3.out', delay: 0.6,
              scrollTrigger: { trigger: bodyContainerRef.current, start: 'top 88%', toggleActions: 'play none none none' },
            },
          );
        }
      }
      // Bottom line
      if (bottomLineRef.current) {
        gsap.fromTo(bottomLineRef.current,
          { scaleX: 0, opacity: 0 },
          {
            scaleX: 1, opacity: 1,
            duration: 1.8, ease: 'power4.inOut', delay: 1.1,
            scrollTrigger: { trigger: bottomLineRef.current, start: 'top 92%', toggleActions: 'play none none none' },
          },
        );
      }
    }, section);

    // Scroll-driven parallax for floating objects
    const handleScroll = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      const viewportHeight = window.innerHeight;
      const scrollProgress = Math.max(0, Math.min(1,
        (viewportHeight - rect.top) / (viewportHeight + sectionHeight)
      ));

      floatingRefs.current.forEach((el, i) => {
        if (!el || i >= floatingObjects.length) return;
        const p = floatingObjects[i].parallax;
        const offset = (scrollProgress - 0.5) * p * 120;
        el.style.transform = `translateY(${offset}px) translateZ(${floatingObjects[i].z}px)`;
      });

      particleRefs.current.forEach((el, i) => {
        if (!el || i >= particles.length) return;
        const p = particles[i].parallax;
        const offset = (scrollProgress - 0.5) * p * 80;
        el.style.transform = `translateY(${offset}px)`;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      ctx.revert();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isDarkMode]);

  const bgColor = '#050505';
  const accent = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.03 : 0.02;

  return (
    <section
      id="find-me"
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ background: bgColor, perspective: '1400px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoveredLine(null); }}
    >
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Cursor-following ambient glow */}
      <div
        ref={glowRef}
        className="absolute pointer-events-none z-[1]"
        style={{
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          top: `${mousePos.y * 100}%`,
          left: `${mousePos.x * 100}%`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(212,212,212,0.04) 0%, rgba(212,212,212,0.015) 35%, transparent 70%)',
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      />

      {/* Floating Shapes with parallax */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
        {floatingObjects.map((obj, i) => (
          <div
            key={`fm-obj-${i}`}
            ref={(el) => { floatingRefs.current[i] = el; }}
            className={`${obj.type === 'ring' ? 'rounded-full' : 'rounded-sm rotate-45'}`}
            style={{
              position: 'absolute',
              top: obj.top,
              left: obj.left,
              right: obj.right,
              width: obj.size,
              height: obj.size,
              borderColor: 'rgba(212,212,212,0.05)',
              borderWidth: '1.5px',
              animation: `float-3d-${1 + (i % 3)} ${obj.dur}s ${obj.delay}s infinite ease-in-out`,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.3s ease-out',
            }}
          />
        ))}
      </div>

      {/* Subtle Particles with parallax */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={`fm-pt-${i}`}
            ref={(el) => { particleRefs.current[i] = el; }}
            className="rounded-full transition-transform duration-300 ease-out"
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              background: '#D4D4D4',
              opacity: p.opacity,
              animation: `float-${1 + (i % 3)} ${p.dur}s ${p.delay}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      {/* Background Gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 25% 30%, rgba(212,212,212,0.03) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 75% 65%, rgba(212,212,212,0.025) 0%, transparent 50%)
          `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.60) 100%)',
        }}
      />

      {/* Large Background Text */}
      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(8rem, 18vw, 26rem)',
            color: `rgba(255,255,255,${bgTextOpacity})`,
            textShadow: '0 0 180px rgba(255,255,255,0.025)',
            fontFamily: 'var(--font-heading, sans-serif)',
          }}
        >
          FIND ME
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto w-full px-5 md:px-10 py-32 md:py-56">
        {/* Label */}
        <div ref={labelRef} className="flex items-center gap-4 mb-9 md:mb-14">
          <div className="w-10 h-[1px]" style={{ background: accent, opacity: 0.45 }} />
          <span
            className="text-[9px] font-mono tracking-[0.5em] uppercase"
            style={{ color: accent, opacity: 0.55 }}
          >
            Identity
          </span>
          <div className="w-10 h-[1px]" style={{ background: accent, opacity: 0.45 }} />
        </div>

        {/* Heading */}
        <div ref={headingRef} className="mb-5 md:mb-8">
          <h2
            className="font-display font-bold tracking-tighter leading-[1.06] transition-all duration-700 group cursor-default"
            style={{
              fontSize: 'clamp(2.6rem, 7vw, 5.5rem)',
              color: 'rgba(255,255,255,0.95)',
              fontFamily: 'var(--font-heading, sans-serif)',
              wordBreak: 'keep-all',
              letterSpacing: isHovering ? '-0.01em' : '-0.03em',
            }}
          >
            나를 찾아줘
          </h2>
        </div>

        {/* Sub */}
        <div ref={subRef} className="mb-12 md:mb-20">
          <p
            className="text-base md:text-lg leading-relaxed max-w-xl"
            style={{
              color: 'rgba(255,255,255,0.48)',
              wordBreak: 'keep-all',
            }}
          >
            잃어버린 게 아니어도, 나를 다시 만나는 시간
          </p>
        </div>

        {/* Divider */}
        <div className="mb-12 md:mb-20">
          <div className="w-full h-[1px]" style={{ background: `linear-gradient(90deg, ${accent}22, transparent)` }} />
        </div>

        {/* Body Text — Sequential Reveal */}
        <div ref={bodyContainerRef} className="max-w-2xl">
          {bodyLines.map((line, i) => {
            if (line === '') {
              return (
                <div key={`fm-blank-${i}`} className="h-6 md:h-8" />
              );
            }
            const isQuote = line.startsWith('"');
            return (
              <div
                key={`fm-line-${i}`}
                className="relative group/line cursor-default"
                onMouseEnter={() => setHoveredLine(i)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                {/* Left accent bar on hover */}
                <div
                  className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover/line:h-full transition-all duration-500 ease-out rounded-full"
                  style={{ background: accent, opacity: hoveredLine === i ? 0.35 : 0 }}
                />
                <p
                  ref={(el) => { bodyLineRefs.current[i] = el; }}
                  className="text-[14px] md:text-base leading-[2.0] mb-1 transition-all duration-500"
                  style={{
                    color: isQuote
                      ? (hoveredLine === i ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.45)')
                      : (hoveredLine === i ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.60)'),
                    fontStyle: isQuote ? 'italic' : 'normal',
                    wordBreak: 'keep-all',
                    transform: hoveredLine === i ? 'translateX(2px)' : 'translateX(0)',
                  }}
                >
                  {line}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Accent */}
        <div ref={bottomLineRef} className="mt-20 md:mt-32 flex items-center gap-4 group cursor-default">
          <div
            className="w-20 h-[1px] transition-all duration-700 group-hover:w-28"
            style={{ background: accent, opacity: 0.3 }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full transition-all duration-700 group-hover:scale-150"
            style={{ background: accent, opacity: 0.3 }}
          />
          <div
            className="w-20 h-[1px] transition-all duration-700 group-hover:w-28"
            style={{ background: accent, opacity: 0.3 }}
          />
        </div>

        {/* Closing CTA */}
        <div className="mt-10 md:mt-14">
          <a
            href="#hero"
            className="inline-flex items-center gap-2.5 text-[11px] font-mono tracking-[0.35em] uppercase transition-all duration-500 group cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.30)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.60)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.30)';
            }}
          >
            <span
              className="w-0 h-[1px] transition-all duration-500 group-hover:w-8"
              style={{ background: accent, opacity: 0.55 }}
            />
            <span>처음으로</span>
            <i className="ri-arrow-up-line text-xs transition-all duration-500 group-hover:-translate-y-1" />
          </a>
        </div>
      </div>

      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </section>
  );
}