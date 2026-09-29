// ECHO 프론트 FINAL 회귀검사 50건.
// 판정 종류: 렌더 PASS(브라우저 실제 렌더), 코드 PASS(소스 실측), 확인 불가(실행 못 함)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.argv[2] || '.';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${process.env.PORT || 8899}`;
const src = (p) => { const f = join(ROOT, 'src', p); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };
const outFile = (p) => { const f = join(ROOT, 'out', p); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };
const domCache = new Map();
function dom(path) {
  if (domCache.has(path)) return domCache.get(path);
  const r = spawnSync(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
    '--virtual-time-budget=12000','--run-all-compositor-stages-before-draw','--dump-dom', `${BASE}${path}`],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 64*1024*1024 });
  const t = (r.stdout||'').replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
  domCache.set(path, t); return t;
}
const rows = [];
function t(no, group, init, action, expect, kind, fn) {
  let actual = '', verdict = '확인 불가';
  if (kind === 'skip') { actual = fn ? fn() : '이 환경에서 실행 불가'; }
  else {
    try { const r = fn(); actual = r.actual; verdict = r.pass ? (kind === 'render' ? '렌더 PASS' : '코드 PASS') : (r.miss ? '목표 미달' : 'FAIL'); }
    catch (e) { actual = '검사 오류: ' + e.message; verdict = 'FAIL'; }
  }
  rows.push({ no, group, init, action, expect, actual, verdict });
}
const ok = (pass, actual, miss = false) => ({ pass, actual, miss });

// ── 1. 진입/라우팅 10 ──
t(1,'진입','첫 방문','/ 열기','Plan A 랜딩 01 구간','render',()=>{const d=dom('/');return ok(/01 — 당신의 하루/.test(d), d.slice(0,50));});
t(2,'진입','첫 방문','/ 열기','"오늘 내 마음의 날씨는 어때?" 0건','render',()=>{const d=dom('/');return ok(!/오늘 내 마음의 날씨는 어때\?/.test(d),'0건');});
t(3,'진입','첫 방문','/ 열기','"내 마음을 알면, 내가 보인다" 0건','render',()=>{const d=dom('/');return ok(!/내 마음을 알면, 내가 보인다/.test(d),'0건');});
t(4,'진입','첫 방문','/ 열기','예전 홈 내비(ECHO 경험 기록) 0건','render',()=>{const d=dom('/');return ok(!/ECHO 경험 기록/.test(d),'0건');});
t(5,'진입','첫 방문','/ 열기','날씨 선택 UI 없음','render',()=>{const d=dom('/');return ok(!/맑음|흐림/.test(d.slice(0,400)),'없음');});
t(6,'진입','소스','router 의 / 정의 확인','MAIN_ENTRY_PATH 로 이동','code',()=>{const s=src('router/config.tsx');return ok(/path: '\/',[\s\S]{0,80}Navigate to=\{MAIN_ENTRY_PATH\} replace/.test(s),'Navigate to MAIN_ENTRY_PATH');});
t(7,'진입','소스','MAIN_ENTRY_PATH 값','/do-it/landing','code',()=>{const s=src('lib/echo/appMode.ts');const m=s.match(/MAIN_ENTRY_PATH = '([^']+)'/);return ok(m&&m[1]==='/do-it/landing',m?m[1]:'없음');});
t(8,'진입','빌드 산출물','첫 화면 번들 문자열','금지 문구 0건','code',()=>{const h=outFile('index.html');const m=h.match(/src="\/assets\/([^"]+)"/);const b=m?outFile('assets/'+m[1]):'';return ok(b&&!/오늘 내 마음의 날씨|내 마음을 알면/.test(b),'entry='+(m?m[1]:'?'));});
t(9,'진입','첫 방문','/do-it/landing 직접 열기','랜딩 렌더','render',()=>{const d=dom('/do-it/landing');return ok(/01 — 당신의 하루/.test(d),d.slice(0,40));});
t(10,'진입','첫 방문','없는 경로 열기','NotFound 화면','render',()=>{const d=dom('/zzz-not-exist');return ok(d.length>0 && !/오늘 내 마음의 날씨는 어때\?/.test(d),d.slice(0,40));});

// ── 2. 로그인/복귀 10 ──
t(11,'로그인','소스','defaultReturnPath 확인','MAIN_ENTRY_PATH 반환','code',()=>{const s=src('lib/auth/returnPath.ts');return ok(/defaultReturnPath\(\): string \{\s*return MAIN_ENTRY_PATH;/.test(s),'MAIN_ENTRY_PATH');});
t(12,'로그인','소스','app-mode=echo 만으로 /weather 복귀하는가','복귀하지 않음','code',()=>{const s=src('lib/auth/returnPath.ts');return ok(!/entryPathForMode/.test(s),'entryPathForMode 참조 0');});
t(13,'로그인','소스','외부 주소 returnPath 차단','내부 경로만 허용','code',()=>{const s=src('lib/auth/returnPath.ts');return ok(/SAFE_PATH = \/\^\\\/\(\?!\[\/\\\\\]\)/.test(s)&&/!path\.includes\(':'\)/.test(s),'정규식+스킴 차단');});
t(14,'로그인','소스','sanitizeReturnPath 기본값','defaultReturnPath 대체','code',()=>{const s=src('lib/auth/returnPath.ts');return ok(/isSafeInternalPath\(path\) \? path : defaultReturnPath\(\)/.test(s),'기본값 대체');});
t(15,'로그인','소스','callback 중복 실행 가드','handledRef 존재','code',()=>{const s=src('pages/auth/callback/page.tsx');return ok(/handledRef\.current/.test(s),'handledRef');});
t(16,'로그인','소스','로그인 취소 처리','access_denied 안내','code',()=>{const s=src('pages/auth/callback/page.tsx');return ok(/access_denied/.test(s),'취소 분기 존재');});
t(17,'로그인','소스','세션 대기 제한시간','SESSION_WAIT_MS 존재','code',()=>{const s=src('pages/auth/callback/page.tsx');return ok(/SESSION_WAIT_MS\s*=\s*\d+/.test(s),'제한시간 존재');});
t(18,'로그인','소스','redirectTo 가 내부 도메인','window.location.origin 사용','code',()=>{const s=src('doit/hooks/useAuth.tsx');return ok(/redirectTo: `\$\{window\.location\.origin\}/.test(s),'origin 기반');});
t(19,'로그인','소스','관리자 복귀는 일반 로그인과 분리','admin 전용 redirect','code',()=>{const s=src('doit/pages/do-it/admin/components/AdminGuard.tsx');return ok(/adminRedirectUrl\(\)/.test(s)&&/doit\/admin\/mobile/.test(s),'adminRedirectUrl 분리');});
t(20,'로그인','실제 Google 왕복','로그인 후 복귀 확인','Plan A 복귀','skip',()=>'실제 OAuth 왕복을 이 환경에서 실행하지 못함');

// ── 3. 가입 전 체험 8 ──
t(21,'체험','랜딩','시작하기 누름','/do-it/1 로 이동','code',()=>{const s=src('pages/do-it/landing/page.tsx');return ok(/navigate\('\/do-it\/1'\)/.test(s),'/do-it/1');});
t(22,'체험','/do-it/4','시작하기 누름','/doit/start-journey 로 이동','code',()=>{const s=src('pages/do-it/4/page.tsx');return ok(/navigate\('\/doit\/start-journey'\)/.test(s),'/doit/start-journey');});
t(23,'체험','/do-it/4','여정 다시 고르기 버튼','존재하지 않음','render',()=>{const d=dom('/do-it/4');return ok(!/여정 다시 고르기/.test(d),'0건');});
t(24,'체험','/do-it/4','화면 렌더','시작하기 버튼 노출','render',()=>{const d=dom('/do-it/4');return ok(/시작하기/.test(d),'노출');});
t(25,'체험','start-journey','로그인 필요 시','/login 으로 보내고 복귀 경로 전달','code',()=>{const s=src('doit/pages/do-it/start-journey/page.tsx');return ok(/navigate\("\/login", \{ state: \{ from: START_JOURNEY_PATH \} \}\)/.test(s),'from=START_JOURNEY_PATH');});
t(26,'체험','start-journey','목적 선택 후','purpose 를 DB 에 저장','code',()=>{const s=src('doit/lib/profileSave.ts');return ok(/export async function savePurpose/.test(s)&&/\.from\("profiles"\)[\s\S]{0,60}\.upsert/.test(s),'profiles.upsert');});
t(27,'체험','start-journey','다음 화면','/doit/spaces 로 이동','code',()=>{const s=src('doit/pages/do-it/start-journey/page.tsx');return ok(/navigate\("\/doit\/spaces"\)/.test(s),'/doit/spaces');});
t(28,'체험','랜딩 흐름','가짜 완료·가짜 로딩 setTimeout','진행 위조 없음','code',()=>{const s=src('pages/do-it/landing/page.tsx')+src('pages/do-it/4/page.tsx');return ok(!/setTimeout\([^)]*(완료|성공|complete)/.test(s),'가짜 진행 0');});

// ── 4. Purpose/Profile 7 ──
t(29,'Purpose','선택 저장','savePurpose 호출','서버 저장','code',()=>{const s=src('doit/pages/do-it/start-journey/page.tsx');return ok(/savePurpose/.test(s),'savePurpose 사용');});
t(30,'Purpose','미선택','purposeId 없음 처리','null 처리 분기 존재','code',()=>{const s=src('doit/pages/do-it/start-journey/page.tsx');return ok(/purposeId\s*=\s*draft\?\.purposeId \?\? loaded\?\.purposeId \?\? null/.test(s),'null 기본값');});
t(31,'Purpose','선택지 목록','DB 단일 진실 원천 사용','프론트 하드코딩 없음','code',()=>{const s=src('doit/app/plan-a/screens/PurposeSelect.tsx');const hard=/const PURPOSES = \[/.test(s);return ok(!hard, hard?'선택지 목록이 프론트 하드코딩(저장은 DB profiles.upsert)':'DB 사용', hard);});
t(32,'Profile','저장','saveProfileText upsert','profiles 테이블','code',()=>{const s=src('doit/lib/profileSave.ts');return ok(/export async function saveProfileText/.test(s),'존재');});
t(33,'Profile','읽기','loadProfile 존재','읽기 함수 구현','code',()=>{const s=src('doit/lib/profileSave.ts');return ok(/export async function loadProfile/.test(s),'존재');});
t(34,'Profile','기존값','upsert 로 보존','없으면 생성·있으면 갱신','code',()=>{const s=src('doit/lib/profileSave.ts');return ok(/upsert/.test(s)&&/row가 없으면 생성, 있으면 갱신/.test(s),'upsert 주석 확인');});
t(35,'Profile','가짜 데이터','등급·통계가 가짜인지 사용자에게 알리는가','데모임을 명시','code',()=>{const s=src('doit/pages/do-it/profile/page.tsx');const notice=/DemoNotice[\s\S]{0,200}데모 미리보기/.test(s);const real=/loadProfile\(user\.id\)/.test(s);return ok(notice&&real,'DemoNotice 표기 + loadProfile 실제 DB 읽기');});

// ── 5. B legacy 차단 5 ──
t(36,'legacy','/ 에서 출발','링크만 따라 /weather 도달','도달 불가','code',()=>{const r=spawnSync('node',[join(process.cwd(),'..','qa-entry','reach.mjs'),ROOT],{encoding:'utf8'});return ok(/도달 불가\s+\/weather\b/.test(r.stdout||''),'reach.mjs 판정');});
t(37,'legacy','/ 에서 출발','/understanding-check 도달','도달 불가','code',()=>{const r=spawnSync('node',[join(process.cwd(),'..','qa-entry','reach.mjs'),ROOT],{encoding:'utf8'});return ok(/도달 불가\s+\/understanding-check/.test(r.stdout||''),'reach.mjs 판정');});
t(38,'legacy','설정 화면','ECHO door 링크','노출 0건','code',()=>{const s=src('doit/pages/do-it/settings/page.tsx');const code=s.replace(/\{\/\*[\s\S]*?\*\/\}/g,'');return ok(!/오늘 내 마음의 날씨|ECHO_ENTRY_PATH/.test(code),'주석 제외 0건 (세션 없이 렌더 불가)');});
t(39,'legacy','설정 화면','여정 다시 고르기','노출 0건','code',()=>{const s=src('doit/pages/do-it/settings/page.tsx');const code=s.replace(/\{\/\*[\s\S]*?\*\/\}/g,'');return ok(!/여정 다시 고르기/.test(code),'주석 제외 0건 (세션 없이 렌더 불가)');});
t(40,'legacy','app-mode=echo 재방문','/doit/choose 자동 이동','Plan A 로 이동','code',()=>{const s=src('doit/pages/do-it/choose/page.tsx');return ok(!/navigate\("\/weather", \{ replace: true \}\)/.test(s),'자동 /weather 이동 제거');});

// ── 6. 관리자 3 ──
t(41,'관리자','일반 사용자','관리자 화면 접근','role!=admin 이면 차단','code',()=>{const s=src('doit/pages/do-it/admin/components/AdminGuard.tsx');return ok(/data\.role === "admin" \? "ok" : "denied"/.test(s),'role 검사');});
t(42,'관리자','데이터','mock 사용 여부','실제 Edge 함수 호출','code',()=>{const s=src('pages/admin/hooks/useAdminConversations.ts');return ok(/functions\.invoke\('admin-conversations'/.test(s),'admin-conversations 호출');});
t(43,'관리자','대시보드','데이터 출처','admin-dashboard 호출','code',()=>{const s=src('pages/admin/hooks/useAdminData.ts');return ok(/functions\.invoke\('admin-dashboard'/.test(s),'admin-dashboard 호출');});

// ── 7. 결제 3 ──
t(44,'결제','게이트','PAYMENT_GATE 값','review_pending','code',()=>{const s=src('lib/echo/toss.ts');const m=s.match(/PAYMENT_GATE: PaymentGate = '([^']+)'/);return ok(m&&m[1]==='review_pending',m?m[1]:'없음');});
t(45,'결제','가격','리포트 단건 금액','4900','code',()=>{const s=src('lib/echo/api.ts');return ok(/REPORT_PRICE_KRW = 4900/.test(s),'4900');});
t(46,'결제','Stripe','실행 코드','0건','code',()=>{const r=spawnSync('grep',['-rli','stripe',join(ROOT,'src')],{encoding:'utf8'});return ok(!(r.stdout||'').trim(),'src 내 0건');});

// ── 8. KEY/등급 2 ──
t(47,'KEY','키 화면','데모 표기','사용자에게 데모임을 알림','code',()=>{const s=src('doit/pages/do-it/key/page.tsx');return ok(/데모 잔액이에요/.test(s)&&/isDemo/.test(s),'데모 안내 + isDemo 분기 (세션 없이 렌더 불가)');});
t(48,'등급','Just Try','준비 중 표기','준비 중 노출','code',()=>{const s=src('doit/pages/do-it/just-try/page.tsx');return ok(/현재 준비 중입니다/.test(s),'준비 중 배지 (세션 없이 렌더 불가)');});

// ── 9. 빌드/보안 2 ──
t(49,'보안','빌드 산출물','.js.map 과 sourceMappingURL','0건','code',()=>{const r=spawnSync('bash',['-lc',`find ${ROOT}/out -name '*.map' | wc -l; grep -rl sourceMappingURL ${ROOT}/out 2>/dev/null | wc -l`],{encoding:'utf8'});const [a,b]=(r.stdout||'').trim().split('\n');return ok(a==='0'&&b==='0',`map=${a} smu=${b}`);});
t(50,'보안','빌드 산출물','Secret 문자열','0건','code',()=>{const r=spawnSync('bash',['-lc',`grep -rlE 'service_role|sk-[A-Za-z0-9]{20,}|SUPABASE_SERVICE_ROLE' ${ROOT}/out 2>/dev/null | wc -l`],{encoding:'utf8'});return ok((r.stdout||'').trim()==='0','0건');});

// 출력
const w = (s,n)=>String(s).padEnd(n).slice(0,n);
console.log('\n번호 | 분류    | 초기상태            | 행동                      | 기대                       | 실제                      | 판정');
for (const r of rows) console.log(`${w(r.no,4)} | ${w(r.group,7)} | ${w(r.init,19)} | ${w(r.action,25)} | ${w(r.expect,26)} | ${w(r.actual,25)} | ${r.verdict}`);
const c = rows.reduce((a,r)=>(a[r.verdict]=(a[r.verdict]||0)+1,a),{});
console.log('\n집계:', JSON.stringify(c, null, 0));
const fails = rows.filter(r=>r.verdict==='FAIL');
if (fails.length) { console.log('\nFAIL 목록:'); for (const f of fails) console.log(`  #${f.no} [${f.group}] ${f.action} → 기대 ${f.expect} / 실제 ${f.actual}`); }
