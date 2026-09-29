import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SceneShell, { type ScenePhase } from '@/pages/do-it/components/SceneShell';
import { PRIMARY_BUTTON, TEXT_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';
import { useConversationGate } from '@/pages/do-it/components/useConversationGate';
import {
  IN_PROGRESS_RETRY_MS,
  JOURNEY_LAST_STEP,
  SAVE_FAILED_MESSAGE,
  UNKNOWN_STATE_MESSAGE,
  askJourneyQuestion,
  newRequestToken,
  resumeJourney,
  routeWithConversation,
  submitJourneyAnswer,
  type FlowState,
  type JourneyStepStatus,
} from '@/lib/echo/api';
import { JourneySaveController } from '@/lib/echo/journeySave';
import { SAVE_BUSY_MESSAGE, SAVE_CHANGED_MESSAGE, SAVE_TIMEOUT_MESSAGE } from '@/lib/echo/startSave';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const ANSWER_MAX = 500;

interface JourneyStepScreenProps {
  expectedStatus: JourneyStepStatus;
}

// STEP 3~7 공통 화면. 질문은 서버(echo-journey)가 만들고, 화면은 서버 상태만 표시한다.
export default function JourneyStepScreen({ expectedStatus }: JourneyStepScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('c') ?? '';
  const reveal = useReveal();
  const stepNumber = Number(expectedStatus.slice(4));

  const [phase, setPhase] = useState<ScenePhase>('loading');
  const [loadingText, setLoadingText] = useState('확인하고 있어요...');
  const [question, setQuestion] = useState('');
  const [previousAnswer, setPreviousAnswer] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const askTokenRef = useRef('');
  const latestAnswerRef = useRef('');
  latestAnswerRef.current = answer;
  const answerSaveRef = useRef<JourneySaveController<FlowState> | null>(null);
  if (!answerSaveRef.current) {
    answerSaveRef.current = new JourneySaveController({
      submit: (text, token) => submitJourneyAnswer(conversationId, text, token),
      newToken: newRequestToken,
    });
  }
  useEffect(() => () => answerSaveRef.current?.cancel(), []);

  const returnPath = routeWithConversation(expectedStatus, conversationId) ?? '/weather-check';

  const showFailure = (state: FlowState) => {
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
  };

  // 서버 상태가 이 화면과 다르면 서버가 승인한 경로로만 이동. 알 수 없는 상태는 명시 오류.
  const redirectOrError = (state: FlowState): boolean => {
    if (state.status === expectedStatus) return false;
    const target = routeWithConversation(state.status, conversationId);
    if (!target) {
      setPhase('error');
      setErrorMessage(UNKNOWN_STATE_MESSAGE);
      return true;
    }
    navigate(target, { replace: true });
    return true;
  };

  const load = async () => {
    setPhase('loading');
    setLoadingText('확인하고 있어요...');
    setErrorMessage('');
    const state = await resumeJourney(conversationId);
    if (!state.ok) {
      showFailure(state);
      return;
    }
    if (redirectOrError(state)) return;

    if (state.needsQuestion || !state.question) {
      // 이해 확인 직후 STEP 3: 질문이 아직 없으면 서버에 생성 요청(토큰 유지 → 재시도해도 1개만 생성)
      setLoadingText('방금 한 말에 이어서 묻고 있어요...');
      if (!askTokenRef.current) askTokenRef.current = newRequestToken();
      const asked = await askJourneyQuestion(conversationId, askTokenRef.current);
      if (!asked.ok) {
        if (asked.reason === 'in_progress') {
          await wait(IN_PROGRESS_RETRY_MS);
          const again = await resumeJourney(conversationId);
          if (again.ok && again.question) {
            setQuestion(again.question);
            setPreviousAnswer(again.previousAnswer ?? '');
            setPhase('ready');
            return;
          }
        }
        showFailure(asked);
        return;
      }
      if (redirectOrError(asked)) return;
      setQuestion(asked.question ?? '');
      setPreviousAnswer(asked.previousAnswer ?? '');
      setPhase('ready');
      return;
    }
    setQuestion(state.question);
    setPreviousAnswer(state.previousAnswer ?? '');
    setPhase('ready');
  };

  useConversationGate(returnPath, () => void load());

  const goToServerState = (state: FlowState) => {
    if (state.status === expectedStatus) {
      askTokenRef.current = '';
      setAnswer('');
      void load();
      return;
    }
    const target = routeWithConversation(state.status, conversationId);
    if (!target) {
      setSubmitError(UNKNOWN_STATE_MESSAGE);
      return;
    }
    navigate(target);
  };

  const handleSubmit = async (overrideText?: string) => {
    const usedQuickReply = typeof overrideText === 'string';
    const text = (overrideText ?? answer).trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const outcome = await answerSaveRef.current!.save(text);
      if (outcome.kind === 'stale') return;
      if (outcome.kind === 'busy') {
        setSubmitError(SAVE_BUSY_MESSAGE);
        return;
      }
      if (outcome.kind === 'timeout') {
        setSubmitError(SAVE_TIMEOUT_MESSAGE);
        return;
      }
      const state = outcome.result;
      if (outcome.kind === 'failure' || !state.ok) {
        if (state.reason === 'unauthorized') {
          navigate('/login', { state: { from: returnPath } });
          return;
        }
        if (state.reason === 'not_configured') {
          setPhase('not_configured');
          return;
        }
        if (state.reason === 'in_progress') {
          await wait(IN_PROGRESS_RETRY_MS);
          const latest = await resumeJourney(conversationId);
          if (latest.ok && latest.status !== expectedStatus) {
            goToServerState(latest);
            return;
          }
          setSubmitError('처리 중이에요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        if (state.reason === 'invalid_state') {
          const latest = await resumeJourney(conversationId);
          if (latest.ok && latest.status !== expectedStatus) {
            goToServerState(latest);
            return;
          }
        }
        setSubmitError(state.error ?? SAVE_FAILED_MESSAGE);
        return;
      }
      if (!usedQuickReply && latestAnswerRef.current.trim() !== outcome.submittedText) {
        setSubmitError(SAVE_CHANGED_MESSAGE);
        return;
      }
      goToServerState(state);
    } catch (err) {
      setSubmitError((err as Error)?.message || SAVE_FAILED_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SceneShell phase={phase} loadingText={loadingText} errorMessage={errorMessage} onRetry={() => void load()} align="left">
      <div className="w-full text-left">
        <div style={reveal(100)} className="mb-2 flex items-center justify-between">
          <span className="text-[11px] tracking-[0.3em] text-white/50 font-medium">STEP {stepNumber}</span>
          <span className="text-[11px] tracking-[0.2em] text-white/35">
            {stepNumber} / {JOURNEY_LAST_STEP}
          </span>
        </div>

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
            <p className="text-[13.5px] text-white/95 font-medium leading-relaxed whitespace-pre-wrap">{question}</p>
          </div>
        </div>

        <p style={reveal(240)} className="text-[12.5px] text-white/55 mb-3">
          길게 답하지 않아도 돼요. 한 단어나 “넘어갈게요”도 괜찮아요.
        </p>

        <textarea
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setSubmitError('');
          }}
          maxLength={ANSWER_MAX}
          placeholder="자유롭게 적어보세요."
          style={reveal(300)}
          className="w-full min-h-[120px] rounded-2xl bg-white/[0.06] border border-white/15 px-4 py-3 text-[14px] text-white placeholder:text-white/35 resize-none focus:outline-none focus:border-white/30 transition-colors mb-2"
        />

        {submitError && <p className="text-[12.5px] text-red-300 mb-3">{submitError}</p>}

        <div style={reveal(380)} className="flex flex-col gap-3 mt-4">
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting || answer.trim().length === 0} className={PRIMARY_BUTTON}>
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0c1526]/25 border-t-[#0c1526] rounded-full animate-spin" />
                저장 중...
              </>
            ) : stepNumber === JOURNEY_LAST_STEP ? (
              '이야기 마무리하기'
            ) : (
              '답변 저장하고 다음으로'
            )}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit('잘 모르겠어요')}
              disabled={submitting}
              className="min-h-[48px] rounded-2xl border border-white/20 bg-white/[0.06] px-3 py-3 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              잘 모르겠어요
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit('이번 질문은 넘어갈게요')}
              disabled={submitting}
              className="min-h-[48px] rounded-2xl border border-white/20 bg-white/[0.06] px-3 py-3 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              이번 질문은 넘어갈게요
            </button>
          </div>
          <button type="button" onClick={() => navigate('/locker')} disabled={submitting} className={TEXT_BUTTON}>
            보관함 보기
          </button>
        </div>
      </div>
    </SceneShell>
  );
}
