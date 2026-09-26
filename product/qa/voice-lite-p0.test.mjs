// 2026-09-26 대표 실기기 P0 UX FIX 검사(파일·로직 검사). 실제 마이크·실제 아이폰/갤럭시 소리 검사가 아니다 — 실기기 VOICE 판정은 대표 확인 전 「확인 불가」.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ui = read('src/doit/components/feature/AgentConversation.tsx');
const layer = read('src/doit/components/feature/AgentChoiceLayer.tsx');
const out = read('src/doit/lib/voiceOutput.ts');
const input = read('src/doit/lib/voiceInput.ts');

test('VOICE_MODE_FALSE_PROMISE: 「말로 시작하기」가 키보드 받아쓰기로 보내지 않는다', () => {
  for (const f of [ui, layer]) assert.doesNotMatch(f, /키보드의 마이크|키보드 마이크/);
  assert.match(layer, /disabled=\{!voiceOk\} onClick=\{\(\) => go\('VOICE'\)\}/, '말 듣기를 못 하는 브라우저면 말로 시작하기를 막는다(되는 척 0)');
  assert.match(layer, /이 브라우저는 말 듣기를 지원하지 않아/);
});

test('Voice Lite: 네 가지 상태 · 마이크가 주 행동 · 들은 말은 같은 send(같은 서버·같은 기억)로', () => {
  for (const s of ["idle: ['대기'", "listening: ['듣는 중'", "thinking: ['이해하는 중'", "speaking: ['ECHO가 말하는 중'"]) assert.ok(ui.includes(s), s);
  assert.match(ui, /const onHeard = useCallback\(\(text: string\) => sendRef\.current\(text\.slice\(0, TEXT_MAX\), true\), \[\]\);/);
  assert.match(ui, /agentTurn\(userId, session\.id, t\.slice\(0, TEXT_MAX\)\)/, 'TEXT·VOICE 가 같은 agentTurn 하나');
  assert.equal((ui.match(/agentTurn\(/g) ?? []).length, 1, '말로 대화 전용 서버 호출 0');
  assert.match(ui, /session\.mode === 'VOICE' && !done && \(talk\.supported/, 'VOICE 모드 질문 화면에 늘 마이크');
  assert.match(ui, /if \(speaking\) \{ stopSpeaking\(\); setSpeaking\(false\); return; \}/, '말하는 중 누르면 즉시 멈춤');
  assert.match(ui, /if \(talk\.listening\) \{ talk\.stop\(\); return; \}/);
  assert.match(ui, /\{voice\.supported && !\(session\.mode === 'VOICE' && !done\) && <button/, 'VOICE 모드에서는 받아쓰기 버튼 대신 큰 마이크');
  assert.match(ui, /'말로 대화 중' : '글로 대화 중'/);
  assert.match(input, /r\.continuous = false;/, '말을 멈추면 스스로 끝(키보드·보내기 없이)');
  assert.doesNotMatch(input + out, /fetch\(|supabase|getUserMedia|MediaRecorder|localStorage/, '목소리 저장·전송·새 API 0');
});

test('VOICE_RESPONSE_NOT_SPOKEN: 소리 길 열기가 실제로 말을 낸다(빈 글자로 걸러지지 않음) · 누름 안에서 부른다', () => {
  assert.doesNotMatch(ui, /speak\(' '\)/, '예전 no-op 제거');
  assert.match(out, /new SpeechSynthesisUtterance\('\.'\);\s*u\.volume = 0;/);
  assert.match(ui, /unlockSpeech\(\);\s+\/\/ 아이폰: 대답을 읽을 소리 길을 이 누름 안에서 연다/);
  assert.match(ui, /if \(choice\.mode === 'VOICE'\) unlockSpeech\(\); setTone/, '선택창 누름 안에서');
  assert.match(out, /u\.onerror = \(e\) => end\(/, '못 읽으면 숨기지 않고 알린다');
  assert.match(ui, /SPEAK_FAILED = '소리로 읽지 못했어요/);
});

test('speakNew: 마지막 사용자 말 뒤의 AI 말(받아주기 + 다음 질문)만 읽는다 — 앱의 첫 질문을 다시 읽지 않는다', () => {
  const pick = (messages) => { const lastUser = messages.map(m => m.role).lastIndexOf('user'); return messages.slice(lastUser + 1).filter(m => m.role === 'ai').map(m => m.text).join(' '); };
  assert.match(ui, /const lastUser = fresh\.map\(m => m\.role\)\.lastIndexOf\('user'\);/);
  const first = [{ role: 'ai', text: '어떤 만남을 원하세요?' }, { role: 'user', text: '연애로 이어질 만남을 원해요. 부담스롭지 않는 선에서 대화나눠보고 싶어' }, { role: 'ai', text: '받아주기.' }, { role: 'ai', text: '다음 질문?' }];
  assert.equal(pick(first), '받아주기. 다음 질문?');
});

test('USER_CONTEXT_NOT_ACKNOWLEDGED: 서버 받아주기 말이 제목 자리에 선다 · 화면이 문장을 만들지 않는다', () => {
  assert.match(ui, /ack \? <h1 className="echo-ack-heading">\{ack\}<\/h1>/);
  assert.match(ui, /const ack = qIndex > 0 && msgs\[qIndex - 1\]\.role === 'ai' \? msgs\[qIndex - 1\]\.text : '';/);
  assert.doesNotMatch(ui, /원하시는군요/, '받아주기 문장 하드코딩 0');
});

test('OPAQUE_CHOICE_PANEL: 흑백 필터 0 · 약한 흐림 · 판 거의 투명 · 버튼 흰 꽉 찬 판 0', () => {
  const css = read('src/doit/components/feature/agent-choice.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /grayscale/);
  const card = css.match(/\.echo-choice-card\{([^}]*)\}/)[1];
  assert.match(card, /background:rgb\(255 255 255\/\.04\)/);
  assert.match(card, /blur\(6px\)/);
  assert.doesNotMatch(css, /background:#fff\b|background:#[0-9a-f]{3,6}(?![0-9a-f])/i, '꽉 찬 색 판 0');
  assert.match(css, /\.echo-choice-option\.is-selected\{[^}]*border:2px solid #fff/, '고른 상태가 분명하게');
});

test('설치 찾기: 설정에 늘 있는 「홈 화면에 ECHO 추가」 · 설치됨 표시 · 앱 홈에서 링크 · 강제 설치 0', () => {
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  assert.match(card, /const \[eligible\] = useState<boolean>\(\(\) => menu \|\| !alreadySuggested\(\)\);/);
  assert.match(card, /if \(visible && !menu\) markSuggested\(\);/, '메뉴 항목은 1회 제안 기록에 영향 0');
  assert.match(card, /홈 화면에 추가됨/);
  assert.match(read('src/doit/pages/do-it/settings/page.tsx'), /<section id="install"[\s\S]{0,200}<InstallAppCard variant="menu" \/>/);
  assert.match(read('src/doit/pages/do-it/home/page.tsx'), /to="\/doit\/settings#install">홈 화면에 ECHO 추가/);
  assert.doesNotMatch(card, /useEffect\([^)]*promptInstall/, '누르기 전 설치 창 0');
});

test('MUSIC: 고르기 전·불러오는 중을 0:00/0:00 대신 글로 · 말로 대화가 시작되면 멈춤(다시 틀기 0)', () => {
  const m = read('src/pages/do-it/hero/components/OriginalMusicCard.tsx');
  assert.match(m, /'-:-- \/ -:--'/);
  assert.match(m, /듣고 싶은 곡을 눌러 주세요/);
  assert.match(m, /window\.addEventListener\(VOICE_ACTIVE_EVENT, onVoice\)/);
  const onVoice = m.match(/const onVoice = \(\) => \{[^\n]*\};/)[0];
  assert.doesNotMatch(onVoice, /play\(/);
  assert.doesNotMatch(m, /autoplay|audio\.autoplay/);
  assert.match(ui + read('src/doit/lib/voiceOutput.ts'), /announceVoiceActive\(\)/);
});

// 골든 테스트(서버 로직 · 가짜 AI 출력): 목적 + 자유 입력이 한 턴으로 같이 AI 에 가고, 받아주기 뒤 Q2 로 간다.
const src = read('supabase/functions/doit-agent/agent.ts');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const file = path.join(mkdtempSync(path.join(tmpdir(), 'golden-')), 'agent.mjs');
writeFileSync(file, js);
const A = await import(pathToFileURL(file).href);

test('골든: 연애로 이어질 만남 + 부담스럽지 않게 → A 받아주기 · B Q2 · C Q1 다시 안 물음 · D 부담 안 버림 · E 새 뜻 저장 0', async () => {
  const first = '연애로 이어질 만남을 원해요. 부담스럽지 않게 자연스럽게 연락하고 싶어요';
  const st = A.newState({ tone: 'polite', mode: 'VOICE' }); A.seedFirstQuestion(st);
  const seen = [];
  const llm = async (kind, system, inp) => { seen.push(inp); return JSON.stringify({ kind: 'answer', understood: '', reply: '부담 없이 자연스럽게 이어지는 만남이면 좋겠다는 거군요.', extracted: [{ purpose: 'relationship_intent', note: '연애로 이어질 만남 · 부담 없이', quote: '부담스럽지 않게 자연스럽게 연락하고 싶어요' }], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '같이 있어도 편하고 끌린다 싶은 사람은 어떤 사람일까요?', hint: '', check: { context: true, concrete: true, answerable: true } } }); };
  await A.runTurn(st, first, llm);
  assert.ok(seen[0].latest.includes('연애로 이어질 만남') && seen[0].latest.includes('부담스럽지 않게'), 'L: 목적 + 자유 입력이 함께 AI 에 간다');
  const t = st.turns[0];
  assert.ok(t.reply.length > 0, 'A 받아주기');
  assert.equal(st.current.purpose, 'attraction_comfort', 'B Q2');
  assert.notEqual(t.question, A.FIRST_QUESTION, 'C');
  assert.equal(A.coreAsked(st).length, 2);
  const item = st.slots.relationship_intent.items[0];
  assert.match(item.quote, /부담스럽지 않게/, 'D');
  assert.equal(st.slots.relationship_intent.status, 'CONFIRMED');
  assert.deepEqual(Object.values(st.slots).filter((s) => s.items.length).length, 1, 'E: 사용자가 말하지 않은 목적 저장 0');
  // 다음 턴 입력(기억): 앞선 말 원문이 그대로 recent 에 남는다(TEXT·VOICE 같은 상태).
  assert.equal(A.turnInput(st, '다음 말').recent[0].user, first);
});
