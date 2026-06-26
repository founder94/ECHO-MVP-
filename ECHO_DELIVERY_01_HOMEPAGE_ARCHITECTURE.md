# ECHO — 납품 문서 #1: 홈페이지 설계서 (Homepage Architecture)

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY
> 문서 목적: GitHub·Figma·Lovable·Cursor로 이어질 때 기준이 되는 공식 설계 문서

---

## 1. 전체 IA (정보 구조)

```
ECHO (echo.do-it.company)
├── 홈페이지 (/)
│   ├── Canonical Hero (3D 터널 + 음파)
│   ├── Cinematic Marquee (전진)
│   ├── Three Emotions Section
│   ├── Section 1 — Mission
│   ├── Section 2 — About / Approach
│   ├── CEO Statement + Founder Story Trigger
│   ├── Cinematic Marquee (후진, accent)
│   ├── Video Section
│   ├── Section 3 — Services
│   ├── Section 4 — Work
│   ├── Section 5 — Strategy
│   ├── Video Examples
│   ├── Mission Impossible Section
│   ├── Report Experience Trigger
│   ├── Data Speaks Section + AI Trigger
│   ├── Pattern Engine Section
│   ├── Section 6 — Contact
│   ├── Elevator Section
│   ├── A Section
│   ├── Find Me Section
│   ├── FAQ Section (카테고리 탭)
│   └── Footer
├── About 페이지 (/about)
├── Portfolio 페이지 (/portfolio)
├── Auth 페이지 (/auth) — 회원가입/로그인
├── Report 페이지 (/report) — AI 분석 결과
├── Thank You 페이지 (/thank-you)
├── Admin 페이지 (/admin) — 관리자 콘솔
└── 404 페이지 (*)
```

---

## 2. 페이지 구조

| 경로 | 페이지 | 상태 | 설명 |
|---|---|---|---|
| `/` | Home | ✅ 완성 | 10섹션 + 오버레이 7종의 풀페이지 인터랙티브 홈 |
| `/about` | About | ✅ 완성 | About ECHO 시퀀스 오버레이 트리거 포함 |
| `/portfolio` | Portfolio | ✅ 완성 | 포트폴리오 갤러리 |
| `/auth` | Auth | ✅ 완성 | Three.js 배경 + 워프 진입 + 회원가입 2단계 온보딩 + 로그인 |
| `/report` | Report | ✅ 실가동 | Edge Function → OpenAI 분석 → White Door |
| `/thank-you` | Thank You | ✅ 완성 | 감사 페이지 |
| `/admin` | Admin Console | ✅ 완성 | 15탭 분석 대시보드 (비밀번호 보호) |
| `*` | 404 | ✅ 완성 | NotFound 페이지 |

---

## 3. 홈페이지 섹션 구조 (전체 23개 렌더링 유닛)

### 3.1 고정 요소 (Z-Index 기준)

| Z | 요소 | 설명 |
|---|---|---|
| 9999 | Custom Cursor | 마우스 팔로우 커서 (데스크톱 전용) |
| 50 | Progress Bar | 스크롤 진행률 표시 (상단 1px 라인) |
| 40 | Section Nav (우측) | 8개 섹션 도트 내비게이션 |
| 30 | Top Nav | ECHO 로고 + 7개 링크 + 회원가입 버튼 |
| 20 | Mobile Menu | 전체 화면 모바일 메뉴 |
| 3 | Flyer Shapes | 부유하는 기하 도형 12개 |
| 2 | Floating Particles | 3D 회전 링/사각형/파티클 48개 |
| 1 | Plus-X Grid | 80px 그리드 오버레이 |

### 3.2 스크롤 섹션 (순서대로)

| # | Section ID | 컴포넌트 | Hero Height | 설명 |
|---|---|---|---|---|
| 0 | `#hero` | `<Hero />` | 200vh (sticky) | Three.js 3D 터널 + "진짜 나를 찾아줘" + CTA + 음파 |
| 1 | — | `<CinematicMarquee />` | — | "HUMAN RELATIONSHIP OPERATING SYSTEM" 등 순방향 마키 |
| 2 | — | `<ThreeEmotionsSection />` | — | ECHO의 세 가지 감정 가치 제안 (관계·이해·성장) |
| 3 | `#section1` | `<Section1 />` | — | Mission 섹션 |
| 4 | `#section2` | `<Section2 />` | — | About / Approach 섹션 |
| 5 | — | `<CEOStatement />` | — | CEO 메시지 + Founder Story 트리거 |
| 6 | — | `<CinematicMarquee />` | — | "CREATIVELY RATIONAL" 등 역방향 accent 마키 |
| 7 | — | `<VideoSection />` | — | 비디오 섹션 |
| 8 | `#services` | `<Section3 />` | — | Services |
| 9 | `#work` | `<Section4 />` | — | Work |
| 10 | — | `<Section5 />` | — | Strategy |
| 11 | — | `<VideoExamples />` | — | 비디오 예시 |
| 12 | — | `<MissionImpossibleSection />` | — | "불가능한 미션" 섹션 + Mission 오버레이 트리거 |
| 13 | — | Report Trigger | — | "당신의 관계, 데이터로 읽어드립니다" + Report 시퀀스 트리거 |
| 14 | — | `<DataSpeaksSection />` | — | 데이터 스피크 + AI 시퀀스 트리거 |
| 15 | — | `<PatternEngineSection />` | — | 패턴 엔진 섹션 |
| 16 | `#contact` | `<Section6 />` | — | Contact |
| 17 | — | `<ElevatorSection />` | — | 엘리베이터 피치 |
| 18 | — | `<ASection />` | — | 추가 섹션 |
| 19 | `#find-me` | `<FindMeSection />` | — | Identity / Find Me |
| 20 | — | `<FaqSection />` | — | FAQ (4개 카테고리 탭) |
| 21 | — | `<Footer />` | — | ECHO 배경 이미지 + 5컬럼 푸터 |

---

## 4. 버튼 구조

### 4.1 CTA 버튼 (Primary)

| 위치 | 텍스트 | 동작 | 트리거 방식 |
|---|---|---|---|
| Hero | "시작하기" | MagneticButton → `withMemberGate` → 온보딩 오버레이 | 클릭 |
| Hero | "더 알아보기 →" | `/about` 페이지 이동 | 클릭 |
| Mobile Menu | "ECHO 시작하기" | `withMemberGate` → 온보딩 | 클릭 |
| Floating Pill | — | 시네마틱 전환 → `/auth` | 클릭 |
| Top Nav | "회원가입" | 시네마틱 전환 → `/auth` | 클릭 |

### 4.2 오버레이 트리거 버튼

| 트리거 | 대상 오버레이 | 게이트 |
|---|---|---|
| About 버튼 | `<SequenceOverlay config={ABOUT_EXPERIENCE} />` | Member Gate |
| AI 버튼 | `<SequenceOverlay config={AI_EXPERIENCE} />` | Member Gate |
| Founder 버튼 | `<SequenceOverlay config={FOUNDER_EXPERIENCE} />` | Member Gate |
| Report 버튼 | `<SequenceOverlay config={REPORT_EXPERIENCE} />` | Member Gate |
| Mission 버튼 | `<MissionCinematicOverlay />` | Member Gate |
| Approach 버튼 | `<ApproachCinematicOverlay />` | Member Gate |
| Trial 버튼 | `<OnboardingCinematicOverlay />` | Member Gate |

### 4.3 네비게이션 바 링크

| 라벨 | href | 대상 |
|---|---|---|
| ECHO | `#hero` | Hero 섹션 |
| Mission | `#section1` | Section 1 |
| About | `#section2` | Section 2 |
| Approach | `#approach` | Approach 섹션 |
| Services | `#services` | Section 3 |
| Work | `#work` | Section 4 |
| Contact | `#contact` | Section 6 |
| Identity | `#find-me` | Find Me 섹션 |

---

## 5. 페이지 흐름 (Page Flow)

```
[사용자 진입]
    │
    ├── / (홈페이지) ← 기본 랜딩
    │   ├── 스크롤 다운 → 23개 섹션 순차 경험
    │   ├── "시작하기" 클릭 → Member Gate 체크
    │   │   ├── 비로그인 → MemberGateModal → /auth
    │   │   └── 로그인 → OnboardingCinematicOverlay
    │   ├── "회원가입" 클릭 → CinematicTransitionOverlay → /auth
    │   └── Experience 버튼 클릭 → Member Gate → SequenceOverlay
    │
    ├── /auth
    │   ├── 회원가입 탭
    │   │   ├── Entry → 텍스트 리빌 → "회원가입" 클릭
    │   │   ├── Step1 (3지선다 질문) → 답변 선택
    │   │   ├── Step2 (3지선다 질문) → 답변 선택
    │   │   ├── Form (이메일·비밀번호·닉네임·연령대·약관)
    │   │   ├── 제출 → Supabase signup + Readdy Form 전송
    │   │   └── Completion → "ECHO 시작하기" → /
    │   └── 로그인 탭
    │       ├── 이메일/비밀번호 입력
    │       ├── 제출 → Supabase login
    │       └── 성공 → / 로 리다이렉트
    │
    ├── /report
    │   ├── 미인증 → /auth로 리다이렉트
    │   ├── 로딩 → localStorage/profiles에서 온보딩 답변 읽기
    │   ├── 생성 중 → "당신의 관계 데이터를 분석하고 있습니다"
    │   ├── 완료 → 6섹션 마크다운 리포트 (GSAP 순차 표시)
    │   └── White Door → 문 열기 인터랙션 → 최종 메시지
    │
    └── /admin
        ├── 비밀번호 입력 (0000)
        └── 15탭 대시보드 (5초 자동 갱신)
```

---

## 6. 사용자 플로우 (User Flow)

### 6.1 신규 사용자 (비회원 → 회원가입 → 첫 경험)

```
랜딩 (/) → Hero 감상 → 스크롤 탐험
    → "시작하기" 클릭 → Member Gate Modal
    → "회원가입하기" → CinematicTransitionOverlay
    → /auth (워프 진입)
    → Entry 텍스트 리빌: "관계 속에서, 혹은 문득, 나를 만나는 여정"
    → Tab: "회원가입" 선택
    → Step1: "당신은 지금 무엇을 찾고 있습니까?" (4지선다)
    → Step2: "당신은 지금 어떤 상태입니까?" (4지선다)
    → Form: 이메일·비밀번호·닉네임·연령대·약관 6종
    → 제출 (Supabase Auth + Readdy Form)
    → Canvas Phase: converge → mirror
    → Completion: "ECHO" 그라디언트 타이포 + "ECHO 시작하기"
    → / (홈) 복귀
    → 이제 모든 Experience 버튼이 즉시 열림 (Member Gate 통과)
```

### 6.2 기존 회원 (로그인 → AI 분석)

```
/ → "시작하기" → 바로 OnboardingCinematicOverlay
    → 온보딩 3질문 답변 (localStorage 저장)
    → "무료 체험 신청" → TrialFormModal (Readdy Form)
    → /report (AI 분석 시작)
    → Edge Function 호출 (localStorage 답변 + profiles 폴백)
    → OpenAI gpt-4o-mini 응답
    → 6섹션 리포트 GSAP 순차 표시
    → White Door 등장 → "열어보기" → 최종 통찰 메시지
    → "홈으로 돌아가기"
```

### 6.3 익명 탐색자 (비회원 → Member Gate)

```
/ → Experience 버튼 클릭 → Member Gate Modal
    → "ECHO는 회원 전용 경험입니다"
    → "회원가입하기" → /auth
    → "로그인하기" → /auth?mode=login
    → "나중에 하기" → Modal 닫기 → 스크롤 계속
```

---

## 7. Member Gate 구조

### 7.1 게이트 로직

```typescript
// src/pages/home/page.tsx
const withMemberGate = useCallback((action: () => void) => {
  return () => {
    if (isAuthenticated) {
      action();                    // 바로 실행
    } else {
      setMemberGateOpen(true);     // Member Gate Modal 표시
    }
  };
}, [isAuthenticated]);
```

### 7.2 게이트 적용 대상

| 대상 | 게이트 여부 |
|---|---|
| 4개 Sequence Overlay (About, AI, Founder, Report) | ✅ |
| Mission Cinematic Overlay | ✅ |
| Approach Cinematic Overlay | ✅ |
| Onboarding Cinematic Overlay | ✅ |
| Trial Form Modal | ✅ |
| CEO Statement (Founder Story 트리거) | ✅ |
| Data Speaks (AI 트리거) | ✅ |
| Report Experience Trigger | ✅ |

### 7.3 MemberGateModal 컴포넌트

- 타입: Modal (z-index 10001)
- 배경: `bg-black/85 backdrop-blur-md`
- 패널: `max-w-sm rounded-2xl border-white/[0.08] bg-[#0f0f0f]`
- 애니메이션: `modal-enter` 0.45s cubic-bezier(0.16, 1, 0.3, 1)
- 버튼 3개: 회원가입 (그라디언트) / 로그인 / 나중에 하기
- 접근성: ESC 닫기, 배경 클릭 닫기, aria-label

---

## 8. 모바일 구조

### 8.1 반응형 브레이크포인트

| 폼팩터 | Breakpoint | 대표 기기 |
|---|---|---|
| Desktop | 1024px+ | 모든 데스크톱 |
| Tablet Landscape | 768px ~ 1023px | iPad, Android Tablet |
| Tablet Portrait | 640px ~ 767px | iPad Mini |
| Phone Landscape | 480px ~ 639px | iPhone SE, Galaxy A |
| Phone Portrait | 320px ~ 479px | 모든 스마트폰 |
| Fold (접힘) | 280px ~ 359px | Galaxy Z Fold 커버 |
| Flip (접힘) | 320px ~ 399px | Galaxy Z Flip 커버 |

### 8.2 모바일 전용 요소

| 요소 | 설명 |
|---|---|
| Hamburger Menu | `md:hidden`, `ri-menu-line` 아이콘 |
| Mobile Menu Fullscreen | 전체 화면 오버레이, 세로 중앙 정렬 네비, 소셜 링크, ECHO 이미지 |
| Bottom Nav | 모바일 메뉴 하단 5개 소셜 링크 (Google, Instagram, LinkedIn, YouTube, Email) |
| Floating Auth Pill | 모바일/데스크톱 공통, 우측 하단 고정 CTA |
| Touch Optimized | `touch-manipulation`, 300ms 딜레이 제거, 44px 최소 터치 영역 |
| Safe Area | `env(safe-area-inset-*)` — Notch/Dynamic Island/Camera Hole 대응 |

### 8.3 모바일 섹션 조정

| 섹션 | 모바일 변경 |
|---|---|
| Hero | 텍스트 32px→17px, CTA 버튼 사이즈 축소 |
| Three Emotions | 3컬럼→1컬럼 스택 |
| SequenceOverlay Hero | 텍스트 30px→17px, 최대폭 540→480px |
| SequenceOverlay Text | 텍스트 26px→15px, 최대폭 640→540px |
| SequenceOverlay Cards | `md:grid-cols-3` → `grid-cols-1`, 이미지 높이 48→28vh, 패딩 8→5 |
| SequenceOverlay CTA | 헤드라인 40px→20px, 하단여백 40vh→20vh |
| Footer | 12컬럼 그리드 → 2컬럼(모바일) |
| FAQ | 가로 탭 → 세로 스크롤 탭 |

---

## 9. 오버레이 시스템 (7종)

| # | 오버레이 | 타입 | Z-Index | 트리거 |
|---|---|---|---|---|
| 1 | `<MissionCinematicOverlay />` | 시네마틱 (GSAP + Three.js) | 높음 | Mission 버튼 |
| 2 | `<ApproachCinematicOverlay />` | 시네마틱 (GSAP) | 높음 | Approach 버튼 |
| 3 | `<OnboardingCinematicOverlay />` | 시네마틱 (온보딩 3질문) | 높음 | Trial 버튼 |
| 4 | `<SequenceOverlay config={ABOUT} />` | 시퀀스 (6스텝) | 1000 | About 버튼 |
| 5 | `<SequenceOverlay config={AI} />` | 시퀀스 (6스텝) | 1000 | AI 버튼 |
| 6 | `<SequenceOverlay config={FOUNDER} />` | 시퀀스 (6스텝) | 1000 | Founder 버튼 |
| 7 | `<SequenceOverlay config={REPORT} />` | 시퀀스 (6스텝) | 1000 | Report 버튼 |

### 9.1 SequenceOverlay 구조 (4종 공통)

각 시퀀스는 6개 스텝으로 구성:

| 스텝 | 타입 | 내용 |
|---|---|---|
| Step 1 | `hero` | 라벨 + 헤드라인 + "↓ 스크롤" 안내 |
| Step 2 | `text` | 핵심 내러티브 텍스트 (6~10줄) |
| Step 3 | `cards` | 이미지 + 넘버 + 타이틀 + 설명 카드 (3~4장) |
| Step 4 | `text` | 보조 내러티브 또는 원칙 설명 |
| Step 5 | `text` | 한계/미래/비전 내러티브 |
| Step 6 | `cta` | 최종 CTA + "무료 시작" 버튼 |

### 9.2 SequenceOverlay 비주얼 레이어 (Z-Index)

| Layer | 설명 |
|---|---|
| Z1 | Three.js Canvas (6000개 파티클 + 연결선, AdditiveBlending) |
| Z2 | Glow Overlay (radial-gradient screen) |
| Z3 | Vignette (radial-gradient) |
| Z4 | Volumetric Light Beam (conic-gradient, 22s 회전) |
| Z5 | Glass Reflection (linear-gradient) |
| Z6 | Scanlines (repeating-linear-gradient) |
| Z7 | Noise (SVG feTurbulence) |
| Z10 | Scrollable Content (스텝 텍스트/카드) |
| Z50 | Close Button |

---

## 10. 기술 아키텍처 요약

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React 19 + TypeScript + Vite |
| 스타일링 | Tailwind CSS v3 + 커스텀 CSS 키프레임 |
| 3D | Three.js (WebGL) |
| 애니메이션 | GSAP + ScrollTrigger |
| 라우팅 | React Router DOM v7 |
| 인증 | Supabase Auth |
| 데이터베이스 | Supabase PostgreSQL (analytics_events, profiles, ai_logs) |
| AI | Supabase Edge Function → OpenAI GPT-4o-mini |
| 폼 | Readdy Form API |
| 폰트 | Google Fonts (Inter, Playfair Display, JetBrains Mono) |
| 아이콘 | Remix Icon 4.5 + Font Awesome 6.4 |

---

> **문서 승인**: 이 문서는 ECHO 프로젝트의 공식 설계 기준입니다. GitHub·Figma·Lovable·Cursor로 이관 시 본 문서를 기준으로 합니다.