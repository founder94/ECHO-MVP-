// 공식 심볼 그림을 캔버스로 읽는 공용 도구 (온보딩 3D 연출 · 로딩 화면이 함께 쓴다).
// 심볼은 다시 그리지 않는다. 공식 그림에서 "흰 종이 자리"를 점으로 뽑고, 배경을 뺀 그림을 만든다.
//
// 2026-09-23 대표 실기기: 갤럭시는 심볼이 보이는데 아이폰은 안 보였다.
// 원인 = 사파리가 그림을 캔버스로 옮길 때 빈 그림이 되는 경우가 있는데, 전에는 "오류 없음"만 보고
// 심볼을 넘겨받았다고 알려 원래 그림(<img>)까지 꺼 버렸다. 이제 실제로 담긴 칸을 세고, 비어 있으면
// 한 번 다시 옮긴 뒤에도 비면 실패로 끝낸다 → 부르는 쪽은 원래 그림을 그대로 보여 준다.

export const SAMPLE_SIZE = 128;
// 표시 크기(최대 220px × 2배 해상도)보다 큰 정사각형에 배경을 뺀 심볼을 준비한다.
export const KEYED_SIZE = 512;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 심볼 그림에서 "보이는 칸"이 이 비율보다 적으면 빈 그림으로 본다(실제 심볼은 약 30%를 차지한다).
// 사파리(아이폰)는 그림을 캔버스로 옮길 때 빈 그림이 되는 경우가 있어, 오류가 없어도 내용이 있는지 직접 센다.
const MIN_VISIBLE_RATIO = 0.02;
// 빈 그림이면 잠깐 기다렸다가 한 번만 다시 옮긴다(끝없이 다시 하지 않는다).
const REDRAW_WAIT_MS = 150;

// 배경 픽셀(밝기 28 이하)을 투명으로 빼고 그 경계는 부드럽게 섞는다. 심볼과 그림자는 그대로 둔다.
// (표시용 작은 판은 이미 배경이 투명이라 바뀌는 게 없고, 공식 원본으로 되돌아갔을 때 네모가 비치지 않게 한다.)
// 되돌려 주는 visible = 실제로 보이는 칸의 비율. 0 에 가까우면 옮겨 그리기가 빈 그림으로 끝난 것이다.
export function keyOutBackground(img: HTMLImageElement): { canvas: HTMLCanvasElement; visible: number } | null {
  const keyed = document.createElement('canvas');
  keyed.width = KEYED_SIZE; keyed.height = KEYED_SIZE;
  const kctx = keyed.getContext('2d', { willReadFrequently: true });
  if (!kctx) return null;
  kctx.drawImage(img, 0, 0, KEYED_SIZE, KEYED_SIZE);
  const image = kctx.getImageData(0, 0, KEYED_SIZE, KEYED_SIZE);
  const d = image.data;
  let shown = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const alpha = clamp01((lum - 12) / 16); // 12 이하 = 완전 투명, 28 이상 = 그대로
    d[i + 3] = Math.round(d[i + 3] * alpha);
    if (d[i + 3] > 24) shown += 1;
  }
  kctx.putImageData(image, 0, 0);
  return { canvas: keyed, visible: shown / (KEYED_SIZE * KEYED_SIZE) };
}

// 그림을 받는다. decoding='async' 는 쓰지 않는다 — 사파리에서 캔버스로 옮길 때 빈 그림이 되는 원인이 된다.
// onload 로 받은 뒤 decode() 를 한 번 더 기다리되, decode 가 실패해도 이미 받은 그림은 그대로 쓴다.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('symbol load failed'));
    img.src = src;
  }).then(async (img) => {
    try { await img.decode(); } catch { /* 받은 그림은 있다. 아래에서 내용이 실제로 있는지 센다 */ }
    return img;
  });
}

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

// 점 자리 뽑기: 흰 종이 부분(밝기 150 이상)만 점으로 뽑고 그림자는 제외한다.
function pickCandidates(img: HTMLImageElement): Array<[number, number]> {
  const off = document.createElement('canvas');
  off.width = SAMPLE_SIZE; off.height = SAMPLE_SIZE;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const candidates: Array<[number, number]> = [];
  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < SAMPLE_SIZE; x += 1) {
      const i = (y * SAMPLE_SIZE + x) * 4;
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      if (data[i + 3] > 96 && lum > 150) candidates.push([x, y]);
    }
  }
  return candidates;
}

export interface SymbolSample {
  // 흰 종이 자리(SAMPLE_SIZE 격자 좌표)
  candidates: Array<[number, number]>;
  // 배경을 뺀 심볼(KEYED_SIZE 정사각형)
  keyed: HTMLCanvasElement;
  // 첫 번째 옮기기가 빈 그림이라 한 번 다시 옮겨서 성공했는지(사파리에서 생긴다)
  retried: boolean;
}

// 실패 까닭: 그림을 받지 못함 / 받았지만 캔버스에 빈 그림으로만 옮겨짐
export class SymbolReadError extends Error {
  readonly reason: 'load' | 'blank';
  constructor(reason: 'load' | 'blank') {
    super(reason === 'blank' ? 'symbol drew blank' : 'symbol load failed');
    this.name = 'SymbolReadError';
    this.reason = reason;
  }
}

// 그림을 읽는다. 빈 그림이면 한 번 다시 옮기고, 그래도 비면 throw 한다(성공 = 실제로 담겼음).
export async function readSymbol(src: string): Promise<SymbolSample> {
  const img = await loadImage(src).catch(() => { throw new SymbolReadError('load'); });
  let keyed = keyOutBackground(img);
  let candidates = pickCandidates(img);
  let retried = false;
  if (!keyed || keyed.visible < MIN_VISIBLE_RATIO || !candidates.length) {
    retried = true;
    await wait(REDRAW_WAIT_MS);
    keyed = keyOutBackground(img);
    candidates = pickCandidates(img);
  }
  if (!keyed || keyed.visible < MIN_VISIBLE_RATIO || !candidates.length) throw new SymbolReadError('blank');
  return { candidates, keyed: keyed.canvas, retried };
}
