# ECHO — 납품 문서 #5: 모바일 UX 문서

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY

---

## 1. 화면 구조

### 1.1 뷰포트 설정

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0, user-scalable=yes" />
```

| 속성 | 값 | 목적 |
|---|---|---|
| `width` | `device-width` | 기기 너비에 맞춤 |
| `initial-scale` | `1.0` | 초기 확대 배율 |
| `viewport-fit` | `cover` | Notch/Dynamic Island/Camera Hole 영역까지 확장 |
| `maximum-scale` | `5.0` | 사용자 확대 허용 (접근성) |
| `user-scalable` | `yes` | 사용자 확대/축소 허용 |

### 1.2 Dynamic Viewport Height

```css
html {
  height: -webkit-fill-available;
  height: 100dvh;
}
body {
  min-height: -webkit-fill-available;
  min-height: 100dvh;
}
```

| CSS | 목적 |
|---|---|
| `-webkit-fill-available` | iOS Safari에서 주소창 접힘 시 높이 보정 |
| `100dvh` | Dynamic Viewport Height — 모바일 브라우저 UI 변화 대응 |

### 1.3 레이아웃 모드

| 모드 | 트리거 | 동작 |
|---|---|---|
| Portrait | width < height | 단일 컬럼, 세로 스크롤 |
| Landscape | width > height | 단일 컬럼, 더 넓은 최대폭 |

---

## 2. Safe Area

### 2.1 CSS 변수

```css
:root {
  --safe-inset-top: env(safe-area-inset-top, 0px);
  --safe-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-inset-left: env(safe-area-inset-left, 0px);
  --safe-inset-right: env(safe-area-inset-right, 0px);
}
```

### 2.2 Safe Area 대응 요소

| 요소 | 적용 방식 |
|---|---|
| SequenceOverlay 닫기 버튼 | `top: calc(1rem + var(--safe-inset-top))`, `right: calc(1rem + var(--safe-inset-right))` |
| Report 닫기 버튼 | `top-4 right-4` (safe area 내 위치) |
| Admin 닫기/로그아웃 | `top-5 right-5` (safe area 회피) |
| 모바일 메뉴 | 전체 화면 — safe area에 콘텐츠가 가려지지 않도록 패딩 적용 |

### 2.3 유틸리티 클래스

```css
.safe-top { padding-top: var(--safe-inset-top); }
.safe-bottom { padding-bottom: var(--safe-inset-bottom); }
.safe-left { padding-left: var(--safe-inset-left); }
.safe-right { padding-right: var(--safe-inset-right); }
.fixed-safe-top { top: var(--safe-inset-top); }
.fixed-safe-bottom { bottom: var(--safe-inset-bottom); }
```

### 2.4 기기별 Safe Area

| 기기 | safe-inset-top | safe-inset-bottom |
|---|---|---|
| iPhone Pro (Dynamic Island) | ~59px | ~34px |
| iPhone SE (Notch) | ~47px | ~34px |
| iPhone 기본 (Notch) | ~47px | ~34px |
| Android (Camera Hole) | ~24px | 0~48px (Navigation Bar) |
| iPad | 0~20px | 0~20px |
| Galaxy Z Fold (커버) | ~24px | ~48px |

---

## 3. Touch Rule

### 3.1 최소 터치 영역

| 플랫폼 | 최소 크기 | 적용 |
|---|---|---|
| iOS (Apple HIG) | 44×44px | 모든 버튼, 닫기, 아이콘 |
| Android (Material) | 48×48dp | 동일하게 44px 기준으로 통일 |
| ECHO 기준 | **44×44px** | 모든 인터랙티브 요소 |

### 3.2 터치 최적화

| CSS 속성 | 값 | 목적 |
|---|---|---|
| `touch-action` | `manipulation` | 더블탭 줌 방지, 300ms 딜레이 제거 |
| `-webkit-tap-highlight-color` | `transparent` | 탭 하이라이트 제거 (커스텀 피드백 사용) |
| `user-select` | `none` (버튼 등) | 의도치 않은 텍스트 선택 방지 |
| `-webkit-overflow-scrolling` | `touch` | iOS 부드러운 스크롤 |

### 3.3 터치 피드백

| 요소 | 피드백 |
|---|---|
| 버튼 | `active:scale-95` 또는 `active:scale-[0.98]` |
| 시퀀스 카드 | `active:scale-[0.98]` + `active:bg-white/[0.03]` + `active:border-white/[0.16]` |
| 카드 이미지 | `group-active:scale-105` (호버 없이도 터치로 확대) |
| 어드민 탭 | `WebkitTapHighlightColor: transparent` |
| MagneticButton | `active:scale-[0.98]` |

### 3.4 제스처 충돌 방지

| 상황 | 처리 |
|---|---|
| 스와이프 vs 스크롤 | SequenceOverlay: 세로 스크롤 유지, 가로 제스처 무시 |
| 더블탭 줌 | `touch-manipulation`으로 방지 |
| 드래그 vs 클릭 | `active` 상태를 150ms 지속 후 클릭으로 판정 |
| iOS rubber-band | `overscroll-behavior-y: none` |
| Android pull-to-refresh | `overscroll-behavior-y: none` |

---

## 4. Keyboard 대응

### 4.1 Visual Viewport API

| 상황 | 대응 |
|---|---|
| 키보드 열림 | `window.visualViewport` 높이 변화 감지 → 입력창 위치 조정 |
| iOS Safari | `position: fixed` 요소가 키보드 위로 밀리지 않도록 `Visual Viewport` 기준 |
| Android Chrome | `windowResize` 이벤트로 높이 변화 감지 |

### 4.2 입력창 최적화

| 속성 | 값 |
|---|---|
| `font-size` | 최소 16px (iOS 자동 확대 방지) |
| `inputMode` | 상황에 맞게 (`email`, `numeric`, `text`) |
| 자동완성 | `autoComplete` 속성 설정 |

---

## 5. Gesture

### 5.1 지원 제스처

| 제스처 | 동작 | 적용 위치 |
|---|---|---|
| Tap | 클릭/선택 | 모든 버튼, 카드, 링크 |
| Vertical Swipe | 스크롤 | 전체 페이지, 오버레이 콘텐츠 |
| Pinch Zoom | 확대/축소 | 허용 (maximum-scale=5) |
| Double Tap | — | 방지 (touch-manipulation) |
| Long Press | — | 기본 동작 유지 |
| Edge Swipe | 뒤로 가기 | 시스템 제스처 (간섭 없음) |

### 5.2 제스처 네비게이션 호환

| 플랫폼 | 제스처 | ECHO 대응 |
|---|---|---|
| iOS | 하단 바 스와이프 (홈/앱 전환) | safe-inset-bottom으로 영역 확보 |
| Android | 하단 바 스와이프 (뒤로/홈) | safe-inset-bottom으로 영역 확보 |
| 삼성 One UI | 하단 바 + 측면 스와이프 | safe-inset-bottom/left/right로 영역 확보 |

---

## 6. Bottom Navigation

> ECHO는 Bottom Navigation Bar를 사용하지 않습니다. 대신:
> - **FloatingAuthPill**: 우측 하단 고정 플로팅 CTA
> - **모바일 메뉴**: 햄버거 → 풀스크린 메뉴 (세로 중앙 정렬)

### 6.1 모바일 메뉴 구조

```
햄버거 버튼 (md:hidden)
    ↓
풀스크린 오버레이 (z-20)
    ├── 7개 네비게이션 링크 (세로 중앙, 2xl 폰트)
    ├── "ECHO 시작하기" CTA (그라디언트)
    ├── 5개 소셜 링크 (Google, Instagram, LinkedIn, YouTube, Email)
    └── ECHO 이미지 + 타이포
```

### 6.2 모바일 메뉴 애니메이션

| 요소 | 애니메이션 |
|---|---|
| 메뉴 오버레이 | 즉시 표시 (opacity 전환 없음) |
| 네비 링크 | 각 링크 60ms stagger (인라인 animationDelay) |
| 소셜 아이콘 | 호버 시 opacity 0.55→1, border color 변경 |

---

## 7. Card Layout

### 7.1 시퀀스 카드 (모바일)

| 속성 | Desktop | Mobile |
|---|---|---|
| Grid | `md:grid-cols-3` | `grid-cols-1` |
| Gap | `gap-6` | `gap-4` |
| Padding | `p-8` | `p-5` |
| Image Height | `h-48` (192px) | `h-28` (112px) |
| Number Size | `text-[54px]` | `text-[36px]` |
| Title Size | `text-[18px]` | `text-[14px]` |
| Description | `text-[13px]` | `text-[11px]` |

### 7.2 어드민 카드 (모바일)

| 속성 | Desktop | Mobile |
|---|---|---|
| Stats Grid | `lg:grid-cols-5` | `grid-cols-2` |
| Table | `<table>` | 숨김 → 모바일 카드 |
| Visitors | 테이블 행 | `VisitorMobileCard` |
| Activity | 테이블 행 | `ActivityMobileCard` |
| Charts | 인라인 SVG | 동일 (반응형 viewBox) |

### 7.3 일반 카드

| 컨텍스트 | 모바일 패딩 | 모바일 Radius |
|---|---|---|
| Hero CTA | `px-6` | — |
| Section Card | `p-4` | `rounded-lg` |
| Auth Card | `p-6` | `rounded-xl` |
| Report Card | `p-6` | `rounded-xl` |

---

## 8. Button Size

### 8.1 CTA 버튼

| 사이즈 | Desktop | Mobile | 용도 |
|---|---|---|---|
| `lg` | `text-[17px]`, `px-8 py-4` | `text-[15px]`, `px-6 py-3.5` | Hero, 시퀀스 CTA |
| `md` | `text-sm` | `text-sm` | 일반 CTA |
| `sm` | `text-[10px]` | `text-[10px]` | Nav 회원가입 |

### 8.2 아이콘 버튼

| 유형 | Desktop | Mobile | 비고 |
|---|---|---|---|
| 닫기 버튼 | `w-10 h-10` (40px) | `w-11 h-11` (44px) | HIG 44px 충족 |
| 다크모드 토글 | `w-8 h-8` | `w-8 h-8` | — |
| 메뉴 햄버거 | `w-8 h-8` | `w-8 h-8` | — |
| 소셜 아이콘 | `w-9 h-9` | `w-9 h-9` | — |

---

## 9. Input Rule

### 9.1 폼 입력

| 속성 | 값 |
|---|---|
| `font-size` | 최소 16px (iOS 자동 확대 방지) |
| `padding` | `px-4 py-3` (수직 12px + 수평 16px) |
| `border-radius` | `rounded-xl` (12px) |
| `border` | `border-white/[0.08]` |
| `background` | `rgba(0,0,0,0.4)` |
| `color` | `text-white` |
| `placeholder` | `text-white/15` |

### 9.2 포커스 상태

| 상태 | 스타일 |
|---|---|
| 기본 | `border-white/[0.08]` |
| 포커스 | 1px 그라디언트 보더 (핑크→퍼플→골드) |
| 에러 | `border-red-500/50` |

### 9.3 셀렉트 (Select)

| 속성 | 값 |
|---|---|
| `appearance` | `none` (커스텀 화살표) |
| 화살표 | `ri-arrow-down-s-line` (absolute right-4) |
| 옵션 배경 | `bg-[#1a1a1a]` |

---

## 10. 기기별 특이사항

### 10.1 Galaxy Z Fold (커버 디스플레이 280px)

- 모든 그리드 → 단일 컬럼 (`grid-cols-1`)
- 폰트 축소: Hero `text-[15px]`, Card Title `text-[12px]`
- 패딩 최소화: `px-3 py-4`
- Safe Area: `env(safe-area-inset-*)` 로 Camera Hole 회피

### 10.2 Galaxy Z Flip (커버 디스플레이 320px)

- Fold와 동일한 단일 컬럼 전략
- CTA 버튼 full-width
- 닫기 버튼 위치 safe area 보정

### 10.3 iOS Safari 특이사항

- `-webkit-overflow-scrolling: touch` — 오버레이 스크롤
- `WebkitBackdropFilter` — blur 지원
- `position: fixed` + 키보드 — Visual Viewport API 대응

### 10.4 Samsung Internet 특이사항

- `backdrop-filter` 미지원 시 solid fallback (`rgba(10,10,10,0.92)`)
- `flex-shrink: 0` — flex 버그 방지

### 10.5 Android Firefox 특이사항

- `@-moz-document url-prefix()` — 스크롤 최적화

---

## 11. 성능 최적화 (모바일)

| 항목 | 설정 |
|---|---|
| WebGL Pixel Ratio | `Math.min(devicePixelRatio, 1)` (모바일) |
| 파티클 수 | Desktop 6000 / Mobile 2000 |
| 이미지 로딩 | `loading="lazy"` |
| 폰트 | `font-display: swap` |
| 애니메이션 | `prefers-reduced-motion` 대응 |

---

> **문서 승인**: 본 문서는 ECHO의 모든 모바일 UX 규칙을 정의합니다. iOS/Android 동등 지원을 기본 원칙으로 합니다.