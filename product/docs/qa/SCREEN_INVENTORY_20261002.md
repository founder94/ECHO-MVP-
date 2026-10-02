# 화면 목록 · 모의 응답 브라우저 점검(2026-10-02)

대상: 앱 빌드(이 브랜치) · 로컬 서버 · **서버 응답은 모의**(실제 서버 검사는 qa-real/*) · 실기기 아님.
경로 44개 × 로그인/비로그인 × 320·430px = 176회 · 가로 넘침 0 · 화면 오류(JS) 0 · Stripe 0 · 가짜 자료 문구 0.
가격 표시: `/legal/terms` 약관 본문의 「4,900원」 1곳(확정 가격 · 약관).

| 경로 | 로그인 결과 | 비로그인 결과 | 제목 |
|---|---|---|---|
| `/` | `/do-it/intro` | `/do-it/intro` |  |
| `/login` | `/login` | `/login` | 로그인 |
| `/signup` | `/signup` | `/signup` | 가입하기 |
| `/legal/consent` | `/do-it/intro` | `/login` |  |
| `/legal/terms` | `/legal/terms` | `/legal/terms` | 이용약관 |
| `/legal/privacy` | `/legal/privacy` | `/legal/privacy` | 개인정보 처리방침 |
| `/do-it/hero` | `/do-it/intro` | `/do-it/intro` |  |
| `/do-it/landing` | `/do-it/intro` | `/do-it/intro` |  |
| `/payment` | `/doit/home` | `/login` | 편하게 몇 가지만물어볼게요. |
| `/payment/success` | `/doit/home` | `/login` | 편하게 몇 가지만물어볼게요. |
| `/payment/fail` | `/payment/fail` | `/payment/fail` | 결제가 완료되지 않았어요. |
| `/home` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/start` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/weather` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/white-door` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/report` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/locker` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/landing` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/fortune` | `/doit/fortune` | `/doit/fortune` | 오늘의 나를먼저 만나볼까요? |
| `/doit/verify` | `/doit/verify` | `/doit/verify` | 전화 인증 |
| `/doit/home` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/first-record` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/review` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/understanding` | `/doit/understanding` | `/doit/understanding` | 나의 이해 |
| `/doit/timeline` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/value` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/pattern` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/memory` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/spaces` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/choose` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/start-journey` | `/doit/start-journey` | `/doit/start-journey` | 이번에는 어떤 관계를만나고 싶나요? |
| `/doit/conversation` | `/doit/conversation` | `/doit/conversation` | 친구를 만나고 싶어요편하게 몇 가지만 물어볼게요. |
| `/doit/world` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/room` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/grade` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/just-try` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/connections` | `/doit/connections` | `/doit/connections` |  |
| `/doit/key` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/notifications` | `/doit/home` | `/doit/home` | 편하게 몇 가지만물어볼게요. |
| `/doit/settings` | `/doit/settings` | `/doit/settings` | 설정 |
| `/doit/settings#guide` | `/doit/settings#guide` | `/doit/settings#guide` | 설정 |
| `/doit/profile` | `/doit/profile` | `/doit/profile` | 프로필 |
| `/doit/admin/mobile` | `/` | `/` | Your connection is not private |
| `/no-such-page` | `/no-such-page` | `/no-such-page` | 404 |

숨김 경로(출시 범위 밖: KEY·공간·방·등급·알림 등)는 홈으로 돌아간다(`releaseScope.ts`). `/doit/admin/mobile` 은 관리자 사이트로 넘어간다(점검 환경에서는 외부 주소라 열리지 않음 — 정상).
미실행: 실기기(iPhone·Galaxy) · 글자 확대 200% · 실제 Google 로그인 · PWA 설치 첫 화면 → 대표 실기기 확인 필요.
