# 실제 AI run 기록 (2026-09-26 ~)

> `docs/failure-intelligence/runs/run-NN.json` 에서 생성(`node product/spike/failure-intelligence/fi-build.mjs`). 손으로 고치지 않는다.
> 새 run 은 `record-run.mjs` 로 남긴다. GitHub Actions 첨부물은 7일 뒤 지워지므로, 실행 뒤 7일 안에 기록한다.

- 이 기록은 **검사 결과**다. 실제 사용자 사실이 아니다(`user_fact: false`). Profile·Matching 에 쓰지 않는다.
- 판정(verdict)은 사전 등록 이력 글(verdict_ref)에서 뽑은 요약이다. AUTO_GATE_MET = 자동 사전 규칙만 충족(사람 검토 PASS 아님) · SEE_REF = 글에 판정 낱말 없음. 사람 검토 결과는 verdict_ref 원문을 본다.
- 「—」 = 그 run 에서 재지 않은 지표(0 이 아님). 대화 원문·턴별 출력은 남기지 않는다.
- 합계 31개 — 실제 AI: UNKNOWN 6 · REAL 22 · NO_ACTIONS_RUN_RECORDED 3 · 판정: UNKNOWN 6 · SEE_REF 5 · AUTO_GATE_MET 7 · FAIL 10 · PASS 1 · INVALID 1 · PARTIAL 1

| run | 종류 | Actions | 커밋 | 실제 AI | 사전 등록 일치 | 판정 | 모델 | runs | turns | errors | retries | input_tokens | complaint_saved | same_question_again | correction_lead_missed | empty_profile | already_answered_reask | rebuttal_reappearance | content_result_as_fact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ab | 36103690087 | 23a4484 | UNKNOWN | — | UNKNOWN | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 2 | models | 36107887216 | 809c3cd | UNKNOWN | — | UNKNOWN | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 3 | model_gate | 36108344306 | e0de6dc | UNKNOWN | — | UNKNOWN | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 4 | core | 36111514762 | 133ff56 | UNKNOWN | — | UNKNOWN | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 5 | agent | 36114445447 | 5411c2c | UNKNOWN | — | UNKNOWN | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 6 | agent | 36115418519 | c285210 | UNKNOWN | — | UNKNOWN | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 7 | prod_agent | 36118572833 | 4308f28 | REAL | 예 | SEE_REF | gpt-4o-mini | 10 | 61 | 0 | 14 | 94620 | 0 | — | — | — | — | — | — |
| 7 | prod_agent | 36118572833 | 4308f28 | REAL | 예 | SEE_REF | gpt-4.1-mini | 10 | 61 | 0 | 2 | 85380 | 2 | — | — | — | — | — | — |
| 7 | prod_agent | 36118572833 | 4308f28 | REAL | 예 | SEE_REF | gpt-4.1 | 10 | 61 | 0 | 2 | 84220 | 0 | — | — | — | — | — | — |
| 8 | prod_agent | 36119280537 | eff7ad2 | REAL | 예 | SEE_REF | gpt-4o-mini | 10 | 61 | 0 | 13 | 101044 | 0 | — | — | — | — | — | — |
| 8 | prod_agent | 36119280537 | eff7ad2 | REAL | 예 | SEE_REF | gpt-4.1-mini | 10 | 61 | 0 | 2 | 91355 | 2 | — | — | — | — | — | — |
| 8 | prod_agent | 36119280537 | eff7ad2 | REAL | 예 | SEE_REF | gpt-4.1 | 10 | 61 | 0 | 1 | 91235 | 0 | — | — | — | — | — | — |
| 9 | prod_agent | 36119792722 | 407260e | REAL | 예 | SEE_REF | gpt-4o-mini | 10 | 61 | 0 | 19 | 106666 | 0 | — | — | — | — | — | — |
| 9 | prod_agent | 36119792722 | 407260e | REAL | 예 | SEE_REF | gpt-4.1-mini | 10 | 61 | 0 | 2 | 90439 | 2 | — | — | — | — | — | — |
| 9 | prod_agent | 36119792722 | 407260e | REAL | 예 | SEE_REF | gpt-4.1 | 10 | 61 | 0 | 3 | 94014 | 1 | — | — | — | — | — | — |
| 10 | prod_agent | 36127469093 | 198d91a | REAL | 예 | SEE_REF | gpt-4o-mini | 12 | 73 | 0 | 20 | 139749 | 0 | 0 | — | — | — | — | — |
| 10 | prod_agent | 36127469093 | 198d91a | REAL | 예 | SEE_REF | gpt-4.1-mini | 12 | 73 | 0 | 1 | 123870 | 5 | 2 | — | — | — | — | — |
| 10 | prod_agent | 36127469093 | 198d91a | REAL | 예 | SEE_REF | gpt-4.1 | 12 | 73 | 0 | 2 | 124227 | 1 | 2 | — | — | — | — | — |
| 11 | prod_agent | 36129571721 | c9a8e32 | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 14 | 89 | 0 | 31 | 225788 | 0 | 6 | — | — | — | — | — |
| 11 | prod_agent | 36129571721 | c9a8e32 | REAL | 예 | AUTO_GATE_MET | gpt-4.1-mini | 14 | 89 | 0 | 1 | 188964 | 4 | 3 | — | — | — | — | — |
| 11 | prod_agent | 36129571721 | c9a8e32 | REAL | 예 | AUTO_GATE_MET | gpt-4.1 | 14 | 89 | 0 | 4 | 193828 | 0 | 2 | — | — | — | — | — |
| 12 | prod_agent | — | — | NO_ACTIONS_RUN_RECORDED | — | FAIL | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 13 | prod_agent | 36138550587 | d917445 | REAL | 예 | FAIL | gpt-4o-mini | 14 | 89 | 0 | 52 | 280346 | 0 | 10 | — | — | — | — | — |
| 13 | prod_agent | 36138550587 | d917445 | REAL | 예 | FAIL | gpt-4.1-mini | 14 | 89 | 0 | 1 | 209808 | 3 | 2 | — | — | — | — | — |
| 13 | prod_agent | 36138550587 | d917445 | REAL | 예 | FAIL | gpt-4.1 | 14 | 89 | 0 | 3 | 212295 | 0 | 2 | — | — | — | — | — |
| 14 | prod_agent | 36139695084 | 70c1466 | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 14 | 89 | 0 | 35 | 266768 | 0 | 9 | — | — | — | — | — |
| 14 | prod_agent | 36139695084 | 70c1466 | REAL | 예 | AUTO_GATE_MET | gpt-4.1-mini | 14 | 89 | 0 | 4 | 217854 | 2 | 4 | — | — | — | — | — |
| 14 | prod_agent | 36139695084 | 70c1466 | REAL | 예 | AUTO_GATE_MET | gpt-4.1 | 14 | 89 | 0 | 3 | 215731 | 0 | 0 | — | — | — | — | — |
| 15 | prod_agent | 36141532032 | 1079cfe | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 14 | 89 | 0 | 40 | 267577 | 0 | 8 | — | — | — | — | — |
| 15 | prod_agent | 36141532032 | 1079cfe | REAL | 예 | AUTO_GATE_MET | gpt-4.1-mini | 14 | 89 | 0 | 4 | 219497 | 1 | 3 | — | — | — | — | — |
| 15 | prod_agent | 36141532032 | 1079cfe | REAL | 예 | AUTO_GATE_MET | gpt-4.1 | 14 | 89 | 0 | 2 | 214458 | 0 | 1 | — | — | — | — | — |
| 16 | prod_agent | 36166275489 | 54192bd | REAL | 예 | FAIL | gpt-4o-mini | 14 | 89 | 0 | 22 | 250117 | 1 | 7 | — | — | — | — | — |
| 16 | prod_agent | 36166275489 | 54192bd | REAL | 예 | FAIL | gpt-4.1-mini | 14 | 89 | 0 | 2 | 226088 | 4 | 2 | — | — | — | — | — |
| 16 | prod_agent | 36166275489 | 54192bd | REAL | 예 | FAIL | gpt-4.1 | 14 | 89 | 0 | 0 | 219660 | 2 | 1 | — | — | — | — | — |
| 17 | prod_agent | 36167645400 | 68fcf20 | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 14 | 89 | 0 | 33 | 270203 | 0 | 7 | — | — | — | — | — |
| 17 | prod_agent | 36167645400 | 68fcf20 | REAL | 예 | AUTO_GATE_MET | gpt-4.1-mini | 14 | 89 | 0 | 2 | 225556 | 4 | 0 | — | — | — | — | — |
| 17 | prod_agent | 36167645400 | 68fcf20 | REAL | 예 | AUTO_GATE_MET | gpt-4.1 | 14 | 89 | 0 | 1 | 222436 | 0 | 1 | — | — | — | — | — |
| 18 | prod_agent | 36173141827 | 254d4ce | REAL | 예 | SEE_REF | gpt-4o-mini | 14 | 89 | 0 | 34 | 272206 | 0 | 10 | — | — | — | — | — |
| 18 | prod_agent | 36173141827 | 254d4ce | REAL | 예 | SEE_REF | gpt-4.1-mini | 14 | 89 | 0 | 2 | 225720 | 6 | 1 | — | — | — | — | — |
| 18 | prod_agent | 36173141827 | 254d4ce | REAL | 예 | SEE_REF | gpt-4.1 | 14 | 89 | 0 | 2 | 224801 | 1 | 1 | — | — | — | — | — |
| 19 | prod_agent | — | 3bf38b8 | NO_ACTIONS_RUN_RECORDED | — | PASS | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 20 | prod_agent | 36232498018 | da5d929 | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 18 | 119 | 0 | 28 | 398373 | 0 | 7 | — | — | — | — | — |
| 21 | prod_agent | — | ba7963d | NO_ACTIONS_RUN_RECORDED | — | INVALID | — | — | — | — | — | — | — | — | — | — | — | — | — |
| 22 | prod_agent | 36233457371 | ce6495b | REAL | 예 | FAIL | gpt-4o-mini | 18 | 119 | 0 | 24 | 391445 | 0 | 15 | 2 | — | — | — | — |
| 23 | prod_agent | 36233993673 | debc54c | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 18 | 119 | 0 | 30 | 393713 | 0 | 13 | 0 | — | — | — | — |
| 24 | prod_agent | 36234330019 | 04faf99 | REAL | 예 | AUTO_GATE_MET | gpt-4o-mini | 18 | 119 | 0 | 26 | 398828 | 0 | 12 | 0 | — | — | — | — |
| 25 | prod_agent | 36234650822 | adb7ba1 | REAL | 예 | FAIL | gpt-4o-mini | 18 | 119 | 0 | 25 | 387772 | 0 | 11 | 1 | — | — | — | — |
| 26 | prod_agent | 36235909681 | f7aa771 | REAL | 예 | FAIL | gpt-4o-mini | 20 | 139 | 0 | 24 | 445917 | 0 | 11 | 2 | 0 | 1 | — | — |
| 27 | prod_agent | 36236615087 | 6fc9eeb | REAL | 예 | PARTIAL | gpt-4o-mini | 22 | 167 | 0 | 37 | 530399 | 0 | 10 | 2 | 0 | 0 | — | — |
| 28 | prod_agent | 36237525011 | dbb2936 | REAL | 예 | FAIL | gpt-4o-mini | 28 | 203 | 0 | 33 | 645131 | 0 | 11 | 2 | 1 | 0 | 0 | 0 |
| 29 | prod_agent | 36238911394 | 3166f4c | REAL | 예 | FAIL | gpt-4o-mini | 32 | 227 | 0 | 11 | 658351 | 0 | 7 | 2 | 0 | 0 | 0 | 0 |
| 30 | prod_agent | 36239502389 | 5e1c3df | REAL | 예 | FAIL | gpt-4o-mini | 32 | 227 | 0 | 53 | 754411 | 0 | 9 | 2 | 0 | 1 | 0 | 0 |
| 31 | prod_agent | 36240304626 | 013429c | REAL | 예 | FAIL | gpt-4o-mini | 34 | 239 | 0 | 56 | 794177 | 0 | 13 | 2 | 1 | 1 | 0 | 0 |
