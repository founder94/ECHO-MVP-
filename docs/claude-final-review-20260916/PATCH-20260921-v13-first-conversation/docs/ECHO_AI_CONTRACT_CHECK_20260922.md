# ECHO AI 입력·출력 서버 계약(§21) 대조표 — 2026-09-22

대상: 대표가 보낸 "21. AI 입력·출력 서버 계약". 새 테이블·새 서버를 만들지 않고, 먼저 지금 코드와 대조한 결과(§21-16).

## 0. 무엇을 어떻게 확인했나 (진짜/가짜 구분)
- 서버 코드: 로컬 `supabase/functions/doit-understanding/index.ts` v13.4 (운영에 올라간 것은 v13.3 = 버전 15. v13.4는 아직 미배포).
- 운영 DB(실제 서버 기준, 읽기만): `doit_records`·`doit_insights`·`doit_request_events` 칼럼과 CHECK 제약, `doit_*` 함수 14개 목록, 함수 본문 md5 를 로컬 초안(`supabase/drafts/PENDING_20260921_doit_followup.sql`, `PENDING_20260921_doit_revision_lock.sql`)과 대조 → 6개 함수(transition·finish_followup·followup_context·finish_insight_generate·apply_insight_self·get_followup) **글자 단위 동일**.
- 화면 코드: `src/doit/lib/understandingApi.ts`, `src/doit/lib/coreConversation.ts`, `src/doit/components/feature/CoreConversation.tsx`.
- 실기기·운영 대화로 검증한 항목은 없다(아직 아무도 안 써봤다).

## 1. 이름 대응(계약 이름 → 지금 이름)
| 계약 | 지금 코드·DB | 비고 |
|---|---|---|
| session_id | `recordId` (기록 1건 = 대화 단위) + 회차 `doit_round_started_at`(user_metadata) | 별도 세션 테이블 없음 |
| user_message.text | `record_create.text` + `originalText` | 원문·정리본 둘 다 저장 |
| client_message_id | `requestId`(UUID) | 모든 쓰기 요청 필수 |
| interaction.type confirm / slightly_different / reject / explain_directly | `insight_confirm` / `insight_correct` / `insight_reject` / `insight_self` | 4버튼과 1:1 |
| target_interpretation_id | `id`(doit_insights.id) + `expectedRevision` | 거절은 항상 어떤 해석인지 식별됨 |
| correction_text | `insight_correct.text` | |
| CONFIRMED / TENTATIVE / REJECTED | doit_insights.status `confirmed`·`corrected`·(origin `self`) / `candidate` / `rejected` | DB CHECK 제약으로 4값만 허용 |
| asked_questions | `doit_request_events.response_payload.question` (재시도 복원용 저장) | LLM 입력엔 아직 안 들어감 |
| current_strategy | 없음(암묵: direction(topic) / rescue.kind / rephrase) | |
| turn_id | `requestId` | |

## 2. 대조표 (§21-16)
| 계약 항목 | 현재 구현(실제 확인) | 판정 | 필요한 최소 변경 |
|---|---|---|---|
| 사용자 원문 | `doit_records.original_text`(그대로)+`text`(정리본). DB CHECK 빈값 금지. RLS는 SELECT만, 변경은 `record_update`(본인·revision 검사)뿐. AI 요약은 `doit_insights`에 따로 저장되어 원문을 덮는 경로 없음 | 일치 | 없음 |
| confirmed 상태 | `맞아요`→`confirmed`, `조금 달라요`→`corrected`(text=사용자 문장, ai_text=원래 AI 문장 보존), `직접 설명`→origin `self`+`confirmed`. 전이는 `doit_apply_insight_transition`(사용자 요청·revision 검사)만. AI 후보 INSERT 는 항상 `candidate` | 일치 | 없음 |
| tentative 상태 | `candidate` = TENTATIVE. LLM 이 confidence·confirmed 를 내도 서버는 `category`·`text`만 읽음(파서가 다른 키 무시) | 일치 | 없음 |
| rejected 상태 | `그게 아니에요`→`rejected`(id 식별). rejected 뒤 재전이 불가(INVALID_STATE). 다음 LLM Context 에 text+ai_text 포함. 검증기: 글자 겹침(bigram·overlap) + AI 의미 판정 이중 차단. LLM 이 차단을 풀 수단 없음 | 일치 | 없음 |
| correction | corrected 문장이 Context 최우선 근거("최신 정정 우선"). 단 정정 이전 AI 문장은 거절 목록에 안 들어감(조금 달라요는 뜻이 일부 겹쳐 글자 차단하면 정정 뜻까지 막힘) | 부분 일치 | A: Context 에 `superseded`(정정으로 대체된 AI 문장) 목록을 "다시 쓰지 말 것"으로 추가. 차단기엔 넣지 않음 |
| asked questions | 질문은 `doit_request_events.response_payload`에 저장(재시도·새로고침 복원). LLM Context 엔 미포함. 중복은 "5주제 중 아직 안 나온 주제" 방향으로만 회피 | 부분 일치 | A: 이번 회차 applied 이벤트의 질문을 읽어 `asked_questions`로 LLM 입력 + `looksSame`으로 같은 질문 재등장 차단. DB 변경 없음 |
| strategy | 명시 필드·검증 없음. 개념은 있음: direction(다른 주제) / rescue.kind(ai·quoted·generic) / rephrase(되묻기) / 거절 뒤 재생성 | 불일치(이름·허용 검사 없음) | A: 서버 enum(EXPLORE_USER_MEANING·CLARIFY·CHANGE_DIRECTION·ACKNOWLEDGE_CORRECTION·RECOVER_FROM_REJECTION)을 기존 경로에 붙이고 응답 `state.strategy`·로그에 기록. 서버가 정함(LLM 제안권 없음, §21-14) |
| LLM structured output | `response_format: json_object` + `extractJson` + 필드별 타입·길이 검사. strict json_schema 아님 | 부분 일치 | A(선택): 검사 함수 1개로 통일. strict json_schema 전환은 모델 지원 확인 뒤 |
| server validator | 다음 질문: 질문 존재·200자 → ack 근거 인용 검사 → 거절 글자 차단 → AI 판정(숨은 단정·새 사실·목적만으로 추론 금지) → 거절 의미 판정 → 실패 시 방향 고정 질문 → 그래도 거절과 겹치면 AI_ERROR. 후보: 근거 커버리지 + AI 근거 판정 + 거절 이중 차단. 계약 10항목 중 1·2(부분)·4·5·9 있음. 3(과거 질문 중복)·6(질문 한 개)·7(유도)·8(주제 이탈)·10(strategy 허용)은 프롬프트 지시뿐 | 부분 일치 | A: 6 = 물음표 2개 이상 불허, 3 = asked_questions 겹침 검사, 7 = 판정 프롬프트 항목 추가, 10 = strategy enum 검사. 8은 주제 판정 재호출(비용)이라 보류 |
| 중복 요청 방지 | `requestId` = client_message_id. 화면은 본문 해시→requestId 를 localStorage 에 재사용(응답 유실·새로고침 뒤 같은 ID 재전송). 서버·DB: UNIQUE(user_id, request_id) + advisory lock + payload_hash 비교(REQUEST_CONFLICT) + lease(IN_FLIGHT) + applied 면 저장된 결과 반환(duplicate) | 일치 | 없음 |
| 실패 처리 | 응답 코드(기존): UNAUTHORIZED·BAD_REQUEST·FORBIDDEN·AI_ERROR·AI_NOT_CONFIGURED·STALE_CONTEXT·IN_FLIGHT·PENDING_INSIGHTS·SERVER_UPDATE_REQUIRED·BLOCKED_CONTENT·RATE_LIMITED·TOO_LARGE·ERROR. LLM 시간초과·형식오류·검증실패는 화면엔 AI_ERROR 하나(복구 문구), 로그엔 reason(timeout / no_candidate / provider_error / followup_failed+detail)로 구분 | 부분 일치(§21-12 "기존 코드 호환" 조건 충족) | A: 후보 생성 경로 로그에도 detail 추가(지금은 다음 질문 경로만). 응답 코드는 유지 |
| 최종 response | 서버 검증 뒤 `{ok, question:{text,sourceRecordId}, topic}` / `{ok, insights[], rescue, trace}`. 4버튼은 서버 status=`candidate`일 때만 켜짐(available_actions 전송 없음, 화면이 상태를 재해석하지 않음). **`trace`(시도·탈락 수·reasons·ms)와 `rescue.kind`가 브라우저로 감(§21-11 관리용 정보)** | 부분 일치 | A: `trace`·`rescue.kind` 응답에서 제거(로그·이벤트 저장에만). available_actions 는 status 로 대체(추가 안 함) |

## 3. 저장 순서 실측 (§21-13, 코드 기준)
- 사용자 입력: `record_create` → RPC 저장 → 응답. (1요청)
- AI 후보: `insight_generate` → `doit_begin_insight_generate`(이벤트 pending+lease) → LLM → `doit_finish_insight_generate`(context_hash 재검사 → 후보 INSERT + response_payload 저장, 같은 트랜잭션) → 응답.
- 다음 질문: `followup_generate` → `doit_begin_followup` → LLM → `doit_finish_followup`(재검사 → 질문 저장) → 응답.
- 결론: **"저장 → 응답" 순서**다. 저장이 실패하면 응답도 실패 코드다. 응답이 유실되면 같은 requestId 재전송 → `duplicate:true` + 저장된 결과. "화면엔 보였는데 서버엔 없다"는 상황은 되묻기(`rephrase`) 결과 하나뿐이며, 그 경우 원 질문은 저장돼 있어 새로고침 시 원 질문이 복원된다.
- 같은 사용자 메시지 두 번 처리: 위 멱등 장치로 막힘(운영 로그에서 같은 request_id 재요청이 duplicate 로 처리된 것을 앞서 확인함).

## 4. A / B / C 구분
- **A. 코드만 수정(승인 없이 작성 가능, 배포는 별개)**: correction superseded 목록, asked_questions 입력+중복 차단, strategy enum(서버 결정)+응답 state, 질문 1개 규칙, 판정 프롬프트 유도 항목, 후보 경로 로그 detail, trace·rescue.kind 응답 제거, §21-15 검사 추가. 화면: `state.strategy` 무시해도 동작(호환).
- **B. DB·Migration·RLS**: **없음.** 지금 계약은 기존 칼럼(status·ai_text·response_payload)으로 전부 표현된다. asked_questions 전용 테이블은 선택이며 지금 필요 없다.
- **C. Edge Function 운영 배포**: 이미 작성된 v13.4(처음부터 회차·잠든 사이 미리보기·멈춤 없는 방향 질문) + A 항목을 반영한 v13.5. 대표 "서버배포승인" 전에는 올리지 않는다.

## 5. §21-15 검사 현황 (실행 안 한 것은 PASS 아님)
| 검사 | 현황 |
|---|---|
| 입력 Schema | 서버가 action·requestId·id·revision 형식 검사(BAD_REQUEST). 자동 검사 없음 → todo |
| Structured Output | 가짜 AI 기준: 깨진 형식 → 방향 고정 질문(`qa/server-conversation-flow.test.mjs`) 실행함. strict 스키마 검사 → todo |
| 사용자 원문 보존 | 코드·DB 제약으로 확인(덮는 경로 없음). 자동 검사 → todo |
| CONFIRMED/TENTATIVE 분리 | DB 함수 본문 대조로 확인(후보는 candidate 만 INSERT). 자동 검사 → todo |
| REJECTED 차단 | 가짜 AI 기준 실행함(거절 겹침 → 질문 폐기·고정 질문) |
| Correction 우선 | 프롬프트·정렬(정정 최우선)로 구현. 자동 검사 → todo |
| 중복 질문 | 미구현(A 항목) → todo |
| Invalid LLM Output | 가짜 AI 기준 실행함(파싱 실패 → 고정 질문, 원문 노출 없음) |
| Timeout | 가짜 AI 기준 일부(시간 예산 → AiTimeout → AI_ERROR). 사용자 화면 문구 검사 → todo |
| 중복 요청 | DB 함수(UNIQUE+lock) 본문으로 확인. 자동 검사 → todo |
| 서버 결정권 | 화면은 상태 쓰기 경로 없음(RLS SELECT만). 자동 검사 → todo |
