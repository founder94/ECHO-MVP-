import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SceneShell, { type ScenePhase } from '@/pages/do-it/components/SceneShell';
import { GHOST_BUTTON, PRIMARY_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';
import { useConversationGate } from '@/pages/do-it/components/useConversationGate';
import { IN_PROGRESS_RETRY_MS, REPORT_PRICE_KRW, UNKNOWN_STATE_MESSAGE, confirmPayment, type PaymentState } from '@/lib/echo/api';
import { PAYMENT_PENDING_NOTICE, isPaymentEnabled } from '@/lib/echo/toss';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const CONFIRM_RETRY_MAX = 3;

// Toss 가 돌려보낸 성공 화면. 서버 승인(confirm)이 통과해야만 리포트로 간다.
export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('c') ?? '';
  const paymentKey = searchParams.get('paymentKey') ?? '';
  const orderId = searchParams.get('orderId') ?? '';
  const amount = Number(searchParams.get('amount') ?? '');
  const reveal = useReveal();

  const [phase, setPhase] = useState<ScenePhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const paymentPath = `/payment?c=${encodeURIComponent(conversationId)}`;
  const returnPath = `/payment/success?${searchParams.toString()}`;

  const confirm = async () => {
    setPhase('loading');
    setErrorMessage('');
    setFailed(false);
    if (!isPaymentEnabled()) {
      setFailed(true);
      setPhase('ready');
      setErrorMessage(PAYMENT_PENDING_NOTICE);
      return;
    }
    if (!paymentKey || !orderId || amount !== REPORT_PRICE_KRW) {
      setFailed(true);
      setPhase('ready');
      setErrorMessage('결제 정보가 올바르지 않아요. 다시 시도해 주세요.');
      return;
    }
    let result: PaymentState = { ok: false };
    for (let attempt = 0; attempt < CONFIRM_RETRY_MAX; attempt++) {
      result = await confirmPayment(paymentKey, orderId, amount);
      if (result.ok || result.reason !== 'in_progress') break;
      await wait(IN_PROGRESS_RETRY_MS);
    }
    if (!result.ok) {
      if (result.reason === 'unauthorized') {
        navigate('/login', { state: { from: returnPath } });
        return;
      }
      if (result.reason === 'payment_failed' || result.reason === 'payment_not_configured' || result.reason === 'forbidden') {
        setFailed(true);
        setPhase('ready');
        setErrorMessage(result.error ?? '결제를 확인하지 못했어요.');
        return;
      }
      setPhase('error');
      setErrorMessage(result.error ?? '결제를 확인하지 못했어요.');
      return;
    }
    if (!result.paid) {
      setPhase('error');
      setErrorMessage('결제 권한을 확인하지 못했어요. 다시 시도해 주세요.');
      return;
    }
    const confirmedConversationId = result.conversationId ?? conversationId;
    if (!confirmedConversationId) {
      setPhase('error');
      setErrorMessage(UNKNOWN_STATE_MESSAGE);
      return;
    }
    // 2026-09-16: paid 저장 뒤에는 대화 완료 상태를 그대로 보존하고 곧바로 리포트로 연결한다(White Door·STEP 3 되돌림 없음).
    // 전에는 routeForStatus(report_ready)=/white-door 로 보내 구매자가 안내 화면을 한 번 더 거쳤다.
    // 리포트 화면이 서버에서 완료·구매 권한을 다시 확인하므로 프론트는 권한을 만들지 않는다. 재결제는 없다.
    navigate(`/report?c=${encodeURIComponent(confirmedConversationId)}`, { replace: true });
  };

  useConversationGate(returnPath, () => void confirm());

  return (
    <SceneShell phase={phase} loadingText="결제를 확인하고 있어요..." errorMessage={errorMessage} onRetry={() => void confirm()}>
      {failed && (
        <>
          <h1 style={reveal(120)} className="text-[24px] leading-snug font-bold text-white mb-3">
            결제가 확인되지 않았어요.
          </h1>
          <p style={reveal(240)} className="text-[13.5px] leading-relaxed text-white/60 mb-10 max-w-xs">
            {errorMessage}
          </p>
          <div style={reveal(360)} className="w-full max-w-xs flex flex-col gap-3">
            <button type="button" onClick={() => navigate(paymentPath, { replace: true })} className={PRIMARY_BUTTON}>
              결제 안내로 돌아가기
            </button>
            <button type="button" onClick={() => navigate('/')} className={GHOST_BUTTON}>
              처음으로
            </button>
          </div>
        </>
      )}
    </SceneShell>
  );
}
