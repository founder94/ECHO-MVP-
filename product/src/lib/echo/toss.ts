// Toss Payments 결제창(v2 표준 SDK) 로더 — 브라우저에서 결제창만 연다.
// 금액·주문 검증·결제 성공 판정은 서버(echo-payment)가 한다. 이 파일은 결제 성공을 만들지 않는다.
// 공개 클라이언트 키만 사용한다(비밀키 금지). 테스트·라이브 클라이언트 키 형식만 허용한다.

import { REPORT_PRICE_KRW } from '@/lib/echo/api';

const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';
const VALID_CLIENT_KEY_PREFIXES = ['test_ck_', 'live_ck_', 'test_gck_', 'live_gck_'];
const SDK_LOAD_TIMEOUT_MS = 15_000;

interface TossPaymentRequest {
  method: 'CARD';
  amount: { currency: 'KRW'; value: number };
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  customerName?: string;
  card: { useEscrow: boolean; flowMode: 'DEFAULT'; useCardPoint: boolean; useAppCardOnly: boolean };
}
interface TossPayment {
  requestPayment(req: TossPaymentRequest): Promise<void>;
}
interface TossPaymentsInstance {
  payment(opts: { customerKey: string }): TossPayment;
}
type TossFactory = (clientKey: string) => TossPaymentsInstance;

declare global {
  interface Window {
    TossPayments?: TossFactory;
  }
}

export type PaymentGate = 'review_pending' | 'enabled';
export const PAYMENT_GATE: PaymentGate = 'review_pending';
export const PAYMENT_PENDING_BUTTON_LABEL = '결제 준비 중';
export const PAYMENT_PENDING_NOTICE = '현재 결제 서비스를 준비하고 있어요.\n결제는 아직 진행되지 않습니다.';
export function isPaymentEnabled(): boolean {
  if (REPORT_PRICE_KRW === null) return false; // 가격 미확정이면 결제를 열지 않는다
  if (PAYMENT_GATE !== 'enabled') return false;
  const key = getTossClientKey();
  return key !== '' && isValidClientKey(key);
}

export function getTossClientKey(): string {
  const key = (import.meta.env.VITE_PUBLIC_TOSS_CLIENT_KEY as string | undefined) ?? '';
  return key.trim();
}

// 토스 클라이언트 키 형식 검사. 공백을 제거한 뒤 허용 형식만 통과하고 임의 문자열은 거부한다.
// 운영키 수령 전까지는 안전한 형식 준비만 한다(실제 키는 환경변수에서만 읽는다).
export function isValidClientKey(key: string): boolean {
  const trimmed = key.trim();
  return VALID_CLIENT_KEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

let sdkPromise: Promise<TossFactory> | null = null;

export function loadTossSdk(): Promise<TossFactory> {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<TossFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TOSS_SDK_URL;
    script.async = true;
    const timer = setTimeout(() => {
      sdkPromise = null;
      reject(new Error('결제 모듈을 불러오지 못했어요.'));
    }, SDK_LOAD_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      if (window.TossPayments) resolve(window.TossPayments);
      else {
        sdkPromise = null;
        reject(new Error('결제 모듈을 불러오지 못했어요.'));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      sdkPromise = null;
      reject(new Error('결제 모듈을 불러오지 못했어요.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export interface CardPaymentParams {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
}

export const USER_CANCEL_CODE = 'USER_CANCEL';

// 결제창을 연다. 성공·실패는 Toss 가 successUrl / failUrl 로 돌려보낸다. 사용자가 창을 닫으면 USER_CANCEL 로 거부된다.
export async function requestCardPayment(p: CardPaymentParams): Promise<void> {
  const factory = await loadTossSdk();
  const payment = factory(p.clientKey).payment({ customerKey: p.customerKey });
  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: p.amount },
    orderId: p.orderId,
    orderName: p.orderName,
    successUrl: p.successUrl,
    failUrl: p.failUrl,
    customerEmail: p.customerEmail,
    card: { useEscrow: false, flowMode: 'DEFAULT', useCardPoint: false, useAppCardOnly: false },
  });
}

export function isUserCancel(err: unknown): boolean {
  return (err as { code?: string })?.code === USER_CANCEL_CODE;
}