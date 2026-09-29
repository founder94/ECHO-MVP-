// 마음 날씨 저장(startConversation) 요청 상태 모듈 — React 무관(단위 시험 대상).
// 규칙
// - 유한 대기: START_TIMEOUT_MS 가 지나면 화면은 기다림을 끝낸다. 시간 초과는 서버 취소가 아니다(서버는 계속 처리할 수 있다).
// - 원문 보존은 화면 책임(입력값을 지우지 않는다).
// - 성공·실패·취소·시간 초과 모두 호출자가 loading 을 끝낼 수 있게 결과를 돌려준다.
// - 늦은 이전 응답 무시: 취소(화면 이탈) 뒤 도착한 응답은 'stale' 로 돌려 화면을 바꾸지 않는다.
// - 중복 저장 방지: 요청 토큰은 성공 전까지 같은 값을 유지하고(서버가 같은 토큰이면 기존 대화를 돌려줌),
//   이전 요청이 서버에서 끝나기 전에는 새 요청을 보내지 않는다('busy'). 새 토큰은 성공 뒤에만 만든다.
// 시간 값 근거: 실측 성공 응답 약 5초(콜드 스타트 2초 + 질문 생성). 서버 실패 최악은 OpenAI 25초 × 3회 ≈ 75초,
// 게이트웨이 상한 150초. 성공은 30초 안에 거의 확정되므로 30초에 사용자에게 알리고, 서버가 끝난 뒤 같은 토큰으로 재시도한다.

export const START_TIMEOUT_MS = 30_000;
export const SAVE_TIMEOUT_MESSAGE = '응답이 늦어지고 있어요. 작성한 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.';
export const SAVE_BUSY_MESSAGE = '이전 저장 요청을 아직 처리하고 있어요. 잠시만 기다린 뒤 다시 눌러 주세요.';

export interface StartResultLike {
  ok: boolean;
  conversationId?: string;
  status?: string;
  reason?: string;
  error?: string;
}

export type StartOutcome<R extends StartResultLike> =
  | { kind: 'success'; result: R }
  | { kind: 'failure'; result: R }
  | { kind: 'timeout' }
  | { kind: 'busy' }
  | { kind: 'stale' };

export interface StartSaveDeps<R extends StartResultLike> {
  start: (text: string, token: string) => Promise<R>;
  newToken: () => string;
  timeoutMs?: number;
}

type Raced<R> = { kind: 'value'; value: R } | { kind: 'rejected'; message: string } | { kind: 'timeout' };

function raceTimeout<R>(p: Promise<R>, ms: number): Promise<Raced<R>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ kind: 'timeout' }), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve({ kind: 'value', value });
      },
      (err) => {
        clearTimeout(timer);
        resolve({ kind: 'rejected', message: (err as Error)?.message || '네트워크 오류가 발생했어요.' });
      },
    );
  });
}

export class StartSaveController<R extends StartResultLike> {
  private token = '';
  private seq = 0;
  private inFlight: Promise<unknown> | null = null;
  private cancelled = false;
  private readonly deps: StartSaveDeps<R>;

  constructor(deps: StartSaveDeps<R>) {
    this.deps = deps;
  }

  /** 현재 요청 토큰(성공 전까지 유지). 시험·진단용. */
  get requestToken(): string {
    return this.token;
  }

  /** 이전 요청이 아직 서버 응답을 기다리는 중인지. */
  get isInFlight(): boolean {
    return this.inFlight !== null;
  }

  /** 화면 이탈: 이후 도착하는 응답을 무시한다. 서버 요청을 취소하지는 않는다. */
  cancel(): void {
    this.cancelled = true;
    this.seq += 1;
  }

  async submit(text: string): Promise<StartOutcome<R>> {
    if (this.inFlight) return { kind: 'busy' };
    this.cancelled = false;
    if (!this.token) this.token = this.deps.newToken();
    const seq = ++this.seq;

    const p = this.deps.start(text, this.token);
    this.inFlight = p;
    const settle = () => {
      if (this.inFlight === p) this.inFlight = null;
    };
    p.then(settle, settle);

    const raced = await raceTimeout(p, this.deps.timeoutMs ?? START_TIMEOUT_MS);
    if (this.cancelled || seq !== this.seq) return { kind: 'stale' };
    if (raced.kind === 'timeout') return { kind: 'timeout' };
    if (raced.kind === 'rejected') {
      return { kind: 'failure', result: { ok: false, reason: 'error', error: raced.message } as R };
    }
    const result = raced.value;
    if (result.ok && result.conversationId) {
      this.token = ''; // 성공 뒤에만 새 토큰을 만들 수 있다
      return { kind: 'success', result };
    }
    return { kind: 'failure', result };
  }
}
