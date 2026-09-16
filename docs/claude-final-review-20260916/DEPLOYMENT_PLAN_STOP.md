# DEPLOYMENT_PLAN — 적용 상태·순서·되돌림 (2026-09-17, 4차 — 신뢰 우선 수정은 **미배포**)

> **2026-09-17 상태**: 운영은 echo-journey v12 / get-step-question v21 그대로다. 이번 라운드(질문·단계 분리, 회피 문장 금지, reply 거절 검사, 확인된 기억, 리포트 이후 대화, 시도 예산)는 **코드·검사만 완료했고 배포하지 않았다**. 배포는 대표 건별 승인 사항이다.
> 배포 대상 파일 sha256: `echo-journey/index.ts` `1fa37f17…`, `echo-journey/question-quality.ts` `8649d934…`, `get-step-question/index.ts` `b1b2c777…`
> 되돌림: `evidence/deployed_after_v12/` 의 v12·v21 원문을 새 버전으로 배포하면 원상복구(DB·설정 변경 없음).

대표 승인(2026-09-16 "승인한다") 범위: Netlify 드래그 배포, echo-journey 새 버전, get-step-question 새 버전. DB/RLS/마이그레이션/시크릿/Toss 설정은 변경하지 않는다.

## 0. 현재 상태 (이 문서 작성 시각 기준, Supabase list_edge_functions 실측)
| 구역 | 상태 | 비고 |
|---|---|---|
| echo-journey | **v12 ACTIVE, verify_jwt 켬** (updated 2026-09-16 20:34 UTC, ezbr `1c0a0e53…`) | 로컬 `index.ts` sha256 `2feba9a7…` = 배포본 동일. `question-quality.ts` 로컬 `3295ae75…` vs 배포본 `cbfa7ed4…` — **끝 줄바꿈 1바이트만 차이(cmp: EOF after byte 16171), 내용 동일**. 회수본 `evidence/deployed_after_v12/` |
| get-step-question | **v21 ACTIVE, verify_jwt 켬** (updated 2026-09-16 20:43 UTC, ezbr `4ae492cd…`) | 배포본 `index.ts` sha256 `fc7c668f…` = 로컬, 바이트 대조(cmp) 동일 |
| echo-payment / admin-dashboard / admin-conversations / openai-chat / doit-understanding | 변경 없음 | — |
| DB | 변경 없음(마이그레이션 5건 기존 적용 상태) | — |
| Netlify | **미배포** — Codex 가 `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip`(sha256 `b89f9c19…`) 드래그 배포 | 현재 운영 배포 `6aaa6f4662ecb9daa734d6da` |

## 1. 순서
1. Netlify: `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip` 드래그 배포 → `ready` 확인 → 운영 index.html 이 `assets/index-CqAhazqn.js` 를 부르는지 확인. (서버와 응답 계약이 같으므로 서버 앞뒤 무관)
2. 서버 3차(v12/v21): 배포·대조 완료(2026-09-16 20:34~20:43 UTC). 응답 계약(상태값·필드) 불변이므로 Netlify 배포 순서와 무관.
3. 24시간 관찰: `[ej]/[gsq] candidates_blocked … reasons=` 에서 어떤 사유가 남는지, `no_candidate` 가 3회 시도 뒤에도 나오는지(2026-09-16 20:03 UTC 의 2회 재현 여부), asked 모드 응답이 나왔는지(mode=asked 로그).

## 2. 되돌림
- Netlify: 직전 배포 `6aaa6f4662ecb9daa734d6da` 를 Publish deploy.
- echo-journey: 직전 v11 원문(`evidence/deployed_after/echo-journey/`)으로 새 버전 배포. 그 이전 v10 은 `evidence/deployed/`.
- get-step-question: 직전 v20 원문(`evidence/deployed_after/get-step-question/`, sha256 `56ece8f3…`)으로 새 버전 배포. 그 이전 v19 는 기준본 `PROJECT_SOURCE`(`bdd8dfb3…`).
- DB 되돌림 필요 없음.

## 3. STOP(하지 않은 것)
실제 Toss 승인, 실제 사용자·결제·KEY 행 생성, 운영 관리자 로그인 육안, 스테이징 생성, Supabase 보안 어드바이저 항목(`is_admin()` RPC 실행 권한, 유출 비밀번호 보호), Stripe 외 의존성 변경, 파일 삭제.
