# 행동 상태 장부 — COMPLETED · DECIDED · BLOCKED · PENDING (2026-09-25)

> `docs/failure-intelligence/data/action-ledger.json` 에서 생성. 다음 행동을 만들기 전에 반드시 대조한다(저장 MASTER 3·24항).

- COMPLETED 를 대표에게 다시 요구하지 않는다. 다시 요구하면 새 실패(F-ADVISOR)로 기록한다.
- DECIDED 를 다시 묻지 않는다.
- BLOCKED 를 같은 방식으로 반복하지 않는다. 다른 합법적 경로를 찾되 보안 장치는 우회하지 않는다.
- PENDING 중 가장 중요한 다음 행동 하나를 고른다.

## COMPLETED (6)

| ID | 무엇 | 날짜 | 누가·무엇이 | 근거 | 메모 |
|---|---|---|---|---|---|
| A-01 | OpenAI 실험 키 ECHO-B-AB-TEST-20260925 발급 | 2026-09-25 | 대표 | 대표 「대표 승인 · ECHO B안 실AI A/B 검증」 | 다시 요구 금지 |
| A-02 | 실험 키를 Claude 채팅으로 전달 | 2026-09-25 | 대표 | 같은 지시 | 키는 저장·출력하지 않음 |
| A-10 | GitHub 재연결 | 2026-09-25 | 대표 | CLAUDE.md(GitHub push STOP 기록) · 이후 push 정상 |  |
| P-01 | 실제 AI A/B(고정 하네스) | 2026-09-25 | 대표 승인 + GitHub Actions | docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md · run 36103690087 | 실AI A/B run1 완료(종료 코드 0 · 사전 고정 일치). 다시 요구 금지. 추가 실행은 새 행동으로 기록 |
| A-11 | GitHub 저장소 Secret OPENAI_API_KEY_AB_TEST 등록 | 2026-09-25 | 대표 | 대표 「대표 승인 · 실AI A/B 실행 시작」 · run 36103690087 로그의 OPENAI_API_KEY: *** | 다시 요구 금지 · 키 값은 저장·출력하지 않음 |
| P-07 | 실AI run1 P0 블라인드 검수(17칸 · 누르기만) | 2026-09-25 | 대표(휴대폰 페이지에서 17칸 선택) | docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/P0_BLIND_RESULT_RUN1.md | A 7 · B-1.0 8 · 둘 다 별로 2 → B WIN = NO · P0 FAIL. 다시 요구 금지 |

## DECIDED (10)

| ID | 무엇 | 날짜 | 누가·무엇이 | 근거 | 메모 |
|---|---|---|---|---|---|
| A-03 | 현재 실험 키 유지 · 폐기(Revoke)·새 발급 반복 요구 금지 | 2026-09-25 | 대표 | 헌장 L · 저장 MASTER §2 |  |
| A-04 | Claude 환경 Edit 경로 반복 안내 금지 | 2026-09-25 | 대표 | 저장 MASTER §2 | 2026-09-24 대표 화면에서 눌리지 않음(BLOCKED B-02) |
| A-05 | A(운영 v27) 동결 · B-1.0 동결 · 결과 보고 수정 금지 | 2026-09-25 | 대표 | CTO 기준본 · PHASE 1 | FROZEN_INPUTS.json 으로 강제 |
| A-06 | Conversation P0 = FAIL 유지 | 2026-09-25 | 대표 | 저장 MASTER §1 |  |
| A-07 | 실패마다 정규식 하나 추가 금지 · 문자열 품질 휴리스틱 금지 | 2026-09-25 | 대표 | B안 자율 실행 FINAL |  |
| A-08 | Twilio(문자 인증) 연동 중단 | 2026-09-24 | 대표 | CLAUDE.md |  |
| A-09 | 포괄 자율 실행(C항) · HARD STOP 만 승인 요청 · 중간보고 금지 | 2026-09-25 | 대표 | R&D 헌장 |  |
| A-12 | run1 판정: A FAIL · B-1.0 FAIL · B WIN 확인 불가 · B 를 운영 후보로 확정하지 않음 | 2026-09-25 | 대표 | docs/failure-intelligence/MODEL_GATE_20260925.md |  |
| A-13 | 블라인드 전 A·B·Prompt·Intent 규칙·Guard·휴리스틱 수정 금지 · run1 보존 | 2026-09-25 | 대표 | docs/failure-intelligence/MODEL_GATE_20260925.md |  |
| A-14 | 모델 비교 = B-1.0 고정 · MODEL 만 변경 · BASELINE gpt-4o-mini(요청 이름) | 2026-09-25 | 대표 | docs/failure-intelligence/MODEL_GATE_20260925.md | 후보 모델명은 공식 문서·계정 확인 뒤에만 |

## BLOCKED (8)

| ID | 무엇 | 날짜 | 누가·무엇이 | 근거 | 메모 |
|---|---|---|---|---|---|
| B-01 | 채팅으로 받은 Secret 을 Claude 실행 명령에 사용 | 2026-09-25 | 환경 보안 장치 | 세션 기록(자동 판정기 거부) | 우회 금지 |
| B-02 | Claude 환경 편집(Edit)으로 환경 변수 넣기 | 2026-09-24 | 대표 화면 | CLAUDE.md 「환경 설정 안내 정정」 | 같은 경로 재안내 금지 |
| B-03 | Netlify 도구 업로드 | 2026-09-22 | 바깥 인터넷 정책(프록시 403) | CLAUDE.md | 대표 수동 업로드 |
| B-04 | app.do-it.company 내용 대조 | 2026-09-22 | 바깥 인터넷 정책(403) | CLAUDE.md |  |
| B-05 | Supabase 관리 API 로 배포 | 2026-09-24 | 토큰 401 | CLAUDE.md | 대표 대시보드 붙여넣기로 대체됨 |
| B-06 | Actions 첨부물(result.json·열쇠) 내려받기 | 2026-09-25 | 바깥 인터넷 정책(blob.core.windows.net 프록시 403) | docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md | 로그의 result.md 로 대신함 · 열쇠는 새 검수표로 다시 만듦 |
| B-07 | OpenAI 공식 가격 페이지 확인 | 2026-09-25 | 바깥 인터넷 정책(openai.com 프록시 403) | docs/failure-intelligence/REAL_AB_RUN1_분석_20260925.md | 비용 = 확인 불가. 단가 추정 금지 |
| B-08 | 운영 Secret OPENAI_MODEL 값 읽기 | 2026-09-25 | 도구 없음(Supabase MCP 에 Secret 읽기 없음) · 관리 API 토큰 401 | docs/failure-intelligence/AB_PREFLIGHT_LOCK_20260925.md | 값을 요구하지 않는다 — 지문(DIGEST) 대조로 대신 |

## PENDING (8)

| ID | 무엇 | 날짜 | 누가·무엇이 | 근거 | 메모 |
|---|---|---|---|---|---|
| P-02 | LEVEL 3 실기기(iPhone·Galaxy) | — | 대표 | — |  |
| P-03 | 「모르겠어요」 대화 끝 판정 | — | 대표 결정 | GF-09 |  |
| P-04 | 전화 인증 없는 연결 자격 조건 | — | 대표 결정 | CLAUDE.md |  |
| P-05 | 사주·타로·공간·월드 메뉴 숨김 충돌 | — | 대표 결정 | CLAUDE.md |  |
| P-06 | 타로 403(openai-chat 허용 주소·토큰 검증판 배포) | — | 대표 승인(운영 배포) | GF-48 |  |
| P-08 | 운영 A 실제 모델 확정(OPENAI_MODEL DIGEST 앞 12글자 대조) | 2026-09-25 | 대표(Supabase 화면 확인 1회) | docs/failure-intelligence/AB_PREFLIGHT_LOCK_20260925.md | 확정 전 run2 실행 금지 · 모델 임의 선택 금지 |
| P-09 | MODEL GATE(P0 블라인드에서 A·B 둘 다 부족하면 개시) | 2026-09-25 | 대표 블라인드 결과 | docs/failure-intelligence/MODEL_GATE_20260925.md | 계정 모델 목록 확인(GET /v1/models, 비용 0)은 Gate 개시 때 |
| P-10 | MODEL GATE 1단계: 계정 모델 목록 확인(GET /v1/models · 비용 0 · 기존 Actions 경로) | 2026-09-25 | Claude(워크플로에 조회 추가 → 실행) | docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/P0_BLIND_RESULT_RUN1.md | 후보는 목록 + 공식 단가 확인 뒤에만. 페이지 댓글의 프롬프트 방향은 모델 비교 다음 단계(한 번에 한 변수) |
