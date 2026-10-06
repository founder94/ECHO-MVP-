import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WeatherBackdrop from '@/pages/do-it/weather/components/WeatherBackdrop';
import { useAuth } from '@/context/AuthContext';
import {
  IN_PROGRESS_RETRY_MS,
  SAVE_FAILED_MESSAGE,
  UNKNOWN_STATE_MESSAGE,
  askStepQuestion,
  newRequestToken,
  resumeConversation,
  routeWithConversation,
  submitAnswer,
  submitChoice,
  type FlowState,
  type UnderstandingChoice,
} from '@/lib/echo/api';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const IN_PROGRESS_MESSAGE = '처리 중이에요. 잠시 후 다시 시도해 주세요.';

type Phase = 'loading' | 'not_configured' | 'error' | 'ready';
type View = 'understanding' | 'followup';

const choiceButtons: { id: UnderstandingChoice; label: string }[] = [
  { id: 'agree', label: '맞아요' },
  { id: 'alittle', label: '조금 달라요' },
  { id: 'no', label: '그게 아니에요' },
  { id: 'explain', label: '직접 설명할게요' },
];

const correctionPrompt: Record<'alittle' | 'no' | 'explain', string> = {
  alittle: '맞는 부분은 두고, 다르게 느껴지는 부분만 알려주세요.',
  no: 'ECHO가 잘못 이해한 부분을 알려주세요. 그 뜻은 다음 질문에서 다시 꺼내지 않을게요.',
  explain: 'ECHO의 해석 대신, 지금 내 마음을 내 말로 적어주세요.',
};

export default function UnderstandingCheckPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const conversationId = searchParams.get('c') ?? '';

  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [view, setView] = useState<View>('understanding');
  const [understanding, setUnderstanding] = useState('');
  const [question, setQuestion] = useState('');
  const [previousAnswer, setPreviousAnswer] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [pendingChoice, setPendingChoice] = useState<UnderstandingChoice | null>(null);
  const [choiceText, setChoiceText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const initRef = useRef(false);
  const askTokenRef = useRef('');
  const tokenRef = useRef('');
  const returnPath = routeWithConversation('understanding', conversationId) ?? '/weather-check';

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  const applyState = (state: FlowState) => {
    setPreviousAnswer(state.previousAnswer ?? '');
    if (state.status === 'understanding') {
      setView('understanding');
      setUnderstanding(state.understanding ?? '');
      setPendingChoice(null);
      setChoiceText('');
    } else if (state.status === 'followup') {
      setView('followup');
      setQuestion(state.question ?? '');
      setPendingChoice(null);
      setChoiceText('');
      setAnswerText('');
    }
  };

  const resume = async () => {
    if (!user || !conversationId) return;
    setPhase('loading');
    setErrorMessage('');
    const state = await resumeConversation(conversationId);
    if (!state.ok) {
      if (state.reason === 'unauthorized') {
        navigate('/login', { state: { from: returnPath } });
        return;
      }
      if (state.reason === 'not_configured') {
        setPhase('not_configured');
        return;
      }
      setPhase('error');
      setErrorMessage(state.error ?? '요청을 처리하지 못했어요.');
      return;
    }
    if (state.status !== 'understanding' && state.status !== 'followup') {
      // 서버 승인 경로로만 이동. 알 수 없는 상태는 명시 오류.
      const target = routeWithConversation(state.status, conversationId);
      if (!target) {
        setPhase('error');
        setErrorMessage(UNKNOWN_STATE_MESSAGE);
        return;
      }
      navigate(target, { replace: true });
      return;
    }
    let readyState = state;
    const missingContent = state.status === 'understanding' ? !state.understanding : !state.question;
    if (state.needsQuestion || missingContent) {
      if (!askTokenRef.current) askTokenRef.current = newRequestToken();
      readyState = await askStepQuestion(conversationId, askTokenRef.current);
      if (!readyState.ok) {
        if (readyState.reason === 'unauthorized') {
          navigate('/login', { state: { from: returnPath } });
          return;
        }
        if (readyState.reason === 'not_configured') {
          setPhase('not_configured');
          return;
        }
        if (readyState.reason === 'in_progress') {
          await wait(IN_PROGRESS_RETRY_MS);
          readyState = await resumeConversation(conversationId);
        }
        const stillMissing = readyState.status === 'understanding' ? !readyState.understanding : !readyState.question;
        if (!readyState.ok || stillMissing) {
          setPhase('error');
          setErrorMessage(readyState.error ?? '대화를 불러오지 못했어요. 다시 시도해 주세요.');
          return;
        }
      }
    }
    applyState(readyState);
    setPhase('ready');
  };

  // 서버 응답 상태를 화면에 반영한다. 이 화면 범위(understanding/followup)면 표시, 그 외면 서버 승인 경로로 이동.
  const applyServerState = (state: FlowState): boolean => {
    if (state.status === 'understanding' || state.status === 'followup') {
      tokenRef.current = '';
      if (state.needsQuestion || (state.status === 'understanding' ? !state.understanding : !state.question)) {
        askTokenRef.current = '';
        void resume();
        return true;
      }
      applyState(state);
      return true;
    }
    const target = routeWithConversation(state.status, conversationId);
    if (!target) {
      setSubmitError(UNKNOWN_STATE_MESSAGE);
      return false;
    }
    tokenRef.current = '';
    navigate(target);
    return true;
  };

  // 같은 요청이 이미 처리 중(연속 클릭·재전송)이면 토큰을 유지한 채 잠시 뒤 서버 상태를 다시 읽는다.
  const handleInProgress = async () => {
    await wait(IN_PROGRESS_RETRY_MS);
    const latest = await resumeConversation(conversationId);
    if (latest.ok) {
      applyServerState(latest);
      return;
    }
    setSubmitError(IN_PROGRESS_MESSAGE);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: conversationId ? returnPath : '/weather-check' } });
      return;
    }
    if (!conversationId) {
      navigate('/weather-check');
      return;
    }
    if (initRef.current) return;
    initRef.current = true;
    void resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, conversationId]);

  const handleChoice = (choice: UnderstandingChoice) => {
    if (choice === 'agree') {
      void doChoice(choice, '');
    } else {
      setPendingChoice(choice);
      setChoiceText('');
      setSubmitError('');
    }
  };

  const doChoice = async (choice: UnderstandingChoice, text: string) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    if (!tokenRef.current) tokenRef.current = newRequestToken();
    try {
      const state = await submitChoice(conversationId, choice, text, tokenRef.current);
      if (!state.ok) {
        if (state.reason === 'unauthorized') {
          navigate('/login', { state: { from: returnPath } });
          return;
        }
        if (state.reason === 'not_configured') {
          setPhase('not_configured');
          return;
        }
        if (state.reason === 'in_progress') {
          await handleInProgress();
          return;
        }
        setSubmitError(state.error ?? SAVE_FAILED_MESSAGE);
        return;
      }
      // White Door 진입을 포함해 모든 이동은 서버가 돌려준 상태로만 결정한다.
      applyServerState(state);
    } catch (err) {
      setSubmitError((err as Error)?.message || SAVE_FAILED_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  const doFollowup = async () => {
    const text = answerText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    if (!tokenRef.current) tokenRef.current = newRequestToken();
    try {
      const state = await submitAnswer(conversationId, text, tokenRef.current);
      if (!state.ok) {
        if (state.reason === 'unauthorized') {
          navigate('/login', { state: { from: returnPath } });
          return;
        }
        if (state.reason === 'not_configured') {
          setPhase('not_configured');
          return;
        }
        if (state.reason === 'in_progress') {
          await handleInProgress();
          return;
        }
        setSubmitError(state.error ?? SAVE_FAILED_MESSAGE);
        return;
      }
      applyServerState(state);
    } catch (err) {
      setSubmitError((err as Error)?.message || SAVE_FAILED_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => navigate('/weather-check');
  const handleRetry = () => void resume();

  const reveal = (delay: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });

  const isRequesting = phase === 'loading';

  return (
    <section className="relative w-full echo-min-h-viewport flex items-center justify-center overflow-hidden">
      <WeatherBackdrop iconKey={null} />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className="flex flex-col items-center text-center">
          <p style={reveal(0)} className="text-[11px] tracking-[0.5em] text-white/55 font-medium mb-7 uppercase">
            ECHO
          </p>

          {isRequesting && (
            <div style={reveal(120)} className="flex flex-col items-center">
              <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-[13.5px] text-white/60">ECHO가 마음을 읽고 있어요...</p>
            </div>
          )}

          {phase === 'not_configured' && (
            <>
              <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
                AI 서버 설정이 필요해요.
              </h1>
              <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
                아직 AI가 응답할 준비가 되지 않았어요. 설정이 끝나면 다시 시도할 수 있어요.
              </p>
              <button
                type="button"
                onClick={handleRetry}
                style={reveal(360)}
                className="w-full max-w-xs h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200"
              >
                다시 시도하기
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
                잠시 연결이 원활하지 않아요.
              </h1>
              <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                style={reveal(360)}
                className="w-full max-w-xs h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200"
              >
                다시 시도하기
              </button>
            </>
          )}

          {phase === 'ready' && view === 'understanding' && (
            <div className="w-full text-left">
              <p style={reveal(80)} className="text-[11px] tracking-[0.22em] text-white/50 font-medium text-center mb-3">
                STEP 2 답변 뒤 · 이해 확인
              </p>
              <h1 style={reveal(100)} className="text-[20px] leading-snug font-bold text-white text-center mb-6">
                ECHO가 이해한 내가 맞나요?
              </h1>

              {previousAnswer && (
                <div style={reveal(130)} className="flex justify-end mb-4">
                  <div className="bg-white/15 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] border border-white/10">
                    <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{previousAnswer}</p>
                  </div>
                </div>
              )}

              <div style={reveal(160)} className="flex items-start gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-dot text-white/90">E</span>
                </div>
                <div className="bg-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] border border-white/10">
                  <p className="text-[13.5px] text-white/95 font-medium leading-relaxed whitespace-pre-wrap">
                    {understanding}
                  </p>
                </div>
              </div>

              {!pendingChoice && (
                <div style={reveal(240)}>
                  <div className="grid grid-cols-2 gap-2">
                    {choiceButtons.map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => handleChoice(btn.id)}
                        disabled={submitting}
                        className="px-3 py-3 rounded-xl border border-white/15 bg-white/[0.06] text-white/85 text-[13px] font-medium whitespace-nowrap cursor-pointer hover:bg-white/[0.12] hover:text-white active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {pendingChoice && (
                <div style={reveal(160)} className="rounded-2xl border border-white/15 bg-white/[0.05] p-4">
                  <p className="text-[13px] text-white/80 mb-3">
                    {correctionPrompt[pendingChoice as 'alittle' | 'no' | 'explain']}
                  </p>
                  <textarea
                    value={choiceText}
                    onChange={(e) => {
                      setChoiceText(e.target.value);
                      setSubmitError('');
                    }}
                    maxLength={500}
                    placeholder="자유롭게 적어주세요."
                    className="w-full min-h-[100px] rounded-xl bg-white/[0.06] border border-white/15 px-4 py-3 text-[14px] text-white placeholder:text-white/35 resize-none focus:outline-none focus:border-white/30 transition-colors mb-3"
                  />
                  {submitError && <p className="text-[12.5px] text-red-300 mb-3">{submitError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void doChoice(pendingChoice, choiceText)}
                      disabled={submitting || choiceText.trim().length === 0}
                      className="flex-1 h-12 rounded-xl bg-white text-[#0c1526] text-[14px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 disabled:opacity-50"
                    >
                      {submitting ? '저장 중...' : '저장하기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingChoice(null);
                        setChoiceText('');
                        setSubmitError('');
                      }}
                      disabled={submitting}
                      className="flex-1 h-12 rounded-xl border border-white/20 text-white text-[14px] font-medium whitespace-nowrap cursor-pointer hover:bg-white/10 active:scale-[0.99] transition-all duration-200 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'ready' && view === 'followup' && (
            <div className="w-full text-left">
              {previousAnswer && (
                <div style={reveal(120)} className="flex justify-end mb-4">
                  <div className="bg-white/15 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] border border-white/10">
                    <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{previousAnswer}</p>
                  </div>
                </div>
              )}
              <div style={reveal(160)} className="flex items-start gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-dot text-white/90">E</span>
                </div>
                <div className="bg-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] border border-white/10">
                  <p className="text-[13.5px] text-white/95 font-medium leading-relaxed whitespace-pre-wrap">
                    {question}
                  </p>
                </div>
              </div>

              <p style={reveal(240)} className="text-[12.5px] text-white/55 mb-3">
                필요한 만큼만 적어주세요. 잘 모르겠다면 “모르겠어요”라고 적어도 괜찮아요.
              </p>

              <textarea
                value={answerText}
                onChange={(e) => {
                  setAnswerText(e.target.value);
                  setSubmitError('');
                }}
                maxLength={500}
                placeholder="자유롭게 적어보세요."
                style={reveal(300)}
                className="w-full min-h-[120px] rounded-2xl bg-white/[0.06] border border-white/15 px-4 py-3 text-[14px] text-white placeholder:text-white/35 resize-none focus:outline-none focus:border-white/30 transition-colors mb-2"
              />

              {submitError && <p className="text-[12.5px] text-red-300 mb-3">{submitError}</p>}

              <div style={reveal(380)} className="flex flex-col gap-3 mt-4">
                <button
                  type="button"
                  onClick={doFollowup}
                  disabled={submitting || answerText.trim().length === 0}
                  className="w-full h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#0c1526]/25 border-t-[#0c1526] rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '답변 저장하고 다시 확인'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="w-full h-12 text-[13px] text-white/55 cursor-pointer hover:text-white/80 transition-colors duration-200 whitespace-nowrap disabled:opacity-40"
                >
                  내 마음 다시 확인하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
