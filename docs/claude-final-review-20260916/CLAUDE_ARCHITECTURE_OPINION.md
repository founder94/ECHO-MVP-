# CLAUDE 독립 기술 의견 — ECHO 대화 엔진 · STEP 1~7 · White Door · 4,900원 리포트 · 관리자 (2026-09-16)

> ⚠️ **폐기된 옛 가격 표시 (2026-09-26 대표 결정)**: 이 문서의 4,900원은 **폐기된 옛 구조(legacy)** 이며 현재 가격이 아닙니다. 현재 가격은 미확정입니다. 과거 기록 보존을 위해 본문은 그대로 둡니다.

작성 기준: `ECHO_CLAUDE_COMPLETE_HANDOFF_20260916.zip` 의 PROJECT_SOURCE(해시 310/310 일치)와 운영 Supabase 프로젝트 `zyyhhxyupizcqhxqnxuu` 에서 읽기 전용으로 회수한 Edge 함수 원문 7종·DB 정책·로그. 코드를 수정하기 전에 작성했고, 판정은 `일치 / 불일치 / 확인 불가` 로 나누며 각 항목에 실제 파일·줄 근거를 적었다.

## 0. 한 줄 요약
구조는 "LLM 후보 → 서버 상태머신 선택·차단·저장" 원칙을 실제 코드로 지키고 있고, 운영 함수 원문이 로컬과 같다. 지금 고쳐야 할 것은 4가지뿐이다: ① 운영 로그로 확인된 질문 검증 실패 연속(NOT_QUESTION·MULTIPLE_QUESTIONS → NO_CANDIDATE)으로 사용자가 막히는 문제, ② 결제 승인 뒤 리포트가 아닌 White Door 로 되돌아가는 화면 계약, ③ 인계 ZIP 에 린트 규칙 파일이 빠져 린트가 실행 불가, ④ 오늘 실기기에서 확인된 갤럭시 홈 배경 잘림 패치가 기준본에 없음.

## 1. 현재 구조의 장점 (일치)
| 항목 | 근거 | 판정 |
|---|---|---|
| 답변 먼저 저장, 질문 생성은 별도 `ask` | `echo-journey/index.ts` 599~634 (answer 는 insert+commit 만), 571~597 (ask 가 AI 호출); `get-step-question/index.ts` answer 분기 동일 | 일치 |
| 중복 클릭·동시 요청은 조건부 UPDATE 1회 선점으로 하나만 처리 | `echo-journey/index.ts` 440~453 `claim()`; DB `conversations_user_request_token_unique (user_id, request_token) where not null` | 일치 |
| 같은 토큰 재요청은 저장된 상태를 돌려줌(멱등) | `echo-journey/index.ts` 605~607, `get-step-question` `conv.request_token === token && conv.request_action === action` | 일치 |
| STEP 7 완료는 유효 질문 존재 + 사용자 답변 저장 + 상태 커밋을 모두 서버가 확인한 뒤에만 `report_ready` | `echo-journey/index.ts` 612~625 (`latestJourneyQuestion` 없으면 NO_QUESTION) | 일치 |
| 리포트 본문은 본인 + 완료 상태 + `payments.status='paid'` 가 있어야만 반환(resume·report·list·RLS 4경로 동일) | `echo-journey/index.ts` 497~502, 641~643, 527~552; DB 정책 `reports_select_paid_completed_own` | 일치 |
| `alreadyPaid` 는 진행 상태가 아니라 실제 paid 행으로만 판단 | `echo-payment/index.ts` create 분기 `loadPaidByConversation` 선행 | 일치 |
| 결제 심사 대기 중 신규 주문·confirm 서버 차단 + 프론트 게이트 | `echo-payment` `PAYMENT_MODE = "review_pending"`; `src/lib/echo/toss.ts` `PAYMENT_GATE = 'review_pending'`; 번들에 "결제 준비 중" 2건, "결제하면" 0건 | 일치 |
| 브라우저는 conversations·messages·payments·reports 에 SELECT 만 가능(INSERT/UPDATE 권한 없음) | `information_schema.role_table_grants` 실측: authenticated = SELECT only | 일치 |
| 일반 사용자가 자기 `profiles.role` 을 admin 으로 바꿀 수 없음 | 트리거 `pa_profiles_role_lock`(UPDATE OF role → 42501) + 컬럼 UPDATE 권한에 role 없음(실측) | 일치 |
| 관리자 API 는 JWT getUser + `profiles.role='admin'` 서버 재확인 | `admin-dashboard/index.ts` requireAdmin, `admin-conversations/index.ts` requireAdmin | 일치 |
| 원문·키를 로그에 남기지 않음 | `[gsq]` 로그는 status·code·model·reason·len 만(실측 로그 15건 확인) | 일치 |
| 운영 함수 원문 = 로컬 원문 | get-step-question v19, echo-journey v10, admin-dashboard v1, admin-conversations v2, openai-chat v2, doit-understanding v4 바이트 동일; echo-payment v2 는 끝 줄바꿈 1자만 차이 | 일치 |

## 2. 반복 질문이 다시 생길 수 있는 실제 위험
| 위험 | 근거 | 판정 |
|---|---|---|
| **질문 검증 실패 연속 → 사용자 막힘.** 2026-09-16 08:04~08:10 UTC 운영 로그에 `validate_fail reason=NOT_QUESTION`(8건)·`NOT_GROUNDED`(5건)·`MULTIPLE_QUESTIONS`(2건). attempt=1,2 가 짝으로 실패한 구간 6곳 → 각각 `NO_CANDIDATE` 로 사용자에게 "질문을 만들지 못했어요"가 6회 연속 표시된 것으로 계산됨(원문은 로그에 없어 무엇이 붙었는지는 확인 불가) | `query_logs` source=function_logs; `get-step-question/index.ts` 546~555 (시도 2회 뒤 NO_CANDIDATE) | 불일치(지금 수정) |
| `모르겠어요` 연속: 같은 주제 반복 대신 초점 전환 | `echo-journey/index.ts` 340~349 `uncertain`/`fatigue` 모드 + `avoidAnchorReuse` + `nextQuestionFocus`; QA `uncertain, brief, and skip replies…` 통과 | 일치 |
| `말했잖아`·`같은 질문이야`: 답변으로 저장하지 않고 같은 단계에서 질문만 교체, 사과 반복 없음 | `journeyFeedbackKind` + `answer` 의 `repair`; `renderCandidate('feedback')` 문구 1회 | 일치 |
| `그게 아니에요` 뒤 폐기 해석 재등장 차단(의미 키 + 글자 겹침 + 리포트 재검사) | `echo-journey` `blocked()` 210~215, `parseReport` 237~238; `get-step-question` `blockReasonFor` | 일치 |
| STEP 3~7 안의 자유 정정("아니야, …")은 폐기 해석을 *저장*하지 않음 — 이후 질문은 근거(사용자 말)만 쓰므로 재등장 경로가 좁지만, 거절한 AI 전제가 "거절 목록"에 남지 않는다 | `question-quality.ts` `correctionEvidence` 는 정정 문장만 보존 | 다음 버전 |
| OpenAI 질문 호출 시간 제한 6초 × 2회 — 24시간 로그에 AbortError 0건, 최대 실행 7.3초(echo-journey)·4.7초(get-step-question) | `query_logs` function_edge_logs 집계 | 일치(현재는 안전, 지연 시 여유 작음) |

## 3. 서버 상태머신에서 부족한 부분
| 항목 | 근거 | 판정 |
|---|---|---|
| 모델 출력 뒤 장식(이모지·닫는 따옴표·마침표)과 짧은 공감 되묻기("힘들었죠? …?")를 규칙으로 정리하지 않고 통째로 거절 → 2번 항목의 직접 원인 후보 | `validateSingleQuestion` 263~270: `endsWith("?")`·물음표 1개 아니면 거절 | 불일치(지금 수정) |
| echo-journey 에는 OpenAI 오류·NO_CANDIDATE 진단 로그가 전혀 없어 STEP 3~7 실패 원인을 운영에서 볼 수 없음 | `echo-journey/index.ts` 243~262 `callOpenAI` 로그 없음 | 불일치(지금 수정) |
| 관리자 "STEP 7 유효 완료"는 `message_kind in (step_answer, journey_answer)` 만 집계 — 2026-09-15 이전 `message_kind=null` STEP 7 답변 1건은 제외됨(운영 실측: null 1건) | `admin-dashboard/index.ts` STEP_ANSWER_KINDS; DB 실측 | 일치(의도된 보수적 집계, 문서에 명시됨) |

## 4. 프론트와 서버 계약이 어긋난 부분
| 항목 | 근거 | 판정 |
|---|---|---|
| 결제 승인 뒤 `routeWithConversation('report_ready')` = `/white-door` 로 이동 → 구매자가 White Door → "리포트 안내 보기" → /payment → /report 를 한 바퀴 더 돈다. STEP 3 되돌림은 없지만 "완료 상태를 유지하고 리포트로 연결"과 다름. 심사 대기 중이라 지금은 도달 불가 경로 | `payment/success/page.tsx` 80~89, `payment/page.tsx` 79~83 | 불일치(지금 수정) |
| White Door 는 서버 `report_ready` 만 허용, 그 외는 서버 경로로 되돌림 | `white-door/page.tsx` 41~50 | 일치 |
| 사전 안내·상품·설명·심사 대기 문구 4종 | `weather-check/page.tsx` 250, `payment/page.tsx`, `toss.ts` | 일치 |
| 인계 ZIP 의 `eslint.config.ts` 가 `./eslint-rules/route-element-jsx.js` 를 요구하지만 ZIP 에 없음 → 인계본만으로는 `npm run lint` 실행 불가(FULL_SOURCE 목록에도 없음) | `eslint.config.ts` 6행; 실행 시 "Cannot find module" | 불일치(파일 복구) |
| 홈 갤럭시 Chrome 배경 직각 잘림·헤더 겹침 패치(오늘 09:00~11:15 별도 납품, 9파일)가 기준본에 없음. 기준본의 해당 9파일은 패치 전 원본과 바이트 동일 | `PastelBlobs.tsx` 등 8파일 cmp 결과 SAME | 불일치(패치 병합) |
| `admin-conversations` CORS 허용 목록은 `localhost:5173` 만, README 개발 서버는 3000 → 로컬 개발에서 대화 목록만 CORS 차단 | `admin-conversations/index.ts` ALLOWED_ORIGINS; README | 다음 버전(운영 영향 없음) |

## 5. 관리자 화면의 신뢰성·보안 위험
| 항목 | 근거 | 판정 |
|---|---|---|
| 집계 API 만 사용, 가짜 숫자·`연결 필요/확인 필요` 문구 없음 | `src/pages/admin` grep 0건; `useAdminData.ts` 는 `admin-dashboard` 1개 호출 | 일치 |
| 오류는 0 이 아니라 `error` 구역으로 표시 | `admin-dashboard/index.ts` 각 load* 의 catch → status "error", null 값 | 일치 |
| 대화 원문은 상세 조회에서만, 감사 로그 저장 성공 시에만 반환 | `admin-conversations/index.ts` detail 분기 | 일치 |
| 목록 응답에 이메일·표시이름이 마스킹 없이 포함(관리자 전용 화면이라 허용 범위) | `admin-conversations/index.ts` list items | 일치(주의) |
| Supabase 보안 어드바이저: `is_admin()` SECURITY DEFINER 가 anon/authenticated RPC 로 호출 가능(boolean 만 반환, 위험 낮음), `key_spend` RPC authenticated 호출 가능(A 구조 설계), 유출 비밀번호 보호 꺼짐 | `get_advisors(security)` | 확인 불가(대표 콘솔 결정 사항) |
| 배포 기록 "DB/RLS/마이그레이션 변경 없음" vs 같은 날 마이그레이션 2건 적용(`admin_profile_privilege_lock_20260916`, `revoke_trigger_function_rpc_access_20260916`) | `list_migrations` | 불일치(문서. 코드 아님) |

## 6. 지금 수정한 것 / 다음 버전으로 미룬 것
지금(이 납품물):
1. `get-step-question` — `tidyQuestionText`·`softenLeadingQuestion` 서버 규칙 + 진단 로그에 물음표 개수·끝 모양 추가(원문 없음).
2. `echo-journey` — 후보 질문 끝 장식 정리 + `[ej]` 진단 로그(fetch 오류·HTTP 상태·빈 응답·후보 차단·NO_CANDIDATE).
3. 프론트 — 결제 승인 뒤·이미 결제된 주문은 `/report` 로 직행.
4. QA — `qa/question-salvage.test.mjs` 신규 6건, `qa/step7-contract.test.mjs` 1건 갱신.
5. 패키징 — `eslint-rules/route-element-jsx.js` 복구.
6. 반응형 — 홈 9파일 패치 병합(오늘 별도 검사 통과본과 동일 바이트).

다음 버전:
- STEP 3~7 자유 정정에서 폐기된 AI 전제를 "거절 목록"에 저장하는 구조(테이블 열 추가 필요 → PENDING SQL).
- OpenAI 질문 호출 시간 제한 6초의 여유 검토(지연 추세 로그 축적 뒤).
- `admin-conversations` CORS 개발 포트.
- 관리자 목록 이메일 마스킹 여부 결정.

## 7. 추가 검수문(project-13966538 기준, 2026-09-16) 항목 대조 — 2차
검수문은 이번 인계본보다 앞선 ZIP(project-13966538, get-step-question 19,306바이트)을 본 것이다. 현재 기준본(PROJECT_SOURCE = 운영 v19/v10/v2)과 파일 단위로 대조했다.

| 검수문 항목 | 현재 기준본 | 판정 | 근거 |
|---|---|---|---|
| P0-1 관리자 대화 원문 조회 없음 | `admin-conversations` v2 list/detail + `useAdminConversations.ts` + `views/Conversations.tsx`, 상세는 감사 로그 저장 성공 시만 | 해결됨 | `admin-conversations/index.ts` detail 분기 |
| P0-2 맞아요 → white_door_ready 반환, STEP 3 미변환 | choose agree → `step3` 커밋, 과거 white_door_ready 는 echo-journey `restoreLegacyWhiteDoor` 가 agree 기록 확인 뒤 step3 | 해결됨 | `get-step-question` choose, `echo-journey` 416~438 |
| P0-3 결제 서버 white_door_ready·alreadyPaid 상태 판정·reportEntitled 미반환·리포트 권한 검사 없음 | `PAYABLE_STATUS = "report_ready"`, alreadyPaid 는 paid 행, `reportEntitled` 반환, report/resume/list/RLS 4경로 paid 필수 | 해결됨 | `echo-payment` create, `echo-journey` 497~502·641 |
| P0-4 시작 토큰 미사용·중복 대화·부분 저장 후 성공 응답 | start 는 (user_id, request_token) 중복 조회 + DB unique 인덱스, answer/choose 는 claim→insert→commit 실패 시 롤백, 같은 토큰 재요청은 저장 상태 반환 | 해결됨 | `get-step-question` start/answer/choose, DB `conversations_user_request_token_unique` |
| P0-5 정정·직접 설명이 거절 배열에 섞임, 파싱 실패 원문 채택 | `correctionBlock` 이 affirmed/rejected 분리, `buildBlockContext` 는 choice='no' 의 rejected_interpretation 만 차단 재료, 파싱 실패는 SCHEMA 오류 | 해결됨 | `get-step-question` correctionBlock/buildBlockContext/parseCandidates |
| P0-6 리포트 confirmed 를 AI 가 결정 | **미해결이었음 → 이번에 수정.** `parseReport` 가 항목 anchor 를 사용자 근거·본문과 대조해 통과한 항목만 confirmed, 아니면 candidate | 수정 | `echo-journey` sectionGrounded/parseReport, QA full-flow 리포트 상태 단언 |
| P1-1 시간 초과 뒤 busy 잠금, STEP 1·2 대기 제한 없음 | **미해결이었음 → 이번에 수정.** 컨트롤러는 시간 초과 시 잠금 해제(같은 토큰 재시도, 서버가 중복 판정), `api.ts call()` 에 40초(리포트 75초) 상한 | 수정 | `startSave.ts`, `journeySave.ts`, `api.ts` |
| P1-2 관리자 고정 문구 | admin-dashboard 실측값 + 오류/빈값 구분 | 해결됨 | QA admin-dashboard-contract 8건 |
| P1-3 /doit/profile 예시 데이터 | **부분 미해결 → 이번에 수정.** 닉네임·소개·목적·지역·생활 리듬은 `loadProfile` 실제 값, 등급·수치는 데모임을 화면에 명시 | 수정(부분) | `src/doit/pages/do-it/profile/page.tsx` |
| P1-4 공간·방·미션 예시 | 예시 데이터 그대로(A 구조, 이번 범위 밖) | 미해결(범위 밖) | 보존 지시 |
| P1-5 타로 뒤 대화 실패 시 칸 이동 | **미해결이었음 → 이번에 수정.** 생성 실패면 현재 칸 유지 | 수정 | `ConversationFlow.tsx`, `useOpenAIConversation.ts` |
| P1-6 STEP_THEMES 관계 고정 | `STEP_OBJECTIVES`/`STEP_LENSES` 로 교체됨(관계 가정 없음) | 해결됨 | `echo-journey` 53~68 |
| P1-6 Stripe 의존성 | **미해결이었음 → 이번에 수정.** 소스 import 0건 확인 후 package.json·lock 에서 제거(파일 삭제 아님) | 수정 | package.json, package-lock.json |
| P1-6 sourcemap: true | `sourcemap: false` | 해결됨 | vite.config.ts 86 |
| P1-6 홈 '내 스토리 → 준비 중' | 그대로(정보구조 항목, 대표 결정) | 미해결(결정 사항) | Navbar appMenuItems |
| 결제 위치 충돌(무료 STEP 3~7 vs 결제 후 개방) | 2026-09-14 FINAL LOCK(STEP 1~7 무료, 리포트만 4,900원)으로 확정됨 | 해결됨 | 인계 지시서 1장 |

모바일(Android·iPhone) 마무리로 추가한 것: 여정 화면 8곳 `min-h-[100dvh]` → `echo-min-h-viewport`(100vh 폴백, iOS 15.3 이하), 모바일 폭 입력칸 글자 16px(iOS 자동 확대 방지), 날씨 효과의 `filter: blur` 제거(구름·안개, Android GPU 잘림·iOS 부하), 홈 9파일 갤럭시 패치. WebKit 엔진은 이 환경에 없어 iPhone 은 Chromium 엔진의 iPhone 크기·UA 에뮬레이션으로만 검사했다(실기기 NOT RUN).

## 부록(3차, 2026-09-16) — 실사용 캡처로 드러난 구조 결함과 보강
2차까지의 구조(LLM 후보 → 서버 차단·선택)는 "틀린 질문을 막는 데"는 강했지만 "사용자가 물었을 때 답하는 행동"이 아예 없었다(Action Router 부재). 또 반복 방지 규칙이 대화 전체를 기준으로 누적되어 후반 STEP 에서 후보를 전부 죽였다(2026-09-16 20:03 UTC `no_candidate step=4 blocked_total=6` 2회). 3차에서 서버 상태머신에 행동 분기(asked → reply + 질문)를 넣고, 다양성 규칙(의도 반복·중심표현 재사용)은 최근 2개 기준 + 마지막 시도 완화로 바꿨으며, 안전·근거·거절 규칙은 그대로 두었다. "친구처럼 기억한다"는 요구는 기존 `reports.summary` 를 다음 여정 프롬프트에 참고 문맥으로 넘기는 최소 형태로만 구현했다(새 테이블은 STOP 게이트). 원인·수정·검증: `COMPANION_FIX_REPORT_20260916.md`. 결제 구조(월결제) 판단: `PRICING_STRATEGY_20260916.md`.
