import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { FAQ_CATEGORIES } from '@/pages/home/data/experiences';

interface FaqSectionProps {
  isDarkMode: boolean;
}

const FaqAccordionItem = ({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const particleRef = useRef<HTMLDivElement>(null);
  const answerInnerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!contentRef.current || !answerInnerRef.current) return;

    const ctx = gsap.context(() => {
      if (isOpen) {
        gsap.set(contentRef.current, { height: 'auto' });
        const height = contentRef.current?.offsetHeight || 0;
        gsap.set(contentRef.current, { height: 0 });

        gsap.to(contentRef.current, {
          height,
          duration: 0.55,
          ease: 'power3.out',
        });

        gsap.fromTo(
          answerInnerRef.current,
          { opacity: 0, y: 12, filter: 'blur(8px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, delay: 0.15, ease: 'power3.out' },
        );

        if (sweepRef.current) {
          gsap.fromTo(
            sweepRef.current,
            { left: '-100%' },
            { left: '200%', duration: 0.7, delay: 0.1, ease: 'power2.inOut' },
          );
        }

        if (glowRef.current) {
          gsap.fromTo(
            glowRef.current,
            { opacity: 0, scale: 0.92 },
            { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' },
          );
        }

        if (particleRef.current) {
          const particles = particleRef.current.querySelectorAll('.faq-particle');
          gsap.fromTo(
            particles,
            { opacity: 0, scale: 0, y: 0 },
            {
              opacity: 1,
              scale: 1,
              y: -40,
              duration: 0.8,
              stagger: 0.04,
              ease: 'power2.out',
              onComplete: () => {
                gsap.to(particles, {
                  opacity: 0,
                  y: -80,
                  duration: 0.6,
                  stagger: 0.03,
                  delay: 0.3,
                  ease: 'power2.in',
                });
              },
            },
          );
        }

        if (iconRef.current) {
          gsap.to(iconRef.current, { rotation: 45, duration: 0.4, ease: 'power3.out' });
        }
      } else {
        gsap.to(contentRef.current, {
          height: 0,
          duration: 0.4,
          ease: 'power3.in',
        });

        if (glowRef.current) {
          gsap.to(glowRef.current, { opacity: 0, duration: 0.3 });
        }

        if (iconRef.current) {
          gsap.to(iconRef.current, { rotation: 0, duration: 0.35, ease: 'power3.out' });
        }
      }
    });

    return () => ctx.revert();
  }, [isOpen]);

  return (
    <div className="relative group">
      {/* Glow overlay on open */}
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-2xl opacity-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Question button */}
      <button
        onClick={onToggle}
        className={`relative w-full flex items-center justify-between gap-4 px-5 md:px-7 py-5 md:py-6 rounded-2xl border transition-all duration-500 cursor-pointer text-left ${
          isOpen
            ? 'border-white/[0.08] bg-white/[0.03]'
            : 'border-white/[0.04] bg-transparent hover:bg-white/[0.015] hover:border-white/[0.06]'
        }`}
        style={{
          backdropFilter: isOpen ? 'blur(20px)' : 'blur(0px)',
          WebkitBackdropFilter: isOpen ? 'blur(20px)' : 'blur(0px)',
        }}
      >
        {/* Light sweep bar */}
        <div
          ref={sweepRef}
          className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
        >
          <div
            className="absolute top-0 bottom-0 w-[60px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
            }}
          />
        </div>

        {/* Particle burst container */}
        <div
          ref={particleRef}
          className="absolute top-1/2 right-12 -translate-y-1/2 pointer-events-none"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="faq-particle absolute rounded-full opacity-0"
              style={{
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                background: '#D4D4D4',
                left: `${(i - 4) * 6}px`,
                top: 0,
              }}
            />
          ))}
        </div>

        {/* Question text */}
        <span
          className={`text-sm md:text-[15px] font-medium tracking-[-0.01em] transition-all duration-500 ${
            isOpen ? 'text-white/90' : 'text-white/75'
          }`}
        >
          <span className="text-white/30 text-[11px] font-mono tracking-[0.15em] mr-3">
            {String(index + 1).padStart(2, '0')}
          </span>
          {question}
        </span>

        {/* Plus/Minus icon */}
        <div
          ref={iconRef}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-white/[0.08]"
        >
          <i
            className={`ri-add-line text-sm transition-colors duration-300 ${
              isOpen ? 'text-white/60' : 'text-white/30'
            }`}
          />
        </div>
      </button>

      {/* Answer content */}
      <div ref={contentRef} className="overflow-hidden" style={{ height: 0 }}>
        <div ref={answerInnerRef} className="px-5 md:px-7 pb-5 md:pb-6 pt-1">
          <p className="text-sm md:text-[15px] leading-[1.8] text-white/60">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
};

const FaqSection = ({ isDarkMode: _isDarkMode }: FaqSectionProps) => {
  const [activeCategory, setActiveCategory] = useState(FAQ_CATEGORIES[0].id);
  const [openQuestionKey, setOpenQuestionKey] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const activeCategoryData = FAQ_CATEGORIES.find((c) => c.id === activeCategory) || FAQ_CATEGORIES[0];

  const toggleQuestion = useCallback((key: string) => {
    setOpenQuestionKey((prev) => (prev === key ? null : key));
  }, []);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    if (!section || !header) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        header.querySelectorAll('.faq-header-reveal'),
        { opacity: 0, y: 24, filter: 'blur(6px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
          },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    setOpenQuestionKey(null);
  }, [activeCategory]);

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="relative w-full overflow-hidden bg-[#060606] border-t border-white/[0.03]"
    >
      {/* Ambient background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={`faq-bg-pt-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${((i * 37 + 11) % 100)}%`,
              top: `${((i * 53 + 7) % 100)}%`,
              width: `${1 + (i % 4)}px`,
              height: `${1 + (i % 4)}px`,
              background: '#D4D4D4',
              opacity: 0.03 + (i % 5) * 0.008,
              animation: `float-${1 + (i % 3)} ${5 + (i % 10)}s ${(i * 0.5) % 4}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24">
        {/* Section header */}
        <div ref={headerRef} className="mb-10 md:mb-14">
          <span className="faq-header-reveal inline-block text-[11px] font-mono tracking-[0.35em] uppercase text-white/25 mb-5">
            Questions
          </span>
          <h2 className="faq-header-reveal text-2xl md:text-[34px] font-semibold tracking-[-0.03em] text-white/90 mb-4 leading-tight">
            자주 묻는 질문
          </h2>
          <p className="faq-header-reveal text-sm md:text-[15px] text-white/45 leading-relaxed max-w-lg">
            ECHO에 대해 가장 많이 궁금해하시는 내용을 카테고리별로 정리했습니다.
            질문을 클릭하면 답변이 펼쳐집니다.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="faq-header-reveal mb-10 md:mb-12">
          <div className="inline-flex items-center gap-1.5 px-1 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">
            {FAQ_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all duration-400 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ accordion list */}
        <div className="flex flex-col gap-2">
          {activeCategoryData.questions.map((item, index) => {
            const questionKey = `${activeCategory}-${index}`;
            return (
              <FaqAccordionItem
                key={questionKey}
                question={item.q}
                answer={item.a}
                isOpen={openQuestionKey === questionKey}
                onToggle={() => toggleQuestion(questionKey)}
                index={index}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;