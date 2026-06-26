import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface ThreeEmotionsSectionProps {
  isDarkMode: boolean;
}

const emotions = [
  {
    id: 0,
    color: '#0DC5D6',
    glowColor: 'rgba(13, 197, 214, 0.35)',
    bgGlow: 'rgba(13, 197, 214, 0.06)',
    title: '깨달음',
    subtitle: 'Realization',
    desc: '수천 개의 관계 데이터 속에서, 당신만의 패턴을 발견하는 순간.',
    detail: 'ECHO의 HROS 엔진은 언어, 행동, 감정의 미시적 흐름을 다각도로 분석하여, 당신이 반복하는 관계의 고리를 시각화합니다. 그 순간, 데이터는 단순한 숫자가 아닌 거울이 됩니다.',
    icon: 'ri-search-eye-line',
  },
  {
    id: 1,
    color: '#E8A838',
    glowColor: 'rgba(232, 168, 56, 0.35)',
    bgGlow: 'rgba(232, 168, 56, 0.06)',
    title: '몰입',
    subtitle: 'Immersion',
    desc: '감성과 데이터가 교차하는 깊이, 완전히 빠져드는 경험.',
    detail: '딥러닝이 감정의 비선형적 역학을 해석하고, 개인에게 최적화된 관계 언어를 설계합니다. 당신은 더 이상 관계의 망망대해를 떠도는 것이 아닙니다. 자신의 항로를 알고 항해합니다.',
    icon: 'ri-heart-pulse-line',
  },
  {
    id: 2,
    color: '#E8556A',
    glowColor: 'rgba(232, 85, 106, 0.35)',
    bgGlow: 'rgba(232, 85, 106, 0.06)',
    title: '발견',
    subtitle: 'Discovery',
    desc: '숨겨진 정체성을 발견하고, 진짜 나를 마주하는 여정.',
    detail: 'ECHO 미러 테크놀로지는 관계 데이터 속에서 진정한 자아의 흔적을 찾아냅니다. 데이터 속에서 진짜 당신의 본질을 발견하는 여정을 시작합니다.',
    icon: 'ri-focus-3-line',
  },
];

const floatingObjects = [
  { type: 'ring', size: 180, top: '8%', left: '5%', color: '#0DC5D6', dur: 4, delay: 0, z: -200 },
  { type: 'ring', size: 120, top: '60%', right: '8%', color: '#E8A838', dur: 5, delay: 1.2, z: -100 },
  { type: 'ring', size: 90, top: '25%', left: '75%', color: '#E8556A', dur: 4.5, delay: 0.6, z: -300 },
  { type: 'square', size: 70, top: '70%', left: '15%', color: '#3A8DFF', dur: 5.5, delay: 2, z: -150 },
  { type: 'square', size: 55, top: '15%', left: '40%', color: '#0DC5D6', dur: 4, delay: 1.5, z: -250 },
  { type: 'ring', size: 140, top: '45%', left: '85%', color: '#E8A838', dur: 6, delay: 0.3, z: -180 },
  { type: 'square', size: 85, top: '80%', left: '55%', color: '#E8556A', dur: 4.8, delay: 2.5, z: -120 },
  { type: 'ring', size: 60, top: '10%', right: '25%', color: '#3A8DFF', dur: 5.2, delay: 0.9, z: -280 },
  { type: 'square', size: 45, top: '50%', left: '30%', color: '#0DC5D6', dur: 4.2, delay: 1.8, z: -220 },
  { type: 'ring', size: 110, top: '35%', left: '10%', color: '#E8556A', dur: 5, delay: 3, z: -160 },
  { type: 'square', size: 65, top: '85%', left: '80%', color: '#E8A838', dur: 4.6, delay: 1, z: -140 },
  { type: 'ring', size: 75, top: '5%', left: '65%', color: '#E8556A', dur: 5.8, delay: 2.2, z: -260 },
];

const particles = Array.from({ length: 50 }, (_, i) => ({
  x: `${(i * 17 + 7) % 100}%`,
  y: `${(i * 23 + 13) % 100}%`,
  size: 1 + (i % 4) * 0.8,
  color: i % 3 === 0 ? '#0DC5D6' : i % 3 === 1 ? '#E8A838' : '#E8556A',
  dur: 3 + (i % 8) * 0.4,
  delay: (i * 0.12) % 4,
  opacity: 0.15 + (i % 6) * 0.04,
}));

const streaks = Array.from({ length: 18 }, (_, i) => ({
  x: `${(i * 29 + 5) % 100}%`,
  y: `${(i * 37 + 10) % 100}%`,
  angle: (i * 20) % 360,
  length: 80 + (i % 5) * 40,
  color: i % 3 === 0 ? '#0DC5D6' : i % 3 === 1 ? '#E8A838' : '#E8556A',
  dur: 1.5 + (i % 4) * 0.3,
  delay: (i * 0.2) % 3,
}));

interface Card3DState {
  rotateX: number;
  rotateY: number;
  glowX: number;
  glowY: number;
}

gsap.registerPlugin(ScrollTrigger);

export default function ThreeEmotionsSection({ isDarkMode }: ThreeEmotionsSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [card3D, setCard3D] = useState<Card3DState[]>(
    emotions.map(() => ({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 }))
  );
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [activeCard, setActiveCard] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { y: 80, opacity: 0, scale: 0.95 },
          {
            y: 0, opacity: 1, scale: 1,
            duration: 0.8, ease: 'power4.out',
            scrollTrigger: { trigger: titleRef.current, start: 'top 85%', toggleActions: 'play none none none' },
          }
        );
      }
      if (subRef.current) {
        gsap.fromTo(subRef.current,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 0.6, ease: 'power3.out', delay: 0.12,
            scrollTrigger: { trigger: subRef.current, start: 'top 88%', toggleActions: 'play none none none' },
          }
        );
      }
      if (cardsContainerRef.current) {
        gsap.fromTo(cardsContainerRef.current,
          { y: 100, opacity: 0, scale: 0.92 },
          {
            y: 0, opacity: 1, scale: 1,
            duration: 1.0, ease: 'power4.out', delay: 0.25,
            scrollTrigger: { trigger: cardsContainerRef.current, start: 'top 90%', toggleActions: 'play none none none' },
          }
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
    const rotateY = ((x - centerX) / centerX) * 18;
    const rotateX = ((centerY - y) / centerY) * 18;
    const glowX = (x / rect.width) * 100;
    const glowY = (y / rect.height) * 100;

    setCard3D(prev => prev.map((c, i) =>
      i === index ? { rotateX, rotateY, glowX, glowY } : c
    ));
  };

  const handleCardMouseLeave = (index: number) => {
    setCard3D(prev => prev.map((c, i) =>
      i === index ? { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 } : c
    ));
    setHoveredCard(null);
  };

  return (
    <section
      id="emotions"
      ref={sectionRef}
      className="relative w-full min-h-screen overflow-hidden bg-[#050505]"
      style={{ perspective: '1600px' }}
    >
      {/* 3D Floating Objects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
        {floatingObjects.map((obj, i) => (
          <div
            key={`obj-${i}`}
            className={obj.type === 'ring' ? 'rounded-full border' : 'rounded-sm border rotate-45'}
            style={{
              position: 'absolute',
              top: obj.top,
              left: obj.left,
              right: obj.right,
              width: obj.size,
              height: obj.size,
              borderColor: obj.color,
              borderWidth: '1.5px',
              opacity: 0.18,
              animation: `float-3d-rotate ${obj.dur}s ${obj.delay}s infinite linear`,
              transform: `translateZ(${obj.z}px)`,
              transformStyle: 'preserve-3d',
            }}
          />
        ))}
      </div>

      {/* Speed Streaks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {streaks.map((s, i) => (
          <div
            key={`streak-${i}`}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.length,
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
              opacity: 0.2,
              transform: `rotate(${s.angle}deg)`,
              animation: `streak-dash ${s.dur}s ${s.delay}s infinite ease-out`,
            }}
          />
        ))}
      </div>

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={`pt-${i}`}
            className="rounded-full"
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              background: p.color,
              opacity: p.opacity,
              animation: `float-particle ${p.dur}s ${p.delay}s infinite ease-in-out`,
              boxShadow: `0 0 ${p.size * 4}px ${p.color}40`,
            }}
          />
        ))}
      </div>

      {/* Background Gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(13, 197, 214, 0.04) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 30%, rgba(232, 168, 56, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse 70% 70% at 50% 80%, rgba(232, 85, 106, 0.03) 0%, transparent 55%)
          `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-10 py-32 md:py-44">
        {/* Header */}
        <div className="text-center mb-20 md:mb-28">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-[1px] bg-white/20" />
            <span className="text-[9px] font-mono tracking-[0.5em] uppercase text-white/40">
              Three Emotions
            </span>
            <div className="w-10 h-[1px] bg-white/20" />
          </div>
          <h2
            ref={titleRef}
            className="font-display font-bold tracking-tighter leading-[0.9] text-white mb-6"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)' }}
          >
            당신을 움직이는<br />
            <span className="text-white/25">세 가지 감정</span>
          </h2>
          <p
            ref={subRef}
            className="text-base md:text-lg leading-relaxed max-w-lg mx-auto text-white/35"
            style={{ wordBreak: 'keep-all' }}
          >
            관계의 운영체제 ECHO. 데이터와 감성이 만나는 지점에서,<br />
            당신은 세 가지 감정을 경험합니다.
          </p>
        </div>

        {/* Three Cards */}
        <div
          ref={cardsContainerRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
        >
          {emotions.map((emotion, i) => {
            const state = card3D[i] || { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 };
            const isHovered = hoveredCard === i;
            const isActive = activeCard === i;

            return (
              <div
                key={emotion.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                onMouseMove={(e) => handleCardMouseMove(e, i)}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => handleCardMouseLeave(i)}
                onClick={() => setActiveCard(isActive ? null : i)}
                className="group relative cursor-pointer"
                style={{ perspective: '1200px' }}
              >
                <div
                  className="relative rounded-2xl border overflow-hidden transition-all duration-500"
                  style={{
                    transform: `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg) scale(${isHovered ? 1.03 : 1})`,
                    transition: 'transform 0.08s ease-out, background 0.5s, border-color 0.5s',
                    transformStyle: 'preserve-3d',
                    borderColor: isHovered ? `${emotion.color}40` : 'rgba(255,255,255,0.06)',
                    background: isHovered
                      ? `linear-gradient(135deg, rgba(0,0,0,0.8) 0%, ${emotion.bgGlow} 50%, rgba(0,0,0,0.8) 100%)`
                      : 'rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Radial Glow */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle 350px at ${state.glowX}% ${state.glowY}%, ${emotion.glowColor}, transparent 60%)`,
                    }}
                  />

                  {/* Animated Border */}
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 border-rotate-glow"
                    style={{
                      '--glow-color': `${emotion.color}30`,
                    } as React.CSSProperties}
                  />

                  <div className="relative z-10 p-8 md:p-10">
                    {/* Icon */}
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-7 transition-all duration-500 group-hover:scale-110"
                      style={{
                        background: `${emotion.color}15`,
                        color: emotion.color,
                        boxShadow: isHovered ? `0 0 30px ${emotion.glowColor}` : 'none',
                      }}
                    >
                      <i className={`${emotion.icon} text-2xl`} />
                    </div>

                    {/* Number */}
                    <div
                      className="font-display font-bold tracking-tighter leading-none mb-4"
                      style={{
                        fontSize: 'clamp(3rem, 6vw, 4rem)',
                        color: `${emotion.color}20`,
                      }}
                    >
                      0{i + 1}
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-white mb-1">
                      {emotion.title}
                    </h3>
                    <p className="text-sm font-medium tracking-wider mb-5" style={{ color: emotion.color, opacity: 0.8 }}>
                      {emotion.subtitle}
                    </p>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-white/40 mb-5" style={{ wordBreak: 'keep-all' }}>
                      {emotion.desc}
                    </p>

                    {/* Expanded Detail */}
                    <div
                      className="overflow-hidden transition-all duration-700"
                      style={{
                        maxHeight: isActive ? '300px' : '0px',
                        opacity: isActive ? 1 : 0,
                        transition: 'max-height 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s',
                      }}
                    >
                      <div className="pt-5 border-t border-white/[0.08]">
                        <p className="text-sm leading-relaxed text-white/55 mb-4" style={{ wordBreak: 'keep-all' }}>
                          {emotion.detail}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-[1px]" style={{ background: emotion.color, opacity: 0.4 }} />
                          <span className="text-[10px] font-mono tracking-wider" style={{ color: emotion.color, opacity: 0.6 }}>
                            ECHO HROS Engine
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="mt-6 flex items-center justify-between">
                      <div className="w-10 h-[1px] bg-white/10 transition-all duration-500 group-hover:w-16 group-hover:bg-white/20" />
                      <span className="text-[11px] font-medium tracking-wide text-white/25 group-hover:text-white/50 transition-colors duration-300">
                        {isActive ? '접기' : '더 알아보기'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Link */}
        <div className="mt-20 text-center">
          <a
            href="#section1"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 group whitespace-nowrap cursor-pointer border border-white/10 text-white/30 hover:text-white/70 hover:border-white/20 hover:scale-105"
          >
            ECHO의 미션을 확인하세요
            <i className="ri-arrow-down-line transition-all duration-300 group-hover:translate-y-1" />
          </a>
        </div>
      </div>
    </section>
  );
}