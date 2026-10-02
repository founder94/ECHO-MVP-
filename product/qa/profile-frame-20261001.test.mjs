// 2026-10-01 대표 「PROFILE / PHOTO REVEAL / SCENES · FINAL」 — 서버 공개 계약 고정 + ECHO FRAME 화면 계약.
// 원칙: 서버가 클라이언트에 무엇이 있는지 정하고, 화면은 보이는 모습만 정한다. 공개 전 사진·정보는 화면에 오지 않는다.
// 화면 동작(P1·P3·P7~P13·P15·P17·P21~P24)은 qa-browser/ux-flow.mjs 42~49, Hide/Block/Report(P18~P20)는 17~19.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const here = (p) => new URL(p, import.meta.url).pathname;
const read = (p) => readFileSync(here(p), 'utf8');
const SERVER = read('../supabase/functions/doit-connect/index.ts');
const UI = read('../src/doit/components/feature/ConnectionMatches.tsx');
const FRAME = read('../src/doit/components/feature/PartnerFrame.tsx');
const CSS = read('../src/doit/components/feature/partner-frame.css');
const dir = mkdtempSync(path.join(tmpdir(), 'frame-'));
const out = path.join(dir, 'partnerFrame.mjs');
writeFileSync(out, ts.transpileModule(read('../src/doit/lib/partnerFrame.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { frameSentence } = await import(pathToFileURL(out).href);
const block = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start) + start.length));

test('서버 계약: 후보(당신이 잠든 사이)에는 상대 정보가 하나도 없다(이름·사진·소개·id 0)', () => {
  const c = block(SERVER, 'if (action === "my_candidates")', 'if (action === "choose")');
  assert.match(c, /out\.push\(\{ id: c\.id, created_at: c\.created_at, purpose: me\?\.purposeLabel \?\? null, reasons: reasonsFor\(c, userId, me\?\.purposeLabel \?\? null, me\?\.confirmed \?\? \[\]\), my_choice: mine, waiting: mine === "yes" \}\);/);
  assert.doesNotMatch(c, /photo|nickname|bio|partnerId[,}]|createSignedUrl/, '후보 응답에 상대 정보·사진 주소 0');
});

test('서버 계약: 연결은 둘 다 첫 질문에 답한 뒤(revealed)에만 상대 이름·사진·소개를 보낸다 · 사진은 10분 서명 주소', () => {
  const m = block(SERVER, 'if (action === "my_matches")', 'if (action === "my_turns")');
  assert.match(m, /let revealed = open && !!mine && !!theirs && consent\.get\(userId\)\?\.consented === true && consent\.get\(partnerId\)\?\.consented === true;/);
  assert.match(m, /if \(revealed\) \{[\s\S]*primaryPhotoUrl\(admin, partnerId\)[\s\S]*item\.partner = \{/, '상대 정보는 revealed 블록 안에서만 만든다');
  assert.doesNotMatch(m.slice(0, m.indexOf('if (revealed) {')), /partner\s*[:=]|photo_url|primaryPhotoUrl/, '공개 전 응답에는 partner·사진 주소 0');
  assert.match(SERVER, /SIGNED_URL_SECONDS: 600/);
  assert.match(SERVER, /createSignedUrl\(String\(pick\.storage_path\), LIMITS\.SIGNED_URL_SECONDS\)/, '비공개 저장소 · 서명 주소만(공개 주소 0)');
});

test('화면 계약: FRAME 은 서버가 공개한 상대만 그린다 · 흐림·가리기로 숨기는 사진 0', () => {
  assert.match(UI, /\{match\.revealed && match\.partner && <PartnerFrame matchId=\{match\.id\} partner=\{match\.partner\} onRetry=\{\(\) => void onChanged\(\)\} \/>\}/);
  assert.equal((UI.match(/<img /g) ?? []).length, 0, '연결 화면에 다른 사진 태그 0');
  assert.equal((FRAME.match(/<img /g) ?? []).length, 1, 'FRAME 사진은 서버가 준 photo_url 하나뿐');
  assert.match(FRAME, /<img src=\{partner\.photo_url\}/);
  // 흐림은 처음 한 번 장면 진입(공개된 사진이 또렷해지는 움직임)에만 — 공개 전 사진을 가리는 규칙은 없다
  const blurs = CSS.match(/blur\([^)]*\)/g) ?? [];
  assert.deepEqual(blurs, ['blur(6px)']);
  assert.match(CSS, /@keyframes echo-frame-focus\{from\{opacity:0;filter:blur\(6px\)/);
  assert.doesNotMatch(CSS, /mask|clip-path|backdrop-filter/);
});

test('화면 계약: FILM 기억은 표시용만(공개 권한 흉내 0) · 처음 한 번 · 움직임 줄이기', () => {
  assert.match(FRAME, /const FILM_KEY = \(matchId: string\) => `echo:frame-film:\$\{matchId\}`;/);
  assert.equal((FRAME.match(/localStorage/g) ?? []).length, 2, 'localStorage 는 FILM 표시 기억 읽기·쓰기 두 곳뿐');
  assert.doesNotMatch(FRAME.replace(/\/\/.*$/gm, ''), /revealed|reveal_level|unlock/i, '화면이 공개 단계를 만들지 않는다(주석 제외)');
  assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{\s*\.doit-partner-frame\[data-film\]/);
});

test('한 문장 = 상대가 직접 쓴 말(소개 첫 문장 → 없으면 첫 질문의 답) · 길면 줄임 · AI 문장 0', () => {
  assert.equal(frameSentence({ bio: '주말엔 동네를 오래 걸어요. 조용한 카페도 좋아하고요.', answer: '저녁에 산책할 때요.' }), '주말엔 동네를 오래 걸어요.');
  assert.equal(frameSentence({ bio: '', answer: '저녁에 산책할 때요.' }), '저녁에 산책할 때요.');
  assert.equal(frameSentence({ bio: '', answer: '' }), '');
  const long = frameSentence({ bio: '가'.repeat(80), answer: '' });
  assert.ok(long.length <= 59 && long.endsWith('…'));
  assert.match(FRAME, /\{partner\.nickname\} · \{fromAnswer \? '첫 질문에 쓴 답' : '직접 쓴 소개'\}/, '누가 쓴 말인지 밝힌다');
});

test('내부 65/35 · 퍼센트 · 잠김 문구 사용자 노출 0 · 좋아요/패스 0 · 가짜 사람 그림 0', () => {
  for (const src of [FRAME, UI]) {
    assert.doesNotMatch(src.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, ''), /65|35%|\d+\s*%|잠김|Unlock|좋아요 누르|Pass|Like/);
  }
  assert.doesNotMatch(FRAME, /https?:\/\/|\.(jpg|png|webp)['"]/, '화면이 사람 사진을 직접 넣지 않는다(서버 주소만)');
});
