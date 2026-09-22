# 「당신이 잠든 사이」 AI 대화 구조 — 실측·GAP·구현·검사 보고 (2026-09-22, 지시서 §20 형식)

## A. 실측 (실제 코드 기준. 확인한 것만 적음)
- 실제 route: 앱(app.do-it.company) `/doit/conversation` (대화), `/doit/understanding` (내가 확인한 이해), `/doit/connections` (연결 준비 = "당신이 잠든 사이" 화면), 시작 `/doit/start-journey` (목적 타일 = 첫 화면). 라우터 `src/router/config.tsx`.
- "잠든 사이" 문구 위치: 브랜드 히어로 `src/pages/do-it/hero/page.tsx`, 랜딩 `src/doit/app/plan-a/screens/LandingHero.tsx`, 연결 준비 `src/doit/components/feature/AsleepConnections.tsx`, 대화 하단 링크 `CoreConversation.tsx`.
- 화면 파일(AI 대화): `src/doit/components/feature/CoreConversation.tsx` (4버튼·질문 카드·처음부터), `src/doit/components/feature/ConversationOpening.tsx` (목적 타일 + 한 줄), `src/doit/pages/do-it/conversation/page.tsx` (회차·목적 저장).
- AI 호출: 화면 → `src/doit/lib/understandingApi.ts`(`understandingRequest`, requestId 멱등) → Edge Function `doit-understanding` (OpenAI `chat/completions`, `response_format: json_object`, 모델 `OPENAI_MODEL`→기본 gpt-4o-mini, 코드 `resolveModel`).
- 서버 함수: `supabase/functions/doit-understanding/index.ts` — 운영 = 버전 15(v13.3). 로컬 = **v13.5**(이번 작업, 미배포). 저장소 사본 `docs/…/PATCH-20260921-v13-first-conversation/supabase/functions/doit-understanding/index.v13.ts`.
- DB/저장(운영 실제 확인): `doit_records`(original_text·text·status), `doit_insights`(text·ai_text·status candidate/confirmed/corrected/rejected·origin ai/self·source_record_id·revision), `doit_request_events`(request_id·payload_hash·status·response_payload·context_hash·lease). RPC 14개(`doit_apply_*`, `doit_begin/finish_*`, `doit_followup_context`, `doit_get_followup`) — 본문 6개 md5 로컬 초안과 동일.
- 대화 history 전달: `doit_followup_context` 가 기록 1건 + 이 사용자의 이해 전부 + 목적을 묶어 context_hash 와 함께 넘긴다. 서버 `followupEvidence` 가 원문·확인한 말(정정·직접 설명 우선)·거절·(v13.5) 정정 전 AI 문장으로 정리한다. v13.4 부터 회차(`user_metadata.doit_round_started_at`) 이후 최근 기록 12개, v13.5 부터 이미 물은 질문(이벤트 저장분)도 넘긴다.
- 질문 생성 로직: `generateFollowup` → (v13.5) `pickStrategy` → 주제 판정(`judgeCoveredTopics`, 참고용 hints) → `composeFollowup`(LLM 후보 1개 → 서버 검사 → AI 판정 → 거절 의미 판정) → 실패 시 `fixedFallback`. 후보 없을 때 `buildRescue`.
- 질문 배열 하드코딩: **없음**(`grep "questions\s*[:=]\s*\["` 0건). 고정 문장은 첫 질문 1개(v13.5 `FIRST_QUESTION`), 실패 대체 3종(`fixedDirectionQuestion`·`RECOVER_FIXED`·`GENERIC_RESCUE`), 저장 금지 안내뿐.
- 현재 프롬프트: `PERSONA`(추측·진단 금지, 한 번에 질문 하나, 금지어) + `STRATEGY_GUIDE[strategy]` + `ACK_STYLE` + `QUESTION_STYLE` + 검사 자료 JSON(`strategy, record, confirmed, rejected, superseded, asked_questions, purpose, direction, hints`). 판정 프롬프트는 `composeFollowup` 안.
- 기존 "get-step-question"·"echo-journey": `supabase/functions/get-step-question`, `supabase/functions/echo-journey` 존재. 화면 연결은 `src/lib/echo/api.ts` → `/step/:n`(`src/pages/do-it/step-n/page.tsx`)뿐. Plan A(`/doit/*`)에서는 **호출하지 않는다(끊겨 있음)**.
- 기존 재사용 엔진(이름 ↔ 실제 코드): Context Memory = `followupEvidence`+`roundInfo`(있음, 이름 다름) / Correction Engine = `corrected` 우선 정렬·(v13.5) `superseded`(있음) / Rejected Semantic Block = `blockedByOverlap`+`judgeSemanticBlock`(있음) / Information Status = status 4값(있음, DB 제약) / Direction Lock = **코드 없음(문서 1건)** / Action Router = echo-journey·get-step-question 안에만(Plan A 미연결) / AI Core Orchestrator = **코드 없음(문서 1건)**.

## B. 발견한 문제
1. `index.ts` `generateFollowup`(v13.3/13.4): 다음 질문이 항상 "아직 안 나온 주제"를 정면으로 묻는 구조 → 직전 사용자 답과 이어지지 않고, 주제 순서가 사실상 고정 Q1→Q5 로 흐름(지시서 §4·§6 위반). 운영 기록(실제 서버): 구제 질문 "어떤 질문을 하고 싶으신가요?", "어떤 느낌인지 구체적으로 설명해 줄 수 있나요?" 등 되묻기·빈 질문.
2. `generateFollowup`/`composeFollowup`: 이미 물은 질문이 LLM 자료에 없고 반복 검사가 없음(§9③).
3. `composeFollowup`: 질문 하나 규칙·유도 질문 검사가 프롬프트 지시뿐(§8·§11).
4. `followupEvidence`: 정정 전 AI 문장(ai_text)이 아무 표시 없이 사라져 LLM 이 다시 전제로 쓸 수 있음(§9④).
5. 전략(strategy) 개념·필드 없음 → 거절·정정 뒤 "다음 질문 전략 변경"이 코드로 보장되지 않음(§7·§12).
6. `insight_generate` 응답에 내부 진단 `trace`·구제 종류 `kind` 노출(§21-11).
7. 화면 `CoreConversation.tsx`: 회차에 기록이 없을 때 안내 문구만 있고 첫 질문 문장이 없음(§3).
8. 운영 이벤트(실제 서버, 2026-09-21 22:13·22:17): `followup_generate` 가 `AI_ERROR` 로 끝난 요청 2건 = v13.3 에서 "질문 없음"이 그대로 실패로 감(v13.4 부터 대체 문장, 미배포).

## C. 수정 (전부 로컬. DB·RLS·운영 배포 0)
| 파일 | 변경 전 | 변경 후 | 이유 |
|---|---|---|---|
| `supabase/functions/doit-understanding/index.ts` (v13.5) | 전략 없음, 방향 주제 정면 질문 | `STRATEGIES` 6종 + `pickStrategy`(사용자의 최근 행동: 정정→ACKNOWLEDGE_CORRECTION, 직접 설명→EXPLORE_USER_MEANING, 거절→RECOVER_FROM_REJECTION, 확인→DEEPEN, 행동 없음: 12자 이하→CHANGE_DIRECTION, 그 외 EXPLORE). LLM 은 CHANGE_DIRECTION(원문 인용 필수)·CLARIFY(두 갈래 꼴)만 제안, 서버 검증 | §4·§7·§10·§12 |
| 〃 | 이미 물은 질문 미전달 | `askedQuestions`(이벤트 저장분, 회차 내 30개) → `asked_questions` 로 LLM 전달 + `repeatsAsked` 검사 → 반복이면 버리고 대체 문장 | §9③ |
| 〃 | 질문 수 검사 없음 | `singleQuestion`(물음표 1개, "A? 아니면 B?" 만 2개, 의문사 3개 이상 불허) | §8 |
| 〃 | 정정 전 AI 문장 소실 | `superseded` 목록을 LLM·판정에 "전제 금지"로 전달(글자 차단은 하지 않음 — 정정 뜻까지 막히므로) | §9④ |
| 〃 | 이어지기 검사 없음 | 새 갈래가 아니면 질문이 원문·확인한 말과 이어져야 통과(근거 인용/evidence 인용/핵심어) | §11 |
| 〃 | 판정 프롬프트 | 반복·복수 질문·유도·rejected/superseded 전제 불허 항목 추가 | §11 |
| 〃 | 실패 시 방향 고정 문장만 | `fixedFallback`: 거절 뒤엔 `RECOVER_FIXED`("제가 방향을 잘못 잡았네요…"), 그 외 hint 주제 문장, 마지막 `GENERIC_RESCUE`. 이미 물은 것·거절 겹침은 건너뜀 | 빠져나갈 문 |
| 〃 | 응답에 trace·kind | `publicRescue` 로 제거, `strategy` 추가. 실패 로그에 detail·strategy | §21-11·§21-12 |
| `src/doit/components/feature/CoreConversation.tsx` | 첫 화면 안내 문구 | `FIRST_QUESTION` 카드("당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요?") — 회차에 기록이 없고 보낼 한 줄이 없을 때만 | §3 |
| `src/doit/lib/coreConversation.ts` | rescue.kind 형 | kind 제거, `strategy` 보관(표시 안 함) | §21-11 |
| `qa/server-conversation-flow.test.mjs` | 15개 | 24개(TEST A–F, 질문 하나 규칙, 응답 노출 검사 추가) | §17 |

## D. 검사
| 검사 | 결과 | 근거 |
|---|---|---|
| 첫 질문 | PASS(가짜 화면 기준) | 앱 14차 번들에 문장 포함 확인(`out-app/assets/page-*.js`), 화면 검사 39/39 |
| 답변→다음 질문 변경 | PASS(가짜 AI 기준) | TEST A: 전략·원문이 LLM 에 넘어가고 답에 따라 CLARIFY 수용 |
| 그게 아니에요 | PASS(가짜 AI 기준) | TEST B: rejected 전달·같은 뜻 질문 폐기·RECOVER_FROM_REJECTION·원문 유지 |
| 조금 달라요 | PASS(가짜 AI 기준) | TEST C: corrected 최우선·superseded 전달·"좋아한다" 전제 질문 차단 |
| 직접 설명할게요 | PASS(가짜 AI 기준) | TEST D: self 가 confirmed 첫 항목, 인용 질문 통과 |
| 정정 기억 | PASS(가짜 AI 기준) | TEST C + 기존 정렬(정정 우선) |
| 거절 의미 차단 | PASS(가짜 AI 기준) | TEST B + 기존 거절 겹침 검사(글자·의미) + §21-11 구제 검사 |
| 반복 질문 방지 | PASS(가짜 AI 기준) | TEST F: asked_questions 전달·같은 질문 폐기 |
| 주제 전환 | PASS(가짜 AI 기준) | TEST E: 원문 인용 있으면 CHANGE_DIRECTION, 없으면 거부 |
| 저장·복구 | 확인 불가(코드·DB 함수로만 확인) | 저장→응답 순서·멱등은 함수 본문 대조(§21 대조표 3절). 실행 검사 없음 |
| Build | PASS | tsc 0(서버·화면), eslint 0, 단위 234/235 통과(실패 1 = 기존 step7-contract echo-boot, 이번 범위 밖), 앱 스모크 10/11(실패 1 = 샌드박스 Supabase 차단, 이전과 동일) |
| 실AI | **실AI 확인 불가** | v13.5 미배포 + 실계정 토큰을 요청·사용하지 않음. 운영 기록(실제 서버, v13.3)에서는 AI_ERROR 2건·되묻기 구제 확인됨(문제 B-1·B-8 근거) |

## E. STOP 항목
- DB: 변경 0 · RLS: 변경 0 · Migration: 변경 0 · Edge 운영배포: 변경 0(v13.4·v13.5 미배포) · 모델: 변경 0 · Secret: 변경 0 · 결제: 변경 0 · 운영배포(Netlify): 변경 0(ZIP 만 전달)

## F. 최종 판정
**일부 구현** — 로컬 구현·가짜 AI 검사 완료. "그게 아니에요 → 실제 다음 질문 변경"은 가짜 AI 기준으로만 증명됨. 실AI·실기기 확인 전에는 완료로 판정하지 않는다.

## G. 추가 (2026-09-22 09:50 KST 대표 실기기) — "여기서 질문이 생뚱맞았다"
- 실제 서버 기준(doit_request_events): 09:50:24 다음 질문 "연애에 대해 어떤 점이 가장 중요하다고 생각하나요?" → 사용자 답 "진실된마음" → 09:50:57 insight_generate 결과 = 후보 0(생성됨·근거 없음으로 탈락) → 구제 generic_question "방금 남긴 기록에서 가장 마음에 남는 부분은 어디였나요?", strategy CHANGE_DIRECTION, topic null.
- 원인 3가지: ① AI 근거 인용이 "진실된 마음"(띄어쓰기)이라 원문 "진실된마음"과 글자 그대로 안 맞아 후보를 버림 ② 주제 5개가 다 나온 상태라 새 갈래(direction)가 없는데 전략은 CHANGE_DIRECTION → AI 구제에 직전 질문·참고 주제가 안 넘어감 ③ 고정 대체 문장끼리 틀이 같아 "이미 물은 질문"으로 오인 → 마지막 일반 문장으로 떨어짐.
- v13.6(로컬, 미배포): 인용 검사 띄어쓰기·기호 무시(같은 모양 4곳), 직전 질문(last_question)을 AI에 전달(구제·다음 질문 모두), 주제가 다 나오면 CHANGE_DIRECTION → EXPLORE_USER_MEANING(답을 질문과 함께 읽고 한 걸음 더), 대체 문장은 정확히 같을 때만 반복으로 판정, 마지막 대체 문장은 사용자 답 인용("…라고 답하셨죠. 그렇게 느낀 순간이 있었다면…"), 구제 단계 로그(step).
- 검사(가짜 AI 기준): 흐름 28/28(재현 검사 4개 추가), tsc 0. 실AI: 확인 불가(미배포).
