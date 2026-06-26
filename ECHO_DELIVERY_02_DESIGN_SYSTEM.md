# ECHO — 납품 문서 #2: 디자인 시스템 (Design System)

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY

---

## 1. Color Token

### 1.1 기본 컬러 팔레트 (Dark Theme)

| 토큰명 | HEX | 용도 |
|---|---|---|
| `dark` | `#050505` | 메인 페이지 배경 |
| `black` | `#0A0A0A` | 컴포넌트 배경, nav 스크롤 배경 |
| `graphite` | `#2A2A2A` | Admin 카드 배경 |
| `blackCard` | `#0F0F0F` | Admin 대시보드 카드 배경 |
| `accent` | `#FF5A1F` | Tailwind config accent (CTA 보조) |

### 1.2 의미론적 컬러 (Admin Dashboard)

| 토큰 | HEX | 용도 |
|---|---|---|
| `gold` | `#F5D4A1` | Primary accent, CTA, 중요 데이터 |
| `pink` | `#D4A0B8` | Secondary accent, 전환율, 감성 |
| `silver` | `#A0A0B0` | Neutral, 메타 정보, 구분선 |
| `white` | `#F5F5F5` | 텍스트, 강조 |
| `emerald` | `#6EE7B7` | 성공, 정상, Healthy |
| `amber` | `#FBBF24` | 경고, 주의, Degraded |
| `danger` | `#F87171` | 오류, Critical, 장애 |

### 1.3 브랜드 컬러 (Auth/Report)

| 토큰 | HEX | 용도 |
|---|---|---|
| `GOLD_ACCENT` | `#FFD700` | ECHO 브랜드 골드 |
| `PINK_ACCENT` | `#FF6B9D` | ECHO 브랜드 핑크 |
| `PURPLE_ACCENT` | `#9B59B6` | ECHO 브랜드 퍼플 |

### 1.4 그라디언트

| 이름 | 값 | 사용처 |
|---|---|---|
| ECHO Brand | `linear-gradient(135deg, #FF6B9D, #9B59B6, #FFD700)` | ECHO 로고 타이포 (text-clip) |
| CTA Primary | `linear-gradient(135deg, #FF6B9D, #9B59B6)` | 회원가입/로그인 버튼 |
| CTA Gold | `linear-gradient(135deg, rgba(245,212,161,0.1), rgba(125,216,228,0.1))` | Report 트리거 버튼 |
| Admin Gold | `linear-gradient(145deg, #0F0F0F 0%, #F5D4A106 50%, #0F0F0F 100%)` | Admin 통계 카드 |

### 1.5 투명도 스케일

| 클래스 | 용도 |
|---|---|
| `white/90` | 메인 헤드라인 |
| `white/70` | 서브 타이틀 |
| `white/50` | 본문 텍스트 |
| `white/35` | 보조 텍스트 |
| `white/25` | 힌트/플레이스홀더 |
| `white/15` | 메타 정보 |
| `white/10` | 비활성/배경 요소 |
| `white/05` | 최소 강조 보더 |

---

## 2. Typography

### 2.1 폰트 패밀리

| 역할 | 폰트 | CSS Variable | 용도 |
|---|---|---|---|
| Heading | Playfair Display | `var(--font-heading)` | Hero, 섹션 타이틀, 인용문 |
| Body | Inter | `var(--font-body)` | 본문 텍스트, 설명 |
| Label/Mono | JetBrains Mono | `var(--font-label)` | 라벨, 메타, 숫자, 코드 |

### 2.2 타입 스케일

| 용도 | Desktop | Mobile | Weight | Letter Spacing |
|---|---|---|---|---|
| Hero H1 | 56px | 32px | Bold (700) | -0.02em |
| Section Title | 32~40px | 22~28px | Normal (400) | -0.02em |
| Card Title | 18px | 14px | Medium (500) | -0.01em |
| Body Large | 16px | 15px | Normal (400) | — |
| Body | 14px | 13px | Normal (400) | — |
| Body Small | 13px | 11px | Normal (400) | — |
| Meta | 11px | 9px | Normal (400) | 0.1em~0.2em |
| Label | 10px | 9px | Medium (500) | 0.15em~0.45em |
| Micro | 8px | 8px | Normal (400) | 0.15em |

### 2.3 폰트 로딩

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet">
```

---

## 3. Grid System

### 3.1 기본 그리드

| 속성 | 값 |
|---|---|
| Grid Unit | 80px (plus-x-grid 배경) |
| Container Max-W | 6xl (72rem / 1152px) |
| Column Gap | 4~6 (16~24px) |
| Row Gap | 5~6 (20~24px) |

### 3.2 반응형 그리드

| 기기 | Columns | Gap |
|---|---|---|
| Desktop | 12 | 6 (24px) |
| Tablet | 6~8 | 5 (20px) |
| Mobile | 2~4 | 4 (16px) |
| Fold | 1 | 3 (12px) |

### 3.3 어드민 그리드

| 영역 | Desktop | Tablet | Mobile |
|---|---|---|---|
| Stats Cards | `grid-cols-2 lg:grid-cols-5` | `grid-cols-2` | `grid-cols-2` |
| Main Layout | `grid-cols-1 lg:grid-cols-2` | `grid-cols-1` | `grid-cols-1` |
| Health Score | `grid-cols-1 lg:grid-cols-3` | `grid-cols-1` | `grid-cols-1` |
| Health Checks | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` | 2 | 2 |
| Compatibility | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | 2 | 1 |

---

## 4. Spacing

### 4.1 스페이싱 스케일

| 토큰 | Tailwind | px | 용도 |
|---|---|---|---|
| xs | `gap-2` / `p-2` | 8px | 아이콘 간격, 초밀착 |
| sm | `gap-3` / `p-3` | 12px | 카드 내부 간격 |
| md | `gap-4` / `p-4` | 16px | 기본 카드 패딩 |
| lg | `gap-5` / `p-5` | 20px | 섹션 내 간격 |
| xl | `gap-6` / `p-6` | 24px | 섹션 패딩 |
| 2xl | `gap-8` / `p-8` | 32px | 대형 패딩 |
| 3xl | `gap-10` / `p-10` | 40px | 섹션 간 간격 |
| 4xl | `gap-12` / `p-12` | 48px | 페이지 상단/하단 |

### 4.2 섹션 수직 리듬

| 구간 | Mobile | Desktop |
|---|---|---|
| Hero Height | 200vh | 200vh |
| Section Padding | `py-10~16` | `py-16~20` |
| Marquee Height | auto | auto |
| Card Gap | `gap-4` | `gap-6` |
| Text Line Gap | `mb-3` | `mb-6` |
| CTA 하단 여백 | `20vh` | `40vh` |

---

## 5. Radius

| 요소 | 클래스 | 값 |
|---|---|---|
| 카드/컨테이너 | `rounded-lg` | 8px |
| 카드 (대형) | `rounded-xl` | 12px |
| 카드 (어드민) | `rounded-2xl` | 16px |
| 버튼 | `rounded-full` | 원형 |
| 폼 입력 | `rounded-xl` | 12px |
| 탭 버튼 | `rounded-full` | 원형 |
| 아이콘 컨테이너 | `rounded-xl` | 12px |
| 모달 | `rounded-2xl` | 16px |
| 아바타 | `rounded-full` | 원형 |
| Badge/Chip | `rounded-full` | 원형 |

---

## 6. Shadow

> ECHO 디자인 시스템은 **그림자(shadow)를 사용하지 않습니다.** (디자인 원칙: 플랫 + 글래스)
> 예외: 어드민 대시보드의 글로우 효과는 `boxShadow` 인라인 스타일로 제한적 사용

### 예외적 글로우 효과

```css
/* Admin CTA card glow */
boxShadow: '0 0 40px rgba(255,107,157,0.2)'

/* Report ECHO logo */
filter: 'drop-shadow(0 0 80px rgba(255,107,157,0.4))'

/* White Door glow */
boxShadow: '0 0 60px rgba(255,255,255,0.08)'
```

---

## 7. Glass Style

### 7.1 글래스 토큰

| 속성 | 메인 페이지 | Auth 페이지 | Admin |
|---|---|---|---|
| Background | `bg-[#0a0a0a]/85` | `rgba(255,255,255,0.02)` | `#0F0F0F` |
| Backdrop | `backdrop-blur-xl` | `blur(40px)` | `backdrop-blur-(20px)` |
| Border | `border-white/[0.03~0.10]` | `border-white/[0.08]` | `border-[color]15` |
| Webkit | 필요 시 | `WebkitBackdropFilter: blur(40px)` | `WebkitBackdropFilter: blur(20px)` |

### 7.2 Fallback (Samsung Internet)

```css
@supports not (backdrop-filter: blur(1px)) {
  .backdrop-blur-sm,
  .backdrop-blur-xl {
    background-color: rgba(10, 10, 10, 0.92);
  }
}
```

---

## 8. Motion Token

### 8.1 이징 커브

| 이름 | 값 | 용도 |
|---|---|---|
| `power3.out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 메인 엔트런스 애니메이션 |
| `power2.out` | `cubic-bezier(0, 0, 0.58, 1)` | 텍스트 리빌, 카드 등장 |
| `power2.in` | `cubic-bezier(0.42, 0, 1, 1)` | 퇴장 애니메이션 |
| `power3.inOut` | — | 전환 |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | CSS 전환 |
| `cubic-bezier(0.22, 1, 0.36, 1)` | — | Dive 효과 |

### 8.2 지속 시간

| 토큰 | 값 | 용도 |
|---|---|---|
| `instant` | 75ms | 커서 이동 |
| `fast` | 200~300ms | 호버, 탭 피드백 |
| `normal` | 400~500ms | 모달 등장, 섹션 진입 |
| `slow` | 700~900ms | 메인 엔트런스, Hero |
| `cinematic` | 1000~1500ms | 시네마틱 시퀀스, 워프 |
| `loop` | 3~22s | 배경 애니메이션 루프 |

### 8.3 스태거

| 컨텍스트 | 값 |
|---|---|
| 네비게이션 링크 | 50ms |
| 텍스트 라인 | 160ms |
| 카드 | 180ms |
| 컨트롤 버튼 | 70ms |
| 단어 (textReveal) | 17.5ms/char |

---

## 9. Component Rule

### 9.1 디렉토리 구조

```
src/
├── components/
│   ├── base/         # 원자적 컴포넌트 (Button, Card, Input)
│   │   └── MagneticButton.tsx
│   └── feature/      # 기능적 컴포넌트 (Nav, Footer, Provider)
│       ├── FPSDiveProvider.tsx
│       ├── FPSOverlay.tsx
│       └── AnalyticsProvider.tsx
├── pages/
│   ├── [pageName]/
│   │   ├── page.tsx          # 페이지 엔트리
│   │   ├── components/       # 페이지 전용 컴포넌트
│   │   ├── data/             # 페이지 전용 데이터
│   │   └── hooks/            # 페이지 전용 훅
```

### 9.2 컴포넌트 작성 원칙

1. **Props 인터페이스**: 모든 컴포넌트는 명시적 Props 타입 정의
2. **CSS-in-Tailwind**: 인라인 스타일은 동적 값에만 사용
3. **isDarkMode**: 모든 UI 컴포넌트가 다크/라이트 토글 수용
4. **애니메이션**: GSAP 컨텍스트는 `useLayoutEffect` 내에서 `gsap.context()` 사용
5. **클린업**: 모든 `useEffect`/`useLayoutEffect`는 cleanup 함수 반환
6. **접근성**: `aria-label`, `role`, `tabIndex`, `onKeyDown` 지원
7. **성능**: WebGL 리소스는 `dispose()` 호출로 정리

### 9.3 네이밍 컨벤션

| 요소 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 파일 | PascalCase | `SequenceOverlay.tsx` |
| 훅 파일 | camelCase, use 접두사 | `useAuth.ts` |
| 데이터 파일 | camelCase | `experiences.ts` |
| CSS 클래스 | kebab-case | `.section-dive-entrance` |
| Props | camelCase | `isDarkMode` |
| 커스텀 이벤트 | snake_case | `auth_signup` |

---

## 10. Icon Rule

### 10.1 아이콘 라이브러리

| 라이브러리 | 버전 | 접두사 | 용도 |
|---|---|---|---|
| Remix Icon | 4.5.0 | `ri-` | 주력 아이콘 (라인 스타일) |
| Font Awesome | 6.4.0 | `fa-` | 보조 아이콘 (소셜 미디어) |

### 10.2 아이콘 CDN

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.5.0/remixicon.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

### 10.3 아이콘 사용 규칙

1. Remix Icon을 기본으로 사용 (선형 스타일 `ri-*-line`)
2. Font Awesome은 소셜 미디어 등 Remix에 없는 아이콘에만 사용
3. 아이콘 부모 요소에 `w-[size] h-[size] flex items-center justify-center` 적용
4. 아이콘 크기는 `text-sm`(14px)~`text-lg`(18px) 범위
5. npm import 금지 — CDN만 사용
6. 모든 아이콘은 `<i className="..."/>` 형식

### 10.4 주요 아이콘 매핑

| 의미 | Remix Icon |
|---|---|
| 닫기 | `ri-close-line` |
| 화살표 | `ri-arrow-right-line` |
| 검색 | `ri-search-line` |
| 사용자 | `ri-user-line` |
| 설정 | `ri-settings-line` |
| 메뉴 | `ri-menu-line` |
| 문 | `ri-door-open-line` |
| 홈 | `ri-home-line` |
| 이메일 | `ri-mail-line` |
| 체크 | `ri-check-line` |
| 에러 | `ri-error-warning-line` |
| 정보 | `ri-information-line` |
| 리프레시 | `ri-refresh-line` |
| 로딩 | `ri-loader-4-line` (animate-spin) |
| 인증 | `ri-shield-check-line` |
| 데이터 | `ri-bar-chart-line` / `ri-line-chart-line` |

---

> **문서 승인**: 이 디자인 시스템은 ECHO의 모든 시각적 요소와 상호작용의 기준입니다. Figma 디자인 토큰과 1:1 매핑되어야 합니다.