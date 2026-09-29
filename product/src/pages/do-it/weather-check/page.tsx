import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WeatherBackdrop from '@/pages/do-it/weather/components/WeatherBackdrop';
import WeatherEffect from '@/pages/do-it/weather/components/WeatherEffect';
import { weatherSentence, type WeatherIconKey } from '@/pages/do-it/weather/hooks/useWeather';
import {
  clearStoryHandoff,
  clearLegacyDraft,
  migrateLegacyDraftOnce,
  readStoryHandoff,
  readLegacyDraft,
} from '@/lib/echo/storyHandoff';
import {
  SAVE_FAILED_MESSAGE,
  UNKNOWN_STATE_MESSAGE,
  newRequestToken,
  routeWithConversation,
  startConversation,
} from '@/lib/echo/api';
import { useAuth } from '@/context/AuthContext';
import {
  SAVE_BUSY_MESSAGE,
  SAVE_CHANGED_MESSAGE,
  SAVE_TIMEOUT_MESSAGE,
  StartSaveController,
} from '@/lib/echo/startSave';

const EXAMPLE_CHIPS = ['잘 모르겠어요', '답답해요'];
const MAX_LENGTH = 500;

interface WeatherCheckState {
  hasWeather?: boolean;
  weatherLabel?: string;
  iconKey?: WeatherIconKey;
}

export default function WeatherCheckPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const state = (location.state ?? {}) as WeatherCheckState;
  const hasWeather = state.hasWeather === true;
  const weatherLabel = state.weatherLabel ?? '';
  const iconKey: WeatherIconKey | null = hasWeather ? state.iconKey ?? null : null;

  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [handoffError, setHandoffError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTextRef = useRef('');
  latestTextRef.current = text;
  // PATCH D: 유한 대기(30초)·같은 토큰 재시도·중복 호출 차단·화면 이탈 뒤 늦은 응답 무시.
  const saveRef = useRef<StartSaveController<Awaited<ReturnType<typeof startConversation>>> | null>(null);
  if (!saveRef.current) saveRef.current = new StartSaveController({ start: startConversation, newToken: newRequestToken });
  useEffect(() => () => saveRef.current?.cancel(), []);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  // 새로고침해도 작성 중이던 원문이 사라지지 않도록 복원 (공식 전달값 우선)
  useEffect(() => {
    migrateLegacyDraftOnce();
    const official = readStoryHandoff();
    const restored = official?.mindText ?? readLegacyDraft() ?? '';
    if (restored) setText(restored);
  }, []);

  // 작성 중 초안을 브라우저 임시값(echo:mind-draft)으로 자동 보관
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        const trimmed = text.trim();
        if (trimmed) sessionStorage.setItem('echo:mind-draft', trimmed);
      } catch {
        /* 무시 */
      }
    }, 300);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [text]);

  const canSubmit = text.trim().length > 0;

  const handleChip = (chip: string) => {
    setText((prev) => (prev.trim() ? `${prev} ${chip}` : chip));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    // 1. 로그인 상태 확인 — 아직 세션 복원 중이면 무시
    if (loading) return;
    if (!user) {
      // 원문은 브라우저 임시값에 이미 보관되어 있으므로 로그인 후 복원된다.
      navigate('/login', { state: { from: '/weather-check' } });
      return;
    }

    setSubmitting(true);
    setSaveError('');
    setHandoffError(false);

    try {
      // 2. 서버 대화 생성 + 감정 원문 우선 저장 (STEP 1 질문은 다음 화면에서 별도로 생성)
      const outcome = await saveRef.current!.submit(trimmed);
      if (outcome.kind === 'stale') return;
      if (outcome.kind === 'busy') {
        setSaveError(SAVE_BUSY_MESSAGE);
        return;
      }
      if (outcome.kind === 'timeout') {
        setSaveError(SAVE_TIMEOUT_MESSAGE);
        return;
      }
      const res = outcome.result;
      if (outcome.kind === 'failure' || !res.conversationId) {
        if (res.reason === 'not_configured') {
          setSaveError('AI 서버 설정이 필요해요. 설정이 끝나면 다시 시도해 주세요.');
        } else if (res.reason === 'rate_limited') {
          setSaveError('잠시 후 다시 시도해 주세요.');
        } else {
          setSaveError(res.error ?? SAVE_FAILED_MESSAGE);
        }
        return;
      }
      const conversationId = res.conversationId;
      // 서버가 승인한 상태의 경로로만 이동한다(재전송이면 이미 진행된 단계일 수 있다).
      const target = routeWithConversation(res.status, conversationId);
      if (!target) {
        setSaveError(UNKNOWN_STATE_MESSAGE);
        return;
      }

      // 요청 중 원문이 바뀌었다면 이전 응답으로 최신 원문을 지우거나 화면을 이동하지 않는다.
      if (latestTextRef.current.trim() !== outcome.submittedText) {
        setSaveError(SAVE_CHANGED_MESSAGE);
        return;
      }

      // 4. 서버 저장 성공이 확인된 뒤에만 임시 키 정리
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      clearLegacyDraft();
      clearStoryHandoff();

      // 5. 성공 후에만 다음 화면으로 이동
      navigate(target, { state: { hasWeather, weatherLabel } });
    } catch (err) {
      // 실패 시 원문 보존 (임시 키 정리하지 않음)
      setSaveError((err as Error)?.message || SAVE_FAILED_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  const reveal = (delay: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });

  return (
    <section className="relative w-full echo-min-h-viewport flex items-center justify-center overflow-hidden">
      <WeatherBackdrop iconKey={iconKey} />
      <WeatherEffect iconKey={iconKey} />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로 가기"
          style={reveal(0)}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-white cursor-pointer hover:bg-white/20 active:scale-95 transition-all duration-200 mb-8"
        >
          <i className="ri-arrow-left-line text-[18px]" />
        </button>

        <div className="flex flex-col">
          <h1 style={reveal(80)} className="text-[24px] leading-snug font-bold text-white mb-2">
            {hasWeather ? (
              <>
                오늘 밖은 <span className="text-white/90">{weatherSentence(iconKey)}</span>.
              </>
            ) : (
              '밖의 날씨는 확인하지 않았어요.'
            )}
            <br />
            {hasWeather ? '그리고 내 마음은 어때요?' : '지금 내 마음은 어때요?'}
          </h1>

          <p style={reveal(180)} className="text-[13.5px] leading-relaxed text-white/55 mb-8">
            밖의 날씨가 내 마음을 정하지 않아요. 같은 비를 봐도 편안할 수 있어요.
          </p>

          <div style={reveal(280)} className="relative mb-4">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setHandoffError(false);
              }}
              maxLength={MAX_LENGTH}
              placeholder="지금 마음속에 떠오르는 말을 자유롭게 적어보세요."
              className="w-full min-h-[190px] rounded-[22px] bg-white/[0.07] border border-white/[0.12] backdrop-blur-[14px] px-5 py-5 text-white text-[15px] leading-relaxed placeholder:text-white/35 resize-none focus:outline-none focus:border-white/30 focus:bg-white/[0.1] transition-colors duration-200"
            />
            <span className="absolute bottom-4 right-4 text-[11.5px] text-white/40">
              {text.length} / {MAX_LENGTH}
            </span>
          </div>

          {text.trim().length > 0 && (
            <p className="text-[11px] text-white/40 mb-4">이 기기에만 임시 저장됨</p>
          )}

          <div style={reveal(380)} className="flex flex-wrap gap-2 mb-9">
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChip(chip)}
                className="h-11 px-4 rounded-full bg-white/[0.09] border border-white/[0.14] text-white/80 text-[13px] whitespace-nowrap cursor-pointer hover:bg-white/[0.16] hover:text-white active:scale-[0.98] transition-all duration-200"
              >
                {chip}
              </button>
            ))}
          </div>

          <p style={reveal(430)} className="text-[12.5px] leading-relaxed text-white/65 mb-5">
            1~7단계 대화는 무료예요. 최종 자기이해 리포트는 원할 때 4,900원에 열 수 있어요.
          </p>

          {(saveError || handoffError) && (
            <p className="text-[13px] leading-relaxed text-white/85 mb-3">
              {saveError || '입력 내용을 다음 단계로 넘기지 못했어요. 다시 시도해 주세요.'}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || loading}
            style={reveal(500)}
            className="w-full h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0c1526]/25 border-t-[#0c1526] rounded-full animate-spin" />
                저장 중...
              </>
            ) : (
              '이대로 이야기 시작하기'
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
