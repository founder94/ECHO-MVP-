// 마음 날씨 저장(startConversation) 요청 상태 모듈 — React 무관(단위 시험 대상).
// 시간 초과는 화면의 기다림만 끝낸다. 서버 요청은 계속될 수 있으며 성공 전까지 같은 입력은 같은 토큰을 쓴다.

export const START_TIMEOUT_MS = 30_000;
export const SAVE_TIMEOUT_MESSAGE = '응답이 늦어지고 있어요. 작성한 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.';
export const SAVE_BUSY_MESSAGE = '이전 저장 요청을 아직 처리하고 있어요. 잠시만 기다린 뒤 다시 눌러 주세요.';
export const SAVE_CHANGED_MESSAGE = '저장하는 동안 내용이 바뀌었어요. 바뀐 내용은 그대로 있어요. 다시 눌러 저장해 주세요.';

export interface StartResultLike {
  ok: boolean;
  conversationId?: string;
  status?: string;
  reason?: string;
  error?: string;
}

export type StartOutcome<R extends StartResultLike> =
  | { kind: 'success'; result: R; submittedText: string }
  | { kind: 'failure'; result: R; submittedText: string }
  | { kind: 'timeout'; submittedText: string }
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
  private tokenText = '';
  private seq = 0;
  private inFlight: Promise<unknown> | null = null;
  private cancelled = false;
  private readonly deps: StartSaveDeps<R>;

  constructor(deps: StartSaveDeps<R>) {
    this.deps = deps;
  }

  get requestToken(): string {
    return this.token;
  }

  get isInFlight(): boolean {
    return this.inFlight !== null;
  }

  cancel(): void {
    this.cancelled = true;
    this.seq += 1;
  }

  async submit(text: string): Promise<StartOutcome<R>> {
    if (this.inFlight) return { kind: 'busy' };
    this.cancelled = false;

    // 시간 초과 뒤 사용자가 원문을 바꿨다면 이전 요청 토큰을 새 원문에 재사용하지 않는다.
    if (!this.token || this.tokenText !== text) {
      this.token = this.deps.newToken();
      this.tokenText = text;
    }
    const seq = ++this.seq;
    const submittedText = text;

    const p = this.deps.start(submittedText, this.token);
    this.inFlight = p;
    const settle = () => {
      if (this.inFlight === p) this.inFlight = null;
    };
    p.then(settle, settle);

    const raced = await raceTimeout(p, this.deps.timeoutMs ?? START_TIMEOUT_MS);
    if (this.cancelled || seq !== this.seq) return { kind: 'stale' };
    if (raced.kind === 'timeout') {
      // 2026-09-16: 시간 초과 뒤에는 화면 잠금(busy)을 풀어 다시 누를 수 있게 한다. 같은 원문은 같은 토큰으로 다시 보내고,
      // 서버가 토큰으로 중복을 판정한다(처리 중이면 IN_PROGRESS, 끝났으면 저장된 상태). 늦게 온 첫 응답은 무시된다.
      if (this.inFlight === p) this.inFlight = null;
      return { kind: 'timeout', submittedText };
    }
    if (raced.kind === 'rejected') {
      return {
        kind: 'failure',
        result: { ok: false, reason: 'error', error: raced.message } as R,
        submittedText,
      };
    }
    const result = raced.value;
    if (result.ok && result.conversationId) {
      this.token = '';
      this.tokenText = '';
      return { kind: 'success', result, submittedText };
    }
    return { kind: 'failure', result, submittedText };
  }
}