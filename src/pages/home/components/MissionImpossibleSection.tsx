import { useEffect, useRef, useCallback, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MagneticButton from '@/components/base/MagneticButton';

gsap.registerPlugin(ScrollTrigger);

const MISSION_PARTICLES = 40;
const SPEED_STREAKS = 18;
const YOUTUBE_VIDEO_ID = 'MiAsgo9k0RM';
const START_SECONDS = 18;

const CYCLE_TEXTS = [
  'ECHO Protocol',
  'Human Relationship OS',
  'AI Mirror',
  'Relationship Data',
  'Reading Emotion',
  'Pattern Recognition',
  'Identity Recovery',
  'Connecting Human Data',
  'Processing...',
  'Data Stream',
  'Emotion Layer',
];

declare global {
  interface Window {
    onYouTubeIframeAPIReady: (() => void) | null;
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId?: string;
          width?: number | string;
          height?: number | string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  setLoop: (loop: boolean) => void;
  getPlayerState: () => number;
  destroy: () => void;
  loadVideoById: (obj: { videoId: string; startSeconds?: number }) => void;
  addEventListener: (event: string, listener: string) => void;
  removeEventListener: (event: string, listener: string) => void;
}

interface MissionImpossibleSectionProps {
  onTrialClick?: () => void;
  onMissionClick?: () => void;
}

const MissionImpossibleSection = ({ onTrialClick, onMissionClick }: MissionImpossibleSectionProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerContainerId = 'mi-youtube-player';
  const apiLoadedRef = useRef(false);
  const playerReadyRef = useRef(false);
  const [isMuted, setIsMuted] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [cycleOpacity, setCycleOpacity] = useState(0);

  // Load YouTube IFrame API
  const loadYouTubeAPI = useCallback(() => {
    if (apiLoadedRef.current) return;
    apiLoadedRef.current = true;

    // If API already loaded by another component
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }

    // Store any existing callback
    const existingCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (existingCallback) existingCallback();
      createPlayer();
    };

    // Load script if not already loading
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const createPlayer = useCallback(() => {
    if (playerRef.current) return;

    playerRef.current = new window.YT.Player(playerContainerId, {
      videoId: YOUTUBE_VIDEO_ID,
      width: 1,
      height: 1,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        showinfo: 0,
        loop: 1,
        playlist: YOUTUBE_VIDEO_ID,
      },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          playerReadyRef.current = true;
          event.target.mute();
          event.target.setVolume(0);
          event.target.seekTo(START_SECONDS, true);
          setAudioReady(true);
        },
        onStateChange: (event: { data: number }) => {
          // When video ends, it should loop (handled by playlist param)
          if (event.data === window.YT.PlayerState.ENDED) {
            playerRef.current?.seekTo(START_SECONDS, true);
            playerRef.current?.playVideo();
          }
        },
      },
    });
  }, []);

  // Start playback when section scrolls into view
  useEffect(() => {
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 80%',
      onEnter: () => {
        if (playerRef.current && playerReadyRef.current) {
          playerRef.current.playVideo();
          // Try to unmute after a brief delay — browser may allow it since user scrolled
          setTimeout(() => {
            if (playerRef.current && playerRef.current.isMuted()) {
              playerRef.current.unMute();
              playerRef.current.setVolume(70);
              setIsMuted(false);
            }
          }, 500);
        } else {
          // Player not ready yet, load API first
          loadYouTubeAPI();
        }
      },
      once: true,
    });

    return () => trigger.kill();
  }, [loadYouTubeAPI]);

  // Retry play when player becomes ready after scroll trigger already fired
  useEffect(() => {
    if (audioReady && playerRef.current && playerReadyRef.current) {
      const rect = sectionRef.current?.getBoundingClientRect();
      if (rect && rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
        playerRef.current.playVideo();
        setTimeout(() => {
          if (playerRef.current && playerRef.current.isMuted()) {
            playerRef.current.unMute();
            playerRef.current.setVolume(70);
            setIsMuted(false);
          }
        }, 500);
      }
    }
  }, [audioReady]);

  // Text cycling animation to fill empty space before content reveals
  useEffect(() => {
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (fn: () => void, delay: number) => {
      const t = setTimeout(() => {
        if (mounted) fn();
      }, delay);
      timers.push(t);
    };

    const runCycle = (idx: number) => {
      if (!mounted) return;
      setCycleIndex(idx);
      setCycleOpacity(1);

      schedule(() => {
        if (!mounted) return;
        setCycleOpacity(0);
        schedule(() => {
          runCycle((idx + 1) % CYCLE_TEXTS.length);
        }, 700);
      }, 2700);
    };

    schedule(() => runCycle(0), 600);

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  // Scroll-triggered GSAP animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { scale: 0.6, opacity: 0, y: 60 },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power4.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 70%',
              end: 'top 30%',
              toggleActions: 'play none none none',
            },
          },
        );
      }

      if (subtitleRef.current) {
        gsap.fromTo(
          subtitleRef.current,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: 0.3,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 70%',
              toggleActions: 'play none none none',
            },
          },
        );
      }

      if (ringRef.current) {
        gsap.fromTo(
          ringRef.current,
          { scale: 0.8, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 1,
            delay: 0.5,
            ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 70%',
              toggleActions: 'play none none none',
            },
          },
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Toggle mute
  const toggleMute = () => {
    if (!playerRef.current) return;
    if (playerRef.current.isMuted()) {
      playerRef.current.unMute();
      playerRef.current.setVolume(70);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ minHeight: '100vh', perspective: '1200px' }}
    >
      {/* Hidden YouTube player container */}
      <div
        id={playerContainerId}
        className="absolute pointer-events-none opacity-0"
        style={{ width: '1px', height: '1px', top: 0, left: 0 }}
      />

      {/* Audio toggle button */}
      <button
        onClick={toggleMute}
        className="absolute top-6 right-6 z-30 flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm text-white cursor-pointer hover:bg-white/10 transition-all duration-300"
        aria-label={isMuted ? '소리 켜기' : '소리 끄기'}
      >
        <i className={`${isMuted ? 'ri-volume-mute-line' : 'ri-volume-up-line'} text-lg`}></i>
      </button>

      {/* Background image — tunnel speed lines */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src="https://readdy.ai/api/search-image?query=Black%20and%20white%20abstract%20tunnel%20with%20speed%20lines%20radiating%20from%20center%2C%20high%20contrast%20monochrome%2C%20cinematic%20Mission%20Impossible%20opening%20credits%20style%2C%20film%20noir%20aesthetic%2C%20radial%20motion%20blur%20streaks%20converging%20to%20vanishing%20point%2C%20dramatic%20light%20and%20shadow%2C%20minimalist%20abstract%20composition%2C%20grainy%20film%20texture%2C%20%20noir%20art%20direction%2C%20sophisticated%20corporate%20design&width=1600&height=900&seq=mission-tunnel-bg-01&orientation=landscape"
          alt="Mission tunnel background"
          className="w-full h-full object-cover object-center"
          style={{ filter: 'contrast(1.2) brightness(0.9)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, black 70%)' }} />
      </div>

      {/* Suction particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: MISSION_PARTICLES }, (_, i) => {
          const angle = (i / MISSION_PARTICLES) * 360;
          const distance = 30 + (i % 5) * 15;
          const size = 2 + (i % 4) * 1.5;
          const duration = 2.5 + (i % 7) * 0.8;
          const delay = (i % 10) * 0.3;
          return (
            <div
              key={`suction-${i}`}
              className="absolute rounded-full"
              style={{
                left: '50%',
                top: '50%',
                width: `${size}px`,
                height: `${size}px`,
                background: i % 3 === 0 ? '#fff' : 'rgba(255,255,255,0.6)',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${distance}vw)`,
                animation: `mi-suction-particle ${duration}s ${delay}s infinite ease-in-out`,
                opacity: 0.3 + (i % 5) * 0.1,
              }}
            />
          );
        })}
      </div>

      {/* Speed streaks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: SPEED_STREAKS }, (_, i) => {
          const angle = (i / SPEED_STREAKS) * 360;
          const length = 60 + (i % 6) * 40;
          const width = 1 + (i % 3) * 0.5;
          const duration = 1.5 + (i % 5) * 0.6;
          const delay = (i % 8) * 0.2;
          return (
            <div
              key={`streak-${i}`}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                width: `${length}px`,
                height: `${width}px`,
                background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${20 + (i % 4) * 10}vw)`,
                animation: `mi-speed-streak ${duration}s ${delay}s infinite ease-out`,
              }}
            />
          );
        })}
      </div>

      {/* Concentric suction rings */}
      <div ref={ringRef} className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={`ring-${i}`}
            className="absolute rounded-full border"
            style={{
              width: `${80 + i * 60}px`,
              height: `${80 + i * 60}px`,
              borderColor: 'rgba(255,255,255,0.08)',
              animation: `mi-suction-ring ${3 + i * 0.7}s ${i * 0.4}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
          animation: 'mi-scanline 8s linear infinite',
        }}
      />

      {/* 3D depth layers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transformStyle: 'preserve-3d',
          perspective: '1200px',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: 'translateZ(-100px) scale(1.1)',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            transform: 'translateZ(-50px) scale(1.05)',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* Cycling text overlay — fills empty space before content reveals */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[5]">
        <div
          className="text-[10px] md:text-[11px] font-mono tracking-[0.5em] uppercase text-white/40 transition-all duration-700 ease-in-out"
          style={{
            opacity: cycleOpacity,
            filter: cycleOpacity > 0.3 ? 'blur(0px)' : 'blur(2px)',
            textShadow: '0 0 20px rgba(255,255,255,0.1)',
          }}
        >
          {CYCLE_TEXTS[cycleIndex]}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20">
        <div className="text-center">
          <div
            ref={subtitleRef}
            className="text-white/50 text-[10px] font-mono uppercase tracking-[0.5em] mb-6"
          >
            ECHO Protocol
          </div>

          <div ref={titleRef} className="relative">
            <h2
              className="text-white text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none"
              style={{
                textShadow: '0 0 60px rgba(255,255,255,0.3), 0 0 120px rgba(255,255,255,0.1)',
                transformStyle: 'preserve-3d',
              }}
            >
              MISSION
            </h2>
            <div className="text-white/80 text-3xl md:text-5xl lg:text-6xl font-light tracking-[0.2em] mt-2">
              : IDENTITY
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="w-12 h-px bg-white/30" />
            <div className="text-white/40 text-[10px] font-mono tracking-[0.3em]">
              DISCOVER YOURSELF
            </div>
            <div className="w-12 h-px bg-white/30" />
          </div>

          <div className="mt-12 max-w-lg mx-auto">
            <p className="text-white/60 text-sm md:text-base leading-relaxed text-center">
              관계 속에서, 혹은 그냥 문득, 나를 다시 만나고 싶은 모든 순간을 위해.
              <br />
              데이터와 감성이 만나는 교차점에서 진짜 너를 발견하다.
            </p>
          </div>

          <div className="mt-10">
            <MagneticButton
              onClick={onMissionClick}
              variant="outline"
              size="md"
              className="uppercase tracking-wider"
            >
              <span>시작하기</span>
              <i className="ri-arrow-right-line"></i>
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MissionImpossibleSection;