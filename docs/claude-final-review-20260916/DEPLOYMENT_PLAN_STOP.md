# DEPLOYMENT_PLAN — 적용 상태·순서·되돌림 (2026-09-16, 2차)

대표 승인(2026-09-16 "승인한다") 범위: Netlify 드래그 배포, echo-journey 새 버전, get-step-question 새 버전. DB/RLS/마이그레이션/시크릿/Toss 설정은 변경하지 않는다.

## 0. 현재 상태 (이 문서 작성 시각 기준, Supabase list_edge_functions 실측)
| 구역 | 상태 | 비고 |
|---|---|---|
| echo-journey | **v11 ACTIVE, verify_jwt 켬** (updated 2026-09-16 UTC 13:xx, ezbr `71178054…`) | 로컬 `index.ts` sha256 `31fed95f…`, `question-quality.ts` `3295ae75…`. 배포본 바이트 대조 결과는 Claude 최종 보고에 기록 |
| get-step-question | v19 (배포 작업 진행 중, v20 미확인) | 로컬 `index.ts` sha256 `56ece8f3…`. v20 이 목록에 보이고 바이트 대조가 끝난 뒤에만 "배포됨"으로 기록 |
| echo-payment / admin-dashboard / admin-conversations / openai-chat / doit-understanding | 변경 없음 | — |
| DB | 변경 없음(마이그레이션 5건 기존 적용 상태) | — |
| Netlify | **미배포** — Codex 가 `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip`(sha256 `b89f9c19…`) 드래그 배포 | 현재 운영 배포 `6aaa6f4662ecb9daa734d6da` |

## 1. 순서
1. Netlify: `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip` 드래그 배포 → `ready` 확인 → 운영 index.html 이 `assets/index-CqAhazqn.js` 를 부르는지 확인. (서버와 응답 계약이 같으므로 서버 앞뒤 무관)
2. get-step-question v20: 로컬 `index.ts` 단일 파일, verify_jwt 켬. 배포 뒤 `get_edge_function` 원문 sha256 = `56ece8f3…` 대조. 미확인이면 v19 유지로 기록.
3. 24시간 관찰: `validate_fail` 로그에 `qmarks= tail=` 가 붙는지, attempt 1·2 연속 실패(NO_CANDIDATE) 빈도가 이전(6회/2분)보다 줄었는지; echo-journey 는 `[ej]` 로그가 오류 시에만 남는지.

## 2. 되돌림
- Netlify: 직전 배포 `6aaa6f4662ecb9daa734d6da` 를 Publish deploy.
- echo-journey: v10 원문(`evidence/deployed/` 회수본과 동일, 로컬 기준본 `PROJECT_SOURCE/supabase/functions/echo-journey/`)으로 새 버전 배포.
- get-step-question: v19 원문(기준본 `PROJECT_SOURCE/supabase/functions/get-step-question/index.ts`, sha256 `bdd8dfb3…`)으로 새 버전 배포.
- DB 되돌림 필요 없음.

## 3. STOP(하지 않은 것)
실제 Toss 승인, 실제 사용자·결제·KEY 행 생성, 운영 관리자 로그인 육안, 스테이징 생성, Supabase 보안 어드바이저 항목(`is_admin()` RPC 실행 권한, 유출 비밀번호 보호), Stripe 외 의존성 변경, 파일 삭제.
