// 전화 인증(문자 6자리) — 연결 자격의 첫 칸(대표 확정 2026-09-21 "전화 인증 필수").
// 흐름: 로그인한 계정에 번호를 붙인다(supabase.auth.updateUser({ phone })) → Supabase 가 문자를 보낸다 →
//       받은 6자리로 확인(verifyOtp type 'phone_change') → 서버(doit-connect phone_sync)가 Auth 기록을 보고 프로필을 verified 로 맞춘다.
// 화면은 "인증됐다"를 스스로 정하지 않는다. 번호는 로그·저장소·분석 이벤트 어디에도 남기지 않는다.
import { supabase } from '@/lib/supabase/client';
import { serverFunctionRequest } from '@/doit/lib/understandingApi';

export const PHONE_CODE_LENGTH = 6;
export const PHONE_RESEND_SECONDS = 60;

// 한국 휴대폰 번호만 받는다(010·011·016·017·018·019). 돌려주는 값은 국제 표기 +82…(Supabase 가 요구하는 모양).
export function normalizeKrPhone(input: string): string | null {
  let digits = input.normalize('NFKC').replace(/\D/g, '');
  if (digits.startsWith('82')) digits = `0${digits.slice(2)}`;
  // 010 은 11자리만, 011·016~019 는 옛 번호라 10·11자리.
  if (!/^(?:010\d{8}|01[16789]\d{7,8})$/.test(digits)) return null;
  return `+82${digits.slice(1)}`;
}

// 화면에 되비출 때는 가운데를 가린다: 010-****-5678
export function maskPhone(e164: string): string {
  const local = `0${e164.replace(/^\+82/, '')}`;
  return `${local.slice(0, 3)}-****-${local.slice(-4)}`;
}

export const onlyCodeDigits = (input: string): string => input.normalize('NFKC').replace(/\D/g, '').slice(0, PHONE_CODE_LENGTH);

export type PhoneErrorKind = 'not_ready' | 'too_many' | 'wrong_code' | 'taken' | 'invalid_number' | 'signed_out' | 'unknown';

// Supabase 오류를 사람이 할 일로 바꾼다. 코드가 없을 때는 문구로 한 번 더 본다.
export function phoneErrorKind(error: unknown): PhoneErrorKind {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const status = typeof e.status === 'number' ? e.status : 0;
  if (code === 'phone_provider_disabled' || code === 'sms_send_failed' || (/provider|twilio|messagebird|vonage|textlocal|sms/.test(message) && /disabled|not enabled|unsupported|configur|failed to send/.test(message))) return 'not_ready';
  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit' || status === 429 || /rate limit|too many|seconds/.test(message)) return 'too_many';
  if (code === 'otp_expired' || code === 'otp_disabled' || /token has expired|invalid otp|token.*invalid|otp.*invalid/.test(message)) return 'wrong_code';
  if (code === 'phone_exists' || /already (been )?registered|already exists|already in use/.test(message)) return 'taken';
  if (code === 'validation_failed' || /invalid phone|phone number/.test(message)) return 'invalid_number';
  if (code === 'session_not_found' || code === 'no_authorization' || status === 401) return 'signed_out';
  return 'unknown';
}

export const PHONE_ERROR_TEXT: Record<PhoneErrorKind, string> = {
  not_ready: '지금은 문자 인증을 준비하고 있어요. 준비되면 여기서 바로 할 수 있어요.',
  too_many: '문자를 너무 자주 받았어요. 1분쯤 뒤에 다시 받아 주세요.',
  wrong_code: '숫자가 맞지 않거나 시간이 지났어요. 문자를 새로 받아 주세요.',
  taken: '이 번호는 이미 다른 계정에서 인증했어요. 한 번호로 한 계정만 쓸 수 있어요.',
  invalid_number: '휴대폰 번호를 다시 확인해 주세요. 010-1234-5678 처럼 적으면 돼요.',
  signed_out: '로그인이 풀렸어요. 다시 로그인한 뒤 이어서 해 주세요.',
  unknown: '문자를 보내지 못했어요. 잠시 뒤 다시 해 주세요.',
};

export async function sendPhoneCode(e164: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) throw error;
}

export async function confirmPhoneCode(e164: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'phone_change' });
  if (error) throw error;
}

// 서버가 Auth 기록(phone_confirmed_at)을 보고 판정한다. 화면은 결과만 받는다.
export async function syncPhoneVerification(userId: string): Promise<boolean> {
  const out = await serverFunctionRequest<{ ok: true; verified: boolean }>('doit-connect', { action: 'phone_sync' }, userId);
  return out.verified === true;
}

// 대표 2026-09-25 「전화 인증은 아직 구현 안 됐어」 · 2026-09-26 MVP FINAL PATCH(SMS DEFERRED_MVP): 운영에서 문자 발송 업체가 연결되지 않았다.
// 준비되면(대표 승인 뒤) true 로 바꾼다. 연결 준비 화면·전화 인증 화면이 같은 값을 본다.
export const PHONE_VERIFY_READY = false;
