# DEPLOYMENT_PLAN — 적용 상태·순서·되돌림 (2026-09-17 최종, 대표 승인 배포 완료·실측 대조본)

> **대표 승인("승인한다") 실행 결과 — Supabase 실측값**
> | 함수 | 최종 버전 | 시각(KST) | ezbr_sha256 | 배포본 ↔ 로컬 바이트 |
> |---|---|---|---|---|
> | echo-journey | v12 → **v14 ACTIVE** | 2026-09-17 07:30 | `21ce08f0…f41197` | `index.ts` **완전 동일**(sha256 `1fa37f17…`, 60,267B) / `question-quality.ts` **끝 줄바꿈 1바이트만 차이**(24,043 vs 24,044B, 앞 24,043B 해시 동일 = 내용 동일) |
> | get-step-question | v21 → **v25 ACTIVE** | 2026-09-17 07:48 | `17df317b…7ed73f` | `index.ts` **완전 동일**(sha256 `b1b2c777…`, 76,353B, cmp 클린) |
>
> 둘 다 `verify_jwt: true`. 회수본(운영에서 실제로 내려받은 원문): `evidence/deployed_after_v25/`.
>
> **중간 버전에 대한 사실 그대로의 기록**
> - echo-journey: 배포 호출 1회가 v13 을 반환했고, 이후 목록 조회에서 v14 로 올라와 있었다. 두 판의 내용은 같다. 최종은 **v14**.
> - get-step-question: 배포 호출이 v22 → v24 → v25 순으로 있었다. **v22 는 전송 중 주석 글자 2개가 깨진 판**이었다(`바꾼다`가 `바꿈다`로, `연다`가 `열다`로 — 총 3바이트). 둘 다 **주석 문구이며 실행되는 코드 바이트는 아니다.** 발견 즉시 재배포했고 최종 **v25 는 로컬과 바이트 동일**이다. v23 은 호출 없이 번호만 건너뛴 자리다.
> - 같은 내용을 두 경로에서 올린 탓에 번호가 늘었다. 기능·설정은 달라지지 않았다.
>
> **되돌림**: `evidence/deployed_after_v12/` 의 v12·v21 원문을 그대로 새 버전으로 배포하면 즉시 원상복구(설정·DB 변경 없음). 기억 저장만 끄려면 `get-step-question/index.ts` 의 `saveConfirmedMemory` 호출 2줄을 지우고 재배포.

## 0. 이번 라운드에서 바꾸지 않은 것
| 구역 | 상태 |
|---|---|
| echo-payment(v2) / openai-chat(v2) / doit-understanding(v4) / admin-conversations(v2) / admin-dashboard(v1) | 변경 없음 |
| DB 스키마 · RLS · 마이그레이션 | 변경 없음(기존 적용 상태 유지) |
| 시크릿 · 운영키 · Toss 결제 설정 · 가격(4,900원 단건) · `PAYMENT_GATE` | 변경 없음 |
| 파일 삭제 | 없음 |

## 1. 남은 순서 (Claude 권한 밖 — Codex·대표)
1. **Netlify**: `ECHO_CLAUDE_NETLIFY_DRAG_20260917.zip`(sha256 `308e8e53…`, 102파일) 드래그 배포 → `ready` 확인 → 운영 `index.html` 이 `assets/index-PTm_2znC.js` 를 부르는지 확인.
2. **실기기 확인**: 갤럭시 Chrome · 아이폰 Safari 로 `CODEX_HANDOFF.md` 4장의 항목을 직접 눌러 확인. 이 전에는 "운영 확인 완료"라고 쓰지 않는다.
3. **24시간 관찰**: `[ej]/[gsq] candidates_blocked … reasons=` 에 남는 사유, `no_candidate` 재발 여부, `answer_hold`(되물음에 단계 고정) 로그, `openai_truncated`·`openai_usage` 값.

## 2. 되돌림
- Netlify: 직전 배포 `6aaa6f4662ecb9daa734d6da` 를 "Publish deploy".
- echo-journey: `evidence/deployed_after_v12/echo-journey/` 의 v12 원문을 새 버전으로 배포.
- get-step-question: `evidence/deployed_after_v12/get-step-question/` 의 v21 원문(sha256 `fc7c668f…`)을 새 버전으로 배포.
- DB 되돌림 필요 없음(변경분이 없다).

## 3. STOP — 하지 않았고, 대표 승인 없이는 하지 않는 것
DB·RLS·마이그레이션 실행, 결제 설정 변경, 운영키·시크릿 변경, 파일 삭제, 실제 Toss 승인 테스트, 스테이징 생성, Supabase 보안 어드바이저 항목 변경(`is_admin()` RPC 실행 권한·유출 비밀번호 보호), Netlify 배포(권한 없음 — Codex 담당).
