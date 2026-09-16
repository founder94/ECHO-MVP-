# ECHO 긴급 반응형 오류 수정 — 실측·수정·검사 보고 (2026-09-16)

표현 한도: **로컬 구현 및 실행한 검사 완료**. 실기기(갤럭시 Chrome) 확인은 대표님 몫이며 아직 미실행이다.

## 1. 실제 원인 (코드 실측 + 실기기 스크린샷 대조)

| 증상(스크린샷) | 실제 원인 | 판정 |
|---|---|---|
| 초록→하늘색 그라디언트가 화면 중간에서 직각으로 끊김, 초록 층과 검은 우주 층이 겹침, 카드 위로 초록 사각형이 올라옴 | `src/pages/home/components/PastelBlobs.tsx` — 고정(fixed) 배경층 안의 색 원 6개(20~32rem)에 `filter: blur(100px)` + transform 애니메이션. Android Chrome 은 애니메이션 중인 필터 요소를 각각 GPU 레이어로 올리고, 큰 블러를 타일·텍스처 크기 안에서만 그려 **블러 결과가 사각형 경계에서 잘린다**. 스크린샷의 사각형 색(왼쪽 위 민트 `rgba(160,255,200)`, 오른쪽 위 하늘색 `rgba(160,220,255)`)과 위치(top -8%/left -6%, top 15%/right -5%)가 코드의 1·2번 원과 일치. 카드는 z-10 으로 위에 있지만 카드 배경이 흰색 3% 라 뒤의 밝은 사각형이 그대로 비쳐 "카드 위 침범"처럼 보인 것. 같은 패턴이 `FloatingEffects.tsx`(무지개 아크 140vw+blur 50px, 빛 기둥 blur 20px, 구름 blur, 구슬 backdrop-filter)에도 있음 | 색·위치 일치와 코드 구조는 **확정**. GPU 내부 동작은 실기기 재현 **미실행**(헤드리스 Chromium 은 이 잘림을 재현하지 못함). 수정은 블러 필터 자체를 없애므로 GPU 경로와 무관하게 사각 잘림이 생길 수 없다 |
| 헤더(ECHO·경험·기록)가 본문 "오늘 날씨가…" 글자 위에 겹침 | `Navbar.tsx` — `scrolled ? 'bg-transparent' : 'bg-transparent'` 로 스크롤 후에도 항상 투명. 고정 헤더 글자가 아래 본문 글자와 그대로 겹침 | **확정** (코드) |
| 메뉴 클릭으로 섹션 이동 시 제목이 헤더 뒤로 숨음(헤더에 배경을 주자 드러난 기존 구조 문제) | 섹션이 `ParallaxSection` 의 `overflow-hidden` 안에 있어 스크롤 컨테이너가 하나 더 생기고, `scroll-margin` 이 뷰포트까지 전달되지 않음(수정 전에도 제목 top=0 으로 실측) | **확정** (실측: 수정 전 0px → 수정 후 헤더 아래) |
| "모바일에서 데스크톱 폭", 헤더 한 줄에 로고·메뉴·햄버거·로그아웃 | 스크린샷의 CSS 폭은 768px 이상(태블릿/폴더블 가로 화면). `md:` 분기점(768px) 이상에서는 PC 와 같은 데스크톱 헤더가 나오는 것이 현재 설계. 768px 미만에서는 데스크톱 메뉴가 `hidden md:flex` 로 숨고 햄버거만 남는 것을 11개 폭에서 실측 | 오류 아님 → 설계 유지, 변경 없음 |
| 카드 max-width/left/transform 이상 | 카드 컨테이너 `max-w-lg mx-auto px-6`, transform `none`, 가운데 정렬을 11개 폭에서 실측. 잘려 보인 것은 위 1번 사각형이 카드 뒤에서 비친 것 | 오류 아님 |
| 100vh vs Android 주소창 | 홈 최상위 `min-h-screen`(100vh) | 100dvh + 100vh 폴백으로 교체 |
| 가로 스크롤 | 수정 전·후 모두 11개 폭에서 `scrollWidth == innerWidth` (0) | 오류 아님. 규칙대로 html/body/#root 폭 100%·가로 넘침 차단은 추가 |

체크 A~J: A(그라디언트가 width 50%/px 에 묶임) 해당 없음 — 잘림은 블러 필터 잘림 / B(relative 없는 absolute) 없음 — 모든 absolute 는 `fixed inset-0` 또는 `relative` 부모 안 / C(100vw) 무지개 아크 140vw·70vw 1건 → 140% + aspect-ratio 로 교체 / D(100vh) 홈 최상위 1건 → dvh+폴백 / E(데스크톱 transform 을 모바일에 강제) 없음(패럴랙스 translate 는 폭 무관 소량) / F(카드 고정 px) 없음(max-w-lg + 24px 여백) / G(데스크톱 flex 헤더) 768px 미만 이미 숨김 / H(배경 z-index 가 콘텐츠 위) 없음(배경 0·1·2, 콘텐츠 10) / I(부모 overflow 로 잘림) 배경층은 의도된 클리핑, 콘텐츠 잘림 없음 / J(iPhone 전용 분기점) 없음.

## 2. 수정 파일 (9개, 기준 = Readdy project-13871930)
`src/index.css`, `src/pages/home/page.tsx`, `src/pages/home/scrollToSection.ts`(신규), `src/pages/home/components/PastelBlobs.tsx`, `src/pages/home/components/FloatingEffects.tsx`, `src/pages/home/components/Navbar.tsx`, `src/pages/home/components/Footer.tsx`, `src/components/ScrollToTop.tsx`, `src/components/MusicPlayer.tsx`. 전체 변경은 `responsive.diff`, 해시는 `SOURCE_MANIFEST.json`.

## 3. 수정 전 코드 (핵심)
```tsx
// PastelBlobs.tsx
backgroundColor: blob.color, ... filter: 'blur(100px)',
// FloatingEffects.tsx
width: '140vw', height: '70vw', ... filter: 'blur(50px)',          // 무지개 아크
background: 'linear-gradient(to bottom, …)', filter: 'blur(20px)', // 빛 기둥
backdropFilter: 'blur(2px)',                                       // 구슬
style={{ …, background: 'rgba(255,255,255,0.07)', filter: 'blur(24px)' }} // 구름 조각
// Navbar.tsx
className={`fixed top-0 left-0 right-0 z-50 … ${scrolled ? 'bg-transparent' : 'bg-transparent'}`}
element.scrollIntoView({ behavior: 'smooth', block: 'start' });
// home/page.tsx
<div className="min-h-screen relative">
```

## 4. 수정 후 코드 (핵심)
```tsx
// PastelBlobs.tsx — 필터 없음, 투명으로 사라지는 그라디언트
background: `radial-gradient(circle at center, ${blob.color} 0%, ${blob.color} 18%, transparent 70%)`,
// FloatingEffects.tsx
width: '140%', aspectRatio: '2 / 1', maskImage: 'radial-gradient(ellipse at 50% 100%, black 40%, transparent 72%)', // 무지개
background: 'radial-gradient(ellipse 50% 50% at 50% 45%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 45%, transparent 100%)', // 빛 기둥
// 구슬: backdropFilter 삭제 / 구름 조각: radial-gradient(ellipse at center, rgba(255,255,255,0.07) 0%, transparent 70%)
// Navbar.tsx
className={`fixed top-0 left-0 right-0 z-50 … pt-[env(safe-area-inset-top)] ${scrolled ? 'bg-background-50/75' : 'bg-transparent'}`}
scrollToSectionBelowHeader(href.replace('#', ''));   // 헤더 실측 높이만큼 보정
// home/page.tsx
<div className="echo-home echo-min-h-viewport relative w-full max-w-full">
<div className="fixed inset-0 z-0 pointer-events-none animate-float-bg">  // 우주 사진층
// index.css
html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden; }  body, #root { overflow-x: clip; }
.echo-min-h-viewport { min-height: 100vh; min-height: 100dvh; }
```

## 5. 분기점
기존 Tailwind 기본 분기점만 사용: `sm` 640(카드 버튼 1열→2열), `md` 768(데스크톱 헤더·메뉴, 헤더 높이 64→80), `lg` 1024(여백). 새 미디어쿼리는 `scroll-margin` 의 768px 1건뿐이며 기기 전용 px 없음.

## 6. 뷰포트 처리
`index.html` `viewport-fit=cover` 유지 → 헤더 상단 `env(safe-area-inset-top)`, 하단 고정 버튼 2개 `env(safe-area-inset-bottom)`. 높이는 100dvh(폴백 100vh), 히어로는 기존 100svh 유지. `vw` 는 배경층에서 제거(140% 로 대체).

## 7. z-index 구조 (변경 없음)
배경 이미지 fixed z-0 → PastelBlobs fixed z-1(pointer-events none) → FloatingEffects fixed z-1(none) → NoiseOverlay fixed z-2(none) → 콘텐츠 `relative z-10` → ScrollToTop z-40 → Navbar z-50 → ScrollProgress·전체메뉴 z-60 → MusicPlayer z-100. 실측: 배경층 z/pointer-events `0/none, 1/none, 1/none, 2/none`(우주 사진층에 pointer-events-none 추가), 카드 z=10.

## 8. 폭별 실측 (헤드리스 Chromium, ≤430px 은 Android UA·DPR 3·터치, 실제 클릭 경로로 섹션 이동)
| 폭 | 가로스크롤 | 카드 폭 | 버튼 열 | 버튼 6개 화면 안 | 헤더 겹침 | 데스크톱 메뉴 | 배경층 filter/backdrop 잔존 | 스크롤 후 헤더 배경 | 앵커 후 제목 위치 | 결과 |
|---|---|---|---|---|---|---|---|---|---|---|
| 320 | 0 | 272 | 1 | ○ | 0 | 숨김 | 0/0 | 있음 | 헤더 아래 | PASS |
| 360 | 0 | 312 | 1 | ○ | 0 | 숨김 | 0/0 | 있음 | 헤더 아래 | PASS |
| 375 | 0 | 327 | 1 | ○ | 0 | 숨김 | 0/0 | 있음 | 헤더 아래 | PASS |
| 390 | 0 | 343 | 1 | ○ | 0 | 숨김 | 0/0 | 있음 | 헤더 아래 | PASS |
| 412 | 0 | 365 | 1 | ○ | 0 | 숨김 | 0/0 | 있음 | 헤더 아래 | PASS |
| 430 | 0 | 383 | 1 | ○ | 0 | 숨김 | 0/0 | 있음 | 헤더 아래 | PASS |
| 768 | 0 | 467 | 2 | ○ | 0 | 표시 | 0/0 | 있음 | 헤더 아래 | PASS |
| 1024 | 0 | 467 | 2 | ○ | 0 | 표시 | 0/0 | 있음 | 헤더 아래 | PASS |
| 1280 | 0 | 467 | 2 | ○ | 0 | 표시 | 0/0 | 있음 | 헤더 아래 | PASS |
| 1440 | 0 | 467 | 2 | ○ | 0 | 표시 | 0/0 | 있음 | 헤더 아래 | PASS |
| 1920 | 0 | 467 | 2 | ○ | 0 | 표시 | 0/0 | 있음 | 헤더 아래 | PASS |

수정 전 같은 검사: 11개 폭 모두 FAIL — 배경층 filter 32~65개·backdrop-filter 3~6개 잔존, 스크롤 후 헤더 투명, 앵커 후 제목 top=0(헤더 뒤). 가로 스크롤·카드 폭·버튼 위치는 수정 전에도 정상. 원본 `tests/after_results.json`, `tests/before_results.json`.

"그라디언트 잘림 0 / 레이어 침범 0" 은 헤드리스에서 GPU 잘림을 재현할 수 없으므로 **구조 검사**(배경층에 filter·backdrop-filter 0개, 모든 배경 그라디언트가 transparent 로 끝남)로 대체했다. 실기기 시각 확인은 대표님 확인 전까지 미완료.

## 9. 빌드 — 실행함, 성공 (`vite build`, 종료코드 0, out/index.html + assets/index-*.js/.css)
## 10. 타입체크 — 실행함, 오류 0 (`tsc --noEmit --project tsconfig.app.json`, 종료코드 0)
## 11. 린트 — 실행함, 오류 0·경고 0 (`eslint src --max-warnings 0`, 종료코드 0)

## 12. 모바일 캡처 — `shots/after_390_top.png`(히어로), `shots/after_390_card.png`(메뉴 이동 후 카드), 360·768 추가 캡처 `shots/after_360_card.png`·`shots/after_768_card.png` (나머지 폭 캡처는 Claude 로컬 보관, 측정값은 tests/after_results.json)
## 13. 데스크톱 캡처 — `shots/after_1024_card.png`, `shots/after_1440_top.png`, 비교용 `shots/before_1024_card.png`
샌드박스에서는 `storage.helloreaddy.io`(배경 우주 이미지·로고)와 CDN 아이콘 폰트가 차단되어 캡처에 배경 사진·아이콘이 비어 있다(레이아웃 검사에는 영향 없음). 실기기 스크린샷 원본은 `shots/device_galaxy_2026-09-16.jpg`.

## 14. 남은 오류·미확인
- 실기기(갤럭시 Chrome) 시각 확인 미실행 — 대표님 확인 후 기록.
- 같은 "큰 원 + blur(72px)" 패턴이 여정 화면 배경(`src/pages/do-it/weather/components/WeatherBackdrop.tsx`, 홈 미사용 `src/pages/home/components/WeatherBackdrop.tsx`)에도 있다. 이번 지시 범위(홈 화면) 밖이라 손대지 않았다. 갤럭시에서 `/weather` 이후 화면에도 같은 직각 잘림이 보이면 같은 방식(그라디언트 대체)으로 별도 패치.
- `vite.config.ts` 의 `sourcemap: true` 는 기존값 그대로. 배포 ZIP 은 지금까지처럼 `.map` 제외로 만든다.
- 이번 패치는 Readdy 에 반영되지 않았고 Netlify 에도 올리지 않았다(STOP 게이트).
