# ECHO RC — Codex Final Review Bundle

Status: 제출(Claude 구현 + 자기검사) · Codex 반대검수 대기
Effective: 2026-09-29
Prepared by: Claude Code (구현 · 자기검사)

## 1. 고정 RC

| 항목 | 값 |
|---|---|
| 코드 RC SHA | `2f21413421506ea3b0cba9635b6dfa0d3eb5d9ed` (echo-qa) |
| 이 문서 commit | RC 뒤 문서 1개만 추가(코드 차이 0) |
| QA 서버 `doit-agent` | v40 · `echo-agent-v2.4.3` · verify_jwt=true · 배포 파일 3개(index · agent · failure-intelligence) = RC 와 글자까지 동일 |
| QA 게시 앱(echo-app-qa) | deploy `6aba9307d0bacc1706087cb0` · index sha16 `18b27fd10df68f32` (빌드 commit 5fda89e) |
| 게시 앱 = RC 인가 | 5fda89e → 2f21413 사이 앱 소스(`product/src` · `public` · 빌드 설정) 차이 0줄 → 같은 앱 코드 · 로컬 QA 빌드 index sha16 도 `18b27fd1…` 로 같음 |
| 운영(PROD) | 변경 0(게시 · DB · Auth · 함수 모두) |

## 2. 변경 범위(8a40817 → 2f21413, 43 files · +968 −261)

Claude:
- `8f50117` Stale Redirect Guard(`scripts/oauth-redirect-guard.mjs`) · start-journey 다시 시작 버튼 · Glass Button System(`glass-button.css` · `GlassButton`) · FI GF-97/98/99
- `585f979` start-journey 읽는 중 잘못된 「대화 시작하기」 flash 차단
- `291a41e` 관리자 배포 기록표 QA 주소 글자 제거(운영 관리자 빌드 QA 주소 0)
- `5fda89e` QA 수동게시 `qa_roles`(기본 app 1곳) · OAuth guard 관리자 정확한 콜백 요구
- `9826e36` / `620fc5b`(PR #18) doit-agent v2.4.2 — 거절 머리말 + 새 값 = 정정(서버 규칙)
- `2f21413` doit-agent v2.4.3 — 「잘 모르겠어요」만 한 말은 repair/correction 으로 읽혀도 unsure

대표 · ChatGPT 측(이 묶음에 포함 · Claude 가 쓰지 않음):
- `82b7d46`~`43592d4` Failure Intelligence runtime contract · `8d5eb2e` OAuth HOLD 분리 · `7a7186c` push 유료 게시 중단 · `8a1bec1`/`dd4077b`/`6751f71` 검수 구조 · AUTO/STOP 잠금 문서

## 3. 자동검사(비용 0 · 로컬 실측 · RC 2f21413)

| 검사 | 결과 |
|---|---|
| lint | PASS |
| type-check | PASS |
| 전체 테스트 | 801 중 796 PASS · 0 FAIL · 5 TODO |
| CORE 회귀(정정·거절·supersede·rejected block·profile·matching handoff) | 137/137 (6751f71 실측) + v2.4.2/2.4.3 신규 4/4 |
| Failure Intelligence 계약 + P0 실제상태 + 정정 규칙 | 24/24 (6751f71 실측) |
| 역할별 빌드 QA·운영(APP·BRAND·ADMIN) | 주소 잠금 PASS 둘 다 · 소스맵 0 · melba 0 · QA↔운영 혼입 0 |
| echo-qa CI | run 21(2f21413) SUCCESS · QA 게시·운영 게시 job SKIPPED |

## 4. 실서버 · 실제 AI 증거(QA 전용)

| 검사 | run | 결과 |
|---|---|---|
| CORE live(`core_live_qa`) · v2.4.3 | 100 | 17/17 PASS |
| 게시된 QA 앱 재현(`realstate_p0_qa`) · WebKit(iPhone 크기)·Chrome(Galaxy 크기) | 99 | PASS (30 항목) |

CORE live 17 항목: 실서버 대화 시작 · 정정 턴 = correction · 원문 보존 · 정정 뒤 AI 말에 거절 뜻 0 · 요약·소개·confirmed_preferences·CONFIRMED 항목에 거절 뜻 0 · 최신 정정 반영(주말) · 정정 이력 보존 · 다른 사용자 읽기 0 · 쓰기 0(404) · B 글 0 · 같은 계정 목적 격리(다른 목적 = 다른 세션 · 같은 목적 재시작 = 원래 세션) · 「잘 모르겠어요」= unsure 저장 0 · 목적 방향 정정 = repair 저장 0 · 질문 피로 = repair 저장 0 · 목적 세션에 다른 목적 말 0 · 서버 판 v2.4.3.

게시 앱 재현 30 항목(기기당 15): 대표와 같은 상태(대화 완료) · 버튼 유리 계산 색 · 고른 칩 막 진해짐 + aria-pressed · 불투명 채움 0 · 소개 확인 기록 · 첫 렌더 잘못된 버튼 0 · 대표 화면 그대로 · 다시 시작 실제 렌더 · 한 번 탭 새 회차 · 목적·기록 유지 · Google 시작 redirect_to = echo-app-qa/auth/callback · 페이지 오류 0.

## 5. 이 과정에서 실측으로 찾은 결함(수정 · 재검증 완료)

| 결함 | 발견 | 수정 | 재검증 |
|---|---|---|---|
| 정정을 모델이 repair 로 읽어 거절한 옛 값이 CONFIRMED 로 남음(요약·소개·매칭) | core_live run 90/91 · v2.4.1 | v2.4.2 | run 94 · 100 |
| 「잘 모르겠어요」가 repair 로 읽혀 지금 질문이 거절(rejected_meanings)로 기록 | core_live run 95 · v2.4.2 | v2.4.3 | run 100 |
| 운영 관리자 빌드에 QA 주소 글자(운영 게이트 차단) | 역할 빌드 실측 | 291a41e | 역할 빌드 PASS |
| 읽기 전 잘못된 「대화 시작하기」 약 1초 | 실제상태 재현 | 585f979 | run 88 · 92 · 99 |

## 6. Known TODO / 남은 위험

| 항목 | 영향 | 릴리스 차단 |
|---|---|---|
| TODO 2 · `conversation-v15.test.mjs` 휴리스틱(doit-understanding) | 현재 앱 경로(doit-agent) 밖 | 아님 |
| TODO 3 · `full-journey-1to7` · `stress-messy-inputs` 옛 STEP 1→7 | 현재 앱 경로 밖 · LEGACY-01 별건 | 아님 |
| 옛 값 거두기는 「옛 항목 고르기」 AI 호출에 기댐(v2.2.4 기존 구조) | AI 가 아무것도 안 고르면 옛 값 잔존 가능 | 실서버 run 94·100 에서는 거둠 확인 · 반복 표본은 아직 작음 |
| QA Supabase Auth URL(Site URL = thriving-melba) | Google 로그인 후 폐기 주소로 복귀(18:00:57 UTC 재확인) | QA 로그인 왕복 차단 — 대시보드 소유자 설정 1회 필요(AUTH_CONFIG_MANUAL_REQUIRED) |
| Google 실제 왕복 · 로그인 유지 · 실기기 | NOT_MEASURED | 위 Auth 설정 뒤 |
| 운영 migration 2건(failure_intelligence_events/rules) | 승인 근거 저장소에 없음 | APPROVAL_UNVERIFIED — 별도 |

## 7. 운영 전 STOP 대상(대표 GO)

- PROD Auth URL: Site URL `https://app.do-it.company` · Redirect `https://app.do-it.company/auth/callback` · `https://admin.do-it.company/auth/callback`(옛 항목 정리는 사용처 확인 후)
- PROD doit-agent v2.4.3 배포 · doit-connect v2.0 + `doit_connect_v2_mutual` migration
- PROD 게시(APP)

## 8. Codex 에 요청하는 반대검수 초점

1. `agent.ts` `rejectWithNewValue` — 거절 머리말 오탐(질문에 대한 정상 「아니요 + 답」을 정정으로 올리는 경우)이 옛 값을 잘못 거두는가. 현재 대상은 모델이 repair 로 읽은 턴만.
2. `guardKind` 「unsure_only」 확장 — 모르겠다 + 다른 내용이 섞인 말은 대상 아님(테스트 포함) 확인.
3. `reject_with_value` 턴에서 최신 말 추출 허용 예외가 항의·피로·넘기기 가드를 약화하지 않는가.
4. 역할 빌드 주소 잠금 · QA 수동게시 `qa_roles` 비용보호 · Stale Redirect Guard 정확한 콜백 규칙.
