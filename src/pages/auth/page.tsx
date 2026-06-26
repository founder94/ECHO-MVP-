import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import AuthCanvas from './components/AuthCanvas';
import TermsAgreement from './components/TermsAgreement';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'signup' | 'login';
type SignupStep = 'entry' | 'step1' | 'step2' | 'form' | 'completion';
type CanvasPhase = 'entry' | 'portal_forming' | 'portal_active' | 'selection' | 'form' | 'converge' | 'mirror';

const FORM_URL = 'https://readdy.ai/api/form/d8u28a4al24muhn2rdbg';

const SIGNUP_QUESTIONS = [
  {
    question: '당신은 지금 무엇을 찾고 있습니까?',
    options: ['나 자신을 더 이해하고 싶다', '관계를 돌아보고 싶다', '반복되는 패턴을 알고 싶다', '새로운 시작을 하고 싶다'],
    accentIndices: [0, 1, 2, 3],
  },
  {
    question: '당신은 지금 어떤 상태입니까?',
    options: ['요즘 나란 사람이 궁금하다', '비슷한 관계가 반복된다', '내 감정을 잘 모르겠다', '더 나은 관계를 준비 중이다'],
    accentIndices: [0, 1, 2, 3],
  },
];

const GOLD_ACCENT = '#FFD700';
const PINK_ACCENT = '#FF6B9D';
const PURPLE_ACCENT = '#9B59B6';

const textReveal = (el: HTMLElement, text: string, delay: number = 0, duration: number = 0.02) => {
  el.innerHTML = '';
  const chars = text.split('');
  chars.forEach((char) => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char;
    span.style.opacity = '0';
    span.style.display = 'inline-block';
    el.appendChild(span);
  });
  el.querySelectorAll('span').forEach((span, i) => {
    gsap.to(span, { opacity: 1, duration, delay: delay + i * 0.0175, ease: 'power2.out' });
  });
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, login, socialLogin } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>(searchParams.get('mode') === 'login' ? 'login' : 'signup');
  const [signupStep, setSignupStep] = useState<SignupStep>('entry');
  const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>('entry');
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showTabBar, setShowTabBar] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPasswordConfirm, setFormPasswordConfirm] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formAgeGroup, setFormAgeGroup] = useState('');
  const [termsServiceAgreed, setTermsServiceAgreed] = useState(false);
  const [termsPrivacyAgreed, setTermsPrivacyAgreed] = useState(false);
  const [termsSensitiveAgreed, setTermsSensitiveAgreed] = useState(false);
  const [termsAnonymousAgreed, setTermsAnonymousAgreed] = useState(false);
  const [termsAgeAgreed, setTermsAgeAgreed] = useState(false);
  const [termsMedicalAgreed, setTermsMedicalAgreed] = useState(false);
  const [termsHighlightErrors, setTermsHighlightErrors] = useState(false);

  const termsAllRequiredChecked = termsServiceAgreed && termsPrivacyAgreed && termsSensitiveAgreed && termsAgeAgreed && termsMedicalAgreed;
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formErrorMsg, setFormErrorMsg] = useState('');
  const [formFocused, setFormFocused] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginFocused, setLoginFocused] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [loginErrorMsg, setLoginErrorMsg] = useState('');
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [warpArrival, setWarpArrival] = useState(true);

  const entryLine1Ref = useRef<HTMLDivElement>(null);
  const entryLine2Ref = useRef<HTMLDivElement>(null);
  const entryLine3Ref = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Warp arrival effect — fade from black on page mount
  useEffect(() => {
    const timer = setTimeout(() => setWarpArrival(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Entry animation sequence
  useEffect(() => {
    const runEntry = async () => {
      setCanvasPhase('portal_forming');
      await new Promise(r => setTimeout(r, 1500));

      if (entryLine1Ref.current) textReveal(entryLine1Ref.current, '관계 속에서,');
      await new Promise(r => setTimeout(r, 750));

      if (entryLine2Ref.current) textReveal(entryLine2Ref.current, '혹은 문득,');
      await new Promise(r => setTimeout(r, 750));

      if (entryLine3Ref.current) textReveal(entryLine3Ref.current, '나를 만나는 여정');
      await new Promise(r => setTimeout(r, 1000));

      setCanvasPhase('portal_active');
      setShowTabBar(true);
    };
    runEntry();
  }, []);

  // Animate in question/cards
  const animateQuestionIn = useCallback(() => {
    if (questionRef.current) {
      gsap.fromTo(questionRef.current,
        { y: 40, opacity: 0, filter: 'blur(8px)' },
        { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' }
      );
    }
    if (cardsRef.current) {
      gsap.fromTo(cardsRef.current.children,
        { y: 30, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out', stagger: 0.04, delay: 0.15 }
      );
    }
  }, []);

  const animateQuestionOut = useCallback((onDone: () => void) => {
    if (questionRef.current) {
      gsap.to(questionRef.current, { opacity: 0, y: -30, duration: 0.25, ease: 'power2.in' });
    }
    if (cardsRef.current) {
      gsap.to(cardsRef.current.children, {
        opacity: 0, y: -25, duration: 0.2, stagger: 0.02, ease: 'power2.in',
        onComplete: () => { setTimeout(onDone, 100); },
      });
    }
  }, []);

  // Handle card selection
  const handleCardSelect = useCallback((optionIndex: number) => {
    if (selectedCard !== null) return;
    setSelectedCard(optionIndex);
    setCanvasPhase('selection');

    setTimeout(() => {
      const newAnswers = [...selectedAnswers, optionIndex];
      setSelectedAnswers(newAnswers);
      setSelectedCard(null);

      if (newAnswers.length < SIGNUP_QUESTIONS.length) {
        animateQuestionOut(() => {
          setSignupStep(newAnswers.length === 1 ? 'step2' : 'form');
          setCanvasPhase('portal_active');
        });
      } else {
        setSignupStep('form');
        setCanvasPhase('form');
      }
    }, 400);
  }, [selectedAnswers, selectedCard, animateQuestionOut]);

  // Animate in questions when step changes
  useEffect(() => {
    if ((signupStep === 'step1' || signupStep === 'step2') && authMode === 'signup') {
      setTimeout(animateQuestionIn, 200);
    }
  }, [signupStep, authMode, animateQuestionIn]);

  // Handle "회원가입 시작" from entry
  const handleStartSignup = () => {
    setShowTabBar(false);
    setSignupStep('step1');
    gsap.to('.entry-text-container', { opacity: 0, y: -30, duration: 0.4, ease: 'power2.in' });
  };

  // Handle signup form submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const honeypotEl = form.querySelector<HTMLInputElement>('[name="phone_alt"]');
    if (honeypotEl && honeypotEl.value.trim() !== '') {
      setFormStatus('success');
      setTimeout(() => playCompletion(), 2000);
      return;
    }

    // Validation
    if (!formEmail || !formPassword || !formPasswordConfirm) {
      setFormStatus('error');
      setFormErrorMsg('모든 필드를 입력해주세요');
      setTimeout(() => setFormStatus('idle'), 3000);
      return;
    }
    if (formPassword.length < 6) {
      setFormStatus('error');
      setFormErrorMsg('비밀번호는 6자 이상이어야 합니다');
      setTimeout(() => setFormStatus('idle'), 3000);
      return;
    }
    if (formPassword !== formPasswordConfirm) {
      setFormStatus('error');
      setFormErrorMsg('비밀번호가 일치하지 않습니다');
      setTimeout(() => setFormStatus('idle'), 3000);
      return;
    }
    if (!termsAllRequiredChecked) {
      setFormStatus('error');
      setFormErrorMsg('모든 필수 약관에 동의해주세요');
      setTermsHighlightErrors(true);
      setTimeout(() => {
        setFormStatus('idle');
        setTermsHighlightErrors(false);
      }, 3000);
      return;
    }

    setFormStatus('submitting');
    setFormErrorMsg('');

    const ageGroupValue = formAgeGroup || undefined;
    const result = await signup(formEmail, formPassword, formNickname || undefined, ageGroupValue, selectedAnswers);

    // Submit to Readdy form for lead capture
    const formData = new FormData(form);
    if (honeypotEl) formData.delete('phone_alt');

    try {
      const urlEncoded = new URLSearchParams(formData as any).toString();
      await fetch(FORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: urlEncoded,
      });
    } catch {
      // Readdy form failure is non-blocking — auth already succeeded
    }

    if (!result.success) {
      setFormStatus('error');
      setFormErrorMsg(result.error || '회원가입에 실패했습니다');
      setTimeout(() => setFormStatus('idle'), 3000);
      return;
    }

    setFormStatus('success');
    setTimeout(() => playCompletion(), 1500);
  };

  // Handle login form submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      setLoginStatus('error');
      setLoginErrorMsg('이메일과 비밀번호를 모두 입력해주세요');
      setTimeout(() => setLoginStatus('idle'), 3000);
      return;
    }

    setLoginStatus('submitting');
    setLoginErrorMsg('');

    const result = await login(loginEmail, loginPassword);

    if (!result.success) {
      setLoginStatus('error');
      setLoginErrorMsg(result.error || '로그인에 실패했습니다');
      setTimeout(() => setLoginStatus('idle'), 3000);
      return;
    }

    setLoginStatus('success');
    setTimeout(() => {
      navigate('/');
    }, 1000);
  };

  // Handle social login click
  // Google OAuth is configured in Supabase → live redirect.
  // Apple/Kakao are pending → show placeholder message.
  const handleSocialLogin = async (provider: string) => {
    const providerKey = provider.toLowerCase() as 'google' | 'apple' | 'kakao';

    // Only Google is configured — Apple & Kakao still pending
    if (providerKey !== 'google') {
      setSocialLoading(provider);
      await new Promise(r => setTimeout(r, 800));
      setSocialLoading(null);
      setLoginStatus('error');
      setLoginErrorMsg(`${provider} 소셜 로그인은 현재 설정 중입니다. 곧 제공됩니다.`);
      setTimeout(() => setLoginStatus('idle'), 4000);
      return;
    }

    setSocialLoading(provider);
    const result = await socialLogin(providerKey);

    if (result.success && result.url) {
      window.location.href = result.url;
      return;
    }

    setSocialLoading(null);
    setLoginStatus('error');
    setLoginErrorMsg(result.error || `${provider} 로그인 중 오류가 발생했습니다`);
    setTimeout(() => setLoginStatus('idle'), 4000);
  };

  const playCompletion = () => {
    setCanvasPhase('converge');
    setTimeout(() => setCanvasPhase('mirror'), 1000);
    setTimeout(() => {
      setSignupStep('completion');
      if (completionRef.current) {
        gsap.fromTo(completionRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.75, ease: 'power3.out' }
        );
      }
    }, 1500);
  };

  // Switch to signup from login
  const switchToSignup = () => {
    setAuthMode('signup');
    setSignupStep('step1');
    setSelectedAnswers([]);
    setCanvasPhase('portal_active');
    setFormStatus('idle');
    setFormErrorMsg('');
    setFormEmail('');
    setFormPassword('');
    setFormPasswordConfirm('');
    setFormNickname('');
    setFormAgeGroup('');
    setTermsServiceAgreed(false);
    setTermsPrivacyAgreed(false);
    setTermsSensitiveAgreed(false);
    setTermsAnonymousAgreed(false);
    setTermsAgeAgreed(false);
    setTermsMedicalAgreed(false);
    setTermsHighlightErrors(false);
    setLoginStatus('idle');
    setLoginErrorMsg('');
  };

  // Switch to login from signup
  const switchToLogin = () => {
    setAuthMode('login');
    setSignupStep('entry');
    setSelectedAnswers([]);
    setCanvasPhase('form');
    setLoginStatus('idle');
    setLoginErrorMsg('');
  };

  const currentQuestion = authMode === 'signup' && (signupStep === 'step1' || signupStep === 'step2')
    ? SIGNUP_QUESTIONS[signupStep === 'step1' ? 0 : 1]
    : null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Three.js Background */}
      <AuthCanvas phase={canvasPhase} mousePos={mousePos} />

      {/* Vignette overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Warp arrival overlay — fades from black */}
      <div
        className="fixed inset-0 z-50 pointer-events-none bg-black transition-opacity duration-350 ease-out"
        style={{ opacity: warpArrival ? 1 : 0 }}
      />
      {/* Warp flash ring */}
      <div
        className="fixed z-50 pointer-events-none rounded-full"
        style={{
          top: '50%',
          left: '50%',
          width: '60px',
          height: '60px',
          marginLeft: '-30px',
          marginTop: '-30px',
          border: '2px solid rgba(255,255,255,0.5)',
          opacity: warpArrival ? 0.6 : 0,
          transform: warpArrival ? 'scale(20)' : 'scale(1)',
          transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Close button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-5 right-5 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-300 cursor-pointer"
        aria-label="닫기"
      >
        <i className="ri-close-line text-lg" />
      </button>

      {/* === ENTRY PHASE === */}
      {showTabBar && signupStep === 'entry' && authMode === 'signup' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-10">
          <div className="entry-text-container text-center px-6">
            <div ref={entryLine1Ref} className="font-display font-bold tracking-tight leading-tight text-white mb-2"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }} />
            <div ref={entryLine2Ref} className="font-display font-bold tracking-tight leading-tight text-white mb-2"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }} />
            <div ref={entryLine3Ref} className="font-display font-bold tracking-tight leading-tight mb-8"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} />

            {/* Tab bar */}
            <div className="flex items-center justify-center gap-1 mb-10">
              <div className="inline-flex rounded-full p-1 border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                <button
                  onClick={handleStartSignup}
                  className="px-6 py-2.5 rounded-full text-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300 cursor-pointer bg-white text-black"
                >
                  회원가입
                </button>
                <button
                  onClick={switchToLogin}
                  className="px-6 py-2.5 rounded-full text-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300 cursor-pointer text-white/60 hover:text-white/90"
                >
                  로그인
                </button>
              </div>
            </div>

            <p className="text-white/30 text-xs font-mono tracking-[0.2em] uppercase">
              Press ESC to return
            </p>
          </div>
        </div>
      )}

      {/* === SIGNUP STEP 1 & 2 === */}
      {authMode === 'signup' && currentQuestion && (
        <div className="fixed inset-0 flex items-center justify-center z-10 px-4">
          <div className="text-center max-w-lg w-full">
            <div
              ref={questionRef}
              className="font-display font-bold tracking-tight leading-tight mb-10 text-white"
              style={{ fontSize: 'clamp(1.3rem, 3vw, 2rem)' }}
            >
              {currentQuestion.question}
            </div>
            <div ref={cardsRef} className="flex flex-col gap-3">
              {currentQuestion.options.map((option, i) => {
                const isSelected = selectedCard === i;
                const accents = [PINK_ACCENT, PURPLE_ACCENT, GOLD_ACCENT, '#FF8C69'];
                const accent = accents[i % 4];
                return (
                  <button
                    key={i}
                    onClick={() => handleCardSelect(i)}
                    disabled={selectedCard !== null}
                    className={`group relative px-6 py-4 rounded-xl border transition-all duration-500 cursor-pointer text-left overflow-hidden ${
                      isSelected
                        ? 'border-white/40 bg-white/[0.08] scale-105 shadow-lg'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                    } ${selectedCard !== null && !isSelected ? 'opacity-30' : 'opacity-100'}`}
                    style={isSelected ? { boxShadow: `0 0 30px ${accent}20, 0 0 60px ${accent}08` } : {}}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `linear-gradient(135deg, ${accent}08, transparent)` }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}12, transparent)` }} />
                    )}
                    <div className="relative flex items-center gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border transition-all duration-300"
                        style={{
                          borderColor: isSelected ? accent : 'rgba(255,255,255,0.15)',
                          color: isSelected ? accent : 'rgba(255,255,255,0.7)',
                          background: isSelected ? `${accent}15` : 'transparent',
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-sm font-medium tracking-wide text-white/85">{option}</span>
                      <i className={`ri-arrow-right-line ml-auto text-sm transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
                        style={{ color: isSelected ? accent : 'rgba(255,255,255,0.4)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-8 text-white/20 text-[10px] font-mono tracking-[0.15em]">
              {signupStep === 'step1' ? '1 / 3' : '2 / 3'}
            </p>
          </div>
        </div>
      )}

      {/* === SIGNUP FORM === */}
      {authMode === 'signup' && signupStep === 'form' && (
        <div className="fixed inset-0 flex items-center justify-center z-10 px-4">
          <div className="w-full max-w-md">
            <div
              ref={cardsRef}
              className="rounded-2xl border border-white/[0.08] p-8"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
            >
              <h2 className="font-display font-bold text-2xl text-white mb-2 tracking-tight">계정 만들기</h2>
              <p className="text-white/35 text-sm mb-8">ECHO 여정을 시작할 준비가 되셨나요?</p>

              <form data-readdy-form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
                <input type="text" name="phone_alt" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />

                {/* Email */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">이메일</label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: formFocused === 'email' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      onFocus={() => setFormFocused('email')}
                      onBlur={() => setFormFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-300"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                      placeholder="hello@example.com"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">비밀번호</label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: formFocused === 'password' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <input
                      type="password"
                      name="password"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      onFocus={() => setFormFocused('password')}
                      onBlur={() => setFormFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-300"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Password Confirm */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">비밀번호 확인</label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: formFocused === 'pwconfirm' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <input
                      type="password"
                      required
                      value={formPasswordConfirm}
                      onChange={(e) => setFormPasswordConfirm(e.target.value)}
                      onFocus={() => setFormFocused('pwconfirm')}
                      onBlur={() => setFormFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-300"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                      placeholder="••••••••"
                    />
                  </div>
                  {formPasswordConfirm && formPassword !== formPasswordConfirm && (
                    <p className="text-red-400/70 text-[10px] mt-1 pl-1">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>

                {/* Nickname */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">닉네임</label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: formFocused === 'nickname' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <input
                      type="text"
                      name="nickname"
                      value={formNickname}
                      onChange={(e) => setFormNickname(e.target.value)}
                      onFocus={() => setFormFocused('nickname')}
                      onBlur={() => setFormFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-300"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                      placeholder="ECHO에서 사용할 이름"
                    />
                  </div>
                </div>

                {/* Age Group */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">연령대 <span className="opacity-40">(선택)</span></label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: formFocused === 'agegroup' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <select
                      name="age_group"
                      value={formAgeGroup}
                      onChange={(e) => setFormAgeGroup(e.target.value)}
                      onFocus={() => setFormFocused('agegroup')}
                      onBlur={() => setFormFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all duration-300 appearance-none cursor-pointer"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                    >
                      <option value="" className="bg-[#1a1a1a] text-white/40">선택해주세요</option>
                      <option value="10s" className="bg-[#1a1a1a] text-white">10대</option>
                      <option value="20s" className="bg-[#1a1a1a] text-white">20대</option>
                      <option value="30s" className="bg-[#1a1a1a] text-white">30대</option>
                      <option value="40s" className="bg-[#1a1a1a] text-white">40대</option>
                      <option value="50s" className="bg-[#1a1a1a] text-white">50대</option>
                      <option value="60s" className="bg-[#1a1a1a] text-white">60대 이상</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <i className="ri-arrow-down-s-line text-white/30 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Terms Agreement */}
                <TermsAgreement
                  serviceAgreed={termsServiceAgreed}
                  onServiceAgreedChange={setTermsServiceAgreed}
                  privacyAgreed={termsPrivacyAgreed}
                  onPrivacyAgreedChange={setTermsPrivacyAgreed}
                  sensitiveAgreed={termsSensitiveAgreed}
                  onSensitiveAgreedChange={setTermsSensitiveAgreed}
                  anonymousAgreed={termsAnonymousAgreed}
                  onAnonymousAgreedChange={setTermsAnonymousAgreed}
                  ageAgreed={termsAgeAgreed}
                  onAgeAgreedChange={setTermsAgeAgreed}
                  medicalAgreed={termsMedicalAgreed}
                  onMedicalAgreedChange={setTermsMedicalAgreed}
                  highlightErrors={termsHighlightErrors}
                />

                <button
                  type="submit"
                  disabled={formStatus === 'submitting' || !termsAllRequiredChecked}
                  className="w-full rounded-full px-6 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
                  style={{
                    background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})`,
                    color: '#FFFFFF',
                    boxShadow: `0 0 40px ${PINK_ACCENT}20`,
                  }}
                >
                  {formStatus === 'submitting' ? (
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-loader-4-line animate-spin" />
                      계정 생성 중...
                    </span>
                  ) : '계정 만들기'}
                </button>

                {formStatus === 'error' && formErrorMsg && (
                  <div className="text-center py-2.5 rounded-lg text-xs bg-red-500/10 text-red-400/80 border border-red-500/15">
                    <i className="ri-error-warning-line mr-1.5" />{formErrorMsg}
                  </div>
                )}
              </form>

              {/* Social login */}
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-white/20 text-[10px] font-mono tracking-[0.15em] uppercase">간편 가입</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { icon: 'ri-google-line', label: 'Google로 계속하기', color: '#4285F4', provider: 'Google' },
                    { icon: 'ri-apple-line', label: 'Apple로 계속하기', color: '#FFFFFF', provider: 'Apple' },
                    { icon: 'ri-kakao-talk-line', label: '카카오로 계속하기', color: '#FEE500', provider: '카카오' },
                  ].map((social) => (
                    <button
                      key={social.label}
                      onClick={() => handleSocialLogin(social.provider)}
                      disabled={socialLoading !== null}
                      className="w-full rounded-full px-4 py-3 text-sm font-medium tracking-wide transition-all duration-300 cursor-pointer border border-white/[0.08] flex items-center justify-center gap-3 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {socialLoading === social.provider ? (
                        <i className="ri-loader-4-line animate-spin text-white/60" />
                      ) : (
                        <i className={social.icon} style={{ color: social.color, fontSize: '1.1rem' }} />
                      )}
                      <span className="text-white/70 text-xs">{social.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-6 text-center text-white/25 text-xs">
                이미 계정이 있나요?{' '}
                <button onClick={switchToLogin} className="text-white/60 hover:text-white/90 underline cursor-pointer transition-colors">
                  로그인
                </button>
              </p>

              {/* Legal disclaimer */}
              <div className="mt-6 pt-5 border-t border-white/[0.04]">
                <p className="text-white/15 text-[9px] leading-relaxed text-center">
                  ECHO는 의료, 심리치료, 상담, 법률, 점술 서비스가 아닙니다.
                  <br />
                  관계 경험을 바탕으로 자기이해를 돕는 정보 서비스입니다.
                  <br />
                  AI 응답은 참고용이며 판단, 진단, 치료, 법률 자문을 제공하지 않습니다.
                  <br />
                  위급 상황에서는 112, 119 또는 전문기관에 도움을 요청해 주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === LOGIN FORM === */}
      {authMode === 'login' && (
        <div className="fixed inset-0 flex items-center justify-center z-10 px-4">
          <div className="w-full max-w-md">
            <div
              className="rounded-2xl border border-white/[0.08] p-8"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
            >
              <div className="mb-6 text-center">
                <h2 className="font-display font-bold text-2xl text-white mb-2 tracking-tight">다시 돌아오신 것을 환영합니다</h2>
                <p className="text-white/35 text-sm">당신의 여정은 아직 끝나지 않았습니다</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                {/* Email */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">이메일</label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: loginFocused === 'email' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      onFocus={() => setLoginFocused('email')}
                      onBlur={() => setLoginFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-300"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                      placeholder="hello@example.com"
                      disabled={loginStatus === 'submitting' || loginStatus === 'success'}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="relative">
                  <label className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-1.5 block">비밀번호</label>
                  <div className="relative rounded-xl overflow-hidden" style={{ padding: '1px', background: loginFocused === 'password' ? `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})` : 'transparent' }}>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onFocus={() => setLoginFocused('password')}
                      onBlur={() => setLoginFocused(null)}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-300"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                      placeholder="••••••••"
                      disabled={loginStatus === 'submitting' || loginStatus === 'success'}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginStatus === 'submitting' || loginStatus === 'success'}
                  className="w-full rounded-full px-6 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
                  style={{
                    background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})`,
                    color: '#FFFFFF',
                    boxShadow: `0 0 40px ${PINK_ACCENT}20`,
                  }}
                >
                  {loginStatus === 'submitting' ? (
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-loader-4-line animate-spin" />
                      로그인 중...
                    </span>
                  ) : loginStatus === 'success' ? (
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-check-line" />
                      로그인 성공!
                    </span>
                  ) : 'ECHO로 돌아가기'}
                </button>

                {loginStatus === 'error' && loginErrorMsg && (
                  <div className={`text-center py-2.5 rounded-lg text-xs border transition-all duration-300 ${
                    loginErrorMsg.includes('Supabase')
                      ? 'bg-yellow-500/10 text-yellow-400/80 border-yellow-500/15'
                      : 'bg-red-500/10 text-red-400/80 border-red-500/15'
                  }`}>
                    <i className={`${loginErrorMsg.includes('Supabase') ? 'ri-information-line' : 'ri-error-warning-line'} mr-1.5`} />
                    {loginErrorMsg}
                  </div>
                )}
              </form>

              {/* Social login */}
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-white/20 text-[10px] font-mono tracking-[0.15em] uppercase">간편 로그인</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { icon: 'ri-google-line', label: 'Google 로그인', color: '#4285F4', provider: 'Google' },
                    { icon: 'ri-apple-line', label: 'Apple 로그인', color: '#FFFFFF', provider: 'Apple' },
                    { icon: 'ri-kakao-talk-line', label: '카카오 로그인', color: '#FEE500', provider: '카카오' },
                  ].map((social) => (
                    <button
                      key={social.label}
                      onClick={() => handleSocialLogin(social.provider)}
                      disabled={socialLoading !== null || loginStatus === 'submitting'}
                      className="w-full rounded-full px-4 py-3 text-sm font-medium tracking-wide transition-all duration-300 cursor-pointer border border-white/[0.08] flex items-center justify-center gap-3 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {socialLoading === social.provider ? (
                        <i className="ri-loader-4-line animate-spin text-white/60" />
                      ) : (
                        <i className={social.icon} style={{ color: social.color, fontSize: '1.1rem' }} />
                      )}
                      <span className="text-white/70 text-xs">{social.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-6 text-center text-white/25 text-xs">
                계정이 없나요?{' '}
                <button onClick={switchToSignup} className="text-white/60 hover:text-white/90 underline cursor-pointer transition-colors">
                  회원가입
                </button>
              </p>

              <div className="mt-4 text-center">
                <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/60 text-xs cursor-pointer transition-colors">
                  ← 홈으로 돌아가기
                </button>
              </div>

              {/* Legal disclaimer */}
              <div className="mt-6 pt-5 border-t border-white/[0.04]">
                <p className="text-white/15 text-[9px] leading-relaxed text-center">
                  ECHO는 의료, 심리치료, 상담, 법률, 점술 서비스가 아닙니다.
                  <br />
                  관계 경험을 바탕으로 자기이해를 돕는 정보 서비스입니다.
                  <br />
                  AI 응답은 참고용이며 판단, 진단, 치료, 법률 자문을 제공하지 않습니다.
                  <br />
                  위급 상황에서는 112, 119 또는 전문기관에 도움을 요청해 주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === COMPLETION === */}
      {authMode === 'signup' && signupStep === 'completion' && (
        <div className="fixed inset-0 flex items-center justify-center z-10 px-4">
          <div ref={completionRef} className="text-center max-w-md">
            <div
              className="font-display font-bold tracking-[0.2em] mb-8"
              style={{
                fontSize: 'clamp(3rem, 10vw, 7rem)',
                background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 80px rgba(255,107,157,0.4))',
              }}
            >
              ECHO
            </div>

            <div className="space-y-3 mb-10">
              <p className="text-white/70 font-display text-lg leading-relaxed">축하합니다.</p>
              <p className="text-white/50 font-display leading-relaxed">당신의 계정이 만들어졌습니다.</p>
              <p className="text-white/35 text-sm leading-relaxed mt-4">
                하지만 ECHO의 목적은<br />
                계정을 만드는 것이 아닙니다.
              </p>
              <p className="text-white/50 font-display leading-relaxed mt-4">
                관계 속에서, 혹은 문득,<br />
                진짜 나를 다시 만나는 것입니다.
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})`,
                color: '#FFFFFF',
                boxShadow: `0 0 50px ${PINK_ACCENT}30`,
              }}
            >
              ECHO 시작하기
              <i className="ri-arrow-right-line" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}