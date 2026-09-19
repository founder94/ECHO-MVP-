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
  type FlowState,
} from '@/lib/echo/api';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Phase = 'loading' | 'not_configured' | 'error' | 'ready';

interface StepQuestionScreenProps {
  expectedStatus: 'step1' | 'step2';
}

export default function StepQuestionScreen({ expectedStatus }: StepQuestionScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const conversationId = searchParams.get('c') ?? '';

  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [stepLabel, setStepLabel] = useState(expectedStatus === 'step1' ? 'STEP 1' : 'STEP 2');
  const [question, setQuestion] = useState('');
  const [previousAnswer, setPreviousAnswer] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const initRef = useRef(false);
  const askTokenRef = useRef('');
  const tokenRef = useRef('');
  // 로그인 후 돌아올 내부 경로(현재 화면). 항상 서버 승인 경로 매핑을 거친다.
  const returnPath = routeWithConversation(expectedStatus, conversationId) ?? '/weather-check';

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

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
    // 주소 직접 입력 등으로 현재 단계와 맞지 않으면 서버가 승인한 경로로 돌려보낸다.
    // 알 수 없는 상태는 STEP 1로 숨겨 보내지 않고 명시 오류로 멈춘다.
    if (state.status !== expectedStatus) {
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
    if (state.needsQuestion || !state.question) {
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
        if (!readyState.ok || !readyState.question) {
          setPhase('error');
          setErrorMessage(readyState.error ?? '질문을 불러오지 못했어요. 다시 시도해 주세요.');
          return;
        }
      }
    }
    setStepLabel(readyState.status === 'step1' ? 'STEP 1' : 'STEP 2');
    setQuestion(readyState.question ?? '');
    setPreviousAnswer(readyState.previousAnswer ?? '');
    setPhase('ready');
  };

  // 서버가 승인한 상태로만 이동한다. 알 수 없는 상태면 이동하지 않고 오류를 보여준다.
  const goToServerState = (state: FlowState) => {
    if (state.status === expectedStatus) {
      tokenRef.current = '';
      askTokenRef.current = '';
      setAnswer('');
      void resume();
      return;
    }
    const target = routeWithConversation(state.status, conversationId);
    if (!target) {
      setSubmitError(UNKNOWN_STATE_MESSAGE);
      return;
    }
    tokenRef.current = '';
    navigate(target);
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

  const handleSubmit = async () => {
    const text = answer.trim();
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
          // 같은 요청이 이미 처리 중(연속 클릭·재전송). 토큰은 유지하고 잠시 뒤 서버 상태를 다시 읽는다.
          await wait(IN_PROGRESS_RETRY_MS);
          const latest = await resumeConversation(conversationId);
          if (latest.ok && latest.status !== expectedStatus) {
            goToServerState(latest);
            return;
          }
          setSubmitError('처리 중이에요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        // 토큰은 유지 → 같은 요청을 다시 보내도 서버가 중복으로 저장하지 않는다.
        setSubmitError(state.error ?? SAVE_FAILED_MESSAGE);
        return;
      }
      goToServerState(state);
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

          {phase === 'ready' && (
            <div className="w-full text-left">
              <div style={reveal(100)} className="mb-2">
                <span className="text-[11px] tracking-[0.3em] text-white/50 font-medium">{stepLabel}</span>
              </div>

              {previousAnswer && expectedStatus === 'step2' && (
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
                    {question}
                  </p>
                </div>
              </div>

              <p style={reveal(240)} className="text-[12.5px] text-white/55 mb-3">
                지금 떠오르는 만큼만 적어주세요. 잘 모르겠다면 “모르겠어요”라고 적어도 괜찮아요.
              </p>

              <textarea
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setSubmitError('');
                }}
                maxLength={500}
                placeholder="자유롭게 적어보세요."
                style={reveal(300)}
                className="w-full min-h-[120px] rounded-2xl bg-white/[0.06] border border-white/15 px-4 py-3 text-[14px] text-white placeholder:text-white/35 resize-none focus:outline-none focus:border-white/30 transition-colors mb-2"
              />

              {submitError && (
                <p className="text-[12.5px] text-red-300 mb-3">{submitError}</p>
              )}

              <div style={reveal(380)} className="flex flex-col gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || answer.trim().length === 0}
                  className="w-full h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#0c1526]/25 border-t-[#0c1526] rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '답변 저장하고 다음으로'
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
