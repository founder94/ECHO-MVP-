// 2026-09-26 대표 「MVP FINAL PATCH」 · 「DO IT MUSIC · MVP FINAL LOCK」 · 「LEGAL / PRIVACY / AUTH」 검사(파일·로직). 실기기·실제 AI 검사가 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const walk = (d) => readdirSync(path.join(root, d)).flatMap((f) => { const p = `${d}/${f}`; return statSync(path.join(root, p)).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) ? [p] : []; });
const load = async (rel, name) => {
  const js = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const file = path.join(mkdtempSync(path.join(tmpdir(), name)), `${name}.mjs`); writeFileSync(file, js); return import(pathToFileURL(file).href);
};

test('Voice DEFERRED_MVP: 음성 UI 꺼짐 · 시작은 [대화 시작하기] 하나 · 키보드 마이크 문구 0건(src 전체)', () => {
  assert.match(read('src/doit/lib/agentChoice.ts'), /export const VOICE_CONVERSATION_ENABLED = false;/);
  const layer = read('src/doit/components/feature/AgentChoiceLayer.tsx');
  assert.match(layer, /: <div className="echo-choice-starts">\s*<button type="button" className="echo-choice-confirm" onClick=\{\(\) => go\('TEXT'\)\}>대화 시작하기<\/button>/);
  const hits = walk('src').filter((f) => /키보드의 마이크|키보드 마이크|키보드의 받아쓰기|키보드 받아쓰기와/.test(read(f)));
  assert.deepEqual(hits, [], `키보드 마이크 문구: ${hits.join(', ')}`);
  assert.doesNotMatch(read('src/lib/legal/documents.ts'), /키보드/);
  const ui = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(ui, /const voiceUi = VOICE_CONVERSATION_ENABLED && session\.mode === 'VOICE';/);
  assert.match(ui, /mode: VOICE_CONVERSATION_ENABLED \? choice\.mode : 'TEXT'/, '예전 「말로」 선택이 남아 있어도 글로 시작');
  assert.match(ui, /if \(!VOICE_CONVERSATION_ENABLED \|\| /, '소리로 읽기 0');
});

test('AI 고지: 대화 시작 전 · 프로필 초안', () => {
  assert.match(read('src/doit/components/feature/AgentChoiceLayer.tsx'), /이 대화는 AI가 함께합니다\./);
  assert.match(read('src/doit/components/feature/AgentProfileCheck.tsx'), /ECHO가 대화를 바탕으로 작성한 초안이에요\./);
});

test('ECHO가 이해한 나: 다섯 칸 · [맞아요]/[조금 달라요]/[다시 말할게요] · 한 칸만 고침 · 재확인 · 뜻을 화면이 만들지 않음', () => {
  const c = read('src/doit/components/feature/AgentProfileCheck.tsx');
  for (const t of ['>맞아요<', '>조금 달라요<', '>다시 말할게요<', '어느 부분이 다른가요?', '이렇게 이해하면 맞을까요?', '>다시 고칠게요<']) assert.ok(c.includes(t), t);
  assert.match(c, /const ORDER = Object\.keys\(AGENT_PURPOSE_LABELS\);/);
  assert.match(c, /agentTurn\(userId, session\.id, t\)/, '고친 말은 같은 대화 서버(정정 엔진)로');
  assert.match(c, /「\$\{AGENT_PURPOSE_LABELS\[view\.purpose\]\}」 부분을 고칠게요\. \$\{view\.text\.trim\(\)\}/);
  assert.match(c, /slot\?\.status === 'SKIPPED' \? '넘겼어요' : '아직 말하지 않았어요'/, 'UNKNOWN 을 억지로 채우지 않는다');
  assert.equal((read('src/doit/components/feature/AgentConversation.tsx').match(/<AgentProfileCheck /g) ?? []).length, 1);
  assert.match(read('src/doit/components/feature/AgentConversation.tsx'), /\{!done && <form className="echo-composer"/, '끝난 뒤 입력칸은 확인 카드 한 곳');
});

test('정정 서버 반영(가짜 AI 출력 · v2.2 정정 엔진): 한 칸 고침 → 옛 뜻 SUPERSEDED · 새 뜻 USER_CORRECTED · 매칭 프로필은 새 뜻만', async () => {
  const A = await load('supabase/functions/doit-agent/agent.ts', 'agent-mvp');
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '연락은 자주 하는 게 좋아요', { kind: 'answer', understood: '', reply: '좋아요.', extracted: [{ purpose: 'relationship_style', note: '연락 자주', quote: '연락은 자주 하는 게 좋아요' }], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' } });
  st.phase = 'done'; st.current = null;
  const fix = '「알아가는 방식과 속도」 부분을 고칠게요. 천천히 연락하면서 알아가고 싶어요';
  const llm = async () => JSON.stringify({ kind: 'correction', understood: '', reply: '천천히 알아가는 쪽으로 고쳐 둘게요.', extracted: [{ purpose: 'relationship_style', note: '천천히 알아가기', quote: '천천히 연락하면서 알아가고 싶어요' }], inferred: [], declared: null, wrong: ['연락 자주'], next: { type: 'none', purpose: '', question: '' } });
  const r = await A.runTurn(st, fix, llm);
  assert.equal(r.response.after, true); assert.equal(r.response.question, null, '정정 때문에 새 질문 0');
  const items = st.slots.relationship_style.items;
  assert.ok(items.some((i) => i.note === '연락 자주' && i.status !== 'CONFIRMED'), '옛 뜻은 활성에서 빠진다');
  const fresh = items.find((i) => i.note === '천천히 알아가기');
  assert.equal(fresh.status, 'CONFIRMED'); assert.equal(fresh.source_type, 'USER_CORRECTED');
  const p = A.matchingProfile(st);
  assert.deepEqual(p.relationship_style.items.map((i) => i.note), ['천천히 알아가기']);
  assert.ok(!p.confirmed_preferences.includes('연락 자주'), '정정 전 값 재사용 0');
  assert.equal(st.turns.at(-1).user, fix, '사용자 원문 보존');
});

test('DO IT MUSIC: 첫 화면 플레이어 제거 · 음원 주소 보존 · [맞아요] 뒤에만 · 누를 때만 재생 · 가사는 실제 원문만(없으면 줄 0)', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.doesNotMatch(landing, /OriginalMusicCard/);
  const uses = walk('src').filter((f) => !f.endsWith('OriginalMusicCard.tsx') && /OriginalMusicCard/.test(read(f)));
  assert.deepEqual(uses, [], '어디서도 일반 플레이어를 쓰지 않는다');
  const music = read('src/lib/doitMusic.ts');
  assert.equal((music.match(/storage\.helloreaddy\.io\/project_files\/[^']+\.mp3/g) ?? []).length, 2, '실제 음원 2곡 주소 보존');
  assert.match(music, /export const MOMENT_LYRIC: string \| null = null;/, '가사 원문 MISSING — 만들지 않는다');
  const m = read('src/doit/components/feature/MusicMoment.tsx');
  assert.doesNotMatch(m, /autoplay|useEffect\([^)]*play\(/);
  assert.match(m, /onClick=\{play\}/); assert.match(m, /onClick=\{stop\}/); assert.match(m, /onClick=\{skip\}>지금은 괜찮아요/);
  assert.match(m, /\{MOMENT_LYRIC && <p/);
  const ui = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(ui, /\{done && \(profileOk \|\| !profile\) && <MusicMoment \/>\}/);
  assert.match(ui, /\{introChosen && <button className="echo-primary" disabled=\{!!busy\} onClick=\{onContinue\}>사진 채우러 가기/, '다음 단계는 음악과 상관없이');
});

test('사진 AI 판별 DEFERRED_MVP: 호출 0 · 화면이 AI 판별을 약속하지 않음', () => {
  assert.match(read('src/doit/lib/photoPolicy.ts'), /export const PHOTO_AI_CHECK_ENABLED = false;/);
  const cap = read('src/doit/app/plan-a/screens/PhotoCapture.tsx');
  assert.match(cap, /if \(!userId \|\| !PHOTO_AI_CHECK_ENABLED\) return;/);
  assert.match(cap, /사진은 AI가 따로 판별하지 않아요/);
  assert.match(read('src/doit/lib/recentPhoto.ts'), /사진 정보에 적힌 촬영 날짜가/);
});

test('전화 인증 DEFERRED_MVP: 준비 전에는 번호 입력·문자 버튼 0 · 한 곳의 값', () => {
  assert.match(read('src/doit/lib/phoneVerify.ts'), /export const PHONE_VERIFY_READY = false;/);
  const v = read('src/doit/pages/do-it/verify/page.tsx');
  assert.match(v, /\{!PHONE_VERIFY_READY \? <>/);
  assert.match(read('src/doit/components/feature/AsleepConnections.tsx'), /import \{ PHONE_VERIFY_READY \} from '@\/doit\/lib\/phoneVerify';/);
});

test('정책: 로그인 전 링크 · 공개 경로 · 최종 변경일 · 지금 없는 기능을 제공한다고 쓰지 않음 · 판 번호 그대로', () => {
  assert.match(read('src/pages/login/page.tsx'), /to="\/legal\/terms"[\s\S]{0,300}to="\/legal\/privacy"/);
  assert.match(read('src/lib/legal/gatePaths.ts'), /'\/legal'/);
  const d = read('src/lib/legal/documents.ts');
  assert.match(d, /export const LEGAL_VERSION = 'v1\.0';/);
  assert.match(d, /export const LEGAL_UPDATED_DATE = '2026-09-26';/);
  assert.match(read('src/pages/legal/LegalDocument.tsx'), /최종 변경 \{LEGAL_UPDATED_DATE\}/);
  assert.match(d, /말로 대화하기: 지금은 제공하지 않습니다/);
  assert.match(d, /지금은 사진을 AI로 판별하지 않습니다/);
  assert.match(d, /「ECHO가 이해한 나」/);
});

test('로그인 실패 문구: 영어 원문 대신 한국어', async () => {
  const { authErrorText } = await load('src/lib/auth/authErrorText.ts', 'auth-text');
  assert.equal(authErrorText('Invalid login credentials'), '이메일 또는 비밀번호가 맞지 않아요.');
  assert.match(authErrorText('Email not confirmed'), /이메일 인증을 먼저/);
  assert.match(authErrorText('User already registered'), /이미 가입된/);
  assert.equal(authErrorText('Some unknown English error'), '로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  assert.equal(authErrorText('네트워크 연결을 확인해 주세요.'), '네트워크 연결을 확인해 주세요.');
});
