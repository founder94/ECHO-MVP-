import { useNavigate } from 'react-router-dom';
import SceneShell from '@/pages/do-it/components/SceneShell';
import { GHOST_BUTTON, PRIMARY_BUTTON, TEXT_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';
import { MODE_SELECT_PATH } from '@/lib/echo/appMode';

// 리포트 다음 장면: 새 마음 날씨로 다음 이야기를 시작하거나 보관함으로 간다. 서버 호출 없음.
export default function NextJourneyPage() {
  const navigate = useNavigate();
  const reveal = useReveal();

  return (
    <SceneShell phase="ready" loadingText="" onRetry={() => navigate('/weather-check')}>
      <h1 style={reveal(160)} className="text-[26px] leading-snug font-bold text-white mb-3">
        오늘의 이야기는
        <br />
        여기까지예요.
      </h1>
      <p style={reveal(320)} className="text-[13.5px] text-white/70 mb-10 max-w-xs leading-relaxed">
        마음의 날씨는 매일 달라져요. 다음에 다시 왔을 때, 그때의 내 마음부터 다시 적어볼 수 있어요.
      </p>
      <div style={reveal(480)} className="w-full max-w-xs flex flex-col gap-3">
        <button type="button" onClick={() => navigate('/weather-check')} className={PRIMARY_BUTTON}>
          다음 마음 날씨 적기
        </button>
        <button type="button" onClick={() => navigate('/locker')} className={GHOST_BUTTON}>
          보관함
        </button>
        <button type="button" onClick={() => navigate(MODE_SELECT_PATH)} className={TEXT_BUTTON}>
          여정 다시 고르기
        </button>
        <button type="button" onClick={() => navigate('/')} className={TEXT_BUTTON}>
          처음으로
        </button>
      </div>
    </SceneShell>
  );
}