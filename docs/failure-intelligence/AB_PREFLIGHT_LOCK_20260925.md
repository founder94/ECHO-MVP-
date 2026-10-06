# 실AI A/B 실행 전 조건 확인(PRE-FLIGHT LOCK) — 2026-09-25

근거: 대표 「실AI A/B PRE-FLIGHT LOCK · 즉시 실행」.
- 읽기만 했다. 운영 DB·Secret·모델·배포 변경 0. 코드 수정 0.

## 결론
- **ACTUAL_MODEL = CONFIRMATION_REQUIRED**
- 그래서 **run2 는 실행하지 않았다**(대표 지시 8: 운영 모델이 확정되지 않으면 모델을 마음대로 고르지 않는다).
- run1(2026-09-25, gpt-4o-mini)의 결과는 **「운영 모델 = gpt-4o-mini」일 때만** 운영 A 를 대표한다. 그 전까지 run1 은 조건부 결과다.

## 1. 개발 담당 모델(기록만)
- Claude 구현·검사 환경 = Claude 5.5(대표 확인값).
- ECHO 서비스 안의 LLM 과는 다르다.

## 2. 운영 A 실제 모델
| 확인 순서 | 확인한 것 | 결과 |
|---|---|---|
| 1. 실제 운영 코드 | `doit-understanding` 운영 버전 27, 마지막 수정 2026-09-24 13:45:19Z | 승인 지문 `1aab6423…` 배포 시각과 같다(`list_edge_functions` 읽기) — CLAUDE.md 기록 |
| 2. 모델 선택 코드 | `resolveModel(Deno.env.get("OPENAI_MODEL"))` — v27 108~111·2160 줄 | 값이 비었거나 오타 `gpt-40-mini` 면 `gpt-4o-mini`, **그 밖의 값은 그대로 쓴다** |
| 3. 환경 변수 | Secret 이름 `OPENAI_MODEL` | **값은 읽을 수 없다.** Supabase 도구에 Secret 읽기가 없고, 관리 API 토큰은 401(장부 B-05). Secret 은 버전 변경 없이 바뀔 수 있어 함수 버전으로도 알 수 없다 |
| 4. 운영 로그 | 최근 24시간 전체 로그 1,761줄 | 모델 이름이 적힌 줄 0 — v27 은 모델 이름을 기록하지 않는다. DB 에서 `model` 칸이 있는 표는 `reports` 하나뿐이고 0줄 |
| 5. 배포·장애 기록 | `docs/ops/INCIDENT_2026-09-14_…md` · `PATCH-20260921-…/doit-understanding-v9-model-resolve.patch.md` | 2026-09-14: Secret 값 = `gpt-40-mini`(오타) 확정. 2026-09-20 06:30Z: get-step-question 로그 `model=gpt-4o-mini`(보정 뒤 값). 2026-09-20 18:34Z: 보정 없는 doit-understanding v8 이 `model_not_found` → 그 시각에도 Secret 은 유효하지 않은 이름 |

- 가장 강한 근거는 이것이다: 2026-09-20 18:34Z 까지 Secret 이 오타였고, v27 이 이를 `gpt-4o-mini` 로 보정한다.
- 하지만 그 뒤 대표가 콘솔에서 값을 바꿨는지는 기록도 로그도 없다. 코드 기본값만으로 확정하지 말라는 지시에 따라 확정하지 않는다.

## 3. 운영 A 파라미터(v27 한 턴 경로 `turn` · 코드 기준)
| 항목 | 운영 A(v27) | 하네스 A(run1) | 하네스 B(B-1.0) |
|---|---|---|---|
| model | `resolveModel(OPENAI_MODEL)` → 값 UNKNOWN | gpt-4o-mini(Actions 변수 `ECHO_AB_MODEL` 비어 기본값) | 같음 |
| temperature | 0.2(369줄) | 0.2(A 코드가 보낸 값 그대로) | 0.2 |
| top_p | 0.9(370줄) | 0.9 | 0.9 |
| reasoning | N/A — Chat Completions 에 reasoning 파라미터를 보내지 않음 | N/A | N/A |
| max output tokens | `max_tokens` 768(`V16_MAX_TOKENS`, 1706줄) | 768 | 768 |
| response_format | json_object | json_object | json_object |
| timeout | 호출 1회 = min(20,000ms, 요청 50,000ms 예산 − 저장 몫 4,000ms). 3,000ms 미만 남으면 호출 안 함 | **적용 안 됨** — 하네스의 가짜 fetch 가 중단 신호를 무시 | **없음** |
| 재시도(한 턴 LLM 상한) | 2(`V16_ATTEMPTS`) | 2 | 2(`B_MAX_CALLS`) |
| HTTP 재시도 | 0 — 제공자 오류면 곧바로 실패 | 0 | 0 — 제공자 오류면 반응 없이 멈춤 |
| 호출 수 상한(예산) | 9 | 9(A 코드 그대로) | 2 |

- timeout 은 A·B 가 하네스 안에서 같다(둘 다 없음). 운영과는 다르다.
- run1 의 LLM 최대 5,364ms 가 20,000ms 보다 작다. 그래서 run1 결과에는 영향이 없었다(result.md 합계).

## 4. A/B 같은 조건 LOCK 상태
| 조건 | 상태 |
|---|---|
| MODEL | **미확정 — CONFIRMATION_REQUIRED** |
| 모델 파라미터(temperature·top_p·max_tokens·json_object) | LOCKED(A·B 같음) |
| 사용자 입력 · 실행 순서(FLOW1→7, 흐름마다 A 다음 B) · 관계 목적 | LOCKED(golden-failures.json) |
| Golden Failure Set · PASS/FAIL 기준 | LOCKED(지문 아래) |
| 재시도 상한 | LOCKED(A 2 · B 2) |
| timeout | 하네스에서 A·B 같음(없음) · 운영과 다름 → 운영 대표성 한계로 기록 |
| 바꾸는 변수 | A = v27 orchestration / B = B-1.0 orchestration 하나 |

## 5. 지문 재계산(2026-09-25, 이 확인 시점)
| 대상 | 다시 계산한 값 | 사전 고정값 | 일치 |
|---|---|---|---|
| A `doit-understanding.v27.ts` | `1aab64236bb7c9a41aa40459f0c320abca296e1c928fd76007de2d26b790c450` | 같음 | ○ |
| B `agentB.mjs` | `a0031fcc8ddb546c07506a9facc55eb8aeeac6b383e0bc680a44e726ab9aae35` | 같음 | ○ |
| Golden `golden-failures.json` | `3100d5d461a49795f93a680d492192e825c52ac86f3d1355b60425753faddf9a` | 같음 | ○ |
| PASS/FAIL `golden-specs.json` | `380d6fb38fa0960ea83ae722e03061e2e503016ad0a51cc935a8cdb3c889e319` | 같음 | ○ |

- run1 뒤 바꾼 것은 고정 대상이 아닌 하네스 2곳뿐이다(`FROZEN_INPUTS.json` history).
  - 오류 칸 기록 결함 수정(GF-63)
  - 모델 원문 기록 추가
- A·B 는 그대로다. 다음 실행도 「같은 A/B」라고 부를 수 있다.

## 6. 비용
- 호출·입력·출력 토큰·지연·재시도는 run1 부터 기록한다.
  - total tokens = 입력 + 출력: A 68,163 · B 38,943(API usage 합)
- API Cost = **계산하지 않음**.
  - 모델이 미확정이다.
  - 공식 단가도 이 환경에서 확인할 수 없다(openai.com 접속 차단, 장부 B-07).

## 7. 운영 모델 확정 방법(대표 최소 행동 하나)
- Supabase Secret 화면은 값 대신 **DIGEST**(값의 SHA-256 지문)를 보여 준다.
  - 화면 칸 이름은 검증 필요 — CLI `supabase secrets list` 의 DIGEST 와 같은 것으로 알고 있다.
  - 지문은 값 자체가 아니다.
- 대표가 `OPENAI_MODEL` 줄의 DIGEST 앞 12글자를 알려 주면, 아래 표와 대조해 확정한다.

| 값 후보 | SHA-256 앞 12글자 | v27 이 실제로 부르는 모델 |
|---|---|---|
| `gpt-40-mini`(2026-09-14 확인된 오타) | e630196ac2f7 | gpt-4o-mini |
| `gpt-4o-mini` | 8a4342806269 | gpt-4o-mini |
| `gpt-4o-mini-2024-07-18` | 27bebe765c6e | gpt-4o-mini-2024-07-18 |
| `gpt-4.1-mini` | 13a647d426a0 | gpt-4.1-mini |
| `gpt-4o` | a2a69af70d1b | gpt-4o |
| `gpt-4.1` | 5c51a66b0aff | gpt-4.1 |
| `gpt-4.1-nano` | bf2bf007c584 | gpt-4.1-nano |
| `gpt-5-mini` | f6a6fd968767 | gpt-5-mini |
| `gpt-5` | b0a9d642d12f | gpt-5 |
| `gpt-5-nano` | 6c13251734cd | gpt-5-nano |

- 어느 것과도 맞지 않으면 CONFIRMATION_REQUIRED 를 유지한다(추정 금지).
- 맞으면 그 모델로 run2 를 실행한다.
  - 저장소 변수 `ECHO_AB_MODEL` 이 필요하다. 설정 변경이라 대표 몫인지 먼저 확인한다.
  - 또는 `run-request.json` 에 모델을 적고 하네스가 읽게 한다. 이 경우 하네스 수정 = 고정 대상 아님.
