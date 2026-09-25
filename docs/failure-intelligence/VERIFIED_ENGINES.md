# Verified Engines (v1 · 2026-09-25)

**VERIFIED = 0개.** 아래는 모두 **후보(EXPERIMENTED)**다. 독자 기술이라고 부르지 않는다.
VERIFIED 조건: 재현 → 원인 분리 → 해결 실험 → 정상 사례 역검사 → **실제 AI Replay 통과**(`FAILURE_TAXONOMY.md` §3).

| 후보 | 막으려는 실패 | 위치 | [MOCK] | 역검사 | [REPLAY] | [REAL] | 상태 |
|---|---|---|---|---|---|---|---|
| 질문 의도 장부(답한 의도·거절 의도, 정규화 같음만 차단) | GF-01, GF-06, GF-07 | B-1.0 `decideQuestion` | 통과 | 통과(제거 시 실패) | 같은 이름 3/3 차단 · **다른 이름 0/3**(미탐) | BLOCKED_BY_ENVIRONMENT | EXPERIMENTED · [HEURISTIC / EXPERIMENT ONLY] |
| Repair → 직전 질문 의도 즉시 거절(같은 턴 재시도에도 반영) | GF-03, GF-06 | B-1.0 `runBTurn` | 통과 | 통과 | — | BLOCKED | EXPERIMENTED |
| 질문 선택사항(막히면 반응만, question=null 정상) | GF-02, GF-03, GF-07, GF-10 | B-1.0 | 통과 | 통과(누수 검사 포함) | — | BLOCKED | EXPERIMENTED |
| 최근 대화(저장 안 한 말 포함) 전달 · 남은 수/주제 제거 | GF-04, GF-08 | B-1.0 `buildBInput` · Agent v1.1(운영 미배포) | 통과 | 입력 금지 항목 검사 | — | BLOCKED | EXPERIMENTED |
| 「모르겠어요」 유효 답 제외 | GF-09 | B-1.0 `commitB` · 연결 자격(v15.1 운영) | 통과 | 통과 | — | 해당 없음 | EXPERIMENTED(대화 끝 판정은 대표 결정 대기) |
| 문자열 분류 규칙 없이 모델이 종류 판단 | GF-05, GF-14, GF-18 | B-1.0 | 통과 | — | — | BLOCKED | EXPERIMENTED(GF-11 반대 방향 위험) |
| 배포 뒤 운영 파일 SHA-256 대조 | GF-20 | 배포 절차 | — | — | — | 운영 실측 | RESOLVED(과정) — AI 엔진 아님 |
| 사전 고정(FROZEN_INPUTS) + 실제 문장 Replay | GF-15 | `product/spike/ab-20260925/` | 통과 | 특성 검사 | 구축 | BLOCKED | EXPERIMENTED(평가 도구) |
