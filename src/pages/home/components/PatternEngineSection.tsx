import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Engine {
  number: string;
  title: string;
  subtitle: string;
  description: string;
}

const ENGINES: Engine[] = [
  {
    number: '01',
    title: '관계 패턴 엔진',
    subtitle: '반복되는 감정과 행동의 흐름을 발견합니다.',
    description:
      '우리는 의식하지 못하는 사이에 같은 패턴을 반복합니다. ECHO는 대화와 감정 데이터 속에서 반복되는 행동 양상을 찾아내어, 왜 같은 상황이 반복되는지 이해할 수 있도록 돕습니다.',
  },
  {
    number: '02',
    title: '감정 해석 엔진',
    subtitle: '감정 뒤에 숨겨진 진짜 이유를 이해합니다.',
    description:
      '화가 났다고 화가 난 것이 아닙니다. ECHO는 표면의 감정을 넘어, 그 깊은 곳에 자리한 미충족 욕구와 진짜 바람을 해독합니다.',
  },
  {
    number: '03',
    title: '자기 이해 엔진',
    subtitle: '관계 속에서 나를 더 깊이 이해합니다.',
    description:
      '우리는 관계를 통해 나를 알아갑니다. ECHO는 당신의 핵심 가치, 강점, 그리고 진짜 모습을 데이터 기반으로 정리해 드립니다.',
  },
  {
    number: '04',
    title: '다음 한 걸음 엔진',
    subtitle: '이해에서 끝나지 않고 행동으로 연결합니다.',
    description:
      '통찰은 행동으로 완성됩니다. ECHO는 분석된 결과를 바탕으로, 당신에게 꼭 맞는 다음 단계의 구체적인 액션을 제안합니다.',
  },
];

const PatternEngineSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [burstParticles, setBurstParticles] = useState<{ id: number; x: number; y: number; angle: number; color: string }[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const burstIdRef = useRef(0);

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index === activeIndex) return;
      setIsAnimating(true);

      // Spawn burst particles at card center
      const cardEl = cardRef.current;
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const particles = Array.from({ length: 18 }, (_, j) => ({
          id: burstIdRef.current++,
          x: cx,
          y: cy,
          angle: (j / 18) * 360 + Math.random() * 15,
          color: j % 3 === 0 ? '#D4D4D4' : j % 3 === 1 ? '#FFFFFF' : '#9B9B9B',
        }));
        setBurstParticles(particles);
        setTimeout(() => setBurstParticles([]), 900);
      }

      const currentCard = cardsRef.current[activeIndex];
      const nextCard = cardsRef.current[index];
      const direction = index > activeIndex ? 1 : -1;

      if (currentCard) {
        gsap.to(currentCard, {
          rotateY: direction * -90,
          opacity: 0,
          scale: 0.85,
          duration: 0.4,
          ease: 'power2.in',
        });
      }
      if (nextCard) {
        gsap.fromTo(
          nextCard,
          { rotateY: direction * 90, opacity: 0, scale: 0.85 },
          {
            rotateY: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            delay: 0.2,
            ease: 'power3.out',
            onComplete: () => setIsAnimating(false),
          },
        );
      }
      setActiveIndex(index);
    },
    [activeIndex, isAnimating],
  );

  const next = useCallback(() => {
    goTo((activeIndex + 1) % ENGINES.length);
  }, [activeIndex, goTo]);

  const prev = useCallback(() => {
    goTo((activeIndex - 1 + ENGINES.length) % ENGINES.length);
  }, [activeIndex, goTo]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.from(headerRef.current.children, {
          y: 40,
          opacity: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        });
      }
      if (cardRef.current) {
        gsap.from(cardRef.current, {
          y: 60,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 65%',
            toggleActions: 'play none none none',
          },
        });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden py-20 md:py-28"
      style={{ background: '#050505', perspective: '1200px' }}
    >
      {/* Decorative background lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={`bg-line-${i}`}
            className="absolute h-px bg-white/5"
            style={{
              left: '10%',
              right: '10%',
              top: `${15 + i * 14}%`,
              animation: `pe-line-pulse ${4 + i * 0.7}s ${i * 0.3}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-14 md:mb-20">
          <div className="text-white/40 text-[10px] font-mono uppercase tracking-[0.5em] mb-4">
            Pattern Engine
          </div>
          <h2 className="text-white text-3xl md:text-5xl font-bold tracking-tight mb-4">
            4 Engines for Self-Discovery
          </h2>
          <p className="text-white/50 text-sm md:text-base max-w-lg mx-auto">
            나를 더 깊이 이해하기 위한 4가지 핵심 엔진
          </p>
        </div>

        {/* Number buttons */}
        <div className="flex items-center justify-center gap-3 md:gap-4 mb-10 md:mb-14">
          {ENGINES.map((engine, i) => (
            <button
              key={engine.number}
              onClick={() => goTo(i)}
              className={`relative w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full border transition-all duration-500 cursor-pointer ${
                i === activeIndex
                  ? 'bg-white text-black border-white scale-110'
                  : 'bg-transparent text-white/50 border-white/20 hover:border-white/40 hover:text-white/80'
              }`}
              style={
                i === activeIndex
                  ? { animation: 'pe-number-glow 2s infinite ease-in-out' }
                  : undefined
              }
            >
              <span className="text-sm md:text-base font-mono font-bold tracking-wider">
                {engine.number}
              </span>
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-10 md:mb-14">
          {ENGINES.map((_, i) => (
            <div
              key={`progress-${i}`}
              className={`h-px transition-all duration-500 ${
                i === activeIndex ? 'w-8 bg-white/60' : 'w-4 bg-white/15'
              }`}
            />
          ))}
        </div>

        {/* Card container with 3D perspective */}
        <div
          ref={cardRef}
          className="relative"
          style={{ perspective: '1000px', transformStyle: 'preserve-3d', minHeight: '320px' }}
        >
          {ENGINES.map((engine, i) => (
            <div
              key={engine.number}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="absolute inset-0 w-full"
              style={{
                opacity: i === activeIndex ? 1 : 0,
                transform: i === activeIndex ? 'rotateY(0deg) scale(1)' : 'rotateY(90deg) scale(0.85)',
                transformStyle: 'preserve-3d',
                pointerEvents: i === activeIndex ? 'auto' : 'none',
                transition: 'none',
              }}
            >
              <div className="relative border border-white/10 rounded-2xl bg-white/[0.03] backdrop-blur-sm p-8 md:p-12 overflow-hidden">
                {/* Corner accent */}
                <div className="absolute top-0 left-0 w-20 h-20 border-l border-t border-white/20 rounded-tl-2xl" />
                <div className="absolute bottom-0 right-0 w-20 h-20 border-r border-b border-white/20 rounded-br-2xl" />

                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
                  {/* Large number */}
                  <div className="flex-shrink-0">
                    <div className="text-6xl md:text-8xl font-bold text-white/10 font-mono leading-none">
                      {engine.number}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-white text-xl md:text-2xl font-semibold mb-2">
                      {engine.title}
                    </h3>
                    <p className="text-white/70 text-sm md:text-base font-medium mb-4">
                      {engine.subtitle}
                    </p>
                    <p className="text-white/50 text-sm md:text-base leading-relaxed">
                      {engine.description}
                    </p>
                  </div>
                </div>

                {/* Bottom indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-white/30" />
                  <div className="text-white/30 text-[10px] font-mono tracking-wider">
                    {engine.number} / 04
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/30" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={prev}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-300 cursor-pointer"
          >
            <i className="ri-arrow-left-line text-sm" />
          </button>
          <button
            onClick={next}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-300 cursor-pointer"
          >
            <i className="ri-arrow-right-line text-sm" />
          </button>
        </div>
      </div>

      {/* Particle Burst Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {burstParticles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.x,
              top: p.y,
              width: '3px',
              height: '3px',
              background: p.color,
              boxShadow: `0 0 6px ${p.color}80, 0 0 12px ${p.color}40`,
              animation: `pe-burst 0.7s ease-out forwards`,
              '--burst-angle': `${p.angle}deg`,
              transform: `translate(-50%, -50%) rotate(var(--burst-angle)) translateX(0)`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </section>
  );
};

export default PatternEngineSection;