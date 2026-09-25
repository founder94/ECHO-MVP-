// 약관 동의 — 화면 공용 로직.
// 정본은 서버(profiles.consent_version). 브라우저 임시값은 "가입 → 이메일 확인/Google 이동 → 첫 로그인" 사이의
// 잠깐 동안만 동의 내용을 들고 있다가 서버에 옮기는 용도다.
// 비밀번호·토큰은 다루지 않는다. 동의 항목 4개(약관·개인정보·만 14세·마케팅)와 시각만 있다.

import type { SupabaseClient } from '@supabase/supabase-js';
import { LEGAL_VERSION } from './documents';

export const CONSENT_VERSION = LEGAL_VERSION;

export interface ConsentChoice {
  terms: boolean;
  privacy: boolean;
  age14: boolean;
  marketing: boolean;
}

export const EMPTY_CONSENT: ConsentChoice = { terms: false, privacy: false, age14: false, marketing: false };

export const REQUIRED_CONSENT_KEYS = ['terms', 'privacy', 'age14'] as const;
export type RequiredConsentKey = (typeof REQUIRED_CONSENT_KEYS)[number];

export function requiredAllChecked(choice: ConsentChoice): boolean {
  return REQUIRED_CONSENT_KEYS.every((key) => choice[key]);
}

// 2026-09-25 대표 MASTER §14: 마케팅 수신 동의는 실제로 마케팅을 보낼 때만 선택 항목으로 보인다. 지금은 보내는 기능이 없다 → 끔(항목 숨김, 값은 늘 false).
export const MARKETING_ENABLED = false;

export function allChecked(choice: ConsentChoice): boolean {
  return requiredAllChecked(choice) && (!MARKETING_ENABLED || choice.marketing);
}

export function setAll(checked: boolean): ConsentChoice {
  return { terms: checked, privacy: checked, age14: checked, marketing: checked && MARKETING_ENABLED };
}

// 가입 시 인증 메타데이터에 실어 보내는 값. 서버(profiles)에 옮겨 적기 전까지의 기록이다.
export interface ConsentMetadata {
  consent_version: string;
  consented_at: string;
  marketing_opt_in: boolean;
}

export function consentMetadata(choice: ConsentChoice, now: Date = new Date()): ConsentMetadata {
  return { consent_version: CONSENT_VERSION, consented_at: now.toISOString(), marketing_opt_in: choice.marketing };
}

export function readConsentMetadata(meta: unknown): ConsentMetadata | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  if (typeof m.consent_version !== 'string' || typeof m.consented_at !== 'string') return null;
  return { consent_version: m.consent_version, consented_at: m.consented_at, marketing_opt_in: m.marketing_opt_in === true };
}

// Google 가입처럼 외부 페이지를 거쳐 돌아오는 경우: 이동 전에 동의를 이 기기 세션에 잠깐 둔다.
const PENDING_KEY = 'echo:consent-pending';

export function rememberPendingConsent(choice: ConsentChoice): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(consentMetadata(choice)));
  } catch {
    // 저장 불가여도 흐름을 막지 않는다. 돌아온 뒤 동의 화면(ConsentGate)이 다시 받는다.
  }
}

export function consumePendingConsent(): ConsentMetadata | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = readConsentMetadata(JSON.parse(raw));
    return parsed && parsed.consent_version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export type ConsentStatus = 'unknown' | 'ok' | 'required';

// 서버에 저장된 동의 버전을 읽는다. 조회 실패는 "모름"으로 두어 사용자를 가두지 않는다(구제).
export async function fetchConsentStatus(supabase: SupabaseClient, userId: string): Promise<ConsentStatus> {
  const { data, error } = await supabase.from('profiles').select('consent_version').eq('id', userId).maybeSingle();
  if (error) return 'unknown';
  return data?.consent_version === CONSENT_VERSION ? 'ok' : 'required';
}

// 동의를 서버에 기록한다. 프로필 행이 아직 없으면(가입 직후 트리거 지연) 본인 행을 만든다.
// 반환값: null = 성공, 문자열 = 사용자에게 보여 줄 실패 안내.
export async function persistConsent(supabase: SupabaseClient, userId: string, meta: ConsentMetadata): Promise<string | null> {
  const updated = await supabase
    .from('profiles')
    .update({ consent_version: meta.consent_version }, { count: 'exact' })
    .eq('id', userId);
  if (updated.error) return '동의 내용을 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.';
  if ((updated.count ?? 0) === 0) {
    const inserted = await supabase.from('profiles').insert({ id: userId, consent_version: meta.consent_version });
    if (inserted.error && inserted.error.code !== '23505') {
      return '동의 내용을 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.';
    }
    if (inserted.error) {
      const retried = await supabase.from('profiles').update({ consent_version: meta.consent_version }).eq('id', userId);
      if (retried.error) return '동의 내용을 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.';
    }
  }
  // 동의 시각·마케팅 선택은 프로필에 칸이 없어(칸 추가는 대표 승인 대상) 인증 메타데이터에 함께 남긴다.
  try {
    await supabase.auth.updateUser({ data: { ...meta } });
  } catch {
    // 메타데이터 실패는 동의 저장 성공을 뒤집지 않는다.
  }
  return null;
}
