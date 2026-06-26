# ECHO — 납품 문서 #4: 애니메이션 문서 (Motion Specification)

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY

---

## 1. Hero Motion

### 1.1 3D Tunnel Animation

| 항목 | 값 |
|---|---|
| **시작 조건** | 페이지 로드 즉시 |
| **종료 조건** | 페이지 이탈 시 cleanup |
| **Duration** | 무한 루프 (rAF 기반) |
| **Easing** | Z축: lerp factor 0.24 (부드러운 추적) |
| **적용 위치** | Hero 섹션 Three.js Canvas |

**세부 동작:**
- 22개 원통 세그먼트가 Z축으로 무한 순환 (카메라 뒤로 넘어가면 앞으로 재배치)
- 스크롤 연동: `scrollProgress` → eased = `p^2 * (3 - 2p)` → `targetZ = -eased * MAX_TRAVEL`
- 카메라 회전: `cam.rotation.z = progress * PI * 0.6`
- 카메라 XY 오프셋: `sin(progress*6)*0.15*progress`, `cos(progress*6)*0.15*progress`
- Mosaic Panel 플리커: 매 3프레임마다 2% 픽셀 색상 변경
- 자동 드리프트: 첫 1초간 -8 Z (초기 진입감)

### 1.2 Content Fade-in

| 항목 | 값 |
|---|---|
| **시작 조건** | Hero 마운트 완료 |
| **Delay** | 400ms |
| **Duration** | 1200ms |
| **Easing** | `power3.out` |
| **적용 위치** | Hero 텍스트 + CTA 버튼 컨테이너 |
| **속성** | `opacity: 0→1`, `y: 30→0` |

### 1.3 Navigation Entrance

| 요소 | Delay | Duration | 속성 |
|---|---|---|---|
| Logo | 500ms | 700ms | opacity, x: -16→0, blur: 4→0px |
| Desktop Links | 650ms | 500ms (stagger 50ms) | opacity, y: -8→0, blur |
| Control Buttons | 1000ms | 450ms (stagger 70ms) | opacity, scale: 0.85→1, y: -4→0 |

---

## 2. Scroll Motion

### 2.1 Camera Dive Effect

| 항목 | 값 |
|---|---|
| **시작 조건** | 앵커 링크(`#section`) 클릭 또는 터치 |
| **종료 조건** | 500ms 후 target section으로 스크롤 |
| **Duration** | 500ms (body class `camera-diving`) |
| **CSS Animation** | `camera-dive-in` 0.3s ease-in-out |
| **적용 위치** | `body` 요소 |

**Camera Dive Keyframes:**
```
0%:   scale(1),      brightness(1)
20%:  scale(1.05),   brightness(1.3), translateZ(20px)
50%:  scale(1.15),   brightness(1.6), translateZ(60px), saturate(1.2)
80%:  scale(1.08),   brightness(1.2), translateZ(30px)
100%: scale(1),      brightness(1)
```

### 2.2 Section Dive Entrance

| 항목 | 값 |
|---|---|
| **시작 조건** | Camera Dive 종료 후 target section에 클래스 추가 |
| **Duration** | 600ms |
| **Easing** | `cubic-bezier(0.22, 1, 0.36, 1)` |
| **적용 위치** | `section-dive-entrance` 클래스 |
| **속성** | `translateY(80→0)`, `scale(0.95→1)`, `opacity(0.3→1)`, `blur(4→0px)` |

### 2.3 Progress Bar

| 항목 | 값 |
|---|---|
| **시작 조건** | 페이지 스크롤 |
| **업데이트** | `scroll` 이벤트 (passive) |
| **Easing** | 즉시 반영 (`transition: transform 0.1s linear`) |
| **적용 위치** | 상단 1px 라인 (`transform: scaleX(progress)`) |

---

## 3. Hover Motion

### 3.1 Magnetic Button

| 항목 | 값 |
|---|---|
| **시작 조건** | 버튼 영역 내 마우스 진입 |
| **종료 조건** | 마우스 이탈 |
| **동작** | 마우스 위치에 따라 버튼이 X/Y로 미세 이동 (최대 ±6px) |
| **적용 위치** | 모든 `MagneticButton` 인스턴스 |

### 3.2 Sequence Card Hover

| 항목 | 값 |
|---|---|
| **시작 조건** | `.seq-card`에 마우스 호버 |
| **Duration** | 500ms (`transition-all duration-500`) |
| **속성** | border opacity 증가, `-translate-y-1`, 배경 변화 |
| **이미지** | `group-hover:scale-105` (700ms) |
| **하단 라인** | `group-hover:bg-white/7` |

### 3.3 Navigation Link Hover

| 항목 | 값 |
|---|---|
| **Duration** | 300ms |
| **속성** | `opacity: 0.6→0.5` (hover:opacity-50) |

### 3.4 Admin Card Hover

| 항목 | 값 |
|---|---|
| **Duration** | 300~500ms |
| **속성** | `hover:bg-white/[0.015]`, border color transition |

---

## 4. Transition

### 4.1 Cinematic Transition (워프)

| 항목 | 값 |
|---|---|
| **시작 조건** | FloatingPill 또는 Nav "회원가입" 클릭 |
| **종료 조건** | `onTransitionComplete` 콜백 → `navigate('/auth')` |
| **적용 위치** | `<CinematicTransitionOverlay />` |
| **구현** | GSAP 타임라인 — 블랙 오버레이 + 워프 플래시 + 페이지 전환 |

### 4.2 Auth Page Warp Arrival

| 항목 | 값 |
|---|---|
| **시작 조건** | Auth 페이지 마운트 |
| **Duration** | 350ms (`transition-all duration-350`) |
| **속성** | 검은색 오버레이 `opacity: 1→0`, 워프 링 `scale(1→20)` + `opacity(0.6→0)` |
| **Easing** | `cubic-bezier(0.22, 1, 0.36, 1)` |

---

## 5. Camera Motion (Three.js)

### 5.1 Auth Canvas Phase Transitions

| Phase | 시각 변화 |
|---|---|
| `entry` | 기본 파티클 필드 |
| `portal_forming` | 파티클이 중앙으로 수렴, density 증가 |
| `portal_active` | 포털 고리 형성, 회전, 마우스 반응 강화 |
| `selection` | 선택한 카드 주변 파티클 집중, 나머지 산란 |
| `form` | 파티클 density 감소, 부드러운 배경 |
| `converge` | 모든 파티클 중앙 수렴 → 광원 효과 |
| `mirror` | 파티클이 거울처럼 반사 패턴 형성 |

### 5.2 SequenceOverlay Particle System

| 항목 | 값 |
|---|---|
| **입자 수** | Desktop 6000 / Mobile 2000 |
| **Blending** | AdditiveBlending |
| **연결선** | 거리 < 10 unit, 최대 3개 연결 |
| **마우스 반응** | 반경 28 unit 내 파티클 반발력 (lerp factor 0.04) |
| **스크롤 반응** | suction force = `0.0006 + scrollProgress * 0.0015` |
| **자연 운동** | sin/cos 기반 유기적 움직임 (감쇠 0.97) |
| **복원력** | 원래 위치로 0.0008~0.0006 속도로 복귀 |

### 5.3 Fog

| 항목 | 값 |
|---|---|
| **Scene Fog** | `FogExp2(0x000000, 0.018)` |
| **Vignette** | `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)` |

---

## 6. Particle Motion (CSS)

### 6.1 Float Animations

| 이름 | Duration | Easing | 용도 |
|---|---|---|---|
| `float-1` | 4.7~20s | ease-in-out | 수직 진동 (±20px) |
| `float-2` | 5~20s | ease-in-out | 수직 진동 + 회전 (±3deg) |
| `float-3` | 5~20s | ease-in-out | 수직 진동 + 회전 (±3deg, 반대 방향) |
| `float-3d-1` | 5~10s | ease-in-out | 3D 회전 진동 (rotateX/Y) |
| `float-3d-2` | 6.7~8s | ease-in-out | 3D 회전 (다른 패턴) |
| `float-3d-3` | 7~10s | ease-in-out | 3D 회전 (또 다른 패턴) |
| `float-3d-line` | — | ease-in-out | 수평 진동 |
| `float-particle` | — | ease-in-out | 파티클 부유 |

### 6.2 Flyer Animations

| 이름 | Duration | 동작 |
|---|---|---|
| `fly-ltr` | 6~10s | 좌→우 화면 가로지르기 |
| `fly-rtl` | 6~8s | 우→좌 화면 가로지르기 |
| `fly-diagonal-ltr` | 7~10s | 좌상→우하 대각선 |
| `fly-diagonal-rtl` | 6~9s | 우상→좌하 대각선 |

### 6.3 Mission Section Particles

| 이름 | Duration | 동작 |
|---|---|---|
| `mi-suction-particle` | — | 중앙으로 빨려들어가는 입자 |
| `mi-speed-streak` | — | 빠른 속도선 |
| `mi-suction-ring` | 3~5s | 고리 수축/팽창 (1→0.8→1.3) |
| `mi-scanline` | — | 스캔라인 수직 이동 (4px) |
| `mi-flash` | — | 섬광 점멸 (opacity 0↔0.08) |
| `mi-pulse-center` | — | 중앙 펄스 확장 (scale 1→1.5) |

---

## 7. Glass Reflection

| 항목 | 값 |
|---|---|
| **적용 위치** | SequenceOverlay (Z5 레이어) |
| **스타일** | `linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.015) 100%)` |
| **동작** | 정적 (항상 표시) |

### Volumetric Light Beam

| 항목 | 값 |
|---|---|
| **적용 위치** | SequenceOverlay (Z4 레이어) |
| **스타일** | `conic-gradient` with 4개의 밝은 섹터 + 투명 섹터 |
| **Duration** | 22s |
| **Animation** | `seq-volumetric-rotate` — 360도 무한 회전 |

---

## 8. Blur

### 8.1 SequenceOverlay Section Reveal

| 항목 | 값 |
|---|---|
| **시작 조건** | ScrollTrigger `onEnter` (trigger: top 72%) |
| **Duration** | `seq-line`: 1300ms (stagger 160ms) / `seq-card`: 900ms (stagger 180ms) |
| **Easing** | `power3.out` |
| **속성** | `opacity: 0→1`, `y: 35/45→0`, `filter: blur(6/4px→0)` |
| **once** | true (한 번만 실행) |

### 8.2 Report Section Reveal

| 항목 | 값 |
|---|---|
| **Duration** | 800ms (stagger 250ms) |
| **Easing** | `power3.out` |
| **속성** | `opacity: 0→1`, `y: 30→0`, `filter: blur(8px→0)` |

### 8.3 White Door Reveal

| 항목 | 값 |
|---|---|
| **시작 조건** | 마지막 리포트 섹션 완료 + 600ms |
| **Duration** | 900ms |
| **속성** | `opacity: 0→1`, `y: 24→0`, `filter: blur(8px→0)` |

### 8.4 White Door Open

| 항목 | 값 |
|---|---|
| **시작 조건** | "열어보기" 클릭 |
| **Duration** | 1200ms |
| **속성** | `opacity: 0→1`, `scale: 0.95→1`, `filter: blur(10px→0)` |

---

## 9. Page Transition

### 9.1 Auth Page Entry Text Reveal

| 항목 | 값 |
|---|---|
| **함수** | `textReveal(el, text, delay, duration)` |
| **방식** | 각 문자를 span으로 분리, GSAP으로 순차 opacity 0→1 |
| **Delay** | 0ms (기본), 라인 간 750ms |
| **Char Duration** | 20ms per char |
| **Stagger** | 17.5ms |
| **Easing** | `power2.out` |

### 9.2 Auth Page Question/Cards Transition

| 방향 | Duration | 속성 |
|---|---|---|
| In | 500ms (question), 350ms (cards, stagger 40ms, delay 150ms) | y: 40→0, opacity, blur, scale |
| Out | 250ms (question), 200ms (cards, stagger 20ms) | y: 0→-30, opacity: 1→0 |

---

## 10. Marquee

| 항목 | 값 |
|---|---|
| **이름** | `marquee` / `marquee-reverse` |
| **Duration** | 13.3s |
| **Easing** | linear infinite |
| **동작** | `translateX(0% → -50%)` (순방향) / `translateX(-50% → 0%)` (역방향) |
| **적용 위치** | `<CinematicMarquee />` |

---

## 11. 기타 모션

### 11.1 Admin Entrance Stagger

| 항목 | 값 |
|---|---|
| **시작 조건** | Admin 인증 완료 |
| **Stagger** | 60ms per card |
| **Duration** | 500ms |
| **속성** | `opacity: 0→1`, `translateY: 30→0` |

### 11.2 Modal Enter

| 항목 | 값 |
|---|---|
| **이름** | `modal-enter` |
| **Duration** | 450ms |
| **Easing** | `cubic-bezier(0.16, 1, 0.3, 1)` |
| **속성** | `scale(0.92→1)`, `translateY(30→0)`, `opacity(0→1)` |
| **적용 위치** | `MemberGateModal`, `TrialFormModal` |

### 11.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  body.camera-diving,
  .section-dive-entrance { animation: none; }
  .animate-marquee,
  .animate-marquee-reverse { animation: none; }
  .magnetic-btn,
  .magnetic-btn *,
  .magnetic-btn::before,
  .magnetic-btn::after { animation: none !important; transition: none !important; }
}
```

---

> **문서 승인**: 본 문서는 ECHO의 모든 모션/애니메이션에 대한 공식 명세입니다. 각 애니메이션의 시작·종료 조건, Duration, Delay, Easing, 적용 위치가 명시되어 있어 개발자와 디자이너가 동일하게 참조할 수 있습니다.