# 홈페이지 = GetLayers 「Vesper」 원본 그대로 + Solaris · Einstein–Rosen 3D 장면 (2026-10-08)

## 대표 결정(2026-10-08 · 대화 원문 기준)
- 홈페이지는 회사 얼굴 → 전문 제작물(GetLayers 구매 · 대표 직접)로 교체. 3D 허용 · 약 600KB 추가 허용 · 모바일도 같은 계열 효과.
- 2026-10-05 「홈페이지 최종」 잠금(4장 스크롤 · 지구 그림 · 보라 0 · 점 글자)은 대표가 다시 열었다.
- **「내가 보내준 코드 그대로 다 써 · 거기에 글만 넣어 · 색도 글씨체도 3D 효과도 코드대로」** → 색 바꾸기(파랑)·갈아끼우는 층 구조(첫 이식)는 버리고, Vesper 원본을 그대로 옮긴 뒤 승인 문구만 넣었다.
- 온보딩(인트로 입자 D · `/do-it/intro`)은 손대지 않음. 앱(app.do-it.company) 화면은 범위 밖.
- 완성되면 미리보기 동영상.

## 받은 코드 검수
| 묶음 | 내용 | 외부 스크립트 | 비밀값 | 라이선스 파일 |
|---|---|---|---|---|
| vesper.zip(278개 · 3.1MB) | Next.js 16 + three 0.185 + fiber 9 + drei·postprocessing·lenis·react-spring·spring-text-engine·zustand · 구슬→은하→뇌 3막 · 워커 렌더(휴대폰) | 글꼴(Google Fonts Mulish·Onest) 1건 | 0건 | 없음(목록 화면 「Commercial licence」만) |
| solaris.zip(HTML 1 + README) | three 0.160 **CDN(unpkg) importmap** · 촘촘한 구 + 커서 불꽃 + fBm 오로라 + bloom · 제어판·localStorage | CDN 2건 → **우리 번들 three 로 대체(외부 요청 0)** | 0건 | 없음 |
| einstein-rosen-lattice.zip(HTML 1 + README) | three 0.143 **CDN** · 픽셀마다 광선 추적하는 웜홀 격자 셰이더 · bloom 2단 · 제어판·localStorage | CDN 2건 → 대체 | 0건 | 없음 |
- 세 묶음의 `.claude/settings.json`·제어판·localStorage 코드는 가져오지 않음(외부 지시·기기 저장 0). 라이선스 원문은 대표가 GetLayers 약관에서 확인 필요(상업 사용 범위 · 재배포 금지 여부).
- Vesper 글꼴: General Sans(묶음 안 woff2 3종 · `/vesper/fonts/`) 그대로, Mulish·Onest 는 index.html 에서 Google Fonts 로(막힌 망에서는 Pretendard 로 떨어짐).

## 구조(원본 그대로 · 글만 교체)
```
product/src/vesper/                      Vesper 원본 src(96개 → 105개 · app/·SEO·쿠키·법무 화면·API 는 제외) — eslint 제외(우리 규칙으로 고치지 않음)
  shims/next-{image,link,dynamic,navigation}   Next 전용 모듈 → Vite/React Router 대체(네 파일)
  vesper.css                             원본 globals.css → html.vesper 안에서만(루트 글자 크기 vw 사다리 · 바탕색) + General Sans @font-face
  views/home/sections/solaris-section.tsx + solaris-shaders.ts     Solaris 원본 코드(색 #ff4c33 / #3366ff 그대로) · 이야기 5장면 글
  views/home/sections/lattice-section.tsx + lattice-shaders.ts     Einstein–Rosen 원본 코드(색 그대로) · 이야기 8장면 글 + 제작 과정 영상(#making)
product/src/pages/do-it/brand-home/
  page.tsx                               <ScrollLayout><AdaptiveGrid/><ReducedMotion/><SiteHeader/><HomeView/></ScrollLayout> + 이용 안내(GuideHost)
  copy.ts                                승인 문구 한 곳(히어로·시작·설치·이야기 9장면·법적 고지) — 원본 파일은 여기서 글을 읽는다
  brand-home.css · BrandFilm.tsx         제작 과정 영상 칸(PR #137 그대로)
  SceneLayer.tsx · DotText.tsx           옛 홈페이지 파일 · 더 쓰지 않음(삭제는 대표 승인 뒤)
product/public/vesper/                   원본 assets(뇌 메시 bin · 장면 정지화면 · 아이콘) + 글꼴
product/vite.config.ts · tsconfig.app.json   @vesper 별칭 · next/* → shims
product/tailwind.config.ts               원본 Tailwind v4 토큰(@theme) → v3 theme.extend 로 옮김(값 그대로)
product/index.html                       Mulish·Onest 글꼴 link(지연 조각 CSS @import 는 막힌 망에서 화면 전체를 깨뜨려 옮김)
```

## 스크롤 순서(원본 Vesper 순서 그대로 · 글만 우리 것)
| 순서 | 원본 | 넣은 글 |
|---|---|---|
| 불러오기 막 | loader | DO IT / ECHO / ONLINE SERENDIPITY / 시작 준비 |
| 1막 구슬(히어로) | hero | 「당신이 잠든 사이, AI가 먼저 만나봅니다.」 · 승인 두 줄 · 지금 되는 일 한 줄 · [ ECHO ] [ ONLINE SERENDIPITY ] [ JUST TRY. ] · 「모바일로 시작하기」 |
| 2막 은하 | galaxy | 「잘 쓴 소개보다, 함께한 시간이 궁금해서.」 · 지금 되는 범위 한 줄(10/5 PM 보강) · 01~04 장면 이름 |
| 3막 뇌 | brain | 「내 이야기는, 내 말로.」 「마지막 말은, 나에게.」 |
| Solaris(추가 3D) | 태양 구슬 | 이야기 5장면 「오늘의 감정에도 이유가 있으니까.」 |
| Einstein–Rosen(추가 3D) | 웜홀 격자 | 이야기 8장면 「연결의 속도는, 각자가 정합니다.」 + 제작 과정 영상 |
| 흰 카드 1 | financial | 「홈 화면에서 바로 시작하세요.」 설치 방법(이용 안내 설치 항목과 같은 뜻) |
| 흰 카드 2 | faq | 이야기 9장면 + 10 대표 인사말(승인 원문) 접었다 펴기 |
| 바닥글 | footer | JUST TRY. · 「모바일로 시작하기」 · 「이용 안내」 · ECHO/회사 링크 · 사업자 정보·약관·개인정보·문의 (원본 이름·이메일 입력 칸은 뺌) |

## 보안·규칙 자가 점검
- CDN·외부 스크립트: src/vesper 안 0건(검사 `qa/design-v2-20261004.test.mjs`). 3D 는 번들 three 0.186.1.
- localStorage·sessionStorage·cookie: src/vesper 안 0건.
- 비밀값·개인정보 입력 칸: 0건(원본 연락 폼 제거).
- 금지어(데이팅·소개팅·궁합·점술·심리치료·성격검사)·Stripe·옛 가격: 0건.
- 앱 빌드(VITE_SITE_ROLE=app)에 three·vesper 0건 · 브랜드 빌드에 doit-connect/DoitApp/admin-web 0건 · .map 0건.
- 전역 index.css 수정 0 · 온보딩 파일 수정 0.

## 크기(브랜드 빌드 · gzip)
| 조각 | 크기 | gzip |
|---|---|---|
| 홈페이지 조각(vesper + three + fiber) | 약 941KB | 약 249KB |
| 장면 워커(휴대폰 ≤1024px · 필요할 때만) | 약 1,073KB | 약 290KB |
| 장면 캔버스 | 약 295KB | 약 90KB |
- 대표 허용(약 600KB)보다 크다. 원본 그대로 쓰라는 지시가 우선이라 그대로 두었고, 홈페이지 조각은 brand 빌드에서만 내려받는다(앱 0).

## 설치 의존성(고정)
three 0.186.1 · @react-three/fiber 9.8.1 · @react-three/drei 10.7.9 · @react-three/postprocessing 3.1.3 · postprocessing 6.39.5 · @react-spring/web 10.1.2 · spring-text-engine 0.1.5 · lenis 1.3.26 · zustand 5.0.12 · @types/three 0.186.0

## 검사
- type-check 0 · lint 0(src/vesper 는 제외) · node --test(옛 홈페이지 잠금 15건은 10/8 결정으로 새 구조 검사로 바꿈).
- 로컬 Playwright(SwiftShader WebGL): 휴대폰 390×844 · PC 1440×900 전체 스크롤 캡처 9장씩 + 동영상(WebM) · 화면 오류 0 · 승인 문구 모두 표시.
- 실기기(아이폰·안드로이드) 확인은 QA 게시 뒤 대표 확인 필요(확인 불가로 남김).
