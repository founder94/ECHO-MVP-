import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Section3Props {
  isDarkMode: boolean;
}

const steps = [
  {
    num: '01',
    icon: 'ri-search-eye-line',
    title: 'Research',
    ko: '데이터 수집',
    desc: '언어, 행동, 감정, 생체 신호까지 — 인간 관계의 모든 미시적 상호작용을 다각도로 수집합니다.',
    detail: 'ECHO의 데이터 수집 파이프라인은 개인정보 보호를 최우선으로 설계되어, 익명화된 패턴 데이터만을 구조화된 형태로 저장합니다.',
    output: '구조화된 관계 데이터 맵',
  },
  {
    num: '02',
    icon: 'ri-brain-line',
    title: 'Strategy',
    ko: '전략 수립',
    desc: 'HROS 엔진이 수집된 데이터에서 반복되는 감정 사이클과 소통 패턴을 딥러닝으로 식별합니다.',
    detail: '개인별 관계 유형을 분류하고, 최적의 개입 지점과 전략을 도출하는 분석 레이어가 작동합니다.',
    output: '개인화된 관계 전략 보고서',
  },
  {
    num: '03',
    icon: 'ri-layout-4-line',
    title: 'Design',
    ko: '경험 설계',
    desc: '분석된 인사이트를 바탕으로, 개인에게 최적화된 관계 경험을 설계합니다.',
    detail: 'ECHO 미러 테크놀로지가 사용자에게 자신의 관계 패턴을 직관적인 비주얼 언어로 제시하고, 새로운 연결 방식을 제안합니다.',
    output: '맞춤형 관계 경험 프로토타입',
  },
  {
    num: '04',
    icon: 'ri-line-chart-line',
    title: 'Application',
    ko: '지속 개선',
    desc: '설계된 경험은 실제 관계 속에서 적용되고, 그 결과는 다시 데이터로 피드백됩니다.',
    detail: 'ECHO의 폐루프 시스템은 관계의 진화를 실시간으로 추적하며, 지속적으로 더 나은 방향으로 알고리즘을 조정합니다.',
    output: '실시간 관계 개선 대시보드',
  },
];

gsap.registerPlugin(ScrollTrigger);

export default function Section3({ isDarkMode }: Section3Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const floatingShapes = [
    { shape: 'circle', top: '8%', left: '6%', size: 80, delay: 0 },
    { shape: 'square', top: '28%', right: '5%', size: 50, delay: 2 },
    { shape: 'circle', top: '52%', left: '4%', size: 65, delay: 4 },
    { shape: 'square', top: '72%', right: '8%', size: 85, delay: 1 },
    { shape: 'circle', top: '18%', right: '12%', size: 45, delay: 3 },
    { shape: 'circle', top: '82%', left: '10%', size: 55, delay: 5 },
  ];

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
      if (stepsContainerRef.current) {
        gsap.fromTo(stepsContainerRef.current,
          { y: 120, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.4, ease: 'power4.out', delay: 0.35,
            scrollTrigger: { trigger: stepsContainerRef.current, start: 'top 88%', toggleActions: 'play none none none' } }
        );
      }
    }, sectionRef);

    const handleScroll = () => {
      if (!stepsContainerRef.current) return;
      const container = stepsContainerRef.current;
      const rect = container.getBoundingClientRect();
      const windowH = window.innerHeight;
      const progress = (windowH * 0.65 - rect.top) / rect.height;
      const step = Math.min(steps.length - 1, Math.max(0, Math.floor(progress * steps.length)));
      setActiveStep(step);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDarkMode]);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.04 : 0.025;

  return (
    <section
      id="approach"
      ref={sectionRef}
      className={`relative w-full py-44 md:py-60 overflow-hidden ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f5] text-black'}`}
    >
      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(9rem, 20vw, 28rem)',
            color: isDarkMode ? `rgba(255,255,255,${bgTextOpacity})` : `rgba(0,0,0,${bgTextOpacity})`,
            textShadow: isDarkMode ? '0 0 160px rgba(255,255,255,0.03)' : '0 0 160px rgba(0,0,0,0.02)',
          }}
        >
          APPROACH
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingShapes.map((s, i) => (
          <div
            key={i}
            className={`absolute ${s.shape === 'circle' ? 'rounded-full' : 'rounded-lg rotate-45'}`}
            style={{
              top: s.top, left: s.left, right: s.right,
              width: s.size, height: s.size,
              border: `1.5px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
              animation: `float-3d-${1 + (i % 3)} ${15 + i * 3}s ${s.delay}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 md:px-10 relative z-10">
        <div className="mb-20 md:mb-28">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-[1px]" style={{ background: accentColor, opacity: 0.5 }} />
            <span className="text-[10px] font-mono tracking-[0.5em] uppercase" style={{ color: accentColor, opacity: 0.7 }}>
              How We Work
            </span>
          </div>
          <h2
            ref={titleRef}
            className="font-display font-bold tracking-tighter leading-[0.92]"
            style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}
          >
            Creatively<br />
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }}>
              Rational
            </span>
          </h2>
        </div>

        <div ref={stepsContainerRef}>
          <div className="hidden lg:flex items-center gap-3 mb-14">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-[2px] rounded-full transition-all duration-800"
                style={{
                  width: i <= activeStep ? '100px' : '50px',
                  background: i <= activeStep ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  opacity: i <= activeStep ? 0.75 : 0.25,
                }}
              />
            ))}
            <span className="text-[9px] font-mono ml-3" style={{ color: accentColor, opacity: 0.55 }}>
              {activeStep + 1} / {steps.length}
            </span>
          </div>

          <div className="flex flex-col gap-5 md:gap-6">
            {steps.map((step, i) => {
              const isActive = activeStep >= i;
              const isHovered = hoveredStep === i;

              return (
                <div
                  key={step.num}
                  onMouseEnter={() => setHoveredStep(i)}
                  onMouseLeave={() => setHoveredStep(null)}
                  className={`group relative rounded-xl p-7 md:p-9 transition-all duration-800 cursor-default border ${
                    isActive
                      ? isHovered
                        ? 'bg-white/[0.06] border-white/[0.15] translate-x-3'
                        : 'bg-white/[0.03] border-white/[0.09]'
                      : 'bg-white/[0.008] border-white/[0.04] opacity-[0.55]'
                  }`}
                  style={{
                    transform: isActive ? 'translateX(0)' : 'translateX(-30px)',
                    transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
                    <div className="flex items-center gap-5 md:min-w-[160px]">
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-800 ${
                          isActive ? 'bg-white/[0.08]' : 'bg-white/[0.03]'
                        }`}
                        style={{ color: isActive ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.13)') }}
                      >
                        <i className={`${step.icon} text-xl`} />
                      </div>
                      <span
                        className="font-display font-bold tracking-tighter leading-none transition-all duration-800"
                        style={{
                          fontSize: '2.5rem',
                          color: isActive ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                          opacity: isActive ? 0.65 : 1,
                        }}
                      >
                        {step.num}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg md:text-xl font-display font-semibold tracking-tight">
                          {step.title}
                        </h3>
                        <span className="text-xs font-medium tracking-wide" style={{ color: accentColor, opacity: 0.55 }}>
                          {step.ko}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed max-w-xl" style={{ color: isDarkMode ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.33)' }}>
                        {step.desc}
                      </p>

                      <div
                        className="overflow-hidden transition-all duration-800"
                        style={{
                          maxHeight: isHovered ? '200px' : '0px',
                          opacity: isHovered ? 1 : 0,
                          transition: 'max-height 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s',
                        }}
                      >
                        <div className="pt-5 mt-5 border-t border-white/[0.08]">
                          <p className="text-sm leading-relaxed mb-4" style={{ color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.38)' }}>
                            {step.detail}
                          </p>
                          <span
                            className="inline-flex items-center gap-2 text-[10px] font-mono tracking-wide"
                            style={{ color: accentColor, opacity: 0.45 }}
                          >
                            <i className="ri-corner-down-right-line text-[8px]" />
                            {step.output}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center justify-center w-10">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-600"
                        style={{
                          background: isActive ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                          color: isActive ? accentColor : 'transparent',
                          opacity: isActive ? 0.6 : 0,
                          transform: isHovered ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                      >
                        <i className="ri-arrow-right-line text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-20 text-center">
          <a
            href="#services"
            className="dive-btn inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 group whitespace-nowrap cursor-pointer border border-white/[0.10] text-white/35 hover:text-white/70 hover:border-white/[0.22] hover:scale-105"
          >
            우리가 하는 일 보기
            <i className="ri-arrow-down-line transition-all duration-300 group-hover:translate-y-1" />
          </a>
        </div>
      </div>
    </section>
  );
}