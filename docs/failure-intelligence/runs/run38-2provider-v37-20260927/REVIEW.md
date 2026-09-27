# run 38 — v3.7 OpenAI · Claude 43판 역할 자격 판(2026-09-27)

- 실행: GitHub Actions run 36291338169(수동 · commit 2308725 · 업체별 작업 2개). Gemini 는 계정 할당량(429 RESOURCE_EXHAUSTED) 확인 전이라 실행 0 → **확인 불가**(품질 판정 아님 · 폐기 아님).
- 사전 등록: v3.7 SHA 9b61479f… · test-flows 95c59a92… · Golden 3100d5d4… · 측정기 run-prod-agent.mjs SHA 545fdbef… · why_v33(= why_v31 A~H 글자 그대로 + P0/P1 규칙) · 두 작업 모두 「사전 등록 일치: 예」.
- 원본: `openai-result.md/json` · `claude-result.md/json` · `*-progress.jsonl`. 아래 수치는 모두 실제 AI(Mock 아님).

## 집계(실측)
| 항목 | OpenAI gpt-4.1-mini-2025-04-14 | Claude claude-haiku-4-5-20251001 |
|---|---|---|
| 판 / 오류 | 43 / 0 | 43 / 0 |
| 호출 | 686 | 670 |
| 입력 / 캐시 / 출력 토큰 | 1,110,128 / 158,592 / 42,399 | 1,876,416 / 0 / 76,577 |
| 턴 지연 p50 / p95 | 1,896 / 3,261 ms | 3,257 / 5,841 ms |
| 재시도 · 서버 거절 후보 | 147 · 101 | 128 · 92 |
| 공식 단가 계산 비용(참고 · 청구서 미확인) | 약 $0.46 | 약 $2.26 |

## why_v33 판정(결과 전 등록 기준 그대로)
| 항목 | OpenAI | Claude |
|---|---|---|
| A 43판 · 오류 0 | 통과 | 통과 |
| B 서버 무결성 | 통과(double_question_turns 0) | 통과 |
| C 정정 치명 | 통과(reask_after_correction 0) | 통과 |
| D 거절 뜻 재등장 | 통과 | 통과 |
| E 프로필 | 통과 | 통과 |
| F 화자 | 통과 | 통과 |
| G 형식·전송 | 통과 | 통과(형식 실패 0) |
| H 사람다움 | **실패** label_copy_questions 7(≤5) · ending_dominated_runs 4(통과) | 통과 — ending_dominated_runs 1 · 사람 전수 검토 PARTIAL(FAIL 아님) |
- OpenAI: 역할 후보 자격 없음(H). Claude: **A~H 모두 통과 → 역할 후보 자격 있음**(역할 확정은 대표·전략본부 결정 · 자동 확정 0).

## v3.7 수정 효과(run 37 v3.6 → run 38 v3.7 · 실제 AI)
- EA-25 정정 되묻기: OpenAI 1 → 0 · Claude 0 → 0.
- MS-09 화자 혼동: Claude CEO_META 가 ECHO 가 실제로 한 질문을 말함(「아까 물었던 건 바쁠 때 누군가와 만나는 게 좋은지 …였어요」) · speaker_in_reply 두 업체 0.
- H 「~군요」 쏠린 판: OpenAI 11 → 4 · Claude 8 → 1 · 끝맺음 비율 OpenAI 26% → 25% · Claude 30% → 21%.
- MS-10(측정기): double_question_turns OpenAI 0.
- 유지: complaint_saved · rejected_restated · latest_correction_missing_in_intro · empty_profile 두 업체 0.

## 새로 나온 것(P0/P1 분류 · why_v33 규칙)
- P0: 0건(사용자 사실 오염 · 정정 무시 · 거절 뜻 재등장 · 화자 뒤바뀜 · Profile 오반영 0 — 지표와 사람 검토 모두).
- P1 MS-11(OpenAI): 목적 이름 복사 2 → 7. 원인 추정: 완화 검사(끝맺음 · 라벨 복사)가 한 턴의 재요청 1회를 나눠 써서, 끝맺음을 고친 두 번째 후보의 라벨 복사가 그대로 남음. why_v33 H 문턱이라 이번 판 자격은 막음.
- P1 MS-12(Claude): 마무리 문장의 「당신」 13(run 37 에도 8) — 질문에만 딱딱한 말 검사가 있음.
- P1 EA-26(Claude): 빈 받아주기 복구에서 일반 듣기 문장 5(「네, 이어서 편하게 말해 주세요」) · 대화를 마친 판 23 → 20.

## 사람 검토 요약
- OpenAI PARTIAL: 끝맺음 쏠림 크게 줄음 · 라벨 복사 늘어남 · 반향 11.
- Claude PARTIAL(FAIL 아님): 메타·거절·불만 대응 정확 · 「~군요」 21% · 「당신」 마무리 · 일반 듣기 문장 5 · 반향 3.
