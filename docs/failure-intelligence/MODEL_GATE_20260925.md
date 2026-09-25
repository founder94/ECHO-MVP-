# MODEL GATE 준비 (2026-09-25)

근거: 대표 「REAL AI RUN 1 후속 · 블라인드 검수 간소화 + MODEL GATE 준비」.
- 준비만 했다. 모델 변경·실행 0. 운영 변경 0.

## 현재 판정 (대표 확정, 2026-09-25)
| 항목 | 판정 |
|---|---|
| Current A(v27) | FAIL |
| B-1.0 | FAIL — 기계 판정이 A 보다 나아도 운영 후보로 확정하지 않는다 |
| B WIN | 확인 불가 |
| Conversation P0 | FAIL |
| VERIFIED Defense | 0 |

## 대표 블라인드 검수 전 금지
- A 수정 · B 수정 · Prompt 수정 · Intent 규칙 수정 · 새 Guard · 새 휴리스틱.
- run1 결과는 그대로 보존한다.

## BASELINE 모델
- run1 요청 모델 = `gpt-4o-mini`. OpenAI 가 실제로 쓴 세부판(snapshot)은 확인 불가다.
- 모델 비교는 이 값을 BASELINE 으로 쓴다.
- 운영 A 의 실제 모델은 따로 CONFIRMATION_REQUIRED 다(`AB_PREFLIGHT_LOCK_20260925.md`, GF-68).

## P0 블라인드 결과와 결정(2026-09-25)
- A 7 · B-1.0 8 · 둘 다 별로 2 → 어느 쪽도 우위 없음. 두 구조가 같은 모델에서 같은 실패(「활동」 점프·항의 저장·같은 질문)를 냈다.
- **Gate 개시 결정** → 1단계 = 계정 모델 목록 확인(비용 0 · 장부 P-10).

## 1단계 결과 — 계정 모델 확인(2026-09-25 07:29Z · Actions run 36107887216 · 증거 `evidence/MODEL_GATE_20260925/account_models_probe.md`)
- 계정에서 보이는 모델 132개.
- B-1.0 과 같은 파라미터(temperature 0.2 · top_p 0.9 · max_tokens · json_object)로 짧은 요청 1번씩을 보냈다.
  - 200 = gpt-4o-mini(`gpt-4o-mini-2024-07-18`) · gpt-4.1(`2025-04-14`) · gpt-4.1-mini · gpt-4.1-nano · gpt-4o(`2024-08-06`)
  - 400 unsupported_parameter(max_tokens) = gpt-5 · gpt-5-mini · gpt-5-nano · gpt-5.1 · gpt-5.2 → 파라미터를 바꿔야 해서 「모델만 변경」 조건이 깨진다. 이번 비교에서 뺐다.
  - 시험 상한 10개 때문에 o3·o4-mini·gpt-5.4·gpt-5.5 등은 시험하지 않았다(확인 안 함).
- BASELINE 세부판 = `gpt-4o-mini-2024-07-18`(07:29Z 응답 기준). run1(06:37Z) 당시 응답의 세부판은 기록하지 않았다.

## 2단계 — 사전 등록(`FROZEN_INPUTS.json` model_gate)
- 모델 4개: gpt-4o-mini(기준) · gpt-4.1-mini · gpt-4.1 · gpt-4o.
  - gpt-4.1-nano 는 기준보다 작은 모델이라 뺐다.
- B-1.0 `a0031fcc…` · 입력 `3100d5d4…` · 판정 `380d6fb3…` · 파라미터 그대로.
- 목록이나 B 가 사전 등록과 다르면 실행기가 멈춘다(종료 코드 3).
- 실행: `product/spike/ab-20260925/run-models.mjs`(Actions mode `model_gate`).

## Gate 조건 — 언제 여나
- P0 블라인드 검수(`evidence/REAL_AB_RUN1_20260925/P0_BLIND_REVIEW_RUN1.md`)에서도 A·B 둘 다 부족하면 연다.
- 그때 **B-1.0 구조를 그대로 고정하고 모델만 바꾼다.** 구조와 모델을 한 번에 바꾸지 않는다.

## LOCK — 다음 실험 전 고정할 것(한 번에 한 변수만)
| 변수 | 모델 비교에서 |
|---|---|
| MODEL | **바꾸는 유일한 변수** |
| PROMPT | B-1.0 그대로(`agentB.mjs` SHA `a0031fcc…`) |
| CONTEXT | B-1.0 `buildBInput` 그대로 |
| PARAMETERS | temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 한 턴 상한 2 |
| INPUT SET | `golden-failures.json` `3100d5d4…` |
| PASS/FAIL | `golden-specs.json` `380d6fb3…` + 대표 블라인드 |
| CODE HASH | 하네스·B 지문을 실행 직전 다시 계산해 기록 |

- 파라미터 주의(추정 아님, 확인 필요)
  - 일부 모델은 temperature·top_p·max_tokens 를 받지 않거나 이름이 다르다.
  - 후보 모델이 같은 파라미터를 받지 못하면 「MODEL 만 변경」 조건이 깨진다.
  - 그런 후보는 비교 대상에서 빼거나, 대표에게 조건 차이를 먼저 보고한다.

## 후보 모델 — 아직 제안하지 않음
- 임의 모델명을 쓰지 않는다. 공식 문서 또는 계정 기준으로 확인한 이름만 쓴다.
- 이 작업 환경에서는 openai.com 가격·모델 문서 접속이 막혀 있다(장부 B-07).
- 계정 기준 확인 방법(준비만): 이미 승인된 GitHub Actions 경로에서 OpenAI 모델 목록(`GET /v1/models`, 비용 0 · 읽기)을 받는다.
  - 워크플로 수정이 필요하다.
  - Gate 가 열릴 때(P0 블라인드 뒤) 실행한다.
- 공식 단가는 대표가 확인한 값만 쓴다. 저장소 변수 `ECHO_PRICE_IN_PER_M`·`ECHO_PRICE_OUT_PER_M`. 확인 전 비용 숫자는 만들지 않는다.

## 비교 지표(모델 비교부터 반드시 같이)
| 지표 | 어디서 나오나 |
|---|---|
| Quality | 대표 블라인드(P0 세트 먼저) |
| Failure count | Golden 기계 판정 + 객관 FAIL |
| Calls · Retry | 하네스 합계 |
| Input · Output tokens | API usage(정본) |
| Latency | 턴·호출 p50/p95/최대 — 실행기 위치를 함께 적음 |
| API Cost | 공식 단가를 넣었을 때만 |
| User Effort | 대표가 검수에 쓴 항목 수·되돌려 보낸 횟수 — 이번 P0 세트는 17칸(34칸 → 17칸, 누르기만) |
