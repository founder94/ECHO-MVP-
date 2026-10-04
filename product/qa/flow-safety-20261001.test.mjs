// 2026-10-01 대표 「COMPLETE PRODUCT FLOW」·「FINAL PRODUCT」·「SAFETY LAYER」 — 화면 원본 계약.
// 서버 쪽(신고 사유 · 후보 차단·신고 · 멱등)은 qa/connect-server.test.mjs 「v2.1 안전」, 화면 동작은 qa-browser/ux-flow.mjs 50~.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const SERVER = read('supabase/functions/doit-connect/index.ts');
const API = read('src/doit/lib/connectApi.ts');
const CAND = read('src/doit/components/feature/ConnectionCandidates.tsx');
const MATCH = read('src/doit/components/feature/ConnectionMatches.tsx');
const Z = read('src/doit/components/feature/ZzaritMoment.tsx');
const ZCSS = read('src/doit/components/feature/zzarit.css');
const SET = read('src/doit/pages/do-it/settings/page.tsx');
const MENU = read('src/components/AppCornerMenu.tsx');

test('신고 사유 6개: 화면 = 서버(코드·한국어 같음 · 순서 같음)', () => {
  const server = [...SERVER.match(/export const REPORT_REASONS[^{]*\{([^}]*)\}/)[1].matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]);
  const client = [...API.match(/export const REPORT_REASONS[^=]*= \[([\s\S]*?)\];/)[1].matchAll(/\['(\w+)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(client, server);
  assert.deepEqual(client.map((c) => c[1]), ['불쾌한 대화', '사기·금전 요구', '허위 정보', '위협·강요', '스팸', '기타']);
});

test('「접수했어요」는 서버가 reported=true 라고 답할 때만 · 응답 해석은 true 만 인정', () => {
  assert.match(API, /blocked: out\.blocked === true, reported: out\.reported === true/);
  assert.match(CAND, /setNotice\(out\.reported \? '접수했어요\./);
  assert.match(MATCH, /onSafety\(out\.reported \? '접수했어요\./);
  for (const s of [CAND, MATCH]) assert.equal((noComments(s).match(/접수했어요/g) ?? []).length, 1, '다른 조건에서 접수 문구 0');
});

test('ZZARIT: 서버 mutual + match_id 뒤에만 · 그 연결에서 한 번만(새로고침 재생 0) · 기다리던 사람은 via_mutual 일 때만', () => {
  assert.match(CAND, /if \(typeof out\.match_id === 'string'\) \{ if \(claimZzarit\(out\.match_id\)\) setMutual/);
  assert.match(MATCH, /useState\(\(\) => match\.status === 'open' && match\.via_mutual === true && !match\.my_answer && claimZzarit\(match\.id\)\)/);
  const z = read('src/doit/lib/zzarit.ts');
  assert.match(z, /export const ZZARIT_KEY = \(matchId: string\) => `echo:zzarit:\$\{matchId\}`;/);
  assert.match(z, /if \(localStorage\.getItem\(ZZARIT_KEY\(matchId\)\)\) return false;\s*localStorage\.setItem\(ZZARIT_KEY\(matchId\), '1'\);/);
});

test('찌릿 연출(2026-10-04 대표): 문구 3개 · 두 익명 노드 사이 청록·흰색 전류 0.6~0.9초 한 번 · 반복·번쩍임 0 · 하트·폭죽·네온 0 · 움직임 줄이기 = 정적 연결선 · 상대 정보 0', () => {
  for (const t of ["title: '찌릿! 텔레파시가 통했어요'", "body: '서로 대화를 원했어요.'", "next: '다음 단계 보기'"]) assert.ok(Z.includes(t), t);
  assert.doesNotMatch(noComments(Z + ZCSS), /heart|하트|confetti|폭죽|neon|🎉|💖|❤/i);
  assert.doesNotMatch(ZCSS, /infinite/, '반복 0');
  const cur = ZCSS.match(/\.echo-zzarit-current\{[^}]*animation:echo-zz-current ([.\d]+)s [^ ]+ ([.\d]+)s both\}/);
  assert.ok(cur, '전류 한 번');
  assert.ok(Number(cur[1]) >= 0.6 && Number(cur[1]) <= 0.9, `전류 길이 ${cur[1]}s`);
  assert.match(ZCSS, /#7ff3e6/, '청록'); assert.match(ZCSS, /#ffffff/, '흰색');
  for (const k of ZCSS.matchAll(/@keyframes [\w-]+\{([^@]*?)\}\}/g)) assert.doesNotMatch(k[1], /width|height|top|left:|margin|filter/, '움직임은 opacity·transform 만');
  assert.match(ZCSS, /@media\(prefers-reduced-motion:reduce\)\{[^@]*animation:none/);
  assert.match(Z, /if \(!reduce\) \{ try \{ navigator\.vibrate\?\.\(12\); \}/, '진동은 짧게 · 줄이기 설정이면 0');
  assert.doesNotMatch(Z, /Audio|\.play\(/, '소리 0');
  assert.doesNotMatch(Z, /nickname|photo_url|partner|\bbio\b|<img/, '익명 노드(상대 사진·이름 0)');
  assert.doesNotMatch(Z, /setTimeout\([^)]*focus/, '다음 버튼은 연출을 기다리지 않음');
  assert.doesNotMatch(Z, /nickname|photo|partner|bio/, '상대 정보 0');
});

test('안전 문구: 정해진 세 문장 · 「완벽하게 보호」 같은 약속 0', () => {
  const all = CAND + MATCH + SET;
  assert.ok(MATCH.includes('불편하면 언제든 나갈 수 있어요.'));
  assert.ok(MATCH.includes('정확한 위치는 상대에게 보이지 않아요.'));
  assert.ok(/차단하면 다시 추천되지 않아요/.test(CAND) && /차단하면 다시 추천되지 않아요/.test(MATCH));
  assert.doesNotMatch(all, /완벽하게 보호|100% 안전|절대 안전/);
});

test('2~3번 안에: 후보 숨기기 1 · 차단 2 · 신고 3(불편해요 → 신고할게요 → 사유) · 연결 신고 3(그만하기 → 신고할게요 → 사유) · 신고와 차단은 별도', () => {
  assert.match(CAND, /onClick=\{\(\) => void choose\(c, 'hide'\)\}>\{CHOICE_LABEL\.hide\}/);
  assert.match(CAND, /setSafety\(\{ id: candidate\.id, step: 'menu' \}\)\}>불편해요 · 차단 · 신고/);
  assert.match(CAND, /void protect\(candidate, true\)\}>차단할게요/);
  assert.match(CAND, /void protect\(candidate, alsoBlock, code\)\}>\{label\}/);
  for (const src of [CAND, MATCH]) assert.match(src, /<input type="checkbox" checked=\{alsoBlock\} onChange=\{e => setAlsoBlock\(e\.target\.checked\)\}[^>]*\/> 차단도 함께 하기/, '신고할 때 차단은 고를 수 있다');
  assert.doesNotMatch(CAND + MATCH, /신고하면 차단도 함께 돼요|차단도 함께 돼요/, '신고가 차단을 강제하지 않는다');
  assert.match(MATCH, /setLeaving\('menu'\)\} disabled=\{busy\}>이 연결 그만하기/);
  assert.match(MATCH, /void leave\(alsoBlock, true, code\)\} disabled=\{busy\}>\{label\}/);
  assert.match(CAND, /CHOICE_LABEL\.yes/); assert.match(CAND, /yes: '이어지고 싶어요', no: '이번에는 넘길게요'/);
});

test('만나기 전 안내: 「약속했어요」 뒤 + 이야기 화면에서도 언제든 · 짧고 실용적 · 위험한 행동 권유 0', () => {
  assert.match(MATCH, /\{value\.met === 'planned' && <div className="doit-meet-safety"/);
  assert.match(MATCH, /<details className="doit-meet-safety doit-meet-safety--peek"><summary>만나기 전 안전 안내<\/summary><MeetSafetyList \/><\/details>/);
  const tips = MATCH.slice(MATCH.indexOf('const MEET_SAFETY'), MATCH.indexOf('];', MATCH.indexOf('const MEET_SAFETY')));
  assert.ok((tips.match(/'/g) ?? []).length / 2 <= 4);
  assert.doesNotMatch(tips, /술|집으로|숙소|밤늦게|차에 타|확인된 사람|안전한 상대|인증/);
});

test('ECHO 사용법: 메뉴에서 바로 · 실제 기능만(KEY·미션·72시간·보상·가격 0) · 항목마다 3~5문장', () => {
  assert.match(MENU, /\{ label: 'ECHO 사용법', desc: '기능과 안전, 짧게', to: '\/doit\/settings#guide' \}/);
  assert.match(SET, /hash === "#guide"/);
  const guide = SET.slice(SET.indexOf('const GUIDE'), SET.indexOf('];', SET.indexOf('const GUIDE')));
  assert.doesNotMatch(guide, /KEY|키 |미션|72|보상|리워드|\d[\d,]*\s*원|결제|함께 나가기|궁합|%/);
  for (const m of guide.matchAll(/a: '([^']+)'/g)) {
    const n = m[1].split(/(?<=[.요])\s+/).filter(Boolean).length;
    assert.ok(n >= 3 && n <= 5, `${n}문장: ${m[1].slice(0, 20)}`);
  }
  assert.ok(guide.includes('안전하게 쓰기'));
});

test('zzarit.ts 동작: 처음 true · 두 번째 false · 저장이 막혀도 한 번은 true', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zz-'));
  const out = path.join(dir, 'z.mjs');
  writeFileSync(out, ts.transpileModule(read('src/doit/lib/zzarit.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const { claimZzarit } = await import(pathToFileURL(out).href);
  assert.equal(claimZzarit('m1'), true); assert.equal(claimZzarit('m1'), false); assert.equal(claimZzarit('m2'), true);
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(claimZzarit('m3'), true);
  delete globalThis.localStorage;
});
