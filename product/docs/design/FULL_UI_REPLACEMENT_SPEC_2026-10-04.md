# 전체 디자인 교체 명세 (2026-10-04)

근거: 대표 직접 지시(PR #127 댓글) · Codex 명세 `echo-spec id=20261004-full-ui`.
작업 기준: PR #127 · branch `claude/full-ui-replacement-20261004` · 변경 전 SHA `9ca08c99410efe48cf725918d3ede6674f5cbe10`(echo-qa) · 담당 Claude Code 단독 · 독립 검수 Codex.
복구 기준: 변경 전 SHA `9ca08c9`. QA 배포 기준(Codex 확인): brand `6ac2646008ef3600ad3c07ae`, app `6ac2635358aa228f28cc822c`. 이 문서 작성자는 배포 ID를 직접 확인하지 못했다(Codex 기록을 인용).

상태 4분리: 디자인 구현 = 부분 진행 · 독립 검수 = 대기 · 미리보기 배포 = 미실행 · 실제 사이트 반영 = 미실행.

## 이번 라운드에서 한 것 / 하지 않은 것
- 한 것: 홈페이지(brand) 문구·이동 규칙을 최신 지시에 맞춤(아래 표 H1~H6) · 관련 기존 검사 갱신.
- 하지 않은 것: 모바일(app) 전체 흐름 디자인 교체(표 M1~M12는 「다음」) · 시각 검증(360/390/430/태블릿/1280) · 실제 기기 · 성능 측정 · 영상/녹화.
- 이유: 모바일 흐름은 화면 수가 많아 같은 라운드에 안전하게 끝낼 수 없음. 홈페이지만 먼저 검수 가능한 크기로 끊음.

## 홈페이지 (brand · `product/src/pages/do-it/brand-home/`)
| 현재 URL/화면 | 현재 구현 파일 | 새 디자인 | 유지할 기능 | 필요한 상태 화면 | 구현 담당 | 검수 결과 |
|---|---|---|---|---|---|---|
| H1 `/` 헤더·메뉴 | brand-home/page.tsx | 원본 로고 + 메뉴(ECHO/회사 소개/대표 인사말/로그인) | 열기·닫기·Escape | 로그인 상태면 로그아웃 | Claude | 대기 |
| H2 첫 화면 | 〃 | 제목 「말이 통하는 사람을 만나는 일.」 · 설명 「그 시작을 ECHO가 함께합니다.」 · 주 CTA 모바일 시작하기 · 보조 ECHO 알아보기 | 지구 로고 레이어 | — | Claude(이번 반영) | 대기 |
| H3 ECHO 소개 | 〃 | 슬로건 + 설명 「어떤 사람과 무엇을 함께하고 싶은지, ECHO에게 들려주세요.」 + 「관련 기능 준비 중」 + 3단계 카드 | 카드 열기/닫기 | 준비 중 표시 | Claude(이번 반영) | 대기 |
| H4 모바일 시작하기 | 〃 StartActions | 컴퓨터에서도 곧바로 `app.do-it.company`(appUrl) 이동. 앱 설치 안내 링크 유지 | QR은 보조 안내(`#bh-start-qr`) | — | Claude(이번 반영: 강제 QR 분기 `goStart` 제거) | 대기 |
| H5 회사 소개 | 〃 | 「사람과 사람이 만나는 서비스를 만듭니다.」 · 문의/약관/개인정보 링크 보존 | 0423doit@gmail.com · /legal/terms · /legal/privacy | — | Claude(이번 반영) | 대기 |
| H6 대표 인사말 | 〃 + landing/components/brandGreeting.ts | 맨 마지막 콘텐츠, 승인 원문·이름(박진욱)·직함 그대로 | 원문 글자 변경 0 | — | Claude(변경 없음) | 대기 |
| H7 법적 정보 푸터 | 〃 | 변경 없음 | 사업자 정보 | — | Claude | 대기 |
| H8 설치 안내 | `/do-it/intro?next=app&install=1` (BrandSections `INSTALL_PATH`) | iPhone/Android/불가 구분은 기존 구현 사용 — 이번 라운드 재검증 안 함 | 기존 PWA | — | Claude(다음) | 미검증 |

미확인(대표 확인 필요): 승인된 홈페이지 영상 자산 존재 여부 — 확인하지 못해 영상 UI를 넣지 않음.

## 모바일 (app) — 2차 라운드 상태 (코드 확인 기준 · 브라우저/실기기 확인 아님)
공통 토큰은 이미 `echo-ui.css`(제목 22~24px · 본문·입력 16px · 주요 버튼 48px · `.doit-app-pastel`/`.echo-dialogue--pastel` 아래만)에 있었다. 이번 라운드는 그 위에 **터치 44px(보조 버튼·글자 링크) · 키보드 초점 고리 · 아래 안전 영역**만 덧붙였다(색·배치 변경 0). 화면별로 직접 열어 보지 못한 곳은 「미검증」으로 둔다 — 공통 CSS를 얹었다고 완료로 세지 않는다.
| 화면 | 현재 구현 파일 | 이번 라운드에서 한 것 | 유지할 기능 | 상태(정직) |
|---|---|---|---|---|
| M1 시작(앱 홈) | doit/pages/do-it/home/page.tsx · AgentConversation.tsx(시작 전) | 「같이 하고 싶은 일이 있나요?」 + 「어떤 만남을 원하는지 들려주세요.」 · 버튼 시작하기 | 진행 중/끝남 3단 | 문구 반영 · 소스 검사 통과 · 화면 미확인 |
| M2 가입·로그인·약관 | pages/signup/page.tsx · login · ConsentGate | 가입 제목 「반가워요. ECHO를 시작해 볼까요?」 + 「계속하려면 약관을 확인해 주세요.」 | 필수 동의 3개 미리 체크 0 | 가입 문구만 반영 · 로그인·약관 화면 디자인 미교체 |
| M3 목적·프로필·사진 | purpose · profile · photo 페이지 | 공통 토큰(44px·초점·안전 영역)만 | 승인 필드·순서 | 개별 화면 미검증 |
| M4 ECHO 대화 | AgentConversation.tsx · CoreConversation.tsx | 입력 안내 「편하게 적어주세요.」 · 시작 전 문구 · 안전 영역 | 서버 질문 동적 | 문구 반영 · 화면 미확인 |
| M5 이해·정정 | AgentProfileCheck.tsx | 변경 없음(「이렇게 이해했는데, 맞나요?」 + 정정 4버튼 이미 존재) | 기존 정정 계약 | 기존 반영 확인 · 이번 라운드 미변경 |
| M6 후보 | ConnectionCandidates.tsx | 「이분의 이야기를 들어볼까요?」 · 「더 알아보기 · 왜 이 사람인지 보기」 · 「다음에 볼게요」 | 서버가 준 이유만 · 점수 0 | 문구 반영 · 소스 검사 통과 |
| M7 KEY | KeyIcon.tsx · useKeyWallet.tsx | 변경 0 | **DEMO ONLY · releaseScope OFF — 활성화 금지**, 인메모리 값을 실제 잔액으로 표시 0 | OFF 유지 · 원장 미연결 = 준비 중 |
| M8 선택 보냄 | ConnectionCandidates.tsx | 「선택을 보냈어요.」 + 「상대도 선택하면 알려드릴게요.」(이미 존재), 전류 0 | waiting 에는 찌릿 0 | 계약 검사 통과 |
| M9 상호 선택 | ZzaritMoment.tsx | 본문 「두 분 모두 대화를 원했어요.」로 정확히 교체 | 서버 mutual + match_id 뒤에만 · 한 번만 | 문구 반영 · 소스 검사 통과 |
| M10 첫 답·공개·채팅 | ConnectionMatches.tsx · room 페이지 | 변경 0(공통 토큰만) | 서버 선행 조건 · 공개/영상 동의 분리 | 개별 화면 미검증 |
| M11 신고·설정·로그아웃 | SafetyRow · settings · profile | 변경 0(공통 토큰만) | 기존 동작 | 개별 화면 미검증 |
| M12 상태 화면 | ErrorBoundary · RouteFallback · AppBackButton · AppCornerMenu · InstallIntentSheet | 변경 0 | — | 개별 화면 미검증 |

### 홈페이지 2차 보완 (실제 동작 · 소스 검사로만 확인)
- 메뉴: 열면 첫 항목으로 초점, 닫으면 메뉴 버튼으로 초점 복귀, Escape 닫기, 휴대폰 뒤로가기는 페이지를 떠나지 않고 메뉴만 닫음.
- 카드 패널: Escape·같은 카드 다시 누르기로 닫으면 누른 카드로 초점 복귀.
- 설치 안내: 기존 `detectInstallContext`(순수 함수) 재사용 — iPhone 사파리/iPhone 다른 브라우저/Android/앱 안 브라우저/이미 설치/컴퓨터를 구분해 한 줄 안내. 앱스토어·플레이스토어 배지·링크 0.
- 움직임 줄이기: 기존 `@media (prefers-reduced-motion: reduce)` 유지(검사로 확인).
- 영상: 승인된 홈페이지 영상 자산을 저장소에서 확인하지 못함 → **미연결**. 가짜 재생 UI 0. 이 한 건이 나머지 구현을 막지 않는다.

OFF/숨김 라우트(활성화하지 않음): KEY, 그 밖에 `src/doit/lib/releaseScope.ts` 의 숨김 목록 — 이번 라운드에서 목록을 전수 대조하지 못함.

## 모바일 3차 라운드 — 배치 교체 + 파일별 대응 (정정: 「색·배치 변경 0」은 과거 유지 지시, 현재는 전체 교체 승인)
새 앱 전용 파일 `src/doit/components/feature/mobile-layout-v2.css`(파스텔 루트 아래만 · 전역 0 · 홈페이지 번들 제외). 팔레트는 유지, 아래 구조를 교체: ① 대화 머리말 = 둥근 유리 띠 ② ECHO 말풍선(짙은 청록 유리) / 내 말풍선(밝은 막) 면 구분 ③ **아래 고정 입력 판**(sticky, 안전 영역·키보드에 안 가림, 보내기 버튼 전폭) ④ 오류·불러오는 중·알림·끝 화면 = 같은 24px 판 ⑤ 후보·서로 선택·연결 카드 = 같은 판, 제목 22~24px. 이 CSS 를 import 하는 앱 컴포넌트: AgentConversation · CoreConversation · ConversationOpening · ConnectionCandidates · ConnectionMatches · ConnectionTurnsCard.
| 파일/화면 | 이번 라운드 구현 | 상태(정직) |
|---|---|---|
| AgentConversation / CoreConversation / ConversationOpening (대화·입력·오류·로딩·끝) | mobile-layout-v2.css 배치 교체(위 ①~④) | 소스·빌드 확인 · **브라우저 미확인** |
| ConnectionCandidates / ConnectionMatches / ConnectionTurnsCard / ZzaritMoment (후보·선택·상호·첫 답·채팅) | 판·제목 크기 교체(위 ⑤), 문구는 2차 | 소스·빌드 확인 · **브라우저 미확인** |
| home/page.tsx · start-journey · signup · login · ConsentGate · auth callback | 문구(2차) + 공통 토큰. 배치 교체 CSS **미적용** | 구현 미완 |
| profile · photo · verify · purpose · settings · 프로필 수정 · 신고/차단/종료(SafetyRow) | 공통 토큰만. 배치 교체 CSS **미적용** | 구현 미완 |
| AgentProfileCheck · ErrorBoundary · RouteFallback · AppBackButton · AppCornerMenu · InstallIntentSheet | 변경 0 | 구현 미완 |
| KEY (KeyIcon · useKeyWallet) | 변경 0 — DEMO ONLY · releaseScope OFF · 실제 원장 없음 | OFF 유지 |
홈페이지: 카드 패널 450ms→320ms, 배경 확대 1400ms→800ms(대표 240~360 / 600~900ms 범위). 브라우저·실기기·성능·녹화는 이번에도 **미실행**.

## 안전 경계(변경 0)
서버·Edge Function·DB/RLS·Secret·결제·모델·workflow·PROD·OFF 기능 활성화 0.

## 검사 기록(이번 라운드, product 기준 · 모의/로컬)
| 명령 | 결과 |
|---|---|
빌드 준비: 저장소 무시 파일 `product/.env.local` 에 **합성 자리값**(`https://placeholder-check.invalid` / `placeholder-anon-not-real`, 실제 키 아님·조회 0)을 두고 빌드했다. 번들·타입 검사용이며 **QA 실제 연결 PASS 가 아니다**. 실제 배포에는 쓰지 않는다. Node v22.23.3 에서 Vite 8 빌드 동작 확인.
| 명령 | 결과 |
|---|---|
| npm ci | 성공 (376 packages) |
| node --test qa/design-v2-20261004.test.mjs | 19/19 통과(새 3개 포함) |
| node --test qa/*.test.mjs (전체) | 1150개 중 1145 통과 / 0 실패 / 5 todo(기존 휴리스틱·LEGACY-01 미확정 5건 그대로) |
| npm run type-check | 종료 0 |
| npm run lint | 종료 0 (경고 0) |
| npm run build:brand | 종료 0 (합성 자리값) |
| npm run build:app | 종료 0 (합성 자리값) |
| 브라우저 360/390/430/태블릿/1280 · 실기기 · 성능 · 녹화 · 미리보기 URL | **미실행** — 이 작업 환경에서 격리 브라우저 검사를 돌리지 않았다. PASS 아님 |
| qa-browser/ux-flow.mjs | 문구만 갱신(실행 안 함) |
