// 얼굴·지문 로그인(패스키) — 대표 2026-09-24 "얼굴로그인 진행해".
//
// - 얼굴·지문은 휴대폰 밖으로 나가지 않는다. 휴대폰이 "주인이 맞다"는 서명만 만들고, Supabase 로그인 서버가 그 서명을 확인한다.
// - 처음 가입은 지금처럼 이메일·Google 로 한다. 로그인한 뒤 설정에서 "이 기기 등록"을 한 번 하면, 다음부터 얼굴·지문으로 들어온다.
// - 빠져나갈 문: 얼굴 로그인이 안 되면(꺼져 있음·등록 없음·취소·기기 미지원) 언제나 기존 로그인이 그대로 있다.
// - 로그인 서버 설정(Authentication → Passkeys)은 대표만 켠다. 꺼져 있으면 passkey_disabled 로 알리고 기존 로그인으로 안내한다.
// - 로그에 아무것도 남기지 않는다(자격 증명·세션·계정 정보 0).
import { supabase } from '@/lib/supabase/client';
import { detectInstallContext } from '@/doit/lib/installContext';

export type PasskeySupport = 'ok' | 'in-app' | 'unsupported';

export interface PasskeyEnv {
  ua: string;
  standalone: boolean;
  maxTouchPoints: number;
  hasWebAuthn: boolean;
}

// 기기·브라우저가 얼굴 로그인을 할 수 있는지. 순수 함수라 화면 없이 검사한다(qa/passkey.test.mjs).
// 카카오톡·인스타 같은 앱 안 브라우저는 패스키 창을 막는 경우가 많아 밖의 브라우저로 안내한다.
export function passkeySupport(env: PasskeyEnv): PasskeySupport {
  if (detectInstallContext(env) === 'in-app') return 'in-app';
  return env.hasWebAuthn ? 'ok' : 'unsupported';
}

// 대표 2026-09-25 「얼굴·지문 로그인은 구현할 거면 하고, 안 되면 삭제」: 서버 쪽 등록·확인이 켜지지 않아(누르면 「아직 켜지지 않았어요」)
// 로그인·설정 화면에서 버튼을 뺀다. 서버가 준비되면 이 값을 true 로 바꾸면 다시 보인다(코드는 그대로 둔다).
export const PASSKEY_LOGIN_ENABLED = false;

export function currentPasskeySupport(): PasskeySupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return passkeySupport({
    ua: navigator.userAgent,
    standalone: Boolean(standalone),
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasWebAuthn: typeof window.PublicKeyCredential === 'function' && !!navigator.credentials,
  });
}

export type PasskeyErrorKind =
  | 'cancelled' // 사람이 창을 닫았거나 시간이 지남
  | 'disabled' // 로그인 서버에서 얼굴 로그인이 아직 꺼져 있음(대표 설정 전)
  | 'not_found' // 이 기기에 등록된 얼굴 로그인이 없음
  | 'exists' // 이미 이 기기가 등록돼 있음
  | 'too_many' // 등록 개수 상한
  | 'expired' // 확인 시간이 지남
  | 'unconfirmed' // 이메일 인증 전 계정
  | 'unknown';

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

// Supabase·브라우저가 돌려준 오류를 사람이 할 일로 바꾼다. 원문은 화면·로그 어디에도 보여 주지 않는다.
export function passkeyErrorKind(error: unknown): PasskeyErrorKind {
  if (!error || typeof error !== 'object') return 'unknown';
  const e = error as { code?: unknown; name?: unknown; message?: unknown; cause?: { name?: unknown } | null };
  const code = text(e.code);
  const cause = text(e.cause?.name);
  const msg = text(e.message).toLowerCase();
  if (code === 'passkey_disabled') return 'disabled';
  if (code === 'webauthn_credential_not_found') return 'not_found';
  if (code === 'webauthn_credential_exists' || code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || cause === 'InvalidStateError') return 'exists';
  if (code === 'too_many_passkeys') return 'too_many';
  if (code === 'webauthn_challenge_expired' || code === 'webauthn_challenge_not_found') return 'expired';
  if (code === 'email_not_confirmed' || code === 'phone_not_confirmed') return 'unconfirmed';
  if (code === 'ERROR_CEREMONY_ABORTED' || cause === 'NotAllowedError' || cause === 'AbortError' || text(e.name) === 'NotAllowedError' || msg.includes('not allowed')) return 'cancelled';
  return 'unknown';
}

export const PASSKEY_ERROR_TEXT: Record<PasskeyErrorKind, string> = {
  cancelled: '얼굴 확인을 닫았어요. 다시 눌러도 되고, 아래 방법으로 로그인해도 돼요.',
  disabled: '얼굴 로그인은 아직 켜지지 않았어요. 이메일이나 Google 로 로그인해 주세요.',
  not_found: '이 기기에 등록한 얼굴 로그인이 없어요. 먼저 이메일이나 Google 로 로그인한 뒤, 설정에서 등록해 주세요.',
  exists: '이 기기는 이미 등록돼 있어요. 다음부터 얼굴로 로그인할 수 있어요.',
  too_many: '등록할 수 있는 기기 수를 넘었어요. 안 쓰는 기기를 지운 뒤 다시 눌러 주세요.',
  expired: '확인 시간이 지났어요. 한 번 더 눌러 주세요.',
  unconfirmed: '이메일 인증을 마친 계정만 얼굴로 로그인할 수 있어요. 메일함의 인증 메일을 확인해 주세요.',
  unknown: '얼굴 로그인을 하지 못했어요. 잠시 뒤 다시 누르거나, 아래 방법으로 로그인해 주세요.',
};

// 이 프로젝트는 strict 가 꺼져 있어 ok 값만으로 갈래를 좁히지 못한다 → 실패 이유(kind)는 항상 있고, 성공이면 null.
export type PasskeyResult = { ok: boolean; kind: PasskeyErrorKind | null };
const OK: PasskeyResult = { ok: true, kind: null };
const fail = (kind: PasskeyErrorKind): PasskeyResult => ({ ok: false, kind });

/** 얼굴·지문으로 로그인. 성공하면 세션이 저장되고 로그인 상태 알림(SIGNED_IN)이 퍼진다. */
export async function signInWithFace(): Promise<PasskeyResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPasskey();
    if (error) return fail(passkeyErrorKind(error));
    return data?.session ? OK : fail('unknown');
  } catch (e) {
    return fail(passkeyErrorKind(e));
  }
}

/** 로그인한 상태에서 지금 이 기기를 얼굴 로그인용으로 등록한다. */
export async function registerFace(): Promise<PasskeyResult> {
  try {
    const { error } = await supabase.auth.registerPasskey();
    return error ? fail(passkeyErrorKind(error)) : OK;
  } catch (e) {
    return fail(passkeyErrorKind(e));
  }
}

export interface FaceDevice { id: string; name: string; createdAt: string; lastUsedAt: string | null }

/** 내가 등록한 얼굴 로그인 기기 목록. 서버가 꺼져 있으면 disabled. */
export async function listFaces(): Promise<{ ok: boolean; kind: PasskeyErrorKind | null; devices: FaceDevice[] }> {
  try {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) return { ok: false, kind: passkeyErrorKind(error), devices: [] };
    return {
      ok: true, kind: null,
      devices: (data ?? []).map((p) => ({ id: p.id, name: text(p.friendly_name) || '이름 없는 기기', createdAt: p.created_at, lastUsedAt: p.last_used_at ?? null })),
    };
  } catch (e) {
    return { ok: false, kind: passkeyErrorKind(e), devices: [] };
  }
}

export async function removeFace(passkeyId: string): Promise<PasskeyResult> {
  try {
    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    return error ? fail(passkeyErrorKind(error)) : OK;
  } catch (e) {
    return fail(passkeyErrorKind(e));
  }
}
