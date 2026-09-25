// 회전·밝기만 자연 보정으로 허용. 얼굴형·체형 변형·과도 필터는 금지(원칙 준수).
// 기존 /do-it/photo(page.tsx) 내부 correctBlob 로직을 공용으로 추출.
export async function correctBlob(
  blob: Blob,
  rotation: number,
  brightness: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const radians = (rotation * Math.PI) / 180;
  const swap = rotation % 180 !== 0;
  const outW = swap ? bitmap.height : bitmap.width;
  const outH = swap ? bitmap.width : bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("CORRECTION_FAILED");
  }

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(radians);
  ctx.filter = `brightness(${brightness})`;
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  const outBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!outBlob) throw new Error("CORRECTION_FAILED");
  return outBlob;
}