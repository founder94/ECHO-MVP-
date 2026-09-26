# ECHO 3-Provider Model Router — 비교 계획 고정(2026-09-27)

근거: 대표 「FINAL MASTER EXECUTION LOCK」(2026-09-27) §25 PHASE H · §27 · §28.
상태: **계획만 고정.** 실제 Gemini·Claude 호출 0 · 키 0 · 운영 변경 0. 비교 모델 이름은 공식 확인 뒤 FROZEN models 에 등록(지금은 비어 있음 = 실제 실행 거부).

## 1. 고정하는 것(모든 업체 같음)
- Agent: `candidates/agent-v3.2.ts`(SHA-256 `d2ab3fc89b214bd2…` · run 34 서버 결함 4개 수정판 · 2026-09-27 대표 「v3.2 SERVER FINAL FIX」) — 비교 중 고치지 않는다. Router 는 바깥에서 `llm()` 자리에 끼운다. (run 34 기준선 = v3.1 `95b06edd…` + gpt-4.1-mini — 서버가 달라 같은 조건 비교에는 OpenAI 도 v3.2 로 다시 돈다.)
- 입력: `test-flows.json` 43판(SHA-256 `95c59a923c84adc9…`) · 골든 실패 세트 G01~G15.
- 판정: why_v29 규칙(why_v28 (1)~(12) + 판정식 v32 두 개 + v3.2 지표 5개 + Router) + 사람 검토(Humanity) 전수.
- 생성 설정: temperature 0.2 · max_tokens 768 · JSON 출력. top_p 0.9 는 받는 업체만(Anthropic 부품은 temperature 만 보냄).
- 프롬프트: v3.1 그대로(OpenAI 에 맞춰 다듬어진 글이라 다른 업체에 불리할 수 있음 — 결과에 함께 적는다).

## 2. 바꾸는 것
- 모델만. 1단계는 **업체 하나씩 단독**(Router 역할 전부 같은 모델)으로 43판을 돈다 → 업체별 실력.
- 2단계는 1단계 결과로 PRIMARY·SPECIALIST·FALLBACK 을 채운 **조합** 1판(같은 43판) → 조합 효과·비용.

## 3. 후보(이름은 공식 API 사용 가능 확인 뒤 확정 · 추정 이름 금지)
| 업체 | 후보 | 상태 |
|---|---|---|
| OpenAI | gpt-4.1-mini · gpt-4.1 (기준선 gpt-4o-mini = run 33, 서버 v3.0 이라 같은 조건 아님) | 계정 실측 호출 가능(2026-09-25) |
| Anthropic | claude-haiku-4-5-20251001 · claude-sonnet-5 | 키 없음 · 부품 형식 공식 문서 재확인 필요 |
| Google | 확인 불가(공식 목록 접근 차단) | 키 없음 · 모델 이름·부품 형식 확인 필요 |

## 4. 항목별로 보는 것(§6 → 시험 흐름)
일반 대화(F1~F4 · FLOW1~7) · 사람다움(전 판 사람 검토) · 맥락(FLOW·H_TOPIC) · 정정(F5~F7) · 거절(H_REJECT · S·T 반박) · 메타(CEO_META) · 불만(CEO_COMPLAINT · FLOW1) · 주제 이동(H_TOPIC) · 끝내기(F6 「질문이 너무 많아」 · F1 넘기기) · 형식(retry_reasons · speak_format) · 소개 쓰기(empty_profile · intro_overwrite · latest_correction_missing · raw_verbatim_leak · superseded_stale) · 실패 복구(speak_recovery_types · generic_listen_after_redirect) · 지연(p50·p95) · 비용(calls·tokens·cached).

## 5. 관측(업체마다 · Router `CallRecord` · `performanceRows`)
provider · model · role · stage · action · retry · fallback(chain_index>0) · fallback_from · error · accepted(서버 채택) · input/cached/output tokens · latency · budget_downgrade · skipped_unhealthy.
비용 = 공식 단가를 확인한 뒤에만 계산(없으면 「확인 불가」). 표: 대화 1 · 100 · 1,000 · 10,000.

## 6. 역할 정하는 규칙(결과 보기 전 고정)
1. 서버 판정 (1)~(12) 중 하나라도 FAIL 인 업체는 어떤 역할에도 넣지 않는다.
2. PRIMARY = 사람다움 PASS 중 비용이 가장 낮은 모델. 사람다움 FAIL 이면 싸도 PRIMARY 불가.
3. SPECIALIST = 불만·메타·정정·복구·소개 다시 만들기 항목에서 사람 검토가 가장 좋은 모델(PRIMARY 와 같아도 됨).
4. FALLBACK = PRIMARY 와 **다른 업체** 중 서버 판정 PASS · 형식 실패가 가장 적은 모델(업체 장애 대비).
5. 세 업체 동시 호출 0 · 보통 턴 = 1개 모델.

## 7. 실제 호출 전에 필요한 것(대표 승인)
- Anthropic·Google 키 등록(대표 직접). Anthropic 후보 이름 `ANTHROPIC_API_KEY`(시험용은 기존 `OPENAI_API_KEY_AB_TEST` 틀을 따를지 연결 승인 때 확정) · Gemini 키 이름은 공식 문서·현재 프로젝트 기준 확인 뒤 확정. 운영 Supabase Edge Secret 은 운영 연결 승인 때 따로.
- 시험 도구 변경: `harness-lib.mjs` 의 OpenAI 전용 호출을 Router(`router/router.ts`)로 바꾸고 업체별 집계 추가 · 워크플로가 새 키를 시험 환경에 넘김.
- Anthropic·Gemini 실제 부품은 아직 없다(가짜·미연결 자리만) — 공식 문서로 요청 형식을 확인한 뒤 만든다.
- 개인정보: 대화 원문이 Google·Anthropic 으로도 간다 — 처리방침(처리위탁·국외이전) 법무 확인.
