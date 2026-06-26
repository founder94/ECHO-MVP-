import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface DataSpeaksSectionProps {
  isDarkMode: boolean;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  onAIClick: () => void;
}

interface Card3DState {
  rotateX: number;
  rotateY: number;
  glowX: number;
  glowY: number;
}

// Pastel Color Palette — Soft, glossy, twinkling
const PASTEL = {
  gold: '#F5D4A1',
  cyan: '#7DD8E4',
  pink: '#F2A2B1',
  lavender: '#C9A0DC',
  mint: '#98D4C8',
  coral: '#F2B6A6',
  peach: '#F4C8A5',
  sky: '#A8D0F0',
  rose: '#E8B0C0',
  lemon: '#F0E8A0',
};

const colorKeys = Object.values(PASTEL);
const getGlowColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
};
const getBgGlow = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.04)`;
};

const headlineStats = [
  {
    value: '3개월',
    label: '실제 검증 완료',
    sublabel: 'Real-World Validation',
    color: PASTEL.gold,
    icon: 'ri-timer-flash-line',
    description: 'ECHO 플랫폼이 실제 관계 경험자들과 함께 진행한 3개월의 현장 검증 기간',
  },
  {
    value: '100+',
    label: '심층 데이터 확보',
    sublabel: 'Deep Data Collection',
    color: PASTEL.cyan,
    icon: 'ri-database-2-line',
    description: '다양한 관계 유형과 감정 스펙트럼에서 수집한 100건 이상의 정제된 데이터',
  },
  {
    value: '20+',
    label: '문서화 사례',
    sublabel: 'Documented Cases',
    color: PASTEL.pink,
    icon: 'ri-file-list-3-line',
    description: '패턴 추출과 인사이트 도출이 완료된 20건 이상의 전략적 사례 연구',
  },
];

const percentageStats = [
  { value: '95%', label: '감정 정리 미완료', color: PASTEL.gold, icon: 'ri-emotion-line', description: '관계의 전환 이후에도 감정을 정리하지 못한 경험' },
  { value: '94%', label: '자기 이해 부족', color: PASTEL.pink, icon: 'ri-user-search-line', description: '관계에 몰입하다 내가 누구인지 잊은 경험' },
  { value: '92%', label: '반복 패턴 지속', color: PASTEL.cyan, icon: 'ri-loop-left-line', description: '비슷한 유형의 관계를 반복하는 경험' },
  { value: '90%', label: '감정 잔존', color: PASTEL.gold, icon: 'ri-heart-2-line', description: '전환 이후에도 감정이 남아있는 경험' },
  { value: '88%', label: '미전달 감정 아쉬움', color: PASTEL.pink, icon: 'ri-chat-off-line', description: '전하지 못한 말로 인한 아쉬움 경험' },
  { value: '82%', label: '인사이트 필요성', color: PASTEL.cyan, icon: 'ri-thumb-up-line', description: '데이터 기반 자기이해 서비스의 필요성 인식' },
  { value: '73%', label: '자기 공감 갈망', color: PASTEL.gold, icon: 'ri-user-heart-line', description: '관계 속 자신의 감정을 이해해달라는 바람' },
  { value: '68%', label: '유사 공감 경험', color: PASTEL.pink, icon: 'ri-group-line', description: '비슷한 경험을 한 사람들의 이야기에 공감' },
];

const floatingObjects = [
  { type: 'ring', size: 220, top: '3%', left: '2%', color: PASTEL.gold, dur: 2, delay: 0, z: -300 },
  { type: 'ring', size: 160, top: '58%', right: '3%', color: PASTEL.cyan, dur: 2.3, delay: 0.6, z: -200 },
  { type: 'ring', size: 120, top: '25%', left: '80%', color: PASTEL.pink, dur: 1.8, delay: 0.33, z: -250 },
  { type: 'square', size: 90, top: '78%', left: '10%', color: PASTEL.lavender, dur: 2.2, delay: 0.83, z: -180 },
  { type: 'square', size: 70, top: '10%', left: '42%', color: PASTEL.mint, dur: 1.7, delay: 0.4, z: -220 },
  { type: 'ring', size: 180, top: '42%', left: '85%', color: PASTEL.coral, dur: 2.7, delay: 0.17, z: -150 },
  { type: 'square', size: 60, top: '88%', left: '58%', color: PASTEL.peach, dur: 1.9, delay: 1.07, z: -140 },
  { type: 'ring', size: 80, top: '5%', right: '18%', color: PASTEL.sky, dur: 2.1, delay: 0.67, z: -280 },
  { type: 'square', size: 100, top: '52%', left: '32%', color: PASTEL.gold, dur: 2.4, delay: 0.27, z: -190 },
  { type: 'ring', size: 55, top: '68%', left: '42%', color: PASTEL.cyan, dur: 1.73, delay: 1, z: -260 },
  { type: 'square', size: 130, top: '18%', right: '10%', color: PASTEL.pink, dur: 2.27, delay: 0.5, z: -170 },
  { type: 'ring', size: 150, top: '72%', left: '3%', color: PASTEL.lavender, dur: 2.5, delay: 0.1, z: -210 },
  { type: 'square', size: 45, top: '35%', left: '55%', color: PASTEL.mint, dur: 1.6, delay: 0.93, z: -240 },
  { type: 'ring', size: 110, top: '15%', left: '65%', color: PASTEL.coral, dur: 1.83, delay: 0.2, z: -200 },
  { type: 'square', size: 75, top: '85%', right: '25%', color: PASTEL.peach, dur: 2, delay: 0.6, z: -170 },
  { type: 'ring', size: 95, top: '45%', left: '15%', color: PASTEL.sky, dur: 1.93, delay: 0.73, z: -230 },
];

const particles = Array.from({ length: 50 }, (_, i) => {
  const color = colorKeys[i % colorKeys.length];
  return {
    x: `${(i * 17 + 13) % 100}%`,
    y: `${(i * 23 + 7) % 100}%`,
    size: 1.5 + (i % 5) * 0.8,
    color,
    dur: 0.83 + (i % 7) * 0.13,
    delay: (i * 0.04) % 1.3,
    twinkleDur: 0.5 + (i % 5) * 0.2,
    twinkleDelay: (i * 0.07) % 1,
  };
});

const starBursts = Array.from({ length: 12 }, (_, i) => ({
  x: `${(i * 31 + 5) % 100}%`,
  y: `${(i * 29 + 11) % 100}%`,
  size: 3 + (i % 4) * 2,
  color: colorKeys[i % colorKeys.length],
  dur: 0.67 + (i % 4) * 0.17,
  delay: (i * 0.1) % 1.3,
}));

const speedLines = Array.from({ length: 16 }, (_, i) => ({
  x: `${(i * 37 + 8) % 100}%`,
  y: `${(i * 41 + 3) % 100}%`,
  angle: (i * 22) % 360,
  length: 60 + (i % 6) * 35,
  color: colorKeys[i % colorKeys.length],
  dur: 0.4 + (i % 3) * 0.1,
  delay: (i * 0.06) % 1,
}));

gsap.registerPlugin(ScrollTrigger);

export default function DataSpeaksSection({ isDarkMode, isAuthenticated, onAuthRequired, onAIClick }: DataSpeaksSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const headlineCardsRef = useRef<HTMLDivElement>(null);
  const percentageGridRef = useRef<HTMLDivElement>(null);
  const headlineCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pctCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [headline3D, setHeadline3D] = useState<Card3DState[]>(
    headlineStats.map(() => ({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 })),
  );
  const [pct3D, setPct3D] = useState<Card3DState[]>(
    percentageStats.map(() => ({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 })),
  );
  const [hoveredHeadline, setHoveredHeadline] = useState<number | null>(null);
  const [hoveredPct, setHoveredPct] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { y: 80, opacity: 0, scale: 0.94 },
          {
            y: 0, opacity: 1, scale: 1, duration: 0.27, ease: 'power4.out',
            scrollTrigger: { trigger: titleRef.current, start: 'top 85%', toggleActions: 'play none none none' },
          },
        );
      }
      if (subtitleRef.current) {
        gsap.fromTo(subtitleRef.current,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.2, ease: 'power3.out', delay: 0.03,
            scrollTrigger: { trigger: subtitleRef.current, start: 'top 88%', toggleActions: 'play none none none' },
          },
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  useEffect(() => {
    if (!headlineCardsRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(headlineCardsRef.current!.children,
        { y: 120, opacity: 0, scale: 0.88 },
        {
          y: 0, opacity: 1, scale: 1, duration: 0.3, stagger: 0.04, ease: 'power4.out',
          scrollTrigger: { trigger: headlineCardsRef.current, start: 'top 88%', toggleActions: 'play none none none' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  useEffect(() => {
    if (!percentageGridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(percentageGridRef.current!.children,
        { y: 80, opacity: 0, scale: 0.92 },
        {
          y: 0, opacity: 1, scale: 1, duration: 0.23, stagger: 0.017, ease: 'power3.out',
          scrollTrigger: { trigger: percentageGridRef.current, start: 'top 92%', toggleActions: 'play none none none' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const handleHeadlineMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = headlineCardRefs.current[index];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 14;
    const rotateX = ((centerY - y) / centerY) * 14;
    const glowX = (x / rect.width) * 100;
    const glowY = (y / rect.height) * 100;
    setHeadline3D((prev) => prev.map((c, i) =>
      i === index ? { rotateX, rotateY, glowX, glowY } : c,
    ));
  };

  const handleHeadlineMouseLeave = (index: number) => {
    setHeadline3D((prev) => prev.map((c, i) =>
      i === index ? { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 } : c,
    ));
    setHoveredHeadline(null);
  };

  const handlePctMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = pctCardRefs.current[index];
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
    setPct3D((prev) => prev.map((c, i) =>
      i === index ? { rotateX, rotateY, glowX, glowY } : c,
    ));
  };

  const handlePctMouseLeave = (index: number) => {
    setPct3D((prev) => prev.map((c, i) =>
      i === index ? { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 } : c,
    ));
    setHoveredPct(null);
  };

  const handleCTAClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isAuthenticated) {
      e.preventDefault();
      onAuthRequired();
      return;
    }
    // Authenticated — let the default anchor behavior handle the #contact scroll
  };

  const bg = isDarkMode ? 'bg-[#050505]' : 'bg-[#f8f8f8]';

  return (
    <section
      id="data-speaks"
      ref={sectionRef}
      className={`relative w-full overflow-hidden ${bg}`}
      style={{ perspective: '1600px' }}
    >
      {/* Floating 3D Rings & Squares */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
        {floatingObjects.map((obj, i) => (
          <div
            key={`ds-obj-${i}`}
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
              opacity: isDarkMode ? 0.18 : 0.1,
              boxShadow: `0 0 ${obj.size / 3}px ${obj.color}15`,
              animation: `ds-float-spin ${obj.dur}s ${obj.delay}s infinite linear`,
              transform: `translateZ(${obj.z}px)`,
              transformStyle: 'preserve-3d',
            }}
          />
        ))}
      </div>

      {/* Twinkling Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={`ds-pt-${i}`}
            className="rounded-full"
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              background: p.color,
              opacity: isDarkMode ? 0.3 : 0.18,
              animation: `ds-particle-drift ${p.dur}s ${p.delay}s infinite ease-in-out, ds-twinkle ${p.twinkleDur}s ${p.twinkleDelay}s infinite ease-in-out`,
              boxShadow: `0 0 ${p.size * 6}px ${p.color}40, 0 0 ${p.size * 12}px ${p.color}20`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>

      {/* Star Bursts */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {starBursts.map((s, i) => (
          <div
            key={`ds-burst-${i}`}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
              borderRadius: '50%',
              animation: `ds-star-burst ${s.dur}s ${s.delay}s infinite ease-out`,
              opacity: 0.4,
              boxShadow: `0 0 ${s.size * 4}px ${s.color}50`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>

      {/* Speed Lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {speedLines.map((s, i) => (
          <div
            key={`ds-line-${i}`}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.length,
              height: '1.5px',
              background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
              opacity: 0.2,
              transform: `rotate(${s.angle}deg)`,
              animation: `ds-speed-line ${s.dur}s ${s.delay}s infinite ease-out`,
              boxShadow: `0 0 6px ${s.color}40`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>

      {/* Background Gradients — Pastel cosmic glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDarkMode
            ? `
              radial-gradient(ellipse 80% 60% at 25% 20%, ${PASTEL.gold}08 0%, transparent 55%),
              radial-gradient(ellipse 60% 50% at 75% 55%, ${PASTEL.cyan}08 0%, transparent 50%),
              radial-gradient(ellipse 70% 70% at 50% 85%, ${PASTEL.pink}06 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 15% 70%, ${PASTEL.lavender}05 0%, transparent 50%),
              radial-gradient(ellipse 55% 45% at 85% 15%, ${PASTEL.mint}05 0%, transparent 50%)
            `
            : `
              radial-gradient(ellipse 80% 60% at 25% 20%, ${PASTEL.gold}10 0%, transparent 55%),
              radial-gradient(ellipse 60% 50% at 75% 55%, ${PASTEL.cyan}10 0%, transparent 50%),
              radial-gradient(ellipse 70% 70% at 50% 85%, ${PASTEL.pink}08 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 15% 70%, ${PASTEL.lavender}06 0%, transparent 50%),
              radial-gradient(ellipse 55% 45% at 85% 15%, ${PASTEL.mint}06 0%, transparent 50%)
            `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDarkMode
            ? 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.65) 100%)'
            : 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.05) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-10 py-28 md:py-40">
        {/* Header */}
        <div className="text-center mb-16 md:mb-22">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`w-12 h-[1px] ${isDarkMode ? 'bg-white/15' : 'bg-black/10'}`} />
            <span className={`text-[9px] font-mono tracking-[0.5em] uppercase ${isDarkMode ? 'text-white/35' : 'text-black/30'}`}>
              Data
            </span>
            <div className={`w-12 h-[1px] ${isDarkMode ? 'bg-white/15' : 'bg-black/10'}`} />
          </div>
          <h2
            ref={titleRef}
            className={`font-display font-bold tracking-tighter leading-[0.9] mb-5 ${isDarkMode ? 'text-white' : 'text-black'}`}
            style={{ fontSize: 'clamp(2.8rem, 7vw, 6rem)' }}
          >
            데이터가 말한다
          </h2>
          <p
            ref={subtitleRef}
            className={`text-base md:text-lg tracking-widest uppercase font-medium ${isDarkMode ? 'text-white/25' : 'text-black/20'}`}
          >
            The Data Speaks
          </p>
        </div>

        {/* Headline Stats */}
        <div
          ref={headlineCardsRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-20 md:mb-24"
        >
          {headlineStats.map((stat, i) => {
            const state = headline3D[i] || { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 };
            const isHovered = hoveredHeadline === i;
            const glowC = getGlowColor(stat.color);
            const bgGlowC = getBgGlow(stat.color);

            return (
              <div
                key={stat.value}
                ref={(el) => { headlineCardRefs.current[i] = el; }}
                onMouseMove={(e) => handleHeadlineMouseMove(e, i)}
                onMouseEnter={() => setHoveredHeadline(i)}
                onMouseLeave={() => handleHeadlineMouseLeave(i)}
                className="group relative cursor-default"
                style={{ perspective: '1000px' }}
              >
                <div
                  className="relative rounded-2xl overflow-hidden transition-all duration-75"
                  style={{
                    transform: `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg) scale(${isHovered ? 1.04 : 1})`,
                    transition: 'transform 0.08s ease-out, background 0.5s, border-color 0.5s',
                    transformStyle: 'preserve-3d',
                    borderColor: isHovered ? `${stat.color}55` : isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
                    borderWidth: '1px',
                    background: isHovered
                      ? `linear-gradient(145deg, ${isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)'} 0%, ${bgGlowC} 50%, ${isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)'} 100%)`
                      : isDarkMode
                        ? 'rgba(0,0,0,0.55)'
                        : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {/* Radial Glow on hover */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle 380px at ${state.glowX}% ${state.glowY}%, ${glowC}, transparent 55%)`,
                    }}
                  />

                  {/* Glowing border ring */}
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-600 ds-border-glow"
                    style={{
                      '--ds-glow': `${stat.color}45`,
                    } as React.CSSProperties}
                  />

                  <div className="relative z-10 p-8 md:p-10 text-center">
                    {/* Icon */}
                    <div
                      className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110"
                      style={{
                        background: `${stat.color}15`,
                        color: stat.color,
                        boxShadow: isHovered ? `0 0 50px ${glowC}` : 'none',
                      }}
                    >
                      <i className={`${stat.icon} text-2xl`} />
                    </div>

                    {/* Value */}
                    <div
                      className="font-display font-bold tracking-tighter leading-none mb-3 transition-transform duration-500 group-hover:scale-110"
                      style={{
                        fontSize: 'clamp(3.5rem, 6vw, 5rem)',
                        color: stat.color,
                        textShadow: isHovered ? `0 0 80px ${glowC}` : 'none',
                        transition: 'text-shadow 0.4s ease, transform 0.5s ease',
                      }}
                    >
                      {stat.value}
                    </div>

                    {/* Label */}
                    <h3 className={`text-lg md:text-xl font-bold tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      {stat.label}
                    </h3>
                    <p className={`text-[11px] font-mono tracking-[0.2em] uppercase mb-5 ${isDarkMode ? 'text-white/20' : 'text-black/20'}`}>
                      {stat.sublabel}
                    </p>

                    {/* Description */}
                    <p
                      className={`text-sm leading-relaxed transition-all duration-500 ${isDarkMode ? 'text-white/35' : 'text-black/35'}`}
                      style={{
                        maxHeight: isHovered ? '80px' : '0px',
                        opacity: isHovered ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s',
                      }}
                    >
                      {stat.description}
                    </p>

                    {/* Bottom Accent */}
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <div
                        className="w-6 h-[1px] rounded-full transition-all duration-500 group-hover:w-12"
                        style={{ background: stat.color, opacity: isHovered ? 0.5 : 0.2 }}
                      />
                      <div
                        className="w-1 h-1 rounded-full transition-all duration-500"
                        style={{ background: stat.color, opacity: isHovered ? 0.6 : 0.2 }}
                      />
                      <div
                        className="w-6 h-[1px] rounded-full transition-all duration-500 group-hover:w-12"
                        style={{ background: stat.color, opacity: isHovered ? 0.5 : 0.2 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-5 mb-16 md:mb-20">
          <div className={`flex-1 h-[1px] max-w-[120px] ${isDarkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
          <span className={`text-[10px] font-mono tracking-[0.4em] uppercase ${isDarkMode ? 'text-white/20' : 'text-black/15'}`}>
            Research Data
          </span>
          <div className={`flex-1 h-[1px] max-w-[120px] ${isDarkMode ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
        </div>

        {/* Percentage Stats Grid */}
        <div
          ref={percentageGridRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5"
        >
          {percentageStats.map((stat, i) => {
            const state = pct3D[i] || { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 };
            const isHovered = hoveredPct === i;
            const glowC = getGlowColor(stat.color);

            return (
              <div
                key={stat.label}
                ref={(el) => { pctCardRefs.current[i] = el; }}
                onMouseMove={(e) => handlePctMouseMove(e, i)}
                onMouseEnter={() => setHoveredPct(i)}
                onMouseLeave={() => handlePctMouseLeave(i)}
                className="group relative cursor-default"
                style={{ perspective: '800px' }}
              >
                <div
                  className="relative rounded-xl overflow-hidden transition-all duration-75 h-full"
                  style={{
                    transform: `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg) scale(${isHovered ? 1.05 : 1})`,
                    transition: 'transform 0.08s ease-out, background 0.4s, border-color 0.4s',
                    transformStyle: 'preserve-3d',
                    borderColor: isHovered ? `${stat.color}50` : isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    borderWidth: '1px',
                    background: isHovered
                      ? `linear-gradient(145deg, ${isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)'} 0%, ${stat.color}08 50%, ${isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)'} 100%)`
                      : isDarkMode
                        ? 'rgba(0,0,0,0.4)'
                        : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {/* Hover Glow */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                    style={{
                      background: `radial-gradient(circle 200px at ${state.glowX}% ${state.glowY}%, ${stat.color}1a, transparent 50%)`,
                    }}
                  />

                  <div className="relative z-10 p-5 md:p-6">
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-all duration-400 group-hover:scale-110"
                      style={{
                        background: `${stat.color}12`,
                        color: stat.color,
                        boxShadow: isHovered ? `0 0 24px ${glowC}` : 'none',
                      }}
                    >
                      <i className={`${stat.icon} text-lg`} />
                    </div>

                    {/* Value */}
                    <div
                      className="font-display font-bold tracking-tighter leading-none mb-2 transition-transform duration-400 group-hover:scale-105"
                      style={{
                        fontSize: 'clamp(2rem, 4vw, 3rem)',
                        color: stat.color,
                        textShadow: isHovered ? `0 0 50px ${glowC}` : 'none',
                        transition: 'text-shadow 0.4s ease, transform 0.4s ease',
                      }}
                    >
                      {stat.value}
                    </div>

                    {/* Label */}
                    <p className={`text-xs md:text-sm leading-snug ${isDarkMode ? 'text-white/45' : 'text-black/45'} group-hover:${isDarkMode ? 'text-white/70' : 'text-black/65'} transition-colors duration-300`}>
                      {stat.label}
                    </p>

                    {/* Hover Description */}
                    <div
                      className="overflow-hidden transition-all duration-500"
                      style={{
                        maxHeight: isHovered ? '60px' : '0px',
                        opacity: isHovered ? 1 : 0,
                        transition: 'max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s',
                      }}
                    >
                      <p className={`text-[11px] leading-relaxed pt-3 mt-3 border-t ${isDarkMode ? 'text-white/30 border-white/[0.06]' : 'text-black/25 border-black/[0.06]'}`}>
                        {stat.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Source Citation */}
        <div className="mt-16 md:mt-20 text-center">
          <p className={`text-[11px] font-mono tracking-wider ${isDarkMode ? 'text-white/15' : 'text-black/12'}`}>
            * 2026 ECHO HROS Research — N=100+ Relationship Experience Survey
          </p>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center flex flex-col md:flex-row items-center justify-center gap-4">
          <a
            href={isAuthenticated ? '#contact' : undefined}
            onClick={handleCTAClick}
            className={`inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 group whitespace-nowrap cursor-pointer border ${
              isDarkMode
                ? 'border-white/10 text-white/30 hover:text-white/70 hover:border-white/20 hover:scale-105'
                : 'border-black/08 text-black/30 hover:text-black/70 hover:border-black/15 hover:scale-105'
            }`}
          >
            당신의 이야기를 들려주세요
            {!isAuthenticated && (
              <span className="ml-1 text-[9px] font-mono tracking-[0.1em] opacity-50">(회원 전용)</span>
            )}
            <i className="ri-arrow-down-line transition-all duration-300 group-hover:translate-y-1" />
          </a>

          <button
            onClick={(e) => { e.stopPropagation(); onAIClick(); }}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer border border-pink-300/20 text-pink-300/60 hover:text-pink-200 hover:border-pink-300/40 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(242,162,177,0.06), rgba(201,160,220,0.06))',
            }}
          >
            <i className="ri-robot-line text-sm" />
            ECHO AI 탐험하기
            {!isAuthenticated && (
              <span className="ml-1 text-[9px] font-mono tracking-[0.1em] opacity-50">(회원 전용)</span>
            )}
            <i className="ri-arrow-right-line transition-all duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
}