// Stale Redirect Guard(2026-09-28 대표 실기기 iPhone: Google 로그인 뒤 폐기된 QA 주소로 이동 → Netlify 「Site not found」).
// 실측 원인: Supabase Auth 는 redirectTo 가 Redirect URLs(허용 목록)에 없으면 조용히 Site URL 로 보낸다.
//   QA Site URL = 폐기된 thriving-melba-b1449a.netlify.app · 허용 목록에 echo-app-qa 없음 → 모든 Google 로그인이 죽은 사이트로.
//   (auth.flow_state.referrer 실측 — echo-app-qa·admin·임의 주소 모두 같은 폐기 주소로 떨어짐)
// 규칙(빌드·배포 전 FAIL):
//   1) Site URL = 그 환경의 실제 APP 주소
//   2) 허용 목록에 APP·ADMIN 의 /auth/callback 이 들어 있다(정확한 주소 권장 · 넓은 와일드카드 불필요)
//   3) Site URL·허용 목록 어디에도 폐기 주소(RETIRED)가 없다
//   4) 허용 목록의 모든 항목이 그 환경의 살아 있는 주소(APP·ADMIN·BRAND)만 가리킨다(남은 옛 주소 0)
export const RETIRED = [/melba-b1449a/i, /\blocalhost\b/i, /ready\.co\b/i];

export const ENVIRONMENTS = {
  qa: { ref: 'mutniujeiyujhkobadkd', app: 'https://echo-app-qa.netlify.app', admin: 'https://echo-admin-qa.netlify.app', live: ['https://echo-app-qa.netlify.app', 'https://echo-admin-qa.netlify.app', 'https://echo-brand-qa.netlify.app'] },
  prod: { ref: 'zyyhhxyupizcqhxqnxuu', app: 'https://app.do-it.company', admin: 'https://admin.do-it.company', live: ['https://app.do-it.company', 'https://admin.do-it.company', 'https://do-it.company'] },
};

const trim = (u) => String(u ?? '').trim().replace(/\/+$/, '');
const originOf = (u) => { try { return new URL(String(u).replace(/\*+/g, 'x')).origin; } catch { return null; } };

/** 허용 목록 한 줄이 주어진 주소를 덮는가(Supabase 규칙: 정확히 같거나 * / ** 와일드카드). */
export function allowEntryCovers(entry, url) {
  const e = trim(entry); const u = trim(url);
  if (!e.includes('*')) return e === u;
  const rx = new RegExp('^' + e.split('**').map((p) => p.split('*').map((q) => q.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
  return rx.test(u);
}

/** 설정이 문제 없으면 [] · 문제면 사람이 읽는 이유 목록. */
export function oauthRedirectProblems({ siteUrl, allowList }, env) {
  const problems = [];
  const list = (Array.isArray(allowList) ? allowList : String(allowList ?? '').split(',')).map((s) => s.trim()).filter(Boolean);
  const callback = `${env.app}/auth/callback`;
  if (trim(siteUrl) !== trim(env.app)) problems.push(`Site URL 이 APP 주소가 아님: ${siteUrl || '(비어 있음)'} ≠ ${env.app}`);
  if (!list.some((e) => allowEntryCovers(e, callback))) problems.push(`허용 목록에 ${callback} 없음 → redirectTo 가 Site URL 로 떨어진다`);
  // 관리자도 같은 로그인 코드(AuthContext.oauthRedirectUrl = 현재 주소 + /auth/callback)를 쓴다 — 정확한 콜백 한 줄이 있어야 한다.
  if (env.admin && !list.some((e) => allowEntryCovers(e, `${env.admin}/auth/callback`))) problems.push(`허용 목록에 ${env.admin}/auth/callback 없음 → 관리자 Google 로그인도 Site URL 로 떨어진다`);
  for (const v of [siteUrl, ...list]) if (RETIRED.some((rx) => rx.test(String(v ?? '')))) problems.push(`폐기 주소가 남아 있음: ${v}`);
  for (const e of list) { const o = originOf(e); if (o && !env.live.includes(o) && !RETIRED.some((rx) => rx.test(e))) problems.push(`허용 목록에 이 환경의 살아 있는 주소가 아닌 항목: ${e}`); }
  return [...new Set(problems)];
}

/** 운영 산출물·설정 글에서 폐기 주소 찾기(빌드 검사용). */
export function retiredDomainHits(text) {
  return RETIRED.slice(0, 1).flatMap((rx) => (String(text).match(new RegExp(rx.source, 'gi')) ?? []));
}

// CLI: node scripts/oauth-redirect-guard.mjs qa|prod — Supabase Management API 로 Auth 설정을 읽어 검사(값·토큰 출력 0).
// 토큰: SUPABASE_AUTH_READ_TOKEN(Auth 설정 읽기 권한). 없거나 권한이 없으면 FAIL(확인 못 한 것을 통과로 두지 않음).
if (import.meta.url === `file://${process.argv[1]}`) {
  const envName = process.argv[2];
  const env = ENVIRONMENTS[envName];
  if (!env) { console.error('usage: oauth-redirect-guard.mjs qa|prod'); process.exit(2); }
  const token = process.env.SUPABASE_AUTH_READ_TOKEN;
  if (!token) { console.log(`FAIL ${envName}: SUPABASE_AUTH_READ_TOKEN 없음 — OAuth 설정을 확인하지 못해 통과시키지 않음`); process.exit(1); }
  const res = await fetch(`https://api.supabase.com/v1/projects/${env.ref}/config/auth`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status !== 200) { console.log(`FAIL ${envName}: Auth 설정 읽기 ${res.status}(토큰 권한 확인 필요) — 통과시키지 않음`); process.exit(1); }
  const cfg = await res.json();
  const problems = oauthRedirectProblems({ siteUrl: cfg.site_url, allowList: cfg.uri_allow_list }, env);
  if (problems.length) { for (const p of problems) console.log(`FAIL ${envName}: ${p}`); process.exit(1); }
  console.log(`PASS ${envName}: Site URL = ${env.app} · 허용 목록에 ${env.app}/auth/callback · 폐기 주소 0`);
}
