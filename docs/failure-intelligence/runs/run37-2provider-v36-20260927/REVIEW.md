# run 37 — v3.6 OpenAI · Claude 43판 재비교 검토(2026-09-27)

- 실행: GitHub Actions run 36289721102(수동 · commit 32ff6c6 · 업체별 작업 2개). Gemini 는 계정 할당량 확인 전이라 실행 0(PR-02) → 판정 「확인 불가」.
- 사전 등록: v3.6 SHA 894a342d… · test-flows 95c59a92… · Golden 3100d5d4… · why_v32(= why_v31 A~H 글자 그대로 · 문턱 변경 0) · 두 작업 모두 「사전 등록 일치: 예」.
- 원본: `openai-result.md/json` · `claude-result.md/json` · 대화별 진행 기록 `*-progress.jsonl`.

## 집계(실측)
| 항목 | OpenAI gpt-4.1-mini-2025-04-14 | Claude claude-haiku-4-5-20251001 |
|---|---|---|
| 판 / 오류 | 43 / 0 | 43 / 0 |
| 호출 | 663 | 639 |
| 입력 / 캐시 / 출력 토큰 | 1,008,261 / 111,616 / 41,842 | 1,665,553 / 0 / 76,629 |
| 턴 지연 p50 / p95 | 1,806 / 3,079 ms | 3,131 / 5,797 ms |
| 재시도 · 서버 거절 후보 | 105 · 75 | 86 · 62 |
| 작업 시간 | 9.5분 | 약 16분 |

## why_v32(= why_v31) 판정 — 결과 전 등록 기준 그대로
| 항목 | OpenAI | Claude |
|---|---|---|
| A 43판 · 오류 0 | 통과 | 통과 |
| B 서버 무결성 | **실패** double_question_turns 1 | 통과 |
| C 정정 치명 | **실패** reask_after_correction 1 | 통과 |
| D 거절 뜻 재등장 | 통과 | 통과 |
| E 프로필 | 통과(empty_profile 1 → 0) | 통과 |
| F 화자 | 통과 | 통과 |
| G 형식·전송 | 통과(형식 실패 0/663) | 통과(1/639) |
| H 사람다움 | **실패** ending_dominated_runs 11(≤4) | **실패** ending_dominated_runs 8(≤4) |
- → 역할 자격 통과 업체 0 → 역할 확정 0(자동 결정 0). Gemini = 확인 불가.

## v3.6 세 가지 수정의 실제 효과(v3.5 run 36 → v3.6 run 37)
- EA-24 빈 소개: OpenAI empty_profile 1 → 0 · Claude 0 → 0.
- MS-08 라벨 복사: OpenAI label_copy_questions 15 → 2 · Claude 3 → 0.
- MS-07 「이거야.」: Claude CEO_META casual 2 에서 사라짐. 다만 같은 자리 답이 「아, 내가 물었던 건 '그래도 누군가 만나고 싶은 마음은 있어.'였어.」 — 사용자 말을 ECHO 질문처럼 말함(화자 혼동 · speaker_in_reply 검출 모양 밖) → MS-09.
- v3.5 에서 닫힌 것 유지: complaint_saved · rejected_restated · speaker_in_reply · latest_correction_missing_in_intro 두 업체 모두 0.

## 새로 나온 실패(OpenAI) — v3.6 수정이 닿지 않는 경로
- C reask_after_correction 1: F5 polite 6 「아니 매일은 부담스럽고 주말에 한 번 보면 좋겠어」 → 「주말에는 주로 어떤 시간대가 좋으세요?」(정정한 내용 「주말」을 다시 파고듦). v3.5 run 36 같은 자리는 모델 질문이 다른 검사로 버려져 받아주기만. 서버 reaskAfterCorrection 검사가 이 모양(정정 값 자체를 되묻기)을 잡지 않음 → EA-25.
- B double_question_turns 1: 「내가 언제 그렇게 말했어?」(REPAIR) → 받아주기가 사용자 말을 그대로 인용(「말씀하신 "내가 언제 그렇게 말했어."를 …」)해 인용 속 「언제」가 질문으로 세어짐 + 새 질문. 받아주기 자체도 반향·엉뚱한 질문 → MS-10.
- 두 건 모두 v3.6 변경 경로(ANSWER_USER 가리키기 한마디 · 질문 라벨 복사 · 빈 소개) 밖이며 v3.5 코드와 같은 검사로 판정됨 — 모델 출력 차이(온도 0.2)가 드러낸 서버 검사 빈틈.

## 사람 검토 요약
- OpenAI PARTIAL: 「~군요」 29% → 26% · 라벨 복사 거의 사라짐 · 받아주기 없는 질문 연속 4 → 9 턴(문턱 28 이내) · 반향 12.
- Claude PARTIAL: 「~군요」 30% 그대로 · 반향 4 · 메타 답 약함(「방금 물으신 질문이 맞아요.」 · MS-09 화자 혼동).
