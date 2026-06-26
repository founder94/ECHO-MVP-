import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface ElevatorSectionProps {
  isDarkMode: boolean;
}

const ELEVATOR_DOOR_IMG = 'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/cb72c810-5934-4c6b-9835-64adec0cfb5a_compressed_3ED50683-7BD0-4148-B90E-4CB0FE8DE3D5.webp';

gsap.registerPlugin(ScrollTrigger);

export default function ElevatorSection({ isDarkMode }: ElevatorSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const leftDoorRef = useRef<HTMLDivElement>(null);
  const rightDoorRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const toBeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (leftDoorRef.current) {
        gsap.fromTo(leftDoorRef.current, { x: 0 }, { x: '-100%', duration: 1.8, ease: 'power4.inOut', scrollTrigger: { trigger: sectionRef.current, start: 'top 55%', toggleActions: 'play none none none' } });
      }
      if (rightDoorRef.current) {
        gsap.fromTo(rightDoorRef.current, { x: 0 }, { x: '100%', duration: 1.8, ease: 'power4.inOut', scrollTrigger: { trigger: sectionRef.current, start: 'top 55%', toggleActions: 'play none none none' } });
      }
      if (toBeRef.current) {
        gsap.fromTo(toBeRef.current, { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.8, duration: 0.8, ease: 'power2.in', delay: 0.3, scrollTrigger: { trigger: sectionRef.current, start: 'top 55%', toggleActions: 'play none none none' } });
      }
      if (innerContentRef.current) {
        gsap.fromTo(innerContentRef.current, { opacity: 0, scale: 0.85, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.9, scrollTrigger: { trigger: sectionRef.current, start: 'top 55%', toggleActions: 'play none none none' } });
      }
      if (floorRef.current) {
        gsap.fromTo(floorRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 1.2, scrollTrigger: { trigger: sectionRef.current, start: 'top 55%', toggleActions: 'play none none none' } });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';

  return (
    <section ref={sectionRef} className="relative w-full py-20 md:py-32 overflow-hidden bg-[#030305]">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />

      <div className="max-w-4xl mx-auto px-6 md:px-10 relative z-10">
        <div ref={floorRef} className="flex items-center justify-center gap-4 mb-8">
          <div className="w-8 h-[1px]" style={{ background: `${accentColor}30` }} />
          <span className="text-[9px] font-mono tracking-[0.4em] uppercase" style={{ color: `${accentColor}50` }}>Floor — ECHO</span>
          <div className="w-8 h-[1px]" style={{ background: `${accentColor}30` }} />
        </div>

        <div className="relative mx-auto overflow-hidden rounded-sm" style={{ maxWidth: '520px', height: 'clamp(420px, 55vh, 640px)' }}>
          <div ref={innerContentRef} className="absolute inset-0 flex flex-col items-center justify-center z-0" style={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(212,212,212,0.06) 0%, transparent 70%)' }} />
            <div className="relative z-10 text-center">
              <div className="relative mb-8" style={{ width: '120px', height: '140px', margin: '0 auto' }}>
                <div className="absolute top-0 left-[20%] w-[2px] h-full bg-gradient-to-b from-white/20 to-white/05" style={{ transform: 'rotateZ(15deg)', transformOrigin: 'top center' }} />
                <div className="absolute top-0 right-[20%] w-[2px] h-full bg-gradient-to-b from-white/20 to-white/05" style={{ transform: 'rotateZ(-15deg)', transformOrigin: 'top center' }} />
                <div className="absolute top-[55%] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              </div>
              <span className="font-display font-bold tracking-tighter leading-none block mb-3" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'rgba(255,255,255,0.75)' }}>To Be Container</span>
              <p className="text-xs text-white/30 mb-6 max-w-xs mx-auto leading-relaxed">문이 열리면 새로운 차원이 펼쳐집니다</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.10] bg-white/[0.02]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4D4D4] animate-pulse" />
                <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/35">A-Structure Ahead</span>
              </div>
            </div>
            <div className="absolute left-8 top-0 bottom-0 w-[1px] bg-white/[0.04]" />
            <div className="absolute right-8 top-0 bottom-0 w-[1px] bg-white/[0.04]" />
            <div className="absolute left-0 right-0 top-8 h-[1px] bg-white/[0.04]" />
            <div className="absolute left-0 right-0 bottom-8 h-[1px] bg-white/[0.04]" />
          </div>

          <div ref={leftDoorRef} className="absolute top-0 left-0 w-1/2 h-full z-20 overflow-hidden" style={{ transformOrigin: 'left center' }}>
            <img src={ELEVATOR_DOOR_IMG} alt="" className="absolute inset-0 w-[200%] h-full object-cover" style={{ objectPosition: 'left center' }} />
            <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-white/[0.08]" />
          </div>

          <div ref={rightDoorRef} className="absolute top-0 right-0 w-1/2 h-full z-20 overflow-hidden" style={{ transformOrigin: 'right center' }}>
            <img src={ELEVATOR_DOOR_IMG} alt="" className="absolute inset-0 w-[200%] h-full object-cover" style={{ objectPosition: 'right center', left: '-100%' }} />
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-white/[0.08]" />
          </div>

          <div className="absolute inset-0 border border-white/[0.12] pointer-events-none z-30 rounded-sm" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4D4D4] animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/[0.15]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/[0.15]" />
          </div>

          <div ref={toBeRef} className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="font-display font-bold tracking-[0.3em] uppercase" style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', color: 'rgba(255,255,255,0.6)', textShadow: '0 0 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.9)' }}>TO BE</div>
              <div className="font-display font-bold tracking-[0.2em] uppercase mt-1" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)', color: 'rgba(255,255,255,0.4)', textShadow: '0 0 20px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9)' }}>CONTINUE</div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-6 h-[1px] bg-white/20" />
                <span className="text-[8px] font-mono tracking-[0.3em] uppercase text-white/30">The journey continues</span>
                <div className="w-6 h-[1px] bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[520px] mx-auto mt-6 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-white/[0.08] flex items-center justify-center"><i className="ri-arrow-up-line text-[10px] text-white/25" /></div>
            <div className="w-8 h-8 rounded-full border border-white/[0.08] flex items-center justify-center"><i className="ri-arrow-down-line text-[10px] text-white/25" /></div>
          </div>
          <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-white/20">DO IT COMPANY — ECHO</span>
          <div className="w-8 h-8 rounded-full border border-white/[0.08] flex items-center justify-center"><i className="ri-door-open-line text-[10px] text-white/25" /></div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
    </section>
  );
}