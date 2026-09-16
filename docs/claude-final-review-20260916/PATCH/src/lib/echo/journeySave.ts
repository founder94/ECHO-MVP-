// STEP 3~7 답변 저장 요청 상태. 서버 완료 전에는 화면 상태나 다음 단계를 만들지 않는다.

import { START_TIMEOUT_MS } from './startSave.ts';

export interface JourneyResultLike {
  ok: boolean;
  status?: string;
  reason?: string;
  error?: string;
}

export type JourneySaveOutcome<R extends JourneyResultLike> =
  | { kind: 'success'; result: R; submittedText: string }
  | { kind: 'failure'; result: R; submittedText: string }
  | { kind: 'timeout'; submittedText: string }
  | { kind: 'busy' }
  | { kind: 'stale' };

interface JourneySaveDeps<R extends JourneyResultLike> {
  submit: (text: string, token: string) => Promise<R>;
  newToken: () => string;
  timeoutMs?: number;
}

type Raced<R> = { kind: 'value'; value: R } | { kind: 'rejected'; message: string } | { kind: 'timeout' };

function raceTimeout<R>(request: Promise<R>, timeoutMs: number): Promise<Raced<R>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
    request.then(
      (value) => {
        clearTimeout(timer);
        resolve({ kind: 'value', value });
      },
      (error) => {
        clearTimeout(timer);
        resolve({ kind: 'rejected', message: (error as Error)?.message || '네트워크 오류가 발생했어요.' });
      },
    );
  });
}

export class JourneySaveController<R extends JourneyResultLike> {
  private token = '';
  private tokenText = '';
  private seq = 0;
  private cancelled = false;
  private inFlight: Promise<unknown> | null = null;
  private readonly deps: JourneySaveDeps<R>;

  constructor(deps: JourneySaveDeps<R>) {
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

  async save(text: string): Promise<JourneySaveOutcome<R>> {
    if (this.inFlight) return { kind: 'busy' };
    this.cancelled = false;
    if (!this.token || this.tokenText !== text) {
      this.token = this.deps.newToken();
      this.tokenText = text;
    }
    const seq = ++this.seq;
    const submittedText = text;
    const request = this.deps.submit(submittedText, this.token);
    this.inFlight = request;
    const settle = () => {
      if (this.inFlight === request) this.inFlight = null;
    };
    request.then(settle, settle);

    const raced = await raceTimeout(request, this.deps.timeoutMs ?? START_TIMEOUT_MS);
    if (this.cancelled || seq !== this.seq) return { kind: 'stale' };
    if (raced.kind === 'timeout') {
      // 2026-09-16: 시간 초과 뒤 화면 잠금 해제. 같은 원문·같은 토큰으로 재시도하면 서버가 중복을 판정한다(IN_PROGRESS 또는 저장된 상태).
      if (this.inFlight === request) this.inFlight = null;
      return { kind: 'timeout', submittedText };
    }
    if (raced.kind === 'rejected') {
      return {
        kind: 'failure',
        result: { ok: false, reason: 'error', error: raced.message } as R,
        submittedText,
      };
    }
    if (raced.value.ok) {
      this.token = '';
      this.tokenText = '';
      return { kind: 'success', result: raced.value, submittedText };
    }
    return { kind: 'failure', result: raced.value, submittedText };
  }
}