# ECHO 자동 화면 검사

브라우저가 가입·대화·정정·추천·설정 화면을 실제로 누르고 입력합니다. **앱 화면은 실제 빌드이고, 로그인·서버 응답·사진 저장소는 가상 자료입니다.** 운영 서버, QA 서버, AI 제공사, 결제 시스템에 연결하지 않습니다.

## 처음 실행할 때

Node.js 24를 사용합니다. 저장소 맨 위에서 시작합니다.

```sh
npm ci --no-audit --no-fund
cd product
npm ci --no-audit --no-fund
npx playwright install chromium
npx tsc -p tsconfig.e2e.json
npm run test:e2e
```

Linux에서 브라우저 실행에 필요한 시스템 파일이 없다면 `npx playwright install --with-deps chromium`을 사용합니다. 현재 검수 작업공간은 이미 설치된 Chromium으로 검사했습니다.

```sh
CHROMIUM=/usr/bin/chromium npm run test:e2e
```

평소에는 다음 세 가지 명령을 `product/`에서 사용합니다.

| 명령 | 하는 일 |
|---|---|
| `npm run test:e2e` | 전체 검사, 실패 시 즉시 표시. 자동 재시도 없음 |
| `npm run test:e2e:ui` | 검사 화면을 열어 하나씩 실행·관찰 |
| `npm run test:e2e:ci` | PR 자동 검사와 같은 설정. 최대 2회 재시도하되 재시도로만 통과하면 실패 처리 |

검사를 시작하면 app·brand·admin을 새로 빌드하고, 각각 **내 컴퓨터의** `127.0.0.1:4173`, `:4174`, `:4175`에서 엽니다. 이미 떠 있는 서버를 재사용하지 않습니다. 끝나면 검사 서버가 종료됩니다. UI 모드는 사람이 볼 때 쓰는 도구이며 이번 무인 검수에서는 UI 모드를 따로 실행하지 않았습니다.

## 검사 범위

| 여정 | 정상·실패를 확인하는 내용 | 파일 |
|---|---|---|
| J01 | 앱·홈페이지·메뉴·이용 안내·잘못된 주소·화면 너비·보안 정책 | `entry-auth.spec.ts`, `brand-admin.spec.ts` |
| J02 | 로그인·가입·필수 동의·가상 PKCE 복귀·만료 세션·주소의 토큰 주입 거부 | `entry-auth.spec.ts` |
| J03 | 프로필 복원·저장·빈 목적·저장 실패·사진 확인·업로드 실패와 재시도·새로고침 복원 | `profile-connections.spec.ts` |
| J04 | 주관식 답변·서버의 보기·넘기기·연결 끊김·중복 전송·전송 중 뒤로 | `conversation.spec.ts` |
| J05 | 정정 4버튼·직접 설명·저장 영수증·저장 실패 시 초안 보존 | `conversation.spec.ts` |
| J06 | 원문 출처 표시·기록 없음·검색 실패·잘못된 응답·새 브라우저·다른 가상 계정 | `conversation.spec.ts` |
| J07 | 이용 안내 열기·닫기·뒤로 가기와 입력 보존 | `conversation.spec.ts` |
| J08 | 후보 조회·빈 후보·오류·재시도·수동 실행·중복 방지 | `profile-connections.spec.ts` |
| J09 | 한쪽 선택 대기·양쪽 선택 후 효과·실패·공개 조건 보존 | `profile-connections.spec.ts` |
| J10 | 첫 답·상대 대기·허용된 대화·권한 오류 시 초안 보존 | `profile-connections.spec.ts` |
| J11 | 차단·신고 사유·연결 종료·실패 시 성공 문구 금지 | `profile-connections.spec.ts` |
| J12 | 로컬 사주·타로 오류·참고 대화·선택적인 질문·사용자 동의 후 자기 문장만 저장 | `fortune-settings.spec.ts` |
| J13 | 설치 안내·로그아웃 성공과 실패 | `fortune-settings.spec.ts` |
| J14 | 준비 중 기능·과거 결제 주소·자유 대화 권한과 한도·예산 오류 | `fortune-settings.spec.ts` |
| J15 | 관리자 전용 화면·빈 자료·조회 실패·일반 사용자 거부 | `brand-admin.spec.ts` |

## 자료와 로그인 상태

`fixtures.ts`는 테스트마다 고유 가상 사용자와 새 브라우저를 만듭니다. 로그인 자체를 검사하는 경우를 제외하면 가상 로그인 상태를 미리 넣으므로 매번 가입하지 않습니다. 요청·응답 상태는 테스트 하나 안에서만 사용합니다. 끝나거나 실패하면 대기 요청을 해제하고 브라우저와 가상 상태를 정리합니다.

사진은 브라우저에서 만든 단색 도형입니다. 사용자 얼굴·실제 생년월일·계정·키를 사용하지 않습니다. 사진 확인 체크는 UI 조건 검사이며 본인 인증 성공을 뜻하지 않습니다. 사진 요청 내용은 보고서에 저장하지 않습니다.

서버의 허용된 가상 요청만 응답합니다. 정의하지 않은 요청은 실패하며, 실제 외부 서버 요청도 차단합니다. 글꼴 CDN은 차단하므로 정확한 실기기 서체·디자인 일치 여부는 이 검사로 판단하지 않습니다.

## 실패를 확인하는 방법

```sh
npx playwright show-report playwright-report/local
npx playwright show-report playwright-report/ci
npx playwright show-trace test-results/ci/실패한검사폴더/trace.zip
```

실패하면 화면 캡처와 trace(클릭·요청을 다시 보는 기록)를 남깁니다. CI에는 HTML 보고서·JUnit 결과·실패 기록을 10일 보관하도록 설정했습니다. 모두 가상 자료입니다. 실제 계정 토큰을 fixture나 보고서에 추가하면 안 됩니다.

## PR 자동 검사

`.github/workflows/playwright-e2e.yml`은 경로 필터 없이 모든 PR에 실행하도록 준비했습니다. Secret·배포·DB 쓰기 없이 코드 읽기 권한만 씁니다. **이번 제출은 로컬 파일 준비와 CI 설정의 로컬 실행까지입니다. GitHub에 올려 반영한 사실이나 실제 Actions 실행 성공을 뜻하지 않습니다.**

## 이 검사로 보장하지 않는 것

- 실제 Google·이메일·문자·생체 인증 및 실제 세션 취소 결과.
- 실제 AI 답변 품질·과금·장기 기억의 저장과 검색·서버 접근 권한·DB 동시 처리.
- 실제 결제·KEY 차감·운영에서 꺼진 기능의 활성화.
- iPhone·Android 실기기의 키보드·카메라·앱 설치와 전체 시안 일치.
- GitHub Actions 환경에서의 실제 실행. 로컬 CI 설정 검사는 이와 구분합니다.

예를 들어 로그아웃 요청에 오류가 있어도 현재 인증 라이브러리는 내 브라우저의 세션을 지웁니다. 이 동작을 검사하며, “모든 기기의 세션을 취소했다”고 말하지 않습니다. 새 브라우저의 가상 기억 조회 통과도 실제 오래된 사용자 기록을 복구했다는 증거로 쓰지 않습니다.
