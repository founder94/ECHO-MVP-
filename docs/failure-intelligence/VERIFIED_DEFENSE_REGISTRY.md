# Verified Defense Registry (v1 · 2026-09-25)

실패를 막는 방어책(Defense)의 **현재 증거 수준**을 적는다. 증명되지 않은 방어책을 독자 기술이라고 부르지 않는다.

- 증거 수준(차례대로만 올린다): `HYPOTHESIS` → `CANDIDATE` → `MOCK_VERIFIED` → `REAL_AI_VERIFIED` → `USER_VERIFIED`
  - `MOCK_VERIFIED` = 가짜 AI 검사 + 역검사(방어책을 일부러 지우면 검사가 실패)를 통과. **실제 AI 통과가 아니다.**
  - `REAL_AI_VERIFIED` = 고정 입력(Golden)을 실제 AI 로 돌린 결과와 블라인드 검수 근거가 있어야 한다.
  - `USER_VERIFIED` = 실사용자·대표 실기기 근거가 있어야 한다.
- **현재 REAL_AI_VERIFIED 0 · USER_VERIFIED 0.** 실제 AI A/B run1(2026-09-25, gpt-4o-mini, 1회)은 기계 판정만 있고 블라인드 검수 전이라 승격하지 않았다(`REAL_AB_RUN1_분석_20260925.md`).
- 데이터 검사(`product/spike/failure-intelligence/fi.test.mjs`)가 근거 파일 없는 승격을 막는다.

| 방어책 | 막으려는 실패 | 위치 | 증거 수준 | [MOCK] | 역검사 | [REPLAY] 실제 문장 | [REAL] | 알려진 한계 |
|---|---|---|---|---|---|---|---|---|
| 질문 의도 장부(답한 의도·거절 의도 — 정규화 뒤 같을 때만 차단) | GF-01 · GF-06 · GF-07 | B-1.0 `decideQuestion` | MOCK_VERIFIED | 통과 | 통과 | 같은 이름 3/3 차단 · **다른 이름 0/3** | [REAL run1] 이름이 달라 같은 질문 통과 2(FLOW2#2 글자까지 같음·FLOW7#2 잘못 붙임) · 방금 답한 의도가 같은 턴 검사에 없어 같은 질문 1(GF-64) → **목표 미달** | [HEURISTIC / EXPERIMENT ONLY] 모델이 이름을 다르게 붙이면 미탐 · **대화 전체와 비교하는 모양이 옛 흐름의 실패한 해결책 FS-17(의도 태그 소진 → 막다른 길)과 같다** — B 는 막히면 질문 없이 반응만 보내 막다른 길은 없지만, 뒤로 갈수록 질문이 줄어드는지는 실AI 로 확인해야 함 |
| 문제제기 → 직전 질문 의도 즉시 거절(같은 턴 재시도에도) | GF-03 · GF-06 | B-1.0 `runBTurn` | MOCK_VERIFIED | 통과 | 통과 | — | [REAL run1] 거절 의도 차단 1(FLOW4#2) · 그러나 FLOW2#2 는 이름이 달라 통과 · 항의를 지친 말로 읽으면 작동 안 함(GF-65) | 질문을 해 달라는 말을 repair 로 읽으면 질문이 사라짐 |
| 질문 선택사항(막히면 반응만 · question=null 정상) | GF-02 · GF-03 · GF-07 · GF-10 | B-1.0 | MOCK_VERIFIED | 통과 | 통과(누수 검사 포함) | — | [REAL run1] 앱 실패 안내 0(A 는 6) · 반응만 보낸 턴 4 · **대표 블라인드: 정정·거절 뒤 반응만 보낸 2칸 모두 A 선택 → 목표 미달(GF-70·FS-22)** | 대화가 멈춘 느낌 — 블라인드 검수 필요 |
| 최근 대화(저장 안 한 말 포함) 전달 · 남은 수·주제 제거 | GF-04 · GF-08 | B-1.0 `buildBInput` · Agent v1.1(운영 미배포) | MOCK_VERIFIED | 통과 | 입력 금지 항목 검사 | — | [REAL run1] 주제·남은 수가 없어도 「활동」 점프(GF-08) → 이것만으로는 못 막음 | 주제가 없으면 연결 재료가 덜 모일 수 있음 |
| 「모르겠어요」 유효 답 제외 | GF-09 | B-1.0 `commitB` · 연결 자격(v15.1 운영) | MOCK_VERIFIED | 통과 | 통과 | — | [REAL run1] B 가 「모르겠어요」류를 지친 말로 분류해 저장 자체를 안 함(GF-65) | 대화 끝 판정 변경은 대표 결정 대기 |
| 문자열 분류 규칙 없이 모델이 말의 종류를 가림 | GF-05 · GF-14 · GF-18 | B-1.0 | CANDIDATE | 통과(가짜 AI 가 정답을 줌) | — | 규칙 강제 0(A 는 애매한 짧은 물음표 8/8 강제) | [REAL run1] 규칙 강제 0 · 대신 모델 오분류 관측(답·항의 → 지친 말 GF-65, 항의 → 답 GF-67) | 모델이 되물음을 답으로 저장할 위험(GF-11 방향) |
| 재생 입력 사전 고정(FROZEN_INPUTS) | GF-15 | `product/spike/ab-20260925/` | MOCK_VERIFIED | 통과 | 입력 몰래 변경 시 실패 | — | — | 평가 도구(대화 품질 방어책 아님) |
| 운영 파일 SHA-256 대조 | GF-20 | 배포 절차 | 운영 실측(과정) | — | — | — | — | AI 방어책 아님 |
| Failure Compiler(말 → 검사 명세 후보, 사람 승인 필수) | GF-15 · 대표 중계 부담 | `product/spike/failure-intelligence/failure-compiler.mjs` | CANDIDATE | 가짜 AI 검사 통과 | 지어낸 인용·체계 밖 값 걸러 냄 | — | 미실행(이번 run 범위 밖) | 모델 품질 미확인 · 확정은 사람만 |
