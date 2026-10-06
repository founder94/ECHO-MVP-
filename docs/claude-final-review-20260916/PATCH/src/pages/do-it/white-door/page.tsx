import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WeatherBackdrop from '@/pages/do-it/weather/components/WeatherBackdrop';
import { useAuth } from '@/context/AuthContext';
import { UNKNOWN_STATE_MESSAGE, resumeConversation, routeWithConversation } from '@/lib/echo/api';

type Phase = 'loading' | 'not_configured' | 'error' | 'ready';

export default function WhiteDoorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const conversationId = searchParams.get('c') ?? '';

  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const initRef = useRef(false);
  const returnPath = routeWithConversation('report_ready', conversationId) ?? '/weather-check';

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  const resume = async () => {
    if (!user || !conversationId) return;
    setPhase('loading');
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
    // White Door는 STEP 7 답변까지 서버 저장이 끝난 뒤에만 연다.
    if (state.status !== 'report_ready') {
      const target = routeWithConversation(state.status, conversationId);
      if (!target) {
        setPhase('error');
        setErrorMessage(UNKNOWN_STATE_MESSAGE);
        return;
      }
      navigate(target, { replace: true });
      return;
    }
    setPhase('ready');
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

  const handleRetry = () => void resume();
  const handleHome = () => navigate('/');
  // 문을 여는 선택 → 완주한 대화를 바탕으로 리포트 단건 구매 안내.
  const handleOpenDoor = () => navigate(`/payment?c=${encodeURIComponent(conversationId)}`);

  const reveal = (delay: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });

  return (
    <section className="relative w-full echo-min-h-viewport flex items-center justify-center overflow-hidden">
      <WeatherBackdrop iconKey={null} />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className="flex flex-col items-center text-center">
          <p style={reveal(0)} className="text-[11px] tracking-[0.5em] text-white/55 font-medium mb-10 uppercase">
            ECHO
          </p>

          {phase === 'loading' && (
            <div style={reveal(120)} className="flex flex-col items-center">
              <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-[13.5px] text-white/60">확인하고 있어요...</p>
            </div>
          )}

          {phase === 'not_configured' && (
            <>
              <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
                AI 서버 설정이 필요해요.
              </h1>
              <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
                설정이 끝나면 다시 시도할 수 있어요.
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
            <>
              <h1 style={reveal(160)} className="text-[26px] leading-snug font-bold text-white mb-3">
                일곱 단계 이야기를
                <br />
                모두 마쳤어요.
              </h1>

              <div style={reveal(320)} className="w-28 h-40 mx-auto my-10 relative">
                <div className="absolute inset-0 rounded-t-[60px] bg-white/[0.06] border border-white/15 backdrop-blur-md" />
                <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/70" />
              </div>

              <p style={reveal(460)} className="text-[13.5px] text-white/70 mb-10 max-w-xs leading-relaxed">
                1~7단계 대화는 모두 무료예요.
                <br />
                이제 내가 들려준 내용을 바탕으로 최종 자기이해 리포트를 열 수 있어요.
              </p>

              <button
                type="button"
                onClick={handleOpenDoor}
                style={reveal(600)}
                className="w-full max-w-xs h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 mb-3"
              >
                리포트 안내 보기
              </button>
              <button
                type="button"
                onClick={handleHome}
                style={reveal(680)}
                className="w-full max-w-xs h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md text-white text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/20 active:scale-[0.99] transition-all duration-200"
              >
                처음으로
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
