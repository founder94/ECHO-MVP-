// 운영 Auth 설정 읽기 결과에서 URL 관련 값만 출력(비밀값 아님). 입력: Management API /config/auth 응답 JSON 파일 경로.
import { readFileSync } from 'node:fs';
const c = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const list = String(c.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const trim = (u) => String(u).trim().replace(/\/+$/, '');
const esc = (q) => q.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const cover = (entry, url) => { const e = trim(entry); const u = trim(url); if (!e.includes('*')) return e === u; return new RegExp('^' + e.split('**').map((p) => p.split('*').map(esc).join('[^/]*')).join('.*') + '$').test(u); };
const has = (u) => list.some((e) => cover(e, u));
const originOf = (e) => { try { return new URL(e.replace(/\*+/g, 'x')).origin; } catch { return '?'; } };
console.log(`AUTH_SITE_URL=${c.site_url}`);
console.log(`AUTH_ALLOW_APP_CALLBACK=${has('https://app.do-it.company/auth/callback')}`);
console.log(`AUTH_ALLOW_ADMIN_CALLBACK=${has('https://admin.do-it.company/auth/callback')}`);
console.log(`AUTH_ALLOW_LIST_COUNT=${list.length}`);
console.log(`AUTH_ALLOW_LIST_ORIGINS=${[...new Set(list.map(originOf))].join(' ')}`);
console.log(`AUTH_RETIRED_PRESENT=${[c.site_url, ...list].some((v) => /melba-b1449a|localhost|ready\.co/i.test(String(v)))}`);
