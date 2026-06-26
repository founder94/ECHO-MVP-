import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const GOLD_ACCENT = '#FFD700';
const PINK_ACCENT = '#FF6B9D';
const PURPLE_ACCENT = '#9B59B6';

interface ReportData {
  report: string;
  model_used: string;
  tokens_used: number;
  response_time_ms: number;
  total_time_ms: number;
  safety_triggered: boolean;
  generated_at: string;
}

// Parse markdown report into sections with Korean support
function parseReportSections(markdown: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = markdown.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      if (currentTitle && currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      }
      currentTitle = match[1].trim();
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }

  if (currentTitle && currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }

  // If no ## headers found, treat whole text as one section
  if (sections.length === 0 && markdown.trim()) {
    sections.push({ title: 'ECHO 분석 리포트', content: markdown.trim() });
  }

  return sections;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [status, setStatus] = useState<'loading' | 'generating' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [visibleSections, setVisibleSections] = useState<number>(0);
  const [warpIn, setWarpIn] = useState(true);
  const [whiteDoorOpen, setWhiteDoorOpen] = useState(false);
  const [whiteDoorRevealed, setWhiteDoorRevealed] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Warp-in effect
  useEffect(() => {
    const timer = setTimeout(() => setWarpIn(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Fetch onboarding answers and call AI
  const fetchAndAnalyze = useCallback(async () => {
    if (!currentUser) return;

    setStatus('generating');

    try {
      // ─── PRIORITY: localStorage (onboarding flow saves here) ───
      let answers: string[] = [];
      const storedAnswers = localStorage.getItem('echo_onboarding_answers');
      if (storedAnswers) {
        try {
          const parsed = JSON.parse(storedAnswers);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            answers = parsed;
          }
        } catch { /* ignore */ }
      }

      // ─── FALLBACK: profiles table (signup onboarding answers) ───
      if (answers.length === 0) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('onboarding_answers, name, email')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!profileErr && profile?.onboarding_answers && Array.isArray(profile.onboarding_answers)) {
          const raw = profile.onboarding_answers as number[];
          const answerMap: string[][] = [
            ['그냥 궁금해서', '심심해서 한번 해보고 싶어서', '나를 더 알고 싶어서', '누군가와의 관계가 떠올라서', '반복되는 내 선택이 궁금해서', '최근 있었던 일을 정리하고 싶어서'],
            ['연인', '썸 / 호감', '친구', '가족', '직장 / 동료', '아직 특정한 사람은 없음'],
            ['나는 어떤 사람인지', '왜 비슷한 선택을 반복하는지', '상대와 나의 관계 흐름이 어땠는지', '내 감정이 어디서 시작됐는지', '앞으로 어떻게 행동하면 좋을지', '그냥 AI가 나를 어떻게 비추는지'],
          ];
          answers = raw.map((idx, i) => {
            if (answerMap[i] && idx >= 0 && idx < answerMap[i].length) {
              return answerMap[i][idx];
            }
            return `응답 ${idx}`;
          });
        }
      }

      // Build contact info
      const storedContact = localStorage.getItem('echo_contact_info');
      let contactInfo: { name?: string; email?: string } = {};
      if (storedContact) {
        try {
          contactInfo = JSON.parse(storedContact);
        } catch { /* ignore */ }
      }

      // Fallback contact from profile or email
      if (!contactInfo.name) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profile?.name) {
          contactInfo.name = profile.name;
        } else {
          contactInfo.name = currentUser.email?.split('@')[0] || '';
        }
        if (profile?.email) {
          contactInfo.email = contactInfo.email || profile.email;
        }
      }
      if (!contactInfo.email) {
        contactInfo.email = currentUser.email || '';
      }

      // Call Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const fnUrl = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/echo-ai-analysis`;
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers, contactInfo, userId: currentUser.id }),
      });

      if (!fnRes.ok) {
        let errData: any = {};
        try { errData = await fnRes.json(); } catch { /* ignore */ }
        const errMsg = errData.error || `서버 오류 (HTTP ${fnRes.status})`;
        const errCode = errData.error_code || 'UNKNOWN';
        console.error(`[ECHO AI] Edge Function error [${errCode}]:`, errMsg);
        throw new Error(errMsg);
      }

      const data: ReportData = await fnRes.json();
      setReportData(data);
      setStatus('done');

      // Clean up localStorage
      localStorage.removeItem('echo_onboarding_answers');
      localStorage.removeItem('echo_contact_info');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || '분석 중 오류가 발생했습니다');
      setStatus('error');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && status === 'loading') {
      fetchAndAnalyze();
    }
  }, [currentUser, status, fetchAndAnalyze]);

  // Animate sections in, then trigger White Door
  useEffect(() => {
    if (status !== 'done' || !reportData) return;

    const sections = parseReportSections(reportData.report);
    const ctx = gsap.context(() => {
      sectionsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 30, filter: 'blur(8px)' },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.8,
            delay: 0.3 + i * 0.25,
            ease: 'power3.out',
            onStart: () => setVisibleSections((prev) => prev + 1),
            onComplete: () => {
              if (i === sections.length - 1) {
                setTimeout(() => setWhiteDoorRevealed(true), 600);
              }
            },
          }
        );
      });
    }, reportRef);

    return () => ctx.revert();
  }, [status, reportData]);

  if (authLoading || status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="font-display font-bold tracking-[0.3em] text-4xl mb-6"
            style={{
              background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ECHO
          </div>
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
          <p className="text-white/25 text-xs mt-4 font-mono tracking-[0.15em]">LOADING</p>
        </div>
      </div>
    );
  }

  const sections = reportData ? parseReportSections(reportData.report) : [];

  return (
    <div className="fixed inset-0 bg-black overflow-y-auto">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,107,157,0.04) 0%, transparent 60%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)' }} />

      {/* Warp arrival */}
      <div
        className="fixed inset-0 z-50 pointer-events-none bg-black transition-opacity duration-400 ease-out"
        style={{ opacity: warpIn ? 1 : 0 }}
      />

      {/* Close button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-4 right-4 z-50 w-11 h-11 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/50 hover:text-white/90 hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all duration-300 cursor-pointer touch-manipulation"
        aria-label="닫기"
      >
        <i className="ri-close-line text-base md:text-lg" />
      </button>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-20">
        {/* Generating state */}
        {status === 'generating' && (
          <div className="text-center max-w-md" ref={reportRef}>
            <div
              className="font-display font-bold tracking-[0.2em] mb-6"
              style={{
                fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 60px rgba(255,107,157,0.4))',
              }}
            >
              ECHO
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
            <p className="text-white/50 font-display text-lg leading-relaxed">
              당신의 관계 데이터를 분석하고 있습니다
            </p>
            <p className="text-white/20 text-sm mt-3 leading-relaxed">
              ECHO가 당신의 답변에서<br />
              패턴과 감정의 흐름을 읽어내고 있습니다
            </p>
            <p className="text-white/10 text-[10px] mt-6 font-mono tracking-[0.2em] uppercase">
              AI Generating...
            </p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="text-center max-w-md">
            <div className="text-6xl mb-6">🔮</div>
            <h2 className="font-display font-bold text-2xl text-white mb-4 tracking-tight">
              잠시 후 다시 시도해 주세요
            </h2>
            <p className="text-white/35 text-sm leading-relaxed mb-6">{errorMsg}</p>
            <button
              onClick={() => { setStatus('loading'); setErrorMsg(''); }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 touch-manipulation"
              style={{
                background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})`,
                color: '#FFFFFF',
                boxShadow: `0 0 30px ${PINK_ACCENT}20`,
              }}
            >
              다시 시도하기
              <i className="ri-refresh-line" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="block mx-auto mt-4 text-white/25 text-xs hover:text-white/50 transition-colors cursor-pointer"
            >
              ← 홈으로 돌아가기
            </button>
          </div>
        )}

        {/* Report display */}
        {status === 'done' && reportData && (
          <div ref={reportRef} className="w-full max-w-2xl">
            {/* ECHO logo */}
            <div className="text-center mb-12">
              <div
                className="font-display font-bold tracking-[0.2em] mb-4"
                style={{
                  fontSize: 'clamp(1.8rem, 5vw, 3rem)',
                  background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT}, ${GOLD_ACCENT})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ECHO
              </div>
              <p className="text-white/20 text-[10px] font-mono tracking-[0.3em] uppercase">
                RELATIONSHIP ANALYSIS REPORT
              </p>
              {reportData.safety_triggered && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/5">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-yellow-400/60 text-[10px] font-mono tracking-[0.15em]">SAFETY CHECK</span>
                </div>
              )}
            </div>

            {/* Report sections */}
            <div className="space-y-10">
              {sections.map((section, i) => (
                <div
                  key={i}
                  ref={(el) => { sectionsRef.current[i] = el; }}
                  className="relative rounded-2xl border border-white/[0.06] p-8"
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    opacity: i < visibleSections ? 1 : 0,
                  }}
                >
                  {/* Section accent line */}
                  <div
                    className="absolute top-0 left-8 right-8 h-px rounded-full"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${[PINK_ACCENT, PURPLE_ACCENT, GOLD_ACCENT, '#FF8C69', '#B8A9C9', '#FFD700'][i % 6]}40, transparent)`,
                    }}
                  />

                  <h3
                    className="font-display font-bold text-lg tracking-tight mb-4"
                    style={{
                      color: [PINK_ACCENT, PURPLE_ACCENT, GOLD_ACCENT, '#FF8C69', '#B8A9C9', '#FFD700'][i % 6],
                    }}
                  >
                    {section.title}
                  </h3>
                  <div className="text-white/65 text-sm leading-relaxed whitespace-pre-wrap font-light">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

            {/* ─── White Door ─── */}
            {whiteDoorRevealed && (
              <div className="mt-16 relative">
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />

                {!whiteDoorOpen ? (
                  <div className="relative text-center" ref={(el) => {
                    if (el) {
                      gsap.fromTo(el,
                        { opacity: 0, y: 24, filter: 'blur(8px)' },
                        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }
                      );
                    }
                  }}>
                    <div className="mx-auto mb-8 w-28 h-40 md:w-32 md:h-44 relative cursor-pointer group touch-manipulation" onClick={() => setWhiteDoorOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setWhiteDoorOpen(true); }}>
                      <div
                        className="absolute -inset-6 rounded-2xl opacity-70 group-hover:opacity-100 group-active:opacity-100 transition-all duration-700"
                        style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)' }}
                      />
                      <div className="absolute inset-0 rounded-xl border-2 border-white/20 group-hover:border-white/40 group-active:border-white/40 transition-all duration-700 flex items-center justify-center overflow-hidden"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 50%, rgba(0,0,0,0.3) 100%)',
                          boxShadow: '0 0 60px rgba(255,255,255,0.08)',
                        }}
                      >
                        <div className="absolute top-0 bottom-0 w-[2px] bg-white/60 group-hover:bg-white/90 group-active:bg-white/90 transition-all duration-700"
                          style={{
                            left: '50%',
                            transform: 'translateX(-50%)',
                            boxShadow: '0 0 20px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.2)',
                          }}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/30 group-hover:bg-white/60 group-active:bg-white/60 transition-all duration-500" />
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-xl md:text-2xl text-white/90 mb-3 tracking-tight">
                      White Door
                    </h3>
                    <p className="text-white/45 text-sm leading-relaxed mb-6 max-w-sm mx-auto">
                      당신의 가장 깊은 패턴이 이 문 뒤에 있습니다.
                      <br />
                      열 준비가 되셨나요?
                    </p>
                    <button
                      onClick={() => setWhiteDoorOpen(true)}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-500 whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 touch-manipulation"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFFFFF',
                        boxShadow: '0 0 30px rgba(255,255,255,0.05)',
                      }}
                    >
                      <i className="ri-door-open-line text-sm" />
                      열어보기
                    </button>
                  </div>
                ) : (
                  <div className="relative text-center" ref={(el) => {
                    if (el) {
                      gsap.fromTo(el,
                        { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
                        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }
                      );
                    }
                  }}>
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        width: '300px',
                        height: '300px',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)',
                      }}
                    />

                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.10] mb-6">
                      <i className="ri-door-open-line text-white/70 text-xl" />
                    </div>

                    <h3 className="font-display font-bold text-xl md:text-2xl text-white/90 mb-5 tracking-tight">
                      당신은 이미 답을 알고 있습니다
                    </h3>

                    <div className="space-y-4 text-white/55 text-sm md:text-[15px] leading-relaxed max-w-lg mx-auto mb-8">
                      <p>
                        지금까지 읽은 모든 것은 데이터와 패턴에 관한 이야기였습니다.
                        하지만 ECHO가 진짜 전하고 싶은 것은 이것입니다.
                      </p>
                      <p>
                        당신의 반복되는 선택은 결코 '실수'가 아닙니다.
                        그것은 당신이 세상과 연결되는 방식이며,
                        지금까지 당신을 지켜온 방식입니다.
                      </p>
                      <p className="text-white/70 font-medium">
                        그리고 이제, 당신은 그 패턴을 볼 수 있게 되었습니다.
                        보는 순간, 모든 것이 바뀌기 시작합니다.
                      </p>
                      <p>
                        White Door는 끝이 아니라 시작입니다.
                        진짜 나를 마주하는 용기.
                        그리고 그 나를 있는 그대로 받아들이는 순간.
                      </p>
                    </div>

                    <div className="inline-block px-8 py-5 rounded-xl border border-white/[0.08] bg-white/[0.02]"
                      style={{ boxShadow: '0 0 40px rgba(255,255,255,0.03)' }}
                    >
                      <p className="text-white/80 font-display text-base md:text-lg font-medium tracking-tight leading-relaxed">
                        &ldquo;진짜 나를 찾아줘.&rdquo;
                      </p>
                      <p className="text-white/25 text-xs mt-2 font-mono tracking-[0.15em]">
                        — ECHO
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Meta info */}
            <div className="mt-12 pt-8 border-t border-white/[0.04] text-center">
              <p className="text-white/15 text-[9px] font-mono tracking-[0.2em] mb-2">
                GENERATED {new Date(reportData.generated_at).toLocaleString('ko-KR')}
              </p>
              <p className="text-white/10 text-[8px] font-mono tracking-[0.15em]">
                MODEL {reportData.model_used} &middot; TOKENS {reportData.tokens_used} &middot; {reportData.response_time_ms}ms &middot; TOTAL {reportData.total_time_ms}ms
              </p>
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 touch-manipulation"
                style={{
                  background: `linear-gradient(135deg, ${PINK_ACCENT}, ${PURPLE_ACCENT})`,
                  color: '#FFFFFF',
                  boxShadow: `0 0 40px ${PINK_ACCENT}20`,
                }}
              >
                홈으로 돌아가기
                <i className="ri-arrow-right-line" />
              </button>
            </div>

            {/* Legal disclaimer */}
            <div className="mt-12 pt-6 border-t border-white/[0.03]">
              <p className="text-white/10 text-[8px] leading-relaxed text-center">
                ECHO는 의료, 심리치료, 상담, 법률, 점술 서비스가 아닙니다.
                관계 경험을 바탕으로 자기이해를 돕는 정보 서비스입니다.
                AI 응답은 참고용이며 판단, 진단, 치료, 법률 자문을 제공하지 않습니다.
                위급 상황에서는 112, 119 또는 전문기관에 도움을 요청해 주세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}