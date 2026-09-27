# run 36 — v3.5 3-Provider 43판 재비교 검토(2026-09-27)

- 실행: GitHub Actions run 36275765789(수동 · commit 7c7145b · 업체별 작업). 앞선 시도 run 36268683262 는 120분 제한으로 결과 유실(CL-11).
- 사전 등록: v3.5 SHA 33824d09… · test-flows 95c59a92… · Golden 3100d5d4… · why_v31 · 세 작업 모두 「사전 등록 일치: 예」.
- 원본: `openai-result.md/json` · `claude-result.md/json` · `gemini-result.md/json` · 대화별 진행 기록 `*-progress.jsonl`.

## 집계(실측)
| 항목 | OpenAI gpt-4.1-mini-2025-04-14 | Claude claude-haiku-4-5-20251001 | Gemini gemini-3.5-flash-lite |
|---|---|---|---|
| 판 / 턴 | 43 / 287 | 43 / 287 | 4(중단) |
| 호출 | 663 | 644 | 16 성공 · 429 재시도 79 |
| 입력 / 캐시 / 출력 토큰 | 1,007,574 / 100,992 / 41,926 | 1,673,966 / 0 / 76,423 | 3,874 / 0 / 206 |
| 턴 지연 p50 / p95 | 1,764 / 3,019 ms | 3,035 / 5,327 ms | 판정 불가 |
| 재시도 · 서버 거절 후보 | 95 · 69 | 86 · 65 | — |
| 작업 시간 | 9분 | 16분 | 45분(중단) |

## why_v31 판정(결과 전 등록 기준 그대로)
- OpenAI FAIL 3: E empty_profile 1 · H ending_dominated_runs 14(≤4) · H label_copy_questions 15(≤5)
- Claude FAIL 1: H ending_dominated_runs 9(≤4)
- Gemini FAIL: A runs 4 · errors 32 · G provider_errors 429 RESOURCE_EXHAUSTED
- → 역할 자격 통과 업체 0 → 역할 확정 0.

## v3.4 → v3.5 에서 닫힌 것(두 업체 공통 0)
complaint_saved · redirect_saved · rejected_restated · speaker_in_reply · latest_correction_missing_in_intro · generic_listen_after_redirect · correction/rejection 치명 항목 전부.

## 사람 검토 요약
- OpenAI PARTIAL: 받아주기 없는 질문 68/287 · 목적 라벨 복사 16 · 「~군요」 28% · 불만 뒤 질문 12/25.
- Claude PARTIAL: 「~군요」 45% → 30% · 불만 뒤 질문 4/22 · 메타·거절·불만 대응 우수 · 「이거야.」 같은 빈약한 메타 답 1(MS-07).
- Gemini: 측정 불가(할당량 소진 · PR-02).

## 새 실패 기록
EA-24(빈 소개 · 서버) · MS-07(Claude 메타 빈약) · MS-08(사람다움 문턱) · PR-02(Gemini 429 RESOURCE_EXHAUSTED) · CL-11(결과 유실).
