# DEPLOYMENT_PLAN_STOP — 적용 순서·되돌림 (2026-09-16)

**현재 상태: 아무것도 운영에 적용하지 않았다.** Supabase Edge 함수 배포 0건, DB/RLS/마이그레이션 0건, Netlify Publish 0건, 키·OAuth·Toss 설정 변경 0건. 아래는 대표 승인 뒤에만 실행하는 순서다. 각 단계는 독립적으로 승인·되돌림이 가능하다.

## 0. 이번 납품물과 운영의 관계
| 구역 | 운영 현재 | 납품물 | 적용 필요 여부 |
|---|---|---|---|
| get-step-question | v19 (로컬 원문과 바이트 동일) | `PATCH/supabase/functions/get-step-question/index.ts` (질문 정리 규칙 + 진단 형태 로그) | 승인 시 v20 배포 |
| echo-journey | v10 (로컬과 동일, question-quality.ts 포함) | `PATCH/supabase/functions/echo-journey/index.ts` (후보 정리 + `[ej]` 진단 로그). `question-quality.ts` 는 변경 없음 → 배포 시 v10 원문 그대로 함께 올린다 | 승인 시 v11 배포 |
| echo-payment / admin-dashboard / admin-conversations / openai-chat / doit-understanding | v2 / v1 / v2 / v2 / v4 | 변경 없음 | 없음 |
| DB | 마이그레이션 5건 적용 상태(0913~0916) | 변경 없음. 새 SQL 없음 | 없음 |
| 프론트(Netlify) | 배포 `6aaa6f4662ecb9daa734d6da` (`index-fz8cj8NF.js`) | `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip` (`index-Bed2Fzz_.js`, 99 파일, 재해제 대조 PASS) | 승인 시 드래그 배포 |

## 1. 적용 순서 (승인 뒤)
1. **프론트 먼저** — Netlify 사이트 `echo-mvp-doit` 에 `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip` 드래그 배포. 서버 함수와 계약이 바뀌지 않았으므로(응답 필드·상태값 동일) 서버보다 먼저 올려도 안전하다. 확인: 홈 갤럭시 배경 잘림 0, `/payment` 는 여전히 "결제 준비 중".
2. **echo-journey v11** — Supabase 대시보드 > Edge Functions > echo-journey > 새 버전. `index.ts` = PATCH 원문, `question-quality.ts` = 현재 v10 원문 그대로. `verify_jwt` 켬 유지. 확인: 함수 로그에 `[ej] ` 접두 진단이 오류 시에만 남고 원문은 없음.
3. **get-step-question v20** — 같은 방식으로 `index.ts` 단일 파일 교체. `verify_jwt` 켬 유지. 확인: `validate_fail` 로그에 `qmarks=… tail=…` 가 붙고, 2회 연속 실패(NO_CANDIDATE) 빈도가 이전(2026-09-16 08:09~08:10 UTC 6건)보다 줄어드는지 24시간 관찰.
4. 비밀값·환경변수 변경 없음. Toss 는 `review_pending` 유지(서버 상수·프론트 게이트 모두 그대로).

## 2. 되돌림
- 프론트: Netlify 에서 직전 배포 `6aaa6f4662ecb9daa734d6da` 를 다시 게시(Publish deploy). 데이터 영향 없음.
- echo-journey: v10 원문(`DEPLOYED/echo-journey/` 로 회수한 바이트, 이 세션에서 로컬 원문과 동일 확인)으로 새 버전 배포.
- get-step-question: v19 원문(로컬 `PROJECT_SOURCE/supabase/functions/get-step-question/index.ts` 와 바이트 동일)으로 새 버전 배포.
- DB 되돌림 필요 없음(변경 없음).

## 3. 하지 않은 것 (STOP)
- 실제 Toss 승인 호출, 실제 사용자·결제·KEY 행 생성, 운영 계정 로그인 육안 확인, 스테이징 생성.
- `is_admin()` RPC 실행 권한·유출 비밀번호 보호 등 Supabase 보안 어드바이저 항목(대표 콘솔 결정).
- 관리자 로그인 실기기 확인.
