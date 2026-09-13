# 결제 비활성 배포 후보 검사 로그 · 2026-09-13T09:44:32Z

소스: 래디 project-13865617 (SHA-256 9156ed5f…) + PATCH C(결제 게이트 3파일)
빌드: VITE_A_STRUCTURE_SERVER_ENABLED=true npm run build (vite build, mode production)

```
type-check exit 0 / lint exit 0 / build 성공 (✓ built in 4.60s)

 ✓ readdy-review/payment-gate/gate.test.ts (6 tests) 5ms
      Tests  6 passed (6)

PASS  Supabase URL 호스트 = 의도한 운영 ref (zyyhhxyupizcqhxqnxuu)
PASS  anon 키 형식 = sb_publishable_ (공개 키)
MODE  결제 비활성(토스 심사 대기): 주문 생성·SDK 로드·결제창·승인 요청이 게이트로 차단됨. Toss 키 미설정은 예상 상태
PASS  Toss 클라이언트 키 미설정 = 예상 상태(비활성 모드)
PASS  VITE_A_STRUCTURE_SERVER_ENABLED=true (운영 승인값과 동일)
PASS  out/index.html 존재
PASS  자산 존재: favicon.svg
PASS  자산 존재: assets/index-ClIZ7hx1.js
PASS  자산 존재: assets/index-DE6Ohtm9.css
PASS  _redirects SPA fallback
PASS  .map 파일 없음 (있으면 ZIP 생성 시 -x '*.map' 로 제외하고 재검사)
PASS  inline source map 없음
PASS  번들 내 서버 secret 패턴 0
PASS  번들 내 Supabase 호스트 = zyyhhxyupizcqhxqnxuu 만 (zyyhhxyupizcqhxqnxuu.supabase.co )
PASS  번들에 '결제 준비 중' 버튼 라벨 포함
PASS  번들에 결제 준비 중 안내 문구 포함 (게이트 상수는 번들러가 접어 문자열로 남지 않음)
PASS  잘못된 endpoint(미리보기·옛 프로젝트·로컬) 없음
RESULT: ARTIFACT VERIFIED
```

---

## 추가 검사 (2026-09-13 · GPT 지시 "PATCH C 유지·검사기 교정·최종 브라우저 확인")

### 1) 검사기 결함 재현·교정
- 결함: `grep -c 패턴 out/assets/*.js | awk -F: '{s+=$2}'` — JS 파일이 1개면 grep -c 가 `파일명:` 접두 없이 숫자만 출력 → awk $2 비어 합계 0 → **거짓 PASS**. 합성 마커 1건으로 재현(구 검사기 VERIFIED / 신 검사기 HOLD).
- 교정: `scan_js` (파일별 grep -c 합산, 파일 0개=ERR_NOFILES, 읽기 불가=ERR_UNREADABLE, grep 오류=ERR_GREP) + `chk_zero` (숫자 0 만 PASS, 검출·오류는 FAIL/HOLD). inline source map·서버 secret·잘못된 endpoint 3개 검사 모두 이 경로로 통일(기존 `! grep -q` 형태도 파일 0개일 때 거짓 PASS 가능했음). 일치 내용은 출력하지 않음. `OUT` 환경변수로 검사 대상 폴더 지정 가능(ZIP 추출본 재검사용). diff: `PREDEPLOY_CHECK_FIX_2026-09-13.diff`
- 회귀시험 `tests/predeploy-check.regression.sh` 5/5 (clean 1파일=PASS/VERIFIED, 마커 1파일·다중파일 중 1건·JS 없음·읽기 오류=FAIL/HOLD). 로그: `tests/REGRESSION_LOG_2026-09-13.md`

### 2) 동일 ZIP 재검사 (재빌드 없음)
- `doit-company_netlify-deploy_2026-09-13_payment-pending.zip` SHA-256 `0fce51a04b5320f235eb81a369d7e79320b1daba4bd2459ccea2fd30dcc27237` (309,504 bytes) — 이전 보고와 동일.
- 임시 폴더에 추출(5파일: index.html, _redirects, favicon.svg, assets/index-ClIZ7hx1.js, assets/index-DE6Ohtm9.css) → 교정 검사기로 `OUT=<추출본>` 재검사 **17/17 PASS · RESULT: ARTIFACT VERIFIED** (서버 secret 패턴 실제 검출 0, JS 1개). 추출본은 readdy-new/out 과 바이트 동일.

### 3) 실제 브라우저 확인 (로컬 하네스 · 운영 서버 요청 0)
- 도구: Playwright 1.56.1 + 헤드리스 크로미움 1194, 390×844, ZIP 추출본을 로컬 SPA 서버(`tests/browser/spa-server.mjs`)로 서빙. 모든 비-로컬 요청 가로채기: 세션은 localStorage 주입(가짜 JWT·서명 없음), `get-step-question resume` → `white_door_ready` 모킹, `rest/v1/profiles` → 201 모킹, `echo-payment`/`js.tosspayments.com` 은 **카운트 후 차단**, 그 외 외부(폰트·아이콘 CSS CDN 4종 = 래디 원본 index.html 자산)는 차단. 스크립트: `tests/browser/payment-gate.browser.mjs`, 결과: `tests/browser/payment-pending_browser_report.json`
- 결과 **17/17 PASS · BROWSER VERIFIED**:
  - /payment: 4,900원 · "현재 결제 서비스를 준비하고 있어요. / 결제는 아직 진행되지 않습니다." · 버튼 `결제 준비 중` disabled · 활성 결제 버튼 없음 · 새로고침 안정 · "조금 더 생각해 볼게요" → /white-door?c=… (evidence/payment-pending_01_payment.png, _02_back.png)
  - 비활성 버튼 강제 클릭 3종(force click / el.click() / dispatchEvent) 후에도 아래 전부 0
  - /payment/success?c=…&paymentKey=TEST_ONLY&orderId=TEST_ONLY&amount=4900 직접 진입·새로고침: "결제가 확인되지 않았어요." + 준비 중 안내, STEP 3 이동 없음, "다시 결제하기" → /payment(여전히 disabled) (evidence/payment-pending_03_success.png)
  - 비로그인 직접 진입 → /login
- 금지 요청 시도 수: createOrder **0** · Toss SDK 로드 **0** · window.TossPayments 접근(requestPayment 경로) **0** · confirmPayment **0** · echo-payment 함수 호출 전체 **0**. 콘솔 오류 0(차단된 CDN 자산의 ERR_BLOCKED_BY_CLIENT 제외).
- 한계: 로컬 모킹 환경(운영 Supabase·Toss 미접속). 운영 주소 실기기 확인은 배포 후 대표가 수행.

### 4) 앱/번들 변경 여부
- 없음. 앱 코드 오류 미발견 → 재빌드·새 해시 없음. 변경은 검사기(predeploy-check.sh)·시험 스크립트·문서만.
- 참고(치명 아님, 다음 래디 릴리스에서): /payment/success 안내 문단에 `whitespace-pre-line` 이 없어 두 문장이 한 줄로 이어짐(내용 동일).

### 5) 배포
- **DEPLOY NOT RUN** (Claude 수행 안 함). 업로드 대상: Netlify 사이트 `echo-mvp-doit` (7a4934db-aff3-437d-815a-ffbf49d4b819 · do-it.company) Deploys 탭에 ZIP 추출 폴더 드래그 앤 드롭. "Trigger deploy" 금지(Netlify 환경변수는 옛 ref).
