# CTO A/B Spike 보고 — Relationship Agent (2026-09-25)

근거: 대표 「CTO ARCHITECTURE DECISION · RELATIONSHIP AGENT A/B SPIKE · FINAL EXECUTION LOCK」(텍스트 기준본).
- **운영 변경 0.** Edge·Netlify·DB·RLS·Migration·Auth·Secret·모델·결제·가격·KEY·운영 데이터를 바꾸지 않았다.
- 운영에서 한 일은 **읽기만**이다: 로그 조회, SQL SELECT.
- 새 코드는 `product/spike/ab-20260925/` 한 곳에만 있다. 배포 경로(supabase/functions)와 앱 빌드(src) 밖이다.
- 판정 표기: PASS / FAIL / 목표 미달 / 확인 불가. **[MOCK] 결과를 실AI 결과로 쓰지 않는다.**

## 먼저 밝히는 것 (내 실수)
- 처음 만든 가짜 AI 응답(MOCK)이 A 를 불리하게 만들었다.
  - 원인 1: 모든 질문에 같은 문장 틀을 써서, A 의 글자 유사도 반복 검사에 스스로 걸렸다.
  - 원인 2: A 서버가 고른 출발 문장과 다른 곳에서 단서를 골랐다.
  - 결과: A 에만 "질문 생성 실패 8건"이 나왔다.
- 이 숫자는 A 의 결함이 아니라 가짜 응답이 만든 왜곡이다. 폐기했다.
- 가짜 응답을 A·B 모두 "정상 경로만 타는 모양"으로 고쳐 다시 쟀다. MOCK 표에서는 재시도·실패 0 이 정상값이다.
- 실제 실패는 운영 로그(실제 AI)로만 판정했다.

---

## [CURRENT STACK · ACTUAL] (저장소·운영 읽기로 실측)
| 층 | 실측 |
|---|---|
| Frontend | React ^19.1.0 · react-dom ^19.1.0 · react-router-dom ^7.6.3 · Tailwind ^3.4.17 |
| Build / Runtime | Vite ^8.0.1 · TypeScript ~5.8.3 · Node v22.22.2(작업 환경). **Next.js 는 package.json 에 없음** |
| Supabase client | @supabase/supabase-js 2.117.1 |
| DB / Auth | Supabase Postgres + Supabase Auth |
| Edge Functions(운영) | 10개. doit-understanding v27 · doit-connect v5 · doit-account v1 · doit-photo-check v1 · openai-chat v2(verify_jwt=false) · get-step-question v48 · echo-journey v26 · echo-payment v2 · admin-conversations v2 · admin-dashboard v1 |
| OpenAI adapter | doit-understanding 안의 `callOpenAI` → `openAIAdapter.generateRelationshipTurn`. `https://api.openai.com/v1/chat/completions`, temperature 0.2 · top_p 0.9 · max_tokens 768(turn) · `response_format: json_object` |
| 모델 설정 | `resolveModel(OPENAI_MODEL)` — 비었거나 오타 `gpt-40-mini` 면 `gpt-4o-mini`. 운영 Secret 값은 읽지 않았다 → **운영의 실제 모델명은 확인 불가**(Secret 을 읽지 않는 한 알 수 없음) |
| Agent entry point | 앱 `CoreConversation.tsx` → `api.turn()` → Edge `doit-understanding` 의 action `"turn"` → `handleTurn` |
| Conversation component | `src/doit/components/feature/CoreConversation.tsx` (운영 앱 = 배포 `6ab576b1…` = ZIP `42df9c26…`) |

## [CURRENT AGENT A · SHA / CALL GRAPH]
- **A = 운영 doit-understanding 버전 27, SHA-256 `1aab64236bb7c9a41aa40459f0c320abca296e1c928fd76007de2d26b790c450`**
  - 대표 승인 지문이다. 운영 목록 수정 시각 2026-09-24T13:45Z 와 같다.
  - 227,649바이트 · 2,739줄.
  - 하네스는 이 파일(`docs/…/PATCH-20260924-agent-v1.1/rollback/doit-understanding.v27.ts`)을 실행 전에 지문을 대조한 뒤 그대로 읽는다.
- 로컬 후보 v1.1(`c8c0cf85…`)은 A 가 아니다(운영 미배포).
- **A 조건 기록(§33)**: 운영 앱 `42df9c26…` 은 v1.1 의 `recent`(최근 대화 3줄)를 보낸다. 운영 v27 은 이 값을 한 번도 읽지 않는다(코드에 `recent` 0회). 그래서 A 동작에는 쓰이지 않는다.

```
사용자 입력(화면)                                            [CLIENT] CoreConversation: text · answeredQuestion(떠 있던 질문) · recordId · pendingCorrection · recent(무시됨)
 → Edge doit-understanding · Deno.serve                     [SERVER] Bearer 확인 → auth.getUser → 분당 60회 제한 → action 확인
 → handleTurn
   ① 입력 검사                                              [SERVER] 빈 입력 · 2,000자 · 저장 금지 입력(연락처·번호·링크·성적 표현)
   ② 같은 요청 재전송이면 저장된 결과 반환                  [SERVER] doit_records.request_id · followup_skip 이벤트
   ③ 상태 읽기 6개(병렬)                                     [SERVER] 이번 회차 답 · 물은 질문 · 거절 · insights 200 · 목적 · 끝났는지
   ④ 말 종류 규칙 분류 ruleKind                             [SERVER] 정규식 41개(되묻기 12 · AI에게 묻기 8 · 불만 10 · 지침 7 · 정정 4) + 모르겠어요 1
      · 지친 말 / 설명 없는 「그게 아니에요」 → LLM 없이 고정 답 반환
   ⑤ 「다음 질문 받기」면 저장된 질문 먼저(LLM 0번)          [SERVER]
   ⑥ runV16Turn: LLM 1회(검사에 걸리면 1회 더, 최대 2)       [LLM] 종류·출발 단서·짧은 반응·다음 질문·기억 후보·자기 표시 4개
      입력 18항목: purpose · answered_count · remaining · user_text · server_turn_type · skip · last_question · last_answer ·
      hot_memory(저장된 답 3턴만) · confirmed · corrected · unconfirmed · rejected · superseded · correction_target · already_asked · facts · previous_attempt
   ⑦ checkV16Question 8검사                                 [SERVER] no_question · multi · fixed_line · unsafe · self_flag · repeat(글자쌍 유사도) · rejected(글자쌍+키) · clue(단서가 출발 문장 안에 글자 그대로)
   ⑧ 짧은 반응 정리 cleanV16Ack                             [SERVER] 40자·물음표·금지어·고정 문장·거절 겹침이면 뺌
   ⑨ 저장/비저장 · 정정 저장 · 다음 질문 저장(begin/finish RPC)  [SERVER]
 → 응답(질문 or questionError "다음 질문을 아직 만들지 못했어요")
```
- **최신 사용자 원문이 변형·삭제되는 곳**: 원문 자체는 `doit_records.original_text` 에 그대로 남는다.
  - 다만 LLM 이 보는 `hot_memory` 는 **저장된 답만** 담는다(`v16History` ← `roundRecordsAt`).
- **저장하지 않은 meta 발화가 사라지는 곳**: 되묻기·불만·문제제기는 저장하지 않는다(설계대로). 그래서 **다음 턴 LLM 입력에 흔적이 0**이다.
  - 예: 「몇번째 같은말이야!!」는 그 턴의 `user_text` 로만 한 번 들어가고, 이후 턴에는 없다.
- **question_intent**: A 에는 없다. 질문의 "뜻"을 기록하는 칸이 없고, 반복은 질문 문장을 글자쌍으로 비교해서만 막는다.
- **반복 차단 위치**: `checkV16Question` 의 `repeat` 검사 = `repeatsAsked`·`looksSame`. 공식은 `sim>0.6` 또는 `overlap>0.7` 이다.
  - LLM 이 스스로 반복이라고 표시(`repeats_asked`)하면 `self_flag` 로 떨어뜨린다.

## [A COMPLEXITY] (정상 턴, 코드 실측)
| 항목 | 값 |
|---|---|
| 서버 결정 단계 | ①~⑨ 9단계 · `handleTurn` 219줄 · if 분기 50 · return 43 |
| LLM 호출 | 정상 1 · 최대 2 (운영 실측 11턴 평균 1.36) |
| Prompt 크기 | system 1,492 토큰(o200k 기준) + 입력 JSON 평균 297 토큰(MOCK 하네스 17턴) |
| Context 항목 | 18개(위 ⑥) — `answered_count`·`remaining` 포함(기준본 §9 에서 B 금지 항목) |
| Validation | 질문 8검사 + 짧은 반응 6조건 + 기억 인용 1 |
| Retry | 최대 1회(사유 코드 11종 피드백) |
| 휴리스틱 | 아래 표 |

| 휴리스틱 | 목적 | 추가된 계기 | 지금 필요한가 |
|---|---|---|---|
| 규칙 분류 정규식 41+1개(ruleKind) | LLM 전에 되묻기·불만·지친 말·정정을 서버가 확정 | v14.3~v15.1 실사용 오분류 | **[HEURISTIC / NEEDS VALIDATION]**. 「취미생활?」 → 6글자 이하+물음표 규칙이 meta 로 강제 → 운영 v27 에 그대로 남아 있음(FAIL #3 원인). 지친 말·설명 없는 정정 규칙은 LLM 호출을 아끼는 이점이 있다 |
| 글자쌍 반복 검사(`looksSame` sim .6/ov .7) | 같은 질문 재출제 차단 | v13~v14 반복 | **효과 없음 실측**: 운영 갤럭시 질문 5개 쌍 10개 모두 sim ≤0.39 · overlap ≤0.59 → 전부 통과. 뜻이 같아도 표현이 다르면 못 막는다 |
| 거절 겹침(`blockedByOverlap` 글자쌍+키) | 거절한 해석 재등장 차단 | v13 Correction Engine | [HEURISTIC / NEEDS VALIDATION] — 같은 한계(표현이 바뀌면 통과) |
| 단서 인용 검사(`clue` = 원문에 글자 그대로) | "방금 말에서 출발"을 강제 | v16(LEVEL 3 FAIL #2) | **운영 실패 원인 실측**: 04:22:13 후보 2개 모두 `clue` 로 떨어져 질문 생성 실패(AI_ERROR) |
| LLM 자기 표시 4개 → 즉시 탈락(`self_flag`) | 반복·거절·미확정·목적 밖 자진신고 | Agent v1 | **운영 실패 원인 실측**: 04:25:48 불만 턴 후보 2개 모두 `self_flag` → 실패 |
| `answered_count`·`remaining` 입력 | 모델이 남은 칸을 앎 | v15 5칸 | [HEURISTIC / NEEDS VALIDATION] — FAIL #3 강한 가설(칸 채우기 질문) · 기준본 §9 금지 |
| 짧은 반응 40자·물음표·고정문장 | 틀 문장 되풀이 방지 | v13.7 | 부작용 적음(빼기만 함) |

## [MINIMAL AGENT B]
- 파일(로컬 진단용): `product/spike/ab-20260925/`
  - `agentB.mjs`: SHA-256 `f9dd3b2d…`
  - `agentB.test.mjs`: `834471ad…`
  - `run-ab.mjs`: `ab18e7fa…`
- **LLM 입력 11항목**: purpose · recent(최근 4턴, 저장 안 한 되묻기·문제제기 포함 + 종류) · last_question · last_answer · latest · confirmed(최대 5) · correction(최신 1) · rejected · rejected_intents · asked_intents · facts.
  - 금지 항목 0: remaining·answered_count·주제·칸 순서·미리 정한 질문·기억 덤프.
  - 검사로 확인했다(MOCK).
- **LLM 출력**: turn_type · answer_to_user · basis_quote · understanding · curiosity · question_intent · same_intent_as · next_question · memory_candidate.
- **모델 조건 = A 와 같음**: 엔드포인트 · temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object.
- **서버가 정하는 것**
  - 저장/비저장: answer·unsure·correction 만 저장. unsure 는 저장하되 유효 답이 아니다.
  - 정정 최신 우선: 직전 AI 문장을 거절 목록에 넣는다.
  - 문제제기(repair)로 읽힌 순간 직전 질문 의도를 거절 의도로 기록한다. 같은 턴의 다시 만들기에도 반영된다.
  - 이미 물은 의도·거절 의도와 "같은 뜻"이면 차단한다. 방식은 LLM 이 준 `question_intent` 를 정규화해 같음만 보는 것과, LLM 자진 `same_intent_as` 다. **글자쌍·n-gram % 0**.
  - 물음표 하나 · 금지어 · 개인정보 · 저장 금지 입력(LLM 0번).
  - 유효 답 5개면 통합 이해 단계로 전환한다. 남은 턴 수는 LLM 에 알리지 않는다.
  - 기억 후보는 원문 인용이 맞을 때만 "후보"로 남긴다. 사실은 최종 4버튼에서만 된다.
- **서버가 하지 않는 것**: 질문 문장 작성 · 다음 주제 결정 · 질문 소재 지정 · 카테고리 강제 · 고정 질문 · 글자 규칙으로 문장 고치기.
- **B 에서 유지하지 못한 것(정직하게)**: A 의 정규식 규칙 분류가 없다.
  - 지친 말·설명 없는 「그게 아니에요」도 LLM 을 부른다. Golden Set 에서 A 보다 LLM 턴이 2개 많다(15 → 17).
  - Audit 는 턴마다 결과만 남긴다(원문 0).
- **검사 [MOCK]** `agentB.test.mjs` **10/10**
  - 입력 금지 항목 0 · 정상 1회 · 이미 물은 의도 차단 뒤 상한 2 · 문제제기 저장 0 + 거절 의도 기록 · 되묻기 먼저 답 · 정정 우선 · 모르겠어요 유효 답 제외 · 5개 뒤 전환 · 저장 금지 입력 LLM 0 · 형식 실패 · 물음표/금지어
  - **내 실수**: 처음엔 문제제기의 거절 의도를 AI 응답 뒤에 기록해서, 같은 턴 다시 만들기 입력에 빠졌다. 검사가 잡아 고쳤다.

## [GOLDEN FAILURE SET]
| Flow | 입력(대표 실제 문장, 새 예문 0) | 출처 |
|---|---|---|
| FLOW1 | 가볍게 우선 사람을 알아가고 싶어 → 나 진심이라고 적은거 같은데 → 마음이지머 → 행동으로 보여줄때 → 적었자네 → 몇번째 같은말이야!! → 행동이라고!! | 운영 Galaxy 2026-09-25 04:20~04:26 KST (목적 「아직 정하지 않았어요」, 운영 DB 읽기) |
| FLOW2 | 그냥 편한친구 부담없이 → 활동?갑자기? → 취미생활? → 왜 그걸 물어봐? → 그게 아니에요 → 활동 말고 편하게 대화하는 친구를 원한다는 거예요(직접 정정) → 모르겠어요 → 할말이없다 휴 | LEVEL 3 FAIL #1~#3 · 지시서 |
| FLOW3 | 싸이클 테니스 골프(짧은 정상 답) → 나는 사람을 빨리 만나는 것보다 천천히 알아가고 싶어.(긴 정상 답) | LEVEL 3 FAIL #3 · LEVEL 3 실제 |

- 「직접 정정」 한 줄은 대표 원문이 기록에 없어, FLOW2 의 앞 문장을 고치는 형태로 만들었다. **[새 문장 1개 — 대표 확인 필요]**

## [A vs B RAW OUTPUT]
### A — 운영 실측(실제 서버 · 실제 OpenAI · Galaxy · 2026-09-25 04:20~04:26 KST · 원문 미열람)
AI 질문 문장은 운영 `doit_request_events` 에서, 처리 결과는 운영 함수 로그(원문 없음)에서 읽었다.

| 시각 | 동작 | 결과 | LLM 호출(ms) | 재시도 사유 | 나간 질문 |
|---|---|---|---|---|---|
| 04:20:47 | 다음 질문 받기 | question | 1 (4040) | — | 그 중에서 어떤 취미가 가장 즐거운가요? |
| 04:22:13 | 답 저장 → 다음 질문 | **failed:clue** | 2 (3209·2854) | clue, clue | (질문 생성 실패) |
| 04:22:21 | 다음 질문 받기 | question | 2 (2263·2009) | clue | 사람을 알아가는 데 어떤 점이 가장 중요하다고 생각해요? |
| 04:22:41 | 되묻기(규칙) | question | 1 (2654) | — | 사람을 알아가면서 어떤 점이 가장 즐거운 것 같아요? |
| 04:23:08 | 답 저장 → 다음 질문 | question | 1 (2427) | — | 진심으로 사람을 알아가는 데 어떤 점이 특별하다고 느끼나요? |
| 04:23:41 | 답 저장 → 다음 질문 | question | 2 (2208·2018) | repeat | 사람을 진심으로 알아가는 과정에서 어떤 점이 가장 마음에 드나요? |
| 04:24:31 · 04:24:41 · 04:25:15 | AI에게 묻기 ×3 | reply | 각 1 | — | (답변 문장은 저장되지 않아 확인 불가) |
| 04:25:48 | 불만(문제제기) | **failed:self_flag** | 2 (1700·2033) | self_flag, self_flag | (질문 생성 실패) |
| 04:26:09 | AI에게 묻기 | reply | 1 (2100) | — | — |

- 로그 줄과 FLOW1 문장의 1:1 짝은 원문을 열지 않아 확정하지 않았다(순서·종류는 FLOW1 과 맞는다).

### B — 실제 AI: **확인 불가**
- OpenAI 서버에는 접속된다: 키 없이 요청하면 401.
- 이 작업 환경에 `OPENAI_API_KEY` 가 없다. 키를 새로 만들거나 Secret 을 바꾸는 것은 금지(§27)라 실행하지 않았다.

### A·B — [MOCK] 하네스(같은 입력·같은 모델 조건 · 가짜 AI)
- 전체 표는 `MOCK_하네스결과_20260925.md` 에 있다.
- 출력 문장은 가짜라 **품질 판정에 쓰지 않는다.** 서버 결정(저장/비저장·규칙 분류·LLM 을 부르는지)만 실제 코드 그대로다.

## [CALLS / TOKENS / LATENCY / RETRY]
| 항목 | A 운영 실측(실제 AI, n=11턴·15호출) | A [MOCK] 17턴 | B [MOCK] 17턴 |
|---|---|---|---|
| LLM 을 부른 턴 | 11 | 15 | 17 |
| 호출/LLM 턴 | 1.36 | 1.00 | 1.00 |
| system 토큰/호출 | — (usage 미기록) | 1,492 | 640 |
| 입력 JSON 토큰/호출 | — | 297 | 272 |
| 입력 토큰 합(17턴) | — | 26,842 | 15,510 (−42%) |
| 재시도 | 6 (clue 3 · repeat 1 · self_flag 2) | 0 | 0 |
| 질문 생성 실패 | 2/11 턴 | 0 | 0 |
| LLM 지연(ms/호출) | 중앙값 2,100 · 최소 1,700 · 최대 4,040 (n=15) | 판정 불가 | 판정 불가 |
| 턴 전체(ms) | 중앙값 2,967 · 최소 2,175 · 최대 7,029 (n=11) | 판정 불가 | 판정 불가 |
| DB(ms/턴) | 중앙값 304 · 최대 954 (n=11) | — | — |

- 표본이 11턴이라 p50/p75/p95 는 계산하지 않았다.
- **비용(원)은 계산하지 않았다**: 실제 모델명(Secret)과 실제 usage 토큰을 확인하지 못했다.
- **Context 구성**(호출 1번당 평균 토큰, MOCK 하네스 실측)
  - A: facts 128 · already_asked 40 · **hot_memory 32(저장된 답만)** · last_question 14 · 기타 각 ≤10
  - B: facts 90 · **recent 79(저장 안 한 문제제기 포함)** · last_question 15 · asked_intents 15 · 기타 각 ≤10
  - 입력 토큰 차이의 대부분은 **system 프롬프트(1,492 대 640)**에서 난다.

## [BLIND REVIEW SHEET]
- 실제 AI 출력이 없어 **대표 블라인드 검수는 할 수 없다(확인 불가).**
- 하네스에 자동 생성 기능은 넣었다.
  - 실제 키로 `--blind 검수표.md --key 열쇠.json` 을 붙여 돌리면, 턴마다 A/B 를 OUTPUT 1/2 에 무작위로 놓은 표와 따로 보관하는 열쇠 파일이 나온다.
- MOCK 검수표는 문장이 가짜라 쓰지 않는다.
- 내가 B 를 승자로 판정하지 않는다(§20).

## [INFRASTRUCTURE EVIDENCE] — 기반 장애 증거 없음
- 운영 11턴 모두 함수 부팅·인증·DB·OpenAI 응답이 정상이었다.
  - 두 실패 턴도 HTTP 200 에 `questionError` 를 담아 돌려주는 코드 경로다(v27 `handleTurn` ③·④).
  - 시간 초과 0 · provider 오류 0 · DB 최대 954ms.
- 질문 생성 실패 2건(그중 1건이 `doit_request_events` 에 AI_ERROR 로 남음)은 인프라가 아니다: **서버 검사가 후보를 떨어뜨린 결과**다(`failed:clue`, `failed:self_flag`).
- → 분류 **A(INFRASTRUCTURE) = 해당 없음**(이번 실패들에 대해).

## [ORCHESTRATION EVIDENCE] — 실측으로 확인
1. 단서 글자 인용 검사(clue)가 정상 답 뒤 질문을 두 번 모두 떨어뜨려 실패했다(04:22:13). **→ B**
2. 불만 턴에서 LLM 자기 표시(self_flag)가 곧바로 탈락이 되어 두 번 모두 실패했다(04:25:48) = 「몇번째 같은말이야」 뒤 질문 생성 실패. **→ B**
3. 글자쌍 반복 검사가 같은 뜻의 질문 4개(「사람을 (진심으로) 알아가는 … 어떤 점이 …」)를 **모두 통과**시켰다. 10쌍 중 최대 sim 0.39 / overlap 0.59, 기준 0.6 / 0.7. A 에는 질문의 "뜻"(question_intent)을 적는 곳이 없다. **→ B**
4. 저장하지 않은 문제제기가 다음 턴 LLM 입력에 0 이다(hot_memory = 저장된 답만). 사용자가 "같은 말"이라고 해도 다음 턴 모델은 그 말을 모른다. **→ B**
5. 「취미생활?」 같은 짧은 물음표 답을 정규식이 되묻기로 강제한다. 운영 v27 에 그대로 있다. **→ B**
6. LLM 입력에 `answered_count`·`remaining`(칸 채우기 신호)이 있다. **→ B/D, 가설**

## [MODEL EVIDENCE] — 확인 불가
- 같은 모델로 B 구조를 실제로 돌리지 못했다(키 없음).
- A 에서 모델이 같은 뜻을 되풀이한 것은 사실이다. 하지만 그때 입력(위 4·6)이 이미 불리했다. 그래서 모델 탓인지는 분리되지 않았다.
- → **C = 확인 불가.** B 실제 실행이 먼저다(§22: 둘 다 실패할 때만 모델 비교).

## [PRODUCT CONTRACT EVIDENCE]
- 운영 v27 의 "대화 끝"은 이번 회차 저장 기록 5개다(`roundFinished`: 거절 외 기록 수 ≥ `TOPICS.length`). **「모르겠어요」도 5개에 들어간다.**
  - 기준본 §15(유효 답 5개)와 다르다 → **D**.
  - B 는 unsure 를 유효 답에서 뺐다.
- 5턴이 주제 칸 수(`TOPICS.length`)에 묶여 있고, 그 칸 정보가 LLM 에 새어 들어간다(위 6) → **D/B**.
- Correction·Rejection·원문 보존·4버튼 계약 자체의 결함 증거는 이번에 없다.

## [B WIN 여부] — 확인 불가
- 구조상 차이(MOCK·코드 실측): 입력 토큰 −42% · 규칙 정규식 0 · 뜻 단위 반복 차단 · 문제제기 기억 유지.
- 대신 LLM 턴은 +2 이다.
- **대화 품질의 승패는 실제 AI 없이 판정하지 않는다.** 한두 예시로 승리 선언하지 않는다(§31).

## [기술스택 교체 필요 여부] — 아니오
- 실패 원인이 기반(Supabase·Edge·Postgres·OpenAI 연결)에서 나온 증거가 없다(위 INFRA).
- React/Vite + Supabase + OpenAI 유지가 맞다. §24 조건에 해당하는 증거 0.

## [다음 대표 승인 필요 범위]
1. **실제 AI A/B 1차 실험 실행(유일한 차단)**: 이 작업 환경에 OpenAI 키를 넣는 것.
   - Secret 신규 배치라 대표 승인이 필요하다.
   - 방법: 세션 제목 줄의 클라우드 환경 메뉴 → Edit → 환경 변수 `OPENAI_API_KEY` 추가 → 새 세션.
   - 키를 채팅에 붙이지 않는다. 운영 Supabase Secret 은 바꾸지 않는다.
   - 과거에 이 메뉴가 대표 화면에서 눌리지 않은 기록이 있다(2026-09-24).
2. 실행 후 대표 블라인드 검수 → 결과에 따라 §21(Conversation Core 를 B 구조로 바꾸는 제안) 또는 §22(모델만 비교).

## [변경 0 / 변경 파일]
- 운영: 0(Edge·Netlify·DB·RLS·Migration·Auth·Secret·모델·결제·가격·KEY·운영 데이터).
- 제품 코드(`src`·`supabase/functions`): 0. Current Agent A 코드·Prompt·휴리스틱: 0.
- 새 파일
  - `product/spike/ab-20260925/agentB.mjs`, `agentB.test.mjs`, `run-ab.mjs`
  - 이 문서 · `MOCK_하네스결과_20260925.md` · CLAUDE.md 한 줄
- 검사 도구 `js-tiktoken`(토큰 세기)은 작업 공간 `scratchpad/tools` 에만 설치했다(제품 의존성 0).
- 검사
  - [MOCK] B 10/10
  - lint 0 · type-check 0(spike 포함)

## [Conversation P0 판정] — **FAIL 유지**
- 운영 A 가 실제 AI 로 반복 질문과 질문 생성 실패 2/11 턴을 냈다.
- B 는 실제 AI 로 검증되지 않았다(확인 불가).
- Mock PASS 를 실AI PASS 로 쓰지 않는다.
