import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ARCHIVE, CATEGORIES, type Category, type Work } from './data';

gsap.registerPlugin(ScrollTrigger);

export default function PortfolioPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);
  const [active, setActive] = useState<Category>('All');
  const [hovered, setHovered] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Work | null>(null);

  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => {
    if (active === 'All') return ARCHIVE;
    return ARCHIVE.filter((w) => w.category === active);
  }, [active]);

  const groupedRows = useMemo(() => {
    if (active === 'All') {
      const rowKeys = Array.from(new Set(filtered.map((w) => w.row)));
      return rowKeys.map((r) => filtered.filter((w) => w.row === r));
    }
    const chunks: Work[][] = [];
    for (let i = 0; i < filtered.length; i += 3) {
      chunks.push(filtered.slice(i, i + 3));
    }
    return chunks;
  }, [filtered, active]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const animEls = sectionRef.current?.querySelectorAll('[data-anim]') ?? [];
      const workEls = sectionRef.current?.querySelectorAll('[data-work]') ?? [];
      if (animEls.length) {
        gsap.fromTo(
          animEls,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.07,
            scrollTrigger: { trigger: sectionRef.current, start: 'top 85%', once: true },
          }
        );
      }
      if (workEls.length) {
        gsap.fromTo(
          workEls,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.06,
            scrollTrigger: { trigger: workEls[0] as Element, start: 'top 90%', once: true },
          }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [active]);

  return (
    <div className={`relative min-h-screen transition-colors duration-700 ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-white text-black'}`}>
      <nav
        className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 md:px-8 py-5 transition-all duration-500 ${
          navScrolled
            ? isDarkMode
              ? 'bg-[#0a0a0a]/85 backdrop-blur-md border-b border-white/5'
              : 'bg-white/85 backdrop-blur-md border-b border-black/5'
            : ''
        }`}
      >
        <Link to="/" className="text-sm font-semibold tracking-[0.25em] uppercase cursor-pointer">
          ECHO
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Mission', href: '/#section1' },
            { label: 'Services', href: '/#services' },
            { label: 'Work', href: '/portfolio' },
            { label: 'Contact', href: '/#contact' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`text-[10px] font-medium tracking-[0.15em] uppercase hover:opacity-50 transition-opacity cursor-pointer ${
                item.href === '/portfolio'
                  ? isDarkMode
                    ? 'text-white'
                    : 'text-black'
                  : isDarkMode
                  ? 'text-white/60'
                  : 'text-black/60'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDarkMode((v) => !v)}
            className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all cursor-pointer ${
              isDarkMode
                ? 'border-white/30 text-white hover:bg-white/10'
                : 'border-black/20 text-black hover:bg-black/5'
            }`}
            aria-label="Toggle theme"
          >
            <i className={`${isDarkMode ? 'ri-sun-line' : 'ri-moon-line'} text-sm`}></i>
          </button>
          <Link
            to="/#contact"
            className={`hidden md:inline-flex items-center rounded-full px-5 py-2 text-xs font-medium hover:scale-105 transition-transform duration-300 whitespace-nowrap cursor-pointer ${
              isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-900'
            }`}
          >
            Get in Touch
          </Link>
        </div>
      </nav>

      <main ref={sectionRef} className="pt-32 md:pt-40 pb-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <header className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-16 md:mb-24">
            <div className="lg:col-span-1 hidden lg:block">
              <span
                data-anim
                className={`block text-[10px] font-mono uppercase tracking-[0.3em] mt-3 [writing-mode:vertical-rl] rotate-180 ${
                  isDarkMode ? 'text-white/40' : 'text-black/40'
                }`}
              >
                Works — 2024 / 2026
              </span>
            </div>
            <div className="lg:col-span-7">
              <Link
                to="/"
                data-anim
                className={`mb-6 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] cursor-pointer transition-opacity hover:opacity-60 ${
                  isDarkMode ? 'text-white/60' : 'text-black/55'
                }`}
              >
                <i className="ri-arrow-left-line"></i>
                Back to home
              </Link>
              <h1
                data-anim
                className="text-[2.75rem] md:text-[5.25rem] lg:text-[6.5rem] leading-[0.9] font-bold tracking-tighter"
                style={{ fontFamily: 'var(--font-heading, sans-serif)' }}
              >
                The <span className="italic font-light">archive</span>
                <span className={isDarkMode ? 'text-white/30' : 'text-black/30'}>.</span>
              </h1>
              <p
                data-anim
                className={`mt-8 max-w-xl text-base md:text-lg leading-relaxed ${
                  isDarkMode ? 'text-white/65' : 'text-black/65'
                }`}
              >
                ECHO의 비주얼 아카이브 — <em className="italic font-normal">HX Design</em>,
                AI 플랫폼, 정체성 발견 기술, 데이터 시각화까지. 모든 프로젝트를 한눈에.
              </p>
            </div>
            <div className="lg:col-span-4 lg:pt-4">
              <div
                data-anim
                className={`grid grid-cols-3 gap-6 pt-6 border-t ${
                  isDarkMode ? 'border-white/10' : 'border-black/10'
                }`}
              >
                {[
                  { k: '15', l: 'Projects' },
                  { k: '05', l: 'Categories' },
                  { k: '03', l: 'Years' },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="text-2xl md:text-3xl font-bold tracking-tighter leading-none">
                      {s.k}
                    </div>
                    <div
                      className={`mt-1.5 text-[10px] font-mono uppercase tracking-[0.25em] ${
                        isDarkMode ? 'text-white/40' : 'text-black/40'
                      }`}
                    >
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
              <p
                data-anim
                className={`mt-8 text-xs font-mono uppercase tracking-[0.22em] ${
                  isDarkMode ? 'text-white/45' : 'text-black/45'
                }`}
              >
                Studio · Seoul, Korea
              </p>
              <p
                data-anim
                className={`mt-2 text-xs font-mono uppercase tracking-[0.22em] ${
                  isDarkMode ? 'text-white/45' : 'text-black/45'
                }`}
              >
                Parent · DO IT COMPANY
              </p>
            </div>
          </header>

          <div
            data-anim
            className={`mb-12 md:mb-16 flex flex-wrap items-center gap-2 pb-5 border-b ${
              isDarkMode ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <span
              className={`mr-3 text-[10px] font-mono uppercase tracking-[0.3em] ${
                isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}
            >
              Filter —
            </span>
            {CATEGORIES.map((cat) => {
              const isActive = active === cat;
              const count =
                cat === 'All' ? ARCHIVE.length : ARCHIVE.filter((w) => w.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActive(cat)}
                  className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? isDarkMode
                        ? 'bg-white text-black'
                        : 'bg-black text-white'
                      : isDarkMode
                      ? 'text-white/70 hover:text-white border border-white/15 hover:border-white/35'
                      : 'text-black/70 hover:text-black border border-black/15 hover:border-black/35'
                  }`}
                >
                  {cat}
                  <span
                    className={`text-[10px] font-mono ${
                      isActive ? 'opacity-60' : 'opacity-40'
                    }`}
                  >
                    {String(count).padStart(2, '0')}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div
              className={`py-32 text-center ${
                isDarkMode ? 'text-white/50' : 'text-black/50'
              }`}
            >
              No projects in this category yet.
            </div>
          ) : (
            <div
              className="space-y-12 md:space-y-16"
              onMouseLeave={() => setHovered(null)}
            >
              {groupedRows.map((row, rowIdx) => (
                <div
                  key={`row-${rowIdx}-${active}`}
                  className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6"
                >
                  {row.map((work) => {
                    const isDim = hovered !== null && hovered !== work.id;
                    const isHovered = hovered === work.id;
                    const spanClass = active === 'All' ? work.span : 'md:col-span-4';
                    return (
                      <figure
                        key={work.id}
                        data-work
                        onMouseEnter={() => setHovered(work.id)}
                        className={`group relative ${spanClass} transition-all duration-700 ease-out ${
                          isDim ? 'opacity-40 scale-[0.985]' : 'opacity-100 scale-100'
                        }`}
                      >
                        <button
                          onClick={() => setLightbox(work)}
                          className={`relative block w-full ${work.aspect} overflow-hidden cursor-pointer ${
                            isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#e8e8e8]'
                          }`}
                          aria-label={`Open ${work.title}`}
                        >
                          <img
                            src={work.src}
                            alt={`${work.title} — ${work.meta}`}
                            title={`${work.title} — ECHO project`}
                            loading={rowIdx < 1 ? 'eager' : 'lazy'}
                            className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-[1400ms] ease-out ${
                              isHovered ? 'scale-[1.05]' : 'scale-100'
                            }`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/30 pointer-events-none" />
                          <span
                            className={`absolute top-3 left-3 px-2 py-1 text-[10px] font-mono tracking-[0.25em] backdrop-blur-md transition-all duration-500 ${
                              isDarkMode ? 'bg-black/40 text-white/80' : 'bg-white/60 text-black/75'
                            }`}
                          >
                            N° {work.num}
                          </span>
                          <div
                            className={`absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white text-black transition-all duration-500 ${
                              isHovered
                                ? 'opacity-100 translate-x-0 translate-y-0'
                                : 'opacity-0 translate-x-1 translate-y-1'
                            }`}
                          >
                            <i className="ri-fullscreen-line text-sm"></i>
                          </div>
                        </button>
                        <figcaption className="pt-4 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base md:text-lg font-semibold tracking-tight leading-tight">
                              {work.title}
                              <span
                                className={`italic font-light ml-1.5 ${
                                  isDarkMode ? 'text-white/55' : 'text-black/50'
                                }`}
                              >
                                — {work.accent}
                              </span>
                            </h3>
                            <p
                              className={`mt-1.5 text-[11px] font-mono uppercase tracking-[0.22em] ${
                                isDarkMode ? 'text-white/45' : 'text-black/45'
                              }`}
                            >
                              {work.meta}
                            </p>
                          </div>
                          <span
                            className={`text-[11px] font-mono tracking-[0.2em] pt-1 shrink-0 ${
                              isDarkMode ? 'text-white/40' : 'text-black/40'
                            }`}
                          >
                            {work.year}
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <div
            className={`mt-28 md:mt-36 pt-12 border-t flex flex-col md:flex-row items-start md:items-end justify-between gap-8 ${
              isDarkMode ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <div className="max-w-xl">
              <span
                className={`block mb-3 text-[10px] font-mono uppercase tracking-[0.25em] ${
                  isDarkMode ? 'text-white/45' : 'text-black/45'
                }`}
              >
                End of archive — for now
              </span>
              <p
                className={`text-lg md:text-2xl leading-snug tracking-tight ${
                  isDarkMode ? 'text-white/85' : 'text-black/85'
                }`}
              >
                새로운 프로젝트가 계속 추가됩니다. <br className="hidden md:block" />
                <em className="italic font-light">곧 다시 찾아와주세요.</em>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                to="/#contact"
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium hover:scale-105 transition-transform duration-300 whitespace-nowrap cursor-pointer ${
                  isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-900'
                }`}
              >
                Get in Touch
                <i className="ri-arrow-right-line"></i>
              </Link>
              <Link
                to="/"
                className={`inline-flex items-center gap-2 text-sm font-medium cursor-pointer transition-opacity hover:opacity-70 ${
                  isDarkMode ? 'text-white/70' : 'text-black/70'
                }`}
              >
                <i className="ri-arrow-left-line"></i>
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-10"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
          <div
            className="relative max-w-5xl w-full max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <img
                src={lightbox.src}
                alt={`${lightbox.title} — ${lightbox.meta}`}
                className="block w-full h-full object-contain max-h-[78vh]"
              />
            </div>
            <div className="pt-5 flex items-start justify-between gap-6 text-white">
              <div>
                <h4 className="text-lg md:text-xl font-semibold tracking-tight">
                  {lightbox.title}
                  <span className="italic font-light text-white/55 ml-1.5">
                    — {lightbox.accent}
                  </span>
                </h4>
                <p className="mt-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-white/50">
                  {lightbox.meta}
                </p>
              </div>
              <span className="text-[11px] font-mono tracking-[0.2em] text-white/40 pt-1.5 shrink-0">
                N° {lightbox.num} · {lightbox.year}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}