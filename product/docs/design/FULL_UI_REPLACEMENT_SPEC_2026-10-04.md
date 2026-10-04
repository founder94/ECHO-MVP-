# 전체 디자인 교체 명세 (2026-10-04) — 현재 최종 상태 (5차 라운드 기준)

**5차(마지막) 변경 요약**: 앱 첫 화면 신설 · 인트로 뒤 이동 · `/auth/callback` · 404 · 뒤로/메뉴 버튼 대비 · 후보 버튼 문구 · 약관 CSS 역할 분리. 아래 표의 해당 행에 5차 표기. 브라우저·실기기·성능·녹화는 이 환경(Chromium 없음)에서 실행하지 않았다 — Codex 검수 대상.
남은 한계: 앱 첫 화면·404·약관의 앱 CSS 는 동적 import 라 느린 회선에서 스타일이 잠깐 늦게 붙을 수 있다(미측정). 가입 체크박스는 표시 20px 유지, 라벨 터치 영역 44px 는 실제 렌더로 미확인.


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
| 홈페이지 번들 | brand 빌드는 app 컴포넌트를 import 하지 않음. **5차 정정**: 4차 문장은 틀렸다 — `LegalDocument` 가 `app-pastel.css`(→ `app-glass-v2.css`)를 정적으로 import 해 brand 약관 CSS 에 들어갔다. 이제 역할 조건(`VITE_SITE_ROLE !== 'brand'`) 안의 동적 import 라 brand 빌드에서 빠진다(brand 산출물 `out-brand/assets` 에서 `app-glass`·`mobile-layout`·`echo-welcome`·`echo-state` 0건 확인). 홈페이지 약관은 회사 흑백(`legal.css`), 앱 약관은 유리. 문구·법적 본문 변경 0 | 오염 0 | — |

**4차에서 고친 P1 결함**: 3차 `mobile-layout-v2.css` 는 `.echo-dialogue.echo-dialogue--pastel.echo-composer` 처럼 루트 클래스와 자손 클래스를 한 요소에 붙여 써서 **어느 요소에도 맞지 않았다**(실제 DOM = `section.echo-dialogue.echo-dialogue--pastel` 안의 `form.echo-composer` 등). 모두 자손 결합자(공백)로 바꿨고, 같은 요소 결합을 막는 검사를 추가했다(`qa/design-v2-20261004.test.mjs`). computedStyle 확인은 브라우저가 없어 미실행.

## B. 앱 화면별 대응표 (실제 파일 · 새 디자인 · 상태)
| # | 화면/URL | 구현 파일 | 새 디자인 적용 | 유지할 기능 | 상태 화면 | 상태 |
|---|---|---|---|---|---|---|
| M1 | `/` → 온보딩 `/do-it/intro` → 앱 입구 · PWA `/do-it/intro?next=app` | router/config.tsx · DoItEntry.tsx · intro/page.tsx | **5차**: 앱 `/` = 새 ECHO 첫 화면 `src/doit/pages/do-it/welcome/page.tsx`(민트·청록 + 노랑·코랄 빛 + CSS/SVG 유리 링 + 짙은 청록 유리 판 · 「같이 하고 싶은 일이 있나요?」 / 「어떤 만남을 원하는지 들려주세요.」 / 흰 CTA 「시작하기」 → 기존 `/doit/start-journey`). 인트로 뒤 앱 역할은 `/` 로(동작 줄이기 포함 같은 경로, 예전엔 곧바로 시작 흐름이라 새 문구가 안 보였다). 설치 앱 `next=app`·통합 빌드는 기존 이동 그대로. 로그인 확인 대기 화면은 파스텔 + 어두운 청록 글자 | 온보딩 1회 재생 · next=app 화이트리스트·install=1·introSeen·Google 복귀 토큰 처리 변경 0 · 시작 흐름의 동의·필드·세션 선행 조건 그대로 | 로그인 확인 중 | 소스 구현 · 빌드 산출물 확인 (브라우저 미확인) |
| M1 | `/doit/home` | doit/pages/do-it/home/page.tsx | 인트로·최근 이야기·요약·알림·하단 안내 = 같은 짙은 청록 판, 제목 22~24px | 시작 전/진행 중/끝남 3단 | 로딩·로그인 필요·오류·빈 상태 | 소스 구현 |
| M1 | `/doit/start-journey` | start-journey/page.tsx (+ConversationOpening·PurposeSelect·PhotoCapture·ProfileReview) | 대화 배치 + 공통 판 | 목적→사진→프로필 순서 · 12초 불러오기 상한 | 불러오는 중·오류·다시 시도 | 소스 구현 |
| M2 | `/login` | pages/login/page.tsx | 가운데 상자 = 판, 입력 16px·48px, 안내 「다시 오셨네요. 하던 이야기부터 이어가요.」 | 인증 로직 그대로 | 오류 문구 | 소스 구현 |
| M2 | `/signup` | pages/signup/page.tsx | 판 + 「반가워요. ECHO를 시작해 볼까요?」 | 필수 동의 미리 체크 0 | 가입 완료·오류 | 소스 구현 |
| M2 | `/legal/terms` `/legal/privacy` `/legal/consent` · ConsentGate | pages/legal/** · consent-checklist | 본문 상자 = 판, 본문 16px, 제목 22~24px, 버튼 44px | 필수/선택 동의 구조·버전 | 오류·저장 중 | 소스 구현 |
| M2 | `/auth/callback` | pages/auth/callback/page.tsx | **5차**: 대기·실패 화면만 앱 유리(`src/components/state-screens.css` `.echo-state`) — 민트 바탕 + 청록 판 + 흰 글자, 실패 시 「로그인 화면으로」 흰 버튼 48px. 인증·이동 로직 줄 변경 0 | 로그인 복귀(consumeReturnPath) · 8초 상한 | 대기·실패 | 소스 구현 (브라우저 미확인) |
| M12 | 없는 주소 `*` (NotFound) | src/pages/NotFound.tsx | **5차**: 영어 개발 도구 안내 삭제 → 「페이지를 찾을 수 없어요.」 + 「홈으로 돌아가기」. 앱 = 같은 유리 틀, 홈페이지 = 회사 흑백(인라인, 앱 CSS 미의존) | 홈 이동 | — | 소스 구현 (브라우저 미확인) |
| 공통 | 뒤로 알약 · 오른쪽 위 메뉴 버튼 | app-back-button.css · app-corner-menu.css | **5차**: 밝은 민트 위 흰 라벨 대비 부족(바탕 흰 .14) → 짙은 청록 유리 `rgb(8 70 80/.86)` + 흰 글자·아이콘 | 44px 유지 | — | 소스 구현 (대비는 계산값) |
| M6 | 후보 버튼 | ConnectionCandidates.tsx | **5차**: 눈에 보이는 문구 「더 알아보기」(이유 펼침 기능 그대로, 기존 검사 locator 만 승인 변경으로 정렬) | 선택·이유 펼침 | — | 소스 구현 |
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

---

## 추가 설계 — 사용자 이용 안내 통합 (2026-10-04 대표 추가 지시 · 새 묶음 1/5, 시작 HEAD `88d843659f0a4c79d11aed6abe8fbca900c040f6`)

MASTER 원문 문서는 저장소에서 확인하지 못했다(코드 주석의 MASTER 표기를 원문 검증으로 쓰지 않음). 아래 「기존 확정」은 현재 코드에 이미 있던 문구, 「이번 추가 설계」는 대표 이번 지시의 문구다. 다른 대화의 확정 안내 원문은 회수하지 못했다.
공통 내용 한 곳 = `src/lib/guide/guideContent.ts`(홈페이지·앱이 같이 읽음) · 화면 = `src/components/UsageGuide.tsx` + `usage-guide.css`(역할별 겉모습: brand 흑백, app 짙은 청록 유리).

| 안내 항목 | 기존 근거·파일 | 실제 기능 상태 | 유지할 문구 | 바꿀 문구 | 노출 위치 |
|---|---|---|---|---|---|
| 1 시작 | 옛 설정 GUIDE 「ECHO와 이야기하기」 | 대화·프로필 준비 = 사용 가능 / 추천·연결 = 준비 뒤(현재 후보 화면은 있으나 전화 인증 미연결) | — | **이번 추가 설계** 「처음이라면, 여기부터 보세요.」 + 설명 순서 5단계 + 「추천과 연결은 준비가 끝난 뒤에 열려요」 | 홈페이지 메뉴·푸터, 앱 메뉴 「ECHO 사용법」, 설정, 앱 첫 화면 「처음이라면, 여기부터 보세요.」 |
| 2 대화 | `AgentConversation` 질문 한 개씩, 입력 「편하게 적어주세요.」 | 사용 가능(서버 Agent) | 「잘 모르겠어요」도 괜찮아요(기존 GUIDE) | **이번 추가 설계** 제목·본문, 5번 후 끝 약속 0 | 위와 같음 |
| 3 이해 확인·정정 | 이해 카드 4버튼(기존) | 사용 가능(서버 정정 계약) | 네 버튼 이름 그대로 | **이번 추가 설계** 버튼별 한 줄 설명 | 위와 같음(정정 카드 옆 작은 진입점은 이번 묶음 미구현) |
| 4 추천·선택 | `ConnectionCandidates`, 설정 VISIBILITY_RULES(서버 doit-connect 규칙) | 화면 있음, 후보는 서버 승인 흐름 | 한쪽 선택=대기, 둘 다 답+공개 뒤 공개(기존 규칙) | **이번 추가 설계** 제목·본문·보조 문장, 65%·사진 선공개·상대 알림·바로 채팅 약속 0 | 위와 같음 |
| 5 KEY | `KeyIcon.tsx`, `releaseScope.ts`(`/doit/key` 숨김) | **OFF · 원장 미연결** | — | **이번 추가 설계** 제목 + 「현재 KEY 사용 기능은 준비 중이에요.」(숨김 플래그가 풀릴 때만 「해당 화면에서 확인」 문구) · 수량·가격·0개 표시 0 · 사용 버튼 0 | 위와 같음(통합 안내만) |
| 6 찌릿 | `ZzaritMoment.tsx`(서버 mutual+match_id 뒤 한 번) | 서버 확인 뒤에만 | 「텔레파시가 통했어요」 | **이번 추가 설계** 제목·본문·보조, 안내가 효과를 내지 않음 | 위와 같음 |
| 7 설치 | `installContext.ts`, 홈페이지 INSTALL_HINT, `InstallAppCard` | iPhone 사파리/Android/앱 안 브라우저/설치됨/컴퓨터 구분(기존) | 기기별 문구 그대로(이제 공통 모듈 한 곳) | **이번 추가 설계** 제목 + 컴퓨터는 iPhone/Android 직접 선택 + 「웹으로 계속 이용하기」 | 홈페이지 「앱 설치 안내」 버튼 = 이 항목을 연다 |
| 8 안전 | 설정 HELP, 후보 카드 「불편해요 · 차단 · 신고」, 연결 카드 「이 연결 그만하기」 | 사용 가능 | 문의 `0423doit@gmail.com`(홈페이지 푸터·설정과 대조) | **이번 추가 설계** 제목·문장, 신고≠차단, 자동 메일 0 | 위와 같음 |

### 진입점 목록
- 홈페이지: 메뉴 「이용 안내」, 푸터 「이용 안내」, 「앱 설치 안내」(설치 항목 바로 열기). 주 행동 = 모바일 시작하기(안내 하단).
- 앱: 오른쪽 위 메뉴 「ECHO 사용법」(그 자리에서 열림), 설정 「이용 안내 열기」(옛 `#guide` 주소도 열림), 앱 첫 화면 「처음이라면, 여기부터 보세요.」(눌러야만 열림, 자동 띄움 0).
- **미구현(다음 묶음)**: 정정 카드·후보 카드 옆 기능별 작은 진입점, 「나중에 보기」 로컬 기록(지금은 자동 노출 자체가 없어 필요 없음).

### 독립 FAIL 3개 수정
1. 앱 최초 인트로(심볼 %) — 앱 역할만 민트·청록 바탕 + 노랑·코랄 빛 + 짙은 청록 유리 원/판 + 흰 글자(`DoItIntroFrame.ts`, `IS_APP_SITE`). 진행 단계·시간·`introSeen`·인증은 불변. 홈페이지·통합 빌드는 예전 검정 그대로. 한계: `index.html` 의 첫 프레임 배경(`#08070c`)은 그대로라 앱에서 아주 짧게 어두운 바탕이 보일 수 있다(미측정).
2. 홈페이지 「모바일 시작하기」 = `appUrl('/')`(앱 루트). 앱 welcome 의 시작 CTA 는 기존 `PRODUCT_ENTRY_PATH` 그대로.
3. `brand-home.css` 배경 `scale(1.02)` → 들어오면 `scale(1.12)`(안쪽 확대). 글자 레이어 분리·reduced-motion 정적 유지.

### 이번 묶음 검사 (product 기준, 합성 자리값 `.env.local` — 미커밋·배포 0)
- `npm ci` → 0 · `npm run type-check` → 0 · `npm run lint` → 0 · `npm run build:brand` → 0 · `npm run build:app` → 0
- `node --test qa/*.test.mjs` → 1174개 중 1169 통과 / 0 실패 / 5 todo(기존 미확정 5건 그대로)
- 새 검사 `qa/usage-guide-20261004.test.mjs` 10개: 공통 모듈은 실제 실행(항목·문구·설치 판단·열기 신호), 오버레이는 소스 계약.
- brand 산출물에 `echo-welcome`·`app-glass`·`mobile-layout` 0건(grep). `ug-root` 안내 CSS 는 홈페이지에도 들어간다(공통 안내이므로 의도).
- **미실행(PASS 아님)**: 브라우저에서 열기→항목 확인→닫기→입력 이어가기, Escape·Back·Tab·초점, 360/390/430/태블릿/1280, 짧은 viewport·키보드, 대비 실측, 녹화, 미리보기 URL, 실기기.
