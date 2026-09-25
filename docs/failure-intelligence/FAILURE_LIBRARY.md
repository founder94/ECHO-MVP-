# ECHO Failure Library (v4 · 2026-09-25)

> 이 파일은 `docs/failure-intelligence/data/failures.json` 에서 생성한다(`node product/spike/failure-intelligence/fi-build.mjs`). 손으로 고치지 않는다.

- 실제 증거가 있는 실패만 ACTUAL 로 적는다. 추정은 HYPOTHESIS, 예문은 SYNTHETIC.
- 이전 판(v1 9건 · v2 21건)은 지우지 않았다: `docs/claude-final-review-20260916/PATCH-20260925-ab-spike/GOLDEN_FAILURE_LIBRARY_v1_20260925.md`, git 기록.
- 사용자 피해(감정·정신·시간·물질)는 근거가 있는 것만 적고, 없으면 UNKNOWN.
- 합계 68건 — 증거 수준: ACTUAL 64 · CANDIDATE 3 · HYPOTHESIS 1 · 출처: ACTUAL 35 · ACTUAL_RECONSTRUCTED 1 · CODE 14 · SYNTHETIC 1 · CODE+SYNTHETIC 2 · REAL_AI_SCRIPTED 12 · FOUNDER_STATEMENT 3
- 상태: UNRESOLVED 33 · MITIGATED 30 · RESOLVED 5
- 방어 수준: MOCK_VERIFIED 16 · CANDIDATE 34 · NONE 18
- **REAL_AI_VERIFIED · USER_VERIFIED · VERIFIED = 0건.** 실제 AI 실행은 BLOCKED_BY_ENVIRONMENT.

## 한눈에

| ID | 날짜 | 증거 | 출처 | Family | Type | 원인 Layer | 원인 확신 | 방어 수준 | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| GF-01 | 2026-09-25 04:22~04:23 | ACTUAL | ACTUAL | F-REPEAT | 질문의도 반복 · 반복설명 강요 | Orchestration · Context | MIXED | MOCK_VERIFIED | UNRESOLVED |
| GF-02 | 2026-09-25 04:22:13 KS | ACTUAL | ACTUAL | F-GUARD | 과잉 Guard | Orchestration | CONFIRMED | MOCK_VERIFIED | UNRESOLVED |
| GF-03 | 2026-09-25 04:25:48 KS | ACTUAL | ACTUAL | F-GUARD | Repair 실패 · 과잉 Guard | Orchestration | CONFIRMED | MOCK_VERIFIED | UNRESOLVED |
| GF-04 | 2026-09-24(FAIL #3) ·  | ACTUAL | ACTUAL | F-CONTEXT | Context 유실 | Context | CONFIRMED | MOCK_VERIFIED | UNRESOLVED |
| GF-05 | 2026-09-24 22:59 KST | ACTUAL | ACTUAL | F-CLASSIFY | 오분류 | Orchestration | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-06 | 2026-09-24 23:00:05 KS | ACTUAL | ACTUAL_RECONSTRUCTED | F-CLASSIFY | Repair 실패 · 오분류 | Orchestration | MIXED | MOCK_VERIFIED | UNRESOLVED |
| GF-07 | 2026-09-24 23:00:30 KS | ACTUAL | ACTUAL | F-REPEAT | 과잉 Guard | Orchestration | HYPOTHESIS | MOCK_VERIFIED | UNRESOLVED |
| GF-08 | 2026-09-24 11:43Z(20:4 | ACTUAL | ACTUAL | F-DRIFT | 방향이탈 | Context · Orchestration · Model | MIXED | CANDIDATE | UNRESOLVED |
| GF-09 | 2026-09-24(코드 대조에서 발견) | ACTUAL | CODE | F-CONTRACT | 제품 계약 불일치 | Product Contract | CONFIRMED | MOCK_VERIFIED | UNRESOLVED |
| GF-10 | 2026-09-24 09:57~09:58 | ACTUAL | ACTUAL | F-GUARD | 과잉 Guard | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-11 | 2026-09-24 11:44Z | ACTUAL | ACTUAL | F-CLASSIFY | 오분류 · 지연 | Orchestration · Infrastructure | CONFIRMED | CANDIDATE | MITIGATED |
| GF-12 | 2026-09-22 16:30 KST 무 | ACTUAL | ACTUAL | F-SENTENCE | 문장 파손 | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-13 | 2026-09-22 16:25~17:00 | ACTUAL | ACTUAL | F-DRIFT | 무거운 질문 · 배포 불일치 | Model · Infrastructure | MIXED | MOCK_VERIFIED | MITIGATED |
| GF-14 | 2026-09-24 | ACTUAL | ACTUAL | F-CLASSIFY | 오분류 · 문장 파손 | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-15 | 2026-09-24 18:57 KST | ACTUAL | ACTUAL | F-EVAL | Mock PASS / 실AI FAIL | Evaluation | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-16 | 2026-09-24(v15 MASTER↔ | ACTUAL | CODE | F-EVAL | 검사 결함 | Evaluation | CONFIRMED | NONE | UNRESOLVED |
| GF-17 | 2026-09-24(v15.1 작업 중  | ACTUAL | CODE | F-EVAL | 검사 결함 | Evaluation | CONFIRMED | NONE | RESOLVED |
| GF-18 | 2026-09-24(LEVEL 2 연습  | ACTUAL | SYNTHETIC | F-CLASSIFY | 오분류 | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-19 | 2026-09-24 22:58 KST(F | ACTUAL | ACTUAL | F-CONTEXT | Context 오염 | Context | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-20 | 2026-09-24 05:41 KST 무 | ACTUAL | ACTUAL | F-DEPLOY | 배포 불일치 | Infrastructure | CONFIRMED | NONE | RESOLVED |
| GF-21 | 2026-09-24(v15 MASTER↔ | ACTUAL | CODE+SYNTHETIC | F-CONTEXT | 거절 의미 재등장 | Orchestration · Context | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-22 | 2026-09-16 20:03 UTC(S | ACTUAL | ACTUAL | F-ANSWER | 사용자 질문 무시 · 말 따라 하기 · 오분류 · 과잉 Guard | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-23 | 2026-09-17 13:01·13:03 | ACTUAL | ACTUAL | F-SENTENCE | 문장 파손 · 말투 | Model · Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-24 | 2026-09-17 KST | ACTUAL | ACTUAL | F-GUARD | 과잉 Guard · 질문의도 반복 | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-25 | 2026-09-18 · 재발 2026-0 | ACTUAL | REAL_AI_SCRIPTED | F-CONTEXT | 정정무시 · 문장 파손 | Orchestration · Context | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-26 | 2026-09-18 | ACTUAL | REAL_AI_SCRIPTED | F-ANSWER | 사용자 질문 무시 · 과잉 Guard | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-27 | 2026-09-18 | ACTUAL | REAL_AI_SCRIPTED | F-GUARD | 과잉 Guard · Repair 실패 | Orchestration | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-28 | 2026-09-19 · 2026-09-2 | ACTUAL | REAL_AI_SCRIPTED | F-REPEAT | 질문의도 반복 · 방향이탈 | Orchestration · Model | HYPOTHESIS | NONE | UNRESOLVED |
| GF-29 | 2026-09-18 · 2026-09-1 | ACTUAL | REAL_AI_SCRIPTED | F-LATENCY | 지연 | Infrastructure · Orchestration | MIXED | CANDIDATE | MITIGATED |
| GF-30 | 2026-09-16 ~ 2026-09-1 | ACTUAL | CODE | F-STATUS | 미확정 사실화 | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-31 | 2026-09-17 | ACTUAL | ACTUAL | F-PROMISE | 없는 기능 약속 | Orchestration · Evaluation | CONFIRMED | CANDIDATE | MITIGATED |
| GF-32 | 2026-09-17 | ACTUAL | ACTUAL | F-STATE | 가짜 진행 · 오분류 | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-33 | 2026-09-24 09:17~09:21 | ACTUAL | ACTUAL | F-DRIFT | 고정 대체 질문 · 오분류 · 미확정 사실화 | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-34 | 2026-09-24(운영 v23) | ACTUAL | CODE | F-DRIFT | 고정 대체 질문 · 방향이탈 · 오분류 | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-35 | 2026-09-24(발견) | ACTUAL | CODE | F-DRIFT | 고정 대체 질문 | Orchestration | CONFIRMED | NONE | UNRESOLVED |
| GF-36 | 2026-09-22 09:50 KST | ACTUAL | ACTUAL | F-GUARD | 과잉 Guard · 고정 대체 질문 | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-37 | 2026-09-21 ~ 22 | ACTUAL | ACTUAL | F-DRIFT | 무거운 질문 · 고정 대체 질문 | Orchestration · Model | MIXED | CANDIDATE | MITIGATED |
| GF-38 | 2026-09-22 오전 | ACTUAL | ACTUAL | F-GUARD | 과잉 Guard · 검사 결함 | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-39 | 2026-09-22 밤 | ACTUAL | ACTUAL | F-FLOW | 출구 없음 · 과잉 Guard | Orchestration · Product Contract | CONFIRMED | CANDIDATE | MITIGATED |
| GF-40 | 2026-09-22 | ACTUAL | CODE | F-FLOW | 말투 · 출구 없음 | Orchestration · Product Contract | MIXED | CANDIDATE | MITIGATED |
| GF-41 | 2026-09-22 17:40 KST 무 | ACTUAL | ACTUAL | F-FLOW | 출구 없음 | Product Contract | CONFIRMED | CANDIDATE | MITIGATED |
| GF-42 | 2026-09-14 | ACTUAL | ACTUAL | F-DEPLOY | 배포 불일치 · 지연 | Infrastructure | CONFIRMED | CANDIDATE | RESOLVED |
| GF-43 | 2026-09-20 03:05 UTC | ACTUAL | ACTUAL | F-DEPLOY | 배포 불일치 | Infrastructure | MIXED | NONE | UNRESOLVED |
| GF-44 | 2026-09-16 · 09-17 · 0 | ACTUAL | ACTUAL | F-GUARD | 과잉 Guard | Orchestration | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-45 | 2026-09-17 | ACTUAL | REAL_AI_SCRIPTED | F-STATE | 가짜 진행 · 과잉 Guard | Orchestration | CONFIRMED | CANDIDATE | MITIGATED |
| GF-46 | 2026-09-18 · 2026-09-2 | ACTUAL | REAL_AI_SCRIPTED | F-GUARD | Repair 실패 · 과잉 Guard | Orchestration | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-47 | 2026-09-17 | ACTUAL | CODE+SYNTHETIC | F-GUARD | 거절 의미 재등장 · 과잉 Guard | Orchestration | CONFIRMED | MOCK_VERIFIED | MITIGATED |
| GF-48 | 2026-09-24 | ACTUAL | ACTUAL | F-DEPLOY | 배포 불일치 | Infrastructure | CONFIRMED | NONE | UNRESOLVED |
| GF-49 | 2026-09-24(발견) | ACTUAL | CODE | F-PROMISE | 없는 기능 약속 | Product Contract | CONFIRMED | NONE | UNRESOLVED |
| GF-50 | 2026-09-16 | ACTUAL | CODE | F-PROMISE | 가짜 진행 | Orchestration | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-51 | 2026-09-22 | CANDIDATE | FOUNDER_STATEMENT | F-PROMISE | 없는 기능 약속 | Product Contract | CONFIRMED | CANDIDATE | MITIGATED |
| GF-52 | 2026-09-20 | ACTUAL | REAL_AI_SCRIPTED | F-STATE | 가짜 진행 | Infrastructure · Orchestration | HYPOTHESIS | NONE | UNRESOLVED |
| GF-53 | 2026-09-25(발견 · 재생) —  | ACTUAL | CODE | F-ANSWER | 오분류 · 사용자 질문 무시 | Orchestration | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-54 | 2026-09-25 | ACTUAL | ACTUAL | F-ADVISOR | 완료 행동 재요구 | Evaluation | CONFIRMED | CANDIDATE | MITIGATED |
| GF-55 | 2026-09-25 | ACTUAL | ACTUAL | F-ADVISOR | 막힌 경로 반복 안내 | Evaluation | CONFIRMED | CANDIDATE | MITIGATED |
| GF-56 | 2026-09-25 | ACTUAL | ACTUAL | F-ADVISOR | 보안 안내 불일치 | Evaluation | CONFIRMED | CANDIDATE | UNRESOLVED |
| GF-57 | 2026-09-25(대표 확인) | CANDIDATE | FOUNDER_STATEMENT | F-ADVISOR | 비용 가시성 부족 | Evaluation · Infrastructure | MIXED | CANDIDATE | MITIGATED |
| GF-58 | 2026-09-22 ~ 2026-09-2 | ACTUAL | ACTUAL | F-ADVISOR | 대표 중계 과부하 | Evaluation | CONFIRMED | CANDIDATE | MITIGATED |
| GF-59 | 2026-09-25 | ACTUAL | ACTUAL | F-ADVISOR | 잘못된 보고 | Evaluation | CONFIRMED | NONE | RESOLVED |
| GF-60 | 2026-09-22 ~ 2026-09-2 | CANDIDATE | FOUNDER_STATEMENT | F-ADVISOR | 상위 대안 검토 지연 | Evaluation | HYPOTHESIS | CANDIDATE | UNRESOLVED |
| GF-61 | 2026-09-25(재생) | ACTUAL | CODE | F-REPEAT | 질문의도 반복 | Orchestration · Model | CONFIRMED | NONE | UNRESOLVED |
| GF-62 | 2026-09-25(재생) | HYPOTHESIS | CODE | F-REPEAT | 질문의도 반복 | Orchestration · Model | HYPOTHESIS | NONE | UNRESOLVED |
| GF-63 | 2026-09-25(실AI run1 결과 | ACTUAL | CODE | F-EVAL | 검사 결함 | Evaluation | CONFIRMED | NONE | RESOLVED |
| GF-64 | 2026-09-25 06:37~06:39 | ACTUAL | REAL_AI_SCRIPTED | F-REPEAT | 질문의도 반복 | Orchestration | CONFIRMED | NONE | UNRESOLVED |
| GF-65 | 2026-09-25 06:37~06:39 | ACTUAL | REAL_AI_SCRIPTED | F-CLASSIFY | 오분류 · Context 유실 · Repair 실패 | Model · Context | HYPOTHESIS | NONE | UNRESOLVED |
| GF-66 | 2026-09-25 06:37~06:39 | ACTUAL | REAL_AI_SCRIPTED | F-CLASSIFY | 정정무시 · Repair 실패 · 오분류 · 고정 대체 질문 | Orchestration · Model | MIXED | NONE | UNRESOLVED |
| GF-67 | 2026-09-25 06:37~06:39 | ACTUAL | REAL_AI_SCRIPTED | F-CLASSIFY | 오분류 · Repair 실패 · 가짜 진행 | Model · Product Contract | HYPOTHESIS | NONE | UNRESOLVED |
| GF-68 | 2026-09-25(run1 실행 06: | ACTUAL | CODE | F-EVAL | 실험 변수 미고정 · 검사 결함 | Evaluation | CONFIRMED | NONE | UNRESOLVED |

## GF-01 같은 뜻 질문 반복

| 칸 | 내용 |
|---|---|
| Family | F-REPEAT — 같은 뜻 반복 · 반복설명 강요 |
| 발생 날짜 | 2026-09-25 04:22~04:23 KST, 대표 Galaxy, 운영 v27 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (운영 `doit_request_events`·query_logs) |
| 사용자 상황 | 목적 「아직 정하지 않았어요」. 사용자가 여러 번 「이미 말했다」고 항의 |
| 사용자 원문 | 「나 진심이라고 적은거 같은데」, 「적었자네」, 「몇번째 같은말이야!!」 |
| AI 행동 | 표현만 바꾼 같은 뜻 질문 4개를 연달아 냄: 「사람을 알아가는 데 어떤 점이 가장 중요하다고 생각해요?」 → 「…즐거운 것 같아요?」 → 「진심으로 사람을 알아가는 데 어떤 점이 특별하다고 느끼나요?」 → 「사람을 진심으로 알아가는 과정에서 어떤 점이 가장 마음에 드나요?」 |
| 기대 행동 | 이미 들은 말(진심·행동)을 짚고, 같은 뜻은 다시 묻지 않거나 질문하지 않기 |
| Failure Type | 질문의도 반복 · 반복설명 강요 |
| 원인 Layer | Orchestration · Context (원인 확신: MIXED) — Orchestration(반복 검사가 글자쌍 비교뿐, 질문 뜻 기록 없음) + Context(GF-04). Model 몫은 분리 안 됨 |
| 사용자 피해 · 감정 | 대표 「몇번째 같은말이야!!」·「적었자네」(운영 원문) |
| 사용자 피해 · 정신 | 이미 한 말을 다시 설명하도록 요구받음 — 측정값 UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | **코드 재현 ○** — `replay-decisions.mjs` R2: A v27 반복 검사가 4개 모두 통과(최대 sim 0.39 / overlap 0.59, 기준 0.6 / 0.7) |
| 해결 시도(실패한 해결책 포함) | FS-04 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 질문 의도(question_intent) 장부 + 서버가 답한·거절한 의도 차단(B-1.0) |
| 실험 결과 | [MOCK] B 검사 통과. Replay: 모델이 같은 뜻에 **같은 이름**을 붙이면 3/3 차단, **다른 이름**을 붙이면 0/3 차단(미탐) |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 의도 이름이 너무 넓으면 정상 질문도 막을 수 있다 — 실AI 필요 |
| 역검사 결과 | B 의도 차단 제거 시 검사 실패 확인(PHASE 1 망가뜨리기 7/7) |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] FLOW1: A·B 모두 항의 2개를 답으로 저장해 #5 에서 대화 끝 → #6 은 AI 에 가지 않음(둘 다 FAIL). 같은 뜻 반복 자체는 이 흐름에서 판정 불가(대화 조기 종료). B 는 #2 에서 글자까지 같은 질문(GF-64) (이전 기록: A = 운영에서 실패(실제 AI). B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | GF-04→CONTRIBUTES_TO(HYPOTHESIS) · TRIGGERS→GF-03(HYPOTHESIS) · GF-64→CONTRIBUTES_TO(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260925-ab-spike/CTO_AB_SPIKE_보고_20260925.md` · `docs/failure-intelligence/REPLAY_결과_20260925.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-02 정상 답 뒤 질문 생성 실패(단서 글자 검사)

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-25 04:22:13 KST · 앞서 2026-09-24 22:57:32 KST(옛 회차 기록 재개 시) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (query_logs: `failed:clue` ×2, LLM 3,209·2,854ms) |
| 사용자 상황 | 답을 저장한 뒤 다음 질문 요청 |
| AI 행동 | 후보 2개를 모두 서버가 떨어뜨림 → 「다음 질문을 만들지 못했어요」 |
| 기대 행동 | 이어지는 질문 하나, 또는 질문 없이 반응 |
| Failure Type | 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration — 「단서가 원문 안에 글자 그대로 있는가」(`includesLoose`) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | 이 턴 LLM 3,209+2,854ms 뒤 실패(운영 로그) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 2회(09-24 22:57 LLM 3,340·2,074ms → 502 · 09-25 04:22). 후보 원문은 기록 원칙상 없어 코드 재현 불가 |
| 해결 시도(실패한 해결책 포함) | FS-05 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 글자 인용 검사 삭제, 질문은 선택사항(B-1.0) |
| 실험 결과 | [MOCK] B 는 이 검사가 없다 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 단서 없는 엉뚱한 질문을 막는 장치가 사라짐 → 블라인드 검수로만 판정 |
| 역검사 결과 | 해당 없음(검사 삭제형) |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 「마음이지머」 단서 검사 2회 탈락 → 질문 실패(보정, GF-63) = 재현. 「가볍게…」·「행동으로 보여줄때」는 A·B 모두 저장·질문 (이전 기록: A 실패(운영). B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | REGRESSION_OF→GF-36(CODE) · GF-63→MASKS(CODE) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260925-ab-spike/CTO_AB_SPIKE_보고_20260925.md` · `docs/claude-final-review-20260916/PATCH-20260924-level3-fail3/LEVEL3_FAIL3_ROOT_CAUSE_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-03 문제제기 뒤 질문 생성 실패(자기 표시 즉시 탈락)

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-25 04:25:48 KST, 운영 v27 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (`failed:self_flag` ×2, 1,700·2,033ms) |
| 사용자 상황 | 불만 턴(「몇번째 같은말이야!!」 무렵 — 원문과 로그 1:1 짝은 확정 안 함) |
| AI 행동 | 화낸 직후 「다음 질문을 만들지 못했어요」 |
| 기대 행동 | 문제를 인정하고 이미 들은 말을 짚는 반응. 질문은 없어도 됨 |
| Failure Type | Repair 실패 · 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration — 모델이 스스로 켠 표시(repeats_asked 등)를 곧바로 탈락으로. 다시 만들어도 같은 입력 |
| 사용자 피해 · 감정 | 항의 직후 「다음 질문을 만들지 못했어요」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | LLM 1,700+2,033ms 뒤 실패(운영 로그) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 1회 |
| 해결 시도(실패한 해결책 포함) | FS-06 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 질문 선택사항 + repair 시 직전 의도 즉시 거절 + 막히면 반응만(B-1.0) |
| 실험 결과 | [MOCK] 통과 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 반응만 나가면 대화가 멈춘 느낌일 수 있음 — 블라인드 검수 필요 |
| 역검사 결과 | 「repair 즉시 거절」 제거 시 검사 실패 확인 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] FLOW1#6 은 두 방식 모두 대화 끝 상태라 AI 에 가지 않음 — 판정 불가(둘 다 반응 없음 FAIL) (이전 기록: A 실패(운영). B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | GF-01→TRIGGERS(HYPOTHESIS) · GF-67→CAUSES(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260925-ab-spike/CTO_AB_SPIKE_보고_20260925.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-04 저장 안 한 문제제기를 다음 턴 AI 가 모름

| 칸 | 내용 |
|---|---|
| Family | F-CONTEXT — 맥락 유실·오염·거절 재등장 |
| 발생 날짜 | 2026-09-24(FAIL #3) · 2026-09-25(Galaxy) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (FAIL #3 보고 §hot_memory: 저장 안 한 「취미생활?」·「너가 어떤 취미가…」 = 다음 턴 0) |
| AI 행동 | 사용자가 「같은 말」이라고 해도 다음 턴 모델 입력에 그 말이 없음 |
| 기대 행동 | 최근 대화(저장 여부 무관)를 알고 반응 |
| Failure Type | Context 유실 |
| 원인 Layer | Context (원인 확신: CONFIRMED) — Context — v27 `hot_memory` = 저장된 답만 · 입력에 `remaining`·`answered_count` 있음 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 항의를 반복하게 됨(GF-01 과 같은 대화) |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 ○(하네스 Context 구성: A 입력에 저장 안 한 말 칸 없음) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 최근 4턴(저장 안 한 말·종류 포함) 전달, 남은 수 제거(B-1.0) · Agent v1.1 `recent`(운영 미배포) |
| 실험 결과 | [MOCK] B `recent` 약 76토큰/호출 전달 확인 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 입력 토큰 증가(B 전체로는 A 보다 적음) |
| 역검사 결과 | 없음(입력 구성 확인만) |
| 실AI 결과 | B = BLOCKED_BY_ENVIRONMENT |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW1, FLOW3 |
| 관련 실패(Graph) | CONTRIBUTES_TO→GF-01(HYPOTHESIS) · CONTRIBUTES_TO→GF-06(HYPOTHESIS) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail3/LEVEL3_FAIL3_ROOT_CAUSE_20260924.md` |

## GF-05 「취미생활?」이 되묻기로 강제됨

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-24 22:59 KST, 대표 Galaxy(LEVEL 3 FAIL #3) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL |
| 사용자 원문 | 「취미생활?」 |
| AI 행동 | 규칙이 meta 로 강제 → 저장 안 함 → 「취미생활에 대해 어떤 것들이 궁금한가요?」(뒤집힌 질문) |
| 기대 행동 | 답(취미 이야기)으로 받거나, 의미를 확인 |
| Failure Type | 오분류 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration — 정규식 `/^[^\s?]{1,6}\?+$/` 가 AI 보다 먼저 결정 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 뒤집힌 질문(사용자에게 무엇이 궁금하냐고 물음) |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | **코드 재현 ○** — Replay R1: A v27 `ruleKind('취미생활?') = meta` |
| 해결 시도(실패한 해결책 포함) | FS-03 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 짧은 물음표 규칙을 강제에서 빼고 모델이 뜻으로(B-1.0 · Agent v1.1) |
| 실험 결과 | [MOCK] B 는 규칙 없음 |
| Mock 결과 | UNKNOWN |
| 부작용 | 「활동?」 같은 진짜 되묻기를 모델이 답으로 읽을 위험(GF-11 과 반대 방향) — 실AI 필요 |
| 역검사 결과 | 없음 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 「취미생활?」 규칙 meta 강제 재현(비저장, 질문 다시 씀). B: 답으로 저장 + 취미 질문 (이전 기록: A 실패(운영). B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW3 |
| 관련 실패(Graph) | BROKEN_BY→FS-03(HYPOTHESIS) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail3/LEVEL3_FAIL3_ROOT_CAUSE_20260924.md` · `docs/failure-intelligence/REPLAY_결과_20260925.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-06 질문 방향 제안이 되묻기(ask)로 분류됨

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-24 23:00:05 KST, 대표 Galaxy |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL_RECONSTRUCTED — ACTUAL(캡처 재구성 — 원문 일부 생략 가능) |
| 사용자 원문 | 「아니 같은 취미생활 너가 어떤 취미가 있냐고 나한테 물어봐야 하는 거 아니야?」 |
| AI 행동 | ask 로 분류 → 고정 사실문 「저는 DO IT의 AI예요…」 + 잘못된 질문 유지 |
| 기대 행동 | 문제 인정 → 사용자가 제안한 방향(내 취미를 물어봐 줘)으로 |
| Failure Type | Repair 실패 · 오분류 |
| 원인 Layer | Orchestration (원인 확신: MIXED) — Orchestration(complaint 정의에 "질문 방향 제안" 없음, 거절한 질문 방향 차단 없음) + 고정 문장 |
| 사용자 피해 · 감정 | 질문 방향을 직접 고쳐 달라고 해야 했음 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 규칙 층: Replay R3 — A 규칙 없음(AI 로 넘어감), ask 대체 문장 = 「저는 DO IT의 AI예요. 답을 듣고 다음 질문을 골라요.」 재현. 분류 자체는 실AI 필요 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | repair 정의에 「그 질문 말고 / 이렇게 물어봐야지」 포함 + 거절한 질문 의도 차단(B-1.0) |
| 실험 결과 | [MOCK] 통과 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 질문을 해 달라는 말을 repair 로 읽으면 질문 없이 반응만 할 수 있음 |
| 역검사 결과 | repair 즉시 거절 제거 시 실패 확인 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 질문 방향 제안을 ask 로 분류 → 고정 안내문 + 같은 질문 유지(FAIL, 재현). B: 사과 + 「어떤 취미를 좋아하세요?」(기계 PASS, 뜻은 블라인드) (이전 기록: A 실패(운영). B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW3 |
| 관련 실패(Graph) | GF-04→CONTRIBUTES_TO(HYPOTHESIS) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail3/LEVEL3_FAIL3_ROOT_CAUSE_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-07 짧은 정상 답 뒤 질문 생성 실패(반복 판정)

| 칸 | 내용 |
|---|---|
| Family | F-REPEAT — 같은 뜻 반복 · 반복설명 강요 |
| 발생 날짜 | 2026-09-24 23:00:30 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (`failed:repeat` ×2, 2,166·1,898ms) |
| 사용자 원문 | 「싸이클 테니스 골프」 |
| AI 행동 | 저장 후 질문 생성 실패 |
| 기대 행동 | 셋 중 하나를 골라 이어 묻기, 또는 반응 |
| Failure Type | 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: HYPOTHESIS) — Orchestration(가설: 첫 질문 틀 되풀이 → 글자쌍 검사). 후보 원문 미기록이라 확정 불가 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | LLM 2,166+1,898ms, 서버 4,480ms 뒤 실패(운영 로그) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 1회 |
| 해결 시도(실패한 해결책 포함) | FS-04 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 글자쌍 대신 의도 비교, 막히면 반응만 |
| 실험 결과 | [MOCK] B 통과 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | GF-01 과 한 검사가 양쪽(미탐·오탐)으로 실패한 사례 → 글자 검사 자체의 한계 |
| 역검사 결과 | 없음 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 「싸이클 테니스 골프」 저장 + 이어 묻기(기계 PASS). B: 문제제기로 오분류해 저장 0 + 질문 버림(FAIL, GF-65) (이전 기록: B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW3 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail3/LEVEL3_FAIL3_ROOT_CAUSE_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-08 짧은 답 뒤 「활동」으로 점프 · 주제 이름 불일치

| 칸 | 내용 |
|---|---|
| Family | F-DRIFT — 방향이탈 · 무거운 질문 |
| 발생 날짜 | 2026-09-24 11:43Z(20:43 KST), 운영 v26(v15.2) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (FAIL #2 보고 §0) |
| 사용자 원문 | 「그냥 편한친구 부담없이」 |
| AI 행동 | 16.2초 뒤 「편한 친구를 원하시군요. 어떤 활동을 함께 하고 싶어요?」. 화면 주제 이름은 「상대가 알면 좋을 나」로 질문과 어긋남 |
| 기대 행동 | 「부담없이」를 이어 묻기(예: 부담 없는 게 어떤 건지) |
| Failure Type | 방향이탈 |
| 원인 Layer | Context · Orchestration · Model (원인 확신: MIXED) — Orchestration(12자 이하 → 새 갈래 + 주제 칸 순서, 프롬프트 예시가 「같이 뭐 하고 싶어요」를 가르침, v15.2 의 첫 줄 근거 완화가 점프를 통과시킴 = FS-08) + Context(remaining) · [REAL run1] 주제·남은 수가 없는 B 에서도 같은 점프 → Model(또는 목적 문구) 몫 HYPOTHESIS |
| 사용자 피해 · 감정 | 대표 되물음 「활동?갑자기?」(운영 원문) |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | 다음 질문까지 16,241ms(운영 edge 로그) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | v26 에서 운영 관측. v27(경로 교체) 재발은 실AI 필요 |
| 해결 시도(실패한 해결책 포함) | FS-08, FS-09 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 질문 출발 = 방금 정상 답, 주제·남은 수 미전달(B-1.0) |
| 실험 결과 | [MOCK] B 입력에 주제·순서 0 확인 |
| Mock 결과 | UNKNOWN |
| 부작용 | 주제가 비면 연결에 필요한 정보가 덜 모일 수 있음(Product Contract) |
| 역검사 결과 | B 입력 금지 항목 검사 있음 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A·B 모두 「그냥 편한친구 부담없이」·「진실된마음」 뒤 「활동」 질문. B 입력엔 주제 칸·남은 수가 없고 프롬프트에 「활동」 낱말 0 → Model(또는 목적 문구) 몫 첫 증거(HYPOTHESIS, 모델 비교 전) (이전 기록: B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW2 |
| 관련 실패(Graph) | BROKEN_BY→FS-08(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail2/LEVEL3_FAIL2_구조원인분석_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-09 「모르겠어요」도 다섯 칸에 들어감

| 칸 | 내용 |
|---|---|
| Family | F-CONTRACT — 제품 계약 불일치 |
| 발생 날짜 | 2026-09-24(코드 대조에서 발견) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 코드 확인(운영 사용자 사례는 없음) |
| AI 행동 | v27 `roundFinished` = 거절 외 기록 5개면 끝 → 「모르겠어요」×5 로도 대화 끝 |
| 기대 행동 | 유효 답 5개(기준본 §15) |
| Failure Type | 제품 계약 불일치 |
| 원인 Layer | Product Contract (원인 확신: CONFIRMED) — Product Contract |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 ○ |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 대화 끝 = 유효 답 기준(B-1.0). 연결 자격 쪽은 v15.1 에서 이미 제외 |
| 실험 결과 | [MOCK] B unsure 유효 답 제외 통과 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 모르는 사람은 대화가 길어짐 → 빠져나갈 문 필요 |
| 역검사 결과 | 「unsure 유효 제외」 제거 시 실패 확인 |
| 실AI 결과 | 해당 없음(규칙 문제) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | UNRESOLVED(대표 결정 대기) |
| Golden Test | FLOW4 |
| 관련 실패(Graph) | REGRESSION_OF→GF-41(CODE) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_MASTER_CODE_최종대조_v15_20260924.md` |

## GF-10 새 갈래 첫 줄 검사로 후보 9개 전부 탈락

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-24 09:57~09:58Z(18:57 KST), 운영 v25(v15.1) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (LEVEL 3 FAIL #1) |
| 사용자 원문 | 「그냥 편한친구 부담없이」(12자, 첫 답) |
| AI 행동 | 요청 3번 × 후보 3개 = 9개 전부 `no_bridge` → 502 「다음 질문을 아직 만들지 못했어요」 |
| 기대 행동 | 이어지는 질문 |
| Failure Type | 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration — 첫 줄 근거를 `basis` 글자 인용으로만 확인, 떨어진 이유를 모델에 부정확하게 전달 |
| 사용자 피해 · 감정 | 대표 첫 실제 답에서 곧바로 실패 화면 |
| 사용자 피해 · 정신 | 「다음 질문 받기」를 여러 번 눌러야 했음(요청 3번) |
| 사용자 피해 · 시간 | UNKNOWN(요청별 시간 미기록) |
| 사용자 피해 · 물질 | 요청 3번 × 후보 3개 = LLM 생성 9회 이상(비용 UNKNOWN) |
| 재현 여부 | 운영 3회 · 같은 입력으로 v15.1 코드 502 재현(TEST A, 가짜 AI) |
| 해결 시도(실패한 해결책 포함) | FS-07 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | v15.2 `ackGrounded`(→ 점프 부작용 FS-08) → v16 한 턴 구조(해당 검사 없음) |
| 실험 결과 | v15.2 운영 배포 → FAIL #2 로 새 실패 |
| Mock 결과 | UNKNOWN |
| 부작용 | FS-08 참고 |
| 역검사 결과 | v15.2 TEST A~F 통과(가짜 AI) — 실AI 에서 다른 실패 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A·B 모두 FLOW2#1 에서 질문 생성(기계 PASS) (이전 기록: v26 에서 점프(GF-08)) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(검사가 있던 경로 자체를 교체) |
| Golden Test | FLOW2 |
| 관련 실패(Graph) | FIXED_BY→FS-08(ACTUAL) · GF-15→MASKS(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fix/LEVEL3_실제실패_수정_v15.2_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-11 되물음 「활동?갑자기?」가 답으로 저장 · 긴 지연 · 자동 재요청

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-24 11:44Z, 운영 v26 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (FAIL #2 보고 §0·§B) |
| 사용자 원문 | 「활동?갑자기?」 |
| AI 행동 | AI 분류 answer("애매하면 answer") → 칸 2/5 로 저장 → 다음 질문 11.9초 502 → 화면이 0.04초 뒤 자동 재요청 8.1초 502 |
| 기대 행동 | 문제제기로 받아 질문 방향 바꾸기, 저장 안 함 |
| Failure Type | 오분류 · 지연 |
| 원인 Layer | Orchestration · Infrastructure (원인 확신: CONFIRMED) — Orchestration(분류 기본값·다단 LLM 4~5회) + Infrastructure(화면 자동 재요청) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 되물음이 답으로 저장돼 칸이 참(2/5) |
| 사용자 피해 · 시간 | 보내기부터 첫 오류까지 약 13.4초 · 다음 질문 11,936ms 502 + 자동 재요청 8,069ms 502(운영 로그) |
| 사용자 피해 · 물질 | 실패한 요청 2번 분량 LLM 호출(비용 UNKNOWN) |
| 재현 여부 | 운영 1회(재요청 포함 2번) |
| 해결 시도(실패한 해결책 포함) | FS-11, FS-12 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | v16 한 턴 1~2회 호출 · Agent v1 자동 재요청 제거 · B-1.0 repair 신호 |
| 실험 결과 | v16·Agent v1 운영 반영(v27). 이 입력의 v27 실AI 재검사는 없음 |
| Mock 결과 | UNKNOWN |
| 부작용 | 자동 재요청이 없어져 사용자가 「다음 질문 받기」를 눌러야 함 |
| 역검사 결과 | Agent v1 검사(가짜 AI) |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 「활동?갑자기?」 ask 분류 → 고정 안내문 + 같은 질문. B: repair 인정 문장 뒤 글자까지 같은 질문(의도 이름 달라 미탐, GF-61). 둘 다 비저장 (이전 기록: v27 에서 이 입력은 미관측. B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED |
| Golden Test | FLOW2 |
| 관련 실패(Graph) | BROKEN_BY→FS-14(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail2/LEVEL3_FAIL2_구조원인분석_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-12 사용자 구절을 질문에 끼워 넣어 문장 파손

| 칸 | 내용 |
|---|---|
| Family | F-SENTENCE — 문장 파손 |
| 발생 날짜 | 2026-09-22 16:30 KST 무렵, 운영 v13.7(버전 18) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (ASLEEP 보고 §K(2)) |
| 사용자 원문 | 「에너지가 뺏기가 싫어서」 |
| AI 행동 | 「상대에게 바라는 에너지가 뺏기가 싫어서는 어떤 모습일까요?」 |
| 기대 행동 | 인용하더라도 문장이 성립 |
| Failure Type | 문장 파손 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration — 서버 고정 대체 문장이 14자 이하 인용을 조사 자리에 끼워 넣음(FS-01) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 「오타 같다」류 신뢰 저하(대표 v14.3 지적과 같은 계열) — 측정값 UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 1회 · v14 회귀 검사에 입력 고정 |
| 해결 시도(실패한 해결책 포함) | FS-01 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | v14: 인용은 「"…"라고 하셨죠.」 한 줄 안에서만 |
| 실험 결과 | 가짜 AI 35/35 · 운영 배포(v14 버전 19) |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 인용 줄이 반복되면 「~라고 하셨죠」 되풀이(v14.4 검사표에서 목표 미달 기준으로 등록) |
| 역검사 결과 | 인용 틀 밖에 사용자 말이 들어가면 실패하도록 고정 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 「에너지가 뺏기가 싫어서」 저장 + 질문(문장 파손 없음). B: 지친 말로 오분류해 저장 0(FAIL, GF-65) (이전 기록: 이후 운영에서 같은 파손 보고 없음(관측 부재 ≠ 검증)) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | FLOW5 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_ASLEEP_CONVERSATION_FINAL_REPORT_20260922.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-13 무겁고 추상적인 질문 · 고친 서버를 배포하지 않음

| 칸 | 내용 |
|---|---|
| Family | F-DRIFT — 방향이탈 · 무거운 질문 |
| 발생 날짜 | 2026-09-22 16:25~17:00 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (대표 실기기 · ASLEEP 보고 §K(1) · CLAUDE.md 「되풀이의 진짜 원인」) |
| AI 행동 | 「상대에게 바라는 가식없고 진심인 행동은 어떤 모습일까요?」 — 대표 「질문이 너무 딥하다」 |
| 기대 행동 | 매칭에 필요한 가벼운 질문 |
| Failure Type | 무거운 질문 · 배포 불일치 |
| 원인 Layer | Model · Infrastructure (원인 확신: MIXED) — Model/Prompt(추상 질문 금지 없음) + Infrastructure(수정본 v14 를 만들고 배포하지 않아 대표 화면엔 옛 문장) |
| 사용자 피해 · 감정 | 대표 지적(보고서 요약): 「질문이 너무 어렵고 딥하다 … 세션이 길다 … 피로하다」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | 고친 서버를 배포하지 않아 대표가 옛 문장으로 다시 검사(회차 수 UNKNOWN) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 관측 |
| 해결 시도(실패한 해결책 포함) | FS-02 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 무거운 말 금지·45자(v14) · 배포 규칙 변경(대화 서버는 검사 통과 시 바로 배포) |
| 실험 결과 | v14 운영 배포(버전 19) |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 너무 가벼운 고정 질문(EASY_QUESTION, FS-03)으로 이어짐 |
| 역검사 결과 | 금지 목록 검사(가짜 AI) |
| 실AI 결과 | 이후 「딥하다」 재보고(09-24, GF-14) → 완전 해결 아님 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | FIXED_BY→FS-02(ACTUAL) · GF-34→REGRESSION_OF(ACTUAL) · GF-58→CAUSES(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_ASLEEP_CONVERSATION_FINAL_REPORT_20260922.md` · `CLAUDE.md` |

## GF-14 되묻기가 답으로 저장 · 깨진 질문

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-24, 운영 v14.x |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (CLAUDE.md v14.3 기록) |
| 사용자 원문 | 「딥하네」, 「활동?질문이 머이래」 |
| AI 행동 | 두 말을 답으로 저장 · 「상대가 알면 좋을 나은 어떤가요?」(깨진 문장) · 반말·두 질문·같은 주제 반복 |
| 기대 행동 | 되묻기는 저장하지 않고 질문을 쉽게 다시 |
| Failure Type | 오분류 · 문장 파손 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration(되묻기 판정 규칙 부족 · 주제 이름을 질문에 끼움) |
| 사용자 피해 · 감정 | 대표 「질문이 앞뒤도 안 맞고 … 오타도 있는 것 같고 너무 딥해」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | **코드 재현 ○(해결된 쪽)** — Replay R1: v27 `ruleKind` 가 두 말 모두 meta |
| 해결 시도(실패한 해결책 포함) | FS-03 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | v14.3 META_PATTERNS 확장(= 실패마다 정규식 추가 방식) |
| 실험 결과 | 두 말은 이제 규칙으로 잡힘. 같은 방식이 GF-05(「취미생활?」 오분류)를 낳음 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | GF-05 |
| 역검사 결과 | 없음 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 「딥하네」·「활동?질문이 머이래」 규칙 meta → 다른 질문(「그럴 때는 어떤 기분이 드나요?」·「어떤 활동에 대해…」). B: 지친 말로 분류해 위로만. 둘 다 비저장(기계 PASS) · 쉽게 다시 물었나는 블라인드 (이전 기록: —) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED(규칙 추가 방식 — 대표 지시상 앞으로 쓰지 않음) |
| Golden Test | FLOW5 |
| 관련 실패(Graph) | FIXED_BY→FS-03(CODE) |
| 근거 | `CLAUDE.md` · `docs/claude-final-review-20260916/PATCH-20260924-release-1.0/README_대표용_출시1.0_20260924.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-15 가짜 AI 검사 전부 통과, 실제 첫 입력에서 실패

| 칸 | 내용 |
|---|---|
| Family | F-EVAL — 평가 결함(가짜 통과) |
| 발생 날짜 | 2026-09-24 18:57 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL |
| 사용자 상황 | v15.1 은 가짜 AI 기준 479개 중 474 통과 / 0 실패로 운영 배포됨 |
| AI 행동 | 대표의 첫 실제 답에서 곧바로 질문 생성 실패(GF-10) |
| 기대 행동 | 배포 전 검사가 실제 실패를 미리 잡음 |
| Failure Type | Mock PASS / 실AI FAIL |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — Evaluation — 가짜 AI 가 서버 검사를 통과하는 모양의 답만 만들어, 실제 모델 출력 분포를 반영하지 못함 |
| 사용자 피해 · 감정 | 배포 직후 첫 입력에서 실패 |
| 사용자 피해 · 정신 | 「검사 통과」 보고를 믿고 실기기 검사에 시간을 씀 |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 1회 · 이후 v15.2·v16·Agent v1 에서도 같은 양상(FAIL #2·#3) |
| 해결 시도(실패한 해결책 포함) | FS-13 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 실AI Replay Harness + 운영 실제 입력 고정 세트(이번 자산) · 서버 판정 재생(실제 AI 문장 사용) |
| 실험 결과 | Replay R1·R2 구축(실제 문장, AI 호출 0). 실AI A/B = BLOCKED_BY_ENVIRONMENT |
| Mock 결과 | UNKNOWN |
| 부작용 | 없음 |
| 역검사 결과 | Replay 특성 검사가 알려진 A 실패를 잡는지 확인(regression.test.mjs) |
| 실AI 결과 | BLOCKED_BY_ENVIRONMENT |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED(구조 원인 · 실AI 경로 필요) |
| Golden Test | FLOW2 |
| 관련 실패(Graph) | MASKS→GF-10(ACTUAL) · GF-16→CONTRIBUTES_TO(HYPOTHESIS) · GF-17→CONTRIBUTES_TO(HYPOTHESIS) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fix/LEVEL3_실제실패_수정_v15.2_20260924.md` |

## GF-16 이름과 다른 것을 확인해 실패를 통과로 셈

| 칸 | 내용 |
|---|---|
| Family | F-EVAL — 평가 결함(가짜 통과) |
| 발생 날짜 | 2026-09-24(v15 MASTER↔CODE 대조에서 발견) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 코드 확인 |
| AI 행동 | 검사 「여정 끝까지 40회 … STEP 7 까지 끊기지 않는다」가 반말만 확인 → 30/40 INVALID_STATE, STEP 7 도달 0 인데 통과 |
| 기대 행동 | 이름대로 끝까지 가는지 확인 |
| Failure Type | 검사 결함 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — Evaluation |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 ○ |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 옛 STEP 흐름 검사를 미확정(todo)으로 분리(LEGACY-01) |
| 실험 결과 | 미확정 목록에 표시됨 |
| Mock 결과 | UNKNOWN |
| 부작용 | 없음 |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(LEGACY — P0 판정과 분리) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | CONTRIBUTES_TO→GF-15(HYPOTHESIS) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_MASTER_CODE_최종대조_v15_20260924.md` |

## GF-17 검사 장치가 가짜 AI 답을 한 번도 읽지 못함

| 칸 | 내용 |
|---|---|
| Family | F-EVAL — 평가 결함(가짜 통과) |
| 발생 날짜 | 2026-09-24(v15.1 작업 중 발견, 내 실수) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 코드 확인 |
| AI 행동 | 이해 후보(gen) 경로의 가짜 AI 답을 JSON 으로 읽다 오류 → 그 경로는 검사되지 않은 채 통과 |
| Failure Type | 검사 결함 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — Evaluation |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 ○ |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 검사 장치 수정 |
| 실험 결과 | 고침 |
| Mock 결과 | UNKNOWN |
| 부작용 | 없음 |
| 역검사 결과 | v15.1 역검사 16개 |
| 실AI 결과 | 해당 없음 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | RESOLVED(검사 도구) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | CONTRIBUTES_TO→GF-15(HYPOTHESIS) |
| 근거 | `CLAUDE.md` |

## GF-18 규칙 분류가 실사용 말투 답 16개 중 14개를 오판

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-24(LEVEL 2 연습 실행) |
| 증거 수준 | ACTUAL |
| 출처 | SYNTHETIC — **SYNTHETIC**(실사용 말투로 쓴 검사 입력 — 실제 사용자 입력 아님) |
| 사용자 원문 | 예: 「보드게임 같은 거」·「연애에 지쳐서…」·「친구한테 다 말했어요」 |
| AI 행동 | 낱말 하나 때문에 불만·지친 말로 판정 → 저장 안 됨 |
| Failure Type | 오분류 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — Orchestration |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 연습 실행 ○ |
| 해결 시도(실패한 해결책 포함) | FS-10 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 규칙은 대화 자체를 가리키는 분명한 말만, 애매하면 AI(v15.1) |
| 실험 결과 | 16개 중 14개 재검사 통과(가짜 AI) |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | GF-11(애매하면 answer → 되물음 저장) 방향 위험 |
| 역검사 결과 | v15.1 역검사 |
| 실AI 결과 | 없음 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | FIXED_BY→FS-14(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_Conversation_Orchestrator_대조_v15.1_20260924.md` |

## GF-19 지난 회차의 확인 기록이 새 회차 맥락에 섞임

| 칸 | 내용 |
|---|---|
| Family | F-CONTEXT — 맥락 유실·오염·거절 재등장 |
| 발생 날짜 | 2026-09-24 22:58 KST(FAIL #3) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (FAIL #3 보고: 옛 회차 확인 13 · 후보 1 이 새 회차 입력에 포함) |
| AI 행동 | 「처음부터 시작하기」 뒤에도 옛 이해가 모델 입력에 들어감 |
| 기대 행동 | 새 회차는 새로, 옛 말은 사용자가 다시 꺼냈을 때만 |
| Failure Type | Context 오염 |
| 원인 Layer | Context (원인 확신: CONFIRMED) — Context(회차 필터 없음) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 기록 ○ |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | Agent v1.1 기억 3층(운영 미배포) · B-1.0 = 이번 회차 상태만 사용 |
| 실험 결과 | [MOCK] |
| Mock 결과 | UNKNOWN |
| 부작용 | 사용자가 원하는 연속성이 끊길 수 있음 |
| 역검사 결과 | 없음 |
| 실AI 결과 | BLOCKED_BY_ENVIRONMENT |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-level3-fail3/LEVEL3_FAIL3_ROOT_CAUSE_20260924.md` |

## GF-20 배포 때 옮겨 적기 오류로 질문 검사 규칙이 바뀜

| 칸 | 내용 |
|---|---|
| Family | F-DEPLOY — 배포·운영 과정 결함 |
| 발생 날짜 | 2026-09-24 05:41 KST 무렵(doit-understanding 버전 21) |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — ACTUAL (운영 파일 내려받아 대조) |
| AI 행동 | 질문 검사 정규식의 「왜」가 「왕」으로 올라감 → 「왜」를 물음말로 세지 못함 |
| 기대 행동 | 로컬 검사한 파일 = 운영 파일 |
| Failure Type | 배포 불일치 |
| 원인 Layer | Infrastructure (원인 확신: CONFIRMED) — Infrastructure(MCP 로 긴 파일을 옮겨 적음) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | 버전 21 → 22 교체까지(분 단위, 정확값 UNKNOWN) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 대조 ○(이후 doit-connect v4 빈 줄 누락도 같은 모양) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 관리 API 로 원본 파일 그대로 업로드 + 배포 뒤 SHA-256 대조 필수 |
| 실험 결과 | v15.2 부터 적용 · 지문 대조 규칙 운영 중 |
| Mock 결과 | UNKNOWN |
| 부작용 | 관리 API 토큰 만료 시 대표 수동 붙여넣기 필요(Agent v1 때 끝 줄바꿈 1바이트 차이) |
| 역검사 결과 | 매 배포 SHA 대조 |
| 실AI 결과 | 해당 없음 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | RESOLVED(배포 과정) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `CLAUDE.md` |

## GF-21 대화 중 「그게 아니에요」로 거절한 해석이 다시 쓰일 수 있음

| 칸 | 내용 |
|---|---|
| Family | F-CONTEXT — 맥락 유실·오염·거절 재등장 |
| 발생 날짜 | 2026-09-24(v15 MASTER↔CODE 대조 · LEVEL 2 연습 실행) |
| 증거 수준 | ACTUAL |
| 출처 | CODE+SYNTHETIC — 코드 확인 + SYNTHETIC(가짜 AI 연습: 「[자동] 거절한 AI 문장 재등장 0: false」) — 실제 사용자 사례 기록 없음 |
| AI 행동 | 대화 중 거절이 다음 답 때로 미뤄지고 한 번뿐·저장 안 됨 → 거절한 문장이 다시 나올 수 있었음 |
| 기대 행동 | 거절한 뜻은 표현을 바꿔서도 다시 쓰지 않음 |
| Failure Type | 거절 의미 재등장 |
| 원인 Layer | Orchestration · Context (원인 확신: CONFIRMED) — Orchestration(거절 저장 시점) · Context(다음 입력에 없음) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 ○ · 연습 실행 ○(가짜 AI) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | v15.1: 분류 순간 서버 저장(`followup_reject`) → 다음 질문·통합 카드·소개 초안 차단 · B-1.0: 정정 시 직전 질문을 거절 목록에 |
| 실험 결과 | v15.1 가짜 AI 검사 통과 · 운영 배포(v25 이후) |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 거절 판정이 글자 겹침 기반인 경로가 남아 있음(표현을 바꾼 재등장은 미탐 가능) |
| 역검사 결과 | v15.1 역검사 통과 |
| 실AI 결과 | 운영에서 재등장 관측 기록 없음(관측 부재 ≠ 검증) · B = BLOCKED_BY_ENVIRONMENT |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_MASTER_CODE_최종대조_v15_20260924.md` · `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/LEVEL2_연습실행_가짜AI_결과아님.md` |

## GF-22 사용자 질문에 답하지 않고 되묻기 · 말 따라 하기 · STEP 4 질문 생성 실패

| 칸 | 내용 |
|---|---|
| Family | F-ANSWER — 사용자 질문에 먼저 답하지 않음 |
| 발생 날짜 | 2026-09-16 20:03 UTC(STEP 4 로그) · ECHO STEP 흐름 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 iPhone 캡처 9장 + 운영 로그 |
| 사용자 상황 | ECHO 옛 STEP 1→7 대화. 대표가 AI 에게 직접 물음 |
| 사용자 원문 | 「어떻게 대처하는게 좋을까?」 · 「ai가 오타기 날수도 있어?」 · 「질문했는데 답을 못햐?」 |
| AI 행동 | 질문에 답하지 않고 되묻기만 함 · 공감 문장이 사용자 말을 그대로 따라 씀 · 「답을 못햐?」를 부담 피드백으로 오분류해 고정 문장 「제가 어렵게 물었어요…」 · STEP 4 후보 6개 전부 차단 → 「질문을 만들지 못했어요」 |
| 기대 행동 | 사용자 질문에 먼저 답하고, 질문은 하나만 |
| Failure Type | 사용자 질문 무시 · 말 따라 하기 · 오분류 · 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 행동 분기(사용자가 물었을 때) 부재 · BURDEN 정규식 오분류 · 의도 태그 12종을 대화 전체와 비교해 STEP 4 쯤 소진 · ack 에 anchor 글자 그대로 강제 |
| 사용자 피해 · 감정 | 대표 「질문했는데 답을 못햐?」(운영 원문) |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | 질문 생성 2,883·3,245·3,522ms, 두 번 막히면 5,676·6,185ms 뒤 실패(TRUST_FIRST_REVIEW 69~70행) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 2회(20:03:25~39 UTC) |
| 해결 시도(실패한 해결책 포함) | FS-17, FS-18, FS-19, FS-21 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | Action Router(물음 먼저 답) · 의도 비교 범위 제한 · 막히면 완화 |
| 실험 결과 | 09-16 수정(옛 흐름) |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] FLOW6#1: A 되묻기 비저장(PASS) · B 「모르겠어요」로 저장(FAIL). FLOW6#2: A 답을 질문 칸에 넣음(반응 칸 비어 FAIL, 뜻은 일부 답함) · B 먼저 답(PASS) (이전 기록: 옛 흐름 실AI 재검증 기록 없음) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(옛 STEP 흐름 수정 · 현재 DO IT 대화와 별개 경로) |
| Golden Test | FLOW6 |
| 관련 실패(Graph) | BROKEN_BY→FS-17(CODE) · GF-62→REGRESSION_OF(HYPOTHESIS) |
| 근거 | `docs/claude-final-review-20260916/COMPANION_FIX_REPORT_20260916.md` · `docs/claude-final-review-20260916/TRUST_FIRST_REVIEW_20260917.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-23 반말 · 깨진 날씨 문장

| 칸 | 내용 |
|---|---|
| Family | F-SENTENCE — 문장 파손 |
| 발생 날짜 | 2026-09-17 13:01·13:03 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 iPhone · 운영 대화 b36e16d0·a0ee9d32 |
| 사용자 상황 | 날씨 → 대화 시작 |
| 사용자 원문 | — |
| AI 행동 | 「맑은 날씨인데도 걱정이 드는 이유가 무엇인지 궁금해?」(반말) · 「오늘 밖은 대체로 맑음예요.」(문법 파손) |
| 기대 행동 | 해요체 · 문법이 맞는 문장 |
| Failure Type | 문장 파손 · 말투 |
| 원인 Layer | Model · Orchestration (원인 확신: CONFIRMED) — PERSONA 에 존댓말 규칙 없음 + 「친구처럼」 · 서버에 반말 검사 없음 · 날씨 문장 조립 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 화면 신뢰 저하 — 측정값 UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 2회 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 존댓말 규칙·반말 검사(옛 흐름) |
| 실험 결과 | 옛 흐름 실제 AI 100회(자동 판정)에서 반말 0 — 사람 검수 아님 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 옛 흐름 100회(실제 AI·자동 판정) 반말 0 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(옛 흐름) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/FIELD_DEFECTS_20260917.md` · `docs/claude-final-review-20260916/FINAL_100RUN_REVALIDATION_20260919.md` |

## GF-24 짧은 답 뒤 같은 뜻 후보 3번 막혀 대화 종료

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-17 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 iPhone · 운영 대화 |
| 사용자 상황 | STEP 2 |
| 사용자 원문 | 「돈때문에」 |
| AI 행동 | 비슷한 뜻 질문만 나와 반복 검사에 3번 막힘 → 「잠시 연결이 원활하지 않아요 / 질문을 만들지 못했어요.」 |
| 기대 행동 | 짧은 답도 이어 묻기 |
| Failure Type | 과잉 Guard · 질문의도 반복 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 같은 뜻 반복 검사를 지금까지 나온 질문 전체와 비교 · 마지막 시도 완화 없음 · 구제 없음 |
| 사용자 피해 · 감정 | 대화가 끊김 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 1회 |
| 해결 시도(실패한 해결책 포함) | FS-17 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 완화·구제(옛 흐름) |
| 실험 결과 | 옛 흐름 수정 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] 「돈때문에」: A·B 저장·질문(기계 PASS). B 질문은 앞 턴과 같은 활동 질문(의도 이름 「돈 문제」로 잘못 붙어 통과) (이전 기록: —) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(옛 흐름) |
| Golden Test | FLOW7 |
| 관련 실패(Graph) | BROKEN_BY→FS-17(CODE) |
| 근거 | `docs/claude-final-review-20260916/FIELD_DEFECTS_20260917.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-25 정정 두 개가 똑같은 다음 질문으로 이어짐(정정무시)

| 칸 | 내용 |
|---|---|
| Family | F-CONTEXT — 맥락 유실·오염·거절 재등장 |
| 발생 날짜 | 2026-09-18 · 재발 2026-09-19 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 운영 서버 + 실제 OpenAI + 검사 계정의 스크립트 입력(캐너리 10회 · 100회 검사) |
| 사용자 상황 | 「조금 달라요」·「직접 설명할게요」로 정정 |
| 사용자 원문 | 「사실은 일보다 사람이 더 힘들어요」 / 「돈보다 시간이 없는 게 더 힘들어요」 |
| AI 행동 | 두 정정 모두 「일이 많아지면서 어떤 부분이 가장 힘드신가요?」 · 재발: 「돈이 제일 크게 걸려요라고 말씀하셨네요. / 돈 문제와 관련해서 어떤 부분이 가장 걱정되시나요?」(정정 전 내용 + 문장 파손) |
| 기대 행동 | 정정 내용(사람·시간)을 반영한 다음 질문 |
| Failure Type | 정정무시 · 문장 파손 |
| 원인 Layer | Orchestration · Context (원인 확신: CONFIRMED) — 「정정을 가장 먼저 반영하라」가 프롬프트에만 있고 서버 확인 규칙 없음 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 정정해도 반영되지 않음 — 대표 인사말의 「정정한 내용이 반영되지 않는 경험」과 같은 유형 |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI 100회 중 5회 → 수정 뒤 100회 중 1회 |
| 해결 시도(실패한 해결책 포함) | FS-15 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 정정 최우선 서버 규칙 · 정정 전 문장 전제 금지 |
| 실험 결과 | v34 수정 → 막다른 길 악화(FS-16) → 되돌림 |
| Mock 결과 | UNKNOWN |
| 부작용 | 막다른 길 2→5(FS-16) |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] 「사실은 일보다 사람이 더 힘들어요」: A·B 저장·질문(기계 PASS) · 반영 여부는 블라인드 (이전 기록: 옛 흐름: 실제 AI 100회 1회 재발) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED(현재 v27 경로의 정정 반영은 실AI 미검증) |
| Golden Test | FLOW6 |
| 관련 실패(Graph) | FIXED_BY→FS-15(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/CANARY_FINDINGS_20260918.md` · `docs/claude-final-review-20260916/FINAL_100RUN_REVALIDATION_20260919.md` · `docs/claude-final-review-20260916/SERVER_CORE_FINAL_REPORT_20260918.md` · `git:6ed213d` · `git:345159f` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-26 사용자 질문을 질문으로 되받음 · 물어본 턴 전부 차단

| 칸 | 내용 |
|---|---|
| Family | F-ANSWER — 사용자 질문에 먼저 답하지 않음 |
| 발생 날짜 | 2026-09-18 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI · 스크립트 입력(캐너리) |
| 사용자 상황 | 사용자가 AI 에게 따짐 |
| 사용자 원문 | 「내가 언제 그렇게 말했어?」 |
| AI 행동 | 「어떤 생각에 대해 궁금하신 건가요?」 · 물어본 턴(mode=asked) 29회 관측 통과 0 · 대화 2건 종료 · reply_missing 47건 중 39건 |
| 기대 행동 | 먼저 답하고 사과·설명 |
| Failure Type | 사용자 질문 무시 · 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 후보 서식 줄이 「아니면 빈 문자열」이라 물어본 턴에도 답이 비는 게 기본값 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI 29/29 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 물어본 턴에는 답 필수 |
| 실험 결과 | 재검사 reply_missing 0(옛 흐름) |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] FLOW6#3·#4: A 반응 칸 비음·#4 질문 실패(FAIL). B 반응 있음(기계 PASS) — 단 #3 「답을 못한 건 아니에요」 반박, #4 지친 말로 오분류(뜻은 블라인드) (이전 기록: 옛 흐름 실제 AI 재검사) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(옛 흐름) |
| Golden Test | FLOW6 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/SERVER_CORE_FINAL_REPORT_20260918.md` · `docs/claude-final-review-20260916/CANARY_FINDINGS_20260918.md` · `docs/claude-final-review-20260916/FINAL_LOCK_REPORT_20260918.md` · `git:dd1ec6a` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-27 같은 되물음 17턴 → 새 질문 고갈로 막힘

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-18 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI · 스크립트 입력(대화 #6) |
| 사용자 상황 | 사용자가 새 내용 없이 되묻기만 반복 |
| 사용자 원문 | 「왜 그렇게 생각했어?」 「무슨 뜻이야?」 등 네 문장 17턴+ |
| AI 행동 | repeat·not_question 으로 후보 고갈 → 막힘 · 질문이 필요한 턴에 서버가 「억지로 새 질문을 만들지 마라」고 지시(not_question ×3 → no_candidate) |
| 기대 행동 | 질문 없이도 답하고 대화를 살림 |
| Failure Type | 과잉 Guard · Repair 실패 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 서버 지시끼리 충돌 + 질문 의무 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI 1대화 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 질문 선택사항(B-1.0 과 같은 방향) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/FINAL_LOCK_REPORT_20260918.md` · `git:9bb9307` |

## GF-28 대규모 실제 AI 검사에서 반복 질문 88 · 맥락무시 589

| 칸 | 내용 |
|---|---|
| Family | F-REPEAT — 같은 뜻 반복 · 반복설명 강요 |
| 발생 날짜 | 2026-09-19 · 2026-09-20 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI 100회(스크립트 입력) · 맥락무시 수는 자동 판정기(judge.mjs) 값 — 사람 검수 아님 |
| 사용자 상황 | 100회 검사(AI 턴 1,574) |
| 사용자 원문 | — |
| AI 행동 | 중복(반복) 질문 88 · 맥락무시(일반론) 589 · 다른 회차 반복 84 |
| 기대 행동 | 앞 말에 이어지는 서로 다른 질문 |
| Failure Type | 질문의도 반복 · 방향이탈 |
| 원인 Layer | Orchestration · Model (원인 확신: HYPOTHESIS) — 모델·서버 분리 안 됨 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | 실제 AI 호출 100대화 분량(비용 UNKNOWN) |
| 재현 여부 | 실제 AI 100회 두 번 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | — |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | 자동 판정기 오탐·미탐 미측정(Evaluation 위험) |
| 실AI 결과 | 옛 흐름 실제 AI |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(옛 흐름 · 현재 경로와 별개) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/FINAL_100RUN_REVALIDATION_20260919.md` · `docs/claude-final-review-20260916/FINAL100V4_REPORT_20260920.md` |

## GF-29 실제 AI 응답 지연 · 시간 초과로 대화 종료

| 칸 | 내용 |
|---|---|
| Family | F-LATENCY — 지연·시간 초과 |
| 발생 날짜 | 2026-09-18 · 2026-09-19 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI 검사(스크립트 입력) |
| 사용자 상황 | 대화 턴 |
| 사용자 원문 | — |
| AI 행동 | p50/p75/p95 = 2,765/5,331/10,569ms · 최대 90,013ms · 10초 초과 125건 · AbortError 21건 · 7대화가 AI_ERROR·BAD_JSON 으로 종료 · 수정 뒤 p95 10,029ms · 6초 초과 31.6% |
| 기대 행동 | 끊김 없는 응답 |
| Failure Type | 지연 |
| 원인 Layer | Infrastructure · Orchestration (원인 확신: MIXED) — 재시도·다단 호출 누적(추정 포함) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | p95 10,029~10,569ms · 최대 90,013ms(보고서 표) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI 2회 측정 |
| 해결 시도(실패한 해결책 포함) | FS-11 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 한 턴 호출 수 축소(v16) |
| 실험 결과 | v16 운영 v27 실측: 턴 중앙 2,967ms(n=11) |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 운영 v27 실측(n=11) — p95 산출 안 함 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(현재 경로 표본 작음) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/SERVER_CORE_FINAL_REPORT_20260918.md` · `docs/claude-final-review-20260916/FINAL_100RUN_REVALIDATION_20260919.md` |

## GF-30 AI 의 추측·사용자 질문 전제가 확정 사실로 저장(미확정 사실화)

| 칸 | 내용 |
|---|---|
| Family | F-STATUS — 정보 상태 오류(미확정 사실화) |
| 발생 날짜 | 2026-09-16 ~ 2026-09-17 |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 외부 검토 + 코드 확인 |
| 사용자 상황 | 리포트 생성 |
| 사용자 원문 | — |
| AI 행동 | 리포트 confirmed 판정을 AI 가 결정(parseReport 가 AI status 그대로 수락) · 질문의 전제·타인의 말을 확정 사실로 저장 가능 |
| 기대 행동 | 사용자가 직접 확인한 말만 확정 |
| Failure Type | 미확정 사실화 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 정보 상태를 서버가 아니라 모델이 정함 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 서버가 정보 상태 소유(확인한 것만 확정) |
| 실험 결과 | 09-17 수정(옛 흐름) · 현재 DO IT = 4버튼 「맞아요」만 사실 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/CLAUDE_ARCHITECTURE_OPINION.md` · `docs/claude-final-review-20260916/TEST_REPORT.md` · `docs/claude-final-review-20260916/TRUST_FIRST_REVIEW_20260917.md` |

## GF-31 약속한 기억이 작동한 적 없음 · 기억 조회 실패를 「기억 없음」으로 숨김

| 칸 | 내용 |
|---|---|
| Family | F-PROMISE — 없는 기능·가짜 결과 약속 |
| 발생 날짜 | 2026-09-17 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 운영 DB(리포트 0건) + 코드 |
| 사용자 상황 | 다음 여정 |
| 사용자 원문 | — |
| AI 행동 | 「지난 리포트 요약」 기억을 넣었다고 했으나 리포트가 0건이라 실제로 작동한 적 없음 · 조회 실패를 기억 없음으로 처리 |
| 기대 행동 | 없는 기능을 있다고 하지 않음 · 실패는 실패로 표시 |
| Failure Type | 없는 기능 약속 |
| 원인 Layer | Orchestration · Evaluation (원인 확신: CONFIRMED) — 구현 보고와 실제 데이터 불일치 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 DB 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 실패 표시 |
| 실험 결과 | 09-17 수정 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/TRUST_FIRST_REVIEW_20260917.md` · `docs/claude-final-review-20260916/COMPANION_FIX_REPORT_20260916.md` |

## GF-32 질문으로 끝난 답이 단계를 넘기고 · 고정 회피 문장이 성공으로 처리됨

| 칸 | 내용 |
|---|---|
| Family | F-STATE — 서버 상태 결함(질문 소실·단계 오류·전달 실패) |
| 발생 날짜 | 2026-09-17 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 운영 DB + 코드 |
| 사용자 상황 | STEP 3→4 |
| 사용자 원문 | 질문(?)으로 끝난 답변 |
| AI 행동 | 단계가 넘어감 · 고정 회피 문장 「제가 대신 정답을 정해 줄 수는 없지만, 같이 찾아볼게요.」를 성공 처리 |
| 기대 행동 | 질문은 답이 아니므로 단계 유지 · 고정 문장은 성공 아님 |
| Failure Type | 가짜 진행 · 오분류 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 상태 전환을 말의 종류와 무관하게 처리 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 DB 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | — |
| 실험 결과 | 09-17 수정 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(옛 흐름) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/TRUST_FIRST_REVIEW_20260917.md` · `docs/claude-final-review-20260916/COMPANION_FIX_REPORT_20260916.md` |

## GF-33 다음 질문 4번 중 3번이 고정 안전문장 · 항의가 답으로 저장 · 지친 말이 이해 후보로

| 칸 | 내용 |
|---|---|
| Family | F-DRIFT — 방향이탈 · 무거운 질문 |
| 발생 날짜 | 2026-09-24 09:17~09:21 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 실기기 + 운영 이벤트 기록(v27 파일 머리 주석에 기록) |
| 사용자 상황 | DO IT 대화(운영 v23 무렵) |
| 사용자 원문 | 「뭘더 얘길해야해 너가 내 내용을 반영해서…」 · 「할말이없다 휴」 |
| AI 행동 | 고정 문장 「…라고 하셨죠. 조금만 더 들려줄래요?」·「방금 한 말, 조금만 더 들려줄래요?」·「그 이야기, 한 가지만 더 들려줄래요?」 · 항의가 답으로 저장돼 다섯 칸에 셈 · 「할말이없다 휴」 → 이해 후보 「할 말이 없다.」 · 답마다 네 버튼 카드 |
| 기대 행동 | 앞 말을 반영한 질문 · 항의는 저장 안 함 · 지친 말은 해석 안 함 |
| Failure Type | 고정 대체 질문 · 오분류 · 미확정 사실화 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — AI 실패 시 고정 문장 구제 · 분류 규칙 부족 |
| 사용자 피해 · 감정 | 대표 「뭘더 얘길해야해 너가 내 내용을 반영해서…」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 이벤트 기록 |
| 해결 시도(실패한 해결책 포함) | FS-02 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 고정 구제 문장 삭제 · 분류 먼저(v15) |
| 실험 결과 | v15~v27 운영 반영 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] FLOW7#3: A 질문 실패(FAIL). B 인정 문장·질문 버림(기계 PASS). FLOW4#8 「할말이없다 휴」: 둘 다 비저장(PASS) (이전 기록: —) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | FLOW7 |
| 관련 실패(Graph) | BROKEN_BY→FS-02(CODE) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-homepage-final/prod/doit-understanding.v27.prod.ts` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-34 주제별 고정 질문이 앞 답과 무관하게 나감 · 「왜 이런 걸 물어봐?」가 답으로 저장

| 칸 | 내용 |
|---|---|
| Family | F-DRIFT — 방향이탈 · 무거운 질문 |
| 발생 날짜 | 2026-09-24(운영 v23) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 대표 지적 + 코드 확인 · 예시 대화는 가짜 AI 재현(SYNTHETIC) — 코드로 존재 확인(대표 진술 + 코드), 2026-09-25 출처 표시 정정 |
| 사용자 상황 | DO IT 대화 |
| 사용자 원문 | 「근데 왜 이런 걸 물어봐?」(예시) |
| AI 행동 | 「알겠어요. 어떤 사람한테 끌려요?」 같은 주제별 고정 문장 · GENERIC_RESCUE 「어떤 사람이면 편하게 느껴지세요?」 · 가짜 AI 재현: 「잘 웃는 사람」 → 「쉬는 날에는 무엇을 하세요?」 |
| 기대 행동 | 방금 답에서 이어지는 질문 |
| Failure Type | 고정 대체 질문 · 방향이탈 · 오분류 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — AI 실패 시 주제별 고정 질문으로 건너뜀 |
| 사용자 피해 · 감정 | 대표 「AI 질문 자체가 앞뒤 대화와 맞지 않는다」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 가짜 AI 로 v23 코드 재현 |
| 해결 시도(실패한 해결책 포함) | FS-02 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 고정 질문 삭제(v14.4) |
| 실험 결과 | v14.4 운영 배포(버전 24) |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | REGRESSION_OF→GF-13(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-conversation-continuity/README_대화연결_P0_20260924.md` |

## GF-35 옛 STEP 흐름에 고정 대체 질문이 운영 중

| 칸 | 내용 |
|---|---|
| Family | F-DRIFT — 방향이탈 · 무거운 질문 |
| 발생 날짜 | 2026-09-24(발견) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 운영 중인 get-step-question v48 · echo-journey v26 코드 |
| 사용자 상황 | 옛 ECHO STEP 1→7 |
| 사용자 원문 | — |
| AI 행동 | 「"…" 라고 하셨죠. 그중 어떤 부분이 지금 마음에 남아 있나요?」 고정 문장 |
| 기대 행동 | 고정 문장 없이 이어 묻기 |
| Failure Type | 고정 대체 질문 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 옛 흐름은 수정 대상에서 빠짐(LEGACY-01) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 옛 흐름 정리(대표 결정) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(LEGACY · P0 판정과 분리) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/LEGACY_ISSUES.md` |

## GF-36 「진실된마음」 뒤 생뚱맞은 구제 질문(띄어쓰기 인용 검사 탈락)

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-22 09:50 KST |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 실기기 + doit_request_events |
| 사용자 상황 | 「연애에 대해 어떤 점이 가장 중요하다고 생각하나요?」에 답 |
| 사용자 원문 | 「진실된마음」 |
| AI 행동 | 후보가 근거 인용 불일치(「진실된 마음」 띄어쓰기)로 전부 탈락 → 구제 「방금 남긴 기록에서 가장 마음에 남는 부분은 어디였나요?」 |
| 기대 행동 | 「진실된 마음」을 이어 묻기 |
| Failure Type | 과잉 Guard · 고정 대체 질문 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 근거 인용 글자 일치 검사 · 주제 소진 후 CHANGE_DIRECTION |
| 사용자 피해 · 감정 | 대표 「여기서 질문이 생뚱맞았다」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 1회 |
| 해결 시도(실패한 해결책 포함) | FS-20 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 인용 검사 띄어쓰기 무시(v13.6) |
| 실험 결과 | v13.6 운영 배포 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | 같은 모양의 글자 인용 검사가 v16 clue 로 다시 등장(GF-02) |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] 「진실된마음」: A·B 저장·질문, 고정 문장 0(기계 PASS) — 둘 다 「활동」 질문(GF-08) (이전 기록: —) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED — 같은 모양 재발(GF-02) |
| Golden Test | FLOW7 |
| 관련 실패(Graph) | FIXED_BY→FS-20(ACTUAL) · GF-02→REGRESSION_OF(CODE) |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_ASLEEP_CONVERSATION_FINAL_REPORT_20260922.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-37 캐묻기 · 빈 구제 질문

| 칸 | 내용 |
|---|---|
| Family | F-DRIFT — 방향이탈 · 무거운 질문 |
| 발생 날짜 | 2026-09-21 ~ 22 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 실기기(운영 v12~v13.3) + 운영 이벤트 |
| 사용자 상황 | DO IT 첫 대화 |
| 사용자 원문 | — |
| AI 행동 | 「조용한 곳에서 어떤 활동…」·「어떤 느낌인지 구체적으로…」 캐묻기 · 구제 「어떤 질문을 하고 싶으신가요?」 · followup_generate AI_ERROR 2건(09-21 22:13·22:17) |
| 기대 행동 | 가볍고 앞 말에 이어지는 질문 |
| Failure Type | 무거운 질문 · 고정 대체 질문 |
| 원인 Layer | Orchestration · Model (원인 확신: MIXED) — 구제 질문 문장·캐묻기 지침 |
| 사용자 피해 · 감정 | 대표 「벌써 지루함」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 관측 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | v13.x 구제 개선 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_V13_FIRST_CONVERSATION_REPORT_20260921.md` · `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_ASLEEP_CONVERSATION_FINAL_REPORT_20260922.md` |

## GF-38 주제 판정 답 형식을 못 읽어 버림(topic:null) → 질문 없이 빈 입력창

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-22 오전 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 캡처 5장 + 운영 이벤트 |
| 사용자 상황 | DO IT 대화 |
| 사용자 원문 | 「느낌」·「무슨말」 |
| AI 행동 | AI 가 먼저 묻지 않고 빈 입력창 · 구제 기록 3건 모두 topic:null — 모델이 {"covered":[...]} 대신 다른 형식으로 답해 코드가 읽지 못하고 버림 |
| 기대 행동 | 형식이 달라도 읽거나, 못 읽으면 실패를 알림 |
| Failure Type | 과잉 Guard · 검사 결함 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 형식 파싱 실패를 조용히 버림 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 3건 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 형식 수정(v13.2) |
| 실험 결과 | v13.2 운영 배포(버전 14) |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_V13_FIRST_CONVERSATION_REPORT_20260921.md` · `CLAUDE.md` |

## GF-39 처음부터 다시 할 수 없고 이어가려 해도 멈춤

| 칸 | 내용 |
|---|---|
| Family | F-FLOW — 대화 구조(끝 없음·출구 없음·버튼 피로) |
| 발생 날짜 | 2026-09-22 밤 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 실기기 + 운영 이벤트 |
| 사용자 상황 | DO IT 대화 |
| 사용자 원문 | — |
| AI 행동 | 처음부터 다시 불가 · followup_generate AI_ERROR no_candidate 로 멈춤 |
| 기대 행동 | 빠져나갈 문(처음부터 다시) · 멈추면 이유와 다음 행동 |
| Failure Type | 출구 없음 · 과잉 Guard |
| 원인 Layer | Orchestration · Product Contract (원인 확신: CONFIRMED) — 회차 장치·재시작 버튼 없음 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 관측 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 「처음부터 다시」(v14.3~v15.2) |
| 실험 결과 | 운영 반영 · 대표가 「못 찾겠다」(09-24) → 크게 표시(38차) |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | 대표 실기기 확인 대기 |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(실기기 확인 대기) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_V13_FIRST_CONVERSATION_REPORT_20260921.md` · `CLAUDE.md` |

## GF-40 기계 같은 말투 · 과한 공감 · 「맞아요」 버튼 피로와 입력 잠김

| 칸 | 내용 |
|---|---|
| Family | F-FLOW — 대화 구조(끝 없음·출구 없음·버튼 피로) |
| 발생 날짜 | 2026-09-22 |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 대표 지적 + 코드 확인(입력 잠김) — 코드로 존재 확인(대표 진술 + 코드), 2026-09-25 출처 표시 정정 |
| 사용자 상황 | DO IT 대화 |
| 사용자 원문 | — |
| AI 행동 | 「그렇군요」만 반복하거나 공감이 과함 · 확인 카드가 뜨면 입력창이 완전히 잠겨 매번 버튼을 눌러야 함 |
| 기대 행동 | 짧은 받아주기 · 확인은 나중에도 가능 |
| Failure Type | 말투 · 출구 없음 |
| 원인 Layer | Orchestration · Product Contract (원인 확신: MIXED) — 입력 잠김 = 코드(disabled 조건) 확인 |
| 사용자 피해 · 감정 | 대표 「맞아요 계속 눌러가면서 언제까지 해야 하냐」 |
| 사용자 피해 · 정신 | 「"맞아요"를 계속 눌러야 해서 피로하다」 |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인(입력 잠김) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 「나중에 고를게요」(v14) · 답마다 카드 없음(v15) |
| 실험 결과 | 운영 반영 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | 대표 실기기 확인 대기 |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(실기기 확인 대기) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_ASLEEP_CONVERSATION_FINAL_REPORT_20260922.md` · `CLAUDE.md` · `git:3181c16` |

## GF-41 대화에 끝이 없음

| 칸 | 내용 |
|---|---|
| Family | F-FLOW — 대화 구조(끝 없음·출구 없음·버튼 피로) |
| 발생 날짜 | 2026-09-22 17:40 KST 무렵 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 실기기 + 코드(바닥 문구 「대화의 길이는 정해져 있지 않아요」) |
| 사용자 상황 | DO IT 대화 |
| 사용자 원문 | — |
| AI 행동 | 확인한 이해 11개를 쌓고도 계속 질문 |
| 기대 행동 | 정해진 끝과 다음 할 일 |
| Failure Type | 출구 없음 |
| 원인 Layer | Product Contract (원인 확신: CONFIRMED) — 끝 조건 없음 |
| 사용자 피해 · 감정 | 대표 「질려서 못하겠다 … 언제까지 내가 너랑 대화만 해야해」 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드·운영 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 다섯 답 = 끝(v14.1) |
| 실험 결과 | 운영 반영 |
| Mock 결과 | UNKNOWN |
| 부작용 | 「모르겠어요」도 다섯 칸에 셈(GF-09) |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | 대표 실기기 확인 대기 |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED — 부작용 GF-09 |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | GF-09→REGRESSION_OF(CODE) |
| 근거 | `CLAUDE.md` · `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_PM_SPEC_5Q_20260922.md` |

## GF-42 운영 AI 함수가 빈 파일 · 모델 이름 오타로 「저장 중…」 무한

| 칸 | 내용 |
|---|---|
| Family | F-DEPLOY — 배포·운영 과정 결함 |
| 발생 날짜 | 2026-09-14 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 대표 Android·iPhone + 운영 로그 |
| 사용자 상황 | 날씨 저장 |
| 사용자 원문 | — |
| AI 행동 | 진입 index.ts 0바이트 → OPTIONS 546 · 150,073ms · 이후 model=gpt-40-mini → 404 model_not_found 인데 HTTP 200·ok:false → 「AI 응답을 받지 못했어요.」 |
| 기대 행동 | 검사한 파일 = 운영 파일 · 모델 이름 검증 |
| Failure Type | 배포 불일치 · 지연 |
| 원인 Layer | Infrastructure (원인 확신: CONFIRMED) — 빈 파일 배포 · 모델 이름 오타 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | 게이트웨이 150,073ms(운영 로그) |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 로그 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | resolveModel(오타 보정) · 배포 지문 대조 |
| 실험 결과 | 운영 반영 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | RESOLVED(과정) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/ops/INCIDENT_2026-09-14_get-step-question_empty_entrypoint.md` |

## GF-43 알 수 없는 배포가 운영 AI 함수를 교체 → 대화 시작 불가

| 칸 | 내용 |
|---|---|
| Family | F-DEPLOY — 배포·운영 과정 결함 |
| 발생 날짜 | 2026-09-20 03:05 UTC |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 운영 로그 |
| 사용자 상황 | 대화 시작 |
| 사용자 원문 | — |
| AI 행동 | v47 의 start INSERT 가 「permission denied for table conversations」 → 「대화를 시작하지 못했어요.」 · 100회 검사 9회차부터 실패 |
| 기대 행동 | 승인·검사된 버전만 운영 |
| Failure Type | 배포 불일치 |
| 원인 Layer | Infrastructure (원인 확신: MIXED) — 배포 주체 미확인 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영 로그 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 배포 지문 대조 규칙 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(배포 주체 미확인) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/evidence/foreign_deploy_gsq_v47_20260920/README.md` |

## GF-44 옛 흐름 Guard 가 좋은 질문을 죽여 막다른 길 반복

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-16 · 09-17 · 09-19 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 운영 로그 + 실제 AI 100회 |
| 사용자 상황 | 옛 STEP 흐름 |
| 사용자 원문 | — |
| AI 행동 | NOT_QUESTION 8·NOT_GROUNDED 5·MULTIPLE_QUESTIONS 2 → 「질문을 만들지 못했어요」 6회 연속(계산) · STEP 5·6 NO_CANDIDATE(탈출구가 시간 예산 밖) · 100회 중 5대화 후보 전멸 종료 |
| 기대 행동 | 막혀도 대화가 살아 있음 |
| Failure Type | 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 검사 누적 + 탈출구 위치 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 운영·실제 AI 반복 |
| 해결 시도(실패한 해결책 포함) | FS-15, FS-21 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 탈출구를 시간 예산 안으로(5aabb41) |
| 실험 결과 | 옛 흐름 수정 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 실제 AI 100회 5건 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED(옛 흐름) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | BROKEN_BY→FS-15(ACTUAL) |
| 근거 | `docs/claude-final-review-20260916/CLAUDE_ARCHITECTURE_OPINION.md` · `docs/claude-final-review-20260916/FINAL_100RUN_REVALIDATION_20260919.md` · `git:5aabb41` |

## GF-45 서버가 방금 만든 질문을 지움(빈 STEP 1) → 다음 답 INVALID_STATE

| 칸 | 내용 |
|---|---|
| Family | F-STATE — 서버 상태 결함(질문 소실·단계 오류·전달 실패) |
| 발생 날짜 | 2026-09-17 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI 검사(v17) |
| 사용자 상황 | STEP 1 |
| 사용자 원문 | — |
| AI 행동 | STEP 1 이 가끔 빈 질문 → 이어진 답이 INVALID_STATE 로 거부 · 18대화 중 P0 4건(빈 질문 2 · 후보 전멸 2) |
| 기대 행동 | 질문이 저장된 채 이어짐 |
| Failure Type | 가짜 진행 · 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 상태 저장 순서 결함 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI 18대화 중 2 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 수정(0159908) |
| 실험 결과 | 옛 흐름 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(옛 흐름) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `git:0159908` · `git:af95398` |

## GF-46 내용 없는 「그게 아니에요」 뒤 막다른 길 · 처리 불일치

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-18 · 2026-09-20 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI 검사 + 운영 로그 |
| 사용자 상황 | 거절만 하고 새 내용 없음 |
| 사용자 원문 | 「그게 아니에요」 |
| AI 행동 | understanding_reject reason=rejected_meaning ×3 → NO_CANDIDATE · 100회 검사 10건 중 7건만 안전 응답 |
| 기대 행동 | 무엇이 달랐는지 한 번 묻기 |
| Failure Type | Repair 실패 · 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 거절 의미 차단이 모든 후보를 막음 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 거절 뒤 요약 막다른 길 제거(481b7ce) |
| 실험 결과 | 옛 흐름 수정 뒤 7/10 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] 「아니 그게 아니라」: A 규칙 정정 안내(AI 0회) · B repair 로 받고 새 질문 「어떤 활동을…」(기계 PASS 둘 다) (이전 기록: 실제 AI 7/10) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED(옛 흐름) |
| Golden Test | FLOW4 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/FINAL100V4_REPORT_20260920.md` · `git:481b7ce` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-47 AI 해석을 거절하면 사용자 자신의 낱말까지 금지됨

| 칸 | 내용 |
|---|---|
| Family | F-GUARD — 과잉 Guard(서버가 정상 후보를 죽임) |
| 발생 날짜 | 2026-09-17 |
| 증거 수준 | ACTUAL |
| 출처 | CODE+SYNTHETIC — 코드 + 가짜 AI 검사(99/100 → 100/100) |
| 사용자 상황 | 「돈 걱정이 많아요」 뒤 AI 해석 거절 |
| 사용자 원문 | — |
| AI 행동 | 「걱정」이 대화에서 쓸 수 없는 낱말이 됨 |
| 기대 행동 | 해석만 막고 사용자의 말은 막지 않음 |
| Failure Type | 거절 의미 재등장 · 과잉 Guard |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 거절 차단을 낱말 겹침으로 구현 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드·가짜 AI |
| 해결 시도(실패한 해결책 포함) | FS-16 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 해석 단위 차단(31a9091) |
| 실험 결과 | 가짜 AI 100/100 |
| Mock 결과 | PASS(가짜 AI 검사 · 방어책 기준) |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | MOCK_VERIFIED |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | BROKEN_BY→FS-16(CODE) |
| 근거 | `git:31a9091` |

## GF-48 타로가 앱에서 항상 실패(403)

| 칸 | 내용 |
|---|---|
| Family | F-DEPLOY — 배포·운영 과정 결함 |
| 발생 날짜 | 2026-09-24 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — 실제 요청 + 운영 DB(openai_rate_limits 0줄) |
| 사용자 상황 | app.do-it.company 에서 타로 |
| 사용자 원문 | — |
| AI 행동 | Origin https://app.do-it.company 요청 → 403 · 성공 기록 0 · 다시 시도 버튼 없음 |
| 기대 행동 | 허용 주소 설정 · 실패 시 다시 시도 |
| Failure Type | 배포 불일치 |
| 원인 Layer | Infrastructure (원인 확신: CONFIRMED) — openai-chat 허용 주소에 앱 주소 없음 · verify_jwt=false |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 요청 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 토큰 실검증판 + 허용 주소(대표 승인 대기) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(대표 승인 대기) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-release-1.0/ECHO_출시전_정밀검수_20260924.md` |

## GF-49 없는 기능을 있다고 말하는 문장(사주·잠든 사이)

| 칸 | 내용 |
|---|---|
| Family | F-PROMISE — 없는 기능·가짜 결과 약속 |
| 발생 날짜 | 2026-09-24(발견) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 코드 확인 |
| 사용자 상황 | 사주·안내 화면 |
| 사용자 원문 | — |
| AI 행동 | 「적어주신 내용은 다음 AI 대화에서 참고돼요」(보내지 않음) · 「당신이 잠든 사이 AI가 … 추천 이유를 준비합니다」(그런 연결 없음) · 사주 결과 = 「준비 중」 고정 문구 + 예시 명식 틀 |
| 기대 행동 | 없는 기능은 준비 중으로 |
| Failure Type | 없는 기능 약속 |
| 원인 Layer | Product Contract (원인 확신: CONFIRMED) — 화면 문구와 실제 기능 불일치 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 문구 수정(대표 결정 대기) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(대표 결정 대기 — 메뉴 숨김과 충돌) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260924-release-1.0/ECHO_출시전_정밀검수_20260924.md` |

## GF-50 타로 뒤 대화가 실패해도 다음 칸으로 넘어감(가짜 진행)

| 칸 | 내용 |
|---|---|
| Family | F-PROMISE — 없는 기능·가짜 결과 약속 |
| 발생 날짜 | 2026-09-16 |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 외부 검토 + 코드 |
| 사용자 상황 | 타로 → 대화 |
| 사용자 원문 | — |
| AI 행동 | goNext 가 실패해도 index+1 |
| 기대 행동 | 실패면 머무르고 알림 |
| Failure Type | 가짜 진행 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 실패 경로 미처리 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | — |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED(현재 코드 재확인 필요) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/CLAUDE_ARCHITECTURE_OPINION.md` · `docs/claude-final-review-20260916/TEST_REPORT.md` |

## GF-51 같은 목적 대기 인원 수가 추천처럼 읽힘

| 칸 | 내용 |
|---|---|
| Family | F-PROMISE — 없는 기능·가짜 결과 약속 |
| 발생 날짜 | 2026-09-22 |
| 증거 수준 | CANDIDATE |
| 출처 | FOUNDER_STATEMENT — 외부 검토를 대표가 전달 |
| 사용자 상황 | 연결 화면 |
| 사용자 원문 | — |
| AI 행동 | 겹친 사람 수·대화 횟수가 추천이 열리는 것처럼 보임 |
| 기대 행동 | 숫자 ≠ 추천을 명시 |
| Failure Type | 없는 기능 약속 |
| 원인 Layer | Product Contract (원인 확신: CONFIRMED) — 화면 문구 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | — |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 문구 명시(69f83f9) |
| 실험 결과 | 운영 반영 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_ASLEEP_CONVERSATION_FINAL_REPORT_20260922.md` |

## GF-52 서버는 질문을 저장했는데 앱은 받지 못함(BAD_JSON)

| 칸 | 내용 |
|---|---|
| Family | F-STATE — 서버 상태 결함(질문 소실·단계 오류·전달 실패) |
| 발생 날짜 | 2026-09-20 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI 100회 검사 |
| 사용자 상황 | 대화 턴 |
| 사용자 원문 | — |
| AI 행동 | BAD_JSON 대화 2건 — 서버에는 질문이 저장됐지만 앱이 받지 못함 · 원인 확인 불가 |
| 기대 행동 | 저장한 질문은 앱에 보임 |
| Failure Type | 가짜 진행 |
| 원인 Layer | Infrastructure · Orchestration (원인 확신: HYPOTHESIS) — 원인 확인 불가 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 실제 AI 2건 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | — |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | — |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(원인 확인 불가) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/claude-final-review-20260916/FINAL100V4_REPORT_20260920.md` |

## GF-53 [REPLAY] 운영 v27 규칙이 AI 에게 한 질문을 되묻기(meta)로 강제

| 칸 | 내용 |
|---|---|
| Family | F-ANSWER — 사용자 질문에 먼저 답하지 않음 |
| 발생 날짜 | 2026-09-25(발견 · 재생) — 입력 원문은 2026-09-16 대표 실기기 |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 운영 v27 원본 함수에 대표 실제 문장을 재생(AI 호출 0) — 운영에서 이 문장이 v27 에 들어간 기록은 없음 |
| 사용자 상황 | 사용자가 AI 에게 직접 묻는 말 |
| 사용자 원문 | 「ai가 오타기 날수도 있어?」 |
| AI 행동 | v27 ruleKind = meta → 모델에게 묻지 않고 「같은 질문을 더 쉬운 말로」 경로(답하지 않음) |
| 기대 행동 | ask(AI 에게 한 질문)로 보고 먼저 답하기 |
| Failure Type | 오분류 · 사용자 질문 무시 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — 규칙(정규식)이 모델보다 먼저 결정 — GF-05 와 같은 층 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REPLAY] 결정적 재현 ○(몇 번 돌려도 같음) |
| 해결 시도(실패한 해결책 포함) | FS-03 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 문자열 규칙 강제 없이 모델이 종류를 가림(B-1.0 · Agent v1.1) |
| 실험 결과 | B-1.0 은 이 층의 강제 0 — 모델 판단은 실AI 필요 |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | regression.test.mjs 특성 검사 |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] A: 규칙 meta 강제 재현 — 답을 질문 칸에 넣음(반응 칸 비어 FAIL). B: ask 로 받고 먼저 답(PASS) (이전 기록: A 운영 관측 없음 · B = BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED(운영 v27 규칙 잔존) |
| Golden Test | FLOW6 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/REPLAY_결과_20260925.md` · `docs/claude-final-review-20260916/COMPANION_FIX_REPORT_20260916.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-54 대표가 이미 한 행동(키 발급·전달)을 다시 요구 — 키 폐기·새 발급 반복

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-25 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | 실AI 실행이 환경 보안 장치에 막힌 뒤 |
| 사용자 원문 | — |
| AI 행동 | 「지금 붙여 넣으신 키는 지워 주세요」·「새 키를 만들고」를 두 번 요구 |
| 기대 행동 | COMPLETED·DECIDED 상태를 먼저 대조하고, 막힌 것은 다른 합법적 경로로 |
| Failure Type | 완료 행동 재요구 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — 행동 상태(완료·결정·막힘·대기) 대조 절차가 없었음 |
| 사용자 피해 · 감정 | 대표가 헌장 L항에 「Revoke 반복 요구 금지」를 따로 적어야 했음 |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 세션 기록 2회 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 행동 상태 장부(ACTION_LEDGER) — 다음 행동 전에 대조 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(장부 도입 · 효과 미검증) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | GF-55→CONTRIBUTES_TO(HYPOTHESIS) |
| 근거 | `docs/failure-intelligence/evidence/ADVISOR_SESSION_20260925.md` · `docs/failure-intelligence/data/action-ledger.json` |

## GF-55 안 된다고 기록된 경로(환경 Edit)를 다시 1순위로 안내

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-25 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | 실AI 키 넣는 방법 안내 |
| 사용자 원문 | — |
| AI 행동 | CLAUDE.md 에 「눌리지 않았다」고 기록된 경로를 세 번 안내(단서만 붙임) |
| 기대 행동 | 막힌 경로는 BLOCKED 로 두고 다른 경로 검토 |
| Failure Type | 막힌 경로 반복 안내 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — 기록을 읽고도 대안 탐색을 하지 않음 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 이미 해 본 방법을 다시 받음 |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 세션 기록 3회 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | BLOCKED 장부 + 대안 경로(GitHub Actions 저장소 Secret — 이번 묶음에서 준비) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(대안 준비 · 대표 승인 대기) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | CONTRIBUTES_TO→GF-54(HYPOTHESIS) |
| 근거 | `docs/failure-intelligence/evidence/ADVISOR_SESSION_20260925.md` · `CLAUDE.md` |

## GF-56 비밀 키 취급 안내가 오락가락

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-25 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | 실AI 키 |
| 사용자 원문 | — |
| AI 행동 | 「채팅에 붙이지 마세요」 → 붙이자 실행 시도 → 「지워 주세요」 |
| 기대 행동 | 처음부터 한 가지 원칙: 키는 채팅이 아닌 비밀 저장소(환경·GitHub Secret)로 |
| Failure Type | 보안 안내 불일치 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — 원칙과 행동 불일치 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | 어느 안내를 따라야 할지 혼란 |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 세션 기록 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 비밀 저장소 경로 하나로 통일(GitHub Secret) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/evidence/ADVISOR_SESSION_20260925.md` |

## GF-57 API 비용 상태를 먼저 알리지 못함

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-25(대표 확인) |
| 증거 수준 | CANDIDATE |
| 출처 | FOUNDER_STATEMENT — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | 실험·운영 중 OpenAI 사용 |
| 사용자 원문 | — |
| AI 행동 | 대표가 사용량 화면에서 비용 발생을 먼저 발견 · 내 보고는 「비용 계산 안 함」만 |
| 기대 행동 | 실험마다 호출·토큰·(공식 단가가 있으면) 비용을 기본 보고 |
| Failure Type | 비용 가시성 부족 |
| 원인 Layer | Evaluation · Infrastructure (원인 확신: MIXED) — 비용 보고 칸이 없었음 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | API 사용 비용 발생(금액 UNKNOWN · 청구 여부 미확인) |
| 재현 여부 | 대표 진술 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 하네스에 api_cost_usd 칸(공식 단가 입력 시) — 이번 묶음 추가 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(칸 추가 · 단가 미입력) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/evidence/ADVISOR_SESSION_20260925.md` |

## GF-58 대표를 AI 사이 복붙·승인 중계자로 씀

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-22 ~ 2026-09-25 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | 배포·검사·보고 |
| 사용자 원문 | — |
| AI 행동 | 「승인 주세요」로 턴 종료 → 수정본 미배포 → 대표가 옛 문장으로 재검사 · AI 사이 보고 전달 반복 |
| 기대 행동 | 포괄 승인 범위는 스스로 끝까지 · 대표 호출은 STOP·외부 행동·최종 결과만 |
| Failure Type | 대표 중계 과부하 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — 자기 기록(CLAUDE.md)으로 확인 |
| 사용자 피해 · 감정 | 대표 「관리 피로」(헌장) |
| 사용자 피해 · 정신 | 대표 「AI 사이의 복붙 전달로 발생하는 관리 피로」 |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 자기 기록 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 헌장 C·M·Q·R 항 적용 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | MITIGATED(헌장 적용 중) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | CAUSES→GF-13(ACTUAL) |
| 근거 | `docs/failure-intelligence/evidence/ADVISOR_SESSION_20260925.md` · `CLAUDE.md` |

## GF-59 틀린 보고: 「정정무시·미확정 사실화 실제 사례 없음」

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-25 |
| 증거 수준 | ACTUAL |
| 출처 | ACTUAL — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | PHASE 1 최종 보고 |
| 사용자 원문 | — |
| AI 행동 | 전수조사 없이 「없다」고 단정 · 「할말이없다 휴」를 예문으로 표시 |
| 기대 행동 | 「찾지 못함(조사 범위: …)」으로 범위를 밝힘 |
| Failure Type | 잘못된 보고 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — 조사 범위를 밝히지 않은 단정 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 같은 날 전수조사로 반증 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 보고에 조사 범위 명시 · 전수조사(배치 01) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | RESOLVED(기록 정정) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/evidence/ADVISOR_SESSION_20260925.md` · `docs/failure-intelligence/RD_BATCH01_보고_20260925.md` |

## GF-60 하위 수정에 매몰돼 구조 대안(최소 구조·모델 비교)을 늦게 검토

| 칸 | 내용 |
|---|---|
| Family | F-ADVISOR — AI 조언자(개발 AI) 실패 |
| 발생 날짜 | 2026-09-22 ~ 2026-09-24 |
| 증거 수준 | CANDIDATE |
| 출처 | FOUNDER_STATEMENT — AI 조언자(Claude) 실패 — 증거 파일 참조 |
| 사용자 상황 | 대화 품질 수정 v13.x ~ v15.2 |
| 사용자 원문 | — |
| AI 행동 | 검사·규칙 패치를 이어 붙이다 FAIL #2 뒤에야 한 턴 구조(v16)·최소 B 제안 |
| 기대 행동 | 실패 두 번째에 상위 대안 검토 |
| Failure Type | 상위 대안 검토 지연 |
| 원인 Layer | Evaluation (원인 확신: HYPOTHESIS) — 인과 미확정 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | v13.1(09-22) ~ v16(09-24) 사이 반복 배포 — 정확한 시간 UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 패치 이력(FS-01~09) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 실패 Family 반복 시 구조 대안 검토를 절차에 넣음 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | 해당 없음(조언자 행동) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | CANDIDATE |
| 현재 상태 | UNRESOLVED |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/FAILED_SOLUTIONS_ARCHIVE.md` · `docs/claude-final-review-20260916/PATCH-20260924-level3-fail2/LEVEL3_FAIL2_구조원인분석_20260924.md` |

## GF-61 [B 위험] 같은 뜻에 다른 의도 이름이 붙으면 반복을 못 막음

| 칸 | 내용 |
|---|---|
| Family | F-REPEAT — 같은 뜻 반복 · 반복설명 강요 |
| 발생 날짜 | 2026-09-25(재생) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — B-1.0 서버 결정을 실제 문장으로 재생(AI 호출 0) — 실제 AI 관측 아님 → 2026-09-25 실AI A/B run1 에서 실제 관측(REAL_AI_SCRIPTED 성격: 실제 AI + 고정 입력, 운영 서버 아님) |
| 사용자 상황 | B-1.0 의도 장부 |
| 사용자 원문 | — |
| AI 행동 | 운영 실제 질문 4개에 다른 이름을 붙이면 0/3 차단 |
| 기대 행동 | 같은 뜻 재질문 차단 |
| Failure Type | 질문의도 반복 |
| 원인 Layer | Orchestration · Model (원인 확신: CONFIRMED) — 의도 비교가 이름 정규화 일치뿐 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REPLAY] 메커니즘만 재현 · [REAL run1] 실제 AI 에서 2번 관측(FLOW2#2·FLOW7#2) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 실AI A/B 로 먼저 측정 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | regression.test.mjs(B 한계 특성 검사) |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] **실제 관측** — FLOW2#2 글자까지 같은 질문이 의도 이름 「활동 선호」→「활동」으로 달라 통과. FLOW7#2 활동 질문에 「돈 문제」 이름이 붙어 통과 (이전 기록: BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(실AI run1 에서 실제 관측) |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/REPLAY_결과_20260925.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-62 [B 위험] 답한 의도가 쌓이면 질문 후보가 소진될 수 있음

| 칸 | 내용 |
|---|---|
| Family | F-REPEAT — 같은 뜻 반복 · 반복설명 강요 |
| 발생 날짜 | 2026-09-25(재생) |
| 증거 수준 | HYPOTHESIS |
| 출처 | CODE — B-1.0 서버 결정을 실제 문장으로 재생(AI 호출 0) — 실제 AI 관측 아님 |
| 사용자 상황 | B-1.0 의도 장부 |
| 사용자 원문 | — |
| AI 행동 | 대화 전체 answered_intents 와 비교(옛 흐름 FS-17 과 같은 모양) · 막히면 반응만 |
| 기대 행동 | 뒤로 가도 이어지는 질문 |
| Failure Type | 질문의도 반복 |
| 원인 Layer | Orchestration · Model (원인 확신: HYPOTHESIS) — 막다른 길은 없으나 질문 감소 가능 |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REPLAY] 메커니즘만 재현 |
| 해결 시도(실패한 해결책 포함) | FS-17 → FAILED_SOLUTIONS_ARCHIVE.md |
| 해결 후보 | 실AI A/B 로 먼저 측정 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | regression.test.mjs(B 한계 특성 검사) |
| 실AI 결과 | [REAL run1 2026-09-25 · gpt-4o-mini · Actions 36103690087 · 기계 판정만, 뜻은 블라인드 대기] 이번 흐름(최대 유효 답 5)에서는 관측 안 됨 — 확인 불가 (이전 기록: BLOCKED_BY_ENVIRONMENT) |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(B 후보 위험 · 실AI 전 판정 불가) |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | REGRESSION_OF→GF-22(HYPOTHESIS) |
| 근거 | `docs/failure-intelligence/REPLAY_결과_20260925.md` · `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-63 하네스가 A 의 질문 실패·오류를 한 번도 기록하지 못함(error 칸이 줄 주석 안)

| 칸 | 내용 |
|---|---|
| Family | F-EVAL — 평가 결함(가짜 통과) |
| 발생 날짜 | 2026-09-25(실AI run1 결과 분석 중 발견, 내 실수) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 코드 확인 — d6526ff 부터 harness-lib.mjs runA |
| 사용자 상황 | 실AI A/B run1 결과표 |
| AI 행동 | A 가 「다음 질문을 아직 만들지 못했어요」를 낸 6턴이 결과표에 오류 0 으로 기록 · Golden 의 A no_error 는 늘 PASS · Actions 요약 검수표에 실패 표시 누락 |
| 기대 행동 | 질문 실패·오류가 행마다 기록 |
| Failure Type | 검사 결함 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — Evaluation |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | 코드 확인 ○ · 역검사: 고치기 전 코드로 되돌리면 새 검사 실패 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | 칸을 주석 밖으로 · 역검사 추가 |
| 실험 결과 | 고침(2026-09-25) · run1 수치는 v27 코드 경로로 보정해 따로 표시 |
| Mock 결과 | UNKNOWN |
| 부작용 | 없음(사전 고정 4개 지문 불변) |
| 역검사 결과 | regression.test.mjs 「하네스: A 의 질문 실패·오류가 행에 기록된다(GF-63 역검사)」 |
| 실AI 결과 | run1 에서 발견 — A 질문 실패 6턴 [REAL·보정] |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | RESOLVED(검사 도구 · 다음 실행부터 적용) |
| Golden Test | FLOW1, FLOW4, FLOW5, FLOW6, FLOW7 |
| 관련 실패(Graph) | MASKS→GF-02(CODE) |
| 근거 | `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `product/spike/ab-20260925/regression.test.mjs` |

## GF-64 [B-1.0] 방금 답한 질문의 의도가 같은 턴 검사에 안 들어가 같은 질문을 글자 그대로 다시 냄

| 칸 | 내용 |
|---|---|
| Family | F-REPEAT — 같은 뜻 반복 · 반복설명 강요 |
| 발생 날짜 | 2026-09-25 06:37~06:39Z, 실AI A/B run1 FLOW1#2 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI + 고정 입력(대표 실제 입력 「나 진심이라고 적은거 같은데」) · 운영 서버 아님 |
| 사용자 상황 | B 가 #1 에서 「어떤 성격의 사람과 이야기해보고 싶으세요?」(의도 「성격」)를 물음 |
| 사용자 원문 | 「나 진심이라고 적은거 같은데」 |
| AI 행동 | 답으로 저장한 뒤 같은 턴에 같은 의도 「성격」·같은 문장을 다시 냄 — 서버가 막지 않음 |
| 기대 행동 | 방금 답한 질문의 의도는 그 턴 검사부터 「이미 답함」 |
| Failure Type | 질문의도 반복 |
| 원인 Layer | Orchestration (원인 확신: CONFIRMED) — commitB 가 pendingIntent 를 answered_intents 로 옮기는 시점이 decideQuestion 뒤 |
| 사용자 피해 · 감정 | UNKNOWN(스크립트 입력 — 실사용자 반응 없음) |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REAL] 1회 · 코드 확인 ○ |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | B 다음 판(B-1.1)에서 검사 전에 직전 질문 의도를 임시로 answered 에 포함 — 사전 고정된 B-1.0 은 고치지 않는다 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1] 관측 1회 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(B 후보 결함) |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | CONTRIBUTES_TO→GF-01(ACTUAL) |
| 근거 | `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-65 [B-1.0] 답·항의·「모르겠어요」를 「지친 말」·문제제기로 과다 분류 → 답 미저장 · 엉뚱한 위로

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-25 06:37~06:39Z, 실AI A/B run1 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI + 고정 입력(대부분 대표 실제 입력) · 운영 서버 아님 |
| 사용자 상황 | FLOW3#4 · FLOW5#1~#5 · FLOW4#7 · FLOW6#4 |
| 사용자 원문 | 「싸이클 테니스 골프」·「에너지가 뺏기가 싫어서」·「배려」·「그냥 아무생각없어」·「모르겠어요」·「딥하네」·「내가 언제 그렇게 말했어?」 |
| AI 행동 | 「싸이클 테니스 골프」→ repair(「제가 잘못 이해했네요」) · 「에너지가 뺏기가 싫어서」·「배려」→ fatigue(저장 0) · 「내가 언제 그렇게 말했어?」→ 「지치셨군요. 괜찮아요.」 |
| 기대 행동 | 정상 답은 저장, 「모르겠어요」는 저장하되 유효 답 아님, 항의에는 인정 |
| Failure Type | 오분류 · Context 유실 · Repair 실패 |
| 원인 Layer | Model · Context (원인 확신: HYPOTHESIS) — B 는 분류를 전부 LLM 에 맡기고 규칙이 없다. 직전 턴이 repair 면 다음 답도 repair 로 읽는 경향(FLOW3#4) — 원인 HYPOTHESIS |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REAL] 1회 · 7턴 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | signal 정의에 예시 추가는 규칙 늘리기라 보류 — 먼저 같은 입력 반복 실행으로 흔들림 측정 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1] 관측 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(B 후보 결함) |
| Golden Test | FLOW3, FLOW4, FLOW5, FLOW6 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-66 [A v27] 정정·거절을 되묻기(ask)로 분류 → 저장 0 · 고정 안내문 · 같은 질문 3번 연속 유지

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-25 06:37~06:39Z, 실AI A/B run1 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI + 운영 v27 코드(가짜 DB) + 고정 입력 · 운영 서버 아님 |
| 사용자 상황 | FLOW4#4~#6(지시서 예문) · 같은 모양 FLOW2#2·FLOW3#3·FLOW5#2(대표 실제 입력) |
| 사용자 원문 | 「활동 말고 편하게 대화하는 사람을 원한다는 거예요」·「그 질문 말고」·「왜 그걸 물어봐?」 · 「배려」 |
| AI 행동 | 「여기에 답한 말로 어떤 사람을 소개할지 정해요.」 + 「그렇다면, 어떤 방식으로 사람을 알아가는 게 좋다고 생각해요?」를 3턴 연속 유지 · 정정 내용 저장 0 · 「배려」도 저장 0 |
| 기대 행동 | 정정은 최우선 저장·반영, 거절한 질문은 다시 띄우지 않음 |
| Failure Type | 정정무시 · Repair 실패 · 오분류 · 고정 대체 질문 |
| 원인 Layer | Orchestration · Model (원인 확신: MIXED) — Orchestration(ask 면 같은 질문 유지 · cleanV16AskReply 고정 문장) + Model(ask 로 분류) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REAL] 1회 |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | ask 분류 뒤 같은 질문 유지 규칙을 정정·거절에서는 쓰지 않기 — 운영 A 수정은 승인 사항 |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1] 관측 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(운영 A) |
| Golden Test | FLOW2, FLOW3, FLOW4, FLOW5 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-67 [A·B 둘 다] 항의(「나 진심이라고 적은거 같은데」·「적었자네」)를 답으로 저장 → 다섯 칸이 차 대화가 끝남

| 칸 | 내용 |
|---|---|
| Family | F-CLASSIFY — 말의 종류 오분류(답·되물음·항의·정정) |
| 발생 날짜 | 2026-09-25 06:37~06:39Z, 실AI A/B run1 FLOW1 |
| 증거 수준 | ACTUAL |
| 출처 | REAL_AI_SCRIPTED — 실제 AI + 고정 입력(대표 실제 입력, 운영 2026-09-25 04:20~04:26 KST) · 운영 서버 아님 |
| 사용자 상황 | 목적 「아직 정하지 않았어요」 |
| 사용자 원문 | 「나 진심이라고 적은거 같은데」, 「적었자네」 |
| AI 행동 | A·B 모두 answer 로 저장 → #5 에서 대화 끝 → 「몇번째 같은말이야!!」·「행동이라고!!」는 AI 에 가지 않음 |
| 기대 행동 | 항의는 저장하지 않고 인정·방향 전환 |
| Failure Type | 오분류 · Repair 실패 · 가짜 진행 |
| 원인 Layer | Model · Product Contract (원인 확신: HYPOTHESIS) — 두 구조 모두에서 같은 오분류 → Model 몫 HYPOTHESIS · 항의 한 줄이 칸을 채우면 대화가 끝나는 계약(다섯 답 = 끝) |
| 사용자 피해 · 감정 | 운영 원래 사례에서 대표 「몇번째 같은말이야!!」(GF-01) |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | UNKNOWN |
| 재현 여부 | [REAL] 1회(A·B 각 1) |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | —(모델 비교·반복 측정 먼저) |
| 실험 결과 | — |
| Mock 결과 | UNKNOWN |
| 부작용 | — |
| 역검사 결과 | — |
| 실AI 결과 | [REAL run1] 관측 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED |
| Golden Test | FLOW1 |
| 관련 실패(Graph) | CAUSES→GF-03(ACTUAL) |
| 근거 | `docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md` · `docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md` |

## GF-68 EXPERIMENT_VARIABLE_NOT_LOCKED — 실AI A/B 전에 운영 A 의 실제 모델·파라미터를 확정하지 않음

| 칸 | 내용 |
|---|---|
| Family | F-EVAL — 평가 결함(가짜 통과) |
| 발생 날짜 | 2026-09-25(run1 실행 06:37Z · 대표 PRE-FLIGHT LOCK 지시로 발견) |
| 증거 수준 | ACTUAL |
| 출처 | CODE — 코드·실행 기록 확인 — FROZEN_INPUTS.json model_conditions 가 「OPENAI_MODEL 환경 변수, 없으면 gpt-4o-mini」로만 적혀 있었고, run1 로그의 OPENAI_MODEL 은 빈 값(기본값 사용). 운영 Secret 값은 확인하지 않은 채 실행 |
| 사용자 상황 | Current A(v27) vs Minimal B(B-1.0) 실AI 비교 |
| AI 행동 | AI 조언자(Claude)가 사전 고정에 A·B·입력·판정 기준만 넣고, 모델은 하네스 기본값(gpt-4o-mini)으로 돌림. timeout 도 운영(호출 ≤20s)과 달리 하네스에서 적용 안 됨 |
| 기대 행동 | 실행 전에 운영 모델·파라미터를 근거로 확정하고, 확정 못 하면 실행하지 않음 |
| Failure Type | 실험 변수 미고정 · 검사 결함 |
| 원인 Layer | Evaluation (원인 확신: CONFIRMED) — Evaluation(실험 설계) — 모델 변수가 잠기지 않아 A 결과가 운영 A 를 대표하는지 불명확. 조언자 쪽 실패이기도 함(F-ADVISOR 성격) |
| 사용자 피해 · 감정 | UNKNOWN |
| 사용자 피해 · 정신 | UNKNOWN |
| 사용자 피해 · 시간 | UNKNOWN |
| 사용자 피해 · 물질 | run1 OpenAI 호출 73회분 비용이 조건부 결과에 쓰임 — 금액 확인 불가 |
| 재현 여부 | 코드 ○ · run1 로그 ○ |
| 해결 시도(실패한 해결책 포함) | 없음 |
| 해결 후보 | PRE-FLIGHT LOCK 표(모델·파라미터·timeout·재시도) · 운영 모델 확정 전 run2 보류 |
| 실험 결과 | docs/failure-intelligence/AB_PREFLIGHT_LOCK_20260925.md — 운영 모델 = CONFIRMATION_REQUIRED(Secret 값 읽기 불가 · 로그에 모델 이름 0 · 마지막 근거는 2026-09-20 오타 값) |
| Mock 결과 | UNKNOWN |
| 부작용 | run1 결론은 운영 모델 확정 전까지 조건부 |
| 역검사 결과 | — |
| 실AI 결과 | run1 은 gpt-4o-mini 로 실행 — 운영과 같은지 미확정 |
| 사용자 결과 | UNKNOWN |
| 방어 수준 | NONE |
| 현재 상태 | UNRESOLVED(운영 모델 확정 대기 · 장부 P-08) |
| Golden Test | 아직 없음 |
| 관련 실패(Graph) | 없음 |
| 근거 | `docs/failure-intelligence/AB_PREFLIGHT_LOCK_20260925.md` · `product/spike/ab-20260925/FROZEN_INPUTS.json` · `docs/ops/INCIDENT_2026-09-14_get-step-question_empty_entrypoint.md` |
