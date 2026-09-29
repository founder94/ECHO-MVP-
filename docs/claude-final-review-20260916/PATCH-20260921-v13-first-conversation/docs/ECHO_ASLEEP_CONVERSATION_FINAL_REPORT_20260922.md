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

## H. 추가 (2026-09-22 10:41~11:25 KST) — v13.6 운영 배포 확정 + 외부 검토 반영
- **배포 확정(실제 서버 기준, 읽기 전용 재확인)**: 함수 `doit-understanding` 버전 **17** / ACTIVE / verify_jwt=true / 수정 시각 2026-09-22 10:41:57 KST. 소스 첫 줄 `v13.6 · 2026-09-22`. 내려받은 index.ts SHA-256 = `d10486da7a5633e623d588f13194ca274929bcd796fba6c3aefa1bf289360cc2` = 로컬 파일과 동일. 무인증 POST 401 확인.
- **외부 검토(대표 전달)와의 차이**: 검토는 "버전 16 / v13.5 / 수정 09:25:19 KST"를 보고했다. 09:25:19 는 **v13.5 배포 시각**이며, v13.6 배포(10:41:57)보다 앞선다. 즉 그 조회는 v13.6 배포 이전 상태이거나 캐시된 값이다. 같은 주소를 두 번 다시 읽은 결과는 모두 버전 17·v13.6 이었다.
- **검토 지적 반영(코드)**: 연결 화면 `AsleepConnections.tsx` 문구 수정 — 숫자는 "겹친 사람 수"일 뿐 추천이 아니라고 화면에 명시, 자격이 갖춰져도 "실제 상대 추천은 아직 열리지 않았다"고 표시, 대화 횟수(7회 등)로 추천이 열리지 않는다고 명시. 서버 변경 없음(배포 불필요).
- **고정 질문 목록 없음 재확인**: `grep "questions\s*[:=]\s*\["` = 0건. 질문은 직전 원문·확인·정정을 근거로 매번 생성되며, 고정 문장은 실패 대체·되묻기·저장 금지 안내뿐.
- **7단계 → 추천 전환 계약**: 서버에 존재하지 않음(검토 판정과 같음). `connection_preview` 는 준비 상태·대기 인원·겹친 수만 돌려주며 상대 신원·사진·승인 저장은 구현 0.
- 검사: 단위 216 중 215 통과(실패 1 = 기존 step7-contract, 범위 밖), tsc 0, eslint 0, 앱·브랜드 빌드 0.
- ZIP: `ECHO-APP-15차-app.do-it.company-v13.6확정.zip`, `ECHO-BRAND-15차-do-it.company.zip` (SHA256 `ZIPS_SHA256_15차.txt`).

## I. 추가 (2026-09-22 15:16~15:55 KST) — v13.7 운영 배포 + 전환 화면
### 1) 대표가 실기기에서 본 문제 (실제 사용 기준)
- 질문이 깨져서 나왔다: "…상대에게 바라는 <답변 전체>은 어떤 모습일까요?" — 답을 통째로 붙여 문장이 성립하지 않았다.
- 말투가 기계 같았다: "그렇군요"만 반복하거나, 공감이 과했다.
- 「시작하기」를 누르면 프로필 화면이 잠깐 보였다가 갑자기 대화 화면으로 바뀌었다.

### 2) 원인 (운영 기록 기준, 추측 아님)
- `doit_request_events` / function_logs 에서 `FOLLOWUP_NOT_GROUNDED` 확인 → AI가 만든 질문이 근거 판정에서 떨어짐 → 전략 DEEPEN 의 **고정 대체 문장**으로 빠짐 → 그 대체 문장이 사용자 답을 그대로 끼워 넣는 틀이라 긴 답변에서 문장이 깨졌다.
- 화면 전환은 `start-journey` 가 `navigate(...)` 직전에 다음 단계(프로필)를 한 프레임 그려서 생긴 깜빡임이었다.

### 3) 고친 것 (서버 v13.7 · 버전 18)
- `fixedAnswerQuestion()`: 인용은 **14자 이하 짧은 말일 때만**. 길면 인용 없이 "그 마음이 상대에게서 어떤 모습으로 보이면…" 으로 되묻는다. → 문장이 깨지는 경로 제거.
- `judgeOnce()` 재판정: AI 질문이 근거 판정에서 떨어지면, 버리기 전에 **직전 질문으로 한 번 더 판정**해서 통과하면 그걸 쓴다(`step: ack_dropped_pass`). → 고정 대체 문장으로 떨어지는 빈도 자체를 줄였다.
- 말투 규칙: 질문에 사용자 답 전체를 붙여넣기 **금지**, "그렇군요" 정도의 짧은 받아주기는 허용하되 과장된 공감·반복은 금지.

### 4) 고친 것 (화면)
- `start-journey/page.tsx` 에 `leaving` 상태 추가 — 대화로 넘어갈 때 다음 단계를 그리지 않고 **"대화를 준비하고 있어요" 전환 화면**을 먼저 보여 준다. 그 화면에 **심볼 회전 효과**(`.echo-leaving` + `echo-thinking-orbit`)를 넣어 기다리는 구간이 비지 않게 했다.
- CSS 는 전부 `.echo-dialogue` 페이지 루트 아래로만 — 전역(body/:root/index.css) 오염 0.

### 5) 검사 (앞에 진짜/가짜를 붙인다)
- **가짜 AI 기준**(테스트용 가짜 서버 응답): 대화 흐름 31/31 통과(v13.7 회귀 검사 포함).
- **실제 서버 기준**: 배포 확인만 가능 — 버전 **18** / ACTIVE / verify_jwt=true / 내려받은 index.ts SHA-256 `f79979079b8c88df885dce72d2800365bb395c8e5ba22b071381c4b15165ac6b` = 로컬 파일과 동일 / 무인증 POST **401**. 실제 AI가 만드는 문장 품질은 **대표 실기기 확인 전까지 확인 불가**.
- tsc 0, eslint 0, 전체 218 통과 / 1 실패(`qa/step7-contract.test.mjs` 첫 화면 지연 검사 — 이번 변경 이전부터 있던 실패, 범위 밖. 통과로 세지 않는다).
- 빌드 산출물: sourcemap 0개, `mirror_`/Stripe 0건, service_role·API 키 문자열 0건, ZIP 단독 해제 후 재검사 통과.

### 6) 남은 것 (아직 아무도 안 써봤다)
- 대표 실기기에서 v13.7 대화 품질 확인(깨진 문장 사라졌는지, 말투가 사람 같은지, 전환 화면 심볼이 도는지).
- 전화 인증, PENDING SQL 2건, 연결 후보·대표 승인 화면은 여전히 미구현.

## J. 추가 (2026-09-22 16:00~16:40 KST) — 지금까지 상태 점검 + 관리자 "AI 대화 기록" 화면
### 1) 점검 결과 (실제 실행한 검사만 적는다)
| 검사 | 전 | 후 |
|---|---|---|
| 타입 검사(tsc) | 0 | 0 |
| 문법 검사(eslint) | 0 | 0 |
| 전체 검사 | 221개 중 **218 통과 / 1 실패** / 미확정 2 | 225개 중 **223 통과 / 0 실패** / 미확정 2 |

미확정 2건은 통과로 세지 않는다: `[미확정] STEP 1 → 7 완주율 100%`, `[미확정] 깊은 여정: 거절·정정 뒤에도 막다른 길 0건`. 둘 다 "가짜 모델의 표현 고갈인지 진짜 모델에서도 나는지" 실계정 확인이 필요하다.

### 2) 오래 남아 있던 실패 1건 — 원인은 진짜 결함이었다
검사 이름: `first screen renders without a blank lazy-loading gap`. 그동안 "범위 밖"으로 넘겼는데, 확인해 보니 **검사가 옳았고 코드가 틀렸다.**
- `src/router/index.ts` 의 Suspense 대기 화면이 `fallback: null` 이었다. 즉 **화면을 옮길 때마다 조각(chunk)을 받는 동안 아무것도 안 그린다.** 대표가 말한 "화면이 갑자기 바뀐다"와 같은 뿌리다. v13.7 에서 고친 건 「시작하기 → 대화」 한 곳뿐이었고, 나머지 전부가 그대로였다.
- 고침: `RouteFallback` 추가 — 250ms 동안은 아무것도 안 그려 빠른 화면에서 글자가 번쩍이지 않게 하고, 그 뒤 어두운 배경 + 심볼 회전 + "화면을 준비하고 있어요."를 보여 준다. 가짜 진행률(%)은 넣지 않는다.
- 진입 화면(`/`)은 원래 정적 import 라 이 대기 화면을 거치지 않는다 — **랜딩 즉시 표시는 그대로다.**
- 검사는 옛 구현(`echo-boot`, `/home` 정적 import)을 확인하고 있어 현재 구조(`DoItEntry` + `DoItLandingPage` 정적 import)에 맞춰 갱신했다. 통과시키려고 고친 게 아니라, 진짜 결함을 고친 뒤 계약을 현재 구조로 옮겨 적었다.

### 3) 관리자 "AI 대화 기록" 화면 (신규)
- 위치: `/doit/admin/mobile` → 왼쪽 메뉴 **「AI 대화 기록」**.
- 읽는 표: `doit_records`(적은 답), `doit_insights`(AI 이해 + 4버튼 결과), `doit_request_events`(질문 생성·실패 기록).
- 보여 주는 것: 적은 답 수 / AI 이해 수 / 맞아요·조금 달라요·그게 아니에요 집계, 최근 50건 표 2개.
- **정직 장치**: 못 읽은 것을 0건으로 보여주지 않는다. `blocked`(권한 막힘) · `missing`(표 없음) · `empty`(진짜 0건) 을 구분해 표시한다.
- **개인정보 장치**: 사용자 원문은 기본으로 가린다(`앞 6자… (n자)`). 「원문 보기」를 눌러야 보이고, 콘솔·로그에 남기지 않는다. 화면은 읽기 전용이다(insert/update/delete/rpc 호출 0건 — 검사로 고정).

### 4) 지금 이 화면에서 보이는 범위 (실제 확인)
| 표 | RLS | 화면에서 보이는 것 |
|---|---|---|
| `doit_records` | `doit_records_select_own` (본인 줄만) | **로그인한 계정의 기록만** |
| `doit_insights` | `doit_insights_select_own` (본인 줄만) | **로그인한 계정의 기록만** |
| `doit_request_events` | RLS 켜짐 + 정책 0개 + `authenticated` 에게 SELECT 권한 **자체가 없음** | **권한 오류로 표시(정상)** — 서버 함수 전용 |

**앞선 보고 정정**: 나는 `doit_request_events` 의 정책이 0개인 것을 보고 "보안 구멍"이라고 적었다. 그건 틀렸다. 표 단위 SELECT 권한까지 없어서 다른 표보다 **더 잠겨 있다.** 내가 권한(grant)을 확인하기 전에 말한 실수다.

### 5) 대표 승인이 필요한 것 (아직 실행 안 함)
- `supabase/drafts/PENDING_20260922_admin_read_doit_conversation.sql` — 관리자만 세 표를 **읽기**만 할 수 있게 하는 정책 초안. 실행 전 검토 사항·실행 후 확인 질의·되돌리기까지 같은 파일에 적었다.
- 실행하면 **관리자 계정이 다른 사용자의 답 원문을 볼 수 있게 된다.** 개인정보 범위가 넓어지는 변경이라 약관·개인정보 문서와 함께 봐야 한다.

### 6) 찾았지만 이번에 고치지 않은 것 (보고만 한다)
브랜드 빌드(`out-brand`)에 제품 화면 조각(관리자 화면 포함, 약 60KB)이 **1개 섞여 들어간다.** 원인은 `src/router/config.tsx` 가 `@/doit/routes` 를 맨 위에서 정적으로 불러오기 때문이다.
- 지금 위험도: **낮음.** 브랜드 라우터에 그 경로가 등록돼 있지 않고(`/doit/*`·`/admin/*` 는 앱 주소로 이동), `index.html` 이 그 조각을 참조하지 않아 요청되지 않는다. 보안 경계는 여전히 서버 RLS 다.
- 고치려면 라우터 등록 구조를 바꿔야 해서 **STOP 게이트(라우터 전체 교체)에 가깝다.** 대표 승인 뒤 별건으로 하는 게 맞다.

### 7) 판정
로컬 구현 및 검사 완료. **대표 실기기 확인 전이므로 "완료" 아니다.** 17차 ZIP(앱·브랜드) 전달.

## K. v14 (2026-09-22 16:30~ KST) — 질문을 "매칭에 필요한 것"으로 되돌림 · 운영 미배포
### 1) 대표 지적 (실기기, 16:25~16:30 KST)
- 질문이 너무 어렵고 딥하다. 세션이 길다. "맞아요"를 계속 눌러야 해서 피로하다.
- **핵심 지시**: "우리가 사용자에 대해서 알아야 할 정보만 알면 된다. 상대방 매칭에 있어서 추천 상대 매칭이니까 그 구분에서 알아야 할 질문을 하라."

### 2) 내 실수 — v13.7 에서 고쳤다고 한 것이 또 깨졌다
운영에 나간 문장: **"상대에게 바라는 에너지가 뺏기가 싫어서는 어떤 모습일까요?"**
- v13.7 은 "인용이 14자 이하면 그대로 끼워 넣는다"였다. "에너지가 뺏기가 싫어서"는 12자라 문턱을 통과했는데, 낱말이 아니라 **구절**이라 조사 자리에서 그대로 깨졌다.
- 글자수로는 막을 수 없는 문제였다. 나는 "다시 나오면 고정 문장을 전부 걷어내겠다"고 적었고, 이번에 그렇게 했다.
- v14 규칙: 사용자 말은 **`"…"라고 하셨죠.` 한 줄 안에서만** 쓴다(이 틀은 어떤 말이 와도 문장이 성립한다). 질문 줄에는 사용자 말을 넣지 않는다. 조사 도우미(`particle`)와 글자수 문턱(`SHORT_QUOTE_MAX`)은 삭제했다. 인용이 18자를 넘으면 인용 줄 자체를 빼고 질문만 낸다(자르지 않는다 — 자른 인용은 뜻이 바뀐다).

### 3) 주제(TOPICS) 교체 — 매칭에 쓰는 칸만
| 전 (v13) | 후 (v14) |
|---|---|
| 원하는 만남 | 원하는 만남 |
| 끌리는 사람의 스타일 | 끌리는 사람 |
| 그 관계에서 중요한 상대의 성향 | **같이 하고 싶은 것** |
| 상대가 알아야 할 나의 모습 | 상대가 알면 좋을 나 |
| 요즘 사람을 만나는 일에 대한 마음 | **만나는 방식** |

"요즘 마음"은 매칭에서 두 사람을 겹쳐 볼 수 없는 칸이라 뺐다(대표가 직접 지적한 질문이다). 대신 매칭에 결정적인 **같이 하고 싶은 것**·**만나는 방식**을 넣었다. 주제 id 는 요청마다 새로 판정해 쓰는 값이라 DB 변경이 없다(옛 id 가 기록에 남아 있어도 무시된다 — 검사로 고정).

### 4) 말투 규칙
| 항목 | 전 | 후 |
|---|---|---|
| 질문 길이 | 120자 이내 | **45자 이내** |
| 답 예시 괄호 | 2개까지 허용 | **금지**(질문 자체를 구체적으로) |
| 무거운 추상 물음 | 제한 없음 | **금지 목록**: "어떤 모습일까요"·"어떤 태도를 기대하나요"·"무엇을 의미하나요"·"어떤 마음인가요"·"왜 그런가요" |
| ack 길이 | 40자 이내 | **25자 이내** |

### 5) "맞아요" 피로 — 막힌 문을 열었다
확인 카드가 떠 있는 동안 입력창이 **완전히 잠겨** 있었다(`disabled={…|| !!candidates.length}`). 이어서 쓰려면 매번 버튼을 눌러야 했다.
- **「나중에 고를게요」** 를 카드에 넣었다. 누르면 이번 화면에서만 접히고 입력이 열린다.
- 서버 상태는 그대로 `candidate` 다 — 사라지지 않고, 나중에 다시 확인할 수 있다. 확인한 이해 개수를 가짜로 올리지 않는다.
- 안내 문구도 빠져나갈 길을 알려 준다: "위에서 골라 주세요. 「나중에 고를게요」를 누르면 이어서 적을 수 있어요."

### 6) 검사 (가짜 AI 기준 / 실제 서버 기준을 구분한다)
- **가짜 AI 기준**: 대화 흐름 35/35 통과. 운영에서 깨졌던 문장 4가지 입력("에너지가 뺏기가 싫어서", "배려", "그냥 아무생각없어", 긴 문장)으로 회귀 검사 추가 — 인용 틀 밖에 사용자 말이 들어가면 실패하게 고정했다.
- **전체**: 229개 중 **227 통과 / 0 실패 / 미확정 2**(통과로 세지 않음). tsc 0, eslint 0, 앱·브랜드 빌드 0, sourcemap 0, 키 문자열 0, ZIP 단독 해제 재검사 통과.
- **실제 서버 기준**: **아직 배포하지 않았다.** 운영은 버전 18(v13.7) 그대로다. 로컬 v14 파일 SHA-256 `25b82500ab09f2a33a33c4057d412b855ad3fe99d58295889e40f7ea0650821b`.

### 7) 순서 주의
화면(18차 ZIP)과 서버(v14)는 **주제 이름을 함께 쓴다.** 서버를 배포하지 않고 ZIP 만 올리면 대화는 정상 동작하되 "3 / 5 · 주제" 진행 표시가 보이지 않는다. **서버 배포 → ZIP 업로드 순서**를 권한다.

### 8) 판정
로컬 구현 및 검사 완료. **운영 배포 승인 대기.** 대표 실기기 확인 전이라 "완료" 아니다.
