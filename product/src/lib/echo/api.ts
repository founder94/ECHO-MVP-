import { supabase } from '@/lib/supabase/client';

export type UnderstandingChoice = 'agree' | 'alittle' | 'no' | 'explain';

// 서버가 승인하는 상태 전체. STEP 1~7 무료 대화 + 선택형 유료 리포트.
export type FlowStatus =
  | 'step1'
  | 'step2'
  | 'understanding'
  | 'followup'
  | 'white_door_ready'
  | 'step3'
  | 'step4'
  | 'step5'
  | 'step6'
  | 'step7'
  | 'report_ready'
  | 'report_done';

const FLOW_STATUSES: readonly FlowStatus[] = [
  'step1',
  'step2',
  'understanding',
  'followup',
  'white_door_ready',
  'step3',
  'step4',
  'step5',
  'step6',
  'step7',
  'report_ready',
  'report_done',
];

export type JourneyStepStatus = 'step3' | 'step4' | 'step5' | 'step6' | 'step7';
const JOURNEY_STEP_STATUSES: readonly JourneyStepStatus[] = ['step3', 'step4', 'step5', 'step6', 'step7'];
export const JOURNEY_FIRST_STEP = 3;
export const JOURNEY_LAST_STEP = 7;

export type FlowReason =
  | 'not_configured'
  | 'payment_not_configured'
  | 'payment_failed'
  | 'payment_required'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_state'
  | 'unknown_state'
  | 'in_progress'
  | 'no_candidate'
  | 'rate_limited'
  | 'timeout'
  | 'error';

export interface ReportSection {
  heading: string;
  body: string;
  status: 'confirmed' | 'candidate';
}
export interface ReportContent {
  title: string;
  summary: string;
  sections: ReportSection[];
  next_step: string;
}
export interface ReportRow {
  id: string;
  title: string;
  summary: string;
  content: ReportContent;
  created_at: string;
}
export interface LockerItem {
  id: string;
  conversation_id: string;
  title: string;
  summary: string;
  created_at: string;
}

export interface FlowState {
  ok: boolean;
  status?: FlowStatus;
  step?: number;
  question?: string;
  understanding?: string;
  previousAnswer?: string;
  conversationId?: string;
  needsQuestion?: boolean;
  hasReport?: boolean;
  reportEntitled?: boolean;
  report?: ReportRow;
  items?: LockerItem[];
  code?: string;
  error?: string;
  reason?: FlowReason;
}

export interface PaymentState {
  ok: boolean;
  status?: FlowStatus;
  conversationId?: string;
  orderId?: string;
  amount?: number;
  orderName?: string;
  customerKey?: string;
  alreadyPaid?: boolean;
  paid?: boolean;
  transitionPending?: boolean;
  reportEntitled?: boolean;
  receiptUrl?: string | null;
  code?: string;
  error?: string;
  reason?: FlowReason;
}

const CONVERSATION_FUNCTION = 'get-step-question';
const JOURNEY_FUNCTION = 'echo-journey';
const PAYMENT_FUNCTION = 'echo-payment';
export const IN_PROGRESS_RETRY_MS = 1500;
// 리포트 가격. 현재 미확정 → null(대표 결정 2026-09-26 · 옛 4,900원은 폐기). null 이면 결제를 시작하지 않는다.
// 새 가격은 대표 승인 뒤에만 넣는다. 서버 echo-payment 의 PRICE_KRW 와 같은 값이어야 한다.
export const REPORT_PRICE_KRW: number | null = null as number | null;

export function isFlowStatus(v: unknown): v is FlowStatus {
  return typeof v === 'string' && (FLOW_STATUSES as readonly string[]).includes(v);
}
export function isJourneyStepStatus(v: unknown): v is JourneyStepStatus {
  return typeof v === 'string' && (JOURNEY_STEP_STATUSES as readonly string[]).includes(v);
}
export function journeyStatusForStep(n: number): JourneyStepStatus | null {
  const s = `step${n}`;
  return isJourneyStepStatus(s) ? s : null;
}

// 서버가 승인한 상태 → 화면 경로. 프론트는 이 매핑만 표시한다.
// 알 수 없는 상태는 null: 절대 STEP 1로 숨겨서 보내지 않는다(화면이 명시 오류로 처리).
export function routeForStatus(status?: string): string | null {
  switch (status) {
    case 'step1':
      return '/story-start';
    case 'step2':
      return '/step/2';
    case 'understanding':
    case 'followup':
      return '/understanding-check';
    case 'white_door_ready':
      return '/white-door';
    case 'step3':
    case 'step4':
    case 'step5':
    case 'step6':
    case 'step7':
      return `/step/${status.slice(4)}`;
    case 'report_ready':
      return '/white-door';
    case 'report_done':
      return '/report';
    default:
      return null;
  }
}

export function routeWithConversation(status: string | undefined, conversationId: string): string | null {
  const base = routeForStatus(status);
  return base ? `${base}?c=${encodeURIComponent(conversationId)}` : null;
}

export const UNKNOWN_STATE_MESSAGE = '알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.';
export const SAVE_FAILED_MESSAGE = '저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.';

function mapReason(code?: string): FlowReason {
  switch (code) {
    case 'AI_NOT_CONFIGURED':
      return 'not_configured';
    case 'PAYMENT_NOT_CONFIGURED':
      return 'payment_not_configured';
    case 'PAYMENT_FAILED':
    case 'PAYMENT_ERROR':
    case 'AMOUNT_MISMATCH':
      return 'payment_failed';
    case 'PAYMENT_REQUIRED':
      return 'payment_required';
    case 'UNAUTHORIZED':
      return 'unauthorized';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'INVALID_STATE':
      return 'invalid_state';
    case 'UNKNOWN_STATE':
      return 'unknown_state';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'NO_CANDIDATE':
      return 'no_candidate';
    case 'RATE_LIMITED':
      return 'rate_limited';
    default:
      return 'error';
  }
}

interface ErrorBody {
  ok?: boolean;
  code?: string;
  error?: string;
}

// supabase.functions.invoke 는 2xx 가 아니면 error 에 응답 본문을 싣는다. 본문의 code 를 우선 사용한다.
async function readErrorBody(error: unknown): Promise<ErrorBody | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as ErrorBody;
      if (body && typeof body === 'object') return body;
    } catch {
      /* 본문 없음 */
    }
    if (ctx.status === 401) return { ok: false, code: 'UNAUTHORIZED' };
  }
  return null;
}

// 2026-09-16: 모든 서버 함수 호출에 유한 대기 상한을 둔다(STEP 1·2·이해 확인처럼 별도 컨트롤러가 없는 화면 포함).
// 서버 최악값: 질문 생성 6초×2회, 리포트 20초×2회. 상한을 넘으면 화면은 기다림을 끝내고 입력·토큰을 유지한 채 재시도할 수 있다.
// 요청 자체는 취소되지 않으므로(functions-js 에 AbortSignal 없음) 재시도는 같은 토큰으로 보내고 서버가 중복을 판정한다.
export const REQUEST_TIMEOUT_MS = 40_000;
export const REPORT_REQUEST_TIMEOUT_MS = 75_000;
export const REQUEST_TIMEOUT_MESSAGE = '응답이 늦어지고 있어요. 작성한 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.';

type Invoked = { data: unknown; error: unknown };
type RacedInvoke = { kind: 'value'; value: Invoked } | { kind: 'timeout' };
function raceInvoke(request: Promise<Invoked>, timeoutMs: number): Promise<RacedInvoke> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
    request.then(
      (value) => {
        clearTimeout(timer);
        resolve({ kind: 'value', value });
      },
      (err) => {
        clearTimeout(timer);
        resolve({ kind: 'value', value: { data: null, error: err } });
      },
    );
  });
}

async function call<T extends { ok: boolean; code?: string; error?: string; reason?: FlowReason }>(
  fn: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  try {
    const timeoutMs = action === 'report' ? REPORT_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    const raced = await raceInvoke(supabase.functions.invoke(fn, { body: { action, ...payload } }), timeoutMs);
    if (raced.kind === 'timeout') {
      return { ok: false, reason: 'timeout', code: 'CLIENT_TIMEOUT', error: REQUEST_TIMEOUT_MESSAGE } as T;
    }
    const { data, error } = raced.value;
    if (error) {
      const body = await readErrorBody(error);
      if (body) return { ...body, ok: false, reason: mapReason(body.code) } as T;
      const msg = (error as { message?: string }).message ?? '';
      if (msg.toLowerCase().includes('unauthorized')) {
        return { ok: false, reason: 'unauthorized', error: '로그인이 필요해요.' } as T;
      }
      return { ok: false, reason: 'error', error: msg || '요청을 처리하지 못했어요.' } as T;
    }
    const state = (data ?? {}) as T;
    if (!state.ok) return { ...state, reason: mapReason(state.code) };
    return state;
  } catch (err) {
    return { ok: false, reason: 'error', error: (err as Error)?.message || '네트워크 오류가 발생했어요.' } as T;
  }
}

async function invoke(fn: string, action: string, payload: Record<string, unknown>): Promise<FlowState> {
  const state = await call<FlowState>(fn, action, payload);
  if (!state.ok) return state;
  if (!isFlowStatus(state.status) && action !== 'list') {
    return { ok: false, reason: 'unknown_state', code: 'UNKNOWN_STATE', error: UNKNOWN_STATE_MESSAGE };
  }
  return state;
}

export function newRequestToken(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// ── STEP 1~2와 이해 확인(get-step-question) ──

// 감정 원문을 먼저 저장해 대화를 시작한다. 질문 생성은 별도 요청이라 AI 지연이 원문 저장을 막지 않는다.
export function startConversation(mindText: string, token: string): Promise<FlowState> {
  return invoke(CONVERSATION_FUNCTION, 'start', { mindText, token });
}

// STEP 1·2 질문, 이해 요약, 정정 후 질문이 아직 없을 때만 서버에서 생성한다.
export function askStepQuestion(conversationId: string, token: string): Promise<FlowState> {
  return invoke(CONVERSATION_FUNCTION, 'ask', { conversationId, token });
}

// 현재 대화 상태를 서버에서 복원한다.
// STEP 3 이후 상태는 get-step-question 이 UNKNOWN_STATE 로 답하므로 echo-journey 에서 다시 읽는다.
// 예전 흐름에서 STEP 2 뒤 white_door_ready에 남은 대화는 echo-journey가 저장 기록을
// 검증한 뒤 STEP 3으로 복원한다. 프론트나 결제 상태가 단계를 만들지 않는다.
export async function resumeConversation(conversationId: string): Promise<FlowState> {
  const state = await invoke(CONVERSATION_FUNCTION, 'resume', { conversationId });
  if (!state.ok && state.reason === 'unknown_state') {
    return resumeJourney(conversationId);
  }
  if (state.ok && state.status === 'white_door_ready') {
    return resumeJourney(conversationId);
  }
  return state;
}

// STEP 1 / STEP 2 / 후속 질문에 대한 자유입력 답변을 서버에 저장한다.
export function submitAnswer(conversationId: string, answer: string, token: string): Promise<FlowState> {
  return invoke(CONVERSATION_FUNCTION, 'answer', { conversationId, answer, token });
}

// SCENE 3 이해 확인 4버튼 선택(정정·거절·직접 설명 포함)을 서버에 저장한다.
export function submitChoice(
  conversationId: string,
  choice: UnderstandingChoice,
  text: string,
  token: string,
): Promise<FlowState> {
  return invoke(CONVERSATION_FUNCTION, 'choose', { conversationId, choice, text, token });
}

// ── 무료 STEP 3~7과 선택형 최종 리포트(echo-journey) ──

// 여정 상태 복원(STEP 3~7 질문 유무·리포트 권한 포함). 리포트 미구매 상태에는 본문이 없다.
export function resumeJourney(conversationId: string): Promise<FlowState> {
  return invoke(JOURNEY_FUNCTION, 'resume', { conversationId });
}

// 현재 단계 질문이 아직 없을 때 서버가 생성한다. 이미 있으면 그대로 돌아온다.
export function askJourneyQuestion(conversationId: string, token: string): Promise<FlowState> {
  return invoke(JOURNEY_FUNCTION, 'ask', { conversationId, token });
}

// STEP 3~7 답변을 먼저 저장 → 다음 단계 또는 리포트 준비 상태.
export function submitJourneyAnswer(conversationId: string, answer: string, token: string): Promise<FlowState> {
  return invoke(JOURNEY_FUNCTION, 'answer', { conversationId, answer, token });
}

// 유효한 STEP 7 완료와 실제 구매 권한을 서버가 확인한 뒤 리포트 생성(대화당 1건, 이미 있으면 조회).
export function generateReport(conversationId: string, token: string): Promise<FlowState> {
  return invoke(JOURNEY_FUNCTION, 'report', { conversationId, token });
}

// 보관함 목록(본인 리포트만).
export function listReports(): Promise<FlowState> {
  return invoke(JOURNEY_FUNCTION, 'list', {});
}

// ── 결제(echo-payment) ──

// 주문 생성(금액은 서버 상수로만 정한다). 가격 미확정·review_pending 에서는 호출하지 않으며, 호출돼도 서버가 거절한다.
export function createOrder(conversationId: string): Promise<PaymentState> {
  return call<PaymentState>(PAYMENT_FUNCTION, 'create', { conversationId });
}

// Toss 성공 화면 파라미터를 서버에 넘겨 승인 확인. 서버가 금액·주문을 검증한 뒤에만 STEP 3과 리포트 권한이 열린다.
export function confirmPayment(paymentKey: string, orderId: string, amount: number): Promise<PaymentState> {
  return call<PaymentState>(PAYMENT_FUNCTION, 'confirm', { paymentKey, orderId, amount });
}

// 새로고침·기존 구매 복원용. 진행 상태가 아니라 실제 paid 행으로만 구매를 확인한다.
export function getPaymentStatus(conversationId: string): Promise<PaymentState> {
  return call<PaymentState>(PAYMENT_FUNCTION, 'status', { conversationId });
}
