import { READ_TIMEOUT_MS, TimeoutError, withTimeout } from "@/doit/lib/withTimeout";
import { getSupabase } from "@/doit/lib/supabase";
import type { UploadPort, UploadReceipt } from "@/pages/do-it/photo/photoDrafts";

// ─────────────────────────────────────────────────────────────
// A구조(DO IT) 프로필 사진 — Supabase Storage + profile_photos 연결.
// 실서버 DB/Storage는 이미 존재하므로 여기서 CREATE/ALTER/RLS/policy는 하지 않는다.
// 프론트에서 실제 업로드/복원/대표/교체만 수행한다.
// ─────────────────────────────────────────────────────────────

export const PHOTO_BUCKET = "profile-photos";
export const PHOTO_SLOT_COUNT = 6;
export const SIGNED_URL_EXPIRY_SECONDS = 300;
// 사진 1장(5MB 이하) 올리기의 시간 상한 — 끊긴 휴대폰 망에서 「저장 중」이 영원히 돌지 않게(넘으면 TIMEOUT → 화면의 다시 시도).
export const UPLOAD_TIMEOUT_MS = 30_000;

// UI(0~5) ↔ DB(1~6) 슬롯 변환. 의미 라벨을 DB 값으로 쓰지 않는다.
export function slotToDb(slot: number): number {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PHOTO_SLOT_COUNT) {
    throw new RangeError("INVALID_SLOT");
  }
  return slot + 1;
}

export function dbToSlot(slot: number): number {
  if (!Number.isInteger(slot) || slot < 1 || slot > PHOTO_SLOT_COUNT) {
    throw new RangeError("INVALID_DB_SLOT");
  }
  return slot - 1;
}

export type PhotoStorageErrorCode =
  | "AUTH_REQUIRED"
  | "SUPABASE_UNAVAILABLE"
  | "UPLOAD_FAILED"
  | "DB_WRITE_FAILED"
  | "DB_READ_FAILED"
  | "SIGNED_URL_FAILED"
  | "DELETE_FAILED"
  | "TIMEOUT";

export class PhotoStorageError extends Error {
  readonly code: PhotoStorageErrorCode;

  constructor(code: PhotoStorageErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PhotoStorageError";
    this.code = code;
  }
}

export interface RestoredPhoto {
  slot: number; // 0~5
  photoId: string;
  storagePath: string;
  url: string; // signed URL (private bucket — getPublicUrl 사용 금지)
  isPrimary: boolean;
}

async function requirePhotoOwner(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new PhotoStorageError("SUPABASE_UNAVAILABLE");
  const { data, error } = await supabase.auth.getSession();
  if (error || !userId || data.session?.user.id !== userId) {
    throw new PhotoStorageError("AUTH_REQUIRED");
  }
}

// private bucket object key: {auth.uid()}/{slot 1~6}/{captureId}.jpg
export function buildStoragePath(
  userId: string,
  slot: number,
  captureId: string,
): string {
  return `${userId}/${slotToDb(slot)}/${captureId}.jpg`;
}

// Storage 에 사진 올리기 — 시간 상한 + 취소 신호.
// 이 SDK 의 upload 옵션은 취소 신호(signal)를 받지 않는다 → 요청 자체는 못 끊고, 기다림만 끝낸다(늦게 온 응답은 버린다).
async function uploadObject(path: string, blob: Blob, signal?: AbortSignal): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new PhotoStorageError("SUPABASE_UNAVAILABLE");
  if (signal?.aborted) throw new PhotoStorageError("UPLOAD_FAILED", "aborted");
  const work = supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  let onAbort: (() => void) | undefined;
  const cancelled = signal
    ? new Promise<never>((_, reject) => {
        onAbort = () => reject(new PhotoStorageError("UPLOAD_FAILED", "aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      })
    : null;
  try {
    const { error } = await withTimeout(cancelled ? Promise.race([work, cancelled]) : work, UPLOAD_TIMEOUT_MS, "uploadPhoto");
    if (error) throw new PhotoStorageError("UPLOAD_FAILED", error.message);
  } catch (error) {
    if (error instanceof TimeoutError) throw new PhotoStorageError("TIMEOUT");
    throw error;
  } finally {
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}

// signed URL 생성 — 만료되며 DB에 저장하지 않는다.
export async function signedUrlFor(path: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new PhotoStorageError("SUPABASE_UNAVAILABLE");
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) {
    throw new PhotoStorageError("SIGNED_URL_FAILED", error?.message);
  }
  return data.signedUrl;
}

// PhotoDrafts의 UploadPort를 실제 Storage + profile_photos로 연결하는 adapter.
// user_id는 인증 세션에서 주입된 값만 사용한다(브라우저 자유 입력 금지).
export class SupabasePhotoAdapter implements UploadPort {
  private readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async upload(input: {
    captureId: string;
    slot: number;
    blob: Blob;
    signal: AbortSignal;
  }): Promise<UploadReceipt> {
    const supabase = getSupabase();
    if (!supabase) throw new PhotoStorageError("SUPABASE_UNAVAILABLE");
    await requirePhotoOwner(this.userId);

    const path = buildStoragePath(this.userId, input.slot, input.captureId);

    // 1) private bucket 업로드(시간 상한 · 취소 신호 반영)
    await uploadObject(path, input.blob, input.signal);
    if (input.signal.aborted) throw new PhotoStorageError("UPLOAD_FAILED", "aborted");

    // 2) DB upsert (user_id+slot 기준). id/created_at은 DB 기본값 사용.
    const { data, error: dbError } = await supabase
      .from("profile_photos")
      .upsert(
        {
          user_id: this.userId,
          slot: slotToDb(input.slot),
          storage_path: path,
          is_primary: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,slot" },
      )
      .select("id")
      .single();

    if (dbError || !data) {
      // 업로드는 됐지만 DB 반영 실패 → 새 object cleanup
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      throw new PhotoStorageError("DB_WRITE_FAILED", dbError?.message);
    }

    return {
      photoId: data.id as string,
      captureId: input.captureId,
      slot: input.slot,
    };
  }
}

// 로그인 사용자 기준 profile_photos 조회 → slot 오름차순 → signed URL 복원.
async function restorePhotosOnce(
  userId: string,
): Promise<RestoredPhoto[]> {
  const supabase = getSupabase();
  if (!supabase) throw new PhotoStorageError("SUPABASE_UNAVAILABLE");
  await requirePhotoOwner(userId);

  const { data, error } = await supabase
    .from("profile_photos")
    .select("id, slot, storage_path, is_primary")
    .eq("user_id", userId)
    .order("slot");

  if (error) throw new PhotoStorageError("DB_READ_FAILED", error.message);
  if (!data || data.length === 0) return [];
  await requirePhotoOwner(userId);

  const restored: RestoredPhoto[] = [];
  for (const row of data) {
    if (typeof row.storage_path !== "string" || !row.storage_path.startsWith(`${userId}/`)) {
      throw new PhotoStorageError("DB_READ_FAILED");
    }
    const url = await signedUrlFor(row.storage_path);
    restored.push({
      slot: dbToSlot(row.slot),
      photoId: row.id,
      storagePath: row.storage_path,
      url,
      isPrimary: row.is_primary,
    });
  }
  return restored;
}

// 대표사진 변경 — 한 사용자당 is_primary=true 최대 1장(부분 유니크 인덱스).
// 순서: 기존 primary 해제 → 새 primary 지정. 중간 실패 시 기존 primary를 복원한다.
// 참고: 동시 접근에 대한 완전한 원자성(트랜잭션/RPC)은 SERVER REQUIRED.
//       복원 요청도 실패할 수 있으므로 호출 화면은 오류 후 서버 사진을 다시 읽는다.
export async function setPrimaryPhoto(
  userId: string,
  slot: number,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "연결 오류";
  try {
    await requirePhotoOwner(userId);
  } catch {
    return "로그인을 다시 확인해 주세요.";
  }

  const dbSlot = slotToDb(slot);
  const now = new Date().toISOString();

  const { data: current, error: readError } = await supabase
    .from("profile_photos")
    .select("slot")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (readError) return readError.message;

  const currentSlot = current?.slot ?? null;
  if (currentSlot === dbSlot) return null; // 이미 대표

  if (currentSlot !== null) {
    const { data: unset, error: unsetError } = await supabase
      .from("profile_photos")
      .update({ is_primary: false, updated_at: now })
      .eq("user_id", userId)
      .eq("slot", currentSlot)
      .select("slot")
      .maybeSingle();
    if (unsetError) return unsetError.message;
    if (!unset) return "기존 대표 사진을 확인하지 못했어요.";
  }

  const { data: chosen, error: setError } = await supabase
    .from("profile_photos")
    .update({ is_primary: true, updated_at: now })
    .eq("user_id", userId)
    .eq("slot", dbSlot)
    .select("slot")
    .maybeSingle();

  if (setError || !chosen) {
    // 새 지정 실패 → 기존 primary 복원(대표 없음 상태로 끝나지 않게)
    if (currentSlot !== null) {
      await supabase
        .from("profile_photos")
        .update({ is_primary: true, updated_at: now })
        .eq("user_id", userId)
        .eq("slot", currentSlot);
    }
    return setError?.message ?? "선택한 사진을 확인하지 못했어요.";
  }

  return null;
}

export interface ReplaceResult {
  photoId: string;
  storagePath: string;
  url: string;
  cleanupPendingPath?: string;
}

// 사진 교체: 새 object 업로드 → DB storage_path 갱신 → 성공 확인 → 기존 object 삭제.
// - DB 갱신 실패 → 새 object cleanup
// - 기존 object 삭제 실패 → 새 저장 유지, cleanupPendingPath로 보고
// old object를 먼저 삭제하지 않는다. is_primary는 건드리지 않아 대표 상태가 유지된다.
export async function replacePhoto(
  userId: string,
  slot: number,
  blob: Blob,
  captureId: string,
  oldPath: string | null,
): Promise<ReplaceResult> {
  const supabase = getSupabase();
  if (!supabase) throw new PhotoStorageError("SUPABASE_UNAVAILABLE");
  await requirePhotoOwner(userId);

  const path = buildStoragePath(userId, slot, captureId);

  await uploadObject(path, blob);

  const { data, error: dbError } = await supabase
    .from("profile_photos")
    .upsert(
      {
        user_id: userId,
        slot: slotToDb(slot),
        storage_path: path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,slot" },
    )
    .select("id")
    .single();

  if (dbError || !data) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new PhotoStorageError("DB_WRITE_FAILED", dbError?.message);
  }

  let cleanupPendingPath: string | undefined;
  if (oldPath && oldPath !== path) {
    const { error: deleteError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([oldPath]);
    if (deleteError) {
      cleanupPendingPath = oldPath;
    }
  }

  const url = await signedUrlFor(path);

  return {
    photoId: data.id as string,
    storagePath: path,
    url,
    cleanupPendingPath,
  };
}

// 사진 복원에 시간 상한을 둔다(로그인 잠금·서명 주소 발급이 멈추면 화면이 영원히 기다렸다).
// 넘으면 TIMEOUT 오류 — 부르는 쪽이 이미 "읽기 실패"를 처리한다(시작 흐름은 사진 없이 진행).
export async function restorePhotos(userId: string): Promise<RestoredPhoto[]> {
  try {
    return await withTimeout(restorePhotosOnce(userId), READ_TIMEOUT_MS, "restorePhotos");
  } catch (error) {
    if (error instanceof TimeoutError) throw new PhotoStorageError("TIMEOUT");
    throw error;
  }
}
