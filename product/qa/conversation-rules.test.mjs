// v13 대화 규칙 검사(순수 함수 · 가짜 입력). 서버 파일과 화면 파일의 RULES 블록이 같은지도 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientPath = 'src/doit/lib/conversationRules.ts';
const serverPath = 'supabase/functions/doit-understanding/index.ts';
const client = readFileSync(path.join(root, clientPath), 'utf8');
const server = readFileSync(path.join(root, serverPath), 'utf8');

function load() {
  const js = ts.transpileModule(client, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports }, { filename: clientPath });
  return module.exports;
}
const rules = load();

test('서버 v13 과 화면의 RULES 블록이 글자 단위로 같다(두 곳이 어긋나면 판정이 달라진다)', () => {
  const block = (text) => {
    const start = text.indexOf('// ── RULES');
    const end = text.indexOf('// ── /RULES ──');
    assert.ok(start >= 0 && end > start, 'RULES 블록 표식이 있어야 한다');
    return text.slice(start, end);
  };
  assert.equal(block(server), block(client));
  // v15.1 연결 서버(doit-connect)도 같은 블록을 쓴다 — 연결 자격의 "내용 있는 답" 판정이 화면·대화 서버와 어긋나지 않게.
  const connect = readFileSync(path.join(root, 'supabase/functions/doit-connect/index.ts'), 'utf8');
  assert.equal(block(connect), block(client), 'doit-connect 의 RULES 블록도 같아야 한다');
});

// v15.1 대표 결정 「모르겠어요 ×5 연결 자격 금지」: 대화 진행 칸과 연결 자격의 "내용 있는 답"은 다르다.
test('v15.1 내용 있는 답(informativeAnswer): 모르겠어요·지친 말·불만·AI 에게 한 질문·되묻기·설명 없는 정정은 세지 않고, 보통 답·짧은 답·설명 붙은 정정은 센다', () => {
  for (const t of ['모르겠어요', '몰라', '잘 모르겠어요', '글쎄요 딱히 없어요', '딱히 생각 안 나요', '할말이없다 휴', '그만할래', '휴', '너 AI야?', '왜 이런 걸 물어봐?', '무슨 뜻이에요?', '뭘더 얘길해야해', '그게 아니에요', '아니야', '', '   ']) {
    assert.equal(rules.informativeAnswer(t), false, `세면 안 됨: ${JSON.stringify(t)}`);
  }
  for (const t of ['진지하게 알아가고싶어', '잘 웃는 사람', '산책', 'ㅇㅇ 좋아요', '천천히요', '그게 아니라 조용한 사람이 좋다는 거예요', '편하게 대화가 되는 사람이요.', '운동 같이 하는 거 😊']) {
    assert.equal(rules.informativeAnswer(t), true, `세야 함: ${JSON.stringify(t)}`);
  }
});

test('주제: 순서대로 아직 안 나온 첫 주제를 고르고, 전부 나오면 null(방향 없이 이어 묻기)', () => {
  assert.equal(rules.TOPICS.length, 5);
  assert.equal(rules.pickNextTopic([]), 'purpose');
  assert.equal(rules.pickNextTopic(['purpose']), 'partner_style');
  assert.equal(rules.pickNextTopic(['purpose', 'self']), 'partner_style', '이미 말한 주제는 건너뛴다');
  assert.equal(rules.pickNextTopic(['purpose', 'partner_style', 'together', 'self', 'pace']), null);
  assert.equal(rules.isTopicId('together'), true);
  assert.equal(rules.isTopicId('궁합'), false);
  // v14: 매칭에 쓰지 않는 주제(마음 파고들기)는 뺐다. 옛 주제 id 가 기록에 남아 있어도 다음 주제 고르기를 막지 않는다.
  assert.equal(rules.isTopicId('mood'), false);
  assert.equal(rules.isTopicId('partner_traits'), false);
  assert.equal(rules.pickNextTopic(['mood', 'partner_traits']), 'purpose', '옛 id 는 무시하고 처음부터 고른다');
  // 매칭에 필요한 칸이 전부 들어 있어야 한다.
  assert.equal(rules.TOPICS.map((t) => t.id).join(','), 'purpose,partner_style,together,self,pace');
  // 화면에 그대로 나오는 이름이라 짧아야 한다(진행 표시 "3 / 5 · 이름").
  for (const t of rules.TOPICS) assert.ok(t.label.length <= 12, `${t.label} 이 너무 길다`);
});

test('되묻기 판정: 질문 자체를 묻는 짧은 말만 true, 실제 답("모르겠어요" 포함)은 false', () => {
  for (const t of ['무슨 뜻이에요?', '그게 무슨 말이에요', '질문이 이해가 안 돼요', '다시 말해줄래?', '예를 들면요?', '어떻게 답해야 해요?', '?', '뭔 소리예요', '뭐라고요?']) {
    assert.equal(rules.isMetaReply(t), true, t);
  }
  for (const t of ['모르겠어요', '처음만날때는 조용한곳이 좋아요', '사람들이 나를 이해 안 해줘요', 'ㅇㅇ', '😊', '급하진 않아요. 천천히 알아가고 싶어요', '조용한 곳? 좋아요', '']) {
    assert.equal(rules.isMetaReply(t), false, t);
  }
  assert.equal(rules.isMetaReply('무슨 뜻이에요? '.repeat(10)), false, '긴 글은 되묻기로 보지 않는다');
});

test('저장 금지: 전화·이메일·주민번호·카드·링크·성적 표현은 이유를 돌려주고, 보통 이야기는 null', () => {
  assert.equal(rules.blockedContentReason('제 번호는 010-1234-5678 이에요'), 'phone');
  assert.equal(rules.blockedContentReason('01012345678로 연락주세요'), 'phone');
  assert.equal(rules.blockedContentReason('02-123-4567'), 'phone');
  assert.equal(rules.blockedContentReason('메일은 someone@example.com'), 'email');
  assert.equal(rules.blockedContentReason('주민번호 900101-1234567'), 'id_number');
  assert.equal(rules.blockedContentReason('카드 1234-5678-9012-3456'), 'card');
  assert.equal(rules.blockedContentReason('https://example.com 봐줘'), 'link');
  assert.equal(rules.blockedContentReason('인스타 www.instagram.com/abc'), 'link');
  assert.equal(rules.blockedContentReason('naver.com 에서 찾아'), 'link');
  assert.equal(rules.blockedContentReason('원나잇 원해요'), 'sexual');
  for (const t of ['처음 만날 때는 조용한 곳이 좋아요', '2024년에 이직했어요', '키 175에 몸무게 70', '하루 8시간 자요', '10명 중 3명', '19금 영화는 안 봐요', '주소는 말하기 싫어요', '모르겠어요']) {
    assert.equal(rules.blockedContentReason(t), null, t);
  }
  assert.match(rules.blockedContentMessage('phone'), /전화번호/);
  assert.match(rules.blockedContentMessage('sexual'), /성적인 표현/);
  assert.match(rules.blockedContentMessage('link'), /적은 내용은 그대로/);
});

test('서버 v13: 저장 경로 4곳(record_create/update, correct, self) 모두 규칙 차단을 거치고, 새 액션 2개가 등록돼 있다', () => {
  // v14.1 소개 초안(profile_draft)도 재료·출력 두 곳에서 같은 규칙을 거친다. 저장 경로 수는 그 블록을 빼고 센다.
  const draftStart = server.indexOf('if (action === "profile_draft")');
  const draftEnd = server.indexOf('if (action === "connection_preview")', draftStart);
  const draftBlock = server.slice(draftStart, draftEnd);
  const outside = server.slice(0, draftStart) + server.slice(draftEnd);
  // v15 turn_classify(분류 전 차단)·synthesis_revise(직접 설명 저장 전)·통합 카드 항목(출력)이 같은 규칙을 거친다 → 사용 9.
  // v16 한 턴(turn): 입력 원문 2(text·originalText) + 출력 3(다음 질문·짧은 반응·AI 에게 한 질문의 답) → 사용 14.
  // v1.1 앱이 보낸 최근 대화(recent)의 말·질문 2곳도 같은 규칙으로 거른다 → 사용 16.
  assert.equal((outside.match(/blockedContentReason\(/g) ?? []).length - 1, 16, 'RULES 정의 1 + 사용 16(create 2회·update·correct·self + v14.4 화면이 보낸 직전 질문 + v15 분류·직접 설명·카드 항목 + v16 입력 2·출력 3 + v1.1 최근 대화 2)');
  assert.equal((draftBlock.match(/blockedContentReason\(/g) ?? []).length, 2, '소개 초안: 재료(내 답)와 출력 문장 둘 다 거른다');
  assert.ok(server.includes('"rephrase", "profile_draft"'));
  assert.ok(server.includes('BLOCKED_CONTENT: "BLOCKED_CONTENT"'));
  assert.ok(server.includes('judgeCoveredTopics'));
  assert.ok(!/console\.log\([^)]*(text|recordText|originalText)/.test(server), '원문을 로그에 남기는 코드가 없어야 한다');
});

// v14.3 대표 실기기(2026-09-24): 되묻기·불평을 답으로 저장했다. 진짜 답(짧은 답·"모르겠어요" 포함)은 그대로 답이어야 한다.
test('v14.3 되묻기 판정: 실제 사용자 말투 — 되묻기·불평은 잡고, 진짜 답은 놓아준다', async () => {
  const { isMetaReply } = rules;
  const meta = ['활동?질문이 머이래', '딥하네', '무슨 말이야 글자 오타아니야?', '질문이 무슨 뜻이에요?', '뭔소리야', '먼말이야', '이게 뭐야', '너무 딥해', '질문이 어려워요', '헷갈려', '뭐라는거야', '활동?', '너무 어렵다', '좀 어렵네요'];
  const answers = ['모르겠어요', '모르겠어', '취미생활이 같으면 좋지', '같은 취미활동', '깊은 대화부터 시작하고 싶어요', '천천히 깊게 알고 싶어', '말이 잘 통하는 사람', '말이 이상한 사람은 싫어', '처음엔 어려워', '낯을 가려서 처음엔 좀 어려워요', '산책', '영화 보기 ㅎㅎ', 'ㅋㅋ 몰라', '솔직한 사람이 좋아요', '등산 좋아해요!', '👍'];
  for (const m of meta) assert.equal(isMetaReply(m), true, `되묻기: ${m}`);
  for (const a of answers) assert.equal(isMetaReply(a), false, `진짜 답: ${a}`);
});

// v15.1(LEVEL 2 연습 실행에서 발견): 규칙이 답 안의 낱말 하나만 보고 진짜 답을 불만·지친 말로 판정해 버렸다(실사용 말투 16개 중 14개).
// 규칙은 대화 자체를 가리키는 게 분명한 말만 잡고, 애매한 말은 null(서버 AI 분류가 뜻으로 가름 · 실패하면 답)로 둔다.
test('v15.1 분류 규칙: 낱말이 겹쳐도 관계에 대한 진짜 답은 불만·지친 말로 판정하지 않는다(원문을 버리지 않는다)', () => {
  for (const t of ['보드게임 같은 거 같이 하고 싶어요', '맛있는 거 먹는 거 같은 거요', '같은 얘기를 해도 웃어 주는 사람', '비슷한 말을 해도 잘 들어주는 사람',
    '연애에 지쳐서 천천히 만나고 싶어요', '가볍게 만나는 건 지쳐서 그런 것 같아요', '일이 피곤해서 주말엔 쉬고 싶어요', '귀찮게 연락 자주 하는 사람은 싫어요',
    '연락 그만하자고 하면 서운해요', '싸우면 그만하고 싶어져요', '다 얘기했던 친구가 떠났어요', '친구한테 다 말했어요', '네 알아서 해 주는 사람이 좋아요',
    '패스트푸드 말고 집밥 좋아해요', '지친 날엔 조용히 있고 싶어요', '아니요, 대화가 많은 게 좋아요']) {
    assert.equal(rules.ruleKind(t), null, `진짜 답인데 규칙이 판정함: ${t} → ${rules.ruleKind(t)}`);
    assert.equal(rules.informativeAnswer(t), true, t);
  }
});
test('v15.1 분류 규칙: 대화 자체를 가리키는 불만·지친 말은 계속 규칙으로 잡는다', () => {
  for (const t of ['같은 질문 또 하네', '같은 걸 또 물어봐', '아까랑 비슷한 말 또 하네', '뭘더 얘길해야해', '아까 말했잖아', '이미 답했는데요',
    '뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야?']) assert.equal(rules.ruleKind(t), 'complaint', t);
  for (const t of ['지쳤어', '너무 피곤해', '아 귀찮아', '그만할래', '이제 그만 할래요', '답하기 싫어', '할말이없다 휴', '휴', '패스', '오늘은 여기까지', '좀 쉬자', '쉴래', '잠깐 쉴게요']) assert.equal(rules.ruleKind(t), 'fatigue', t);
  // 「쉬고 싶어요」는 "주말엔 뭐 하고 싶어요?"의 진짜 답일 수 있어 규칙이 판정하지 않는다(AI 분류가 가름)
  assert.equal(rules.ruleKind('주말엔 그냥 쉬고 싶어요'), null);
});
