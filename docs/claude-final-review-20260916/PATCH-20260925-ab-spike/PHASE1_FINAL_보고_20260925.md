# B안 PHASE 1 최종 보고 — 자율 실행 범위 (2026-09-25)

## 1. 결론
- **실제 AI A/B: 확인 불가.** `REAL_AI = BLOCKED_BY_ENVIRONMENT`.
  - 이 작업 환경 변수에 `OPENAI_API_KEY` 가 없다.
  - 채팅으로 받은 키는 환경 보안 장치가 실행을 막았다(2026-09-25). 우회하지 않았다.
- 그 밖의 작업은 모두 끝냈다.
  - Failure Intelligence 자산(8개 구성)
  - 입력 사전 고정
  - 실제 문장 재생(Replay)
  - 회귀 검사와 역검사
  - 블라인드 집계 도구
- 판정
  - B WIN = **확인 불가**
  - Conversation P0 = **FAIL 유지**
  - 운영 변경 = **0**

## 2. 실제로 한 작업
- `docs/failure-intelligence/` 를 새로 만들었다.
  - README · FAILURE_LIBRARY(21건) · FAILURE_TAXONOMY · FAILED_SOLUTIONS_ARCHIVE(13건) · VERIFIED_ENGINES · MODEL_CAPABILITY_REGISTRY · REPLAY_결과
- `product/spike/ab-20260925/` (배포 경로 밖)
  - `golden-failures.json`: 고정 입력 26개, ACTUAL 17개. 입력마다 출처와 근거 문서가 붙어 있다.
    - FLOW5(v13.7~v14.3 운영 입력 5개)를 새로 넣었다.
  - `FROZEN_INPUTS.json`: A·B·입력의 SHA-256 을 사전에 고정했다.
    - A = `1aab6423…`, B-1.0 = `a0031fcc…`, 입력 = `e070dff8…`.
  - `harness-lib.mjs`: 하네스 공용 부품을 분리했다.
  - `run-ab.mjs`
    - `--require-real` 을 추가했다. 키가 없으면 가짜로 돌지 않고 BLOCKED 를 적는다.
    - `--flows` 를 추가했다.
    - 결과에 입력 지문을 적는다.
  - `replay-decisions.mjs`: 운영 실제 문장을 A v27 원본 함수와 B 서버 결정에 그대로 넣는다. AI 호출은 0이다.
  - `score-blind.mjs`: 대표가 고른 칸만 세어 열쇠로 A/B 를 되돌린다.
  - `regression.test.mjs`: 사전 고정, 입력 형식, 재생 특성, 집계를 검사한다.
- B-1.0 은 바꾸지 않았다(지문 `a0031fcc…` 그대로). A 도 바꾸지 않았다.

## 3. 발견된 실패
- **[REPLAY] GF-01 을 A 코드로 재현했다.**
  - 운영에서 나간 같은 뜻 질문 4개를 v27 반복 검사가 모두 통과시킨다(최대 sim 0.39 / overlap 0.59, 기준 0.6 / 0.7).
- **[REPLAY] B-1.0 의 한계를 드러냈다.**
  - 모델이 같은 뜻에 같은 의도 이름을 붙이면 3/3 을 막는다.
  - 다른 이름을 붙이면 0/3 이다(미탐).
  - 어느 쪽인지는 실제 AI 로만 알 수 있다. **[HEURISTIC / EXPERIMENT ONLY]**
- **[REPLAY] A v27 규칙 층**
  - 「취미생활?」 → meta 로 강제된다(GF-05 재현).
  - 「딥하네」·「활동?질문이 머이래」 → meta(GF-14 는 규칙 추가로 완화된 상태).
  - 질문 방향 제안 문장은 규칙이 못 잡는다. ask 로 가면 고정 사실문 「저는 DO IT의 AI예요…」가 나갈 수 있다(GF-06).
- **증거가 없는 유형이 있다.**
  - 「정정무시」·「미확정 사실화」는 저장소에서 날짜·원문이 있는 실제 사례를 찾지 못했다.
  - ACTUAL 로 만들지 않았다.

## 4. 새로 자산화된 Failure Intelligence
- Library 21건(v1 9건 → 21건). 칸은 16개다.
  - 출처별: ACTUAL 16 · 코드 확인 3 · SYNTHETIC 포함 2.
  - 상태별: UNRESOLVED 12 · MITIGATED 7 · RESOLVED 2(검사 도구·배포 과정) · **VERIFIED 0**.
- Taxonomy: 원인 Layer 6 · Failure Type 17 · 상태 lifecycle.
- Failed Solutions 13건. 모두 지우지 않았다. 내 수정(v15.2 `ackGrounded`)이 점프를 통과시킨 건(FS-08)도 포함했다.
- Verified Engines: VERIFIED 0, 후보 8(모두 EXPERIMENTED).
- Model Capability Registry
  - gpt-4o-mini 관측 4개는 모두 불리한 입력·서버 검사와 섞여 있다. 모델 탓으로 분리되지 않는다.
  - Claude·Gemini 는 미관측이다.

## 5. A/B 결과
- 실제 AI A/B 는 확인 불가다.
- [MOCK]·[REPLAY] 결과만 있다. 승자는 선언하지 않는다.

## 6. 실제 AI 결과
- 이번 실행: 0회(BLOCKED_BY_ENVIRONMENT).
- 참고로 이전 운영 실측(A, 실제 AI, Galaxy 11턴)이 있다.
  - 질문 생성 실패 2/11 턴.
  - 같은 뜻 질문 4개.

## 7. Mock 결과
- [MOCK] 26턴(가짜 AI, 구조 확인용)
  - 객관 FAIL: A 0 · B 0.
  - 재시도: 0 · 0.
- B 서버 결정 검사 [MOCK] 14/14 통과.
- 회귀 검사(AI 호출 0) 5/5 통과.

## 8. 역검사 결과
- 회귀 검사를 일부러 7군데 망가뜨렸다. **처음에는 6/7 만 잡았다.**
  - 놓친 곳: 「집계에서 A/B 뒤집기」. 내 검사 데이터가 대칭이어서 뒤집어도 합이 같았다.
  - 검사 데이터를 비대칭으로 고친 뒤 **7/7** 을 잡았다.
- 망가뜨린 7곳
  - 입력 몰래 변경
  - ACTUAL 근거 삭제
  - Library 항목 누락
  - 재생 기준 조작
  - B 의도 차단 제거
  - 집계 뒤집기
  - 두 칸 표시 허용
- 원본 복구는 파일 단위 cmp 로 확인했다.
- B-1.0 검사 역검사는 PHASE 1 에서 7/7 이었다.

## 9. Calls / Tokens / Latency
- 실제 AI: 확인 불가.
- [MOCK] 26턴

| 항목 | A | B |
|---|---|---|
| LLM 을 부른 턴 | 24 | 26 |
| 호출 | 24 | 26 |
| 입력 토큰(o200k) | 42,997 | 25,310 (−41.1%) |
| system 토큰 / 호출 | 1,492 | 702 |

- usage 토큰과 지연은 MOCK 에서 판정하지 않는다.
- 비용은 계산하지 않았다(공식 가격표와 실제 모델명을 확인하지 않음).
- 운영 A 실측(실제 AI, n=11): 턴 중앙값 2,967ms, LLM 중앙값 2,100ms.

## 10. B WIN 여부
- **확인 불가.**
- Model Comparison 필요 = **NO**(A·B 모두 실제 AI 로 약하다는 근거가 아직 없다).
- 기술스택 교체 필요 = **NO**(인프라 장애 증거 0).

## 11. 남은 위험
- 채팅에 올라온 테스트 키는 대화 기록에 남아 있다. 폐기가 필요하다.
- B 의도 비교의 미탐은 실제 AI 로만 판정된다.
- 문자열 규칙을 걷어 낸 B 는 되물음을 답으로 저장할 수 있다(GF-11 방향의 위험).
- 운영 v27 의 알려진 실패(GF-01·02·03·05·06)는 그대로다(운영 변경 0).

## 12. 운영 변경 여부
- **0.**
  - DB·RLS·Auth·Secret·모델·Edge Function·Netlify·결제·가격·KEY·UI·전화 인증·음악 변경 0.
  - 제품 src 변경 0.
  - 파일 삭제 0. 이번 작업 중 내가 만든 임시 파일 2개만 지웠다.

## 13. 대표가 해야 할 일 (1개)
- 이 문서에는 적지 않고, 채팅 보고에 클릭 순서로 적는다.
