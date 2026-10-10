// 2026-10-10 Codex 검수(PR #151 댓글 6077064641 「B01/B02/B03」) — 프로필 단계 경계 3건(화면 약속 · 소스 대조).
// B01 직접 소개 보호 · B02 저장 대기 중 입력 잠금 · B03 대표 사진은 서버 확인(ACK) 뒤에만 확정.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BUILD = readFileSync('src/doit/app/plan-a/screens/ProfileBuild.tsx', 'utf8');
const PHOTO = readFileSync('src/doit/app/plan-a/screens/PhotoCapture.tsx', 'utf8');

test('B01 늦게 온 AI 소개는 요청 뒤 직접 쓰거나 지운 글을 덮지 않는다(후보로만)', () => {
  assert.match(BUILD, /const editsAtStart = introEdits\.current;/, '요청 시작 때 편집 번호를 기록');
  assert.match(BUILD, /introRef\.current\.trim\(\) \|\| introEdits\.current !== editsAtStart/, '응답 때 최신 글·편집 여부로 판단');
  assert.doesNotMatch(BUILD, /if \(intro\.trim\(\)\) \{ setDraftState/, '요청 시작 때 값(closure)으로 판단하지 않음');
  assert.match(BUILD, /onChange=\{\(e\) =>\s*editIntro\(e\.target\.value\)/, '직접 입력은 편집 번호를 올린다');
  assert.match(BUILD, /if \(!alive\.current\) return;/, '화면을 떠난 뒤 응답은 적용 0');
});

test('B02 저장 중에는 닉네임·소개·지역·생활 리듬·후보 반영을 잠그고, AI 소개를 만드는 중에는 저장하지 않는다', () => {
  assert.equal((BUILD.match(/readOnly=\{saving\}/g) ?? []).length, 3, '닉네임·소개·지역 입력 잠금');
  assert.match(BUILD, /type="button"\s*disabled=\{saving\}\s*onClick=\{\(\) =>\s*setLifeRhythm\(/, '생활 리듬 버튼 잠금');
  assert.match(BUILD, /disabled=\{saving\}\s*onClick=\{\(\) => \{ editIntro\(draftState\.text\)/, '저장 중 후보 반영 잠금');
  assert.match(BUILD, /if \(saving \|\| drafting\) return;/, 'AI 소개 만드는 중 저장 0');
  assert.match(BUILD, /disabled=\{!canNext \|\| saving \|\| drafting\}/, '저장 버튼도 같은 조건');
});

test('B03 대표 사진: 고르는 중과 확정을 나누고, ACK 성공 뒤 primarySlot 과 saved[].isPrimary 를 함께 바꾼다', () => {
  const fn = PHOTO.slice(PHOTO.indexOf('const choosePrimary'), PHOTO.indexOf('const savePhoto'));
  assert.ok(fn.length > 0);
  assert.doesNotMatch(fn.slice(0, fn.indexOf('await setPrimaryPhoto')), /setPrimarySlot\(slot\)/, 'ACK 전에 확정 대표를 바꾸지 않음');
  assert.match(fn, /setPendingPrimary\(slot\)/, '고르는 중 표시는 따로');
  assert.match(fn, /\} else \{\s*setPrimarySlot\(slot\);\s*setSaved\(\(prev\) => Object\.fromEntries\(Object\.entries\(prev\)\.map\(\(\[k, p\]\) => \[k, \{ \.\.\.p, isPrimary: p\.slot === slot \}\]\)\)/, 'ACK 성공 뒤 대표 1장으로 함께 갱신');
  assert.match(fn, /if \(err\) \{\s*setActionError\("대표 사진을 저장하지 못했어요\. 다시 선택해 주세요\."\);\s*await loadSaved\(\);/, '실패하면 이전 확정 대표 유지 + 다시 불러옴');
  assert.match(PHOTO, /photoSetComplete\(savedList\) &&\s*primarySlot !== null &&\s*Boolean\(saved\[primarySlot\]\)/, '완료 기준(필수 3 + 대표 1) 그대로');
  assert.match(PHOTO, /\{photosComplete \? "프로필 확인하기" : "사진은 나중에 채우고 넘어가기"\}/);
});
