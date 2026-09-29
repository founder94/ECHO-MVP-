// BRAND 빌드 주소 잠금(2026-09-28 대표 「BRAND → APP BROKEN LINK · P0」).
// 원인: 운영 do-it.company 에 QA 용 BRAND 빌드(VITE_APP_ORIGIN=thriving-melba-b1449a.netlify.app · QA Supabase)가 올라가,
//       「ECHO 시작하기」·로그인·제품 경로가 이름이 바뀌어 사라진 QA 주소로 가서 Netlify 「Site not found」(404)가 났다.
// 규칙: 빌드가 쓰는 Supabase 로 운영/QA 를 가르고, 그 짝이 아닌 주소가 섞이면 빌드를 멈춘다.
//  - 운영(Supabase zyyhhxyupizcqhxqnxuu): 앱 = https://app.do-it.company · 브랜드 = https://do-it.company · 관리자 = https://admin.do-it.company 만.
//  - QA(Supabase mutniujeiyujhkobadkd): 앱 = https://echo-app-qa.netlify.app · 브랜드 = https://echo-brand-qa.netlify.app · 관리자 = https://echo-admin-qa.netlify.app 만
//    (값을 비우면 코드 기본값이 운영 주소라 QA 가 운영으로 새므로, QA 는 세 값을 반드시 적는다).
//  - 두 곳 어디서도 사라진 옛 QA 주소(thriving-melba-b1449a)는 쓰지 않는다.
export const PROD_SUPABASE_REF = 'zyyhhxyupizcqhxqnxuu';
export const QA_SUPABASE_REF = 'mutniujeiyujhkobadkd';
export const ORIGINS = {
  prod: { app: 'https://app.do-it.company', brand: 'https://do-it.company', admin: 'https://admin.do-it.company' },
  qa: { app: 'https://echo-app-qa.netlify.app', brand: 'https://echo-brand-qa.netlify.app', admin: 'https://echo-admin-qa.netlify.app' },
};
const DEAD = /thriving-melba-b1449a/;
const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\/$/, '') : '');

/** 빌드 대상(prod | qa | other). Supabase 주소로만 가른다. */
export function targetOf(supabaseUrl) {
  const u = clean(supabaseUrl);
  if (u.includes(PROD_SUPABASE_REF)) return 'prod';
  if (u.includes(QA_SUPABASE_REF)) return 'qa';
  return 'other';
}

/**
 * BRAND 빌드 주소 검사. 문제가 없으면 null, 있으면 한 줄 이유.
 * @param {{ siteRole?: string, supabaseUrl?: string, appOrigin?: string, brandOrigin?: string, adminOrigin?: string }} v
 */
export function brandOriginProblem(v) {
  if (v.siteRole !== 'brand') return null;
  const target = targetOf(v.supabaseUrl);
  const given = { app: clean(v.appOrigin), brand: clean(v.brandOrigin), admin: clean(v.adminOrigin) };
  for (const [k, val] of Object.entries(given)) if (DEAD.test(val)) return `BRAND ${k} 주소가 사라진 옛 QA 주소(${val})`;
  if (target === 'prod') {
    for (const [k, val] of Object.entries(given)) {
      if (val && val !== ORIGINS.prod[k]) return `운영 BRAND 빌드인데 ${k} 주소가 운영 주소가 아님: ${val} (운영 = ${ORIGINS.prod[k]})`;
    }
    return null;
  }
  if (target === 'qa') {
    for (const [k, val] of Object.entries(given)) {
      if (!val) return `QA BRAND 빌드인데 ${k} 주소(VITE_${k.toUpperCase()}_ORIGIN)가 비어 있음 — 비우면 운영 주소로 샌다`;
      if (val !== ORIGINS.qa[k]) return `QA BRAND 빌드인데 ${k} 주소가 QA 주소가 아님: ${val} (QA = ${ORIGINS.qa[k]})`;
    }
    return null;
  }
  return null; // 로컬·기타 Supabase: 잠그지 않는다
}
