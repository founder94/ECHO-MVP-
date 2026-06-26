import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface ASectionProps {
  isDarkMode: boolean;
}

const DIMENSIONS = [
  { num: '6D', label: '6차원', desc: '미래의 감각 — 시간을 초월한 관계 예측', detail: '시계열 데이터를 6차원 공간에 투영하여 미래의 관계 패턴을 시뮬레이션합니다.' },
  { num: '4D', label: '4차원', desc: '시간의 흐름 — 관계의 진화 추적', detail: '현재의 관계가 과거로부터 어떻게 형성되고 미래로 어떻게 전개될지 4차원 관점에서 분석합니다.' },
  { num: '2D', label: '2차원', desc: '관계의 평면 — 지금 이 순간의 연결', detail: '현재 시점의 관계 네트워크를 2차원 평면에 펼쳐 직관적인 인사이트를 제공합니다.' },
];

const FLOW_STEPS = [
  { step: '01', title: '데이터 수집', desc: '관계 데이터 포인트 수집', icon: 'ri-database-2-line' },
  { step: '02', title: '패턴 분석', desc: '반복되는 구조 식별', icon: 'ri-bubble-chart-line' },
  { step: '03', title: '차원 투영', desc: '다차원 공간에 매핑', icon: 'ri-focus-3-line' },
  { step: '04', title: '인사이트 도출', desc: '실행 가능한 통찰 제공', icon: 'ri-lightbulb-line' },
];

const FLOATING_SHAPES = [
  { top: '8%', left: '5%', size: 70, dur: 20, delay: 0, shape: 'ring' },
  { top: '22%', right: '8%', size: 55, dur: 24, delay: 2, shape: 'square' },
  { top: '55%', left: '8%', size: 45, dur: 18, delay: 4, shape: 'ring' },
  { top: '72%', right: '5%', size: 60, dur: 22, delay: 1, shape: 'square' },
  { top: '38%', left: '85%', size: 35, dur: 26, delay: 3, shape: 'ring' },
  { top: '85%', left: '15%', size: 50, dur: 19, delay: 5, shape: 'square' },
];

gsap.registerPlugin(ScrollTrigger);

export default function ASection({ isDarkMode }: ASectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const aLeftRef = useRef<HTMLDivElement>(null);
  const aRightRef = useRef<HTMLDivElement>(null);
  const aCrossRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const dimsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (aLeftRef.current) {
        gsap.fromTo(aLeftRef.current, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 1.2, ease: 'power4.out', scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none none' } });
      }
      if (aRightRef.current) {
        gsap.fromTo(aRightRef.current, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 1.2, ease: 'power4.out', delay: 0.15, scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none none' } });
      }
      if (aCrossRef.current) {
        gsap.fromTo(aCrossRef.current, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.0, ease: 'power4.out', delay: 0.5, scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none none' } });
      }
      if (titleRef.current) {
        gsap.fromTo(titleRef.current, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', delay: 0.3, scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none none' } });
      }
      if (subRef.current) {
        gsap.fromTo(subRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', delay: 0.5, scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none none' } });
      }
      if (dimsRef.current) {
        gsap.fromTo(dimsRef.current.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.7, scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none none' } });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';

  return (
    <section ref={sectionRef} className="relative w-full py-32 md:py-48 overflow-hidden bg-[#050505]">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {FLOATING_SHAPES.map((s, i) => (
          <div key={i} className={`absolute ${s.shape === 'ring' ? 'rounded-full' : 'rotate-45'}`} style={{ top: s.top, left: s.left, right: s.right, width: s.size, height: s.size, border: `1.5px solid ${isDarkMode ? 'rgba(212,212,212,0.05)' : 'rgba(0,0,0,0.04)'}`, animation: `float-3d-${1 + (i % 3)} ${s.dur}s ${s.delay}s infinite ease-in-out` }} />
        ))}
        {Array.from({ length: 25 }, (_, i) => (
          <div key={`pt-${i}`} className="absolute rounded-full" style={{ left: `${((i * 41 + 7) % 100)}%`, top: `${((i * 37 + 13) % 100)}%`, width: `${1 + (i % 3) * 0.7}px`, height: `${1 + (i % 3) * 0.7}px`, background: '#D4D4D4', opacity: 0.02 + (i % 6) * 0.006, animation: `float-${1 + (i % 3)} ${14 + (i % 12)}s ${(i * 1.1) % 10}s infinite ease-in-out` }} />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '1200px' }}>
        <div className="relative" style={{ width: 'clamp(200px, 40vw, 500px)', height: 'clamp(280px, 50vw, 600px)', transformStyle: 'preserve-3d' }}>
          <div ref={aLeftRef} className="absolute top-0 left-0" style={{ width: '3px', height: '100%', background: `linear-gradient(to bottom, ${accentColor}40, ${accentColor}15)`, transform: 'rotateZ(18deg) translateX(-50%)', transformOrigin: 'top center' }} />
          <div ref={aRightRef} className="absolute top-0 right-0" style={{ width: '3px', height: '100%', background: `linear-gradient(to bottom, ${accentColor}40, ${accentColor}15)`, transform: 'rotateZ(-18deg) translateX(50%)', transformOrigin: 'top center' }} />
          <div ref={aCrossRef} className="absolute top-[52%] left-0 right-0" style={{ height: '3px', background: `linear-gradient(90deg, transparent, ${accentColor}30, ${accentColor}50, ${accentColor}30, transparent)`, transform: 'translateY(-50%)' }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-10 relative z-10">
        <div className="text-center mb-16 md:mb-24">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-10 h-[1px]" style={{ background: `${accentColor}30` }} />
            <span className="text-[9px] font-mono tracking-[0.4em] uppercase" style={{ color: `${accentColor}50` }}>A-Structure</span>
            <div className="w-10 h-[1px]" style={{ background: `${accentColor}30` }} />
          </div>
          <div ref={titleRef}>
            <h2 className="font-display font-bold tracking-tighter leading-[0.92] mb-4" style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', color: 'rgba(255,255,255,0.88)' }}>To Be Container</h2>
          </div>
          <div ref={subRef}>
            <p className="text-sm md:text-base max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.30)' }}>데이터와 감성이 만나는 3차원 공간의 구조.<br />에이 구조는 우리만의 언어입니다.</p>
          </div>
        </div>

        {/* How It Works - Process Flow */}
        <div className="mb-20 md:mb-28">
          <div className="text-center mb-12">
            <span className={`text-[10px] font-mono tracking-[0.35em] uppercase ${isDarkMode ? 'text-white/20' : 'text-black/20'}`}>How A-Structure Works</span>
            <p className={`mt-3 text-sm max-w-md mx-auto leading-relaxed ${isDarkMode ? 'text-white/25' : 'text-black/25'}`}>
              A-Structure는 데이터를 다차원으로 확장하여 숨겨진 관계의 구조를 드러냅니다
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.step} className={`relative rounded-xl border p-6 md:p-7 transition-all duration-500 group ${isDarkMode ? 'border-white/[0.05] bg-white/[0.01] hover:border-white/[0.12] hover:bg-white/[0.03]' : 'border-black/[0.05] bg-black/[0.005] hover:border-black/[0.12] hover:bg-black/[0.02]'}`}>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <i className={`ri-arrow-right-s-line text-lg ${isDarkMode ? 'text-white/10' : 'text-black/10'}`} />
                  </div>
                )}
                <span className={`font-display font-bold tracking-tighter block mb-4 ${isDarkMode ? 'text-white/08' : 'text-black/06'}`} style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)' }}>
                  {step.step}
                </span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 ${isDarkMode ? 'bg-white/[0.04] text-[#D4D4D4]/70' : 'bg-black/[0.04] text-[#3D3D3D]/70'}`}>
                  <i className={`${step.icon} text-lg`} />
                </div>
                <h4 className={`text-sm md:text-base font-semibold tracking-tight mb-1.5 ${isDarkMode ? 'text-white/75' : 'text-black/75'}`}>{step.title}</h4>
                <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-white/28' : 'text-black/28'}`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div ref={dimsRef} className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {DIMENSIONS.map((dim) => (
            <div key={dim.num} className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 transition-all duration-600 hover:bg-white/[0.04] hover:border-white/[0.12]">
              <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-400" style={{ background: 'radial-gradient(circle 280px at 50% 50%, rgba(212,212,212,0.06), transparent 60%)' }} />
              <div className="relative z-10">
                <span className="font-display font-bold tracking-tighter leading-none block mb-3" style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', color: 'rgba(255,255,255,0.08)' }}>{dim.num}</span>
                <h3 className="text-xl md:text-2xl font-display font-semibold tracking-tight mb-2 text-white/80">{dim.label}</h3>
                <p className="text-sm text-white/30 mb-4">{dim.desc}</p>
                <p className="text-[11px] text-white/18 leading-relaxed">{dim.detail}</p>
                <div className="mt-6 w-10 h-[1px] bg-white/10 transition-all duration-600 group-hover:w-16" style={{ background: `${accentColor}25` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 md:mt-24 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.02]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4D4D4] animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/35">A-Structure — DO IT COMPANY Only</span>
            </div>
            <p className={`text-xs max-w-sm leading-relaxed ${isDarkMode ? 'text-white/14' : 'text-black/12'}`}>
              A-Structure는 ECHO만의 독자적인 다차원 분석 프레임워크입니다. 데이터 과학, 감성 인식, 관계 이론을 하나의 구조로 통합합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </section>
  );
}