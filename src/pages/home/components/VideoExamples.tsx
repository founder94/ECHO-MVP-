import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface VideoExamplesProps {
  isDarkMode: boolean;
}

const VIDEO_URLS = [
  'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/4a2b486f-9dbe-4b5e-8e9f-c205a4abe707_gemini_generated_video_0632EE39.mp4?seq=cinematic-01',
  'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/4a2b486f-9dbe-4b5e-8e9f-c205a4abe707_gemini_generated_video_0632EE39.mp4?seq=abstract-02',
  'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/4a2b486f-9dbe-4b5e-8e9f-c205a4abe707_gemini_generated_video_0632EE39.mp4?seq=glitch-03',
  'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/4a2b486f-9dbe-4b5e-8e9f-c205a4abe707_gemini_generated_video_0632EE39.mp4?seq=monolith-04',
  'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/4a2b486f-9dbe-4b5e-8e9f-c205a4abe707_gemini_generated_video_0632EE39.mp4?seq=ethereal-05',
];

gsap.registerPlugin(ScrollTrigger);

const EXAMPLES = [
  { id: '01', title: 'Cinematic', subtitle: 'Full-screen immersion', style: 'normal' as const, colSpan: 'lg:col-span-2 lg:row-span-2', aspectRatio: '16/10', videoIndex: 0, opacity: 1 },
  { id: '02', title: 'Abstract Flow', subtitle: 'Data visualization motion', style: 'hue-rotate(180deg) saturate(0.3) contrast(1.2)', colSpan: '', aspectRatio: '4/3', videoIndex: 1, opacity: 0.55 },
  { id: '03', title: 'Glitch Process', subtitle: 'Signal distortion art', style: 'grayscale(1) contrast(1.4) brightness(0.8)', colSpan: '', aspectRatio: '4/3', videoIndex: 2, opacity: 0.45 },
  { id: '04', title: 'Monolith', subtitle: 'Minimal monochrome', style: 'brightness(0.7) contrast(1.3) sepia(0.3)', colSpan: '', aspectRatio: '4/3', videoIndex: 3, opacity: 0.4 },
  { id: '05', title: 'Ethereal Light', subtitle: 'Dream-state ambient', style: 'blur(0.6px) brightness(0.85) saturate(0.5) hue-rotate(90deg)', colSpan: '', aspectRatio: '4/3', videoIndex: 4, opacity: 0.5 },
];

export default function VideoExamples({ isDarkMode }: VideoExamplesProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.fromTo(titleRef.current, { y: 60, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none none' },
        });
      }
      const cells = sectionRef.current?.querySelectorAll('.video-cell-enter') ?? [];
      cells.forEach((cell) => {
        gsap.fromTo(cell, { scale: 0.85, opacity: 0 }, {
          scale: 1, opacity: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: cell, start: 'top 88%', toggleActions: 'play none none none' },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';

  return (
    <section ref={sectionRef} className={`relative py-20 md:py-28 overflow-hidden border-y ${isDarkMode ? 'bg-[#060606] border-white/[0.03]' : 'bg-[#f2f2f2] border-black/[0.04]'}`}>
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor}20 20%, ${accentColor}40 50%, ${accentColor}20 80%, transparent 100%)` }} />
      <div className="max-w-6xl mx-auto px-6 md:px-10 relative z-10">
        <div ref={titleRef} className="text-center mb-12 md:mb-18">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-10 h-[1px]" style={{ background: `${accentColor}25` }} />
            <span className="text-[9px] font-mono tracking-[0.4em] uppercase" style={{ color: `${accentColor}45` }}>Visual Experience</span>
            <div className="w-10 h-[1px]" style={{ background: `${accentColor}25` }} />
          </div>
          <h2 className="font-display font-bold tracking-tighter leading-[0.92]" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}>3D Visual</span><br />
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}>Showcase</span>
          </h2>
          <p className="mt-4 text-sm max-w-md mx-auto leading-relaxed" style={{ color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}>5가지 시네마틱 비주얼 스타일로 표현된 ECHO의 3차원 공간</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {EXAMPLES.map((example, i) => (
            <div key={example.id} className={`video-cell-enter relative overflow-hidden group cursor-pointer ${example.colSpan}`} style={{ aspectRatio: example.aspectRatio, opacity: 0, borderRadius: '2px', background: isDarkMode ? '#0a0a0a' : '#e8e8e8' }}>
              <video src={VIDEO_URLS[example.videoIndex]} muted autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105" style={{ opacity: example.opacity, filter: example.style !== 'normal' ? example.style : undefined }} />
              <div className="absolute inset-0" style={{ background: isDarkMode ? 'linear-gradient(to top, rgba(6,6,6,0.9) 0%, rgba(6,6,6,0.2) 50%, transparent 100%)' : 'linear-gradient(to top, rgba(232,232,232,0.85) 0%, rgba(232,232,232,0.15) 50%, transparent 100%)' }} />
              {i > 0 && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: isDarkMode ? 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)' : 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)' }} />}
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                <span className="text-[9px] font-mono tracking-[0.3em] uppercase" style={{ color: `${accentColor}50` }}>{example.id} — {example.title}</span>
                <h3 className={`text-lg md:text-xl font-bold mt-1.5 font-display ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>{example.title}</h3>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/25' : 'text-black/25'}`}>{example.subtitle}</p>
              </div>
              <div className="absolute top-3 right-3 w-6 h-6 opacity-0 group-hover:opacity-30 transition-opacity duration-500">
                <div className="absolute top-0 right-0 w-3 h-[1px]" style={{ background: accentColor }} />
                <div className="absolute top-0 right-0 w-[1px] h-3" style={{ background: accentColor }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] z-10" style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor}15 25%, ${accentColor}30 50%, ${accentColor}15 75%, transparent 100%)` }} />
    </section>
  );
}