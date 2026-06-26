import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Section5Props {
  isDarkMode: boolean;
}

const projects = [
  {
    title: '관계 패턴\n시각화 엔진',
    category: 'HROS Core',
    desc: '수천 개의 관계 데이터 포인트를 실시간으로 분석하여 개인의 반복되는 관계 패턴을 직관적인 비주얼 언어로 변환합니다.',
    tags: ['데이터 시각화', '그래프 엔진', '실시간 렌더링'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Abstract%20dark%20minimalist%20data%20visualization%20with%20interconnected%20nodes%20and%20glowing%20platinum%20silver%20lines%20on%20deep%20charcoal%20background%20elegant%20geometric%20network%20patterns%20silver%20and%20warm%20white%20connections%20beautiful%20information%20design%20editorial%20quality%20cinematic%20soft%20lighting%20clean%20aesthetic&width=1200&height=800&seq=project-showcase-01-v3&orientation=landscape',
  },
  {
    title: '감정 트래킹\n대시보드',
    category: 'Experience Design',
    desc: '사용자가 자신의 감정 흐름을 추적하고 이해할 수 있는 인터랙티브 대시보드입니다.',
    tags: ['UX/UI 디자인', '감정 분석', '인터랙티브'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Clean%20minimalist%20dashboard%20interface%20showing%20emotional%20data%20tracking%20with%20soft%20platinum%20silver%20accent%20charts%20on%20dark%20background%20sleek%20modern%20UI%20design%20elegant%20data%20visualization%20abstract%20flowing%20lines%20warm%20atmospheric%20tones%20editorial%20quality&width=1200&height=800&seq=project-showcase-02-v3&orientation=landscape',
  },
  {
    title: 'AI 관계\n코칭 플랫폼',
    category: 'AI Platform',
    desc: 'HROS 엔진과 LLM을 결합한 24시간 AI 관계 코칭 서비스입니다.',
    tags: ['AI/LLM', '실시간 코칭', '개인화'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Abstract%20warm%20platinum%20silver%20glowing%20AI%20chat%20interface%20on%20dark%20background%20elegant%20minimal%20design%20human%20centered%20technology%20with%20soft%20light%20particles%20floating%20atmospheric%20cinematic%20mood%20sophisticated%20contemporary%20aesthetic&width=1200&height=800&seq=project-showcase-03-v3&orientation=landscape',
  },
  {
    title: '정체성 발견\n미러 시스템',
    category: 'Identity Tech',
    desc: 'ECHO 미러 테크놀로지를 통해 사용자의 과거 관계 데이터에서 진정한 자아의 흔적을 발견합니다.',
    tags: ['미러 테크놀로지', '자아 분석', '데이터 복원'],
    imageUrl: 'https://readdy.ai/api/search-image?query=Abstract%20mirror%20reflection%20concept%20with%20fragmented%20geometric%20shapes%20reassembling%20in%20platinum%20silver%20tones%20on%20deep%20dark%20background%20ethereal%20light%20particles%20through%20translucent%20surfaces%20elegant%20minimalist%20composition%20cinematic%20atmosphere&width=1200&height=800&seq=project-showcase-04-v3&orientation=landscape',
  },
];

gsap.registerPlugin(ScrollTrigger);

export default function Section5({ isDarkMode }: Section5Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);

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
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    setScrollProgress(progress);
    const idx = Math.min(Math.round(progress * (projects.length - 1)), projects.length - 1);
    setActiveProjectIndex(idx);
  };

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, scrollLeft: scrollContainerRef.current.scrollLeft };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    scrollContainerRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
  };

  const handleMouseUp = () => setIsDragging(false);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.035 : 0.022;

  return (
    <section
      id="work"
      ref={sectionRef}
      className={`relative w-full py-36 md:py-52 overflow-hidden ${isDarkMode ? 'bg-[#080808] text-white' : 'bg-[#f3f3f3] text-black'}`}
    >
      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(7rem, 16vw, 24rem)',
            color: isDarkMode ? `rgba(255,255,255,${bgTextOpacity})` : `rgba(0,0,0,${bgTextOpacity})`,
            textShadow: isDarkMode ? '0 0 140px rgba(255,255,255,0.02)' : '0 0 140px rgba(0,0,0,0.01)',
          }}
        >
          PROJECTS
        </div>
      </div>

      <div className="max-w-full w-full relative z-10">
        <div className="max-w-7xl mx-auto w-full px-6 md:px-10 mb-14 md:mb-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-[1px]" style={{ background: accentColor, opacity: 0.5 }} />
            <span className="text-[10px] font-mono tracking-[0.5em] uppercase" style={{ color: accentColor, opacity: 0.7 }}>
              Selected Work
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <h2
              ref={titleRef}
              className="font-display font-bold tracking-tighter leading-[0.92]"
              style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}
            >
              Projects
            </h2>
            <div className="flex items-center gap-5">
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/18 hidden lg:inline">
                ← Drag or scroll →
              </span>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2.5 text-sm font-medium tracking-tight transition-all duration-300 group cursor-pointer whitespace-nowrap text-white/45 hover:text-white/80"
              >
                View All
                <i className="ri-arrow-right-line text-sm transition-all duration-300 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="max-w-7xl mx-auto w-full px-6 md:px-10 mb-16 md:mb-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { value: '15+', label: '완료 프로젝트', icon: 'ri-stack-line' },
              { value: '98%', label: '클라이언트 만족도', icon: 'ri-heart-line' },
              { value: '03', label: '운영 연차', icon: 'ri-calendar-line' },
              { value: '24/7', label: 'AI 코칭 가용성', icon: 'ri-timer-flash-line' },
            ].map((stat) => (
              <div key={stat.label} className="text-center group">
                <i className={`${stat.icon} text-2xl md:text-3xl mb-3 block transition-all duration-300 group-hover:scale-110 ${isDarkMode ? 'text-[#D4D4D4]/40' : 'text-[#3D3D3D]/40'}`} />
                <div className="font-display font-bold tracking-tighter leading-none mb-1.5" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: accentColor }}>
                  {stat.value}
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-[0.25em] ${isDarkMode ? 'text-white/25' : 'text-black/25'}`}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex gap-7 md:gap-10 overflow-x-auto px-6 md:px-10 pb-8 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {projects.map((project, i) => {
            const isHovered = hoveredProject === i;
            const titleLines = project.title.split('\n');

            return (
              <div
                key={project.title}
                onMouseEnter={() => setHoveredProject(i)}
                onMouseLeave={() => setHoveredProject(null)}
                className="flex-shrink-0 cursor-pointer group/card"
                style={{
                  width: 'clamp(340px, 62vw, 750px)',
                  scrollSnapAlign: 'start',
                }}
              >
                <div className="relative rounded-xl overflow-hidden mb-5 transition-all duration-800">
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      className={`w-full h-full object-cover transition-all duration-900 ${
                        isHovered ? 'scale-[1.08] brightness-[1.15]' : 'scale-100'
                      }`}
                      style={{ transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1), filter 0.6s' }}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  </div>

                  <div
                    className={`absolute inset-0 flex items-end p-7 md:p-10 transition-all duration-600 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="w-full">
                      <p className="text-sm md:text-base leading-relaxed mb-4 text-white/85 max-w-lg">{project.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-3 py-1.5 rounded-full border border-white/18 text-white/70 bg-white/[0.08]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-1">
                  <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/28 mb-2 block">
                    {project.category}
                    <span className="ml-2 opacity-40">— {String(i + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span>
                  </span>
                  <h3 className="font-display font-semibold tracking-tight leading-[1.15] text-xl md:text-2xl lg:text-3xl">
                    {titleLines.map((line, li) => (
                      <span key={li}>
                        {line}
                        {li < titleLines.length - 1 && <br />}
                      </span>
                    ))}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-7xl mx-auto w-full px-6 md:px-10 mt-8">
          <div className="h-[1px] bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${scrollProgress * 100}%`,
                background: accentColor,
                opacity: 0.45,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[9px] font-mono text-white/18">PROJECTS</span>
            <span className="text-[9px] font-mono text-white/18">
              {Math.round(scrollProgress * projects.length)} / {projects.length}
            </span>
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="max-w-7xl mx-auto w-full px-6 md:px-10 mt-20 md:mt-28">
          <div className={`relative rounded-2xl overflow-hidden p-10 md:p-16 border ${isDarkMode ? 'border-white/[0.06] bg-white/[0.015]' : 'border-black/[0.06] bg-black/[0.01]'}`}>
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{
              background: `radial-gradient(ellipse 70% 50% at 30% 50%, ${accentColor}08, transparent 60%), radial-gradient(ellipse 50% 40% at 70% 50%, ${accentColor}05, transparent 50%)`,
            }} />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="max-w-lg">
                <span className={`text-[10px] font-mono uppercase tracking-[0.35em] mb-3 block ${isDarkMode ? 'text-[#D4D4D4]/50' : 'text-[#3D3D3D]/50'}`}>
                  Ready to explore
                </span>
                <h3 className="font-display font-bold tracking-tight leading-[1.05] text-2xl md:text-3xl lg:text-4xl mb-3">
                  당신의 프로젝트를<br />
                  <span className="italic font-light opacity-50">이야기해주세요</span>
                </h3>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/35' : 'text-black/35'}`}>
                  지금까지 15개 이상의 프로젝트에서 검증된 ECHO의 방법론으로, 당신만의 이야기를 새로운 차원으로 끌어올립니다.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/portfolio"
                  className={`inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer ${
                    isDarkMode ? 'bg-white/[0.06] text-white/80 hover:bg-white/[0.12] border border-white/[0.08]' : 'bg-black/[0.04] text-black/70 hover:bg-black/[0.08] border border-black/[0.06]'
                  }`}
                >
                  전체 포트폴리오
                  <i className="ri-arrow-right-line" />
                </Link>
                <Link
                  to="/#contact"
                  className={`inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer ${
                    isDarkMode ? 'bg-[#D4D4D4] text-[#0a0a0a] hover:bg-[#E8E8E8]' : 'bg-[#3D3D3D] text-white hover:bg-[#2D2D2D]'
                  }`}
                >
                  문의하기
                  <i className="ri-mail-send-line" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}