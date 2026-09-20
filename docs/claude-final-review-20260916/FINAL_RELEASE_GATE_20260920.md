# ECHO FINAL FRONTEND RELEASE GATE (2026-09-20)

## 1. 기준 원본
v494-NO-WEATHER를 만든 최신 작업본. 다음 수정이 코드에 실재함을 확인했다.

| 항목 | 확인 |
| --- | --- |
| `/` → Plan A 진입 | `path: '/'` → `<Navigate to={MAIN_ENTRY_PATH} replace />` |
| MAIN_ENTRY_PATH | `/do-it/landing` |
| 예전 B 홈 분리 | 지연 불러오기로 `/home`에만 남음 |
| 로그인 기본 복귀 | `defaultReturnPath()` → MAIN_ENTRY_PATH (entryPathForMode 참조 0) |
| sourcemap | `vite.config.ts` sourcemap: false |

## 2. 실제 수정 파일 (이번 검수에서 추가한 3개, 삭제 0)
| 파일 | 변경 | 이유 |
| --- | --- | --- |
| `src/pages/do-it/4/page.tsx` | "여정 다시 고르기" 버튼 제거 | Plan A 13구간 마지막에서 B 선택 화면으로 가는 문 |
| `src/doit/pages/do-it/settings/page.tsx` | ECHO door 링크 + 여정 다시 고르기 제거, 미사용 import 정리 | 설정에서 마음 날씨로 가는 링크 |
| `src/doit/pages/do-it/choose/page.tsx` | 과거 app-mode='echo' 자동 리다이렉트 제거 | 브라우저 잔존값만으로 /weather 복귀 |

## 3. 메인 `/` 실제 렌더 (브라우저, 배포 산출물 기준)
`ECHO | 진짜 나를 찾아줘 / 01 — 당신의 하루 / 오늘의 발자국이 내일의 연결로 이어집니다.`
"오늘 내 마음의 날씨는 어때?" 0건 · "내 마음을 알면, 내가 보인다" 0건 · 예전 홈 내비 0건 · 날씨 선택 UI 0건.

## 4. 마음 날씨 정상 사용자 도달 가능성
링크 그래프 추적기(LIVE/reach.mjs)로 `/`에서 버튼·링크만 따라 측정했다.

| 시점 | /weather | 경유 |
| --- | --- | --- |
| 수정 전 | **도달 가능** | /do-it/4 · /doit/settings → /doit/choose → ECHO 선택 |
| 수정 후 | **도달 불가** | — |

`/weather-check /story-start /step/2 /understanding-check /white-door /payment /report /locker /next-journey /home /start` 전부 도달 불가.

## 5. B legacy 상태
화면 파일은 그대로 두었고 라우트도 살아 있다. 주소창에 직접 입력할 때만 열린다.
`/weather`는 직접 입력 시 예전 화면이 열림을 렌더로 확인했다(legacy로 기록, 배포 차단 아님).

## 6. 로그인 복귀
코드 기준 전부 통과: 기본 복귀지 고정, 외부 주소 차단(스킴·이중 슬래시), 중복 실행 가드, 취소 분기,
세션 대기 제한시간, redirectTo가 내부 origin, 관리자 복귀 분리.
**실제 Google OAuth 왕복은 이 환경에서 실행하지 못했다 → 확인 불가.**

## 7. 가입 전 체험
`/` → /do-it/landing → /do-it/1~4 → /doit/start-journey → (필요 시 /login, 복귀 경로 전달) → /doit/spaces.
가짜 완료·가짜 로딩 0건. 로그인 시 복귀 경로를 넘겨 진행 상태를 잃지 않는다(코드 기준).

## 8. Purpose
선택 결과는 `profiles` 테이블에 upsert로 저장된다(savePurpose). 미선택은 null로 처리된다.
**선택지 목록은 `PurposeSelect.tsx`의 PURPOSES 배열로 프론트에 하드코딩되어 있다 → 목표 미달.**
DB 연동은 새 구현이라 이번 범위에서 하지 않았다.

## 9. Profile
`loadProfile(user.id)`로 실제 DB를 읽고, 닉네임·소개·목적·지역은 저장값을 표시한다.
등급과 공간·연결·미션 수치는 아직 서버 집계가 없어 화면 상단 DemoNotice로
"데모 미리보기"임을 사용자에게 명시한다. 미구현이며 허위 표시는 아니다.

## 10. KEY / 등급 / Just Try
KEY 화면은 "데모 잔액이에요 · 아래 숫자는 서버 원장이 아니라 화면 데모용 예시 값" 안내와 isDemo 분기를 갖는다.
Just Try는 "현재 준비 중입니다" 배지로 잠겨 있다. 새로 구현하지 않았다.

## 11. 관리자
AdminGuard가 `profiles.role === 'admin'`만 통과시킨다. mock 데이터 사용 0건.
관리자 데이터는 실제 Edge 함수(admin-conversations, admin-dashboard)를 호출한다.

## 12. 결제
PAYMENT_GATE = review_pending · REPORT_PRICE_KRW = 4900 · src 내 Stripe 참조 0건. 변경 없음.

## 13~15. 검사 실행
| 검사 | 결과 |
| --- | --- |
| type-check | 통과 (exit 0) |
| lint | 통과 (exit 0) |
| build | 성공 (entry 406KB) |

## 16. npm ci 재현성 — **위험으로 기록**
이 작업본의 `package-lock.json`은 모든 패키지를
`"resolved": "../../implementation/project/node_modules/…", "link": true`로 기록하고 있고 그 경로는 존재하지 않는다.
따라서 **"npm ci 재현 PASS"라고 쓸 수 없다.** 현재 빌드는 저장소 체크아웃의 모듈을 복사하고
`motion@12.41.0`만 따로 받아 구성한 환경에서 성공했다. lock 정리는 별도 작업이 필요하다.

## 17. 50개 회귀검사
| 판정 | 건수 |
| --- | --- |
| 렌더 PASS (브라우저 실제 렌더) | 9 |
| 코드 PASS (소스·산출물 실측) | 39 |
| 확인 불가 | 1 (실제 Google OAuth 왕복) |
| 목표 미달 | 1 (Purpose 선택지 하드코딩) |
| FAIL | **0** |

전체 표는 `evidence/regression50-result.txt`에 있다.

검사 도구 정정 기록: `/doit/*` 화면은 로그인 세션 없이는 렌더되지 않아 처음엔 위양성 PASS와
오탐 FAIL이 섞여 있었다. 해당 항목을 소스 검사로 바꾸고 "세션 없이 렌더 불가"를 명시했다.

## 18. P0 FAIL — 0건
## 19. P1 FAIL — 0건
## 20. 확인 불가
- 실제 Google OAuth 로그인 왕복과 복귀
- `/doit/*` 로그인 후 화면의 실제 렌더
- 실기기(휴대폰) 동작

## 21~22. FINAL ZIP
`ECHO-DOIT-NETLIFY-FINAL-20260920.zip` · 389,967 바이트 (0.37 MB) · 104개 항목
최상위: index.html · assets/(100) · favicon.svg · _headers · _redirects
JS 98개 · CSS 2개 · .js.map 0 · sourceMappingURL 0 · .env 0 · src/ 0 · supabase/ 0 · package*.json 0

SHA-256: `d3af13b5ce04491b0e80a59b7385d42795b1bb7e5bbe0eeff850259990609241`

## 23. 운영 배포 실행 여부 — **하지 않음**
DB·Migration·RLS·Secret·OpenAI 모델·결제·Supabase Edge 운영 함수·Netlify 배포·파일 삭제 모두 변경 0.

## 최종 판정
**배포 가능 — 코드·빌드·렌더 기준 FINAL 배포 후보.**
실제 Google 로그인과 실기기 확인 전에는 "100% 완료"가 아니다.

남은 것: Purpose 선택지 DB 연동(목표 미달), package-lock 재현성(위험), 실기기·OAuth 실사용 확인(확인 불가).
