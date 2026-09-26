/** Album photos are checked locally. EXIF is editable metadata, not identity/date verification. */
export const MAX_ALBUM_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_DECODED_PIXELS = 60_000_000;
const MAX_OUTPUT_EDGE = 2400;

export class RecentPhotoError extends Error {
  constructor(message: string) { super(message); this.name = "RecentPhotoError"; }
}

export type ExifCaptureDate =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "date"; original: string; offset: string | null };
export type RecentPhotoCheck = { kind: "recent" | "needs-confirmation" };
export interface PreparedAlbumPhoto { blob: Blob; dateCheck: RecentPhotoCheck; }

export function detectPhotoType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
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

async function decodePhoto(blob: Blob): Promise<{ image: ImageBitmap | HTMLImageElement; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Older browsers may still decode this format with an image element. */ }
  }
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

export async function normalizeAlbumPhoto(blob: Blob): Promise<Blob> {
  const decoded = await decodePhoto(blob);
  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > MAX_DECODED_PIXELS) {
      throw new RecentPhotoError("사진 해상도가 너무 커요. 6천만 화소 이하의 사진을 선택해 주세요.");
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
  normalize: (blob: Blob) => Promise<Blob> = normalizeAlbumPhoto,
): Promise<PreparedAlbumPhoto> {
  if (file.size < 1 || file.size > MAX_ALBUM_BYTES) throw new RecentPhotoError("20MB 이하의 사진을 선택해 주세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectPhotoType(bytes);
  if (!type || (file.type && file.type !== type && !(type === "image/jpeg" && file.type === "image/jpg"))) {
    throw new RecentPhotoError("JPG, PNG, WebP 사진만 올릴 수 있어요. HEIC 사진은 JPG로 바꾼 뒤 선택해 주세요.");
  }
  const dateCheck = assessCaptureDate(type === "image/jpeg" ? readJpegCaptureDate(bytes) : { kind: "missing" }, now);
  const blob = await normalize(file);
  if (blob.type !== "image/jpeg" || blob.size < 1 || blob.size > MAX_UPLOAD_PHOTO_BYTES) throw new RecentPhotoError("사진을 5MB 이하 JPG로 준비하지 못했어요. 다른 사진을 선택해 주세요.");
  return { blob, dateCheck };
}
