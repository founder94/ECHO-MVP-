# 홈페이지 3D 그림층 · GetLayers 3종 이식 (2026-10-08)

## 대표 결정(2026-10-08 · 대화 원문 기준)
- 홈페이지는 회사 얼굴 → 전문 제작물(GetLayers Full Stack 구매 · 대표 직접)로 교체. 3D 허용 · 약 600KB 추가 허용 · 모바일도 같은 계열 효과.
- 2026-10-05 「홈페이지 최종」 잠금은 다시 연다. 틀(Vite+React)은 유지하고 구매 코드를 이식. 갈아끼우는 구조(나중에 다른 템플릿으로 교체 가능).
- 템플릿: Vesper(1순위) · 추가로 준 3D 장면 2개(Solaris · Einstein–Rosen Lattice)도 효과에 포함. 온보딩(인트로 입자 D)은 그대로.
- 앱(app.do-it.company) 화면은 범위 밖.

## 받은 코드 검수
| 묶음 | 내용 | 외부 스크립트 | 비밀값 | 라이선스 파일 |
|---|---|---|---|---|
| vesper.zip(278개 · 3.1MB) | Next.js 16 + three 0.185 + fiber 9 + drei·postprocessing·lenis·react-spring·zustand · 구체→은하→뇌 3막 · 워커 렌더 | 0건 | 0건 | 없음(목록 화면 「Commercial licence」만) |
| solaris.zip(HTML 1 + README) | three 0.160 **CDN(unpkg) importmap** · 촘촘한 구 + 커서 불꽃 + fBm 오로라 + bloom · 제어판·localStorage | CDN 2건 → **우리 번들 three 로 대체(외부 요청 0)** | 0건 | 없음 |
| einstein-rosen-lattice.zip(HTML 1 + README) | three 0.143 **CDN** · 픽셀마다 광선 추적하는 웜홀 격자 셰이더 · bloom 2단 · 제어판·localStorage | CDN 2건 → 대체 | 0건 | 없음 |
- 세 묶음 모두 `.claude/settings.json`·제어판·localStorage 코드는 가져오지 않음(외부 지시·저장 0). 라이선스 원문은 대표가 GetLayers 약관에서 확인 필요.
- Vesper 글꼴(General Sans)은 쓰지 않음(Pretendard 유지).

## 구조(갈아끼우는 층)
```
product/src/pages/do-it/brand-home/
  page.tsx                       고정층(문구·버튼·9장면·영상·설치·고지) — <SceneHost slot="hero" /> · <SceneHost slot="making" /> 두 줄만
  brand-home.css                 층 규칙(켜진 뒤에만 지구·별 희미 · 글 앞 · 휴대폰 첫 화면 글 아래)
  layers/registry.ts             자리(hero·making)별 기본 장면 + 꽂을 수 있는 장면(동적 import) · spin · 미리보기 인자
  layers/gate.ts                 문지기: 움직임 줄이기·절약 모드·2GB 이하·WebGL 없음 → 안 켬 · 첫 그림 뒤 한가할 때
  layers/SceneHost.tsx           호스트: data-slot/data-layer/data-state(off·loading·on·failed)/data-why · 섹션에 data-scene-layer
  layers/shared/{clocks,inputs,color}.ts · FrameGate.tsx · Aurora.tsx   공통 시계·입력·오로라 배경(Solaris 원본)
  layers/vesper/   VesperHero.tsx(첫 화면 기본) · Orb · Atmosphere · adaptive · constants · orb-shaders · snoise · oil-pointer
  layers/solaris/  SolarisHero.tsx(첫 화면 대안 · ?scene_hero=solaris) · solaris-shaders
  layers/lattice/  LatticeScene.tsx(제작 과정 배경) · lattice-shaders
  intro/DoItEntry.tsx            미리보기 인자만 sessionStorage 에 기억(온보딩 화면 그대로)
product/qa/brand-home-layer-20261008.test.mjs   소스 규칙 6건 · qa-real/qa-live-sweep.mjs ⑦ 층 상태 2건
```
- 바꾸는 법: `layers/<이름>/` 폴더 → `registry.ts` loaders 한 줄 → 자리 id. 끄려면 `'none'`.
- 미리보기(QA 비교): 첫 화면 `?scene_hero=solaris` · 되돌리기 `?scene_hero=` · 제작 과정 끄기 `?scene_making=none`.

## 장면별 이식 내용
| 자리 | 장면 | 가져온 것 | 버린 것 | 바꾼 것 |
|---|---|---|---|---|
| 첫 화면(기본) | Vesper 입자 구체 | 구체 셰이더·노이즈·기름막 포인터·잔입자·폭별 설정 | Next·워커·Lenis·react-spring·은하·뇌·bloom·보라 불꽃 배경 | 색 파랑(#6fa8ff 계열) · 캔버스는 섹션 안 · 스크롤하면 흩어지고 올라오면 다시 모임 · 휴대폰은 구체를 글 위로 · 뒤에 Solaris 오로라(네 모서리 · 파랑·은빛) |
| 첫 화면(대안) | Solaris 태양 구체 | 구 셰이더(숨쉬기·가장자리 고리·커서 불꽃)·오로라 배경 | CDN·bloom·제어판·localStorage | 주황→은빛, 파랑 유지 · 스크롤하면 옅어짐 · 휴대폰은 구를 62% 로 줄여 글 위 |
| 제작 과정 | Einstein–Rosen 격자(연결의 다리) | 웜홀 격자 셰이더(광선 추적·안티앨리어스 격자)·시차·숨쉬기·누르면 맥동 | CDN·bloom 2단·glow·click zoom·제어판 | 금빛 목→얼음빛, 은빛 선·파란 테 · 투명 캔버스(별 위) · 휴대폰 STEPS 72→40 · dpr ≤0.85 |

## 지킨 것
- 승인 문구·시작 버튼 1개·지구 그림(img 유지 · 켜지면 30%)·워드마크·점 글자·4장 구조 → qa/design-v2-20261004 그대로 통과.
- CSS 보라·네온·회전·옆 스침·무한 반복 0. 층 CSS 는 brand-home.css 안에만(qa/background-lock 허용 목록). 원본 주황·금·민트·보라 값 0(테스트).
- page.tsx 에 three 정적 import 0 → 첫 조각 크기 그대로. 앱(app 역할) 빌드에 three 0건(실측).
- 움직임 줄이기: 두 자리 모두 켜지지 않음(실측 data-why=reduced-motion) · 보는 중 켜면 내림. WebGL 유실 시 내림.
- 온보딩(인트로)·라우터·앱 코드 변경 0(DoItEntry 는 인자 기억 3줄).

## 실측(2026-10-08 · 로컬 brand 빌드 · Chromium SwiftShader)
| 항목 | 값 |
|---|---|
| three+fiber 공용 조각(한 번만 받음) | 912.7KB 원본 / **239.2KB gzip** — 대표 허용 600KB 는 원본 기준 초과, 전송(압축) 기준 이내. Netlify 는 압축 전송 |
| 장면 조각 | Vesper 15.8KB · Solaris·Lattice 각 수 KB(gzip 6KB 안팎) |
| 첫 조각(index) | 변화 0(600KB · 기존) |
| 폰 390 | hero on(Vesper · 구체가 글 위) · making on(격자가 영상 뒤) · 스크롤 40% 에서 구체 흩어짐 |
| PC 1440 | hero on(구체 가운데 · 문구가 구체 안) · making on |
| 움직임 줄이기 | 두 자리 off(reduced-motion) · 원래 화면 |
| 게이트 | type-check 0 · lint 0 · qa 1369/0(todo 5) · 신규 테스트 6/0 |
확인 불가: 실기기(iPhone 저전력·안드로이드 저가) 발열·프레임 · 격자 셰이더의 폰 GPU 부하 — 대표 폰 확인 필요. QA 게시 뒤 실기기로.

## 보안 자체 점검(새 코드 범위)
- 외부 요청: 0(CDN importmap 제거 · 모든 셰이더·three 는 번들). CSP 없는 환경에서도 새 출처 0.
- 저장: localStorage 0 · sessionStorage 는 미리보기 인자(`scene_*` · 허용 목록 값만) 1곳.
- 입력: 주소 인자는 허용 목록(none·vesper·solaris·lattice)만 통과 · 그 외 무시. 포인터 좌표는 셰이더 uniform 으로만.
- 비밀값·개인정보·로그 출력: 0. 이벤트는 passive · 캔버스 pointer-events 없음(버튼 가림 0).

## 대표 확인 필요
1. 첫 화면: Vesper(기본) vs Solaris(`?scene_hero=solaris`) — 폰으로 보고 하나 고르기.
2. 구체 자전(spin) 켜 둠(원본보다 느림). 끄려면 registry.ts `spin: false`.
3. 지구 그림: 켜진 뒤 30%. 완전히 빼려면 CSS `opacity: 0`(img 는 테스트 때문에 유지).
4. GetLayers 라이선스 원문(재배포·제3자 자산) 확인.
5. 다음 후보: 이야기·설치 화면 배경(사진 유지 vs 장면) · 스크롤 시 Vesper 2막(은하) — 별도 승인.
