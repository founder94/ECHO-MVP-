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

## 모바일 (app) — 다음 단계
| 화면 | 현재 구현 파일(확인 위치) | 새 문구/디자인 요점 | 유지할 기능 | 담당 | 상태 |
|---|---|---|---|---|---|
| M1 시작 | doit/components/feature/ConversationOpening.tsx | 「같이 하고 싶은 일이 있나요?」(이미 반영 확인) | — | Claude | 문구 확인만 · 디자인 대기 |
| M2 가입·로그인·약관 | pages/signup · pages/login · ConsentGate | 「반가워요. ECHO를 시작해 볼까요?」 | 미리 체크 0 · 필수/선택 동의 | Claude | 다음 |
| M3 목적·프로필·사진 | doit/pages/do-it/purpose · profile · photo | 공통 토큰 | 승인 필드·순서 | Claude | 다음 |
| M4 ECHO 대화 | doit/pages/do-it/conversation | 입력 「편하게 적어주세요.」 | 서버 질문 동적 | Claude | 다음(Codex 관찰: app home은 아직 구 문구) |
| M5 이해·정정 | AgentProfileCheck.tsx | 정정 4버튼(이미 존재) | 기존 정정 계약 | Claude | 문구 확인 · 디자인 대기 |
| M6 후보 | ConnectionCandidates.tsx | 「이분의 이야기를 들어볼까요?」 | 서버 공개 정보만 | Claude | 다음 |
| M7 KEY | KeyIcon.tsx · useKeyWallet.tsx | 열쇠 SVG 이미 존재 | **DEMO ONLY · releaseScope OFF — 활성화 금지** | Claude | OFF 유지 |
| M8~M9 선택·찌릿 | ConnectionCandidates.tsx · ZzaritMoment | 서버 mutual+match_id 뒤에만 | 한 번만 재생 | Claude | 계약 보존 확인 |
| M10 첫 답·공개·채팅 | doit/pages/do-it/room 등 | 동의 분리 유지 | 서버 선행 조건 | Claude | 다음 |
| M11 신고·설정·로그아웃 등 | settings · profile · notifications 등 | 공통 토큰 | 기존 동작 | Claude | 다음 |
| M12 상태 화면(로딩/오류/로그인 만료/빈 상태 등) | ErrorBoundary · RouteFallback · AppBackButton · AppCornerMenu · InstallIntentSheet | 공통 토큰 | — | Claude | 다음 |

OFF/숨김 라우트(활성화하지 않음): KEY, 그 밖에 `src/doit/lib/releaseScope.ts` 의 숨김 목록 — 이번 라운드에서 목록을 전수 대조하지 못함.

## 안전 경계(변경 0)
서버·Edge Function·DB/RLS·Secret·결제·모델·workflow·PROD·OFF 기능 활성화 0.

## 검사 기록(이번 라운드, product 기준 · 모의/로컬)
| 명령 | 결과 |
|---|---|
| npm ci | 성공 (376 packages) |
| node --test qa/design-v2-20261004.test.mjs | 16/16 통과 |
| npm run type-check | 종료 0 |
| npm run lint | 종료 0 |
| npm run build:brand | **실행 못 함**: `VITE_PUBLIC_SUPABASE_URL/ANON_KEY` 필요(Secret 사용 금지라 넣지 않음) |
| npm run build:app | 위와 같은 이유로 실행 안 함 |
| 브라우저 360/390/430/태블릿/1280 · 실기기 · 성능 · 녹화 | 미실행 |
