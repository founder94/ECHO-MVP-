// 프로필 사진 정책 (대표 확정 2026-09-21 · 기준 = 신뢰·정확성)
// - 필수 3장: 전신 / 패션 / 취미. 더 올리고 싶으면 자유 3장까지(총 6칸, DB 슬롯 1~6 그대로).
// - 슬롯 번호가 곧 종류다(1=전신, 2=패션, 3=취미, 4~6=자유). DB 칸을 늘리지 않는다.
// - 최근 2개월: 사진 정보(EXIF) 확인 + 없으면 본인 확인(recentPhoto.ts, 기존).
// - AI 판별(doit-photo-check 서버 함수): 사람이 있는지·한 명인지·종류가 맞는지·화면을 찍은 사진인지·안전한지.
//   AI는 본인 여부·실제 촬영일을 확인하지 못한다. 그래서 결과는 '확인됨/검토 필요/안 됨/미확인'이며 "인증"이라고 부르지 않는다.
import { supabase } from '@/lib/supabase/client';
import { PHOTO_SLOT_COUNT } from '@/doit/lib/photoStorage';

export type PhotoCategory = 'full_body' | 'fashion' | 'hobby' | 'free';

export interface PhotoSlotSpec {
  slot: number; // UI 0~5
  category: PhotoCategory;
  required: boolean;
  label: string;
  hint: string;
}

export const PHOTO_SLOTS: readonly PhotoSlotSpec[] = [
  { slot: 0, category: 'full_body', required: true, label: '전신', hint: '머리부터 발끝까지, 자연스럽게' },
  { slot: 1, category: 'fashion', required: true, label: '패션', hint: '내가 자주 입는 스타일' },
  { slot: 2, category: 'hobby', required: true, label: '취미', hint: '내가 좋아하는 활동을 하는 모습' },
  { slot: 3, category: 'free', required: false, label: '자유 1', hint: '더 보여 주고 싶은 나' },
  { slot: 4, category: 'free', required: false, label: '자유 2', hint: '내 하루의 한 장면' },
  { slot: 5, category: 'free', required: false, label: '자유 3', hint: '나의 매력 포인트' },
] as const;

export const PHOTO_REQUIRED_SLOTS: readonly number[] = PHOTO_SLOTS.filter((s) => s.required).map((s) => s.slot);
export const PHOTO_REQUIRED_COUNT = PHOTO_REQUIRED_SLOTS.length;

if (PHOTO_SLOTS.length !== PHOTO_SLOT_COUNT) throw new Error('PHOTO_SLOTS must match PHOTO_SLOT_COUNT');

export const CATEGORY_LABEL: Record<PhotoCategory, string> = { full_body: '전신', fashion: '패션', hobby: '취미', free: '자유' };

export function categoryForSlot(slot: number): PhotoCategory {
  return PHOTO_SLOTS.find((s) => s.slot === slot)?.category ?? 'free';
}

// 사진 준비 완료 = 필수 3칸 저장 + 대표 사진 1장. 자유 칸은 비어 있어도 된다.
export function photoSetComplete(photos: ReadonlyArray<{ slot: number; isPrimary: boolean }>): boolean {
  const filled = new Set(photos.map((p) => p.slot));
  return PHOTO_REQUIRED_SLOTS.every((slot) => filled.has(slot)) && photos.some((p) => p.isPrimary);
}

export function requiredFilledCount(photos: ReadonlyArray<{ slot: number }>): number {
  const filled = new Set(photos.map((p) => p.slot));
  return PHOTO_REQUIRED_SLOTS.filter((slot) => filled.has(slot)).length;
}

// AI 판별 결과. 'unchecked' = 서버 함수가 아직 없거나 연결 실패(막지 않는다, 표시만).
export type PhotoVerdict = 'ok' | 'review' | 'rejected' | 'unchecked';
export interface PhotoCheck {
  verdict: PhotoVerdict;
  category?: PhotoCategory | 'other';
  reasons: string[]; // 사용자에게 보여 줄 짧은 이유(원문·개인정보 없음)
}

export const VERDICT_LABEL: Record<PhotoVerdict, string> = {
  ok: 'AI 확인됨',
  review: '검토 필요',
  rejected: '다시 올려 주세요',
  unchecked: 'AI 확인 대기',
};

const REASON_COPY: Record<string, string> = {
  no_person: '사람이 보이지 않아요.',
  multiple_people: '여러 사람이 함께 있어요. 나 혼자 나온 사진이 좋아요.',
  category_mismatch: '이 칸의 종류와 달라 보여요.',
  screen_photo: '화면이나 인쇄물을 다시 찍은 사진 같아요.',
  unsafe: '올릴 수 없는 내용이 있어요.',
  low_quality: '너무 어둡거나 흐려요.',
  face_hidden: '얼굴이 보이지 않아요.',
};

export function reasonCopy(code: string): string {
  return REASON_COPY[code] ?? '확인이 필요해요.';
}

// 서버 함수 호출. 함수가 배포되지 않았거나(404) 연결이 안 되면 'unchecked' 로 돌려주고 흐름을 막지 않는다.
export async function requestPhotoCheck(userId: string, photoId: string, slot: number): Promise<PhotoCheck> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== userId) return { verdict: 'unchecked', reasons: [] };
    const { data, error } = await supabase.functions.invoke('doit-photo-check', {
      body: { photoId, slot: slot + 1, category: categoryForSlot(slot) },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error || !data || data.ok !== true) return { verdict: 'unchecked', reasons: [] };
    const verdict: PhotoVerdict = data.verdict === 'ok' || data.verdict === 'review' || data.verdict === 'rejected' ? data.verdict : 'unchecked';
    const reasons = Array.isArray(data.reasons) ? data.reasons.filter((r: unknown): r is string => typeof r === 'string').map(reasonCopy) : [];
    return { verdict, category: typeof data.category === 'string' ? data.category : undefined, reasons };
  } catch {
    return { verdict: 'unchecked', reasons: [] };
  }
}
