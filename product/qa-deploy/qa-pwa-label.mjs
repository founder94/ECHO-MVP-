// QA 전용(2026-09-27 대표 「QA FRONTEND · 홈 화면 아이콘 실행 추가」): QA 빌드 결과(dist)에만 적용한다. 운영 소스·운영 manifest 는 건드리지 않는다.
// 기존 승인 아이콘(public/pwa/echo-icon-*) 그대로 · 이름만 「QA」를 붙여 폰 홈 화면에서 운영 앱과 헷갈리지 않게 한다.
// 사용: node qa-pwa-label.mjs <dist 경로>
import { readFileSync, writeFileSync } from 'node:fs';
const dist = process.argv[2];
if (!dist) { console.error('dist 경로 필요'); process.exit(2); }
const m = JSON.parse(readFileSync(`${dist}/manifest.webmanifest`, 'utf8'));
for (const k of ['start_url', 'scope', 'id']) if (/^https?:/i.test(m[k] ?? '')) { console.error(`FAIL: ${k} 가 절대 주소(${m[k]})`); process.exit(3); }
m.name = 'DO IT · ECHO (QA)'; m.short_name = 'DO IT QA';
writeFileSync(`${dist}/manifest.webmanifest`, JSON.stringify(m, null, 2));
const html = readFileSync(`${dist}/index.html`, 'utf8');
const from = '<meta name="apple-mobile-web-app-title" content="DO IT" />';
if (!html.includes(from)) { console.error('FAIL: apple-mobile-web-app-title 없음'); process.exit(4); }
writeFileSync(`${dist}/index.html`, html.replace(from, '<meta name="apple-mobile-web-app-title" content="DO IT QA" />'));
if (/zyyhhxyupizcqhxqnxuu/.test(html)) { console.error('FAIL: 운영 ref 포함'); process.exit(5); }
console.log('QA PWA 표시 적용: DO IT QA');
