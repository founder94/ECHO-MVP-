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

// 2026-10-10 대표 「모바일웹 전부 최종 후킹 · Lattice 효과 넣어라」: 2026-10-04 전류 연출 → Einstein–Rosen Lattice(빛의 통로). 문구는 2026-10-09 「추가 효과 배치」 §2 확정본.
test('찌릿 연출: 확정 문구 4개 · 가운데 두 구슬(B안) 하나 · 움직임 줄이기 = 멈춘 한 장 · 하트·폭죽·네온·소리 0 · 상대 정보 0', () => {
  for (const t of ["eyebrow: '찌릿! 텔레파시가 통했어요'", "title: ['서로의 선택이,', '하나의 대화로.']", "body: '두 분 모두 연결을 선택했어요.'", "next: '첫 대화 시작하기'"]) assert.ok(Z.includes(t), t);
  assert.doesNotMatch(noComments(Z + ZCSS), /heart|하트|confetti|폭죽|neon|🎉|💖|❤/i);
  assert.doesNotMatch(ZCSS, /infinite|@keyframes/, '이 화면 CSS 움직임 0(움직임은 Lattice 하나)');
  // 2026-10-10 대표 「B로 채택」: 가운데 = Storm 두 구슬 + 전류(FxStage storm-pair) 하나
  assert.equal((Z.match(/<FxStage /g) ?? []).length, 1);
  assert.match(Z, /<FxStage fx="storm-pair" className="echo-zzarit-stage" \/>/);
  assert.doesNotMatch(Z, /delayMs/, '찌릿은 기다림이 아님 — 바로 보인다');
  // 순서: 위 글 → 가운데 효과 → 아래 버튼(글·버튼이 효과 위에 겹치지 않음)
  const order = ['echo-zzarit-eyebrow', 'echo-zzarit-title', 'echo-zzarit-body', '<FxStage', 'echo-zzarit-cta'].map((k) => Z.indexOf(k));
  assert.deepEqual([...order].sort((x, y) => x - y), order);
  const stage = read('src/doit/fx/FxStage.tsx');
  assert.match(stage, /case "storm-pair": return import\("\.\/storm"\)/, '엔진은 이 화면이 열릴 때만 불러온다');
  assert.match(stage, /sceneShouldFreeze\(readTier\(\)\) \? "still" : "live"/, '움직임 줄이기·절전 = 멈춘 한 장');
  assert.match(stage, /state === "failed" \? <div className="doit-fx-fallback" \/> : <canvas/, 'WebGL 실패 = 은은한 빛만 · 화면은 그대로');
  assert.match(read('src/doit/fx/house.ts'), /const want = !halted && !still && !document\.hidden && inView;/, '화면 밖·탭 숨김이면 멈춤');
  assert.match(Z, /if \(!reduce\) \{ try \{ navigator\.vibrate\?\.\(12\); \}/, '진동은 짧게 · 줄이기 설정이면 0');
  assert.doesNotMatch(Z, /Audio|\.play\(/, '소리 0');
  assert.doesNotMatch(Z, /nickname|photo_url|partner|\bbio\b|<img/, '상대 사진·이름 0');
  assert.doesNotMatch(Z, /setTimeout\([^)]*focus/, '다음 버튼은 연출을 기다리지 않음');
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

test('이용 안내(옛 ECHO 사용법 · 2026-10-04 통합): 메뉴에서 그 자리에 열기 · 실제 기능만(미션·72시간·보상·가격 0) · KEY 는 「준비 중」만 · 항목마다 3~5문장', () => {
  assert.match(MENU, /\{ label: '이용 안내', desc: '처음 쓰는 법 · 궁금한 기능', to: '\/doit\/settings#guide', guide: true \}/);
  assert.match(MENU, /if \('guide' in item && item\.guide && !e\.metaKey && !e\.ctrlKey\) \{ e\.preventDefault\(\); openGuide\(undefined, cornerButton\.current\); \}/, '화면 이동 없이 안내 창(닫으면 메뉴 버튼으로 초점)');
  assert.match(SET, /hash === "#guide"/);
  assert.match(SET, /GUIDE_SECTIONS\.map\(item =>/, '설정 #guide 도 같은 내용 한 벌');
  const content = read('src/lib/guide/content.ts');
  const guide = content.slice(content.indexOf('export const GUIDE_SECTIONS'), content.indexOf('];', content.indexOf('export const GUIDE_SECTIONS')));
  const sections = guide.split(/\n  \{\n/).slice(1);
  assert.equal(sections.length, 9);
  for (const sec of sections) {
    const isKey = /id: 'key'/.test(sec);
    assert.doesNotMatch(sec, isKey ? /미션|72|보상|리워드|\d[\d,]*\s*원|\d+\s*개|결제|함께 나가기|궁합|%/ : /KEY|키 |미션|72|보상|리워드|\d[\d,]*\s*원|결제|함께 나가기|궁합|%/, sec.slice(0, 40));
    if (isKey) { assert.match(sec, /soon: true/); assert.match(sec, /준비 중/); }
    const body = sec.match(/body: '([^']+)'/)[1];
    const n = body.split(/(?<=[.요])\s+/).filter(Boolean).length;
    assert.ok(n >= 3 && n <= 5, `${n}문장: ${body.slice(0, 20)}`);
  }
  assert.ok(guide.includes("label: '안전하게 이용하기'"));
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

test('연결 화면: 후보 화면을 key 로 다시 만들지 않는다(끝없이 다시 조회하던 결함 2026-10-04) · 「후보 열기」 뒤 다시 읽기는 reload 값으로', () => {
  const A = read('src/doit/components/feature/AsleepConnections.tsx');
  assert.match(A, /<ConnectionCandidates reload=\{candidatesKey\} userId=\{user\.id\}/);
  assert.doesNotMatch(A, /<ConnectionCandidates key=/);
  const C = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(C, /useEffect\(\(\) => \{ void refresh\(reload > 0\); \}, \[refresh, reload\]\);/);
  // 다시 읽기 실패 = 지난 목록 유지 + 실패 알림 + 다시 확인(Codex PR #122)
  assert.match(C, /if \(!shown\.current\) setLoad\(\{ kind: 'error'[^\n]*\n\s*else if \(explicit\) setStale\(true\);/);
  assert.match(C, /\{stale && <div className="doit-connect-stale"><p className="doit-product-error" role="alert">새 후보를 불러오지 못했어요\./);
});
