import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { useNavigate } from 'react-router-dom';
import { recordVisit } from '@/hooks/useVisitorTracker';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import MagneticButton from '@/components/base/MagneticButton';
import Hero from './components/Hero';
import Footer from './components/Footer';
import Section1 from './components/Section1';
import Section2 from './components/Section2';
import Section3 from './components/Section3';
import Section4 from './components/Section4';
import Section5 from './components/Section5';
import Section6 from './components/Section6';
import VideoSection from './components/VideoSection';
import VideoExamples from './components/VideoExamples';
import ASection from './components/ASection';
import FindMeSection from './components/FindMeSection';
import ElevatorSection from './components/ElevatorSection';
import TrialFormModal from './components/TrialFormModal';
import ThreeEmotionsSection from './components/ThreeEmotionsSection';
import DataSpeaksSection from './components/DataSpeaksSection';
import CEOStatement from './components/CEOStatement';
import FaqSection from './components/FaqSection';
import CinematicMarquee from './components/CinematicMarquee';
import { useFPSDive } from '@/components/feature/FPSDiveProvider';
import MissionImpossibleSection from './components/MissionImpossibleSection';
import PatternEngineSection from './components/PatternEngineSection';
import MissionCinematicOverlay from './components/MissionCinematicOverlay';
import ApproachCinematicOverlay from './components/ApproachCinematicOverlay';
import OnboardingCinematicOverlay from './components/OnboardingCinematicOverlay';
import CinematicTransitionOverlay from './components/CinematicTransitionOverlay';
import FloatingAuthPill from './components/FloatingAuthPill';
import MemberGateModal from './components/MemberGateModal';
import PaymentGateModal from './components/PaymentGateModal';
import SequenceOverlay from './components/SequenceOverlay';
import { ABOUT_EXPERIENCE, AI_EXPERIENCE, FOUNDER_EXPERIENCE, REPORT_EXPERIENCE } from './data/experiences';

import { useMusicPlayer } from './hooks/useMusicPlayer';

const NAV_ITEMS = [
  { label: 'ECHO', href: '#hero' },
  { label: 'Mission', href: '#section1' },
  { label: 'About', href: '#section2' },
  { label: 'Approach', href: '#approach' },
  { label: 'Services', href: '#services' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
  { label: 'Identity', href: '#find-me' },
];

const SECTION_LABELS = ['Hero', 'Mission', 'About', 'Approach', 'Services', 'Work', 'Contact', 'Identity'];

const MARQUEE_TEXTS = [
  'HUMAN RELATIONSHIP OPERATING SYSTEM',
  '데이터와 감성의 교차점',
  'CREATIVELY RATIONAL',
  '진짜 나를 찾아줘',
  'ECHO × DO IT COMPANY',
  '관계의 새로운 문법',
  'IDENTITY RECOVERY',
  '잃어버린 정체성을 찾아서',
];

const FLYER_SHAPES = [
  { shape: 'circle', size: 20, anim: 'fly-ltr', dur: 6, delay: 0, y: '15%' },
  { shape: 'square', size: 30, anim: 'fly-rtl', dur: 7.3, delay: 1, y: '28%' },
  { shape: 'circle', size: 14, anim: 'fly-diagonal-ltr', dur: 8.3, delay: 2, y: '45%' },
  { shape: 'square', size: 24, anim: 'fly-diagonal-rtl', dur: 9.3, delay: 0.3, y: '58%' },
  { shape: 'circle', size: 18, anim: 'fly-ltr', dur: 6.7, delay: 3, y: '72%' },
  { shape: 'square', size: 16, anim: 'fly-rtl', dur: 8, delay: 1.3, y: '85%' },
  { shape: 'circle', size: 26, anim: 'fly-diagonal-ltr', dur: 10, delay: 2.3, y: '35%' },
  { shape: 'square', size: 12, anim: 'fly-diagonal-rtl', dur: 6.3, delay: 3.7, y: '65%' },
  { shape: 'circle', size: 22, anim: 'fly-ltr', dur: 8.7, delay: 4.7, y: '90%' },
  { shape: 'square', size: 28, anim: 'fly-rtl', dur: 7, delay: 0.7, y: '8%' },
  { shape: 'circle', size: 16, anim: 'fly-diagonal-ltr', dur: 7.7, delay: 3.3, y: '52%' },
  { shape: 'square', size: 20, anim: 'fly-diagonal-rtl', dur: 9, delay: 4.3, y: '78%' },
];

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, hasPaid } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);
  const { musicPlaying, toggleMusic } = useMusicPlayer();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [trialFormOpen, setTrialFormOpen] = useState(false);
  const [missionCinematicOpen, setMissionCinematicOpen] = useState(false);
  const [isApproachOverlayOpen, setIsApproachOverlayOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isCinematicTransitioning, setIsCinematicTransitioning] = useState(false);
  const [memberGateOpen, setMemberGateOpen] = useState(false);
  const [paymentGateOpen, setPaymentGateOpen] = useState(false);
  const [aboutSequenceOpen, setAboutSequenceOpen] = useState(false);
  const [aiSequenceOpen, setAiSequenceOpen] = useState(false);
  const [founderSequenceOpen, setFounderSequenceOpen] = useState(false);
  const [reportSequenceOpen, setReportSequenceOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const diveLockRef = useRef(false);
  const { triggerDive } = useFPSDive();

  // Stripe 결제 완료 후 프로필 상태 자동 동기화
  useEffect(() => {
    if (!isAuthenticated || hasPaid) return;

    const checkPaymentStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: orders } = await supabase
          .from('order_headers')
          .select('status')
          .eq('customer_id', session.user.id)
          .eq('status', 'paid')
          .limit(1);

        if (orders && orders.length > 0) {
          await supabase
            .from('profiles')
            .update({ payment_status: 'paid' })
            .eq('id', session.user.id);
        }
      } catch {
        // silent - 다음 페이지 로드 시 재시도
      }
    };

    checkPaymentStatus();
  }, [isAuthenticated, hasPaid]);

  // Helper: wrap a member-only action with auth gate
  const withMemberGate = useCallback((action: () => void) => {
    return () => {
      if (isAuthenticated) {
        action();
      } else {
        setMemberGateOpen(true);
      }
    };
  }, [isAuthenticated]);

  // Helper: wrap a paid-member-only action with payment gate
  const withPaymentGate = useCallback((action: () => void) => {
    return () => {
      if (!isAuthenticated) {
        setMemberGateOpen(true);
      } else if (!hasPaid) {
        setPaymentGateOpen(true);
      } else {
        action();
      }
    };
  }, [isAuthenticated, hasPaid]);

  const handleTrialClick = useCallback(withMemberGate(() => {
    setOnboardingOpen(true);
  }), [withMemberGate]);

  const handleOnboardingTrialClick = useCallback(withMemberGate(() => {
    setTrialFormOpen(true);
  }), [withMemberGate]);

  const handleMissionClick = useCallback(withMemberGate(() => {
    setMissionCinematicOpen(true);
  }), [withMemberGate]);

  const handleApproachClick = useCallback(withMemberGate(() => {
    setIsApproachOverlayOpen(true);
  }), [withMemberGate]);

  // --- 새 경험 핸들러 ---
  const handleAboutClick = useCallback(withMemberGate(() => {
    setAboutSequenceOpen(true);
  }), [withMemberGate]);

  const handleAIClick = useCallback(withPaymentGate(() => {
    setAiSequenceOpen(true);
  }), [withPaymentGate]);

  const handleFounderClick = useCallback(withMemberGate(() => {
    setFounderSequenceOpen(true);
  }), [withMemberGate]);

  const handleReportClick = useCallback(withPaymentGate(() => {
    setReportSequenceOpen(true);
  }), [withPaymentGate]);

  useEffect(() => {
    setIsDarkMode(true);
    recordVisit();
  }, []);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const ctx = gsap.context(() => {
      const logo = nav.querySelector('.nav-logo') as HTMLElement;
      const desktopLinks = nav.querySelectorAll('.nav-desktop-link');
      const controls = nav.querySelector('.nav-controls') as HTMLElement;
      const controlButtons = nav.querySelectorAll('.nav-ctrl-btn, .nav-start-btn');

      if (logo) {
        gsap.fromTo(logo, { opacity: 0, x: -16, filter: 'blur(4px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out', delay: 0.5 });
      }

      gsap.fromTo(desktopLinks, { opacity: 0, y: -8, filter: 'blur(3px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.05, ease: 'power3.out', delay: 0.65 });

      if (controlButtons.length > 0) {
        gsap.fromTo(controlButtons, { opacity: 0, scale: 0.85, y: -4 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out', delay: 1.0 });
      }
    }, nav);

    return () => ctx.revert();
  }, []);

  const cameraDiveTo = useCallback((targetId: string) => {
    if (diveLockRef.current) return;
    triggerDive(() => {
      diveLockRef.current = true;
      document.body.classList.add('camera-diving');

      setTimeout(() => {
        document.body.classList.remove('camera-diving');
        const target = document.getElementById(targetId);
        if (target) {
          target.classList.add('section-dive-entrance');
          const top = target.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top, behavior: 'auto' });
          setTimeout(() => target.classList.remove('section-dive-entrance'), 1000);
        }
        diveLockRef.current = false;
      }, 500);
    });
  }, [triggerDive]);

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window;
    if (!isTouchDevice) return;

    const handleTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      if (diveLockRef.current) return;
      e.preventDefault();
      const id = href.replace('#', '');
      cameraDiveTo(id);
    };
    document.addEventListener('touchstart', handleTouch, { passive: false });
    return () => document.removeEventListener('touchstart', handleTouch);
  }, [cameraDiveTo]);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docH > 0 ? scrollY / docH : 0;

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }

      setNavScrolled(scrollY > window.innerHeight * 0.6);

      const sections = document.querySelectorAll('section[id]');
      let current = 0;
      sections.forEach((sec, i) => {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.5) current = i;
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      if (diveLockRef.current) return;
      e.preventDefault();
      const id = href.replace('#', '');
      cameraDiveTo(id);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [cameraDiveTo]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      setCursorVisible(true);
    };
    const onLeave = () => setCursorVisible(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div className={`relative ${isDarkMode ? 'bg-[#050505]' : 'bg-[#f8f8f8]'}`}>
      <div id="youtube-audio-player" className="hidden" />

      <div
        className="fixed pointer-events-none z-[9999] transition-transform duration-75"
        style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)', opacity: cursorVisible ? 1 : 0 }}
      >
        <div className={`absolute rounded-full transition-all duration-300 ${isDarkMode ? 'border border-white/25' : 'border border-black/25'}`} style={{ width: 40, height: 40, top: -20, left: -20 }} />
        <div className={`rounded-full ${isDarkMode ? 'bg-white' : 'bg-black'}`} style={{ width: 4, height: 4, marginTop: -2, marginLeft: -2 }} />
        <div className="absolute rounded-full opacity-[0.08]" style={{ width: 140, height: 140, top: -70, left: -70, background: isDarkMode ? 'radial-gradient(circle, rgba(212,212,212,0.35) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(61,61,61,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
      </div>

      <div className={`fixed top-0 left-0 right-0 h-[1px] z-50 ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
        <div ref={progressRef} className={`h-full origin-left ${isDarkMode ? 'bg-[#D4D4D4]' : 'bg-[#3D3D3D]'}`} style={{ transform: 'scaleX(0)', transition: 'transform 0.1s linear' }} />
      </div>

      <div className={`plus-x-grid ${isDarkMode ? 'opacity-100' : 'opacity-0'}`} />

      <div className="fixed inset-0 pointer-events-none z-[3] overflow-hidden">
        {FLYER_SHAPES.map((flyer, i) => (
          <div
            key={`flyer-${i}`}
            className={`absolute ${flyer.shape === 'circle' ? 'rounded-full' : 'rounded-sm rotate-45'}`}
            style={{
              top: flyer.y,
              left: 0,
              width: flyer.size,
              height: flyer.size,
              border: `1px solid ${isDarkMode ? 'rgba(212,212,212,0.12)' : 'rgba(61,61,61,0.10)'}`,
              animation: `${flyer.anim} ${flyer.dur}s ${flyer.delay}s infinite linear`,
            }}
          />
        ))}
      </div>

      <div className="fixed inset-0 pointer-events-none z-[2] overflow-hidden" style={{ perspective: '1400px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={`ring-${i}`}
            className="absolute rounded-full border"
            style={{
              left: `${8 + i * 11}%`,
              top: `${10 + i * 10}%`,
              width: `${50 + i * 25}px`,
              height: `${50 + i * 25}px`,
              borderColor: isDarkMode ? 'rgba(212,212,212,0.07)' : 'rgba(61,61,61,0.07)',
              animation: `float-3d-${1 + (i % 3)} ${5 + i * 1}s ${i * 0.7}s infinite ease-in-out`,
              transformStyle: 'preserve-3d',
            }}
          />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={`sq-${i}`}
            className="absolute border rotate-45"
            style={{
              left: `${15 + i * 20}%`,
              top: `${30 + i * 12}%`,
              width: `${25 + i * 8}px`,
              height: `${25 + i * 8}px`,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              animation: `float-3d-${1 + (i % 3)} ${6.7 + i * 0.7}s ${i * 1.2}s infinite ease-in-out`,
              transformStyle: 'preserve-3d',
            }}
          />
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <div
            key={`pt-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${((i * 31 + 7) % 100)}%`,
              top: `${((i * 47 + 13) % 100)}%`,
              width: `${1.2 + (i % 3) * 0.7}px`,
              height: `${1.2 + (i % 3) * 0.7}px`,
              background: isDarkMode ? '#D4D4D4' : '#3D3D3D',
              opacity: 0.02 + (i % 6) * 0.007,
              animation: `float-${1 + (i % 3)} ${4.7 + (i % 15)}s ${(i * 0.37) % 4}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="fixed right-4 md:right-5 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-end gap-2.5">
        {SECTION_LABELS.map((label, i) => {
          const sectionIds = ['hero', 'section1', 'section2', 'approach', 'services', 'work', 'contact', 'find-me'];
          return (
            <div
              key={i}
              className="group flex items-center gap-2 cursor-pointer"
              onClick={() => cameraDiveTo(sectionIds[i])}
            >
              <span
                className={`text-[8px] font-mono uppercase tracking-widest transition-all duration-500 whitespace-nowrap ${
                  activeSection === i
                    ? `opacity-100 translate-x-0 ${isDarkMode ? 'text-[#D4D4D4]' : 'text-[#3D3D3D]'}`
                    : `opacity-0 translate-x-2 group-hover:opacity-60 group-hover:translate-x-0 ${isDarkMode ? 'text-white/50' : 'text-black/50'}`
                }`}
              >
                {label}
              </span>
              <div
                className={`rounded-full transition-all duration-500 ${
                  activeSection === i
                    ? `w-[14px] h-[2px] ${isDarkMode ? 'bg-[#D4D4D4]' : 'bg-[#3D3D3D]'}`
                    : `w-[5px] h-[5px] ${isDarkMode ? 'bg-white/15 group-hover:bg-white/40' : 'bg-black/15 group-hover:bg-black/40'}`
                }`}
              />
            </div>
          );
        })}
      </div>

      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 md:px-8 py-4 transition-all duration-700 ${
          navScrolled
            ? isDarkMode
              ? 'bg-[#0a0a0a]/85 backdrop-blur-xl border-b border-white/[0.03]'
              : 'bg-white/85 backdrop-blur-xl border-b border-black/[0.03]'
            : ''
        }`}
      >
        <a href="#" onClick={(e) => { e.preventDefault(); cameraDiveTo('hero'); }} className={`nav-logo text-xs font-semibold tracking-[0.25em] uppercase cursor-pointer ${isDarkMode ? 'text-white' : 'text-black'}`}>
          ECHO
        </a>

        <div className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const targetId = item.href.replace('#', '');
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => { e.preventDefault(); cameraDiveTo(targetId); }}
                className={`nav-desktop-link text-[10px] font-medium tracking-[0.15em] uppercase transition-all duration-300 hover:opacity-50 cursor-pointer ${
                  isDarkMode ? 'text-white/60' : 'text-black/60'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="nav-controls flex items-center gap-2">
          <button
            onClick={toggleMusic}
            className={`nav-ctrl-btn w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300 cursor-pointer ${
              isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'
            }`}
            aria-label={musicPlaying ? '음악 멈추기' : '음악 재생'}
          >
            <i className={`${musicPlaying ? 'ri-volume-up-line' : 'ri-volume-mute-line'} text-[11px] ${
              isDarkMode ? 'text-white/50' : 'text-black/40'
            }`} />
          </button>
          <button
            onClick={() => setIsDarkMode((v) => !v)}
            className={`nav-ctrl-btn w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300 cursor-pointer ${
              isDarkMode ? 'border-white/10 text-white/50 hover:bg-white/5' : 'border-black/10 text-black/40 hover:bg-black/5'
            }`}
          >
            <i className={`${isDarkMode ? 'ri-sun-line' : 'ri-moon-line'} text-[11px]`} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`nav-ctrl-btn md:hidden w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300 cursor-pointer ${
              isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'
            }`}
          >
            <i className={`text-sm ${isDarkMode ? 'text-white' : 'text-black'} ${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`} />
          </button>
          <MagneticButton
            onClick={() => setIsCinematicTransitioning(true)}
            variant="primary"
            size="sm"
            className="nav-start-btn hidden md:inline-flex text-[10px] tracking-[0.1em] uppercase"
          >
            회원가입
          </MagneticButton>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className={`fixed inset-0 z-20 md:hidden flex flex-col ${isDarkMode ? 'bg-[#050505]/98 backdrop-blur-xl' : 'bg-white/98 backdrop-blur-xl'}`}>
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {NAV_ITEMS.map((item, idx) => {
              const targetId = item.href.replace('#', '');
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    setTimeout(() => cameraDiveTo(targetId), 200);
                  }}
                  className={`text-2xl font-light tracking-[0.3em] uppercase transition-all duration-500 cursor-pointer hover:tracking-[0.35em] ${
                    isDarkMode ? 'text-white/80 hover:text-white' : 'text-black/80 hover:text-black'
                  }`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {item.label}
                </a>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (isAuthenticated) {
                  setTimeout(() => setOnboardingOpen(true), 200);
                } else {
                  setTimeout(() => setMemberGateOpen(true), 200);
                }
              }}
              className="mt-4 px-8 py-3 rounded-full text-sm font-medium tracking-wide whitespace-nowrap cursor-pointer transition-all duration-300 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, #FF6B9D, #9B59B6)`,
                color: '#FFFFFF',
                boxShadow: '0 0 30px rgba(255,107,157,0.2)',
              }}
            >
              ECHO 시작하기
            </button>
          </div>
          <div className="pb-10 flex items-center justify-center gap-6">
            {[
              { icon: 'ri-google-line', href: 'https://www.google.com/search?q=ECHO+DO+IT+COMPANY', color: '#4285F4' },
              { icon: 'ri-instagram-line', href: 'https://www.instagram.com/parkobserver/', color: '#E4405F' },
              { icon: 'ri-linkedin-fill', href: 'https://www.linkedin.com/in/jinwookpark-founder', color: '#0A66C2' },
              { icon: 'ri-youtube-line', href: 'https://youtube.com/channel/UCixQI2A67_pMgugbO-GYK6Q', color: '#FF0000' },
              { icon: 'ri-mail-line', href: 'mailto:0423doit@gmail.com', color: '#EA4335' },
            ].map((s) => (
              <a key={s.icon} href={s.href} target={s.href.startsWith('mailto') ? undefined : '_blank'} rel={s.href.startsWith('mailto') ? undefined : 'noopener noreferrer'} className="w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer" style={{ color: s.color, opacity: 0.55, borderColor: `${s.color}1a` }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = `${s.color}66`; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.borderColor = `${s.color}1a`; }}>
                <i className={`${s.icon} text-sm`} />
              </a>
            ))}
          </div>
          <div className="pb-6 sm:pb-8 w-full px-4 flex justify-center">
            <div className="relative w-full max-w-[400px]">
              <img
                src="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/9bc95002516015a7b549dd3cfe6a9311.jpeg"
                alt="ECHO"
                className="w-full h-auto object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={`text-[clamp(2.5rem,13vw,4.5rem)] font-bold tracking-[0.25em] uppercase ${isDarkMode ? 'text-white/90' : 'text-black/90'}`}
                  style={{ fontFamily: 'var(--font-heading, sans-serif)' }}
                >
                  ECHO
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <section id="hero" className="relative" style={{ height: '200vh' }}>
        <div className="sticky top-0 left-0 w-full h-screen">
          <Hero
            isDarkMode={isDarkMode}
            onTrialClick={handleTrialClick}
            musicPlaying={musicPlaying}
            onMusicToggle={toggleMusic}
          />
        </div>
      </section>

      <CinematicMarquee
        texts={MARQUEE_TEXTS}
        isDarkMode={isDarkMode}
        direction="forward"
        variant="default"
      />

      <ThreeEmotionsSection isDarkMode={isDarkMode} />

      <div className="md:-mt-[50vh] -mt-[30vh] relative z-20">
        <Section1 isDarkMode={isDarkMode} />
      </div>
      <Section2 isDarkMode={isDarkMode} onApproachClick={handleApproachClick} onAboutClick={handleAboutClick} />
      <CEOStatement isAuthenticated={isAuthenticated} onAuthRequired={() => setMemberGateOpen(true)} onFounderClick={handleFounderClick} />
      <CinematicMarquee
        texts={['CREATIVELY RATIONAL', 'HX DESIGN', '데이터 × 감성', 'RELATIONSHIP INTELLIGENCE', '정체성 회복', 'AI COACHING', 'HUMAN FIRST', 'ECHO']}
        isDarkMode={isDarkMode}
        direction="reverse"
        variant="accent"
      />
      <VideoSection isDarkMode={isDarkMode} />
      <Section3 isDarkMode={isDarkMode} />
      <Section4 isDarkMode={isDarkMode} />
      <Section5 isDarkMode={isDarkMode} />
      <VideoExamples isDarkMode={isDarkMode} />
      <MissionImpossibleSection onTrialClick={handleTrialClick} onMissionClick={handleMissionClick} />

      {/* ─── Report Experience Trigger ─── */}
      <div className="relative w-full overflow-hidden py-16 md:py-20" style={{ background: '#050505' }}>
        <div className="max-w-4xl mx-auto px-6 md:px-10 text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-8 h-[1px] bg-white/15" />
            <span className="text-[10px] font-mono tracking-[0.45em] uppercase text-white/30">Insight</span>
            <div className="w-8 h-[1px] bg-white/15" />
          </div>
          <h3 className="text-white text-2xl md:text-3xl font-bold tracking-tight mb-4">
            당신의 관계, 데이터로 읽어드립니다
          </h3>
          <p className="text-white/35 text-sm md:text-base mb-8 max-w-xl mx-auto">
            ECHO Report는 단순한 설문 결과가 아닙니다. 관계 속 감정과 선택의 패턴을 분석해, 오직 당신만을 위한 인사이트를 전달합니다.
          </p>
          <button
            onClick={handleReportClick}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(245,212,161,0.1), rgba(125,216,228,0.1))',
              border: '1px solid rgba(245,212,161,0.25)',
              color: '#F5D4A1',
            }}
          >
            <i className="ri-file-chart-line text-sm" />
            ECHO Report 미리보기
            <i className="ri-arrow-right-line transition-all duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      <DataSpeaksSection isDarkMode={isDarkMode} isAuthenticated={isAuthenticated} onAuthRequired={() => setMemberGateOpen(true)} onAIClick={handleAIClick} />
      <PatternEngineSection />
      <Section6 isDarkMode={isDarkMode} />
      <ElevatorSection isDarkMode={isDarkMode} />
      <ASection isDarkMode={isDarkMode} />
      <FindMeSection isDarkMode={isDarkMode} />
      <FaqSection isDarkMode={isDarkMode} />
      <Footer isDarkMode={isDarkMode} />

      <TrialFormModal
        isOpen={trialFormOpen}
        onClose={() => setTrialFormOpen(false)}
        isDarkMode={isDarkMode}
      />

      <MissionCinematicOverlay
        isOpen={missionCinematicOpen}
        onClose={() => setMissionCinematicOpen(false)}
        onTrialClick={handleOnboardingTrialClick}
      />

      <ApproachCinematicOverlay
        isOpen={isApproachOverlayOpen}
        onClose={() => setIsApproachOverlayOpen(false)}
        onTrialClick={handleTrialClick}
      />

      <OnboardingCinematicOverlay
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onTrialClick={handleOnboardingTrialClick}
      />

      <CinematicTransitionOverlay
        isActive={isCinematicTransitioning}
        onTransitionComplete={() => {
          setIsCinematicTransitioning(false);
          navigate('/auth');
        }}
      />

      <MemberGateModal
        isOpen={memberGateOpen}
        onClose={() => setMemberGateOpen(false)}
        isDarkMode={isDarkMode}
      />

      <PaymentGateModal
        isOpen={paymentGateOpen}
        onClose={() => setPaymentGateOpen(false)}
        isDarkMode={isDarkMode}
      />

      {/* ─── Experience Sequence Overlays ─── */}
      <SequenceOverlay
        isOpen={aboutSequenceOpen}
        onClose={() => setAboutSequenceOpen(false)}
        onTrialClick={handleOnboardingTrialClick}
        config={ABOUT_EXPERIENCE}
      />

      <SequenceOverlay
        isOpen={aiSequenceOpen}
        onClose={() => setAiSequenceOpen(false)}
        onTrialClick={handleOnboardingTrialClick}
        config={AI_EXPERIENCE}
      />

      <SequenceOverlay
        isOpen={founderSequenceOpen}
        onClose={() => setFounderSequenceOpen(false)}
        onTrialClick={handleOnboardingTrialClick}
        config={FOUNDER_EXPERIENCE}
      />

      <SequenceOverlay
        isOpen={reportSequenceOpen}
        onClose={() => setReportSequenceOpen(false)}
        onTrialClick={handleOnboardingTrialClick}
        config={REPORT_EXPERIENCE}
      />

      <FloatingAuthPill
        isDarkMode={isDarkMode}
        onActivate={() => setIsCinematicTransitioning(true)}
      />
    </div>
  );
}