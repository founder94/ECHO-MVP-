# TEST_REPORT — ECHO 최종 검토·구현 (2026-09-16)

완료 표현: **로컬 구현 및 실행한 검사 완료**. 운영 적용·운영 계정 로그인·실기기 확인은 하지 않았다(STOP).

## 1. 실행 환경
- 기준본: `ECHO_CLAUDE_COMPLETE_HANDOFF_20260916.zip` (SHA-256 `ba8aaf98…7515`) → `PROJECT_SOURCE/`. `FULL_SOURCE_SHA256.txt` 310개 항목 전부 실제 파일과 해시 일치(한글 파일명 27개는 ZIP 인코딩 차이로 이름만 달라 해시값으로 대조). ZIP 안 파일 중 목록에 없는 것은 `CLAUDE_EXECUTION_PROMPT.md` 1개뿐.
- 운영 원문: Supabase `zyyhhxyupizcqhxqnxuu` Edge 함수 7종을 읽기 전용으로 회수해 로컬과 diff. 6종 바이트 동일, `echo-payment` 는 끝 줄바꿈 1자만 차이(`evidence/deployed/*.diff`, `versions.json`).
- 검사 도구: Node 22 `node:test`(TypeScript 는 `typescript.transpileModule` / `--experimental-strip-types`), Vite 8.3 build, tsc 5.8, ESLint 9, Playwright 1.56 + 헤드리스 Chromium(로컬 정적 서버, 외부 요청 전부 가로챔). Deno 없음 → `deno test/check` NOT RUN.
- 빌드 입력: 공개값(`VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY`=sb_publishable_ 형식, `VITE_A_STRUCTURE_SERVER_ENABLED=true`)만 사용. 인계 ZIP 에는 `.env` 가 없어(의도된 제외) 운영 배포본과 JS 해시가 같을 수 없다. 운영 배포본은 JWT 형식 anon 키로 빌드됨(번들 실측). CSS 해시는 기준본 빌드와 동일(`index-XsuS-utj.css`) → 소스 동일성의 간접 증거.

## 2. 기준본 대조 결과 (일치 / 불일치 / 확인 불가)
| # | 항목 | 기대값 | 실제값 | 판정 |
|---|---|---|---|---|
| 1 | FULL_SOURCE_SHA256 | 310/310 | 310/310 (bad 0) | 일치 |
| 2 | EVIDENCE/SOURCE_MANIFEST 의 12개 파일 해시 | 문서값 | admin-dashboard `301a3e…`, admin-conversations `cfc118…` 등 로컬 파일 해시 동일 | 일치 |
| 3 | 운영 함수 = 로컬 원문 | 동일 | get-step-question v19·echo-journey v10·admin-dashboard v1·admin-conversations v2·openai-chat v2·doit-understanding v4 동일, echo-payment v2 끝 줄바꿈 1자 | 일치 |
| 4 | 운영 배포 번들 ezbr 해시 | 문서 `721f52…`, `ec72d8…` | `list_edge_functions` 동일 | 일치 |
| 5 | 전체 QA 47/47 | 47 통과 | 기준본 그대로 실행 47/47 통과 (`admin 8, full-flow 11, save-first 4, step7 5, question-context 14, save-controllers 5`) | 일치 |
| 6 | TypeScript / build | PASS | 기준본 tsc 종료 0, vite build 종료 0(공개 env 필요) | 일치 |
| 7 | ESLint PASS | PASS | 기준본 ZIP 만으로는 `Cannot find module './eslint-rules/route-element-jsx.js'` → 실행 불가. Readdy 원본에서 동일 파일 복구 후 PASS | 불일치(패키징) |
| 8 | Netlify ZIP 99파일·재해제 동일 | 99 | EVIDENCE ZIP 99파일, `_headers`·`_redirects`·`assets/` 최상위, `.map` 0 | 일치 |
| 9 | 번들 문구 | 고정 문구 4종, "결제하면 STEP 3~7" 0 | 4종 존재, 금지 문구 0, Supabase 호스트 1개 | 일치 |
| 10 | 배포 기록 "DB/RLS/마이그레이션 변경 없음" | 없음 | `list_migrations`: 2026-09-16 `admin_profile_privilege_lock`, `revoke_trigger_function_rpc_access` 2건 적용됨(승인 여부는 문서에 없음) | 불일치(문서) |
| 11 | 운영 표본 (일반 사용자 2, 오늘 STEP 7 완료 1, paid 0, 과거 white_door_ready 1) | 문서값 | profiles user 2·admin 1, conversations report_ready 3 / white_door_ready(current_step 3) 1, payments 0행, reports 0행, STEP 7 사용자 답변 journey_answer 2 + kind null 1 | 일치(오늘 기준 1건은 시각 창 검증 NOT RUN) |
| 12 | 관리자 role 자기 승격 차단 | 차단 | 트리거 `pa_profiles_role_lock` + authenticated 의 role 컬럼 UPDATE 권한 없음 | 일치 |
| 13 | 브라우저 쓰기 권한 | SELECT 만 | conversations·messages·emotions·understanding_results·payments·reports = SELECT only | 일치 |
| 14 | reports RLS | 본인+완료+paid | `reports_select_paid_completed_own` 존재 | 일치 |
| 15 | 운영 AI 오류 | — | 24시간: AbortError 0, HTTP 오류 0, 최대 실행 7.3초; `validate_fail` 15건(NOT_QUESTION 8, NOT_GROUNDED 5, MULTIPLE_QUESTIONS 2) 중 attempt 1·2 짝 실패 6곳 → NO_CANDIDATE 6회로 계산 | 불일치(실사용 막힘 → 수정) |
| 16 | 갤럭시 Chrome 홈 배경 잘림 패치 | 반영 | 기준본 9파일이 패치 전 원본과 바이트 동일 → 미반영 | 불일치(병합) |
| 17 | 실제 Toss 승인 | NOT RUN | 호출 0건(가짜 fetch 가 차단) | 확인 불가(정책) |
| 18 | 관리자 계정 로그인 육안 | NOT RUN | 세션 없음 | 확인 불가 |

## 3. 수정 뒤 실행한 검사
### 3-1. 정적 검사
| 검사 | 결과 |
|---|---|
| `npm run type-check` (tsc --noEmit) | PASS (종료 0) |
| `npm run lint` (eslint --max-warnings 0, 규칙 파일 복구 후) | PASS (종료 0) |
| `npm run build` (vite 8.3, 공개 env) | PASS (`out/assets/index-Bed2Fzz_.js`, 95 자산, `.map` 0) |
| 배포 전 검사기 `predeploy-check.sh` (코드 분할 빌드용 `grep -h` 교정 후) | ARTIFACT VERIFIED (검사기 자체 회귀 5/5) |
| 번들 금지 패턴(`test_sk_`, `service_role`, `sb_secret_`, `OPENAI_API_KEY`, "결제하면", "STEP 3~7 개방") | 0건 |
| 번들 필수 문구("1~7단계 대화는 무료예요", "자기이해 리포트 · 1회", "결제 준비 중", "자동 결제나 구독은 없어요") | 전부 존재 |

### 3-2. QA 스위트 (node:test) — 53/53 PASS
| 파일 | 결과 | 비고 |
|---|---|---|
| qa/admin-dashboard-contract.test.mjs | 8/8 | 관리자 CORS·JWT·역할 재확인·마스킹·KST 경계·0 과 오류 구분 |
| qa/full-flow-edge-simulation.test.mjs | 11/11 | 무료 1~7 완주·결제 0건 / enabled 픽스처 결제는 STEP 7 뒤·STEP 3 되돌림 없음 / 구매자 새로고침 / 모르겠어요·짧은 답·넘어갈게요 방향 전환 / 운영 사례(반복 주제 폐기) / Plan B 정정 / 정상 답변 / 과거 진행·구매자 보존 / 거절 저장 후 다른 후속 / 미결제 리포트 차단 / 저장 뒤 AI 실패 |
| qa/question-salvage.test.mjs (신규) | 6/6 | 끝 장식 정리, 짧은 공감 되묻기 → 마침표, 진짜 두 질문·비질문·꼬리 문장은 거절 유지, 근거·금지어 규칙 유지, 두 서버 후보 정리, 결제 후 리포트 직행 계약 |
| qa/save-first-dialog.test.mjs | 4/4 | 저장 먼저·질문 별도, 지연 예산 |
| qa/step7-contract.test.mjs | 5/5 | 계약 1건을 새 동작(승인 뒤 /report 직행)으로 갱신 |
| qa/question-context.test.ts | 14/14 | 피드백·저정보·정정 근거 규칙 |
| qa/save-controllers.test.ts | 5/5 | 시간 초과·busy·stale·토큰 유지 |

### 3-3. 브라우저 실행 검사 (검사한 빌드 그대로, 서버 함수는 가짜 응답, 390px Android 에뮬레이션) — 23/23 PASS
| 시나리오 | 확인 |
|---|---|
| S1 비로그인 | `/payment`·`/report`·`/step/7` → `/login`, `/admin/mobile` → `/admin/login` |
| S2 STEP 7 완료·미결제 | White Door 는 서버 `report_ready` 에서만 열림 → "리포트 안내 보기" → 결제 화면 "결제 준비 중"(비활성)+안내 문구+상품·설명 문구; 버튼 강제 클릭에도 echo-payment 0건·Toss 0건; `/report` 직접 진입 → 결제 안내로, 리포트 생성 요청 0건 |
| S3 STEP 7 진행 | 저장 전 `/white-door` 직접 진입 → `/step/7` 되돌림; 서버 질문 표시; 390px 가로 스크롤 0; "이야기 마무리하기" 3회 연속 클릭 → answer 1건(토큰 포함); 저장 뒤에만 White Door; 결제 함수 0건 |
| S4 저장 실패·재시도 | 오류 표시 + 입력 원문 보존 → 재시도 성공 → `/step/6`(서버 상태로만 이동), 두 요청의 토큰 동일, 새 단계 질문은 별도 ask 로 표시 |
| S5 기존 구매자 | 리포트 재열람; 결제 화면 진입 시 리포트로 직행, 재결제 0건 |
캡처: `evidence/flow-smoke/S2_payment_pending_390.png`, `S5_report_390.png`; 원본 결과 `flow-smoke_results.json`.

### 3-4. 반응형(홈, 갤럭시 패치 병합 후 코드 분할 빌드) — 11개 폭 PASS
320/360/375/390/412/430/768/1024/1280/1440/1920: 가로 스크롤 0, 카드·버튼 6개 화면 안, 헤더 겹침 0, 배경층 filter/backdrop-filter 0, 스크롤 후 헤더 배경, 앵커 후 제목 헤더 아래. 원본 `evidence/responsive/final_results.json`.

## 4. 지시서 항목별 결과
| 지시 항목 | 결과 | 증거 |
|---|---|---|
| 정상 답변 STEP 1~7 완주 | PASS | full-flow 'current human-conversation engine…', 'review_pending allows STEP 1~7…' |
| 모르겠어요 STEP 4부터 반복 → 같은 주제 반복 없음 | PASS | full-flow 'uncertain, brief, and skip…', 'production incident…' |
| 말했잖아·같은 질문이야 → 사과 반복 없이 새 관점 | PASS | question-context(feedback kinds), full-flow Plan B |
| 그게 아니에요 후 폐기 뜻 재등장 없음 | PASS | full-flow 'understanding rejection is saved first…' + `blocked()` 규칙 |
| 직접 설명 반영 | PASS | `priorityNote` + question-context correction evidence |
| 짧은 답·긴 답·무관한 답·공백·특수문자 | PASS(공백은 서버 BAD_REQUEST, 특수문자는 정규화 규칙) | question-salvage, question-context |
| 저장 실패·질문 생성 실패·시간 초과·재시도·새로고침 복원 | PASS | full-flow 'AI failure after a saved answer…', save-controllers, 브라우저 S4 |
| 중복 클릭·동시 요청 중복 저장 방지 | PASS | 브라우저 S3(1건), 서버 `claim` 조건부 UPDATE + DB unique(user_id, request_token) |
| STEP 7 저장 전 White Door 조기 이동 없음 | PASS | 브라우저 S3, white-door 페이지 규칙 |
| 무료 STEP 1~7 동안 결제 호출 0건 | PASS | full-flow, 브라우저 S2·S3 |
| 미결제·타 사용자 리포트 본문 차단 | PASS | full-flow 'unpaid completed conversation…', RLS 정책, 브라우저 S2 |
| 기존 구매자 리포트 재열람 | PASS | full-flow 'paid report entitlement survives refresh…', 브라우저 S5 |
| 결제 후 STEP 3 되돌림 없음 | PASS | full-flow enabled 픽스처(가짜 결제 픽스처이며 Toss 승인 시험이 아님), 브라우저 S5 |
| 관리자 아닌 사용자의 관리자 API 차단 | PASS(계약·정책) | admin-dashboard-contract, 운영 함수 requireAdmin 원문, RLS·트리거 실측 |
| 관리자 집계 실제 0 과 오류 구분 | PASS | admin-dashboard-contract |
| KST 오늘/7일/30일 경계 | PASS | admin-dashboard-contract |
| type-check / lint / build | PASS / PASS / PASS | 3-1 |
| 375/390/393/412/430px 모바일 | PASS(375·390·412·430 실측, 393 은 390·412 사이 값으로 별도 실측 NOT RUN) | 3-4, 브라우저 S3 |
| 음악·인증·홈페이지·A 구조 회귀 | 홈 11폭 PASS; 음악 M1·인증·A 구조 파일은 이번에 변경 없음(diff 0) — 실행 회귀는 NOT RUN | frontend.diff |
| 실제 Toss 승인 | NOT RUN(정책) | — |
| 운영 관리자 로그인 육안 | NOT RUN | — |
| Deno `server:check`/`server:test` | NOT RUN(환경에 Deno 없음; TypeScript transpile 경유 실행으로 대체) | — |

## 5. 수정 파일 (PATCH/, 기준본 대비 SOURCE_MANIFEST.json)
| 그룹 | 파일 | 내용 |
|---|---|---|
| server | `supabase/functions/get-step-question/index.ts` | `tidyQuestionText`·`softenLeadingQuestion`·`questionShape` 추가, `validateSingleQuestion`·`parseCandidates` 에 적용, `validate_fail` 로그에 `qmarks= tail=` |
| server | `supabase/functions/echo-journey/index.ts` | `tidyQuestionText` 를 후보 질문에 적용, `[ej] openai_fetch_error / openai_http / openai_empty / candidates_blocked / no_candidate` 진단 로그(원문 없음) |
| frontend | `src/pages/do-it/payment/success/page.tsx`, `src/pages/do-it/payment/page.tsx` | paid 확인 뒤 `/report` 직행(White Door 우회 제거), 불필요한 재조회·상태 제거 |
| qa | `qa/question-salvage.test.mjs`(신규), `qa/step7-contract.test.mjs` | 위 규칙 검사 6건, 계약 1건 갱신 |
| packaging | `eslint-rules/route-element-jsx.js` | 인계 ZIP 누락분 복구(Readdy 원본과 동일) |
| responsive | `src/index.css`, `src/pages/home/page.tsx`, `src/pages/home/scrollToSection.ts`(신규), `PastelBlobs.tsx`, `FloatingEffects.tsx`, `Navbar.tsx`, `Footer.tsx`, `src/components/ScrollToTop.tsx`, `src/components/MusicPlayer.tsx` | 2026-09-16 오전 갤럭시 Chrome 패치와 바이트 동일 |

## 6. NOT RUN 요약
실제 Toss 승인 · 운영 관리자 로그인 육안 · Deno 도구 · 393px 실측 · 음악/인증/A 구조 실행 회귀(변경 없음) · 실기기(갤럭시) 확인 · OpenAI 실제 호출로 `tidyQuestionText` 효과 확인(키 없음; 규칙은 단위 검사로만 확인).
