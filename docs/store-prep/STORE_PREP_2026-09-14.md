# 스토어 등록 준비표 (Apple App Store · Google Play) — 2026-09-14 · 설계·준비목록 단계
기존 Vite+React 웹앱(project-13871930)을 Capacitor 로 감싸는 방식 기준. 새 로고·브랜드 없음(기존 DO IT 로고·심볼 사용). 이번 회차: 가입비 결제·계약·서명·제출·공개 0.

## A. Capacitor 패키징 적합성 실측 (로컬 dry-run · 산출물은 검증된 out/ 사용)
| 단계 | 결과 |
|---|---|
| `@capacitor/core cli android ios` 8.5.2 설치 | 성공 |
| `cap init "DO IT" company.doit.app --web-dir out` | 성공 (`capacitor.config.dryrun.json`) |
| `cap add android` / `cap add ios` | 성공(프로젝트 골격 생성) |
| `cap sync android` (out/ → assets/public 복사) | 성공 |
| Android AAB `gradlew bundleRelease` | **NOT RUN(실패)** — Android Gradle Plugin 8.13 다운로드가 이 환경 프록시에서 차단. Android SDK 도 없음. 대표 PC 또는 CI(GitHub Actions) 필요 |
| iOS 빌드 | **NOT RUN** — macOS·Xcode 없음 |
- 소스 적합성: 라우터 = `BrowserRouter`(basename) → Capacitor 의 `capacitor://localhost`/`https://localhost` 에서 SPA 동작 가능(딥링크 복귀는 별도). 앱 식별자 제안 `company.doit.app`(대표 확정 필요).

## B. 준비표 (구현됨 / 미구현 / 대표 확인)
| 항목 | 상태 | 비고 |
|---|---|---|
| Apple/Google 개발자 계정 가입 | **대표 확인 필요(NOT RUN)** | 미가입 가정. Apple 연 $99, Google 1회 $25 |
| 법적 명의·개인/조직 요건 | 확인 필요 | 사업자 '두잇(DO IT)' 등록번호 있음 → 조직 계정 가능. Apple 조직 계정·Google 조직 계정 모두 **D-U-N-S 번호** 필요(무료, 발급 수 일). Google 개인 계정은 출시 전 12명·14일 비공개 테스트 요건 → 조직 계정 권장 |
| 앱 이름·식별자·서명키 | 미확정 | 이름 "DO IT"/"ECHO" 대표 결정. 식별자 `company.doit.app`(제안). Android 업로드 키 = 대표 소유(Play App Signing 권장), iOS 인증서·프로비저닝 = 대표 Apple 계정 소유. Claude·래디는 키를 보관하지 않음 |
| AAB / iOS 빌드 환경 | 미구축 | Android: 대표 PC(Android Studio) 또는 GitHub Actions. iOS: Mac + Xcode 필수(대표 또는 클라우드 맥) |
| 앱 안 Google 로그인 복귀 | **미구현(차단 요소)** | 현재 `signInWithOAuth` redirectTo = `window.location.origin/auth/callback`. 앱에서는 origin 이 `capacitor://localhost` 라 복귀 불가. Google 은 WebView 내 OAuth 를 거부 → 시스템 브라우저(Capacitor Browser) + 앱 링크/커스텀 스킴 복귀 + Supabase Redirect URL 추가 필요 |
| Apple 로그인 요건 | **미구현(차단 요소)** | iOS 앱에 Google 로그인이 있으면 Sign in with Apple 도 제공해야 함(App Store 심사 지침 4.8). Supabase Apple provider 설정 + 화면 버튼 필요 |
| 카메라 | 구현됨(웹 getUserMedia) | Android WebView 권한 브리지·iOS `NSCameraUsageDescription` 문구 필요. 거부 시 `CAMERA_UNAVAILABLE` 처리 존재 |
| 음악(A 카드 원음) | 구현됨 | 자체 저작 mp3 → 라이선스 이슈 없음. 홈 BGM(YouTube 숨김 재생)은 약관 리스크(에이전시 문서 검토 참조) → 앱 제출 전 교체 권장 |
| 권한 거부·뒤로가기 | 부분 | 웹 뒤로가기는 라우터. Android 하드웨어 뒤로가기는 Capacitor App 플러그인 처리 필요 |
| 개인정보처리방침 페이지 | **미구현** | 소스에 privacy 페이지 0건. 스토어 필수(URL). 대표 법령 검토 후 페이지 추가 |
| 계정 삭제 | **미구현(데모 문구)** | 설정 화면 "내 데이터 삭제/탈퇴 요청 접수 (데모)" → 실제 삭제 없음. Apple 5.1.1(v)·Google 정책상 앱 내 계정 삭제 필수 → 서버 함수(auth.admin.deleteUser + 데이터 삭제) 설계 필요(STOP 게이트) |
| 신고·차단 | 부분 | 관리자 화면에서 `user_reports`·`blocks` 조회 있음. 사용자 화면의 실제 신고/차단 실행 경로는 확인 필요(UGC 지침 1.2) |
| 로고·스크린샷·소개·심사 접근 정보 | 준비 필요 | 기존 로고 사용. 스크린샷(휴대폰) 4장+, 소개문, 심사용 테스트 계정(로그인 필요 앱) |
| 결제(4,900원 리포트) | **정책 차단 요소** | iOS: 디지털 상품은 IAP 의무(3.1.1) → 웹 토스 결제 그대로 넣으면 리젝. Android: 한국은 제3자 결제 허용이나 Google 등록·수수료. 대안: 앱에서는 결제 진입 숨기고 웹에서만 결제(리더 앱 방식 검토) 또는 IAP 별도. 대표·GPT 결정 사항. review_pending·4,900·KEY 변경 없음 |
| 순서 | 계획 | 내부 시험(디버그 APK) → Google 비공개 테스트(조직 계정이면 요건 완화) / TestFlight → 심사 → 공개 |

## C. 역할
- 대표: 개발자 계정·D-U-N-S·서명키 소유·개인정보처리방침 법령 검토·결제 정책 결정·제출 버튼.
- Claude: Capacitor 설정·OAuth 복귀 설계·계정 삭제 서버 함수 초안·빌드 스크립트·검사.
- 래디: 로그인 화면에 Apple 버튼·개인정보 페이지·설정 화면 실제 삭제 연결(UI 만).
- 외부 빌드: Android Studio/CI, Mac+Xcode.

## D. 확인 불가 / NOT RUN
AAB·iOS 실제 빌드, 스토어 정책 문구의 최신 개정 여부(공식 문서 재확인 필요: Apple 4.8/5.1.1/3.1.1, Google 계정 삭제·테스트 요건·대체 결제), 대표 계정 보유 여부.
