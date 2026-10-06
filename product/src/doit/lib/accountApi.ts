// 회원 탈퇴 서버(doit-account) 화면 쪽 창구 — 대표 2026-09-24 "출시 1.0 진행해".
// 지울 대상은 서버가 로그인 토큰으로 정한다. 화면은 사용자 번호를 보내지 않는다.
import { serverFunctionRequest, UnderstandingError } from '@/doit/lib/understandingApi';

// 서버(supabase/functions/doit-account) 의 DELETE_CONFIRM 과 같아야 한다(검사가 확인한다).
export const DELETE_CONFIRM = 'delete-my-account-v1';

export interface DeletePreview {
  counts: { answers: number; insights: number; photos: number; matches: number };
  canDelete: boolean;
  blockedReason: string | null;
}

// 앱에서 탈퇴할 수 없을 때(서버가 아직 없음·연결 끊김) — 메일로 안내한다(빠져나갈 문).
export type AccountFailure = { kind: 'unavailable' | 'blocked' | 'retry' | 'signin'; message: string };

export const UNAVAILABLE_TEXT = '지금은 앱에서 바로 탈퇴할 수 없어요. 아래 메일로 요청해 주시면 처리해 드릴게요.';

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** 서버 오류를 화면이 할 일로 바꾼다. 원문 코드는 보여 주지 않는다. */
export function accountFailure(e: unknown): AccountFailure {
  const code = e instanceof UnderstandingError ? e.code : '';
  const message = e instanceof Error && e.message ? e.message : '';
  if (code === 'UNAUTHORIZED') return { kind: 'signin', message: '로그인이 풀렸어요. 다시 로그인한 뒤 탈퇴해 주세요.' };
  if (code === 'ADMIN_ACCOUNT' || code === 'PAYMENT_RECORDS') return { kind: 'blocked', message };
  if (code === 'STORAGE_FAILED' || code === 'DELETE_FAILED' || code === 'RATE_LIMITED' || code === 'ERROR' || code === 'CONFIRM_REQUIRED') {
    return { kind: 'retry', message: message || '잠시 문제가 생겼어요. 계정은 그대로예요. 잠시 뒤 다시 눌러 주세요.' };
  }
  // NOT_FOUND(서버가 아직 안 올라감)·NETWORK_ERROR·알 수 없는 코드
  return { kind: 'unavailable', message: UNAVAILABLE_TEXT };
}

export async function fetchDeletePreview(userId: string): Promise<DeletePreview> {
  const out = await serverFunctionRequest<{ counts?: Partial<DeletePreview['counts']>; can_delete?: boolean; blocked_reason?: string | null }>('doit-account', { action: 'preview' }, userId);
  const c = out.counts ?? {};
  return {
    counts: { answers: n(c.answers), insights: n(c.insights), photos: n(c.photos), matches: n(c.matches) },
    canDelete: out.can_delete === true,
    blockedReason: typeof out.blocked_reason === 'string' && out.blocked_reason ? out.blocked_reason : null,
  };
}

export async function deleteMyAccount(userId: string): Promise<void> {
  await serverFunctionRequest('doit-account', { action: 'delete_me', confirm: DELETE_CONFIRM }, userId);
}

/** 이 기기에 남은 내 흔적(요청 재시도 표시 등 사용자 번호가 들어간 저장값)을 지운다. 실패해도 탈퇴는 이미 끝났다. */
export function clearLocalTraces(userId: string): void {
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      if (!store) continue;
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.includes(userId)) keys.push(k); }
      keys.forEach((k) => store.removeItem(k));
    } catch { /* 저장소를 못 쓰는 브라우저 — 지울 것도 없다 */ }
  }
}
