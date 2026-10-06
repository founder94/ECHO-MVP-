import type { ReactNode } from 'react';
import WeatherBackdrop from '@/pages/do-it/weather/components/WeatherBackdrop';
import { PRIMARY_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';

// STEP 3~7·White Door·리포트 구매·보관함 화면의 공통 틀. 기존 STEP 1/2와 같은 배경·간격·버튼 규격을 쓴다.
// 상태 4종: loading / not_configured / error / ready. 화면은 서버가 준 상태만 표시한다.

export type ScenePhase = 'loading' | 'not_configured' | 'error' | 'ready';

interface SceneShellProps {
  phase: ScenePhase;
  loadingText: string;
  errorMessage?: string;
  notConfiguredTitle?: string;
  notConfiguredText?: string;
  onRetry: () => void;
  align?: 'center' | 'left';
  children: ReactNode;
}

export default function SceneShell({
  phase,
  loadingText,
  errorMessage,
  notConfiguredTitle = 'AI 서버 설정이 필요해요.',
  notConfiguredText = '설정이 끝나면 다시 시도할 수 있어요.',
  onRetry,
  align = 'center',
  children,
}: SceneShellProps) {
  const reveal = useReveal();

  return (
    <section className="relative w-full echo-min-h-viewport flex items-center justify-center overflow-hidden">
      <WeatherBackdrop iconKey={null} />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className={`flex flex-col ${align === 'center' ? 'items-center text-center' : 'items-stretch text-left'}`}>
          <p style={reveal(0)} className={`text-[11px] tracking-[0.5em] text-white/55 font-medium mb-7 uppercase ${align === 'center' ? '' : 'text-center'}`}>
            ECHO
          </p>

          {phase === 'loading' && (
            <div style={reveal(120)} className="flex flex-col items-center">
              <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-[13.5px] text-white/60">{loadingText}</p>
            </div>
          )}

          {phase === 'not_configured' && (
            <div className="flex flex-col items-center text-center">
              <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
                {notConfiguredTitle}
              </h1>
              <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
                {notConfiguredText}
              </p>
              <button type="button" onClick={onRetry} style={reveal(360)} className={`${PRIMARY_BUTTON} max-w-xs`}>
                다시 시도하기
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center text-center">
              <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
                잠시 연결이 원활하지 않아요.
              </h1>
              <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
                {errorMessage || '요청을 처리하지 못했어요.'}
              </p>
              <button type="button" onClick={onRetry} style={reveal(360)} className={`${PRIMARY_BUTTON} max-w-xs`}>
                다시 시도하기
              </button>
            </div>
          )}

          {phase === 'ready' && children}
        </div>
      </div>
    </section>
  );
}