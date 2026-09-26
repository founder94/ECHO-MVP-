# ECHO 실패 분류표 (Failure Intelligence · 2026-09-26)

Failure Intelligence는 품질을 지키는 기반 장치다. 독자기술 그 자체라고 과장하지 않는다.

- ECHO의 차별점 후보는 한국어 관계 맥락의 흐름이다: 오해 → 정정(「그게 아니고」「아까 말했잖아」) → 확인 → 프로필·매칭 결과.
- 대표의 7개월 기록은 초기 분류와 시드 데이터로만 쓴다. 사용자 전체 패턴이라고 단정하지 않는다.

## 규칙 승격 절차 (한 번 실패로 규칙을 만들지 않는다)

실패 → 수집 → 분류 → 재현 → 원인 → 실험 고정(사전 등록) → 해결 → 반대 검사 → 실제 AI 검사 → 사용자 검사 → 확인됨 → 골든 실패·성공

- 예: v1.9는 실제 AI 검사 run 16에서 FAIL이었다. 원인을 고친 v2.0~v2.2는 run 17~19에서 PASS였고, 그 뒤에 운영 서버에 반영했다.

## 분류

「어디서 잡나」 칸의 뜻:
- 관리자 후보: `src/doit/lib/agentAdmin.ts`의 실패 후보.
- 검사: `qa/`의 자동 검사.
- 문서만: 아직 자동 감지가 없다(PARTIAL).

| 코드 | 뜻 | 어디서 잡나 |
|---|---|---|
| DIRECTION_DRIFT | 대화가 다섯 목적(원래 사용자 이해 흐름)을 벗어남 | 관리자 후보 QUESTIONS_OVER_5 · 검사 core-preservation(CORE 5) |
| CONTEXT_LOSS | 앞서 말한 걸 잊음 | 관리자 후보 ALREADY_ANSWERED_REASK · 성공 PRIOR_ANSWER_REUSED |
| REPETITION_FATIGUE | 같은 질문 반복으로 지침 | 관리자 후보 SAME_QUESTION_REPEATED · QUESTION_FATIGUE |
| CORRECTION_IGNORED | 정정했는데 옛 값이 남음 | 검사 CORE 2 · 관리자 성공 CORRECTION_RECOVERED |
| REJECTED_MEANING_RESURRECTION | 아니라고 한 뜻이 다시 나옴 | 검사 CORE 3 · 소개 거절 뜻 차단(cleanIntro) |
| INFORMATION_STATUS_COLLAPSE | 추측과 확인 정보가 섞임 | 검사 CORE 4 · 매칭 계약 검사 |
| QUESTION_INTENT_LOOP | 「무슨 뜻이야」 뒤 같은 질문을 계속 함 | 서버 가드 HELP · MAX_HELP_PER_QUESTION · 관리자 HELP_RECOVERED |
| REPAIR_FAILURE | 항의(「이미 말했잖아」) 처리 실패 | 서버 가드 PAST_REF · 관리자 USER_COMPLAINT |
| GENERIC_FALLBACK_FAILURE | 막히면 고정 문장으로 때움 | 문서만 · 하드코딩 질문 배열 금지 검사(기존) |
| OVER_GUARDING | 가드가 정상 답까지 막음 | 문서만 · 서버 NON_ANSWERS 목록(agent.ts) — 과차단 자동 감지는 없음 |
| MOCK_PASS_REAL_FAIL | 가짜 AI 검사는 통과했는데 실제 AI는 실패 | 실제 AI 검사 사전 등록(run-request.json · FROZEN_INPUTS) |
| STATE_RESTORE_FAILURE | 다시 열었을 때 대화 상태를 잃음 | 검사 conversation-continuity |
| TOOL_ENVIRONMENT_FAILURE | 개발·검사 환경 문제(네트워크 차단·빌드 변수 등) | 문서만 · 보고서에 「확인 불가」로 적음 |
| AI_MANAGEMENT_FATIGUE | 대표가 같은 지시를 되풀이해야 함 | 문서만 · 실기기 증거(FAILURE_EVIDENCE_*) |
| SAJU_RESULT_AS_USER_FACT | 사주 결과가 사용자 사실·나의 이해로 저장됨 | 검사 core-preservation(사주·타로 분리) · 지금 저장 경로 0 |
| TAROT_RESULT_AS_USER_FACT | 타로 결과가 사용자 사실로 저장됨 | 같은 검사 · openai-chat 저장 0 |
| SAJU_MATCHING_CONTAMINATION | 사주가 매칭 조건·점수·제외에 들어감 | 같은 검사 · 대화·매칭·연결 서버 사주 언급 0 |
| TAROT_MATCHING_CONTAMINATION | 타로가 매칭에 들어감 | 같은 검사 |

사주·타로 반응([비슷해요]/[조금 달라요])의 출처 이름은 SAJU_REACTION / TAROT_REACTION으로 정했다.

- 지금은 반응을 화면 상태에만 두고 저장하지 않는다. 그래서 새 출처 칸도 만들지 않았다.
- 반응을 저장하려면 새 DB가 필요하다. 대표 승인 전에는 STOP이다.
- 사용자가 사주를 보고 대화에서 직접 한 말(「맞아, 나는 천천히 알아가는 게 좋아」)은 일반 대화 턴이다. 그래서 USER_DIRECT → 서버 확인 경로를 그대로 탄다.
