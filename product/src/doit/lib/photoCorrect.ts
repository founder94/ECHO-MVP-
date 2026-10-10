// 회전·밝기만 자연 보정으로 허용. 얼굴형·체형 변형·과도 필터는 금지(원칙 준수).
// 기존 /do-it/photo(page.tsx) 내부 correctBlob 로직을 공용으로 추출.

// 2026-10-10 iOS Safari 캔버스는 ctx.filter 를 모른다(넣어도 무시) → 미리보기(CSS brightness)만 밝아지고 저장 사진은 그대로였다.
// 넣은 값이 실제로 남는지 확인하고, 안 남으면 픽셀마다 같은 계산(CSS brightness = 각 색 × 값, 0~255 로 자름)을 직접 한다.
function canvasFilterWorks(ctx: CanvasRenderingContext2D): boolean {
  if (!("filter" in ctx)) return false;
  const before = ctx.filter;
  ctx.filter = "brightness(0.5)";
  const works = ctx.filter === "brightness(0.5)";
  ctx.filter = before;
  return works;
}

/** CSS brightness(value) 와 같은 계산 — 알파는 그대로, 색은 곱한 뒤 0~255 로 자른다(Uint8ClampedArray 가 자름·반올림). */
export function applyBrightness(pixels: Uint8ClampedArray, brightness: number): void {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i] * brightness;
    pixels[i + 1] = pixels[i + 1] * brightness;
    pixels[i + 2] = pixels[i + 2] * brightness;
  }
}

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

  const adjust = brightness !== 1;
  const nativeFilter = adjust && canvasFilterWorks(ctx);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(radians);
  if (nativeFilter) ctx.filter = `brightness(${brightness})`;
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  if (adjust && !nativeFilter) {
    const image = ctx.getImageData(0, 0, outW, outH);
    applyBrightness(image.data, brightness);
    ctx.putImageData(image, 0, 0); // putImageData 는 회전(변환)의 영향을 받지 않는다
  }

  const outBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!outBlob) throw new Error("CORRECTION_FAILED");
  return outBlob;
}
