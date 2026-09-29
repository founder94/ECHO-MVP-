# 운영 배포 기록 · 2026-09-18 (대표 승인 · 정정 우선 규칙 + 진단 로그)

배포 도구: Supabase CLI 2.117.0 `functions deploy --use-api` (파일을 디스크에서 그대로 읽어 올린다. 옮겨적기 없음)
프로젝트: `zyyhhxyupizcqhxqnxuu`

## 배포 전 → 배포 후

| 함수 | 이전 | 이후 | 상태 | verify_jwt |
| --- | --- | --- | --- | --- |
| get-step-question | v33 | **v34** | ACTIVE | true |
| echo-journey | v19 | **v20** | ACTIVE | true |

다른 함수는 건드리지 않았다 (echo-payment v2 · openai-chat v2 · doit-understanding v4 · admin-conversations v2 · admin-dashboard v1 — 전부 그대로).

## 운영 파일 재다운로드 SHA-256 대조 (전부 일치)

| 파일 | SHA-256 (앞 16자) | 크기 |
| --- | --- | --- |
| get-step-question/index.ts | `b79390f722295734` | 30,544 B |
| get-step-question/rules.ts | `1148a6e25d29b17e` | 34,218 B |
| get-step-question/ai.ts | `d6e8ae639787c6bc` | 30,803 B |
| echo-journey/index.ts | `0530ea0ddcefa31f` | 65,838 B |
| echo-journey/question-quality.ts | `e7f77b7acafc00a4` | 29,907 B |

운영 파일 수 5 = 배포 대상 5. **추가 파일 0 · 누락 파일 0.**

## 부팅·인증 확인

- 부팅 오류 0 (`booted (time: 23~39ms)` 만 관측, uncaught/ERROR 0)
- 인증 없음 → **401 UNAUTHORIZED** (두 함수 모두)
- 인증 있으나 남의 대화 → **403 FORBIDDEN** (두 함수 모두, 사용자 격리 동작)
- 인증 + 정상 요청 → **200**, `status=step1`, 대화 생성됨

## 롤백 경로

`docs/claude-final-review-20260916/ROLLBACK/get-step-question-v33/` 와 `.../echo-journey-v19/` 에 직전 운영본을 원문 그대로 보관한다.
되돌릴 때: 해당 폴더를 `supabase/functions/<이름>/` 에 덮어쓰고 같은 CLI 명령으로 다시 배포한다.

| 롤백본 | SHA-256 |
| --- | --- |
| gsq v33 index.ts | `b79390f722295734008f092416b5ba10cb2f9ad549ae73f369706b58c1bb990e` |
| gsq v33 rules.ts | `e41272e3c7defaa2bef6fed816a2ef160751f34665461451d672f4fe9e2144eb` |
| gsq v33 ai.ts | `eff88b619fd2b42b618d9a2f87b5e493391f2b6db8ec7a7e5e0c8caf74093a2b` |
| ej v19 index.ts | `ea7ee5819d004518b4d0286350b0bd1577d61cab48482229d38500442cf9efbc` |
| ej v19 question-quality.ts | `4776fbf297366532fabd7fb36e5518f0fe8d7d184fa568f89558b5c693a3f9ff` |

## 이번 배포에서 하지 않은 것

DB 변경 · RLS 변경 · Migration · Secret 변경 · 모델 변경 · Toss 변경 · 가격 변경 · Netlify 변경 · 실제 사용자 데이터 변경 · Readdy 이미지 변경 — **전부 없음.**
