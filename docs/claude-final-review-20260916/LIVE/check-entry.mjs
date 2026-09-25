// 실제 배포 산출물을 브라우저로 열어 '/' 첫 화면에 무엇이 보이는지 검사한다.
// 정적 코드 판단이 아니라 렌더 결과(DOM 텍스트)로 판정한다.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${process.env.PORT || 8899}`;
const FORBIDDEN = ['오늘 내 마음의 날씨는 어때?', '내 마음을 알면, 내가 보인다', '진짜 나를 찾아줘'];
const NAV = ['경험', '기록'];

function render(path, extraArgs = []) {
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--virtual-time-budget=12000', '--run-all-compositor-stages-before-draw',
    '--dump-dom', ...extraArgs, `${BASE}${path}`,
  ], { encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  return r.stdout || '';
}
const textOf = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const results = [];
const add = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

const home = render('/');
const homeText = textOf(home);
console.log('--- / 렌더 결과 앞부분 ---');
console.log(homeText.slice(0, 260));
console.log('--------------------------');

for (const s of FORBIDDEN.slice(0, 2)) {
  const n = (homeText.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  add(`'/' 첫 화면에 "${s}" 없음`, n === 0, `${n}건`);
}
const navHit = NAV.filter((w) => new RegExp(`(^|\\s)${w}(\\s|$)`).test(homeText.slice(0, 400)));
add(`'/' 첫 화면 상단에 예전 홈 내비(경험·기록) 없음`, navHit.length === 0, navHit.join(',') || '0건');
add(`'/' 첫 화면이 Plan A 진입(랜딩 01 구간)`, /당신의 하루|오늘의 발자국/.test(homeText), homeText.slice(0, 60));

// 로그인 복귀 기본값: sessionStorage 에 복귀 경로가 없을 때 어디로 가는가
const cb = render('/auth/callback');
add(`/auth/callback 이 마음 날씨 화면을 그리지 않음`, !/오늘 내 마음의 날씨는 어때\?/.test(textOf(cb)), '');

// 예전 홈은 지워지지 않고 /home 에 남아 있는가(보존 확인)
const legacy = textOf(render('/home'));
add(`예전 홈은 /home 에 보존됨(삭제 아님)`, /진짜 나를 찾아줘|내 마음을 알면/.test(legacy), legacy.slice(0, 50));

const failed = results.filter((r) => !r.pass);
console.log(`\n합계 ${results.length}건 · 통과 ${results.length - failed.length} · 실패 ${failed.length}`);
process.exit(failed.length ? 1 : 0);
