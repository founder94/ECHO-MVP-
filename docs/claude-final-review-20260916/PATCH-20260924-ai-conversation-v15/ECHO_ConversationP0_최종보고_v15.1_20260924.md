# ECHO Conversation P0 최종 보고 · v15.1 (2026-09-24)

기준: 「Conversation P0 + Relationship Data Foundation · FINAL LOCK」 + 「PRODUCT DEFINITION · PM FINAL 1~3」(한 문서로 통합해 읽음).
로컬 지문: doit-understanding `b3384b79…`(181,961바이트) · doit-connect `9c2bac14…`(51,803바이트) · conversationRules `55b001b4…`.
운영: doit-understanding 버전 24(v14.4), doit-connect 버전 3 — **v15·v15.1 은 운영에 없다.**

## 현재 ECHO Conversation P0가 완료 기준 A+B+C를 충족하는가? → **목표 미달**

- A(서버): 로컬 코드로 충족, LEVEL 1 로만 증명.
- B(대화): **확인 불가.** 실제 OpenAI(LEVEL 2)·운영 실기기(LEVEL 3) 모두 0회다.
- C(데이터): 로컬 코드로 충족, 운영 미적용.
- 세 조건을 운영에서 동시에 확인하기 전까지 P0 PASS 가 아니다.

---

## QUESTION 1 — 서버가 Conversation Orchestrator 역할을 하는가? → **PARTIAL**

| 단계 | 실제 파일/함수 | 서버가 가진 상태 | OpenAI 역할 | 서버 결정 | 판정 |
|---|---|---|---|---|---|
| 사용자 입력 | `doit-understanding` 1808 `turn_classify` → 1372 `classifyTurn`(규칙 먼저, 애매하면 AI) · 2052 `record_create` | 원문 `doit_records.text/original_text` | 애매한 말의 종류 분류 후보 | 규칙이 분명하면 서버가 확정. AI 실패 시 답으로 둔다. 되묻기·불만·지친 말은 저장 안 함 | 일치(로컬) |
| 상태 저장 | 2065 `doit_apply_record_create` · 1344 `persistRejection` · 1554 `persistSynthesis` · 1871 `synthesis_decide` | records · insights(candidate/confirmed/corrected/rejected) · events(물은 질문·대화 중 거절) | 없음 | 저장은 모두 서버 RPC | 일치 |
| 맥락 조립 | 1043 `roundInfo`(history·직전 질문) · 909 `followupEvidence`(확인·정정·거절) · 995 `askedQuestionsAt` · 1327 `rejectedTurns` · 목적 | 위 전부 | 없음 | 서버가 고른 것만 OpenAI 에 넘긴다(1147 `evidence`) | 일치 |
| 후보 생성 | 1138 `composeQuestion` → 1160 OpenAI 호출 | 전략(서버가 정함)·주제 방향 | **질문 후보 1개**(+근거·연결 이유) | — | 일치 |
| 후보 검사 | 1180 `checkCandidate`: 한 질문·가벼움·고정 문장·「왜」 연속·반복·되묻기·AI 자기 표시·연결·최소 방어·거절(글자+뜻)·판정 AI(문맥·목적·톤·정보 관문, 1235) · 1709 상태 관문 | — | 판정 AI = 뜻 판단 후보 | 불허면 버리고 이유를 붙여 재생성(최대 3번), 그래도 안 되면 1177 명시적 실패 | 일치 · 휴리스틱 [추가 검증 필요] |
| 최종 질문 | 1773 `doit_finish_followup`(검사를 통과한 문장만, 맥락이 바뀌었으면 버림) | 물은 질문을 이벤트로 남김 | 없음 | **서버가 통과시킨 문장만 화면에 간다** | 일치 |
| 정정 | 909 정정 우선순위 · 1284 새로고침 뒤 정정 복원 · 1894 직접 설명 우선 | corrected·superseded | 정정 반영 질문 후보 | 정정 전 문장 = 차단 목록 · 전략 ACKNOWLEDGE_CORRECTION | 일치(로컬) |
| 거절 | 1821 분류 순간 저장 → 1279(질문)·1482(카드)·인사이트·소개 초안에서 차단 | rejected insight + `followup_reject` 이벤트 | 뜻 비교 후보 | 글자 겹침 + 뜻 판정으로 서버가 차단 | 일치(로컬) |
| 복원 | 화면 177 `savedQuestion` · 서버 1699 `followup_get` · 거절·정정은 서버 저장분으로 다시 읽음 | DB | 없음 | 새로고침·재진입에도 같은 상태 | 일치(LEVEL 1) |

**현재 ECHO 서버는 대표가 설계한 Conversation Orchestrator 역할을 PARTIAL 수행한다.** 로컬 코드는 전 단계를 갖췄다. 그러나 운영은 v14.4 이고, 실제 AI 에서 게이트가 제대로 동작하는지는 확인하지 못했다.

## QUESTION 2 — 대화가 Relationship Data Foundation 을 만드는가? → **PARTIAL**

| 단계 | 저장 위치 | 구분 가능한가 | 판정 |
|---|---|---|---|
| 1 DECLARED(사용자 원문) | `doit_records.original_text`(입력 그대로)·`text` | AI 해석과 다른 표에 있다 | 일치 |
| 2 INTERPRETED(AI 이해) | `doit_insights`(origin `ai`, `ai_text`, `source_record_id`, `source_text`) · 대화 중 AI 받아 주기 = 이벤트의 물은 질문 | 어느 원문에서 나왔는지 연결된다 | 일치 |
| 3 INFORMATION STATUS | `doit_insights.status` candidate / confirmed / corrected / rejected · `origin self`(직접 설명) · 대화 중 거절 = `doit_request_events` action `followup_reject` | 구분된다 | 일치 · 아래 약점 |
| 4 CURRENT TRUTH | confirmed·corrected 만 사실(909, doit-connect 367). 거절·정정 전 문장은 모든 생성 경로에서 차단. 「모르겠어요」·지친 말은 유효 답 아님(260 `informativeAnswer`, doit-connect 378) | 서버가 가른다 | 일치(로컬) |
| 5 FUTURE LINK | insight id + user_id + source_record_id + status + 시각 → 이후 추천·선택 기록이 이 id 를 참조할 수 있다 | 연결 가능 | 일치(가능성) |

**약점(P0 를 막지는 않음)**:
- 대화 중 거절은 도메인 표가 아니라 요청 기록 표(`doit_request_events`)에 한 줄로 남는다. DB 변경 없이 만든 선택이다.
- Relationship Data Contract 에서 정식 자리(예: 거절 기록 표·칸)를 정한다. 지금 새 표를 만들지 않았다.

---

## A. SERVER
- 상태 관리: 위 Q1 표.
- OpenAI 역할: 후보 생성 · 분류 후보 · 뜻 판정 후보만 한다. 확정·우선순위·거절 상태·대화 단계·최종 승인·완료는 서버가 정한다.

## B. CONVERSATION (LEVEL 1 까지만)
- 맥락: history·직전 질문·확인·정정·거절·물은 질문을 매 턴 조립한다.
- 질문 품질·가벼움: 질문 말투에 대표 톤 LOCK 을 넣었고, 판정 AI 에 문맥·목적·톤·**정보 관문(v15.1 마지막 추가)** 이 있다. 「왜」 연속은 결정적으로 막는다. 예시 문장은 코드에 넣지 않았다(하드코딩 0).
- 실제 질문 품질(Q1~Q6): **확인 불가**(LEVEL 2 필요).

## C. DATA
위 Q2 표. 원문은 덮어쓰지 않는다. 미확정은 candidate 이고 「맞아요」로만 confirmed 가 된다. 정정은 corrected + 정정 전 문장 보관. 거절은 rejected + 대화 중 거절 이벤트로 남는다.

## D. TEST LEVEL

| LEVEL | 실행 | 결과 |
|---|---|---|
| 1 가짜 AI | 실행함 | **PASS**. 479개 중 474 통과 / 0 실패 / 미확정 5(휴리스틱 2 · 옛 흐름 3). type-check·lint·서버 엄격 타입 2개·audit·빌드 0. 브라우저 18/18(운영용 빌드)·연결 화면 11/11. 역검사 16 + 8 모두 잡음(보강 3건 포함). 시작 전·끝 지문 일치 |
| 2 실제 OpenAI | **미실행** | 확인 불가. 스크립트(`qa/level2/level2-real-ai.mjs`)는 준비 완료, 가짜 AI 연습 실행으로 배관만 확인. 이 환경에 키 없음 |
| 3 운영 실기기 | **미실행** | 확인 불가. 검사표 준비(`LEVEL3_실기기_검사표_v15.1.md`). 전제 = 배포 |

## E. 변경 파일 (v15 → v15.1, 로컬)
- 서버: `supabase/functions/doit-understanding/index.ts` · `supabase/functions/doit-connect/index.ts`(RULES 블록 · 유효 답 계산)
- 화면: `src/doit/lib/conversationRules.ts` · `src/doit/lib/coreConversation.ts` · `src/doit/components/feature/CoreConversation.tsx` · `src/doit/components/feature/AsleepConnections.tsx` · `src/doit/pages/do-it/admin/views/ConnectionApprovals.tsx`(빠진 이유 문구)
- 검사: `qa/conversation-v15` · `server-conversation-flow` · `core-conversation-question-state` · `conversation-rules` · `connect-server` · `stress-messy-inputs`(LEGACY-01 todo) · 새 `qa/level2/level2-real-ai.mjs`(검사 스크립트, 검사 수에 안 셈)

## F. 남은 P0 결함 (P0 를 막는 것만)
1. **운영 미배포**: 운영은 v14.4 라 답마다 카드·거절 비저장·「모르겠어요」 자격 산입·분류 오판이 그대로다. → 배포 승인 대기.
2. **LEVEL 2 미실행**: 게이트가 실제 모델 출력을 너무 많이 막는지(명시적 실패) 덜 막는지(바꿔 말한 반복) 모른다. → 키 결정 대기.
3. **LEVEL 3 미실행**: 대표 실기기 5턴.
4. 위험(미확정): 휴리스틱 2가지 [휴리스틱 / 추가 검증 필요] — 뜻만 이어진 질문을 떨어뜨림 / 바꿔 말한 반복은 판정 AI 의존. 경계값 조정 안 함. LEVEL 2 에서 빈도를 잰다.

## G. 별도 이슈 (P0 밖, 보존)
전화 인증·Twilio(연결 자격자 0) · 회원탈퇴 보존 구조(초안 실행 금지) · KEY 9줄(살아 있는 계정 1개) · LEGACY-01(옛 STEP 1→7 검사 결함 · 고정 대체 질문 · 4,900원 흐름) · 법무 보존 기간 · `room/reward.ts` 고정 문장.
- 제품 정의와의 충돌 점검: 코드에 76%·적합도 %·"독점/해자" 주장 **0건**. 정의 §6 예시("말 잘 통하는 쪽? 같이 있으면 편한 쪽?")처럼 물음표 두 개로 고르게 하는 질문은 지금 규칙상 「아니면」이 있어야 통과한다(CLARIFY 전략이 「A? 아니면 B?」 꼴로 만든다). 예시에 맞춰 규칙을 바꾸지 않았다 — 필요하면 대표 결정.

## H. STOP (대표 승인 필요)
1. **서버 운영 배포**: doit-understanding v15.1(`b3384b79…`) + doit-connect v15.1(`9c2bac14…`)
2. **앱 42차 ZIP 업로드**: `1_APP_여기에올릴것_doitmobile.zip` · 3,055,591바이트 · 149개 파일 · SHA-256 `a1e529ffa97aa97e410f93296ea64fad5f029e652e685cc69e69d2887d413f73` · 소스맵 0 · .env 0 · QA 도구 0 · 풀어서 빌드 폴더와 동일. **서버 배포 뒤에 올려야 한다**(앱만 올리면 새 분류·카드·거절 저장을 옛 서버가 모른다). 홈페이지 ZIP 은 필요 없다.
3. **LEVEL 2 키**: 작업 환경에 검사용 OpenAI 키(사용 한도 권장)를 넣을지.
