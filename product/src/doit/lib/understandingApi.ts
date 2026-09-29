import { supabase } from '@/lib/supabase/client';

// 운영 DB와 함수 적용·검증 승인 후 빌드 환경에서만 켠다. 런타임 자동 활성화 없음.
export const A_STRUCTURE_SERVER_ENABLED = import.meta.env.VITE_A_STRUCTURE_SERVER_ENABLED === 'true';

export class UnderstandingError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export async function understandingRequest<T>(body: Record<string, unknown>, expectedUserId?: string): Promise<T> {
  return serverFunctionRequest<T>('doit-understanding', body, expectedUserId);
}

// 서버 함수 호출 공통: 로그인 확인 → 호출 → 오류 코드·안내 문장 꺼내기 → 그 사이 계정이 바뀌지 않았는지 다시 확인.
// doit-understanding(대화)·doit-connect(연결)가 같은 길을 쓴다.
export async function serverFunctionRequest<T>(fn: 'doit-understanding' | 'doit-connect' | 'doit-account' | 'doit-agent', body: Record<string, unknown>, expectedUserId?: string): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new UnderstandingError('UNAUTHORIZED', '로그인한 뒤 이어서 저장해 주세요.');
  if (expectedUserId && session.user.id !== expectedUserId) throw new UnderstandingError('UNAUTHORIZED', '계정이 바뀌었어요. 현재 계정에서 다시 시도해 주세요.');
  const { data, error } = await supabase.functions.invoke(fn, { body, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) {
    let detail: { code?: string; error?: string } = {};
    if (error.context instanceof Response) {
      try { detail = await error.context.clone().json(); } catch { /* 일반 오류로 표시 */ }
    }
    throw new UnderstandingError(detail.code ?? 'NETWORK_ERROR', detail.error ?? '저장 결과를 확인하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.');
  }
  if (data?.ok !== true) throw new UnderstandingError(data?.code ?? 'ERROR', data?.error ?? '요청을 처리하지 못했어요.');
  const { data: current, error: currentError } = await supabase.auth.getSession();
  if (currentError || current.session?.user.id !== session.user.id) throw new UnderstandingError('UNAUTHORIZED', '계정이 바뀌었어요. 현재 계정에서 다시 시도해 주세요.');
  return data as T;
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)]));
  return value;
}

// 저장 응답이 끊겨도 새로고침 후 같은 내용은 같은 요청으로 재전송한다.
// 로컬에는 원문 대신 본문 해시와 임의 요청 ID만 남긴다. 사용자별 분리.
export async function prepareUnderstandingRequest(userId: string, body: Record<string, unknown>) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sorted(body))));
  const hex = Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, '0')).join('');
  const key = `doit:request:${userId}:${hex}`;
  let requestId: string;
  try {
    requestId = localStorage.getItem(key) || crypto.randomUUID();
    localStorage.setItem(key, requestId);
  } catch {
    throw new UnderstandingError('STORAGE_UNAVAILABLE', '이 기기에 재시도 정보를 보관할 수 없어요. 브라우저 저장 허용 후 다시 시도해 주세요.');
  }
  return { body: { ...body, requestId }, complete: () => { try { localStorage.removeItem(key); } catch { /* 같은 ID 재전송은 서버가 처리 */ } } };
}

export async function saveDoitHandoff(conversationId: string): Promise<void> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnderstandingError('UNAUTHORIZED', '로그인한 뒤 이어가 주세요.');
  const request = await prepareUnderstandingRequest(user.id, { action: 'handoff', conversationId });
  await understandingRequest(request.body, user.id);
  // 클릭 재시도·새 탭에서도 같은 대화 연결은 재사용한다.
}
