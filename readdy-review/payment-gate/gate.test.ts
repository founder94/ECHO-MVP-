/** 결제 개통 게이트 검사 — Readdy src/lib/echo/toss.ts 사본(review_pending 원본 / enabled 로 바꾼 사본) */
import { describe, it, expect, vi } from 'vitest';
import * as pending from './toss.pending';
import * as enabled from './toss.enabled';

describe('PAYMENT_GATE = review_pending (심사 대기 · 배포 후보 상태)', () => {
  it('키가 비어 있으면 결제 비활성', () => { vi.stubEnv('VITE_PUBLIC_TOSS_CLIENT_KEY', ''); expect(pending.isPaymentEnabled()).toBe(false); });
  it('유효한 테스트 클라이언트 키가 있어도 자동 활성화되지 않는다', () => { vi.stubEnv('VITE_PUBLIC_TOSS_CLIENT_KEY', 'test_ck_ABCDEFG1234567'); expect(pending.isPaymentEnabled()).toBe(false); });
  it('버튼 라벨·안내 문구 고정값', () => { expect(pending.PAYMENT_PENDING_BUTTON_LABEL).toBe('결제 준비 중'); expect(pending.PAYMENT_PENDING_NOTICE).toBe('현재 결제 서비스를 준비하고 있어요.\n결제는 아직 진행되지 않습니다.'); });
});
describe('PAYMENT_GATE = enabled (개통 승인 뒤 상태 · 이번 배포 아님)', () => {
  it('키가 비어 있으면 여전히 비활성', () => { vi.stubEnv('VITE_PUBLIC_TOSS_CLIENT_KEY', ''); expect(enabled.isPaymentEnabled()).toBe(false); });
  it('시크릿 키 형식(test_sk_)은 거부', () => { vi.stubEnv('VITE_PUBLIC_TOSS_CLIENT_KEY', 'test_sk_ABCDEFG1234567'); expect(enabled.isPaymentEnabled()).toBe(false); });
  it('유효한 test_ck_ 키면 활성', () => { vi.stubEnv('VITE_PUBLIC_TOSS_CLIENT_KEY', 'test_ck_ABCDEFG1234567'); expect(enabled.isPaymentEnabled()).toBe(true); });
});
