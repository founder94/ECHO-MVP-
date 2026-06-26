import { useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';
import type { ApproachParticlesRef } from './ApproachParticles';
import MagneticButton from '@/components/base/MagneticButton';

const STORAGE_KEY = 'echo_approach_history';

interface SavedSession {
  selections: number[];
  timestamp: number;
  choices: string[];
}

const FLOW_DATA = [
  {
    step: 1,
    title: '감정의 흐름을 읽다',
    subtitle: 'Reading the Flow of Emotions',
    question: '지금 당신의 감정은 어디에서 멈춰 있나요?',
    choices: [
      '아직 끝나지 않은 말',
      '반복되는 생각',
      '이해되지 않는 상대의 행동',
      '내가 왜 힘든지 모르겠음',
    ],
    color: '#FF6B9D',
  },
  {
    step: 2,
    title: '사실과 해석을 분리하다',
    subtitle: 'Separating Facts from Interpretations',
    question: '당신이 실제로 겪은 일과, 마음속에서 해석한 이야기는 무엇이 다른가요?',
    choices: [
      '실제 사건 적기',
      '내가 만든 해석 적기',
      '둘 다 모르겠음',
    ],
    color: '#9B59B6',
  },
  {
    step: 3,
    title: '나의 반복 패턴을 발견하다',
    subtitle: 'Discovering My Recurring Patterns',
    question: '비슷한 관계에서 당신은 어떤 행동을 반복했나요?',
    choices: [
      '맞춰주기',
      '기다리기',
      '숨기기',
      '확인받기',
      '먼저 포기하기',
    ],
    color: '#FFD700',
  },
  {
    step: 4,
    title: '다음 한 걸음을 정하다',
    subtitle: 'Deciding the Next Step',
    question: '지금 당신에게 필요한 것은 무엇인가요?',
    choices: [
      '정리하기',
      '말하기',
      '멈추기',
      '다시 시작하기',
    ],
    color: '#FF7F50',
  },
];

function loadHistory(): SavedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveHistory(session: SavedSession) {
  try {
    const history = loadHistory();
    history.unshift(session);
    if (history.length > 10) history.length = 10;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage might be full, silently ignore
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}

interface Props {
  particlesRef: React.RefObject<ApproachParticlesRef | null>;
  onClose: () => void;
  onTrialClick: () => void;
}

export default function ApproachFlow({ particlesRef, onClose, onTrialClick }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<number[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number>(0);

  const currentData = FLOW_DATA[currentStep];
  const isEnding = currentStep >= FLOW_DATA.length;

  useEffect(() => {
    setSavedSessions(loadHistory());
  }, []);

  useEffect(() => {
    if (isEnding && selections.length === FLOW_DATA.length && !sessionSaved) {
      const choices = selections.map((s, i) => FLOW_DATA[i].choices[s]);
      saveHistory({ selections, timestamp: Date.now(), choices });
      setSessionSaved(true);
      setSavedSessions(loadHistory());
    }
  }, [isEnding, selections, sessionSaved]);

  // 3D rotating number
  useEffect(() => {
    const animate = () => {
      rotationRef.current += 0.5;
      if (numberRef.current) {
        numberRef.current.style.transform = `perspective(1000px) rotateY(${rotationRef.current}deg)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Enter animation
  useEffect(() => {
    if (!containerRef.current || isTransitioning) return;
    const els = containerRef.current.querySelectorAll('.animate-in');
    gsap.fromTo(els,
      { y: 60, opacity: 0, filter: 'blur(10px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, stagger: 0.08, ease: 'power3.out', delay: 0.2 }
    );
  }, [currentStep, isTransitioning]);

  const handleChoice = useCallback((choiceIndex: number, e: React.MouseEvent) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    particlesRef.current?.triggerSuction(centerX, centerY);

    if (containerRef.current) {
      gsap.to(containerRef.current.querySelectorAll('.animate-in'), {
        y: -40,
        opacity: 0,
        scale: 1.05,
        filter: 'blur(8px)',
        duration: 0.4,
        stagger: 0.03,
        ease: 'power2.in',
        onComplete: () => {
          setSelections(prev => [...prev, choiceIndex]);
          const nextStep = currentStep + 1;
          setCurrentStep(nextStep);
          particlesRef.current?.zoomToStep(nextStep);
          setIsTransitioning(false);
        }
      });
    }
  }, [currentStep, isTransitioning, particlesRef]);

  const handleBack = useCallback(() => {
    if (currentStep === 0 || isTransitioning) return;
    setIsTransitioning(true);

    gsap.to(containerRef.current?.querySelectorAll('.animate-in'), {
      y: 40,
      opacity: 0,
      scale: 0.95,
      filter: 'blur(8px)',
      duration: 0.4,
      stagger: 0.03,
      ease: 'power2.in',
      onComplete: () => {
        setSelections(prev => prev.slice(0, -1));
        const prevStep = currentStep - 1;
        setCurrentStep(prevStep);
        particlesRef.current?.zoomToStep(prevStep);
        setIsTransitioning(false);
      }
    });
  }, [currentStep, isTransitioning, particlesRef]);

  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setSelections([]);
    setSessionSaved(false);
    setShowHistory(false);
    particlesRef.current?.zoomToStep(0);
  }, [particlesRef]);

  const handleDeleteHistory = useCallback(() => {
    clearHistory();
    setSavedSessions([]);
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-4 md:px-8 overflow-y-auto" style={{ zIndex: 10 }}>
      {/* 3D Rotating Number */}
      {!showHistory && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div
            ref={numberRef}
            className="font-display font-bold select-none"
            style={{
              fontSize: 'clamp(8rem, 25vw, 22rem)',
              color: isEnding ? '#FF6B9D' : (currentData?.color || '#FF6B9D'),
              opacity: 0.08,
              textShadow: `0 0 150px ${isEnding ? '#FF6B9D' : (currentData?.color || '#FF6B9D')}60`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}
          >
            {isEnding ? 'ECHO' : String(currentData?.step || 1).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* History View */}
      {showHistory && (
        <div className="relative w-full max-w-xl flex flex-col items-center py-10 px-4">
          <div className="animate-in text-center mb-8">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-white mb-2">이전 감정 기록</h2>
            <p className="text-sm text-white/40">지금까지 탐색한 감정 여정을 다시 볼 수 있어요</p>
          </div>

          {savedSessions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/30 text-sm">아직 저장된 기록이 없어요</p>
              <button onClick={() => setShowHistory(false)} className="mt-6 text-white/40 text-sm hover:text-white/70 transition-colors cursor-pointer">
                <i className="ri-arrow-left-line mr-1" /> 돌아가기
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {savedSessions.map((session, si) => (
                <div key={session.timestamp} className="animate-in rounded-xl p-5 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25">{formatDate(session.timestamp)}</span>
                    <span className="text-[10px] font-mono text-white/15">#{savedSessions.length - si}</span>
                  </div>
                  <div className="space-y-2">
                    {session.choices.map((choice, ci) => (
                      <div key={ci} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 border border-white/15 text-white/30" style={{ color: FLOW_DATA[ci].color }}>
                          {String(ci + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm text-white/60">{choice}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/[0.05]">
                    <p className="text-xs text-white/30">
                      {session.choices.join(' → ')}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-4">
                <button onClick={() => setShowHistory(false)} className="text-white/40 text-sm hover:text-white/70 transition-colors cursor-pointer">
                  <i className="ri-arrow-left-line mr-1" /> 돌아가기
                </button>
                <button onClick={handleDeleteHistory} className="text-red-400/40 text-xs hover:text-red-400/70 transition-colors cursor-pointer">
                  <i className="ri-delete-bin-line mr-1" /> 기록 삭제
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Flow */}
      {!showHistory && (
        <div ref={containerRef} className="relative w-full max-w-2xl flex flex-col items-center py-10">
          {!isEnding && currentData && (
            <>
              {/* Step indicator */}
              <div className="animate-in flex items-center gap-2 mb-6 md:mb-8">
                {FLOW_DATA.map((_, i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: i === currentStep ? 32 : 12,
                      background: i === currentStep ? currentData.color : 'rgba(255,255,255,0.15)',
                      boxShadow: i === currentStep ? `0 0 12px ${currentData.color}60` : 'none',
                    }}
                  />
                ))}
              </div>

              {/* Title */}
              <div className="animate-in text-center mb-3">
                <h2
                  className="font-display font-bold tracking-tight leading-tight"
                  style={{
                    fontSize: 'clamp(1.8rem, 5vw, 3rem)',
                    color: '#FFFFFF',
                    textShadow: `0 0 60px ${currentData.color}30`,
                  }}
                >
                  {currentData.title}
                </h2>
                <p className="text-xs font-medium tracking-[0.3em] uppercase mt-2" style={{ color: currentData.color, opacity: 0.7 }}>
                  {currentData.subtitle}
                </p>
              </div>

              {/* Question */}
              <div className="animate-in text-center mb-8 md:mb-10">
                <p className="text-base md:text-lg font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 0 30px rgba(255,255,255,0.1)' }}>
                  {currentData.question}
                </p>
              </div>

              {/* Choice Cards */}
              <div className="animate-in w-full grid grid-cols-1 gap-3 md:gap-4">
                {currentData.choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={(e) => handleChoice(i, e)}
                    className="group relative w-full text-left rounded-2xl p-4 md:p-5 transition-all duration-200 active:scale-[0.98] cursor-pointer overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Light trail */}
                    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-0">
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(90deg, transparent, rgba(255,107,157,0.3), rgba(155,89,182,0.3), rgba(255,215,0,0.3), transparent)',
                          transform: 'translateX(-100%) skewX(-15deg)',
                          animation: 'approach-shine-pass 0.5s ease-out infinite',
                        }}
                      />
                    </div>
                    {/* Glow on hover */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, ${currentData.color}15, transparent, ${currentData.color}15)`,
                      }}
                    />
                    <span className="relative text-white/90 font-medium text-sm md:text-base">
                      {choice}
                    </span>
                  </button>
                ))}
              </div>

              {/* Back button */}
              {currentStep > 0 && (
                <div className="animate-in mt-6">
                  <button
                    onClick={handleBack}
                    className="text-white/30 text-sm hover:text-white/60 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <i className="ri-arrow-left-line text-xs" /> 이전 단계
                  </button>
                </div>
              )}
            </>
          )}

          {isEnding && (
            <div className="animate-in text-center flex flex-col items-center">
              <div
                className="font-display font-bold tracking-[0.15em] mb-6"
                style={{
                  fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                  background: 'linear-gradient(135deg, #FF6B9D, #FF8C69, #9B59B6, #FFD700)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 40px rgba(255,107,157,0.4))',
                }}
              >
                ECHO
              </div>
              <p className="text-lg md:text-xl font-medium text-white/80 mb-4 leading-relaxed">
                당신의 감정 데이터를 분석하고,<br />
                반복 패턴을 찾아드립니다.
              </p>
              <p className="text-sm text-white/40 mb-2">
                {selections.map((s, i) => FLOW_DATA[i].choices[s]).join(' → ')}
              </p>
              {sessionSaved && (
                <p className="text-[10px] font-mono text-green-400/50 mb-8 animate-in">
                  <i className="ri-check-line mr-1" />감정 기록이 저장되었습니다
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                <MagneticButton
                  onClick={() => { onClose(); setTimeout(onTrialClick, 300); }}
                  variant="primary"
                  size="md"
                  className="text-sm font-medium"
                >
                  시작하기
                  <i className="ri-arrow-right-line text-xs" />
                </MagneticButton>
                <MagneticButton
                  onClick={onClose}
                  variant="outline"
                  size="md"
                  className="text-sm font-medium"
                >
                  사이트로 돌아가기
                </MagneticButton>
              </div>
              <div className="flex items-center gap-6 mt-6">
                <MagneticButton
                  onClick={handleRestart}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  <i className="ri-restart-line text-xs" />
                  다시 시작하기
                </MagneticButton>
                {savedSessions.length > 0 && (
                  <MagneticButton
                    onClick={() => setShowHistory(true)}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    <i className="ri-history-line text-xs" />
                    이전 기록 보기
                  </MagneticButton>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}