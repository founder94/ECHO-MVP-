import { useNavigate, useSearchParams } from 'react-router-dom';
import SceneShell from '@/pages/do-it/components/SceneShell';
import { GHOST_BUTTON, PRIMARY_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';

const DEFAULT_MESSAGE = '결제가 진행되지 않았어요. 카드 정보를 확인하고 다시 시도해 주세요.';
const MESSAGE_MAX = 200;

// Toss 가 돌려보낸 실패·취소 화면. 서버 저장 없음 — 안내와 되돌아가기만.
export default function PaymentFailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('c') ?? '';
  const message = (searchParams.get('message') ?? '').trim().slice(0, MESSAGE_MAX) || DEFAULT_MESSAGE;
  const reveal = useReveal();

  const paymentPath = conversationId ? `/payment?c=${encodeURIComponent(conversationId)}` : '/weather-check';

  return (
    <SceneShell phase="ready" loadingText="" onRetry={() => navigate(paymentPath, { replace: true })}>
      <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
        결제가 완료되지 않았어요.
      </h1>
      <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
        {message}
      </p>
      <div style={reveal(360)} className="w-full max-w-xs flex flex-col gap-3">
        <button type="button" onClick={() => navigate(paymentPath, { replace: true })} className={PRIMARY_BUTTON}>
          다시 시도하기
        </button>
        <button type="button" onClick={() => navigate('/')} className={GHOST_BUTTON}>
          처음으로
        </button>
      </div>
    </SceneShell>
  );
}