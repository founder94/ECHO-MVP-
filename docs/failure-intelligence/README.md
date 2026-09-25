# ECHO Failure Intelligence (v1 · 2026-09-25)

대표의 실제 사용과 운영에서 나온 AI 대화 실패를 버리지 않고, 다시 재현하고 검증할 수 있는 회사 자산으로 모은다.
**아직 증명된 독자 기술은 없다(VERIFIED 0).** 여기 있는 것은 실제 실패 기록과 검증 도구다.

```
ECHO Failure Intelligence
├─ Failure Library ............ FAILURE_LIBRARY.md (21건 · 필드 16개)
├─ Failure Taxonomy ........... FAILURE_TAXONOMY.md (원인 Layer 6 · Type 17 · 상태 lifecycle)
├─ Golden Failure Set ......... product/spike/ab-20260925/golden-failures.json (26 입력 · ACTUAL 17)
├─ Replay Evaluation .......... product/spike/ab-20260925/run-ab.mjs (A/B · 실AI/MOCK)
│                               product/spike/ab-20260925/replay-decisions.mjs (실제 문장 → 서버 판정 재생 · AI 호출 0)
│                               결과: REPLAY_결과_20260925.md
├─ Regression Suite ........... product/spike/ab-20260925/regression.test.mjs (사전 고정 · 입력 형식 · 재생 특성 · 집계)
│                               product/spike/ab-20260925/agentB.test.mjs (B-1.0 서버 결정 [MOCK])
├─ Verified Engines ........... VERIFIED_ENGINES.md (VERIFIED 0 · 후보 8)
├─ Failed Solutions Archive ... FAILED_SOLUTIONS_ARCHIVE.md (13건 · 지우지 않음)
└─ Model Capability Registry .. MODEL_CAPABILITY_REGISTRY.md
```

## 규칙
1. 실패는 지우지 않는다. 실패한 해결책도 지우지 않는다.
2. ACTUAL 은 근거 문서가 있는 실제 입력만이다. 추정 사례는 SYNTHETIC 으로 적는다.
3. 실패를 곧바로 제품 규칙(정규식 등)으로 올리지 않는다.
   - 재현 → 원인 Layer 분리 → 해결 실험 → 정상 사례 역검사 → 실제 AI 검증을 통과한 것만 VERIFIED 로 적는다.
4. 결과 표시는 [MOCK] / [REPLAY] / [REAL] 로 나눈다. [MOCK] 통과는 [REAL] 통과가 아니다.
5. 실제 AI A/B 전에 A·B·입력 지문을 `FROZEN_INPUTS.json` 에 고정한다.
   - 결과를 본 뒤 B 를 유리하게 고치지 않는다. 고치면 지문 검사가 실패한다.
6. 블라인드 검수에서 승자는 대표가 고른다. Claude 는 고르지 않는다.
   - `score-blind.mjs` 는 대표가 고른 것만 센다.

## 실제 AI 실행 상태
- **REAL_AI = BLOCKED_BY_ENVIRONMENT** (2026-09-25).
  - 이 작업 환경의 환경 변수에 `OPENAI_API_KEY` 가 없다.
  - 채팅으로 받은 키는 환경 보안 장치가 실행을 막았다. 우회하지 않았다.
- 키가 환경 변수에 들어오면 아래 명령 하나로 이어서 돌린다(`product` 폴더, NODE_PATH 에 typescript·js-tiktoken 필요).
  ```
  node spike/ab-20260925/run-ab.mjs --require-real --out 결과.md --json 결과.json --blind 검수표.md --key 열쇠.json
  ```
- `--require-real` 은 키가 없으면 가짜로 돌지 않는다. `REAL_AI=BLOCKED_BY_ENVIRONMENT` 를 적고 끝낸다(가짜 결과가 실AI 로 오인되지 않게).

## Golden Failure Set (golden-v1.1 · 고정 2026-09-25)
| Flow | 입력 수 | ACTUAL | 근거 | 연결된 실패 |
|---|---|---|---|---|
| FLOW1 | 7 | 7 | 운영 Galaxy 2026-09-25 04:20~04:26 KST | GF-01~04 |
| FLOW2 | 2 | 2 | LEVEL 3 FAIL #1·#2(2026-09-24) | GF-08, 10, 11 |
| FLOW3 | 4 | 3 | LEVEL 3 FAIL #3(첫 답은 원문 미기록 → 대체) | GF-05~07 |
| FLOW4 | 8 | 0 | 지시서 예문(문제제기·정정·되묻기·모르겠어요·지친 말) | GF-09 |
| FLOW5 | 5 | 5 | v13.7~v14.3 운영 입력(목적은 대체) | GF-12~14 |
