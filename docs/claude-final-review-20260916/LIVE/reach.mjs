// 정상 사용자가 화면에서 누를 수 있는 연결만 따라가며 실제 도달 가능한 경로를 구한다.
// 파일이 남아 있는지가 아니라, 첫 화면에서 버튼·링크로 갈 수 있는지를 본다.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] || '.');
const SRC = join(ROOT, 'src');

// 1) 라우터에서 경로 → 페이지 파일 매핑을 읽는다.
function parseRoutes() {
  const map = new Map();   // path -> file
  const redirect = new Map(); // path -> path
  const cfg = readFileSync(join(SRC, 'router/config.tsx'), 'utf8');
  const lazyOf = new Map();
  for (const m of cfg.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\('([^']+)'\)\)/g)) lazyOf.set(m[1], m[2]);
  for (const m of cfg.matchAll(/path:\s*'([^']+)',\s*\n\s*element:\s*<(\w+)\s*\/>/g)) {
    const f = lazyOf.get(m[2]); if (f) map.set(m[1], f);
  }
  for (const m of cfg.matchAll(/path:\s*'([^']+)',\s*\n\s*element:\s*<Navigate to=\{?([^}\s/]+)\}?\s*replace/g)) {
    let t = m[2].replace(/["']/g, '');
    if (t === 'MAIN_ENTRY_PATH') t = '/do-it/landing';
    redirect.set(m[1], t);
  }
  // /doit 하위
  const dr = readFileSync(join(SRC, 'doit/routes.tsx'), 'utf8');
  const dLazy = new Map();
  for (const m of dr.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\)/g)) dLazy.set(m[1], m[2]);
  for (const m of dr.matchAll(/\{\s*path:\s*"([^"]+)",\s*element:\s*<(\w+)\s*\/>\s*\}/g)) {
    const f = dLazy.get(m[2]); if (f) map.set('/doit/' + m[1], f);
  }
  for (const m of dr.matchAll(/\{\s*path:\s*"([^"]+)",\s*element:\s*<Navigate to="([^"]+)"\s*replace/g)) redirect.set('/doit/' + m[1], m[2]);
  for (const m of dr.matchAll(/\{\s*index:\s*true,\s*element:\s*<Navigate to="([^"]+)"\s*replace/g)) redirect.set('/doit', m[1]);
  map.set('/doit', dLazy.get('DoitApp') ?? '@/doit/DoitApp'); // 레이아웃
  return { map, redirect };
}

const { map: ROUTE_FILE, redirect: REDIRECT } = parseRoutes();

// 2) 페이지 파일 + 그 파일이 import 하는 같은 프로젝트 컴포넌트에서 이동 대상을 뽑는다.
const resolveAlias = (p) => p.startsWith('@/') ? join(SRC, p.slice(2)) : p;
function fileCandidates(p) {
  const base = resolveAlias(p);
  const list = [base, base + '.tsx', base + '.ts', join(base, 'page.tsx'), join(base, 'index.tsx'), join(base, 'index.ts')];
  return list.filter((f) => existsSync(f) && statSync(f).isFile());
}
const readCache = new Map();
function readAll(entry, depth = 0, seen = new Set()) {
  const files = fileCandidates(entry);
  if (!files.length || depth > 3) return '';
  const f = files[0];
  if (seen.has(f)) return '';
  seen.add(f);
  if (readCache.has(f) && depth === 0) { /* 계속 */ }
  let text = readFileSync(f, 'utf8');
  // 같은 프로젝트 컴포넌트만 따라 들어간다(외부 패키지 제외)
  for (const m of text.matchAll(/from\s+['"](@\/[^'"]+|\.{1,2}\/[^'"]+)['"]/g)) {
    let dep = m[1];
    if (dep.startsWith('.')) dep = resolve(f, '..', dep);
    text += '\n' + readAll(dep, depth + 1, seen);
  }
  return text;
}

// 3) 이동 대상 추출: navigate('/x') / to="/x" / to={'/x'} / href="/x"
function linksOf(text) {
  const out = new Set();
  const add = (s) => { if (s && s.startsWith('/') && !s.startsWith('//')) out.add(s.split('?')[0]); };
  for (const m of text.matchAll(/navigate\(\s*['"`](\/[^'"`]*)['"`]/g)) add(m[1]);
  for (const m of text.matchAll(/\bto=\{?\s*['"`](\/[^'"`]*)['"`]/g)) add(m[1]);
  for (const m of text.matchAll(/\bhref=\{?\s*['"`](\/[^'"`]*)['"`]/g)) add(m[1]);
  for (const m of text.matchAll(/\bpath:\s*['"`](\/[^'"`]*)['"`]/g)) add(m[1]);
  // 상수를 '정의'만 한 파일은 링크가 아니다. 화면이 실제로 그 상수로 이동할 때만 센다.
  if (/(?:to=\{|navigate\(\s*)ECHO_ENTRY_PATH/.test(text)) add('/weather');
  if (/(?:to=\{|navigate\(\s*)MODE_SELECT_PATH/.test(text)) add('/start');
  if (/navigate\(\s*entryPathForMode|navigate\(\s*path\b/.test(text) && /entryPathForMode/.test(text)) { add('/weather'); add('/do-it/landing'); add('/start'); }
  return [...out];
}

// 4) '/' 에서 BFS
const START = '/';
const seen = new Map(); // path -> from
const queue = [[START, null]];
seen.set(START, null);
while (queue.length) {
  const [p, from] = queue.shift();
  const target = REDIRECT.get(p) ?? p;
  if (target !== p && !seen.has(target)) { seen.set(target, `${p}(redirect)`); queue.push([target, p]); }
  const file = ROUTE_FILE.get(target) ?? ROUTE_FILE.get(p);
  if (!file) continue;
  const text = readAll(file);
  for (const l of linksOf(text)) {
    if (seen.has(l)) continue;
    if (!ROUTE_FILE.has(l) && !REDIRECT.has(l)) { seen.set(l, `${target} (라우트 없음)`); continue; }
    seen.set(l, target);
    queue.push([l, target]);
  }
}

const B_FLOW = ['/weather', '/weather-check', '/story-start', '/step/2', '/understanding-check', '/white-door', '/payment', '/report', '/locker', '/next-journey', '/home', '/start'];
console.log(`'/' 에서 링크를 따라 도달 가능한 경로 ${seen.size}개\n`);
console.log('=== B 구조·예전 홈 도달 여부 ===');
for (const p of B_FLOW) {
  const hit = seen.has(p);
  console.log(`  ${hit ? '도달 가능' : '도달 불가'}  ${p}${hit ? '   ← ' + seen.get(p) : ''}`);
}
console.log('\n=== 도달 가능한 전체 경로 ===');
console.log([...seen.keys()].sort().join('  '));
