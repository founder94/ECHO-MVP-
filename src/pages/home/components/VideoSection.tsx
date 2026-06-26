import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface VideoSectionProps {
  isDarkMode: boolean;
}

const VIDEO_URL = 'https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/4a2b486f-9dbe-4b5e-8e9f-c205a4abe707_gemini_generated_video_0632EE39.mp4';

gsap.registerPlugin(ScrollTrigger);

export default function VideoSection({ isDarkMode }: VideoSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      if (videoRef.current) {
        gsap.fromTo(
          videoRef.current,
          { scale: 1.15, opacity: 0 },
          {
            scale: 1, opacity: 1, duration: 1.6, ease: 'power3.out',
            scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', end: 'top 20%', scrub: 1 },
          },
        );
      }
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { y: 80, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 1.2, ease: 'power4.out',
            scrollTrigger: { trigger: sectionRef.current, start: 'top 60%', toggleActions: 'play none none none' },
          },
        );
      }
      if (overlayRef.current) {
        gsap.fromTo(
          overlayRef.current,
          { y: 0 },
          {
            y: -40, ease: 'none',
            scrollTrigger: { trigger: sectionRef.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
          },
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [isDarkMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: 'clamp(500px, 80vh, 900px)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] z-20 pointer-events-none">
        <div
          className="h-full w-full"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor}30 20%, ${accentColor}60 50%, ${accentColor}30 80%, transparent 100%)` }}
        />
      </div>

      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_URL}
          muted autoPlay loop playsInline preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0 }}
        />
      </div>

      <div ref={overlayRef} className="absolute inset-0 z-10 pointer-events-none">
        <div className="absolute inset-0" style={{ background: isDarkMode ? 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)' : 'radial-gradient(ellipse at center, transparent 40%, rgba(240,240,240,0.4) 100%)' }} />
        <div className="absolute top-0 left-0 right-0 h-32" style={{ background: isDarkMode ? 'linear-gradient(to bottom, #0a0a0a, transparent)' : 'linear-gradient(to bottom, #f3f3f3, transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-32" style={{ background: isDarkMode ? 'linear-gradient(to top, #0a0a0a, transparent)' : 'linear-gradient(to top, #f3f3f3, transparent)' }} />
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}10 1px, transparent 1px), linear-gradient(to bottom, ${accentColor}10 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div ref={titleRef} className="text-center pointer-events-auto">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px]" style={{ background: `${accentColor}40` }} />
            <span className="text-[10px] font-mono tracking-[0.5em] uppercase" style={{ color: `${accentColor}70` }}>3D Visual Experience</span>
            <div className="w-12 h-[1px]" style={{ background: `${accentColor}40` }} />
          </div>
          <h2 className="font-display font-bold tracking-tighter leading-[0.92] mb-4" style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}>
            <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}>Beyond<br />The Surface</span>
          </h2>
          <p className="text-sm md:text-base max-w-md mx-auto leading-relaxed" style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
            데이터와 감성이 만나는 3차원 공간.<br />ECHO는 보이지 않는 관계의 패턴을 시각화합니다.
          </p>
        </div>
      </div>

      <div className="absolute inset-0 z-10 pointer-events-none" style={{ perspective: '1400px' }}>
        {[
          { top: '8%', left: '5%', size: 80, delay: 0 },
          { top: '12%', right: '8%', size: 120, delay: 2 },
          { bottom: '15%', left: '10%', size: 60, delay: 4 },
          { bottom: '10%', right: '5%', size: 100, delay: 6 },
        ].map((ring, i) => (
          <div
            key={`ring-${i}`}
            className="absolute rounded-full border"
            style={{
              top: ring.top || 'auto', left: ring.left || 'auto', right: ring.right || 'auto', bottom: ring.bottom || 'auto',
              width: ring.size, height: ring.size, borderColor: 'rgba(212,212,212,0.06)',
              animation: `float-3d-${1 + (i % 3)} ${18 + i * 3}s ${ring.delay}s infinite ease-in-out`,
              transformStyle: 'preserve-3d',
            }}
          />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={`pt-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${((i * 47 + 13) % 100)}%`, top: `${((i * 31 + 7) % 100)}%`,
              width: `${1 + (i % 3) * 0.8}px`, height: `${1 + (i % 3) * 0.8}px`,
              background: '#D4D4D4', opacity: 0.02 + (i % 5) * 0.01,
              animation: `float-${1 + (i % 3)} ${12 + (i % 10)}s ${(i * 0.8) % 10}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] z-20 pointer-events-none">
        <div className="h-full w-full" style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor}20 15%, ${accentColor}50 50%, ${accentColor}20 85%, transparent 100%)` }} />
      </div>
    </section>
  );
}