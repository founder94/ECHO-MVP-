# ECHO 반응형 오류 수정 — Readdy 반영 지시서 (2026-09-16)

대상 화면: 홈(`/`) "오늘 내 마음의 날씨" — 헤더(DO-IT 로고·ECHO/경험/기록·햄버거·로그아웃) + "오늘의 날씨는 어떤 느낌에 가까워요?" 카드.
기준 소스: Readdy project-13871930 (현재 Readdy 프로젝트). 아래 9개 파일 외에는 아무것도 건드리지 않는다.

## 1. 반영 방법 (파일 전체 교체)
`FRONTEND_PATCH/` 안의 파일을 같은 경로에 **전체 덮어쓰기** 한다. 경로는 프로젝트 루트 기준이다.

| # | 경로 | 상태 | 바꾼 이유 |
|---|------|------|-----------|
| 1 | `src/index.css` | 수정 | html/body/#root 폭 100%·가로 넘침 차단, `.echo-min-h-viewport`(100dvh+100vh 폴백), 홈 섹션 scroll-margin |
| 2 | `src/pages/home/page.tsx` | 수정 | 최상위 `min-h-screen` → `.echo-home .echo-min-h-viewport w-full max-w-full` |
| 3 | `src/pages/home/scrollToSection.ts` | **신규** | 메뉴·푸터 앵커 이동을 고정 헤더 실측 높이만큼 보정 |
| 4 | `src/pages/home/components/PastelBlobs.tsx` | 수정 | `filter: blur(100px)` 제거 → 같은 색·크기·위치의 radial-gradient (Android 직각 잘림 원인) |
| 5 | `src/pages/home/components/FloatingEffects.tsx` | 수정 | 무지개 140vw→140%·blur 제거(마스크 페이드), 빛 기둥·구름 blur 제거→그라디언트, 구슬 backdrop-filter 제거 |
| 6 | `src/pages/home/components/Navbar.tsx` | 수정 | 스크롤 후 헤더 배경 `bg-background-50/75`(전엔 항상 투명 → 본문 글자와 겹침), safe-area 상단 여백, 앵커 보정 헬퍼 사용 |
| 7 | `src/pages/home/components/Footer.tsx` | 수정 | 푸터 ECHO·기록 앵커도 같은 헬퍼로 이동 |
| 8 | `src/components/ScrollToTop.tsx` | 수정 | 하단 safe-area 여백 |
| 9 | `src/components/MusicPlayer.tsx` | 수정 | 하단 safe-area 여백 (버튼 위치·기능 동일) |

`responsive.diff` 는 같은 변경의 unified diff(기준 대비)이고, `SOURCE_MANIFEST.json` 에 교체 전/후 SHA-256 이 있다. 교체 후 각 파일 해시가 `after` 와 같아야 한다.

## 2. 하지 말 것
- 히어로 문구·버튼·색·애니메이션 이름 변경 금지. 배경 이미지·별·구름·구슬 요소 삭제 금지(이번 수정은 "블러 필터"만 그라디언트로 바꾼 것).
- `display:none` 으로 배경을 끄지 말 것. 갤럭시 전용 px·미디어쿼리 추가 금지. `z-index 99999` 금지.
- 결제(`src/lib/echo/toss.ts` PAYMENT_GATE=review_pending)·인증·음악 카드(M1)·A구조 화면은 이번 범위 밖 — 손대지 않는다.
- Readdy 가 다른 파일을 "정리"하겠다고 제안하면 거절한다.

## 3. 반영 후 Readdy 에서 확인할 것
1. `npm run type-check` 오류 0, `npm run lint` 오류 0, `npm run build` 성공 (Claude 로컬에서 세 가지 모두 종료코드 0 확인함).
2. 홈 미리보기 390px: 헤더 한 줄(로고 / SIGN UP 또는 로그아웃 / 햄버거), 데스크톱 메뉴(ECHO·경험·기록)는 768px 미만에서 숨김.
3. 스크롤을 내리면 헤더에 어두운 반투명 배경이 생기고 본문 글자와 겹치지 않는다.
4. 메뉴 ECHO 클릭 시 "같은 날씨라도, 마음은 모두 다르니까." 제목이 헤더 아래에 보인다(헤더 뒤로 숨지 않음).
5. 카드는 화면 가운데, 좌우 24px 여백, 버튼 6개 모두 화면 안. 640px 이상에서 2열.

## 4. 대표님이 실기기(갤럭시 Chrome)에서 볼 것
- 초록 배경이 화면 중간에서 **직각으로 끊기는 현상 0**, 카드 위로 초록 사각형이 올라오는 현상 0.
- 헤더 글자가 본문 글자와 겹치는 현상 0.
- 좌우로 흔들리는 가로 스크롤 0.
- 위 3가지가 확인되기 전까지 "운영 확인 완료"라고 쓰지 않는다. 확인되면 그 결과를 알려주면 이 문서에 날짜와 함께 기록한다.
