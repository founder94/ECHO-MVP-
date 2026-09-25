<!-- 출처: GitHub Actions echo-ab-real run 36103690087 (job 107971456881, commit 23a4484) 의 「실제 AI A/B」 단계 로그 중 result.md 묶음을 줄 앞 시각만 빼고 그대로 옮김. 키 없음(로그에서 *** 로 가려짐). 이 파일은 A/B 이름이 보인다 — 대표 블라인드 검수 전에는 열지 않는다. -->
# A/B Spike 하네스 결과 — 실제 OpenAI · 모델 gpt-4o-mini

- A = 운영 v27 원본(SHA-256 1aab64236bb7c9a4…, 저장소 rollback/doit-understanding.v27.ts · 실행 전 지문 확인) · B = spike/ab-20260925/agentB.mjs (Prompt B-1.0)
- 고정 입력 golden-failures.json SHA-256 3100d5d461a49795… · 판정 기준 golden-specs.json 380d6fb38fa0960e… · B 파일 SHA-256 a0031fcc8ddb546c… · 사전 고정 일치: 예
- 모델 조건(A·B 같음): temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 모델 gpt-4o-mini
- 토큰: o200k_base 로 센 값(요청 본문 system+user). REAL 실행이면 API usage(prompt/completion)를 따로 적는다 — 그것이 정본. 비용은 공식 가격표 확인 전 계산하지 않는다.
- 출처: ACTUAL = 운영 기록·대표 실기기 실제 입력 · SYNTHETIC = 지시서·검사표 예문. 기대 = 사람이 붙인 표시(객관 FAIL 판정에만 씀).

## FLOW1 — 운영 Galaxy 2026-09-25 04:20~04:26 KST — 같은 의미 질문 반복 후 질문 생성 실패(운영 query_logs 실측)
목적: 아직 정하지 않았어요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ACTUAL | 가볍게 우선 사람을 알아가고 싶어 | answer | answer(ai)·저장 | ❓ 어떤 사람을 알아가고 싶으세요? | 1 |  |  | answer·저장 | 💬 사람을 알아가는 것부터 시작하고 싶으시군요. / ❓ 어떤 성격의 사람과 이야기해보고 싶으세요? | 성격 | 1 |  |  |
| 2 | ACTUAL | 나 진심이라고 적은거 같은데 | repair | answer(ai)·저장 | ❓ 그럼 어떤 점에서 진심이라고 느끼셨나요? | 1 |  | repair 입력을 답으로 저장 | answer·저장 | 💬 진심으로 사람을 알아가고 싶으신가 보네요. / ❓ 어떤 성격의 사람과 이야기해보고 싶으세요? | 성격 | 1 |  | repair 입력을 답으로 저장, 앞과 글자까지 같은 질문 |
| 3 | ACTUAL | 마음이지머 | answer | answer(ai)·저장 |  | 2 | clue,clue |  | answer·저장 | 💬 마음이 중요하군요. / ❓ 어떤 마음으로 사람을 만나고 싶으세요? | 마음 | 1 |  |  |
| 4 | ACTUAL | 행동으로 보여줄때 | answer | answer(ai)·저장 | ❓ 그 행동이 어떤 모습일 때 가장 좋다고 생각하세요? | 1 |  |  | answer·저장 | 💬 행동으로 보여주는 것이 중요하군요. / ❓ 어떤 행동이 진심을 보여준다고 생각하세요? | 진심을 보여주는 행동 | 1 |  |  |
| 5 | ACTUAL | 적었자네 | repair | answer(ai)·저장 |  | 1 |  | repair 입력을 답으로 저장 | answer·저장 | 💬 그렇군요. 진심을 행동으로 보여주는 것이 중요하다고 생각하시는군요. |  | 1 |  | repair 입력을 답으로 저장 |
| 6 | ACTUAL | 몇번째 같은말이야!! | repair | answer(-)·비저장 |  | 0 |  |  | -·비저장 |  |  | 0 |  |  |
| 7 | ACTUAL | 행동이라고!! | correction | answer(-)·비저장 |  | 0 |  |  | -·비저장 |  |  | 0 |  |  |

## FLOW2 — LEVEL 3 FAIL #1·#2(2026-09-24 대표 실기기) — 짧은 답 뒤 「활동」 점프 · 되물음
목적: 편하게 지낼 친구를 원해요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ACTUAL | 그냥 편한친구 부담없이 | answer | answer(ai)·저장 | ❓ 편한 친구와 함께 어떤 활동을 하고 싶으세요? | 1 |  |  | answer·저장 | 💬 편한 친구를 원하시는군요. 부담 없이 지낼 수 있는 관계가 중요하겠어요. / ❓ 편한 친구와 어떤 활동을 하고 싶으세요? | 활동 선호 | 1 |  |  |
| 2 | ACTUAL | 활동?갑자기? | repair | ask(ai)·비저장 | 💬 여기에 답한 말로 어떤 사람을 소개할지 정해요. / (같은 질문 유지) 편한 친구와 함께 어떤 활동을 하고 싶으세요? | 1 |  |  | repair·비저장 | 💬 활동에 대한 질문은 이전에 했던 것인데, 편한 친구에 대한 이야기를 하셨죠. / ❓ 편한 친구와 어떤 활동을 하고 싶으세요? | 활동 | 1 |  | 앞과 글자까지 같은 질문 |

## FLOW3 — LEVEL 3 FAIL #3(2026-09-24 22:58~23:00 KST 대표 Galaxy) — 첫 답 원문은 기록에 없어 FAIL #1 첫 답으로 대신함(SYNTHETIC)
목적: 편하게 지낼 친구를 원해요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SYNTHETIC | 그냥 편한친구 부담없이 | answer | answer(ai)·저장 | ❓ 편한 친구와 함께 어떤 활동을 하고 싶으세요? | 1 |  |  | answer·저장 | 💬 편한 친구를 원하시는군요. 부담 없이 지낼 수 있는 관계가 중요하겠네요. / ❓ 편한 친구와 어떤 시간을 보내고 싶으세요? | 친구와의 활동 | 1 |  |  |
| 2 | ACTUAL | 취미생활? | answer | meta(rule)·비저장 | ❓ 편한 친구와 함께 어떤 취미를 즐기고 싶으세요? | 1 |  |  | answer·저장 | 💬 취미생활에 대해 이야기해볼까요? / ❓ 가장 좋아하는 취미는 무엇인가요? | 좋아하는 취미 | 1 |  |  |
| 3 | ACTUAL(캡처 재구성) | 아니 같은 취미생활 너가 어떤 취미가 있냐고 나한테 물어봐야 하는 거 아니야? | repair | ask(ai)·비저장 | 💬 저는 DO IT의 AI예요. 답을 듣고 다음 질문을 골라요. / (같은 질문 유지) 편한 친구와 함께 어떤 취미를 즐기고 싶으세요? | 1 |  |  | repair·비저장 | 💬 아, 제가 잘못 이해했네요. 당신이 어떤 취미가 있는지 물어보는 게 맞았죠. / ❓ 어떤 취미를 좋아하세요? | 취미 | 2 | self_same_intent |  |
| 4 | ACTUAL | 싸이클 테니스 골프 | answer | answer(ai)·저장 | ❓ 그 중에서 어떤 활동이 가장 즐거운 것 같아요? | 1 |  |  | repair·비저장 | 💬 아, 제가 잘못 이해했네요. 같은 취미에 대해 물어보는 게 맞았죠. / (질문 버림:self_same_intent) |  | 2 | self_same_intent,self_same_intent |  |

## FLOW4 — 추가 세트 — 지시서 예문(문제제기·정정·되묻기·모르겠어요·긴 답) + 「할말이없다 휴」는 실제 입력(2026-09-25 정정)
목적: 연애로 이어질 만남을 원해요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SYNTHETIC | 나는 사람을 빨리 만나는 것보다 천천히 알아가고 싶어. | answer | answer(ai)·저장 | ❓ 그렇다면, 어떤 방식으로 사람을 알아가는 게 좋다고 생각해요? | 1 |  |  | answer·저장 | 💬 천천히 알아가고 싶다는 말이 인상적이에요. / ❓ 어떤 대화를 나누고 싶으세요? | 대화 주제 | 1 |  |  |
| 2 | SYNTHETIC | 왜 또 물어봐? | repair | complaint(rule)·비저장 |  | 2 | clue,clue |  | repair·비저장 | 💬 그 질문은 이미 말씀하신 대화 주제와 관련이 있었네요. / (질문 버림:rejected_intent) |  | 2 | rejected_intent |  |
| 3 | SYNTHETIC | 아니 그게 아니라 | correction | correction(rule)·비저장 | 💬 제가 잘못 짚었네요. ⏎ 어떤 뜻이었는지 한 줄로 알려 줄래요? | 0 |  |  | repair·비저장 | 💬 아, 제가 잘못 이해했네요. 천천히 알아가고 싶다고 하셨죠? / ❓ 어떤 활동을 함께 하고 싶으세요? | 활동 선호 | 1 |  |  |
| 4 | SYNTHETIC | 활동 말고 편하게 대화하는 사람을 원한다는 거예요 | correction | ask(ai)·비저장 | 💬 여기에 답한 말로 어떤 사람을 소개할지 정해요. / (같은 질문 유지) 그렇다면, 어떤 방식으로 사람을 알아가는 게 좋다고 생각해요? | 1 |  |  | answer·저장 | 💬 편하게 대화하는 사람을 원하시는군요. / (질문 버림:self_same_intent) |  | 2 | self_same_intent |  |
| 5 | SYNTHETIC | 그 질문 말고 | repair | ask(ai)·비저장 | 💬 여기에 답한 말로 어떤 사람을 소개할지 정해요. / (같은 질문 유지) 그렇다면, 어떤 방식으로 사람을 알아가는 게 좋다고 생각해요? | 1 |  |  | repair·비저장 | 💬 그 질문이 아니라는 말씀이시군요. |  | 1 |  |  |
| 6 | SYNTHETIC | 왜 그걸 물어봐? | ask | ask(rule)·비저장 | 💬 그런 질문이 불편하셨군요. / (같은 질문 유지) 그렇다면, 어떤 방식으로 사람을 알아가는 게 좋다고 생각해요? | 1 |  |  | repair·비저장 | 💬 그 질문은 이미 말씀하신 것 같아요. |  | 1 |  |  |
| 7 | SYNTHETIC | 모르겠어요 | unsure | unsure(rule)·저장 |  | 2 | clue,clue |  | fatigue·비저장 | 💬 지치셨군요. 편하게 대화하는 사람을 원하신다고 하셨죠? |  | 1 |  |  |
| 8 | ACTUAL | 할말이없다 휴 | fatigue | fatigue(rule)·비저장 | 💬 괜찮아요. 지금 떠오르지 않으면 이 질문은 넘어가도 돼요. | 0 |  |  | fatigue·비저장 | 💬 지치셨군요. 편하게 대화할 사람을 원하신다고 하셨죠? |  | 1 |  |  |

## FLOW5 — v13.7~v14.3 운영 실제 입력(2026-09-22~24) — 문장 파손·무거운 질문·되묻기 저장. 목적은 기록에 없어 대체(SYNTHETIC)
목적: 아직 정하지 않았어요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ACTUAL | 에너지가 뺏기가 싫어서 | answer | answer(ai)·저장 | ❓ 어떤 상황에서 에너지가 뺏긴다고 느끼세요? | 1 |  |  | fatigue·비저장 | 💬 에너지가 뺏기는 건 힘들죠. 그런 기분 이해해요. |  | 1 |  |  |
| 2 | ACTUAL | 배려 | answer | ask(ai)·비저장 | 💬 여기에 답한 말로 어떤 사람을 소개할지 정해요. / (같은 질문 유지) 어떤 상황에서 에너지가 뺏긴다고 느끼세요? | 1 |  |  | fatigue·비저장 | 💬 배려라는 말이 나왔네요. 에너지가 뺏기는 게 싫으신가요? |  | 1 |  |  |
| 3 | ACTUAL | 그냥 아무생각없어 | unsure | unsure(ai)·저장 |  | 2 | repeat,repeat |  | fatigue·비저장 | 💬 그냥 아무 생각이 없으시군요. |  | 1 |  |  |
| 4 | ACTUAL | 딥하네 | repair | meta(rule)·비저장 | ❓ 그럴 때는 어떤 기분이 드나요? | 1 |  |  | fatigue·비저장 | 💬 딥하다는 말이 인상적이네요. |  | 1 |  |  |
| 5 | ACTUAL | 활동?질문이 머이래 | repair | meta(rule)·비저장 | ❓ 어떤 활동에 대해 이야기하고 싶으신가요? | 1 |  |  | fatigue·비저장 | 💬 활동에 대한 질문이 부담스러운가요? |  | 1 |  |  |

## FLOW6 — ANSWER FIRST — 사용자가 AI 에게 직접 물음(ECHO 옛 흐름 2026-09-16 대표 입력 3개 + 실제 AI 검사용 스크립트 문장 2개). 목적은 기록에 없어 대체
목적: 아직 정하지 않았어요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ACTUAL | 어떻게 대처하는게 좋을까? | ask | ask(ai)·비저장 | 💬 여기에 답한 말로 어떤 사람을 소개할지 정해요. / (같은 질문 유지) 어떤 만남을 원하세요? | 1 |  |  | unsure·저장 | 💬 아직 정하지 않으셨군요. 어떤 만남을 원하시는지 고민 중이신가요? |  | 1 |  | ask 입력을 답으로 저장 |
| 2 | ACTUAL | ai가 오타기 날수도 있어? | ask | meta(rule)·비저장 | ❓ AI가 오타를 낼 수도 있어요. 그럼에도 불구하고 어떤 점이 궁금하신가요? | 1 |  |  | ask·비저장 | 💬 오타가 날 수도 있어요. 질문이 어떤 의미인지 궁금해요. / ❓ 어떤 사람을 소개받고 싶으세요? | 소개받고 싶은 사람 | 1 |  |  |
| 3 | ACTUAL | 질문했는데 답을 못햐? | repair | complaint(ai)·비저장 | ❓ 답변이 늦어져서 불편하셨군요. ⏎ 어떤 점이 궁금하신지 말씀해 주실 수 있나요? | 1 |  |  | ask·비저장 | 💬 답을 못한 건 아니에요. 질문이 있었죠? / ❓ 어떤 성격의 사람을 만나고 싶으세요? | 소개받고 싶은 사람 | 1 |  |  |
| 4 | SYNTHETIC | 내가 언제 그렇게 말했어? | repair | complaint(ai)·비저장 |  | 2 | repeat,self_flag |  | fatigue·비저장 | 💬 지치셨군요. 괜찮아요. |  | 1 |  |  |
| 5 | SYNTHETIC | 사실은 일보다 사람이 더 힘들어요 | correction | answer(ai)·저장 | ❓ 사람이 힘든 이유는 어떤 것들이 있을까요? | 1 |  |  | answer·저장 | 💬 사람이 힘들다는 말씀을 하셨군요. / ❓ 어떤 종류의 사람을 만나고 싶으세요? | 만나고 싶은 사람의 종류 | 1 |  |  |

## FLOW7 — 대표 실제 입력 — 짧은 답 · 띄어쓰기 없는 답 · 질문 방향 항의(2026-09-17·22·24). 목적은 기록에 없어 대체
목적: 편하게 지낼 친구를 원해요

| # | 출처 | 사용자 | 기대 | A 종류·저장 | A 출력 | A 호출 | A 재시도 | A 객관FAIL | B 종류·저장 | B 출력 | B 의도 | B 호출 | B 재시도 | B 객관FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ACTUAL | 진실된마음 | answer | answer(ai)·저장 | ❓ 진실된 마음을 가진 친구와 어떤 활동을 함께 하고 싶나요? | 1 |  |  | answer·저장 | 💬 진실된 마음을 원하시는군요. / ❓ 친구와 어떤 활동을 함께 하고 싶으세요? | 활동 선호 | 1 |  |  |
| 2 | ACTUAL | 돈때문에 | answer | unsure(ai)·저장 | ❓ 돈 때문에 어떤 점이 걱정되나요? | 1 |  |  | answer·저장 | 💬 돈 때문에 고민이 있으신가요? / ❓ 친구와 함께 어떤 활동을 하고 싶으세요? | 돈 문제 | 1 |  |  |
| 3 | ACTUAL(재구성) | 뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야? | repair | complaint(rule)·비저장 |  | 2 | repeat,self_flag |  | repair·비저장 | 💬 말씀하신 내용을 잘 반영하지 못했네요. 제가 이전에 드린 질문이 적절하지 않았던 것 같아요. / (질문 버림:self_same_intent) |  | 2 | self_same_intent |  |

## 합계

| 항목 | A | B |
|---|---|---|
| turns | 34 | 34 |
| llm_turns | 30 | 32 |
| calls | 36 | 37 |
| calls_per_llm_turn | 1.2 | 1.16 |
| max_calls_in_turn | 2 | 2 |
| sys_tokens_per_call | 1492 | 702 |
| user_tokens_per_call | 273 | 243 |
| input_tokens_total_o200k | 63525 | 34983 |
| output_tokens_total_o200k | 4242 | 3552 |
| usage_prompt_tokens | 63921 | 35390 |
| usage_completion_tokens | 4242 | 3553 |
| api_cost_usd | 확인 불가(공식 단가·실제 usage 필요) | 확인 불가(공식 단가·실제 usage 필요) |
| retries | 12 | 6 |
| question_failed | 0 | 0 |
| question_dropped | 0 | 4 |
| no_question_turns | 11 | 18 |
| objective_fail_turns | 2 | 4 |
| turn_ms_p50 | 1294 | 1306 |
| turn_ms_p95 | 2942 | 5536 |
| turn_ms_max | 3528 | 6938 |
| llm_ms_p50 | 1245 | 1334 |
| llm_ms_max | 2921 | 5364 |

- 지연 p95 는 표본이 작아 사실상 최댓값에 가깝다(표본 수 = turns · calls).

## Context 구성 — 호출 1번당 평균 토큰(입력 JSON 항목별 · system 프롬프트 제외)

- A system 프롬프트 1492 토큰 · B system 프롬프트 702 토큰

| A 항목 | 토큰 |
|---|---|
| facts | 128 |
| hot_memory | 22 |
| already_asked | 16 |
| last_question | 15 |
| user_text | 11 |
| purpose | 10 |
| last_answer | 9 |
| previous_attempt | 7 |
| superseded | 2 |
| correction_target | 2 |
| answered_count | 1 |
| remaining | 1 |
| confirmed | 1 |
| corrected | 1 |
| unconfirmed | 1 |
| rejected | 1 |
| server_turn_type | 1 |

| B 항목 | 토큰 |
|---|---|
| facts | 90 |
| recent | 60 |
| user_stated | 13 |
| latest | 11 |
| last_question | 11 |
| purpose | 10 |
| previous_attempt | 8 |
| rejected_intents | 3 |
| answered_intents | 3 |
| confirmed | 1 |
| correction | 1 |
| rejected | 1 |

## Golden Failure 판정 — 기계로 셀 수 있는 것만

- 실제 AI 결과다. 뜻(이어짐·반영)은 아래 블라인드 검수로만 판정한다.

| Failure | Flow#턴 | 사용자 | A | A 판정 | B | B 판정 | 사람이 볼 것 |
|---|---|---|---|---|---|---|---|
| GF-01 | FLOW1#5 | 적었자네 | not_saved:FAIL no_error:PASS reply_present:FAIL | FAIL | not_saved:FAIL no_error:PASS reply_present:PASS | FAIL | 이미 들은 「진심」「행동」을 짚었나? 같은 뜻을 다시 묻지 않았나? |
| GF-01 | FLOW1#6 | 몇번째 같은말이야!! | not_saved:PASS no_error:PASS reply_present:FAIL | FAIL | not_saved:PASS no_error:PASS reply_present:FAIL | FAIL | 이미 들은 「진심」「행동」을 짚었나? 같은 뜻을 다시 묻지 않았나? |
| GF-02 | FLOW1#1 | 가볍게 우선 사람을 알아가고 싶어 | saved:PASS no_error:PASS | PASS | saved:PASS no_error:PASS | PASS | 방금 답에서 이어졌나? |
| GF-02 | FLOW1#3 | 마음이지머 | saved:PASS no_error:PASS | PASS | saved:PASS no_error:PASS | PASS | 방금 답에서 이어졌나? |
| GF-02 | FLOW1#4 | 행동으로 보여줄때 | saved:PASS no_error:PASS | PASS | saved:PASS no_error:PASS | PASS | 방금 답에서 이어졌나? |
| GF-03 | FLOW1#6 | 몇번째 같은말이야!! | not_saved:PASS no_error:PASS reply_present:FAIL | FAIL | not_saved:PASS no_error:PASS reply_present:FAIL | FAIL | 문제를 인정하고 방향을 바꿨나? |
| GF-05 | FLOW3#2 | 취미생활? | no_error:PASS | PASS | no_error:PASS | PASS | 취미 이야기로 받았거나 뜻을 물었나? 사용자에게 궁금한 걸 되묻지 않았나? |
| GF-06 | FLOW3#3 | 아니 같은 취미생활 너가 어떤 취미가 있냐고 나한테 물어봐야 하는 거 아니야? | not_saved:PASS no_error:PASS reply_present:PASS no_fixed_line:FAIL | FAIL | not_saved:PASS no_error:PASS reply_present:PASS no_fixed_line:PASS | PASS | 사용자가 제안한 방향으로 갔나? |
| GF-07 | FLOW3#4 | 싸이클 테니스 골프 | saved:PASS no_error:PASS | PASS | saved:FAIL no_error:PASS | FAIL | 싸이클·테니스·골프 중 하나에서 이어졌나? |
| GF-08 | FLOW2#1 | 그냥 편한친구 부담없이 | saved:PASS no_error:PASS | PASS | saved:PASS no_error:PASS | PASS | 「부담없이」에서 이어졌나(활동 점프 아님)? |
| GF-10 | FLOW2#1 | 그냥 편한친구 부담없이 | no_error:PASS | PASS | no_error:PASS | PASS | — |
| GF-11 | FLOW2#2 | 활동?갑자기? | not_saved:PASS no_error:PASS | PASS | not_saved:PASS no_error:PASS | PASS | 「갑자기」 에 대해 설명·사과했나? |
| GF-12 | FLOW5#1 | 에너지가 뺏기가 싫어서 | saved:PASS no_error:PASS | PASS | saved:FAIL no_error:PASS | FAIL | 사용자 구절을 끼워 문장이 깨지지 않았나? |
| GF-14 | FLOW5#4 | 딥하네 | not_saved:PASS no_error:PASS | PASS | not_saved:PASS no_error:PASS | PASS | 쉽게 다시 물었나? |
| GF-14 | FLOW5#5 | 활동?질문이 머이래 | not_saved:PASS no_error:PASS | PASS | not_saved:PASS no_error:PASS | PASS | 쉽게 다시 물었나? |
| GF-22 | FLOW6#1 | 어떻게 대처하는게 좋을까? | not_saved:PASS reply_present:PASS | PASS | not_saved:FAIL reply_present:PASS | FAIL | 물은 것에 실제로 답했나? |
| GF-22 | FLOW6#2 | ai가 오타기 날수도 있어? | not_saved:PASS reply_present:FAIL | FAIL | not_saved:PASS reply_present:PASS | PASS | 물은 것에 실제로 답했나? |
| GF-53 | FLOW6#2 | ai가 오타기 날수도 있어? | not_saved:PASS reply_present:FAIL | FAIL | not_saved:PASS reply_present:PASS | PASS | 오타 질문에 답했나? |
| GF-26 | FLOW6#3 | 질문했는데 답을 못햐? | not_saved:PASS reply_present:FAIL no_fixed_line:PASS | FAIL | not_saved:PASS reply_present:PASS no_fixed_line:PASS | PASS | 따진 내용에 답했나? |
| GF-26 | FLOW6#4 | 내가 언제 그렇게 말했어? | not_saved:PASS reply_present:FAIL no_fixed_line:PASS | FAIL | not_saved:PASS reply_present:PASS no_fixed_line:PASS | PASS | 따진 내용에 답했나? |
| GF-25 | FLOW6#5 | 사실은 일보다 사람이 더 힘들어요 | saved:PASS no_error:PASS | PASS | saved:PASS no_error:PASS | PASS | 「사람이 더 힘들다」를 반영했나? |
| GF-36 | FLOW7#1 | 진실된마음 | saved:PASS no_error:PASS no_fixed_line:PASS | PASS | saved:PASS no_error:PASS no_fixed_line:PASS | PASS | 「진실된 마음」에서 이어졌나? |
| GF-24 | FLOW7#2 | 돈때문에 | saved:PASS no_error:PASS | PASS | saved:PASS no_error:PASS | PASS | 「돈 때문에」에서 이어졌나? |
| GF-33 | FLOW7#3 | 뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야? | not_saved:PASS no_error:PASS reply_present:FAIL no_fixed_line:PASS | FAIL | not_saved:PASS no_error:PASS reply_present:PASS no_fixed_line:PASS | PASS | 앞 말을 반영한 질문으로 바뀌었나? |
| GF-33 | FLOW4#8 | 할말이없다 휴 | not_saved:PASS no_error:PASS | PASS | not_saved:PASS no_error:PASS | PASS | 쉬어 가도 된다고 했나? |
| GF-46 | FLOW4#3 | 아니 그게 아니라 | no_error:PASS | PASS | no_error:PASS | PASS | 무엇이 달랐는지 물었나? |
