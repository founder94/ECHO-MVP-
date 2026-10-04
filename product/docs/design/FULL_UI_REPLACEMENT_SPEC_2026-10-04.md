# 전체 디자인 교체 명세 (2026-10-04) — 현재 최종 상태 (4차 라운드 기준)

근거: 대표 직접 지시(PR #127 댓글) · Codex 명세 `echo-spec id=20261004-full-ui`.
작업 기준: PR #127 · branch `claude/full-ui-replacement-20261004` · 변경 전 SHA `9ca08c99410efe48cf725918d3ede6674f5cbe10`(echo-qa) · 담당 Claude Code 단독 · 독립 검수 Codex.
복구 기준: 변경 전 SHA `9ca08c9`. QA 배포 기준(Codex 확인): brand `6ac2646008ef3600ad3c07ae`, app `6ac2635358aa228f28cc822c`. 이 문서 작성자는 배포 ID를 직접 확인하지 못했다(Codex 기록을 인용).

**상태 4분리: 디자인 구현 = 소스 구현 완료(브라우저 미확인) · 독립 검수 = Codex 대기 · 미리보기 배포 = 미실행 · 실제 사이트 반영 = 미실행.**
이 문서의 「구현」은 소스·타입·빌드·소스 검사로 확인한 것이다. 이 작업 환경에는 Chromium 이 없어 computedStyle·스크린샷·키보드·실기기 검사를 **실행하지 못했다**(PASS 아님, Codex 독립 Chromium 검수 대상).

## A. 앱(app.do-it.company) 공통 틀 — 모든 활성 화면이 같은 CSS 를 받는 구조
| 계층 | 파일 | 하는 일 | 적용 범위 |
|---|---|---|---|
| 공통 판·토큰 | `src/doit/components/feature/app-glass-v2.css` | 짙은 청록 유리 판(`rgb(8 70 80/.82)`~`rgb(5 52 62/.86)`, 흰 글자 대비 7:1 이상 계산값) · 제목 22~24px · 본문·입력 16px · 터치 44px · 키보드 초점 고리 | `.doit-app-pastel` 아래(앱 전 화면) |
| 공통 로드 경로 | `app-pastel.css` 가 import → `MobileLayout`·`ProfileReview`(product-brand.css 경유)·start-journey·login·signup·legal·consent·fortune 가 모두 로드 | 화면별 중복 코드 없이 전 화면에 적용 | 앱 |
| 대화 배치 | `mobile-layout-v2.css` (AgentConversation·CoreConversation·ConversationOpening·Connection* 가 import) | 머리말 유리 띠 · ECHO/내 말풍선 면 구분 · 아래 고정 입력 판(sticky) · 오류·로딩·끝 판 | `section.echo-dialogue.echo-dialogue--pastel` **의 자손** |
| 홈페이지 번들 | brand 빌드는 app 컴포넌트를 import 하지 않음(검사로 확인). 약관 열람(LegalDocument)만 기존대로 app-pastel 을 쓴다 | 오염 0 | — |

**4차에서 고친 P1 결함**: 3차 `mobile-layout-v2.css` 는 `.echo-dialogue.echo-dialogue--pastel.echo-composer` 처럼 루트 클래스와 자손 클래스를 한 요소에 붙여 써서 **어느 요소에도 맞지 않았다**(실제 DOM = `section.echo-dialogue.echo-dialogue--pastel` 안의 `form.echo-composer` 등). 모두 자손 결합자(공백)로 바꿨고, 같은 요소 결합을 막는 검사를 추가했다(`qa/design-v2-20261004.test.mjs`). computedStyle 확인은 브라우저가 없어 미실행.

## B. 앱 화면별 대응표 (실제 파일 · 새 디자인 · 상태)
| # | 화면/URL | 구현 파일 | 새 디자인 적용 | 유지할 기능 | 상태 화면 | 상태 |
|---|---|---|---|---|---|---|
| M1 | `/` → 온보딩 `/do-it/intro` → 앱 입구 · PWA `/do-it/intro?next=app` | router/config.tsx · DoItEntry.tsx · intro/page.tsx | 앱 `/` 는 온보딩 뒤 제품 입구(시작 흐름)로. 로그인 확인 대기 화면은 검정 → 파스텔 + 어두운 청록 글자 | 온보딩 1회 재생 · next=app 임의 주소 이동 0 | 로그인 확인 중 | 소스 구현 |
| M1 | `/doit/home` | doit/pages/do-it/home/page.tsx | 인트로·최근 이야기·요약·알림·하단 안내 = 같은 짙은 청록 판, 제목 22~24px | 시작 전/진행 중/끝남 3단 | 로딩·로그인 필요·오류·빈 상태 | 소스 구현 |
| M1 | `/doit/start-journey` | start-journey/page.tsx (+ConversationOpening·PurposeSelect·PhotoCapture·ProfileReview) | 대화 배치 + 공통 판 | 목적→사진→프로필 순서 · 12초 불러오기 상한 | 불러오는 중·오류·다시 시도 | 소스 구현 |
| M2 | `/login` | pages/login/page.tsx | 가운데 상자 = 판, 입력 16px·48px, 안내 「다시 오셨네요. 하던 이야기부터 이어가요.」 | 인증 로직 그대로 | 오류 문구 | 소스 구현 |
| M2 | `/signup` | pages/signup/page.tsx | 판 + 「반가워요. ECHO를 시작해 볼까요?」 | 필수 동의 미리 체크 0 | 가입 완료·오류 | 소스 구현 |
| M2 | `/legal/terms` `/legal/privacy` `/legal/consent` · ConsentGate | pages/legal/** · consent-checklist | 본문 상자 = 판, 본문 16px, 제목 22~24px, 버튼 44px | 필수/선택 동의 구조·버전 | 오류·저장 중 | 소스 구현 |
| M2 | `/auth/callback` | pages/auth/callback/page.tsx | 변경 0(기능 화면, 대기 문구 한 줄) | 로그인 복귀 | 실패 | 변경 없음 |
| M3 | 목적·사진·프로필·인증 `/doit/photos`·`/doit/profile`·`/doit/verify` | 각 page · MobileLayout | 카드·섹션 = 판 · 사진 빈 칸 · 설명 글자 흰색 | 승인 필드·순서·필수 단계 | 저장 중·실패·재시도 | 소스 구현 |
| M4 | ECHO 대화 `/doit/conversation` | AgentConversation · CoreConversation | 머리말 띠 · 질문/내 말풍선 구분 · 아래 고정 입력 판 · 안내 「편하게 적어주세요.」 | 서버 질문 동적 · 5문항 상한 | 오류·불러오는 중·끝 | 소스 구현(computedStyle 미확인) |
| M5 | 이해·정정 | AgentProfileCheck · 정정 4버튼 | 기존 문구 「이렇게 이해했는데, 맞나요?」 + 판 | 기존 정정 계약 | 저장 중·충돌 | 소스 구현 |
| M6 | 후보 `/doit/connections` | ConnectionCandidates | 판 · 「이분의 이야기를 들어볼까요?」 · 「더 알아보기」/「다음에 볼게요」 | 서버가 준 이유만 | 후보 없음·오류 | 소스 구현 |
| M7 | KEY | KeyIcon · useKeyWallet | **변경 0 — DEMO ONLY · releaseScope OFF** | 실제 원장 미연결 = 준비 중 | — | OFF 유지 |
| M8 | 한쪽 선택 | ConnectionCandidates | 「선택을 보냈어요.」 + 「상대도 선택하면 알려드릴게요.」 · 전류 0 | waiting 에는 찌릿 0 | — | 소스 구현 |
| M9 | 상호 선택 | ZzaritMoment | 「찌릿! 텔레파시가 통했어요」 + 「두 분 모두 대화를 원했어요.」 | 서버 mutual + match_id 뒤에만 · 1회 | — | 소스 구현 |
| M10 | 첫 답·공개·채팅 | ConnectionMatches · ConnectionTurnsCard | 판 | 서버 선행 조건 · 공개/영상 동의 분리 | 오류·종료 | 소스 구현 |
| M11 | 설정·프로필 수정·신고/차단/종료·탈퇴 | settings · SafetyRow · FaceLoginSettings | 설정 판·알림·세션 = 같은 판, 글자 흰색 | 기존 동작 · 탈퇴 확인 단계 | 확인 창·오류 | 소스 구현 |
| M12 | 오류·로딩·권한·로그인 만료 | ErrorBoundary(앱=파스텔+청록 판, 홈페이지=기존) · RouteFallback(문장 = 청록 알약) · AppBackButton(44px) · AppCornerMenu(청록 판) · InstallIntentSheet(기존 어두운 판) | 위와 같음 | 12초 상한·다시 시도·홈으로 | 각 상태 | 소스 구현 |
OFF/숨김(활성화 금지): KEY, 공간·월드·사주 등 `src/doit/lib/releaseScope.ts` 목록. 표에 구분만 했고 활성화하지 않았다.
이 표 밖의 옛 화면(`/do-it/1~4`·`/home` 등 연결이 끊긴 화면)은 이번 범위 밖이다.

## C. 홈페이지 (brand · `src/pages/do-it/brand-home/`)
| 화면 | 새 디자인 | 유지할 기능 | 상태 |
|---|---|---|---|
| H1 헤더·메뉴 | 원본 로고 + 메뉴 | 열기·닫기·Escape·첫 항목 초점 | 소스 구현 |
| H2 첫 화면 | 「말이 통하는 사람을 만나는 일.」 · 「그 시작을 ECHO가 함께합니다.」 · 주 CTA 모바일 시작하기 | 지구·로고 레이어 | 소스 구현 |
| H3 ECHO 소개 | 슬로건 + 「관련 기능 준비 중」 + 3단계 카드 | 카드 열기/닫기 · 닫으면 눌렀던 카드로 초점 | 소스 구현 |
| H4 모바일 시작하기 | 컴퓨터에서도 곧바로 앱 주소 · QR 은 보조 | 기기별 설치 안내(스토어 배지 0) | 소스 구현 |
| H5 회사 소개·H6 대표 인사말·H7 법적 정보 | 승인 원문·연락처 그대로 | 변경 0 | 변경 없음 |
| 모션 | 패널 320ms · 배경 확대 800ms · reduced-motion 정적 | — | 소스 구현 |
| 영상 | 승인된 영상 자산을 저장소에서 확인하지 못함 → **미연결**, 가짜 재생 UI 0 | — | 미연결 |

**4차에서 고친 메뉴 결함(Codex 재현)**: 메뉴 안 링크(예: 「회사 소개」)를 누르면 메뉴 닫힘 정리 코드의 `history.back()` 이 앵커 이동을 되돌려 `#bh-company` 로 가지 못했다. → 메뉴가 쌓은 기록 한 칸의 **소유권**을 ref 로 추적한다. 링크를 누르면 그 칸을 일반 기록으로 바꾸고(`releaseMenuHistory`) 걷지 않으며, 닫기·Escape 는 걷고, 휴대폰 Back 으로 닫히면 메뉴 버튼으로 초점이 돌아온다. 소스 검사만 통과 — **실제 클릭 재현은 브라우저가 없어 미실행**.

## D. 고친 접근성·가독성 결함 (Codex 독립 검수 지적 → 4차)
- 로그인·가입·약관 뒤로 알약 32px → 44px.
- 앱 홈 흰 글자가 밝은 민트 위에서 대비 1.5:1 → 글자가 놓이는 영역을 짙은 청록 유리 판으로(계산상 7:1 이상). **실제 렌더 측정은 미실행**.
- 햄버거 패널 파스텔 위 흰 글자 → 짙은 청록 판. 기존 검사의 기대값(파스텔 그라데이션)을 새 승인 디자인으로 교체했다(검사 약화 아님).
- 입력 안내·가입 개별 동의 체크박스 터치 영역(라벨 전체 44px)은 소스 확인만 — 브라우저 미확인.

## E. 안전 경계(변경 0)
서버·Edge Function·DB/RLS·Secret·결제·모델·workflow·PROD·OFF 기능 활성화·가격 0. 검사용 합성 자리값(`product/.env.local`, git 무시)은 배포에 쓰지 않는다.

## F. 검사 기록 (4차, product 기준 · 모의/로컬 · 합성 자리값)
| 명령 | 결과 |
|---|---|
| npm ci | 성공 (376 packages) |
| npm run type-check | 종료 0 |
| npm run lint | 종료 0 (경고 0) |
| npm run build:brand | 종료 0 |
| npm run build:app | 종료 0 |
| node --test qa/*.test.mjs (전체) | 1156개 중 1151 통과 / 0 실패 / 5 todo(기존 휴리스틱·LEGACY-01 미확정 5건 그대로, 통과로 세지 않음) |
| Chromium 360/390/430/태블릿/1280 · computedStyle · 대비 측정 · 키보드 · 실기기 · 성능 · 녹화 · 미리보기 URL | **미실행** — 이 작업 환경에 브라우저가 없다. 소스 정규식 검사는 적용 증거가 아니다 |
