// 서버를 기다리는 시간의 상한 (2026-09-23, 대표 실기기 "프로필을 불러오는 중…"에서 멈춰 이동이 안 됨).
// 전에는 서버 응답이 오지 않으면 화면이 영원히 기다렸다. 이제 정해진 시간이 지나면 기다림을 끝내고
// 각 화면이 "다시 시도 / 홈으로" 같은 빠져나갈 길을 보여 준다.
// 시간이 지나도 원래 요청을 억지로 취소하지는 않는다(늦게 온 응답은 버려진다). 쓰기(저장)에는 쓰지 않는다.

export const READ_TIMEOUT_MS = 12_000;

export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label)), ms);
  });
  return Promise.race([work, limit]).finally(() => { if (timer !== undefined) clearTimeout(timer); });
}
