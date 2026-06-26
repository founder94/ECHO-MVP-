import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PaymentGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function PaymentGateModal({ isOpen, onClose, isDarkMode }: PaymentGateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const basePath = (window as any).__BASE_PATH__ || '';
      const pathPrefix = basePath ? `/${basePath.split('/').filter(Boolean).join('/')}` : '';
      const successUrl = `${window.location.origin}${pathPrefix}/thank-you?type=payment`;
      const cancelUrl = `${window.location.origin}${pathPrefix}/`;

      const fnUrl = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/create-echo-checkout`;

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ successUrl, cancelUrl }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || '결제 세션 생성에 실패했습니다');
      }

      // Create order record for payment tracking
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('order_headers').insert({
          customer_id: session.user.id,
          currency: 'KRW',
          payment_provider: 'stripe',
          status: 'pending_payment',
          subtotal_items: 9900,
          checkout_session_id: data.sessionId,
        });
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || '결제 처리 중 오류가 발생했습니다');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] p-8 text-center"
        style={{
          background: '#0f0f0f',
          animation: 'modal-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer"
          aria-label="닫기"
        >
          <i className="ri-close-line text-base" />
        </button>

        <div className="mb-7">
          <div className="text-[9px] font-mono tracking-[0.35em] uppercase text-white/15 mb-4">
            STEP 3
          </div>
          <h3 className="font-display font-bold text-lg text-white mb-3 tracking-tight">
            ECHO Premium Report
          </h3>
          <p className="text-white/45 text-sm leading-relaxed">
            AI 분석 기반의 인사이트 리포트와
            <br />
            White Door 경험에 접근하려면
            <br />
            결제가 필요합니다.
          </p>

          <div className="mt-6 py-4 px-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-2">ONE-TIME</div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-white tracking-tight">₩9,900</span>
            </div>
            <div className="text-[10px] text-white/20 mt-1.5">일회성 결제 · 평생 이용</div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400/80 mb-4">{error}</p>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full rounded-full px-6 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #F5D4A1, #C9A96E)',
              color: '#0a0a0a',
              boxShadow: '0 0 40px rgba(245,212,161,0.2)',
            }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin" />
                결제 진행 중...
              </span>
            ) : (
              '결제하기 · ₩9,900'
            )}
          </button>
          <button
            onClick={onClose}
            className="text-white/25 text-xs hover:text-white/45 transition-colors cursor-pointer mt-1.5 py-1"
          >
            나중에 하기
          </button>
        </div>

        <p className="text-[9px] text-white/15 mt-6 leading-relaxed">
          결제는 Stripe를 통해 안전하게 처리됩니다.
          <br />
          결제 완료 후 즉시 모든 기능을 이용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}