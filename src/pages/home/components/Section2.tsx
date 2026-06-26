import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MagneticButton from '@/components/base/MagneticButton';

interface Section2Props {
  isDarkMode: boolean;
  onApproachClick: () => void;
  onAboutClick: () => void;
}

const timelineData = [
  { year: '2024', label: '연구 시작', desc: 'HROS 개념 초기 연구 및 데이터 수집 파이프라인 설계' },
  { year: '2025', label: '프로토타입', desc: '관계 패턴 분석 엔진 MVP 개발 및 1차 사용자 테스트 완료' },
  { year: '2026', label: 'ECHO 런칭', desc: 'DO IT COMPANY 플래그십 브랜드 ECHO 공식 출시, HX Design 서비스 시작' },
  { year: '2027', label: '확장', desc: 'AI 코칭 플랫폼 및 데이터 대시보드 정식 출시, 글로벌 파트너십' },
];

const stats = [
  { value: '9+', suffix: '', label: 'Years R&D' },
  { value: '50', suffix: 'K+', label: 'Data Points' },
  { value: '3', suffix: '', label: 'Core Patents' },
  { value: '24', suffix: '/7', label: 'AI Coaching' },
];

gsap.registerPlugin(ScrollTrigger);

export default function Section2({ isDarkMode, onApproachClick, onAboutClick }: Section2Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const infoGridRef = useRef<HTMLDivElement>(null);
  const [hoveredTimeline, setHoveredTimeline] = useState<number | null>(null);
  const [counts, setCounts] = useState([0, 0, 0, 0]);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (bgTextRef.current) {
        gsap.fromTo(bgTextRef.current,
          { y: 180, opacity: 0, scale: 0.8 },
          { y: 0, opacity: 1, scale: 1, duration: 2.0, ease: 'power3.out',
            scrollTrigger: { trigger: bgTextRef.current, start: 'top 90%', toggleActions: 'play none none none' } }
        );
      }
      if (imageRef.current) {
        gsap.fromTo(imageRef.current,
          { x: -120, opacity: 0, scale: 1.08 },
          { x: 0, opacity: 1, scale: 1, duration: 1.6, ease: 'power4.out',
            scrollTrigger: { trigger: imageRef.current, start: 'top 78%', toggleActions: 'play none none none' } }
        );
      }
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { y: 80, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out',
            scrollTrigger: { trigger: titleRef.current, start: 'top 82%', toggleActions: 'play none none none' } }
        );
      }
      if (descRef.current) {
        gsap.fromTo(descRef.current,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', delay: 0.15,
            scrollTrigger: { trigger: descRef.current, start: 'top 85%', toggleActions: 'play none none none' } }
        );
      }
      if (statsContainerRef.current) {
        gsap.fromTo(statsContainerRef.current,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', delay: 0.3,
            scrollTrigger: { trigger: statsContainerRef.current, start: 'top 88%', toggleActions: 'play none none none' } }
        );
      }
      if (timelineRef.current) {
        gsap.fromTo(timelineRef.current,
          { y: 80, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.3, ease: 'power4.out', delay: 0.4,
            scrollTrigger: { trigger: timelineRef.current, start: 'top 92%', toggleActions: 'play none none none' } }
        );
      }
      if (infoGridRef.current) {
        gsap.fromTo(infoGridRef.current,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', delay: 0.2,
            scrollTrigger: { trigger: infoGridRef.current, start: 'top 88%', toggleActions: 'play none none none' } }
        );
      }
    }, sectionRef);

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const finalValues = [9, 50, 3, 24];
        const duration = 2200;
        const steps = 60;
        const interval = duration / steps;

        let step = 0;
        const timer = setInterval(() => {
          step++;
          setCounts(finalValues.map(v => Math.min(v, Math.round((v * step) / steps))));
          if (step >= steps) clearInterval(timer);
        }, interval);

        observer.disconnect();
      }
    }, { threshold: 0.25 });

    if (statsContainerRef.current) observer.observe(statsContainerRef.current);
    return () => observer.disconnect();
  }, [isDarkMode]);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.035 : 0.022;

  return (
    <section
      id="section2"
      ref={sectionRef}
      className={`relative w-full py-44 md:py-60 overflow-hidden ${isDarkMode ? 'bg-[#080808] text-white' : 'bg-[#f3f3f3] text-black'}`}
    >
      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(12rem, 25vw, 32rem)',
            color: isDarkMode ? `rgba(255,255,255,${bgTextOpacity})` : `rgba(0,0,0,${bgTextOpacity})`,
            textShadow: isDarkMode ? '0 0 180px rgba(255,255,255,0.025)' : '0 0 180px rgba(0,0,0,0.015)',
          }}
        >
          ABOUT
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="absolute rounded-full border border-white/[0.04]"
            style={{
              width: `${180 + n * 80}px`,
              height: `${180 + n * 80}px`,
              top: `${30 - n * 10}%`,
              right: `${-10 + n * 5}%`,
              animation: `float-3d-${n} ${22 + n * 3}s ${n * 2}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 md:px-10 relative z-10">
        <div className="mb-20 md:mb-28">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-[1px]" style={{ background: accentColor, opacity: 0.5 }} />
            <span className="text-[10px] font-mono tracking-[0.5em] uppercase" style={{ color: accentColor, opacity: 0.7 }}>
              About ECHO
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 md:gap-20 mb-24 md:mb-32">
          <div ref={imageRef} className="relative">
            <div className="relative rounded-xl overflow-hidden aspect-[4/5]">
              <img
                src="https://readdy.ai/api/search-image?query=Abstract%20artistic%20composition%20of%20overlapping%20translucent%20geometric%20glass%20shapes%20in%20platinum%20silver%20on%20deep%20charcoal%20background%20floating%20light%20particles%20soft%20ethereal%20fog%20atmosphere%20elegant%20minimal%20composition%20with%20depth%20and%20perspective%20cinematic%20editorial%20photography%20sophisticated%20contemporary%20aesthetic&width=900&height=1125&seq=about-echo-plusx-v3&orientation=portrait"
                alt="ECHO - Human Relationship Operating System"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                <span className="text-[8px] font-mono tracking-[0.35em] uppercase text-white/45">
                  Human Relationship OS
                </span>
                <div className="text-7xl md:text-9xl font-display font-bold tracking-tighter text-white/90 mt-3">
                  2026
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border border-white/[0.08] pointer-events-none" />
            <div className="absolute -bottom-5 -left-5 w-14 h-14 rounded-full border border-white/[0.05] pointer-events-none" />
          </div>

          <div className="lg:pt-6 flex flex-col justify-center">
            <h2
              ref={titleRef}
              className="font-display font-bold tracking-tighter leading-[0.92] mb-10"
              style={{ fontSize: 'clamp(2.2rem, 5.5vw, 4.5rem)' }}
            >
              Human<br />
              Relationship<br />
              <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }}>
                Operating System
              </span>
            </h2>

            <p
              ref={descRef}
              className="text-base md:text-lg leading-relaxed mb-6 max-w-lg"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.32)' }}
            >
              2026년, DO IT COMPANY의 플래그십 브랜드로 탄생한 ECHO는 '인간 관계의 운영체제'라는 급진적인 비전을 품고 출발했습니다.
              사람과 사람 사이에서 반복되는 감정 패턴, 소통의 방식, 정체성의 변화 — 우리는 이것을 데이터 사이언스와 인간 경험 설계의 교차점에서 풀어냅니다.
            </p>
            <p
              className="text-sm leading-relaxed mb-10"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)' }}
            >
              감각적인 창의성과 전략적 이성의 균형. Creatively Rational이라는 철학 아래,
              누구도 시도하지 않았던 방식으로 관계의 새로운 문법을 만들어갑니다.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton
                onClick={onAboutClick}
                variant="primary"
                size="md"
                className="text-xs"
              >
                About ECHO
                <i className="ri-arrow-right-line text-xs" />
              </MagneticButton>
              <MagneticButton
                onClick={onApproachClick}
                variant="secondary"
                size="md"
                className="text-xs border border-white/12 hover:border-white/25"
              >
                Our Approach
                <i className="ri-arrow-right-line text-xs" />
              </MagneticButton>
              <a
                href="https://do-it.company/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-xs font-medium tracking-wide transition-all duration-300 border border-white/12 text-white/40 hover:border-white/25 hover:text-white/70 whitespace-nowrap cursor-pointer"
              >
                DO IT COMPANY
                <i className="ri-external-link-line text-[10px]" />
              </a>
            </div>
          </div>
        </div>

        <div
          ref={statsContainerRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10 mb-24 md:mb-32"
        >
          {stats.map((stat, i) => (
            <div key={stat.label} className="text-center group cursor-default">
              <div className="relative inline-block">
                <div
                  className="font-display font-bold tracking-tighter leading-none transition-all duration-500 group-hover:scale-[1.15]"
                  style={{ fontSize: 'clamp(2.8rem, 7vw, 4.5rem)', color: accentColor, opacity: 0.85 }}
                >
                  {counts[i]}{stat.suffix}
                </div>
                <div className="absolute inset-0 -inset-x-6 -inset-y-3 rounded-full bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl" />
              </div>
              <p
                className="text-[10px] font-mono uppercase tracking-[0.25em] mt-4"
                style={{ color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)' }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div ref={timelineRef}>
          <div className="flex items-center gap-4 mb-10">
            <div className="w-10 h-[1px]" style={{ background: accentColor, opacity: 0.35 }} />
            <span className="text-[10px] font-mono tracking-[0.35em] uppercase" style={{ color: accentColor, opacity: 0.45 }}>
              Timeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {timelineData.map((item, i) => {
              const isHovered = hoveredTimeline === i;
              return (
                <div
                  key={item.year}
                  onMouseEnter={() => setHoveredTimeline(i)}
                  onMouseLeave={() => setHoveredTimeline(null)}
                  className={`relative rounded-xl p-7 transition-all duration-600 cursor-default border ${
                    isHovered
                      ? 'bg-white/[0.06] border-white/[0.15] scale-105'
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                  }`}
                >
                  <div
                    className="font-display font-bold tracking-tighter leading-none mb-4 transition-all duration-600"
                    style={{
                      fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
                      color: isHovered ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      opacity: isHovered ? 0.85 : 1,
                    }}
                  >
                    {item.year}
                  </div>
                  <h4 className="text-sm font-semibold tracking-tight mb-2 font-display">{item.label}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)' }}>
                    {item.desc}
                  </p>
                  {i < timelineData.length - 1 && (
                    <div className="absolute top-7 -right-2.5 w-5 h-[1px] bg-white/[0.08] hidden lg:block" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={infoGridRef}
          className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-6 mt-18 pt-14 border-t border-white/[0.06]"
        >
          {[
            ['Founded', '2026'],
            ['CEO', '박진욱'],
            ['Location', 'Seoul, Korea'],
            ['Parent', 'DO IT COMPANY'],
            ['Focus', 'HROS · HX Design'],
            ['Philosophy', 'Creatively Rational'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] mb-2" style={{ color: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)' }}>
                {label}
              </p>
              <p className="text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-xl p-7 md:p-9 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-500">
          <div className="flex items-start gap-5">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.08] text-white/45">
              <i className="ri-briefcase-line text-lg" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1.5 font-display">ECHO와 함께할 인재를 찾습니다</p>
              <p className="text-xs leading-relaxed text-white/40">인간 관계의 운영체제를 함께 만들어갈 열정적인 팀원을 모집 중입니다.</p>
            </div>
          </div>
          <a
            href="https://www.linkedin.com/in/jinwookpark-founder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-medium transition-all duration-300 whitespace-nowrap cursor-pointer flex-shrink-0 bg-white text-black hover:bg-white/90 hover:scale-105"
          >
            <i className="ri-linkedin-fill text-sm" />
            LinkedIn에서 보기
          </a>
        </div>
      </div>
    </section>
  );
}