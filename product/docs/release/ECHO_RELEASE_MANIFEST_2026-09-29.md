# ECHO Release Manifest — 2026-09-29 (Plan A · 운영 직전)

작성: Claude Code · 근거 = 실측(읽기 전용 조회 · CI 실행 기록 · 로컬 검사). 운영 변경 0.

## 1. 코드

| 항목 | 값 |
|---|---|
| 통합 브랜치 | `echo-qa` = `claude/echo-mvp-loop-20260928` = `75e183d` |
| 에이전트 RC(QA 배포본) | `2f21413` (doit-agent `echo-agent-v2.4.3`) |
| 75e183d 에서 바뀐 것(2f21413 뒤) | 문서(`a66df6e` Codex 묶음) · 매칭 재료 사용자 출처만(`doit-connect/agentSource.ts` · 기본 꺼진 `MATCH_SOURCE=agent` 경로) · FI 기록 · 테스트 |
| 앱 소스(`product/src`) 5fda89e → 75e183d 차이 | 0줄 |
| main | echo-qa 보다 뒤처짐 · main 고유 커밋 = 도구(workflow·skill)만 |

## 2. 자동검사(75e183d · 로컬)

| 검사 | 결과 |
|---|---|
| lint · type-check | PASS · PASS |
| `qa/*.test.mjs` | 783 중 778 PASS · 0 FAIL · 5 TODO |
| Failure Intelligence(`spike/failure-intelligence/fi.test.mjs` · `fi-build --check`) | 9/9 · 검사 완료(실패 103건) — HEAD a66df6e 에서는 GF-98 근거 경로 때문에 2 FAIL 이었음 → 수정 |
| spike R&D 2개(`ab-20260925/regression` · `metrics-v213`) | 확인 불가 — 로컬에 `js-tiktoken` 미설치(배포 경로 밖 · 수정 전후 같음) |
| 매칭 재료 반대 검사 | 수정 전 5 FAIL → 수정 후 92/92 |
| TODO 5 | 2 = `conversation-v15` 휴리스틱(doit-understanding) · 3 = 옛 STEP 1→7 — 모두 현재 앱 경로(doit-agent) 밖 |

## 3. 서버 함수(읽기 전용 조회 2026-09-29)

| 함수 | QA `mutniujeiyujhkobadkd` | 운영 `zyyhhxyupizcqhxqnxuu` |
|---|---|---|
| doit-agent | v40 · `echo-agent-v2.4.3` · sha256 `947fbe40…` | v9 · `echo-agent-v2.2` (2026-09-25) |
| doit-connect | v36 · sha256 `6e0cfd0e…` (75e183d 매칭 재료 필터 전 소스 — 기본 경로 legacy 에서는 동작 같음) | v7 · v1.2 (2026-09-24) |
| doit-understanding | v36 | (이번 대상 아님) |
| admin-web | v14 | 없음 |

## 4. DB migration

| 항목 | QA | 운영 |
|---|---|---|
| `doit_connect_v2_mutual` | 적용 | 미적용(대표 GO 대상) |
| failure_intelligence_events/rules | — | 있음 · 승인 근거 저장소에 없음(APPROVAL_UNVERIFIED) |

## 5. 웹(Netlify)

| 사이트 | id | 지금 게시 | 비고 |
|---|---|---|---|
| echo-brand-prod (do-it.company) | `7a4934db-…` | `6aba38743c51bb3203c74d47` | prod_brand_live 22/22 |
| echo-app-prod (app.do-it.company) | `ff078012-…` | `6aba3c4892ce584bab15be25` | 운영 Supabase 만 · QA/melba 0 |
| echo-app-qa | `a9b101c6-…` | `6aba9307d0bacc1706087cb0` · index sha16 `18b27fd10df68f32` | 5fda89e 빌드 = RC 앱 소스와 같음 |

이번 작업 Netlify 게시 0회 · 크레딧 사용 0 · 운영 게시 0.

## 6. OAuth(QA · 2026-09-29 20:26 UTC · flow_state.referrer 실측)

- 앱 redirect → `https://echo-app-qa.netlify.app/auth/callback` · 관리자 → `https://echo-admin-qa.netlify.app/auth/callback` · 옛 thriving-melba 0
- 허용 밖 주소 → Site URL 로 되돌림(글자에 `////` 가 붙어 보이나 브라우저가 정리 · 참고만)
- Google 실제 계정 왕복: NOT_MEASURED — 실제 Google account interaction 필요

## 7. 실서버 · 실제 AI(QA)

| 검사 | run | 결과 |
|---|---|---|
| CORE live A–F(정정 · 「그런 뜻 아니야」 · 모르겠어요 · 목적 불일치 · 피로 · 친구↔연애↔취미 격리 · 사용자 간 격리) | 108 | 22/22 PASS · v2.4.3 |
| 게시 QA 앱 실제상태(WebKit iPhone · Chrome Galaxy) | 99 | PASS |
| 매칭 루프(후보 · 서로 선택 · 연결 · 결과) | 72 | 45/45 (doit-connect v2.0 · legacy 재료) |

## 8. WebKit 직접 진입(운영 · 로그아웃 · run 106 · 49회)

- Chrome 20회: 멈춤 0 · 오류 0 · 첫 화면 p50 2.7초
- WebKit 29회: 멈춤 3회 — 모두 `/do-it/intro` 인트로 중 · 배율 3에서만(배율 1 0/3) · JS·콘솔 오류 0 · 요청 실패 0 · 같은 경우 재시도 3/3 통과
- 「내 프로필을 가져오고 있어요.」 멈춤: 재현 0 — 로그아웃 첫 방문은 인트로 약 3.3초 + 읽기 → 4.1~5.1초에 화면. 고정 5초 한 번 보기가 읽는 중 문구를 잡은 것
- 판정: 검사 타이밍(A · 확인) + 자동화 브라우저 멈춤(J · 인트로 캔버스 가설 G 는 미확정) · 제품 코드 수정 0
- 검사 수정: `prod-app-live.mjs` 의미 있는 화면까지 대기 · 멈춤 1회 재시도 별도 보고

## 9. 운영 전 대표 GO 묶음(하나)

1. 운영 Auth URL: Site URL `https://app.do-it.company` · Redirect `https://app.do-it.company/auth/callback` · `https://admin.do-it.company/auth/callback`
2. 운영 doit-agent `echo-agent-v2.4.3`(= QA v40 소스)
3. 운영 doit-connect v2.0(75e183d) + `doit_connect_v2_mutual` migration
4. 운영 APP 게시(1회 · 약 15 크레딧)
