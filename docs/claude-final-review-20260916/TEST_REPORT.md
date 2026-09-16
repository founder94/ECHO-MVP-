# TEST_REPORT — ECHO 최종 검토·구현 3차 (2026-09-16, 2차 + 실사용 캡처 9장 '친구형 AI' 수정)

단계 표기: **코드 수정 완료 → 로컬 검사 완료 → 대표 승인(2026-09-16 "승인한다") → 서버 함수 배포 결과는 `DEPLOYMENT_PLAN_STOP.md` 에 기록 → 운영 확인은 NOT RUN**. 운영주소·실계정·실기기 확인 전이므로 "최종 완성"이라고 쓰지 않는다.

## 1. 실행 환경
- 기준본: `ECHO_CLAUDE_COMPLETE_HANDOFF_20260916.zip` (SHA-256 `ba8aaf98…7515`) → PROJECT_SOURCE. `FULL_SOURCE_SHA256.txt` 310/310 일치.
- 운영 원문: Supabase `zyyhhxyupizcqhxqnxuu` Edge 7종 회수. 배포 전 기준 6종 바이트 동일, echo-payment 끝 줄바꿈 1자 차이(`evidence/deployed/`).
- 도구: Node 22 `node:test`, Vite 8.3, tsc 5.8, ESLint 9, Playwright 1.56 + 헤드리스 Chromium(외부 요청 전부 가로챔). Deno 없음. WebKit 엔진 없음(iPhone 은 크기·UA 에뮬레이션).
- 빌드 입력: 공개값만(`VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY` sb_publishable_ 형식, `VITE_A_STRUCTURE_SERVER_ENABLED=true`). 운영 배포본(JWT anon 키)과 JS 해시는 다르다.

## 2. 기준본·검수문 대조 (일치 / 불일치 / 확인 불가)
| # | 항목 | 실제값 | 판정 |
|---|---|---|---|
| 1 | FULL_SOURCE_SHA256 310개 | 310/310 | 일치 |
| 2 | 운영 함수 = 로컬 원문 | 6/7 동일, echo-payment 줄바꿈 1자 | 일치 |
| 3 | 기존 QA 47/47·tsc·build | 재현 | 일치 |
| 4 | ESLint | ZIP 에 `eslint-rules/route-element-jsx.js` 없음 → 복구 후 PASS | 불일치(패키징) |
| 5 | 배포 기록 "DB 변경 없음" | 0916 마이그레이션 2건 적용됨 | 불일치(문서) |
| 6 | 운영 AI 오류(24h) | AbortError 0, HTTP 오류 0; `validate_fail` 15건 → 짝 실패 6곳 = NO_CANDIDATE 6회 | 불일치(수정) |
| 7 | 결제 승인 뒤 화면 | `/white-door` 우회 | 불일치(수정) |
| 8 | 갤럭시 홈 패치 | 기준본 미반영 | 불일치(병합) |
| 9 | 검수문 P0-1~P0-5, P1-2, P1-6(STEP_THEMES·sourcemap) | 현재 기준본에서 이미 해결(근거: OPINION 7장) | 일치 |
| 10 | 검수문 P0-6 리포트 confirmed AI 결정 | `parseReport` 가 AI status 그대로 수락 | 불일치(수정) |
| 11 | 검수문 P1-1 시간 초과 후 busy 잠금·STEP 1·2 대기 제한 없음 | 재현(save-controllers 기존 테스트가 busy 를 기대) | 불일치(수정) |
| 12 | 검수문 P1-3 /doit/profile 예시 | `myProfile` 예시 표시 | 불일치(부분 수정) |
| 13 | 검수문 P1-5 타로 뒤 대화 실패 시 칸 이동 | `goNext` 가 실패해도 index+1 | 불일치(수정) |
| 14 | 검수문 P1-6 Stripe 의존성 | package.json 잔존, import 0건 | 불일치(수정) |
| 15 | 검수문 P1-4 공간·방·미션 예시 | 예시 그대로 | 미해결(범위 밖, 보고만) |
| 16 | RLS·role 잠금·브라우저 SELECT-only·reports paid 정책 | 실측 일치 | 일치 |
| 17 | iOS 입력 자동 확대 위험 | 입력칸 글자 14px(text-sm) 10곳 | 불일치(수정) |
| 18 | dvh 미지원 iOS 폴백 | `min-h-[100dvh]` 8곳 폴백 없음 | 불일치(수정) |
| 19 | 실제 Toss 승인 / 관리자 로그인 육안 / 실기기 / Deno | — | NOT RUN |

## 3. 수정 뒤 실행한 검사
### 3-1. 정적
| 검사 | 결과 |
|---|---|
| `npm run type-check` | PASS(종료 0) |
| `npm run lint`(규칙 파일 복구 후) | PASS(종료 0) |
| `npm run build` | PASS(`assets/index-CqAhazqn.js`, 96 자산, `.map` 0) |
| 배포 전 검사기 `predeploy-check.sh`(코드 분할 `grep -h` 교정) | ARTIFACT VERIFIED |
| 번들 금지 패턴(`test_sk_`, `service_role`, `sb_secret_`, `stripe`, "결제하면") | 0건 |
| 번들 필수 문구 4종 | 존재 |
| Edge 단일 파일 검사기(`edge-predeploy-check.sh`) | NOT RUN(실행 도구 정책 차단; 배포 후 바이트 대조로 대체) |

### 3-2. QA 스위트(node:test) — 60/60 PASS (3차)
admin-dashboard-contract 8 · full-flow-edge-simulation 11(리포트 확정 서버 판정 단언 추가) · question-salvage 6 · save-first-dialog 4(지연 예산: 시도 3회로 갱신) · step7-contract 5 · question-context 14 · save-controllers 5(시간 초과 뒤 재시도 허용으로 기대값 갱신) · **companion-rules 7(3차 신규: 실사용 문장 판정·asked 모드·되받아치기 제거·3번째 완화·완화에서도 금지어 차단·get-step-question 거울 규칙)**.

### 3-3. 브라우저 실행 검사(검사한 빌드, 서버 가짜 응답) — 28/28 PASS
| 시나리오 | 확인 |
|---|---|
| S1 비로그인 | `/payment`·`/report`·`/step/7` → `/login`, `/admin/mobile` → `/admin/login` |
| S2 STEP 7 완료·미결제 | White Door 는 서버 `report_ready` 에서만; 결제 화면 "결제 준비 중"(비활성)+문구 4종; 강제 클릭에도 주문 0·Toss 0; `/report` 직접 진입 → 결제 안내, 생성 요청 0 |
| S3 STEP 7 진행 | 저장 전 `/white-door` → `/step/7` 되돌림; 서버 질문 표시; 390px 가로 스크롤 0; 3회 연속 클릭 → answer 1건(토큰 포함); 저장 뒤에만 White Door; 결제 함수 0 |
| S4 저장 실패·재시도 | 오류 표시 + 원문 보존 → 재시도 성공 → `/step/6`; 두 요청 토큰 동일; 새 질문은 별도 ask |
| S5 기존 구매자 | 리포트 재열람; 결제 화면 진입 시 리포트 직행, 재결제 0 |
| S6 모바일 5종(Galaxy 390·360, iPhone 393·375·430, 각 UA·DPR) | `/step/7`·`/weather-check`·`/white-door`: 가로 스크롤 0, 버튼 화면 밖 0, 입력칸 글자 ≥16px |
캡처 `evidence/flow-smoke/S6_<폭>_step7.png`, `S2_payment_pending_390.png`, `S5_report_390.png`.

### 3-4. 홈 반응형 11개 폭(320~1920) — PASS(`evidence/responsive/final_results.json`)

## 4. 지시서·검수문 검사 항목별 결과
| 항목 | 결과 | 증거 |
|---|---|---|
| 정상 답변 1~7 완주 / 모르겠어요 반복 / 말했잖아·같은 질문 / 그게 아니에요 / 직접 설명 | PASS | full-flow 11건, question-context 14건 |
| 저장 실패·질문 생성 실패·시간 초과·재시도·새로고침 | PASS | full-flow 'AI failure after a saved answer', save-controllers(시간 초과 뒤 같은 토큰 재시도), 브라우저 S4 |
| 30초 무응답 뒤 입력 보존·복구 가능 | PASS(단위) | save-controllers: timeout → isInFlight false → 같은 토큰 재전송 성공 |
| 동일 시작 요청 2회·동시 요청·응답 유실 후 재시도 | PASS | full-flow, 서버 claim + DB unique(user_id, request_token) |
| STEP 7 조기 완료 방지 / 무료 구간 결제 0 | PASS | 브라우저 S2·S3, full-flow |
| 미결제·타 사용자 리포트 차단 / 구매자 재열람 / 결제 후 STEP 3 되돌림 없음 | PASS | full-flow, RLS, 브라우저 S2·S5 |
| 근거 없는 confirmed 거부 | PASS | full-flow 리포트 상태 단언 `['confirmed','confirmed','candidate','candidate']` |
| 관리자 권한·집계·KST | PASS | admin-dashboard-contract |
| 프로필 입력→저장→재로그인→표시 | PASS(코드 연결) / 실계정 왕복 NOT RUN | profile page `loadProfile` |
| 320~1440px + Galaxy/iPhone 크기 | PASS(에뮬레이션) / 실기기 NOT RUN | 3-3 S6, 3-4 |
| 실제 Toss 승인 · 관리자 로그인 육안 · Deno · WebKit 실기기 | NOT RUN | — |

## 5. 수정 파일 (PATCH/, 그룹별 해시는 SOURCE_MANIFEST.json)
- server(3): `get-step-question/index.ts`(2차 tidy·soften·shape 로그 + **3차 asked·되받아치기·3회·완화·지난 여정 요약**), `echo-journey/index.ts`(2차 후보 정리·`[ej]` 진단·리포트 confirmed 서버 판정 + **3차 동일 규칙**), `echo-journey/question-quality.ts`(변경 없음, 배포 짝 파일로 동봉)
- qa 3차: `qa/companion-rules.test.mjs`(신규 7건), `qa/save-first-dialog.test.mjs`(시도 3회)
- frontend_timeout_recovery(3): `api.ts`(40/75초 상한, reason 'timeout'), `startSave.ts`, `journeySave.ts`(시간 초과 뒤 잠금 해제)
- frontend_payment_routing(2): 결제 승인·기결제 → `/report`
- frontend_mobile_dvh_fallback(9): 여정 8곳 + Suspense 폴백 `echo-min-h-viewport`, `WeatherEffect.tsx` blur 제거
- doit_profile_and_tarot(3): `/doit/profile` 실제 값 연결, 타로 실패 시 칸 유지
- dependency_stripe_removal(2): package.json, package-lock.json
- responsive_galaxy_fix_and_ios_input(9): 홈 9파일 + `index.css` 모바일 입력 16px
- qa(4), packaging_restore(1)

## 6. NOT RUN 요약
실제 Toss 승인 · 운영 관리자 로그인 육안 · Deno check/test · WebKit(iPhone Safari) 실기기 · 갤럭시 실기기 · OpenAI 실호출 · 프로필 실계정 왕복 · Edge 단일 파일 검사기(정책 차단, 배포 후 바이트 대조로 대체) · **3차: 실기기에서 asked 모드·STEP 4 통과 재현(대표 확인 대기)**.

## 7. 3차(친구형 AI) 요약
원인·수정·증거는 `COMPANION_FIX_REPORT_20260916.md`, 결제 구조 전략은 `PRICING_STRATEGY_20260916.md`. 서버 배포 결과(v12/v21, 바이트 대조)는 `DEPLOYMENT_PLAN_STOP.md` 0장.
