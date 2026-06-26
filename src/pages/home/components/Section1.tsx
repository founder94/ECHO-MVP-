import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Section1Props {
  isDarkMode: boolean;
}

interface Card3DState {
  id: number;
  rotateX: number;
  rotateY: number;
  glowX: number;
  glowY: number;
}

const missions = [
  {
    num: '01',
    ko: '인간 경험 설계',
    en: 'Human Experience Design',
    desc: '감정, 행동, 선택의 패턴을 다차원 데이터로 수집하고 구조화하여 관계의 본질을 이해합니다. ECHO의 HROS 엔진은 수천 개의 미시적 상호작용을 하나의 일관된 경험 지도로 통합합니다.',
    tags: ['감정 데이터', '행동 패턴', '경험 지도'],
  },
  {
    num: '02',
    ko: '관계 지능',
    en: 'Relationship Intelligence',
    desc: '반복되는 감정 사이클을 시각화하고, 개인에게 최적화된 관계 언어를 설계합니다. 딥러닝이 인간 관계의 비선형적 역학을 해석하는 지능형 시스템입니다.',
    tags: ['딥러닝 분석', '감정 사이클', '관계 시각화'],
  },
  {
    num: '03',
    ko: '정체성 탐구',
    en: 'Identity Discovery',
    desc: '진짜 나를 마주하는 기술, ECHO 미러 테크놀로지. 관계 데이터 속에서 진정한 자아의 흔적을 찾아내고, 나를 더 깊이 이해하는 경험을 설계합니다.',
    tags: ['정체성 발견', '미러 테크놀로지', '자아 발견'],
  },
];

gsap.registerPlugin(ScrollTrigger);

export default function Section1({ isDarkMode }: Section1Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [card3D, setCard3D] = useState<Card3DState[]>(
    missions.map((_, i) => ({ id: i, rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 }))
  );
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (bgTextRef.current) {
        gsap.fromTo(bgTextRef.current,
          { y: 160, opacity: 0, scale: 0.82 },
          {
            y: 0, opacity: 1, scale: 1,
            duration: 2.0, ease: 'power3.out',
            scrollTrigger: { trigger: bgTextRef.current, start: 'top 90%', toggleActions: 'play none none none' },
          }
        );
      }
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { y: 100, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.4, ease: 'power4.out',
            scrollTrigger: { trigger: titleRef.current, start: 'top 80%', toggleActions: 'play none none none' } }
        );
      }
      if (subRef.current) {
        gsap.fromTo(subRef.current,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', delay: 0.18,
            scrollTrigger: { trigger: subRef.current, start: 'top 85%', toggleActions: 'play none none none' } }
        );
      }
      if (cardsContainerRef.current) {
        gsap.fromTo(cardsContainerRef.current,
          { y: 120, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 1.5, ease: 'power4.out', delay: 0.35,
            scrollTrigger: { trigger: cardsContainerRef.current, start: 'top 92%', toggleActions: 'play none none none' } }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = cardRefs.current[index];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 12;
    const rotateX = ((centerY - y) / centerY) * 12;
    const glowX = (x / rect.width) * 100;
    const glowY = (y / rect.height) * 100;

    setCard3D(prev => prev.map(c =>
      c.id === index ? { ...c, rotateX, rotateY, glowX, glowY } : c
    ));
  };

  const handleCardMouseLeave = (index: number) => {
    setCard3D(prev => prev.map(c =>
      c.id === index ? { ...c, rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 } : c
    ));
  };

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.04 : 0.025;

  return (
    <section
      id="section1"
      ref={sectionRef}
      className={`relative w-full py-44 md:py-60 overflow-hidden ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-[#f8f8f8] text-black'}`}
    >
      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        style={{ perspective: '1200px' }}
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(14rem, 28vw, 36rem)',
            color: isDarkMode ? `rgba(255,255,255,${bgTextOpacity})` : `rgba(0,0,0,${bgTextOpacity})`,
            transform: 'translateZ(-150px)',
            textShadow: isDarkMode
              ? '0 0 200px rgba(255,255,255,0.03), 0 0 400px rgba(212,212,212,0.02)'
              : '0 0 200px rgba(0,0,0,0.02), 0 0 400px rgba(61,61,61,0.01)',
          }}
        >
          MISSION
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 w-full h-[1px]"
            style={{
              top: `${12 + i * 15}%`,
              background: `linear-gradient(90deg, transparent 5%, rgba(212,212,212,${0.02 + i * 0.008}) 20%, rgba(212,212,212,${0.03 + i * 0.01}) 50%, rgba(212,212,212,${0.02 + i * 0.008}) 80%, transparent 95%)`,
              animation: `float-3d-line ${16 + i * 3}s ${i * 2.5}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 md:px-10 relative z-10">
        <div className="mb-24 md:mb-32">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-[1px]" style={{ background: accentColor, opacity: 0.5 }} />
            <span
              className="text-[10px] font-mono tracking-[0.5em] uppercase"
              style={{ color: accentColor, opacity: 0.7 }}
            >
              What We Believe
            </span>
          </div>

          <h2
            ref={titleRef}
            className="font-display font-bold tracking-tighter leading-[0.92]"
            style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}
          >
            우리는 관계를<br />
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }}>
              디자인합니다
            </span>
          </h2>

          <p
            ref={subRef}
            className="text-base md:text-lg leading-relaxed mt-8 max-w-xl"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)' }}
          >
            ECHO는 인간 경험을 설계하는 휴먼 익스피리언스 디자인 컴퍼니입니다.
            데이터와 감성의 교차점에서 관계의 새로운 언어를 만듭니다.
          </p>
        </div>

        <div
          ref={cardsContainerRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7"
        >
          {missions.map((m, i) => {
            const state = card3D[i] || { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 };
            const isExpanded = expanded === i;

            return (
              <div
                key={m.num}
                ref={(el) => { cardRefs.current[i] = el; }}
                onMouseMove={(e) => handleCardMouseMove(e, i)}
                onMouseLeave={() => handleCardMouseLeave(i)}
                className="group relative cursor-pointer"
                style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
              >
                <div
                  className={`relative rounded-xl p-8 md:p-10 transition-all duration-600 ${
                    isExpanded
                      ? 'bg-white/[0.08] border-white/[0.18]'
                      : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.14]'
                  } border`}
                  style={{
                    transform: `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg)`,
                    transition: 'transform 0.12s ease-out, background 0.6s, border 0.6s',
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                    style={{
                      background: `radial-gradient(circle 320px at ${state.glowX}% ${state.glowY}%, rgba(212,212,212,0.10), transparent 65%)`,
                    }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className="font-display font-bold tracking-tighter leading-none transition-all duration-600 group-hover:scale-110"
                        style={{
                          fontSize: 'clamp(3.5rem, 7vw, 5rem)',
                          color: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        }}
                      >
                        {m.num}
                      </span>
                      <div className="w-0 h-[1px] transition-all duration-600 group-hover:w-14" style={{ background: accentColor, opacity: 0.6 }} />
                    </div>

                    <h3 className="text-xl md:text-2xl font-display font-semibold tracking-tight mb-1.5">
                      {m.ko}
                    </h3>
                    <p className="text-sm font-medium tracking-wide mb-5" style={{ color: accentColor, opacity: 0.65 }}>
                      {m.en}
                    </p>

                    <p className="text-sm leading-relaxed mb-6" style={{ color: isDarkMode ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.35)' }}>
                      {m.desc.slice(0, 80)}...
                    </p>

                    <div
                      className={`overflow-hidden transition-all duration-700 ${
                        isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
                      }`}
                      style={{ transition: 'max-height 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s' }}
                    >
                      <div className="pt-5 border-t border-white/[0.10]">
                        <p className="text-sm leading-relaxed mb-5" style={{ color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }}>
                          {m.desc}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-3 py-1.5 rounded-full border transition-all duration-300 border-white/[0.10] text-white/40 bg-white/[0.03] hover:border-white/[0.20] hover:text-white/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                      <div className="w-10 h-[1px] bg-white/15 transition-all duration-600 group-hover:w-16" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(isExpanded ? null : i);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide whitespace-nowrap cursor-pointer transition-all duration-300 text-white/30 hover:text-white/65"
                      >
                        {isExpanded ? '접기' : '더 보기'}
                        <i className={`text-[10px] transition-transform duration-300 ${isExpanded ? 'ri-arrow-up-s-line rotate-180' : 'ri-arrow-down-s-line'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-24 flex items-center gap-5">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-white/[0.10] to-transparent" />
          <span className="text-[10px] font-mono tracking-[0.35em] uppercase text-white/18">
            Scroll to explore
          </span>
        </div>
      </div>
    </section>
  );
}