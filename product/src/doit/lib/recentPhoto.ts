/** Album photos are checked locally. EXIF is editable metadata, not identity/date verification. */
export const MAX_ALBUM_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_DECODED_PIXELS = 60_000_000;
const MAX_OUTPUT_EDGE = 2400;
// 2026-10-10 갤럭시 2억·1억8백만 화소 사진: 전체를 풀기 전에 파일 머리에서 가로·세로를 읽어 먼저 거른다(탭이 죽지 않게).
// 머리 상한 = 휴대폰 최대 화소(2억). 풀면서 줄이기(resize)를 못 쓰는 브라우저에서 휴대폰이 전체를 그대로 풀 때는 2천5백만까지만.
const MAX_HEADER_PIXELS = 200_000_000;
const MAX_TOUCH_FULL_DECODE_PIXELS = 25_000_000;

export class RecentPhotoError extends Error {
  constructor(message: string) { super(message); this.name = "RecentPhotoError"; }
}

export type ExifCaptureDate =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "date"; original: string; offset: string | null };
export type RecentPhotoCheck = { kind: "recent" | "needs-confirmation" };
export interface PreparedAlbumPhoto { blob: Blob; dateCheck: RecentPhotoCheck; }
export interface PhotoSize { width: number; height: number; }

const tooLarge = (label: string) => new RecentPhotoError(`사진 해상도가 너무 커요. ${label} 이하의 사진을 선택해 주세요.`);

export function detectPhotoType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/**
 * 그림을 풀지 않고 파일 머리에서 가로·세로만 읽는다(JPEG SOFn · PNG IHDR · WebP VP8/VP8L/VP8X).
 * 못 읽으면 null — 그때는 예전처럼 푼 뒤에 크기를 본다. JPEG 는 EXIF 회전 전(센서 방향) 크기다.
 */
export function readPhotoSize(bytes: Uint8Array): PhotoSize | null {
  const type = detectPhotoType(bytes);
  const size = (width: number, height: number): PhotoSize | null => (width > 0 && height > 0 ? { width, height } : null);
  const be32 = (p: number) => ((bytes[p] << 24) >>> 0) + (bytes[p + 1] << 16) + (bytes[p + 2] << 8) + bytes[p + 3];
  const le24 = (p: number) => bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
  if (type === "image/png") {
    if (bytes.length < 24 || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") return null;
    return size(be32(16), be32(20));
  }
  if (type === "image/webp") {
    if (bytes.length < 16) return null;
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8 ") {
      if (bytes.length < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return size((bytes[26] | (bytes[27] << 8)) & 0x3fff, (bytes[28] | (bytes[29] << 8)) & 0x3fff);
    }
    if (chunk === "VP8L") {
      if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
      const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
      return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8X") {
      if (bytes.length < 30) return null;
      return size(le24(24) + 1, le24(27) + 1);
    }
    return null;
  }
  if (type !== "image/jpeg") return null;
  let pos = 2;
  while (pos + 1 < bytes.length) {
    if (bytes[pos++] !== 0xff) return null;
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    if (pos >= bytes.length) return null;
    const marker = bytes[pos++];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (pos + 2 > bytes.length) return null;
    const length = (bytes[pos] << 8) | bytes[pos + 1];
    if (length < 2) return null;
    // SOF0~SOF15(C4 허프만 표·C8 예약·CC 산술 표 제외): 정밀도(1) · 세로(2) · 가로(2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (length < 7 || pos + 7 > bytes.length) return null;
      return size((bytes[pos + 5] << 8) | bytes[pos + 6], (bytes[pos + 3] << 8) | bytes[pos + 4]);
    }
    pos += length;
  }
  return null;
}

/** Read only DateTimeOriginal (0x9003) and OffsetTimeOriginal (0x9011) from JPEG APP1/TIFF. */
export function readJpegCaptureDate(bytes: Uint8Array): ExifCaptureDate {
  if (detectPhotoType(bytes) !== "image/jpeg") return { kind: "missing" };
  let pos = 2;
  while (pos + 1 < bytes.length) {
    if (bytes[pos++] !== 0xff) return { kind: "invalid" };
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    if (pos >= bytes.length) return { kind: "invalid" };
    const marker = bytes[pos++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (pos + 2 > bytes.length) return { kind: "invalid" };
    const size = (bytes[pos] << 8) | bytes[pos + 1];
    if (size < 2 || pos + size > bytes.length) return { kind: "invalid" };
    const body = pos + 2;
    if (marker === 0xe1 && size >= 8 && String.fromCharCode(...bytes.subarray(body, body + 6)) === "Exif\0\0") {
      const start = body + 6;
      const end = pos + size;
      try {
        const view = new DataView(bytes.buffer, bytes.byteOffset + start, end - start);
        const inBounds = (offset: number, length: number) => Number.isSafeInteger(offset) && offset >= 0 && length >= 0 && offset + length <= view.byteLength;
        if (!inBounds(0, 8)) return { kind: "invalid" };
        const endian = view.getUint16(0, false);
        if (endian !== 0x4949 && endian !== 0x4d4d) return { kind: "invalid" };
        const little = endian === 0x4949;
        if (view.getUint16(2, little) !== 42) return { kind: "invalid" };
        const entries = (offset: number): number[] => {
          if (offset < 8 || !inBounds(offset, 2)) throw new Error("BAD_IFD");
          const count = view.getUint16(offset, little);
          if (count > 512 || !inBounds(offset + 2, count * 12 + 4)) throw new Error("BAD_IFD");
          return Array.from({ length: count }, (_, i) => offset + 2 + i * 12);
        };
        const root = entries(view.getUint32(4, little));
        const pointer = root.find((entry) => view.getUint16(entry, little) === 0x8769);
        if (pointer === undefined) return { kind: "missing" };
        if (view.getUint16(pointer + 2, little) !== 4 || view.getUint32(pointer + 4, little) !== 1) return { kind: "invalid" };
        const exif = entries(view.getUint32(pointer + 8, little));
        const ascii = (tag: number): string | null => {
          const entry = exif.find((p) => view.getUint16(p, little) === tag);
          if (entry === undefined) return null;
          const count = view.getUint32(entry + 4, little);
          if (view.getUint16(entry + 2, little) !== 2 || count < 2 || count > 64) throw new Error("BAD_ASCII");
          const offset = count <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
          if (!inBounds(offset, count) || view.getUint8(offset + count - 1) !== 0) throw new Error("BAD_ASCII");
          const value = new Uint8Array(view.buffer, view.byteOffset + offset, count - 1);
          if (value.some((c) => c < 32 || c > 126)) throw new Error("BAD_ASCII");
          return String.fromCharCode(...value).trim();
        };
        const original = ascii(0x9003);
        if (!original) return { kind: "missing" };
        return { kind: "date", original, offset: ascii(0x9011) };
      } catch {
        return { kind: "invalid" };
      }
    }
    pos += size;
  }
  return { kind: "missing" };
}

function calendarMonthsBefore(year: number, month: number, day: number): number {
  const target = new Date(Date.UTC(year, month - 1 - 2, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, last));
}

export function assessCaptureDate(metadata: ExifCaptureDate, now = new Date()): RecentPhotoCheck {
  if (metadata.kind === "missing") return { kind: "needs-confirmation" };
  const invalid = () => new RecentPhotoError("사진의 촬영 날짜를 올바르게 읽을 수 없어요. 다른 원본 사진을 선택해 주세요.");
  if (metadata.kind === "invalid" || !Number.isFinite(now.getTime())) throw invalid();
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(metadata.original);
  if (!match) throw invalid();
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) throw invalid();
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const calendar = new Date(stamp);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw invalid();
  const capturedDay = Date.UTC(year, month - 1, day);
  let currentYear: number, currentMonth: number, currentDay: number, capturedTime: number;
  if (metadata.offset) {
    const zone = /^([+-])(\d{2}):(\d{2})$/.exec(metadata.offset);
    if (!zone || Number(zone[2]) > 14 || Number(zone[3]) > 59 || (Number(zone[2]) === 14 && Number(zone[3]) !== 0)) throw invalid();
    const offsetMinutes = (Number(zone[2]) * 60 + Number(zone[3])) * (zone[1] === "+" ? 1 : -1);
    const localNow = new Date(now.getTime() + offsetMinutes * 60000);
    currentYear = localNow.getUTCFullYear(); currentMonth = localNow.getUTCMonth() + 1; currentDay = localNow.getUTCDate();
    capturedTime = stamp - offsetMinutes * 60000;
  } else {
    // EXIF without an offset is compared using the user's device calendar.
    currentYear = now.getFullYear(); currentMonth = now.getMonth() + 1; currentDay = now.getDate();
    capturedTime = new Date(year, month - 1, day, hour, minute, second).getTime();
  }
  if (capturedTime > now.getTime()) throw new RecentPhotoError("촬영 날짜가 미래로 표시된 사진이에요. 날짜가 올바른 원본 사진을 선택해 주세요.");
  if (capturedDay < calendarMonthsBefore(currentYear, currentMonth, currentDay)) {
    throw new RecentPhotoError("사진 정보에 적힌 촬영 날짜가 최근 2개월보다 오래됐어요. 더 최근 사진을 선택해 주세요.");
  }
  return { kind: "recent" };
}

// 휴대폰(굵은 손가락 포인터)인지 — 이 파일은 다른 모듈을 불러오지 않는다(검사가 파일 하나만 실행).
const isTouchPhone = () => {
  try { return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true; } catch { return false; }
};

// 풀면서 줄이기(createImageBitmap resizeWidth)를 실제로 지키는 브라우저인지 2×2 그림으로 한 번만 확인한다.
let resizeSupport: Promise<boolean> | null = null;
function supportsDecodeResize(): Promise<boolean> {
  if (!resizeSupport) {
    resizeSupport = (async () => {
      try {
        if (typeof createImageBitmap !== "function" || typeof ImageData !== "function") return false;
        const probe = await createImageBitmap(new ImageData(2, 2), { resizeWidth: 1, resizeHeight: 1 });
        const ok = probe.width === 1 && probe.height === 1;
        probe.close();
        return ok;
      } catch { return false; }
    })();
  }
  return resizeSupport;
}

async function decodePhoto(blob: Blob, size: PhotoSize | null): Promise<{ image: ImageBitmap | HTMLImageElement; width: number; height: number; close: () => void }> {
  // 전체를 그대로 풀 때의 상한(휴대폰은 더 낮게) — 머리에서 읽은 크기로 풀기 전에 막는다.
  const fullLimit = isTouchPhone() ? MAX_TOUCH_FULL_DECODE_PIXELS : MAX_DECODED_PIXELS;
  const fullLabel = isTouchPhone() ? "2천5백만 화소" : "6천만 화소";
  const pixels = size ? size.width * size.height : 0;
  if (typeof createImageBitmap === "function") {
    // 긴 변이 저장 크기보다 크면 푸는 순간 줄인다(가로만 지정 = 비율 유지 · EXIF 회전이 있어도 찌그러지지 않음).
    const shrink = size && Math.max(size.width, size.height) > MAX_OUTPUT_EDGE && await supportsDecodeResize();
    if (!shrink && pixels > fullLimit) throw tooLarge(fullLabel);
    try {
      const bitmap = await createImageBitmap(blob, shrink && size
        ? { imageOrientation: "from-image", resizeWidth: Math.max(1, Math.round(size.width * MAX_OUTPUT_EDGE / Math.max(size.width, size.height))), resizeQuality: "high" }
        : { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Older browsers may still decode this format with an image element. */ }
  }
  if (pixels > fullLimit) throw tooLarge(fullLabel);
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("DECODE_FAILED"));
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch { URL.revokeObjectURL(url); throw new RecentPhotoError("이 사진을 열 수 없어요. 다른 JPG, PNG, WebP 사진을 선택해 주세요."); }
}

export async function normalizeAlbumPhoto(blob: Blob, size: PhotoSize | null = null): Promise<Blob> {
  const decoded = await decodePhoto(blob, size);
  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > MAX_DECODED_PIXELS) {
      throw tooLarge("6천만 화소");
    }
    const ratio = Math.min(1, MAX_OUTPUT_EDGE / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * ratio));
    canvas.height = Math.max(1, Math.round(decoded.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new RecentPhotoError("이 브라우저에서 사진을 준비하지 못했어요. 다른 브라우저에서 다시 시도해 주세요.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
    const output = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new RecentPhotoError("사진을 저장 형식으로 바꾸지 못했어요. 다른 사진을 선택해 주세요.")), "image/jpeg", 0.88));
    if (output.type !== "image/jpeg" || output.size < 1 || output.size > MAX_UPLOAD_PHOTO_BYTES) throw new RecentPhotoError("저장할 사진이 5MB를 넘어요. 더 작은 사진을 선택해 주세요.");
    return output;
  } finally { decoded.close(); }
}

export async function prepareAlbumPhoto(
  file: Blob,
  now = new Date(),
  normalize: (blob: Blob, size: PhotoSize | null) => Promise<Blob> = normalizeAlbumPhoto,
): Promise<PreparedAlbumPhoto> {
  if (file.size < 1 || file.size > MAX_ALBUM_BYTES) throw new RecentPhotoError("20MB 이하의 사진을 선택해 주세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectPhotoType(bytes);
  if (!type || (file.type && file.type !== type && !(type === "image/jpeg" && file.type === "image/jpg"))) {
    throw new RecentPhotoError("JPG, PNG, WebP 사진만 올릴 수 있어요. HEIC 사진은 JPG로 바꾼 뒤 선택해 주세요.");
  }
  // 그림을 풀기 전에 머리의 가로·세로로 먼저 거른다(2억 화소 넘음 = 풀지 않음).
  const size = readPhotoSize(bytes);
  if (size && size.width * size.height > MAX_HEADER_PIXELS) throw tooLarge("2억 화소");
  const dateCheck = assessCaptureDate(type === "image/jpeg" ? readJpegCaptureDate(bytes) : { kind: "missing" }, now);
  const blob = await normalize(file, size);
  if (blob.type !== "image/jpeg" || blob.size < 1 || blob.size > MAX_UPLOAD_PHOTO_BYTES) throw new RecentPhotoError("사진을 5MB 이하 JPG로 준비하지 못했어요. 다른 사진을 선택해 주세요.");
  return { blob, dateCheck };
}
