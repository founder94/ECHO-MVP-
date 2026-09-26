# ECHO MASTER ↔ v15 코드 최종 대조 (2026-09-24)

> ⚠️ **폐기된 옛 가격 표시 (2026-09-26 대표 결정)**: 이 문서의 4,900원은 **폐기된 옛 구조(legacy)** 이며 현재 가격이 아닙니다. 현재 가격은 미확정입니다. 과거 기록 보존을 위해 본문은 그대로 둡니다.

- 이번 단계: **증거 정리만.** 새 기능 0, 제품 코드 변경 0, 운영 배포 0.
- 기준 코드: 저장소 `product/`(커밋 911da20) = 작업 폴더와 글자 단위 동일
  - 서버 `supabase/functions/doit-understanding/index.ts` SHA-256 `5602b4c3ef49ceb4290bef9ce46a42e081ae7440464bc5439b92f79d0e45d865`
  - 화면 `src/doit/components/feature/CoreConversation.tsx` `04b4bdf6b81708767c71830fcd0e2e34c6f348ba889c1c7ad4f192bac9dc8f10`
  - 규칙 `src/doit/lib/conversationRules.ts` `b3430e8903b3101f72a0e2a4a2c1ed8c2b1636a633daff9f6c2de45cecc343a2`
- 운영(읽기 전용 조회, 같은 날): doit-understanding **버전 24(v14.4) 그대로**. v15는 운영에 없다.

## 증명 단계

| 단계 | 내용 | 현재 |
|---|---|---|
| LEVEL 1 | 가짜 AI·가짜 서버 자동 검사 | **통과**(아래 수치) |
| LEVEL 2 | 실제 OpenAI 호출 검사 | **확인 불가 — 0회**(이 환경에 키 없음, 실행 안 함) |
| LEVEL 3 | 운영 서버 + 로그인 사용자 + 실제 앱 연속 5턴 | **확인 불가 — 0회**(v15 미배포) |

아래 표의 "검사"는 모두 LEVEL 1이다. LEVEL 2·3 통과로 읽지 않는다.

---

## 1. 미확정 2개

두 검사 모두 **v15 대화(doit-understanding)가 아니라 옛 ECHO STEP 1→7 흐름**(`get-step-question` 운영 버전 48, `echo-journey` 운영 버전 26)을 검사한다.

| 항목 | 미확정 ① | 미확정 ② |
|---|---|---|
| 파일 | `qa/full-journey-1to7.test.mjs:211` | `qa/stress-messy-inputs.test.mjs:257` |
| 이름 | `[미확정] STEP 1 → 7 완주율 100%` | `[미확정] 깊은 여정: 거절·정정 뒤에도 막다른 길 0건` |
| 검사 내용 | 가짜 모델로 100번 STEP 1→7을 끝까지 가는가 | 거절·정정을 섞은 40번 여정에서 막다른 길이 0인가 |
| 확정 못 한 이유 | 남는 실패가 가짜 모델의 문장 고갈인지 실제 결함인지 가짜 모델로는 구분 불가 | 가짜 모델이 근거(앵커)를 안 바꿔서인지, 서버가 과하게 막아서인지 구분 불가 |
| 이번 실행 실제 값 | 100/100 완주(이번에는 기준 충족, 그래도 todo 유지) | 막다른 길 0 — **그러나 오류 30건, STEP 7 도달 0/40** |
| MASTER 규칙 | 서버 상태머신이 끝까지 통과시키는가 · 반말 금지 | 정정 최우선 · 막다른 길 금지(빠져나갈 문) |
| 제품 위험 | 옛 흐름 한정 · 낮음 | **옛 흐름에 있음**(아래) |
| 운영배포 차단? | v15 배포와 무관(다른 함수) | v15 배포와 무관. 단 옛 흐름은 별도 결함 후보 |

**검사 구멍(이번에 새로 확인, 내가 그동안 놓침):** 바로 앞 검사 `여정 끝까지 40회: 중간에 되묻고 정정해도 STEP 7 까지 끊기지 않는다`(ok 448)는 **이름과 달리 반말 0건만 확인한다.** 실제로는 40번 중 30번이 `followup-answer` 에서 `INVALID_STATE`로 끊겼고, STEP 7까지 간 것은 0번인데도 통과로 세었다.
- v15 이전 기록(2026-09-23 23:32)부터 같은 값이라 v15 때문에 생긴 문제는 아니다.
- 옛 흐름은 현재 앱의 기본 화면에서 이어지지 않는다. 다만 주소 직접 입력(`/doit` → `/doit/choose` → 「ECHO」 → `/weather`)으로는 열린다. 4,900원 결제 흐름도 이 옛 흐름에 있다.
- 이번 단계는 수정 금지라 검사도 고치지 않았다. **통과 숫자 454에 이 구멍이 들어 있다.**

---

## 2. MASTER ↔ CODE 대조표

"일치" = 코드와 LEVEL 1 검사가 맞는다는 뜻이다. 실제 AI(LEVEL 2·3)에서도 맞는지는 모든 행에서 **확인 불가**다. 운영 적용은 모든 행이 **미적용**(v15 미배포)이다.

| # | MASTER 규칙 | 코드(파일:줄 · 함수) | 검사(LEVEL 1) | 판정 | 남은 위험 |
|---|---|---|---|---|---|
| A | LLM은 후보만 | 서버 1117 `composeQuestion` → 1139 `callOpenAI`(system 문장 "너는 다음 질문의 후보만 만든다(최종 결정은 서버가 한다)"). 통합 카드 1416 `generateSynthesis`. 두 곳 모두 결과를 바로 내보내지 않고 검사 함수로 넘긴다 | CASE A·A 역, 역검사 ③④ | 일치 | 실제 모델이 JSON 형식을 자주 어기면 3번 모두 실패 → 명시적 실패가 잦을 수 있음(LEVEL 2 필요) |
| B | 서버 최종 결정 | 1159 `checkCandidate`: 1165 한 질문 · 1166 가벼움 · 1168 반복 · 1169 되묻기 · 1170 자기 표시 · 1201 연결 · 1204 최소 방어 · 1207 거절 겹침 · 1229 판정 AI 불허 · 1234 거절 의미 판정. 1156 3번 실패 시 `FOLLOWUP_EXHAUSTED`. 전략은 1256 서버가 정함 | 역검사 ①②③⑤⑱⑲ | 일치 | 판정 AI(1229)는 LLM이라 결정적이지 않음. 그래서 1204 결정적 최소 방어를 둠 |
| C | 하드코딩 질문 배열 금지 | 저장소 검색 결과는 아래 표 | 역검사 ⑤ | **v15 경로 일치 · 저장소 전체 불일치 1곳** | 옛 흐름 고정 문장 |
| D | Context Memory | 1024 `roundInfo`: 1033 history 최근 5짝(`HISTORY_MAX` 1016), 1035 직전 질문(화면이 보낸 `answeredQuestion` 우선), 976 `askedQuestionsAt`(물은 질문). 1123 이미 답한 말 → 1169 `restatesAnswers`, 1168 `repeatsAsked`, 판정 AI 입력 1211(history·asked 포함) | 역검사 ①⑰, `[반복 방지] history`, TEST F | 일치 | `restatesAnswers` 는 휴리스틱(§5) |
| E | Correction 최우선 | 서버 892 `followupEvidence` 의 `priority`(이 답의 정정·직접 설명 먼저), 905–907 정정 전 AI 문장 → superseded, 1254 대화 중 정정 대상 → superseded, 1256 전략 `ACKNOWLEDGE_CORRECTION`, 1272 `correctionLineOf`(이번 회차에 실제로 물은 문장만). 통합 카드: 1795 `synthesis_revise`(직접 설명이 맨 앞) | 역검사 ⑫, `[정정 우선]`, 정정 테스트 2개 | **부분 일치**(§3) | 턴 중 정정은 다음 한 번의 질문에만 적용되고 저장되지 않음 |
| F | Rejected Semantic Block | 1121 blockers = 거절 + superseded → 1207 글자 겹침 + 1234 `judgeSemanticBlock`(의미). 통합 카드 1447 + 의미 판정. 거절 목록은 1398 `userMeanings`(모든 회차의 거절) | 역검사 ⑪, 통합 카드 결정 테스트 | 일치(카드) · 부분 일치(턴 중 정정) | 의미 판정 시간 초과 시 글자 검사만으로 통과(1236 주석) |
| G | Information Status | 확인 전 = `status 'candidate'`(1375). 사실로 쓰는 곳은 confirmed·corrected만: 서버 914, 1901, 1923, doit-connect 233, 화면 203 `remembered`. 카드 문구 "맞다고 한 것만 나에 대한 사실로 써요"(화면 407) | 역검사 ⑩⑳, 통합 카드 결정 테스트 | 일치 | 없음(LEVEL 1 기준) |
| H | meta-question 분리 | 서버 1721 `turn_classify`(저장 안 함, 1729 ask → 먼저 답, 1733 meta → 쉬운 말로). 화면 318 `sendText`: 327 ask·332 meta 는 `api.record` 호출 전에 return → 기록 0 · 다섯 칸 증가 0 | CASE D 분류, `v15 AI 에게 한 질문(ask)` | 일치 | 규칙이 못 잡은 말은 AI 분류(1288) → AI 실패 시 "답"으로 처리(사용자를 막지 않으려는 선택) |
| I | 피로 표현 승격 금지 | 규칙 `conversationRules.ts:83` `FATIGUE_PATTERNS`(서버 RULES 동일). 화면 343 기록 없이 return. 서버: 742 이해 후보 만들지 않음 · 1391 카드 재료에서 빠짐 · 1442 카드 항목에서 버림 | 역검사 ⑦⑧⑨⑯, CASE E 서버·화면 | 일치 | 규칙에 없는 새 표현은 AI 분류에 의존 |
| J | 5턴 → 통합 이해 | 화면 56 `ASK_TOTAL = TOPICS.length`(=5), 208 `finished`, 356 `willFinish` → 365 다음 질문 요청 안 함, 237 카드 요청 1번(`synthAsked`), 391 카드, 402–405 네 버튼(카드 안에만). 서버 1744 `synthesis_generate`: 1751 답 5개 미만이면 `NOT_ENOUGH`, 1748 확인 대기 카드가 있으면 그대로 돌려줌 | CASE F 서버·화면, 역검사 ⑭, 임시 재진입 검사 3개(§6) | 일치 | 5가 두 곳에 따로 정의됨(화면 TOPICS 길이 · 서버 125 숫자 5) |

### C. 하드코딩 질문 검색 결과 (`product/src`, `product/supabase/functions`)

검색어: 질문 배열(`QUESTIONS = [`), `fallback question`, `EASY_QUESTION`, `GENERIC_RESCUE`, `linkedFallback`, 문자열 끝이 "요?/까?/나요?/세요?"인 코드 문장.

| 위치 | 내용 | 판정 |
|---|---|---|
| `EASY_QUESTION`·`GENERIC_RESCUE`·`linkedFallback` | 정의 0건. 주석(서버 3·4·20·27·28·613·1048행)에 과거 기록으로만 남음 | 없음 |
| 화면 `CoreConversation.tsx:59` `FIRST_QUESTION`, `:61` `OPENING_QUESTION` | 첫 질문 1개 | 대표 확정 예외(2026-09-21·22 결정 기록) |
| 서버 638 `TURN_REPLY.correction` "…어떤 뜻이었는지 한 줄로 알려 줄래요?" | 고정 안내 1문장(관계 질문 아님) | **[대표 판단 필요]** 고정 문장 허용 범위(저장 금지 안내만)와 맞는지 |
| 서버 299·302 전략 안내 속 예시 문장('상대에게 어떤 진실한 마음을 바라나요?' 등) | AI에게 보여 주는 예시(직접 내보내지 않음) | 배열 아님. AI가 그대로 베낄 위험 **[추가 검증 필요 · LEVEL 2]** |
| `get-step-question/rules.ts:627`, `echo-journey/question-quality.ts:351` `QUESTION_INTENTS` | 질문 종류를 가르는 규칙(질문 아님) | 배열 아님 |
| `doit-connect/index.ts:98` `FIRST_QUESTION_FALLBACK` | 연결 첫 질문의 고정 대체 문장(5턴 대화 아님) | 연결 원칙에 있는 고정 문장 · 참고 |
| **`get-step-question/ai.ts:207`, `echo-journey/index.ts:476`** | `"…" 라고 하셨죠. 그중 어떤 부분이 지금 마음에 남아 있나요?` 고정 대체 질문 | **불일치(옛 ECHO 흐름, 운영 중)** — v15 범위 밖, 별건 |
| `src/doit/pages/do-it/room/reward.ts:66` | "이유를 조금만 더 들려줄래?" | 대화와 무관한 다른 화면, 범위 밖 |

---

## 3. 「그게 아니에요」 재확인

| 장소 | 잘못된 해석 폐기 | 원문 보존 | 거절 의미 차단 | 다시 설명시키는가 | 판정 |
|---|---|---|---|---|---|
| **통합 카드**의 「그게 아니에요」 | 즉시: 1772 `synthesis_decide` → 항목 `rejected` | 답(doit_records) 그대로. 안내 "처음 적은 답은 그대로 둘게요" | 저장됨 → 1398 `userMeanings` 로 이후 모든 생성에서 차단 | 아니요. 설명을 요구하지 않음(「직접 설명할게요」는 선택) | **일치** |
| **대화 중** "그게 아니에요"만 입력 | 화면에서만 즉시(떠 있던 AI 첫 줄을 안내 문장으로 바꿈, 화면 349–350) | 예(앞 답 수정·삭제 0) | **서버에 바로 알리지 않음.** 다음 답을 보낼 때 `correction` 으로 함께 가서(354·367) 그 **한 번의** 질문 생성에만 차단(1254). DB에 거절로 남지 않고, 새로고침하면 `pendingCorrection` 이 사라짐 | 아니요. 거절한 해석을 설명하라는 게 아니라 "어떤 뜻이었는지 한 줄"을 묻는 1회 입력. 입력창은 잠기지 않음(무엇을 쓰든 다음 답으로 처리) | **부분 일치** |

- 결론: 「거절한 해석을 다시 설명시키는 구조」는 아니다 → 그 기준으로는 FAIL이 아니다.
- 그러나 MASTER가 요구한 순서("폐기·보존·차단을 **먼저** 한 뒤 최소 입력")와는 다르다. 차단이 **뒤로 미뤄지고, 한 번뿐이며, 저장되지 않는다.**
- 이번 단계는 수정 금지라 고치지 않았다. **판정 = 목표 미달(부분).**
- 수정 후보(승인 뒤 별건): 설명 없는 정정이 오는 즉시 서버에 거절 기록(예: 그 AI 첫 줄을 superseded/rejected 로 저장)을 남긴다. DB 스키마 변경 없이 이벤트 한 줄로 가능한지 검증이 필요하다.

## 4. 「모르겠어」 처리 재확인

규칙: `conversationRules.ts:114` · 서버 223–224(`UNSURE_PATTERN`, 24자 이하).

| 구분 | 들어가는가 | 코드 근거 |
|---|---|---|
| 저장(doit_records) | **예**, 원문 그대로 | 화면 357 `api.record` |
| 다섯 칸(턴 수) | **예**, 한 칸으로 셈 | 화면 208, 서버 1751 |
| 관계 답(relationship answer)으로 쓰임 | **연결 자격 개수에는 들어감** — doit-connect 242(종류를 가리지 않고 셈), 서버 1905 `readiness.answers` | 아래 위험 |
| confirmed fact | 아니요 | 서버 742(이해 후보 만들지 않음) |
| 통합 카드 재료(synthesis evidence) | 아니요 | 서버 1391(재료에서 뺌), 1442(항목에서 버림) |
| 사용자 성향(user trait) | 아니요 | 이해 후보·카드 항목 모두 0 |
| 다음 질문 | 해석하지 않고 더 쉬운 다른 질문 | 서버 1255 `easy`, `KIND_GUIDE.unsure` |

**위험:** "모르겠어요"를 다섯 번 답하면 다섯 칸이 차고, 카드는 빈 채로 끝나며(1752 `empty`), **연결 자격 "다섯 가지 답"도 충족된다.** MASTER "성향·가치로 승격 금지"는 지켜진다. 하지만 **내용 없는 사람이 연결 후보에 들어갈 수 있다.** 이건 제품 결정이라 손대지 않았다 → **[대표 결정 필요]**. 예전 앱이 불만·지친 말을 답으로 저장한 기록도 같은 방식으로 개수에 들어간다.

## 5. 글자쌍(바이그램) 휴리스틱 현재 상태

**유지함(삭제·변경 없음).** 모두 **[휴리스틱 / 추가 검증 필요]**이며 MASTER 영구 규칙이 아니다.

| 이름 | 줄 | 내용 |
|---|---|---|
| `restatesAnswers` | 1072–1082 | 질문 글자쌍의 60%(`RESTATE_MIN` 1056) 이상이 이미 한 답 안에 있고, 새 글자쌍(`FRAME_GRAMS` 제외)이 **4개 미만**(`RESTATE_NOVEL_MIN` 1072)이면 되묻기로 봄 |
| `sharesWords`(not_anchored) | 1064–1068, 1204 | 받아 주는 첫 줄이 근거가 없으면, 질문이 방금 답과 두 글자 조각(어미 `ANCHOR_STOP` 제외)을 하나도 안 나누면 떨어뜨림 |
| `CONNECT_MIN` 0.3 | 1060 | 이어받는 뜻이 답과 겹치는 최소 비율 |
| `looksSame`(REPEAT_SIM·OVERLAP) | 391 | 반복 판정 |

위험: 잘못 걸리면 좋은 질문이 떨어지고, 3번 모두 떨어지면 사용자는 "한 번 더 눌러 주세요"를 본다. 이게 실제로 얼마나 자주 나는지는 **LEVEL 2에서만** 잴 수 있다.

## 6. 상태 복원 최소 회귀 (LEVEL 1)

| 경우 | 검사 | 결과 |
|---|---|---|
| 정상 다음 질문 | `live next question survives a later saved-question null response`(173), `v14.4 답을 보낼 때 그 답이 받은 질문…`(647), `newly generated follow-up wins over a late restoration`(217, 두 경우) | 검사 PASS |
| 새로고침(회차 중간) | `server-saved follow-up still restores for the active record`(206) + **임시 검사**: 저장된 질문이 있으면 복원·새로 만들지 않음 / 없으면 자동 요청 딱 1번 | 검사 PASS |
| 재진입 | `record switch hides a question immediately…`(233), `late saved question from a previous record cannot leak…`(249) + **임시 검사 2개**: 다섯 답 + 확인 대기 카드 → 그 카드 복원, 네 버튼 1세트, 다음 질문 요청 0, 다시 그려도 카드 요청 1번 / 카드를 이미 다 정했으면 네 버튼 0 | 검사 PASS |
| 저장된 세션 복원 | `a saved user correction clears its old follow-up and restores the new context`(263), `a correction to another record invalidates…`(283), 서버 `CASE F 통합 카드`(카드 재요청 시 `existing: true`) | 검사 PASS |
| 중복 요청 | `"다음 질문 받기" retry asks the server again without duplicating the record`(194), 서버 `CASE D 불만 뒤 새 질문(skip)…같은 요청은 같은 답`, `통합 카드 결정…같은 요청은 한 번만`, `STALE_CONTEXT write … retries exactly once`(508), `a second STALE_CONTEXT is reported, not retried forever`(522) | 검사 PASS |
| 네트워크 실패 후 재시도 | `next-question failure preserves the original, shows the server reason, and invents no question`(304) + 194 | 검사 PASS |

- 임시 검사 3개는 이번에 증거용으로만 돌리고 지웠다(제품·검사 수에 포함 안 됨, 3/3 통과). 재진입 뒤 카드 복원은 **화면 쪽 검사가 원래 없었다** — 필요하면 정식 검사로 추가하는 것은 승인 뒤.
- 알려진 한계: 새로고침하면 `pendingCorrection`(§3)과 `answeredFor`(답할 때 떠 있던 질문)가 사라진다. 뒤쪽은 서버가 저장된 질문 기록으로 짝을 찾는다(1035). 앞쪽은 사라진다.

## 7. 역검사 20개 대응표

`mut15.py`(`역검사_mut15.py` 사본). 망가뜨린 뒤 5개 파일(`conversation-v15`, `conversation-continuity`, `server-conversation-flow`, `core-conversation-question-state`, `conversation-rules`)을 돌렸다.

| # | 제거·변경한 안전장치 | 떨어진 검사 수 | 떨어진 검사(대표) · 파일 |
|---|---|---|---|
| ① | 되묻기 검사(1169 `restatesAnswers`) | 3 | CASE A 역(v15) · CASE B·C(v15) · [구조](continuity) |
| ② | 결정적 최소 방어(1204 not_anchored) | 3 | [맥락 단절 FAIL 재현] · [구제 경로도 같은 계약] · [구조](continuity) |
| ③ | 다시 만들기 3번 → 1번 | 9 | CASE A 역 · CASE B·C · 정정(v15) 외 |
| ④ | 떨어진 이유를 다음 생성에 안 알림 | 4 | [구조](continuity) · CASE A 역(v15) · TEST F 반복 방지(flow) |
| ⑤ | 실패 시 고정 문장 "방금 한 말, 조금만 더 들려줄래요?" 되살림 | 25 | [맥락 단절 FAIL 재현] · [구제 경로도 같은 계약] · [정정 우선](continuity) 외 |
| ⑥ | 불만 규칙 비움(서버+화면) | 2 | CASE D 분류 · CASE D 예전 앱 저장분(v15) |
| ⑦ | 지친 말 규칙 비움(서버+화면) | 4 | CASE D 분류 · CASE E · CASE F 통합 카드(v15) |
| ⑧ | 예전 앱 기록도 이해 후보로(742) | 3 | CASE D 예전 앱 · CASE E(v15) · "모르겠어요" 도 정상 입력(flow) |
| ⑨ | 카드 「할 말이 없어요」 걸러내기(1442) | 1 | CASE F 통합 카드(v15) |
| ⑩ | 카드 근거 검사(1445) | 2 | CASE F 통합 카드 · 통합 카드 전제(v15) |
| ⑪ | 카드 거절한 뜻 차단(1447) | 1 | CASE F 통합 카드(v15) |
| ⑫ | 정정 대상 문장 검증(1272) | 1 | 정정: 이번 회차에 실제로 물은 문장일 때만(v15) |
| ⑬ | 기계적 받아 주기 허용(`MECHANICAL_ACK`) | 1 | 주제가 다 나오면(5/5) … 기계적 첫 줄은 떼고(flow) |
| ⑭ | 화면: 답마다 4버튼 카드 되살림 | 3 | live next question survives · follow-up disabled build(question-state) · v15 CASE F(question-state) |
| ⑮ | 화면: 불만을 답으로 저장 | 1 | v15 CASE D(question-state) |
| ⑯ | 화면: 지친 말을 답으로 저장 | 1 | v15 CASE E(question-state) |
| ⑰ | 서버: 다른 질문 받기가 캐시 경로로 | 1 | CASE D 불만 뒤 새 질문(skip)(v15) |
| ⑱ | 판정 AI 결과 무시(항상 허용) | 4 | [반복 방지] history(continuity) · v15 판정이 "앞뒤가 안 맞는다"고 불허하면(flow) · v13.7 이어 묻기(flow) |
| ⑲ | AI 자기 표시(반복·미확정 전제) 무시 | 1 | [구조](continuity) |
| ⑳ | 카드 결정: 확인 대기 항목인지 검사(1785) | 1 | 통합 카드 결정 … 남의·이미 정한 항목은 바꾸지 못함(v15) |

20개 모두 1개 이상의 검사를 떨어뜨렸다(못 잡은 것 0).

**원본 복구 확인**
- 스크립트는 한 번 망가뜨릴 때마다 원래 글을 읽어 두었다가 검사 뒤 되돌린다(try/finally).
- 복구 뒤 지문: 서버 `5602b4c3…`, 화면 `04b4bdf6…`, 규칙 `b3430e89…` — 작업 폴더 = 저장소 `product/` = 커밋 911da20 세 곳이 같다.
- 20개 변형 문장이 지금 파일에 남아 있지 않은지 문장 단위로 따로 확인했다: 20/20 원본.
  - **내 실수**: 처음 확인 스크립트가 ⑬을 "변형 남음"으로 잘못 표시했다. ⑬의 변형 문장이 원래 문장의 앞부분이라 생긴 오판이다. 원래 문장(`!MECHANICAL_ACK.test(ack)` 포함)이 정확히 1번 있는 것을 따로 확인했다.
- 한계: 역검사 **시작 전**의 지문은 따로 적어 두지 않았다. 그래서 "시작 전 = 끝난 뒤" 지문 대조가 아니라, 위의 문장 단위 확인 + 복구 뒤 전체 검사 454 통과로 확인했다.

## 8. 전화 인증 (읽기 전용, 조건 변경 0)

| 사실 | 근거 |
|---|---|
| 연결 자격에 전화 인증 필수 | `doit-connect/index.ts:260` `phoneVerified` = verification_status "verified" 또는 Auth 전화 확인 · `:266` `if (!phoneVerified) missing.push("phone")` |
| 준비 상태 화면도 같은 조건 | `doit-understanding` 1913 `phone_verified` · 1915 `eligible` |
| 인증 방식 | 화면 `src/doit/lib/phoneVerify.ts:56` `updateUser({ phone })` → `:61` `verifyOtp(type 'phone_change')` → doit-connect `phone_sync`(412–413, Auth 기록만 믿음) = Supabase 문자 발송 업체 필요 |
| 운영 수치(2026-09-24 조회) | verified 0 · 전화 확인 0 · 연결 0 · 목적 고른 사람 3 |
| Twilio 중단 | 대표 결정(2026-09-24). Supabase 문자 발송 설정 자체는 이 환경에서 읽을 수 없음 → **확인 불가** |
| 결론 | 현재 구조에서 연결 자격자는 0명이고 늘어날 길이 없음. 대체 경로 코드 없음 → **별도 제품 결정** |
| 작은 차이(참고) | 준비 상태(1913)는 verification_status 만 보고, doit-connect(260)는 Auth 전화 확인도 인정. 지금은 둘 다 0이라 영향 0 |

## 9. 회원탈퇴 트랙
설계 방향 유지. `PENDING_20260924_withdrawal_retention.sql` 은 실행하지 않았다. KEY 9줄 = **살아 있는 계정 1개에 연결된 데이터**(2026-09-24 실측). 보존 기간은 법무 검증 전이라 확정하지 않았다.

---

## 배포 후보 (아직 만들지도 올리지도 않음)

| 무엇 | 지문 | 상태 |
|---|---|---|
| 서버 doit-understanding v15 | `index.ts` SHA-256 `5602b4c3ef49ceb4290bef9ce46a42e081ae7440464bc5439b92f79d0e45d865`(170,420바이트) | 로컬만. 운영 = 버전 24 |
| 앱 42차 ZIP | **아직 안 만듦**(지문 없음). 들어갈 화면 파일: `CoreConversation.tsx` `04b4bdf6…`, `conversationRules.ts` `b3430e89…`, `coreConversation.ts`, `core-conversation.css` | 미제작 |
| 홈페이지 ZIP | 필요 없음(대화 화면은 앱에만) | — |
| 올리는 순서 | 서버와 앱을 **같이.** 서버만 올리면 옛 앱은 여전히 답마다 카드가 뜬다. 앱만 올리면 새 동작(분류·카드)을 옛 서버가 몰라 실패한다 | — |

## 미확정 (남은 것 전부)

1. LEVEL 2(실제 OpenAI) 0회 — 형식 오류율, 명시적 실패 빈도, 휴리스틱 오판, 프롬프트 예시 베끼기 모두 모름
2. LEVEL 3(운영·로그인·실기기 5턴) 0회
3. 옛 ECHO 흐름 미확정 2개 + 깊은 여정 30/40 끊김(검사 구멍 포함)
4. 턴 중 「그게 아니에요」 차단이 뒤로 미뤄지고, 한 번뿐이고, 저장되지 않음(부분 일치)
5. 「모르겠어요」×5로 연결 자격 "다섯 답"이 충족됨
6. `TURN_REPLY.correction` 고정 문장이 허용 범위인지
7. 바이그램 휴리스틱 4종 [추가 검증 필요]
8. 화면 쪽 재진입 카드 복원 검사가 정식 검사에 없음(임시로만 확인)
9. 새로고침하면 대화 중 정정 대기(`pendingCorrection`)가 사라짐
10. 옛 흐름의 고정 대체 질문(`get-step-question/ai.ts:207`, `echo-journey/index.ts:476`) 운영 중
11. 전화 인증 필수 + Twilio 중단 → 연결 자격자 0
12. 브라우저에서 로그인한 뒤 5턴·카드 흐름 확인 0(로그아웃 화면 18/18만)

## STOP (대표 승인 필요)

1. doit-understanding v15 운영 배포
2. 42차 APP ZIP 제작과 Netlify 업로드
3. 턴 중 정정 즉시 저장 보강(§3) 진행 여부
4. 「모르겠어요」만으로 연결 자격이 차는 것을 허용할지(§4)
5. `TURN_REPLY.correction` 고정 문장 허용 여부
6. 옛 ECHO 흐름(주소 직접 입력으로 열림, 결제 포함)과 그 검사 구멍 처리
7. 전화 인증 조건(Twilio 중단과 충돌)
8. LEVEL 2·3 검사 방법(검사 계정 0423doit@gmail.com 로그인 — 비밀번호는 채팅으로 받지 않음)
9. 회원탈퇴 DB 초안 실행 · KEY 운영 데이터 처리

판정: **LEVEL 1 통과 · LEVEL 2·3 확인 불가.** "AI 최종 PASS", "최종 완료", "비공개 베타 가능" 아님.
