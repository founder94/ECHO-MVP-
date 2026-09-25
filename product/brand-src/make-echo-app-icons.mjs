// 대표 지정 원본(JPEG 689×655)에서: 가운데 정사각 자르기(655) → 크기별 축소(무손실 PNG). 모양·색·질감 변경 0.
// maskable 만: 원본 정사각을 줄여 안전 원(반지름 40%) 안에 심볼이 들어가게 하고, 바깥 여백은 원본 가장자리 평균색으로 채운다(가장자리 24px 는 여백색으로 부드럽게 이어 붙임).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const b64 = readFileSync('original.jpg').toString('base64');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const out = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, S = Math.min(W, H), sx = Math.floor((W - S) / 2), sy = Math.floor((H - S) / 2);
  const sq = document.createElement('canvas'); sq.width = S; sq.height = S; sq.getContext('2d').drawImage(img, sx, sy, S, S, 0, 0, S, S);
  const png = (c) => c.toDataURL('image/png');
  const scaled = (n) => { const c = document.createElement('canvas'); c.width = n; c.height = n; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(sq, 0, 0, n, n); return c; };
  const res = { crop: { S, sx, sy } };
  for (const n of [512, 192, 180, 48, 32, 16]) res[n] = png(scaled(n));
  // maskable 512
  const N = 512, inner = 364, pad = [163, 170, 178], F = 24;
  const m = scaled(inner); const mx = m.getContext('2d'); const d = mx.getImageData(0, 0, inner, inner);
  for (let y = 0; y < inner; y++) for (let x = 0; x < inner; x++) { const e = Math.min(x, y, inner - 1 - x, inner - 1 - y); if (e >= F) continue; const t = e / F; const i = (y * inner + x) * 4; for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(d.data[i + k] * t + pad[k] * (1 - t)); }
  mx.putImageData(d, 0, 0);
  const c = document.createElement('canvas'); c.width = N; c.height = N; const x = c.getContext('2d'); x.fillStyle = `rgb(${pad.join(',')})`; x.fillRect(0, 0, N, N); x.drawImage(m, (N - inner) / 2, (N - inner) / 2);
  res.maskable = png(c);
  return res;
}, `data:image/jpeg;base64,${b64}`);
const save = (name, url) => writeFileSync(name, Buffer.from(url.split(',')[1], 'base64'));
for (const n of [512, 192, 180, 48, 32, 16]) save(`echo-icon-${n}.png`, out[n]);
save('echo-icon-512-maskable.png', out.maskable);
console.log(JSON.stringify(out.crop));
await browser.close();
