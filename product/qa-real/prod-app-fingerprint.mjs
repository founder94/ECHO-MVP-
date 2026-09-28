// 운영 APP 지문 대조(2026-09-29 PROD PRE-FLIGHT · 읽기 전용): 지금 app.do-it.company 가 어느 소스로 만든 것인지.
// 같은 소스 + 같은 운영 공개값으로 만든 빌드(dist)와 실사이트의 index.html 해시 · 불러오는 파일 이름 목록을 비교한다. 운영 변경 0.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const APP = 'https://app.do-it.company';
const DIST = process.argv[2];
const sha16 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const localIndex = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const localAssets = new Set(walk(path.join(DIST, 'assets')).map((p) => '/assets/' + path.basename(p)).filter((p) => p.endsWith('.js')));
const liveIndex = await (await fetch(`${APP}/`)).text();
// 실사이트: 첫 화면에서 이어지는 js 조각 전부
const seen = new Set(); const queue = [...liveIndex.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]);
while (queue.length) { const p = queue.shift(); if (seen.has(p)) continue; seen.add(p); const t = await (await fetch(`${APP}${p}`)).text(); for (const m of t.matchAll(/(?:\/assets\/|\.\/)([A-Za-z0-9_.-]+\.js)/g)) { const q = '/assets/' + m[1]; if (!seen.has(q)) queue.push(q); } }
const liveOnly = [...seen].filter((p) => !localAssets.has(p)); const localOnly = [...localAssets].filter((p) => !seen.has(p));
console.log(`live index sha16=${sha16(liveIndex)} · local(${process.env.SRC_SHA?.slice(0, 7)}) index sha16=${sha16(localIndex)} · same=${sha16(liveIndex) === sha16(localIndex)}`);
console.log(`live js=${seen.size} · local js=${localAssets.size} · live-only=${liveOnly.length} · local-only(안 불린 것 포함)=${localOnly.length}`);
console.log(`live-only sample: ${liveOnly.slice(0, 8).join(' ')}`);
console.log(`APP FINGERPRINT: ${sha16(liveIndex) === sha16(localIndex) && liveOnly.length === 0 ? 'SAME_SOURCE' : 'DIFFERENT'}`);
