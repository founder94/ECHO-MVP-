# ECHO Failure Intelligence OS (v2 · 2026-09-25)

대표가 약 7개월 동안 AI 를 실제로 쓰고 만들며 겪은 실패와 운영에서 나온 실패를 버리지 않는다.
**경험 → 증거 → 재현 → 원인 → 실험 → 검증 → 기술** 순서로 회사 자산으로 바꾼다(대표 헌장 2026-09-25).

- **아직 검증된 방어 기술은 없다.** REAL_AI_VERIFIED 0 · USER_VERIFIED 0.
- 여기 있는 것은 실제 실패 기록과 검증 도구다. "세계 최초·유일·복제 불가"라고 쓰지 않는다.
- 우리가 가져야 할 것은 모델이 아니다.
  - 실패 데이터 · 분류 체계 · Golden 검사 · 검증 방법
  - 실패한 해결책 기록 · 검증된 방어책 · 모델별 능력 데이터 · 실사용 결과

## 구성과 현재 증거 수준

| 구성 | 파일 | 상태 | 증거 수준 |
|---|---|---|---|
| Failure Library | `FAILURE_LIBRARY.md` ← `data/failures.json` | 운영 중 · 53건 | 항목마다 출처(ACTUAL·REAL_AI_SCRIPTED·CODE·SYNTHETIC·FOUNDER_STATEMENT)·원인 확신·방어 수준·사용자 피해 표시 |
| Failure Taxonomy | `FAILURE_TAXONOMY.md` · `data/families.json` | 운영 중 | Layer 6 · Type 25(`data/types.json`) · Family 15 |
| Golden Failure Set | `product/spike/ab-20260925/golden-failures.json` | 고정(`FROZEN_INPUTS.json`, 변경 이력 포함) · 34 입력 · ACTUAL 24 | 입력마다 ACTUAL/SYNTHETIC + 근거 문서 |
| Failure Compiler | `product/spike/failure-intelligence/failure-compiler.mjs` | 프로토타입 | CANDIDATE — 뼈대 모드는 지금 사용 가능 · 모델 모드는 가짜 AI 로만 검사(실AI BLOCKED) · 결과는 항상 HUMAN_APPROVAL_REQUIRED |
| Replay Lab | `run-ab.mjs`(A/B 실AI·MOCK) · `replay-decisions.mjs`(실제 문장 → 서버 판정, AI 호출 0) | 운영 중 | [REPLAY] 결정적 결과 · [REAL] BLOCKED_BY_ENVIRONMENT |
| Solution Arena | A(v27) vs B(B-1.0), 같은 입력·같은 조건 | 준비 완료, 실AI 대기 | 승자 없음 · 블라인드 검수표·집계(`score-blind.mjs`)는 대표가 고른 것만 센다 |
| Counter-Test Engine | 역검사(방어책을 일부러 망가뜨려 검사가 잡는지) + 정상 사례 역검사(Replay R4) | 운영 중 | [MOCK]·[REPLAY] |
| Failed Solutions Archive | `FAILED_SOLUTIONS_ARCHIVE.md` ← `data/failed-solutions.json` | 운영 중 · 21건 | 지우지 않음 |
| Verified Defense Registry | `VERIFIED_DEFENSE_REGISTRY.md` | 운영 중 | REAL_AI_VERIFIED 0 |
| Model Capability Registry | `MODEL_CAPABILITY_REGISTRY.md` | 운영 중 | 모델 탓으로 분리된 실패 0 |
| Failure Graph | `FAILURE_GRAPH.md` ← `data/failure-graph.json` | 운영 중 · 관계 23 | 관계마다 ACTUAL 10 · CODE 7 · HYPOTHESIS 6 |
| Outcome Feedback | — | **미구현** | 실사용자 결과가 아직 없다. 실사용자 대상 새 실험은 대표 승인 사항 |

## 규칙
1. 실패와 실패한 해결책은 지우지 않는다.
2. ACTUAL 은 근거 문서가 있는 실제 입력·행동만이다.
   - 기억만 있으면 FOUNDER_STATEMENT 또는 HYPOTHESIS 로 적는다.
3. 실패를 곧바로 규칙(정규식 등)으로 올리지 않는다.
   - 재현 → 원인 Layer 분리 → 해결 후보 → A/B → 역검사 → 실AI/실사용 검증을 통과한 것만 올린다.
4. 결과 표시는 [MOCK] / [REPLAY] / [REAL] 로 나눈다. [MOCK] 통과는 [REAL] 통과가 아니다.
5. 실제 AI A/B 전에 A·B·입력을 사전 고정한다. 결과를 본 뒤 B 를 유리하게 고치면 지문 검사가 실패한다.
6. 블라인드 검수의 승자는 대표가 고른다. Claude 는 고르지 않는다.
7. 사용자 피해(감정·정신·시간·물질)는 근거가 있는 것만 적는다. 없으면 UNKNOWN 이고, 숫자를 만들지 않는다.
8. `.md` 3개(Library·Failed Solutions·Graph)는 `data/*.json` 에서 생성한다.
   - 손으로 고치면 `fi-build.mjs --check` 와 검사가 잡는다.

## 명령 (`/home/user/ECHO-MVP-` 기준)
```
node product/spike/failure-intelligence/fi-build.mjs            # data → .md 생성(검증 포함)
node product/spike/failure-intelligence/fi-build.mjs --check    # 생성본 일치·검증만
node --test product/spike/failure-intelligence/fi.test.mjs
# 아래 둘은 product 폴더에서, NODE_PATH 에 typescript·js-tiktoken 필요
node --test spike/ab-20260925/regression.test.mjs spike/ab-20260925/agentB.test.mjs
node spike/ab-20260925/run-ab.mjs --require-real --out 결과.md --json 결과.json --blind 검수표.md --key 열쇠.json
```

## 실제 AI 상태
- **REAL_AI = BLOCKED_BY_ENVIRONMENT.**
  - 이 작업 환경 변수에 OpenAI 키가 없다.
  - 채팅으로 받은 키는 환경 보안 장치가 실행을 막았다. 우회하지 않는다.
- 실행 가능한 환경이 생기면 고정된 하네스를 그대로 돌린다.

## 트랙
- TRACK 1 Relationship Agent 제품: Conversation P0 = FAIL 유지. 운영 = doit-understanding v27.
- TRACK 2 Failure Intelligence R&D: 이 폴더. 제품 출시를 막지 않고, 제품 일정 때문에 자산을 버리지 않는다.
