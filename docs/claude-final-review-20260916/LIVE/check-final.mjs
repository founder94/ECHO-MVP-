// FINAL 렌더 검증: 실제 배포 산출물을 브라우저로 열어 화면에 보이는 텍스트로 판정한다.
import { spawnSync } from 'node:child_process';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${process.env.PORT || 8899}`;
function dom(path) {
  const r = spawnSync(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
    '--virtual-time-budget=12000','--run-all-compositor-stages-before-draw','--dump-dom', `${BASE}${path}`],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 64*1024*1024 });
  return r.stdout || '';
}
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<style[\s\S]*?<\/style>/g,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const R = [];
const check = (id, name, pass, detail='') => { R.push({id,name,pass,detail}); console.log(`${pass?'PASS':'FAIL'}  ${id} ${name}${detail?' — '+detail:''}`); };

const home = text(dom('/'));
console.log('\n[/ 첫 화면 렌더 텍스트]\n' + home.slice(0,200) + '\n');
check('R-01','/ 에 "오늘 내 마음의 날씨는 어때?" 0건', !/오늘 내 마음의 날씨는 어때\?/.test(home));
check('R-02','/ 에 "내 마음을 알면, 내가 보인다" 0건', !/내 마음을 알면, 내가 보인다/.test(home));
check('R-03','/ 상단에 예전 홈 내비(ECHO·경험·기록) 0건', !/ECHO 경험 기록/.test(home));
check('R-04','/ 가 Plan A 랜딩 01 구간', /01 — 당신의 하루|오늘의 발자국/.test(home), home.slice(0,40));
check('R-05','/ 에 날씨 선택 UI 없음', !/맑음|흐림|비\s|눈\s/.test(home.slice(0,400)));

const four = text(dom('/do-it/4'));
check('R-06','/do-it/4 에 "여정 다시 고르기" 버튼 0건', !/여정 다시 고르기/.test(four), four.slice(-60));
check('R-07','/do-it/4 에 "시작하기" 버튼 유지', /시작하기/.test(four));

const settings = text(dom('/doit/settings'));
check('R-08','설정에 "오늘 내 마음의 날씨는 어때?" 링크 0건', !/오늘 내 마음의 날씨는 어때\?/.test(settings));
check('R-09','설정에 "여정 다시 고르기" 링크 0건', !/여정 다시 고르기/.test(settings));

const legacy = text(dom('/home'));
check('R-10','예전 홈은 /home 에 보존(삭제 아님)', /진짜 나를 찾아줘|내 마음을 알면/.test(legacy));
const weather = text(dom('/weather'));
check('R-11','/weather 는 주소창 직접 입력 시에만 열리는 legacy 로 남아 있음', weather.length > 0, weather.slice(0,40));

const fail = R.filter(r=>!r.pass);
console.log(`\n렌더 검사 ${R.length}건 · 통과 ${R.length-fail.length} · 실패 ${fail.length}`);
process.exit(fail.length?1:0);
