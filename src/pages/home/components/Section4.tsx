import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Section4Props {
  isDarkMode: boolean;
}

const services = [
  {
    num: '01',
    icon: 'ri-heart-pulse-line',
    title: 'Human Experience',
    subtitle: 'Design',
    desc: '인간의 감정, 행동, 선택을 다차원 데이터로 수집하고 구조화하여 관계의 본질을 설계합니다.',
    features: ['감정 패턴 매핑', '행동 데이터 모델링', '경험 프로토타이핑'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Abstract%20flowing%20organic%20shapes%20in%20platinum%20silver%20with%20soft%20translucent%20layers%20floating%20on%20deep%20dark%20background%20delicate%20light%20particles%20creating%20depth%20elegant%20minimal%20composition%20cinematic%20atmosphere%20ethereal%20glow&width=600&height=400&seq=service-hx-plusx-v3&orientation=landscape',
  },
  {
    num: '02',
    icon: 'ri-node-tree',
    title: 'Relationship',
    subtitle: 'Intelligence',
    desc: '관계의 패턴을 딥러닝으로 분석하고, 반복되는 감정 사이클을 직관적인 비주얼 언어로 시각화합니다.',
    features: ['딥러닝 패턴 분석', '감정 사이클 시각화', '관계 유형 분류'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Interconnected%20network%20nodes%20geometric%20connections%20in%20platinum%20silver%20on%20deep%20charcoal%20background%20data%20visualization%20aesthetic%20elegant%20minimal%20network%20pattern%20soft%20glow%20particles%20cinematic%20mood&width=600&height=400&seq=service-ri-plusx-v3&orientation=landscape',
  },
  {
    num: '03',
    icon: 'ri-focus-3-line',
    title: 'Identity',
    subtitle: 'Discovery',
    desc: '숨겨진 정체성을 데이터로 발견하는 ECHO 미러 테크놀로지. 진짜 나를 마주하는 경험을 설계합니다.',
    features: ['정체성 데이터 발견', '미러 테크놀로지', '자아 발견 경험'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Mirror%20reflection%20abstract%20composition%20with%20soft%20platinum%20silver%20light%20breaking%20through%20dark%20surface%20fragmented%20geometric%20forms%20reassembling%20elegant%20minimal%20surreal%20atmosphere%20cinematic%20depth&width=600&height=400&seq=service-ir-plusx-v3&orientation=landscape',
  },
  {
    num: '04',
    icon: 'ri-robot-2-line',
    title: 'AI',
    subtitle: 'Coaching',
    desc: '24시간 HROS 기반 AI 관계 코칭으로 지속적인 자기 발견과 성장을 실시간으로 지원합니다.',
    features: ['24/7 AI 코칭', '개인화된 피드백', '성장 트래킹'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Abstract%20AI%20brain%20concept%20with%20glowing%20platinum%20silver%20neural%20connections%20on%20dark%20background%20elegant%20minimal%20technology%20aesthetic%20soft%20luminous%20particles%20clean%20modern%20composition%20ethereal%20atmosphere&width=600&height=400&seq=service-ai-plusx-v3&orientation=landscape',
  },
  {
    num: '05',
    icon: 'ri-dashboard-3-line',
    title: 'Data',
    subtitle: 'Platform',
    desc: '관계 데이터를 한눈에 모니터링할 수 있는 대시보드와 실시간 인사이트 리포트를 제공합니다.',
    features: ['실시간 대시보드', '인사이트 리포트', '데이터 API'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Clean%20minimal%20data%20dashboard%20abstract%20with%20platinum%20silver%20accent%20lines%20charts%20and%20graphs%20on%20dark%20background%20elegant%20information%20design%20soft%20glow%20aesthetic%20refined%20modern%20interface%20concept&width=600&height=400&seq=service-dp-plusx-v3&orientation=landscape',
  },
];

gsap.registerPlugin(ScrollTrigger);

interface Card3DPosition {
  rotateX: number;
  rotateY: number;
  glowX: number;
  glowY: number;
}

export default function Section4({ isDarkMode }: Section4Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [cardPositions, setCardPositions] = useState<Card3DPosition[]>(
    services.map(() => ({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 }))
  );

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (bgTextRef.current) {
        gsap.fromTo(bgTextRef.current,
          { y: 140, opacity: 0, scale: 0.82 },
          { y: 0, opacity: 1, scale: 1, duration: 1.8, ease: 'power3.out',
            scrollTrigger: { trigger: bgTextRef.current, start: 'top 92%', toggleActions: 'play none none none' } }
        );
      }
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { y: 100, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: 'power4.out',
            scrollTrigger: { trigger: titleRef.current, start: 'top 82%', toggleActions: 'play none none none' } }
        );
      }
      if (cardsContainerRef.current) {
        gsap.fromTo(cardsContainerRef.current,
          { y: 120, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 1.5, ease: 'power4.out', delay: 0.35,
            scrollTrigger: { trigger: cardsContainerRef.current, start: 'top 88%', toggleActions: 'play none none none' } }
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
    setCardPositions(prev => prev.map((c, i) =>
      i === index
        ? {
            rotateX: ((centerY - y) / centerY) * 14,
            rotateY: ((x - centerX) / centerX) * 14,
            glowX: (x / rect.width) * 100,
            glowY: (y / rect.height) * 100,
          }
        : c
    ));
  };

  const handleCardMouseLeave = (index: number) => {
    setCardPositions(prev => prev.map((c, i) =>
      i === index ? { ...c, rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 } : c
    ));
  };

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.035 : 0.022;

  return (
    <section
      id="services"
      ref={sectionRef}
      className={`relative w-full py-44 md:py-60 overflow-hidden ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-[#fafafa] text-black'}`}
    >
      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(8rem, 18vw, 26rem)',
            color: isDarkMode ? `rgba(255,255,255,${bgTextOpacity})` : `rgba(0,0,0,${bgTextOpacity})`,
            textShadow: isDarkMode ? '0 0 150px rgba(255,255,255,0.025)' : '0 0 150px rgba(0,0,0,0.015)',
          }}
        >
          SERVICES
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { top: '6%', right: '4%', w: 100, h: 100, delay: 0 },
          { top: '38%', left: '2%', w: 65, h: 65, delay: 3 },
          { top: '68%', right: '6%', w: 80, h: 80, delay: 5 },
        ].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/[0.04]"
            style={{
              top: s.top, right: s.right, left: s.left,
              width: s.w, height: s.h,
              animation: `float-3d-${1 + (i % 3)} ${18 + i * 4}s ${s.delay}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 md:px-10 relative z-10">
        <div className="mb-20 md:mb-28">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-[1px]" style={{ background: accentColor, opacity: 0.5 }} />
            <span className="text-[10px] font-mono tracking-[0.5em] uppercase" style={{ color: accentColor, opacity: 0.7 }}>
              Services
            </span>
          </div>
          <h2
            ref={titleRef}
            className="font-display font-bold tracking-tighter leading-[0.92]"
            style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}
          >
            What We<br />
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }}>
              Do
            </span>
          </h2>
        </div>

        <div
          ref={cardsContainerRef}
          className="flex flex-wrap justify-center gap-5 md:gap-6"
        >
          {services.map((svc, i) => {
            const pos = cardPositions[i] || { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 };
            const isHovered = hoveredCard === i;

            return (
              <div
                key={svc.num}
                ref={(el) => { cardRefs.current[i] = el; }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseMove={(e) => handleCardMouseMove(e, i)}
                onMouseLeave={() => { setHoveredCard(null); handleCardMouseLeave(i); }}
                className="group cursor-default w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] flex-shrink-0"
                style={{ perspective: '1200px' }}
              >
                <div
                  className={`relative rounded-xl border overflow-hidden transition-all duration-600 ${
                    isHovered
                      ? 'bg-white/[0.06] border-white/[0.15] scale-[1.02]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                  style={{
                    transform: `rotateX(${pos.rotateX}deg) rotateY(${pos.rotateY}deg)`,
                    transition: 'transform 0.10s ease-out, background 0.6s, border 0.6s, scale 0.4s',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    className="relative w-full overflow-hidden transition-all duration-800"
                    style={{
                      height: isHovered ? '200px' : '0px',
                      opacity: isHovered ? 1 : 0,
                      transition: 'height 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s',
                    }}
                  >
                    <img
                      src={svc.imageUrl}
                      alt={svc.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  <div className="p-7 md:p-9">
                    <div
                      className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                      style={{
                        background: `radial-gradient(circle 300px at ${pos.glowX}% ${pos.glowY}%, rgba(212,212,212,0.10), transparent 55%)`,
                      }}
                    />

                    <div className="relative z-10">
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center mb-5 transition-all duration-600 ${
                          isHovered ? 'bg-white/[0.08] scale-110' : 'bg-white/[0.03]'
                        }`}
                        style={{ color: isHovered ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.13)') }}
                      >
                        <i className={`${svc.icon} text-lg`} />
                      </div>

                      <div
                        className="font-display font-bold tracking-tighter leading-none mb-3"
                        style={{
                          fontSize: '2.8rem',
                          color: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        }}
                      >
                        {svc.num}
                      </div>

                      <h3 className="text-lg md:text-xl font-display font-semibold tracking-tight mb-0.5">
                        {svc.title}
                      </h3>
                      <p className="text-sm font-medium tracking-wide mb-4" style={{ color: accentColor, opacity: 0.6 }}>
                        {svc.subtitle}
                      </p>
                      <p className="text-sm leading-relaxed mb-5" style={{ color: isDarkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.32)' }}>
                        {isHovered ? svc.desc : `${svc.desc.slice(0, 75)}...`}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-6">
                        {svc.features.map((feat) => (
                          <span
                            key={feat}
                            className="text-[10px] px-2.5 py-1 rounded-full border transition-all duration-300 border-white/[0.08] text-white/30 group-hover:border-white/[0.15] group-hover:text-white/50"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-[1px] bg-white/12 transition-all duration-600 group-hover:w-[4.5rem]" />
                        <a
                          href="#contact"
                          onClick={(e) => e.stopPropagation()}
                          className="dive-btn inline-flex items-center gap-1 text-[11px] font-medium tracking-wide whitespace-nowrap cursor-pointer transition-all duration-300 text-white/25 hover:text-white/65"
                        >
                          문의하기
                          <i className="ri-arrow-right-up-line text-[10px] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}