# run 35 — 3-Provider 43판 비교 검토(2026-09-27)

- 실행: GitHub Actions run 36265852004 (수동 실행 · commit 0a5f2b6 · 19:23–19:49 UTC)
- 사전 등록: v3.4 SHA ab9822f0… · test-flows 95c59a92… · Golden 3100d5d4… · 일치 = 예
- 원본: `compare43-result.md`(전 대화 문장) · `compare43-result.json`(집계). 호출별 성능 기록(model-performance.jsonl)은 Actions 첨부물(7일)에만 있음 — 이 환경에서 내려받기 차단(403).

## 집계(실측)
| 항목 | OpenAI gpt-4.1-mini-2025-04-14 | Claude claude-haiku-4-5-20251001 | Gemini gemini-3.5-flash-lite |
|---|---|---|---|
| 대화 / 턴 | 43 / 287 | 43 / 287 | 43 / 287(41판 무효) |
| 호출 | 644 | 639 | 163(성공 35 · 오류 128) |
| 입력 / 캐시 / 출력 토큰 | 929,650 / 75,392 / 40,963 | 1,550,543 / 0 / 75,414 | 45,107 / 0 / 1,738 |
| 턴 지연 p50 / p95 | 1,644 / 3,027 ms | 3,129 / 5,665 ms | 판정 불가 |
| 재시도 · 서버가 거절한 후보 | 76 · 56 | 82 · 57 | 276 · 2 |
| 다른 업체로 넘어가기 | 0(설계상 단독) | 0 | 0 |
| 끝난 대화 | 28 | 22 | 2 |

## why_v30(사전 등록) 판정 — 서버 판정 (1)~(13)
- OpenAI FAIL 8: redirect_empty_reply 1 · rebuttal2_user_words_kept 7/8 · empty_profile 1 · already_answered_reask 1 · same_question_again 1 · rich_answer_padding 1 · complaint_saved 3 · redirect_saved 3
- Claude FAIL 3: latest_correction_missing_in_intro 1 · unconfirmed_fact_ack_v213 1 · generic_listen_after_redirect 2
- Gemini FAIL 10: 업체 오류로 무효(errors 270)
- 규칙 ①(하나라도 FAIL 이면 역할 0)에 따라 **세 업체 모두 역할 자격 없음**.

## 원인 분류
| 실패 | 분류 | 기록 |
|---|---|---|
| 짧은 반응·항의가 answer 로 읽혀 사실 저장(OpenAI 3) | SERVER(answer 경로 근거 확인 없음) · 드러낸 것 MODEL | EA-21 |
| 소개에서 최신 정정 누락(Claude 1) | SERVER+MODEL | EA-22 |
| HELP 빈 답 → 일반 듣기 문장(Claude) | SERVER(복구 경로) · 드러낸 것 MODEL | EA-23 |
| 거절한 뜻 재확인(OpenAI H_REJECT) | MODEL | MS-04 |
| 화자 혼동 「내가 적은」(OpenAI) | MODEL | MS-05 |
| 사람다움 PARTIAL(양쪽) | MODEL | MS-06 |
| Gemini 128 오류 → 차단 → 무효 | ROUTER+UNKNOWN(한도 추정) | PR-01 |

## 사람 검토(Humanity) — 전 대화 문장 기준
- OpenAI: PARTIAL — 받아주기 없는 질문만 턴 77/287(설문 느낌) · 불만 뒤 새 질문 17/30 · 목적 라벨 복사 · 메타에 돌려 말함(CEO_META 2). 장점: 「~군요」 23% · 짧고 빠름.
- Claude: PARTIAL — 「~군요/~구나」 124/274(45%) 반복 · 문법 흔들림 · 반향. 장점: 메타에 바로 답함 · 불만 뒤 질문 강행 적음(11/30) · HELP 에 예시 · 거절 처리 정확 · 사실 오염 0.
- Gemini: 판정 불가(성공한 1판은 자연스러웠으나 표본 부족).
