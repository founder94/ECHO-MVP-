// 운영 빌드 결과물 점검: source map, 비밀값, 개발용 주소, QA 전용 화면이 들어갔는지 검사한다.
// 사용: npm run build:app && npm run build:brand && npm run check:dist
//       node scripts/check-dist.mjs <폴더> [<폴더> ...]
// 발견한 값은 앞 4자리·뒤 4자리만 남기고 가려서 출력한다. 폴더가 없으면 통과로 치지 않고 실패한다.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const TARGETS = process.argv.slice(2).length ? process.argv.slice(2) : ["out"];
// VITE_QA_HARNESS=true 로 빌드할 때만 들어가는 QA 전용 화면. 운영 산출물에 있으면 안 된다.
const QA_ONLY_MARKERS = [/QaDoitUnderstanding/];

const SECRET_PATTERNS = [
  { name: "OpenAI secret key", re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { name: "Stripe secret key", re: /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { name: "Stripe webhook secret", re: /whsec_[A-Za-z0-9]{16,}/g },
  { name: "Toss secret key", re: /(?:live|test)_(?:gsk|sk)_[A-Za-z0-9]{16,}/g },
  { name: "Private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "Hardcoded bearer token", re: /Bearer\s+[A-Za-z0-9._-]{30,}/g },
];
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
// 뒤따르는 글자(경로 등)까지 함께 잡아, 허용 예외는 "주소 문자열이 거기서 끝나는 경우"로만 한정한다.
const DEV_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?([^\s`'"]*)/g;
// 라이브러리 내부 기본값이라 실제 요청 주소가 아닌 것. 숨기지 않고 '허용 예외'로 따로 출력한다.
const ALLOWED_DEV_URLS = new Map([
  ["http://localhost", "URL 파싱용 기준 주소 (new URL(path, 'http://localhost'))"],
  ["http://localhost:9999", "@supabase/auth-js 기본값 GOTRUE_URL — createClient에 실제 Supabase URL을 넘기므로 사용되지 않음"],
]);

function mask(value) {
  return value.length <= 12 ? "****" : `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.role ?? "";
  } catch {
    return "";
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const problems = [];
const allowed = new Set();
for (const DIST of TARGETS) {
  if (!existsSync(DIST)) {
    problems.push(`[검사 대상 없음] ${DIST} (먼저 빌드하세요)`);
    continue;
  }
  for (const file of walk(DIST)) {
    const rel = `${DIST}/${relative(DIST, file)}`;
    if (file.endsWith(".map")) {
      problems.push(`[source map] ${rel}`);
      continue;
    }
    if (QA_ONLY_MARKERS.some((re) => re.test(rel))) problems.push(`[QA 전용 화면] ${rel}`);
    if (!/\.(js|mjs|css|html|json|txt)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (/[#@]\s*sourceMappingURL=/.test(text)) problems.push(`[sourceMappingURL] ${rel}`);
    if (QA_ONLY_MARKERS.some((re) => re.test(text))) problems.push(`[QA 전용 화면 참조] ${rel}`);
    for (const { name, re } of SECRET_PATTERNS) {
      for (const m of text.matchAll(re)) problems.push(`[${name}] ${rel}: ${mask(m[0])}`);
    }
    for (const m of text.matchAll(JWT)) {
      const role = jwtRole(m[0]);
      if (role && role !== "anon") problems.push(`[JWT role=${role}] ${rel}: ${mask(m[0])}`);
    }
    for (const m of text.matchAll(DEV_URL)) {
      if (m[1] === "" && ALLOWED_DEV_URLS.has(m[0])) allowed.add(`${m[0]} — ${ALLOWED_DEV_URLS.get(m[0])}`);
      else problems.push(`[개발용 주소] ${rel}: ${m[0]}`);
    }
  }
}

if (allowed.size) {
  console.log("허용 예외 (라이브러리 기본값):");
  for (const a of allowed) console.log(`  - ${a}`);
}
if (problems.length) {
  console.error(`운영 빌드 점검 실패: ${problems.length}건`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`운영 빌드 점검 통과: ${TARGETS.join(", ")} (source map 0, 비밀값 0, 개발용 주소 0, QA 전용 화면 0)`);
