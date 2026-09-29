# ECHO Server Core 분리 가능 범위 — 실측 (2026-09-18)

`rules.ts`(get-step-question)와 `question-quality.ts`(echo-journey)의 **실제 의존 관계**를 코드에서 직접 센 결과다.

## 1. 두 판정 모듈은 이미 순수하다 (측정값)

| 모듈 | 크기 | import | `Deno.*` | `fetch` | `createClient` |
| --- | --- | --- | --- | --- | --- |
| `get-step-question/rules.ts` | 37,004 B · export 90개 | **0** | **0** | **0** | **0** |
| `echo-journey/question-quality.ts` | 30,989 B · export 47개 | **0** | **0** | **0** | **0** |

→ 두 파일 모두 **바깥 의존이 하나도 없다.** DB·네트워크·런타임 API를 전혀 부르지 않는다.
   그대로 복사해 다른 제품(온라인 자만추)에 넣어도 동작한다. **분리 가능 범위 = 100%.**

부수 효과가 있는 모듈은 따로다:
- `ai.ts` — `fetch(OPENAI_URL)` 1곳. OpenAI 호출·프롬프트 조립·구제 경로.
- 각 `index.ts` — HTTP·DB·상태 전환.

## 2. 지금은 같은 규칙이 두 벌로 나뉘어 있다

두 서버에 **같은 이름으로 각각 정의된 것: 71개**

```
상수·타입 (28) LIMITS, PERSONA, FORBIDDEN_TERMS, POLITE_MAP, POLITE_TAIL, QUESTION_INTENTS,
               RELEVANCE_STOP, REPLY_COMPLETE, RESPONSIVE_REPLY, EVASIVE_REPLY, SELF_DIRECTED,
               UNANSWERED_COMPLAINT, USER_QUESTION, CONTROL_REPLIES, META_FEEDBACK,
               LOW_INFORMATION_REPLIES, CORRECTION_LEAD, QUESTION_FILLER, TRAILING_MARKS,
               HANGUL, Candidate, BlockOptions, BlockReason, ReplyBlockReason, Status, Memory, Ai, SentencePiece
말투 (6)       hasBanmal, toPoliteKorean, politeOrSame, politeBody, isPoliteSentence, splitSentences
문자열 (8)     normalizeKey, bigrams, looksSame, contentTokens, sharesContent, cutTail, checkable, tidyQuestionText
판정 (16)      isUserQuestion, isSelfDirectedQuestion, isUnansweredComplaint, isMetaFeedback,
               isLowInformationReply, isParrot, pendingUserQuestion, replyQualityReason,
               questionHasContent, repeatsQuestionIntent, replyRevivesRejected, reflectsCorrection,
               correctionContentWords, pendingCorrectionText, userEvidenceParts, priorityNote
모델 I/O (7)   callOpenAI, OPENAI_URL, DEFAULT_OPENAI_MODEL, resolveModel, TEMPERATURE, TOP_P, ASKED_MAX_TOKENS
파싱 (6)       parseCandidates, extractJson, cleanKeys, cleanReply, ackOrDrop, contentTokens
```

이번 안정화에서 결함 5건 중 **3건이 "한쪽만 고쳐져 있었다"** 에서 나왔다
(`relaxed` 예산, `sharesContent` 보조 규칙, `reply` 서식 줄).
두 벌을 유지하는 한 같은 종류의 결함이 계속 난다.

## 3. 권장 분리안 (이번 작업 범위 밖 — 설계 승인 필요)

```
core/                      ← 순수 판정 모듈. 제품 주제와 무관. 자만추에 그대로 이식.
  text.ts        normalizeKey · bigrams · looksSame · contentTokens · wordTokens · splitSentences
  polite.ts      hasBanmal · toPoliteKorean · politeOrSame · POLITE_MAP
  intent.ts      isUserQuestion · isSelfDirectedQuestion · isMetaFeedback · isLowInformationReply
  reply.ts       replyQualityReason · sharesContent · questionHasContent · RESPONSIVE_REPLY
  correction.ts  pendingCorrectionText · reflectsCorrection · correctionContentWords
  rejection.ts   rejectedKeys · replyRevivesRejected
  evidence.ts    userEvidenceParts · unusedEvidenceParts · groundedBasisReply
  candidate.ts   parseCandidates · filterCandidates · pickCandidate · blockReason
  llm.ts         callOpenAI · resolveModel · 토큰·온도 상수
product/                   ← 제품마다 다른 것
  self-understanding/  STEP 정의 · PERSONA · 요약 · 리포트
  matchmaking/         (자만추) STEP 정의 · PERSONA · 추천 근거
```

- `core/` 예상 크기: 약 45~50 KB (현재 중복분 제거 후)
- 두 Edge Function 은 `core/` 를 import 만 한다.
- Deno Edge Function 은 상대 경로 import 를 그대로 지원하므로 빌드 도구 추가가 필요 없다.

**주의:** 이 분리는 라우터·클라이언트 전체 교체가 아니라 서버 내부 파일 이동이지만,
운영 함수 2개를 동시에 재배포해야 하므로 **대표 승인이 필요한 별도 작업**이다.
이번 SERVER CORE 안정화 범위에는 넣지 않았다.
