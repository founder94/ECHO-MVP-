import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SceneShell, { type ScenePhase } from '@/pages/do-it/components/SceneShell';
import { GHOST_BUTTON, PRIMARY_BUTTON, useReveal } from '@/pages/do-it/components/sceneStyles';
import { useConversationGate } from '@/pages/do-it/components/useConversationGate';
import { useAuth } from '@/context/AuthContext';
import { REPORT_PRICE_KRW, UNKNOWN_STATE_MESSAGE, createOrder, resumeConversation, routeWithConversation, type FlowStatus, type PaymentState } from '@/lib/echo/api';
import { PAYMENT_PENDING_BUTTON_LABEL, PAYMENT_PENDING_NOTICE, getTossClientKey, isPaymentEnabled, isUserCancel, requestCardPayment } from '@/lib/echo/toss';

const PAYABLE_STATUSES: readonly FlowStatus[] = ['report_ready'];
const priceLabel = `${REPORT_PRICE_KRW.toLocaleString('ko-KR')}원`;

// STEP 7 완료 뒤: 최종 자기이해 리포트 4,900원 단건 선택 구매.
export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const conversationId = searchParams.get('c') ?? '';
  const reveal = useReveal();

  const [phase, setPhase] = useState<ScenePhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [flowStatus, setFlowStatus] = useState<FlowStatus>('report_ready');

  const clientKey = getTossClientKey();
  const paymentEnabled = isPaymentEnabled();
  const returnPath = `/payment?c=${encodeURIComponent(conversationId)}`;

  const load = async () => {
    setPhase('loading');
    setErrorMessage('');
    const state = await resumeConversation(conversationId);
    if (!state.ok) {
      if (state.reason === 'unauthorized') {
        navigate('/login', { state: { from: returnPath } });
        return;
      }
      setPhase('error');
      setErrorMessage(state.error ?? '요청을 처리하지 못했어요.');
      return;
    }
    // 서버가 STEP 7 완료를 확인한 report_ready 대화만 리포트를 선택할 수 있다.
    if (!state.status || !PAYABLE_STATUSES.includes(state.status)) {
      const target = routeWithConversation(state.status, conversationId);
      if (!target) {
        setPhase('error');
        setErrorMessage(UNKNOWN_STATE_MESSAGE);
        return;
      }
      navigate(target, { replace: true });
      return;
    }
    if (state.reportEntitled) {
      navigate(`/report?c=${encodeURIComponent(conversationId)}`, { replace: true });
      return;
    }
    setFlowStatus(state.status);
    setPhase('ready');
  };

  useConversationGate(returnPath, () => void load());

  const handlePay = async () => {
    if (!paymentEnabled || paying) return;
    setPaying(true);
    setPayError('');
    try {
      const order: PaymentState = await createOrder(conversationId);
      if (!order.ok) {
        if (order.reason === 'unauthorized') {
          navigate('/login', { state: { from: returnPath } });
          return;
        }
        setPayError(order.error ?? '주문을 만들지 못했어요.');
        return;
      }
      if (order.alreadyPaid) {
        // 2026-09-16: 서버가 실제 paid 기록을 확인한 경우 곧바로 리포트로 연결한다(전에는 report_ready → /white-door 로 우회).
        if (order.paid || order.reportEntitled) {
          navigate(`/report?c=${encodeURIComponent(conversationId)}`, { replace: true });
        } else {
          setPayError(UNKNOWN_STATE_MESSAGE);
        }
        return;
      }
      if (!order.orderId || order.amount !== REPORT_PRICE_KRW || !order.customerKey || !order.orderName) {
        setPayError('주문 정보가 올바르지 않아요.');
        return;
      }
      const origin = window.location.origin;
      const c = encodeURIComponent(conversationId);
      await requestCardPayment({
        clientKey,
        customerKey: order.customerKey,
        orderId: order.orderId,
        orderName: order.orderName,
        amount: order.amount,
        successUrl: `${origin}/payment/success?c=${c}`,
        failUrl: `${origin}/payment/fail?c=${c}`,
        customerEmail: user?.email ?? undefined,
      });
    } catch (err) {
      if (!isUserCancel(err)) setPayError((err as Error)?.message || '결제창을 열지 못했어요.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <SceneShell phase={phase} loadingText="확인하고 있어요..." errorMessage={errorMessage} onRetry={() => void load()}>
      <h1 style={reveal(160)} className="text-[26px] leading-snug font-bold text-white mb-3">
        최종 자기이해 리포트
      </h1>
      <p style={reveal(280)} className="text-[13.5px] text-white/70 mb-8 max-w-xs leading-relaxed">
        대화는 무료예요. 리포트를 선택할 때만 한 번 결제해요.
        <br />
        자동 결제나 구독은 없어요.
      </p>

      <div style={reveal(400)} className="w-full max-w-xs rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-md px-5 py-4 mb-3 text-left">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-white/75">자기이해 리포트 · 1회</span>
          <span className="text-[17px] font-bold text-white">{priceLabel}</span>
        </div>
        <p className="text-[11.5px] text-white/45 mt-2">원할 때 한 번만 선택해요.</p>
      </div>

      {!paymentEnabled && (
        <p style={reveal(440)} className="text-[12.5px] text-white/70 mb-6 max-w-xs whitespace-pre-line">{PAYMENT_PENDING_NOTICE}</p>
      )}

      {payError && <p className="text-[12.5px] text-red-300 mb-3 max-w-xs">{payError}</p>}

      <div style={reveal(520)} className="w-full max-w-xs flex flex-col gap-3">
        <button type="button" onClick={handlePay} disabled={!paymentEnabled || paying} aria-disabled={!paymentEnabled || paying} className={PRIMARY_BUTTON}>
          {!paymentEnabled ? (
            PAYMENT_PENDING_BUTTON_LABEL
          ) : paying ? (
            <>
              <span className="w-4 h-4 border-2 border-[#0c1526]/25 border-t-[#0c1526] rounded-full animate-spin" />
              결제창 여는 중...
            </>
          ) : (
            `${priceLabel}으로 리포트 열기`
          )}
        </button>
        <button type="button" onClick={() => navigate(routeWithConversation(flowStatus, conversationId) ?? '/')} disabled={paying} className={GHOST_BUTTON}>
          조금 더 생각해 볼게요
        </button>
      </div>
    </SceneShell>
  );
}
