# 결제 비활성 버전 배포 인계 (2026-09-13 · 기존 1회 조건부 Publish 승인 집행)

## 배포 파일 (고정 · 재생성 금지)
- `doit-company_netlify-deploy_2026-09-13_payment-pending.zip` · 309,504 bytes
- SHA-256 `0fce51a04b5320f235eb81a369d7e79320b1daba4bd2459ccea2fd30dcc27237`
- 기준본: Readdy project-13865617 + PATCH C (결제 게이트 review_pending). A 음악카드(V458) 미포함.
- 판정: ARTIFACT VERIFIED (검사기 회귀 5/5 · 동일 ZIP 재검사 17/17 · 브라우저 결제 비활성 17/17 · 금지 요청 시도 0)

## 배포 대상 (기존 사이트만)
- Netlify 사이트 `echo-mvp-doit` · site ID `7a4934db-aff3-437d-815a-ffbf49d4b819` · 도메인 do-it.company
- 직전 deploy ID: **NOT RUN** — 이 작업환경에 Netlify 토큰·CLI 없음, 운영 도메인 HTTP 조회는 프록시 403. 대표가 Deploys 탭 최상단 항목의 ID·시각을 업로드 전에 메모한다(전략본부 읽기 조회값이 있으면 그것과 대조).
- 업로드 전 확인: Deploys 최상단이 직전에 알고 있던 배포와 다르면(예상 밖 새 배포) 올리지 말고 그 항목만 보고.

## 대표 수동 업로드 절차 (Claude 는 배포 도구 없음 → DEPLOY NOT RUN)
1. ZIP 압축 해제 → `index.html`, `_redirects`, `favicon.svg`, `assets/` 가 바로 보이는 폴더 확인.
2. Netlify → Sites → `echo-mvp-doit` → **Deploys** 탭 → 하단 "Drag and drop your site output folder here" 영역에 그 폴더를 통째로 드롭.
3. 상태가 **Published** 로 바뀌면 그 항목의 deploy ID·시각을 메모.
4. 금지: 새 사이트 생성 · "Trigger deploy" · Git 연동 재빌드 · 환경변수 변경 · DNS/도메인 변경 · 모바일 사이트(doitmobile) 건드리기.

## 배포 후 확인 (대표 · 비거래성만)
| 항목 | 방법 | 기대 |
|---|---|---|
| 운영 자산 대조 | 휴대폰/PC 브라우저에서 do-it.company 열고 페이지 소스(또는 Netlify Deploys → 해당 배포 → Preview) | index.html 이 `assets/index-ClIZ7hx1.js` · `assets/index-DE6Ohtm9.css` 를 참조 |
| 홈·여정 선택·새로고침 | 평소처럼 접속 | 빈 화면·무한 로딩 없음 |
| 로그인 콜백 | 구글 로그인 → 돌아오기 | 기존과 동일하게 복귀 |
| 관리자 화면 | 대표 계정 | 기존과 동일 |
| 결제 화면 | 기존 대화로 White Door → 결제 화면 | 4,900원 표시 · "현재 결제 서비스를 준비하고 있어요." · 버튼 `결제 준비 중` 눌리지 않음 · "조금 더 생각해 볼게요" 동작 |
| 금지 | 실제 결제·승인·취소·환불 · 새 주문 만들기 시도 | 하지 않음 |

새 사용자·대화·주문·KEY 행을 만들지 않는다. 운영에 시험용 세션·응답을 넣지 않는다.

## 보고 양식 (대표 → Claude/GPT)
```
업로드: 했음/안 했음
직전 deploy ID·시각: ______
새 deploy ID·시각·상태: ______
index.html 자산: index-ClIZ7hx1.js / index-DE6Ohtm9.css 맞음/다름
결제 화면: 결제 준비 중 버튼 비활성 확인/미확인
이상: 없음/있음(내용)
```
대표 보고가 오면 Claude 가 DEPLOY CONFIRMED("결제 비활성 버전 배포 반영 확인")로 기록을 갱신한다. 그 전까지 DEPLOY NOT RUN.

## 범위 유지
- PAYMENT_GATE='review_pending' 유지 · 토스키 요청 없음 · 키 발급만으로 자동 enabled 전환 없음.
- success 안내 줄바꿈: 다음 릴리스 표시 개선 항목(이번 파일 재빌드 없음).
- 운영 DB·RLS·RPC·Edge·관리자 role·KEY·P2(STAGING_QUOTA_BLOCKED)·echo-payment·4,900원·약관 변경 0.

## 대표 보고 수신 (2026-09-13)
- 대표: "배포했다" (대상·deploy ID·시각 미기재).
- Claude 측 운영 확인: do-it.company HTTP 조회 재시도 → 프록시 차단(403) → 운영 자산 대조 NOT RUN 유지.
- 상태: **DEPLOY REPORTED BY OWNER · 미확인**. 대표의 보고 양식(새 deploy ID·시각·자산명·결제 화면) 수신 후 DEPLOY CONFIRMED 로 갱신.
