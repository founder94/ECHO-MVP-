# ECHO 서버 핵심기술 목록과 재사용 분류 (2026-09-18)

목적: 온라인 자만추에서 **그대로 재사용 / 수정 후 재사용 / 자기이해 전용(제거 후보)** 로 나눌 수 있게
실제 코드 단위로 정리한다. 이번 안정화 작업으로 P0 대상이 된 것들을 굵게 표시했다.

## A. 그대로 재사용 — 대화 안정성 엔진 (제품 주제와 무관)

| 기술 | 위치 | 하는 일 | 의존 |
| --- | --- | --- | --- |
| **답 품질 판정** | `rules.ts:replyQualityReason` / `question-quality.ts:replyQualityReason` | 사용자가 되물었을 때 답이 실제 답인지(빈칸·물음표·길이·잘림·회피·무관) 판정. 관련성은 2번째 시도부터 완화 | normalizeKey, sharesContent, questionHasContent |
| **후보 차단 상태머신** | `rules.ts:blockReasonFor` / `index.ts:blockReason` | LLM 후보 3개 중 무엇을 화면에 낼지 **서버가 결정** | 아래 규칙 전부 |
| **반복 차단** | `looksSame`, `repeatsQuestionIntent`, `questionIntent` | 같은 글자·같은 의도 질문 반복 금지 | bigrams |
| **거절 의미 차단** | `extractRejectedKeys`/`rejectedKeysOf`, `replyRevivesRejected` | 거절한 해석이 표현만 바꿔 되살아나지 못하게 | normalizeKey, looksSame |
| **정정 우선 판정** | `pendingCorrectionText`, `reflectsCorrection`, `correctionContentWords` | 정정 직후 첫 문장이 정정을 실제로 다뤘는지 서버가 검사 | wordTokens |
| **근거 추적** | `userEvidenceParts`, `unusedEvidenceParts`, `wordTokens` | 사용자가 한 말만 사실로 쓰고, 아직 안 쓴 근거를 찾아 주제를 옮김 | — |
| **말투 강제(해요체)** | `toPoliteKorean`, `hasBanmal`, `politeOrSame`, `isPoliteSentence` | 반말 후보를 뜻 안 바꾸고 해요체로, 못 바꾸면 차단 | — |
| **되물음 감지·우선 응답** | `isUserQuestion`, `isSelfDirectedQuestion`, `isUnansweredComplaint`, `pendingUserQuestion`, `followupMode` | 사용자가 물으면 단계 진행보다 답을 먼저 | — |
| **빠져나갈 문(구제)** | `replyOnly`, `correctionOnly`, `replyAlone`, `UNDERSTANDING_FALLBACK` | 규칙이 전부 막아도 대화가 끊기지 않게 | — |
| **금지어·안전** | `containsForbiddenTerm`/`forbidden`, `hasUnsupportedPremise`, `premiseWithoutEvidence` | 데이팅·점술·진단 표현 및 없는 사실 차단 | — |
| **응답 정리** | `tidyQuestionText`, `splitQuestionCandidates`, `cleanReply`, `parseCandidates` | 모델 출력의 꼬리 장식·이중 물음표 정리(글자는 새로 만들지 않음) | — |
| **멱등·동시성** | `isValidToken`, `claim`/`commit`/`release`/`rollback`, `commitState` | 같은 요청 두 번 와도 한 번만 저장 | conversations 테이블 |
| **인증·격리** | 두 함수의 `getUser` 실검증 + 403 경로 | 토큰 실검증, 남의 대화 접근 차단 | Supabase Auth, RLS |
| **진단 로그** | `candidates_blocked`, `openai_usage`, `timing` 등 | 원문 없이 차단 사유·속도만 남김 | — |

→ **자만추에서도 그대로 쓸 수 있다.** "질문을 만들고, 사용자가 거절·정정하면 서버가 방향을 바꾸고, 절대 대화를 끊지 않는다"는 기술은 주제와 무관하다.

## B. 수정 후 재사용 — 뼈대는 같고 내용만 교체

| 기술 | 위치 | 바꿔야 할 것 |
| --- | --- | --- |
| 단계 상태머신 | `index.ts:nextStatusAfterAnswer`, `STATUSES`, `AI_STEP`, `canAnswer` | 단계 수·이름 (자기이해 7단계 → 자만추 흐름) |
| 단계 목적·렌즈 | `echo-journey/index.ts:STEP_OBJECTIVES`, `STEP_LENSES`, `nextQuestionFocus` | 각 단계가 무엇을 알아내려는지 (문구 교체) |
| PERSONA 프롬프트 | 두 함수의 `PERSONA` 상수 | 말투는 유지, 역할 문장 교체 |
| 요약(이해) 생성 | `genUnderstanding` + 4버튼 저장 | "마음 요약" → 자만추용 요약으로 교체 |
| 기억 | `loadMemory`, `priorNote`, `memoryNote` | 저장 대상만 교체 |
| 결제 게이트 | `echo-payment`, `hasPaidReportAccess` | 가격·상품만 교체 (Toss 연동 구조는 유지) |
| 관리자 집계 | `admin-dashboard`, `admin-conversations` | 지표 정의만 교체 |

## C. 자기이해 전용 — 제거 후보

| 대상 | 위치 | 비고 |
| --- | --- | --- |
| 리포트 생성 | `echo-journey:genReport`, `parseReport`, `sectionGrounded` | 자기이해 리포트 전용 |
| White Door 전환 | `restoreLegacyWhiteDoor`, 관련 status | 결제 전 장면 전용 |
| 마음 날씨 | 프론트 `/weather`, `/weather-check` | 서버 의존 없음 |
| 사주·타로 | `openai-chat` | 무료 콘텐츠, 별도 |
| 구 상태머신 | `doit-understanding` | v4에서 멈춤, 현재 흐름이 대체 |

## D. 의존 관계 (요약)

```
브라우저
  └─ get-step-question  (STEP1·2 · 이해요약 · 4버튼 · followup · 되물음 답)
        ├─ rules.ts        판정 규칙 (순수 함수, DB·네트워크 없음)  ← 재사용 핵심
        └─ ai.ts           프롬프트 조립 + OpenAI 호출 + 구제 경로   ← 재사용 핵심
  └─ echo-journey       (STEP3~7 · 리포트 · 리포트 후 대화)
        └─ question-quality.ts  판정 규칙 (순수 함수)               ← 재사용 핵심
  └─ echo-payment       (Toss 4,900원 단건)
  └─ admin-dashboard / admin-conversations (집계)
  └─ openai-chat        (사주·타로, 별도)

공통 저장소: conversations · messages · understanding_results · (결제/기억 테이블)
```

`rules.ts` 와 `question-quality.ts` 는 **DB도 네트워크도 건드리지 않는 순수 판정 모듈**이다.
이 두 파일이 이번 안정화의 결과물이자 자만추에 그대로 옮길 수 있는 자산이다.
