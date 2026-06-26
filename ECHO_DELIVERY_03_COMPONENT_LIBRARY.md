# ECHO — 납품 문서 #3: 컴포넌트 문서 (Component Library)

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY

---

## 1. Base Components

### 1.1 MagneticButton

| 항목 | 내용 |
|---|---|
| **파일** | `src/components/base/MagneticButton.tsx` |
| **목적** | 마그네틱 호버 효과 + 탭 스케일이 적용된 ECHO의 시그니처 CTA 버튼 |
| **Props** | `onClick?: () => void`, `variant: 'primary' \| 'secondary'`, `size: 'sm' \| 'md' \| 'lg'`, `className?: string`, `children: ReactNode` |
| **상태** | idle, hover (마그네틱 추적), active (scale 0.94), disabled |
| **사용 위치** | Hero CTA, Top Nav, SequenceOverlay CTA, MemberGateModal |
| **반응형** | `sm`(10px 폰트), `md`(14px), `lg`(17px 데스크톱) |
| **애니메이션** | `btn-tap-scale` 0.25s ease-out, `btn-sweep` 배경, `btn-ripple` 클릭, `btn-particle-burst` |

---

## 2. Feature Components

### 2.1 FPSDiveProvider

| 항목 | 내용 |
|---|---|
| **파일** | `src/components/feature/FPSDiveProvider.tsx` |
| **목적** | FPS 저하 없이 카메라 Dive 효과를 실행하는 컨텍스트 프로바이더 |
| **Props** | `children: ReactNode` |
| **제공값** | `triggerDive(callback: () => void)` |
| **사용 위치** | 홈페이지 — 섹션 간 스크롤 앵커 네비게이션 |
| **원리** | `requestAnimationFrame` 기반 FPS 측정, 30fps 이하면 dive 생략 |

### 2.2 AnalyticsProvider

| 항목 | 내용 |
|---|---|
| **파일** | `src/components/feature/AnalyticsProvider.tsx` |
| **목적** | 모든 사용자 행동 이벤트를 Supabase `analytics_events` 테이블에 자동 기록 |
| **제공값** | 이벤트 추적 컨텍스트 |
| **트래킹** | page_view, button_click, section_enter/exit, auth_signup/login/logout, google_form, white_door_enter |
| **최적화** | 로컬 큐 + debounce flush (5초 배치 전송) |

---

## 3. Home Page Components

### 3.1 Hero

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/Hero.tsx` |
| **목적** | ECHO의 시그니처 히어로 — Three.js 3D 터널 + "진짜 나를 찾아줘" |
| **Props** | `isDarkMode: boolean`, `onTrialClick?: () => void`, `musicPlaying?: boolean`, `onMusicToggle?: () => void` |
| **3D 요소** | 22개 원통형 세그먼트 (Ring Wireframe + Mosaic Panel), 무한 재활용, 플리커 효과 |
| **카메라** | PerspectiveCamera 78°, 스크롤 연동 Z축 이동, 회전, 미세 XY 오프셋 |
| **성능** | `pixelRatio ≤ 2`, `antialias: false` 옵션, `PointsMaterial` AdditiveBlending 미사용 |
| **상태** | ✅ 완성 및 잠금 (변경 불가) |
| **반응형** | Canvas 리사이즈, 전체 화면 유지 |
| **애니메이션** | GSAP 콘텐츠 fade-in 1.2s, 카메라 dive 0.3s ease-in-out |

### 3.2 Footer

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/Footer.tsx` |
| **목적** | 배경 이미지 위 ECHO 로고 + 5컬럼 내비게이션 + 법적 정보 |
| **Props** | `isDarkMode: boolean` |
| **컬럼** | Brand (ECHO + DO IT COMPANY), Navigate (7링크), Team (5항목), Contact (4항목), Legal (3항목) |
| **소셜 링크** | Instagram, LinkedIn, YouTube, Email |
| **상태** | ✅ 완성 |
| **반응형** | `grid-cols-2 md:grid-cols-12`, 모바일에서 2컬럼으로 축소 |

### 3.3 SequenceOverlay

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/SequenceOverlay.tsx` |
| **목적** | 4개 경험(About, AI, Founder, Report)의 공통 시네마틱 시퀀스 오버레이 |
| **Props** | `isOpen: boolean`, `onClose: () => void`, `onTrialClick: () => void`, `config: ExperienceConfig` |
| **ExperienceConfig** | `{ id, namespace, steps: ExperienceStep[], particleCount?, particleCountMobile? }` |
| **ExperienceStep** | `{ label, type: 'hero'\|'text'\|'cards'\|'cta', headline?, headlineLines?, cards?: ExperienceCard[], ctaText?, ctaAction?, bottomTag? }` |
| **ExperienceCard** | `{ number?, title, description, image? }` |
| **3D** | Three.js Points (6000/2000 파티클) + LineSegments 연결선, AdditiveBlending |
| **상호작용** | 마우스/터치 → 파티클 반응, 스크롤 → suction force 증가 |
| **스크롤 애니메이션** | GSAP ScrollTrigger — `seq-line`/`seq-card` 순차 표시 |
| **비주얼 레이어** | Canvas + Glow + Vignette + Volumetric Beam + Glass + Scanlines + Noise (7레이어) |
| **상태** | ✅ 완성 (4종 경험 모두) |
| **반응형** | 모바일 파티클 2000개, 텍스트/카드 패딩 축소, 닫기 버튼 safe-area-inset |
| **터치** | `touch-manipulation`, `active:scale-[0.98]`, `-webkit-overflow-scrolling: touch` |

### 3.4 MemberGateModal

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/MemberGateModal.tsx` |
| **목적** | 비로그인 사용자에게 회원가입/로그인 유도 |
| **Props** | `isOpen: boolean`, `onClose: () => void`, `isDarkMode: boolean` |
| **상태** | 열림/닫힘 |
| **버튼** | 회원가입하기 (그라디언트) → `/auth`, 로그인하기 → `/auth?mode=login`, 나중에 하기 → 닫기 |
| **애니메이션** | `modal-enter` 0.45s cubic-bezier(0.16, 1, 0.3, 1) |
| **접근성** | ESC 닫기, 배경 클릭 닫기 |
| **z-index** | 10001 |

### 3.5 FloatingAuthPill

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/FloatingAuthPill.tsx` |
| **목적** | 우측 하단 고정 플로팅 CTA 버튼 |
| **Props** | `isDarkMode: boolean`, `onActivate: () => void` |
| **동작** | 클릭 → CinematicTransitionOverlay → `/auth` |

### 3.6 CinematicMarquee

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/CinematicMarquee.tsx` |
| **목적** | 무한 스크롤 마키 텍스트 배너 |
| **Props** | `texts: string[]`, `isDarkMode: boolean`, `direction: 'forward' \| 'reverse'`, `variant: 'default' \| 'accent'` |
| **애니메이션** | CSS `marquee` / `marquee-reverse` (13.3s linear infinite) |

### 3.7 FAQ Section

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/FaqSection.tsx` |
| **목적** | 카테고리 탭 방식의 FAQ |
| **카테고리** | 일반(4문항), AI(3문항), 개인정보(3문항) |
| **Props** | `isDarkMode: boolean` |
| **상호작용** | 아코디언 — 클릭 시 해당 답변 확장/축소 |

### 3.8 기타 홈페이지 섹션 컴포넌트

| 컴포넌트 | 목적 | 상태 |
|---|---|---|
| `Section1` ~ `Section6` | Mission, About, Services, Work, Strategy, Contact | ✅ 완성 |
| `ThreeEmotionsSection` | ECHO의 세 가지 감정 가치 제안 | ✅ 완성 |
| `DataSpeaksSection` | 데이터 기반 인사이트 + AI 트리거 | ✅ 완성 |
| `CEOStatement` | CEO 메시지 + Founder Story 트리거 | ✅ 완성 |
| `FindMeSection` | Identity / "진짜 나를 찾아줘" | ✅ 완성 |
| `ElevatorSection` | 엘리베이터 피치 | ✅ 완성 |
| `ASection` | 추가 섹션 | ✅ 완성 |
| `VideoSection` | 비디오 섹션 | ✅ 완성 |
| `VideoExamples` | 비디오 예시 갤러리 | ✅ 완성 |
| `MissionImpossibleSection` | "불가능한 미션" 섹션 | ✅ 완성 |
| `PatternEngineSection` | 패턴 엔진 시각화 | ✅ 완성 |
| `MusicWaveform` | 히어로 하단 음파 애니메이션 | ✅ 완성 |
| `PuzzleTextReveal` | 텍스트 퍼즐 리빌 효과 | ✅ 완성 |

---

## 4. Overlay Components

### 4.1 MissionCinematicOverlay

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/MissionCinematicOverlay.tsx` |
| **목적** | ECHO Mission을 시네마틱하게 표현하는 풀스크린 오버레이 |
| **Props** | `isOpen`, `onClose`, `onTrialClick` |
| **애니메이션** | GSAP + Three.js 파티클 (AdditiveBlending) |
| **비주얼** | Mission Impossible 테마 — suction particle, speed streak, scanline |

### 4.2 ApproachCinematicOverlay

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/ApproachCinematicOverlay.tsx` |
| **목적** | ECHO Approach를 시네마틱하게 표현 |
| **Props** | `isOpen`, `onClose`, `onTrialClick` |
| **애니메이션** | GSAP + 접근 방식 흐름도 + 파티클 |

### 4.3 OnboardingCinematicOverlay

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/OnboardingCinematicOverlay.tsx` |
| **목적** | 3단계 온보딩 질문 (localStorage에 답변 저장) |
| **Props** | `isOpen`, `onClose`, `onTrialClick` |
| **흐름** | 질문1 → 답변 → 질문2 → 답변 → 질문3 → 답변 → "무료 체험 신청" |
| **데이터 저장** | `localStorage.setItem('echo_onboarding_answers', JSON.stringify(answers))` |

### 4.4 CinematicTransitionOverlay

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/CinematicTransitionOverlay.tsx` |
| **목적** | 페이지 전환 시 워프 효과 |
| **Props** | `isActive`, `onTransitionComplete` |
| **동작** | active → 애니메이션 → onTransitionComplete → navigate('/auth') |

### 4.5 TrialFormModal

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/components/TrialFormModal.tsx` |
| **목적** | 무료 체험 신청 폼 (Readdy Form 연결) |
| **Props** | `isOpen`, `onClose`, `isDarkMode` |
| **필드** | 이름, 이메일, 연락처 + anti-spam honeypot |

---

## 5. Auth Page Components

### 5.1 AuthCanvas

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/auth/components/AuthCanvas.tsx` |
| **목적** | Three.js 배경 — 6단계 Phase에 따른 시각 변화 |
| **Props** | `phase: CanvasPhase`, `mousePos: { x, y }` |
| **CanvasPhase** | `'entry' \| 'portal_forming' \| 'portal_active' \| 'selection' \| 'form' \| 'converge' \| 'mirror'` |
| **비주얼** | 파티클 시스템, 마우스 인터랙션, Phase별 density/color 변화 |

### 5.2 TermsAgreement

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/auth/components/TermsAgreement.tsx` |
| **목적** | 회원가입 6종 약관 동의 체크박스 |
| **약관** | 서비스 이용약관, 개인정보 처리방침, 민감정보 수집·이용, 익명화 데이터 활용, 만 14세 이상, 의료·상담 서비스 아님 |
| **Props** | 각 약관별 `agreed` 상태 + `onChange` 핸들러 + `highlightErrors` |

---

## 6. Report Page

### 6.1 ReportPage

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/report/page.tsx` |
| **목적** | AI 분석 리포트 표시 + White Door 인터랙션 |
| **상태** | `loading → generating → done / error` |
| **데이터 소스** | localStorage(`echo_onboarding_answers`) → 우선, profiles 테이블 → 폴백 |
| **API** | Supabase Edge Function `echo-ai-analysis` (POST) |
| **UI** | 로딩 스피너 → 생성 중 펄스 → 마크다운 섹션 GSAP 순차 표시 → White Door |
| **White Door** | 닫힘(글로우 빔 + 핸들) → "열어보기" → 열림(빛 방사 + 최종 메시지) |
| **접근성** | White Door에 `role="button"`, `tabIndex={0}`, `onKeyDown` 지원 |
| **에러 처리** | 오류 메시지 + "다시 시도하기" + "홈으로 돌아가기" |
| **법적 고지** | "의료·심리치료·상담·법률 서비스 아님" 면책 문구 |

---

## 7. Admin Components (15개 탭)

### 7.1 AdminPage

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/admin/page.tsx` |
| **목적** | 관리자 콘솔 — 비밀번호 인증(0000) 후 15탭 분석 대시보드 |
| **탭 목록** | Overview, KPI, Funnel, 방문자, 실시간, Analytics, 버튼, 활동로그, OpenAI, 오류, 회원, 모바일, 기능, 알림, 배포 |
| **자동 갱신** | 5초 인터벌 + visibility change 시 즉시 갱신 |
| **데이터** | Supabase `analytics_events` 테이블 기반 실시간 집계 |
| **차트** | SVG 인라인 — LineChart, BarChart, FunnelChart, DonutChart |
| **반응형** | 데스크톱 테이블 + 모바일 카드 병행 |

### 7.2 Admin Sub-Components

| 컴포넌트 | 파일 | 목적 |
|---|---|---|
| `KPIDashboard` | `src/pages/admin/components/KPIDashboard.tsx` | 회원가입/로그인/전환율/평균체류/WhiteDoor KPI |
| `FunnelSection` | `src/pages/admin/components/FunnelSection.tsx` | Enhanced 전환 퍼널 (AARRR) |
| `LiveVisitorPanel` | `src/pages/admin/components/LiveVisitorPanel.tsx` | 실시간 접속자 패널 |
| `ButtonDetailPanel` | `src/pages/admin/components/ButtonDetailPanel.tsx` | 버튼 클릭률 상세 분석 |
| `ServiceHealthScore` | `src/pages/admin/components/ServiceHealthScore.tsx` | 7개 시스템 실시간 건강 점수 (가중치 평균) |
| `CriticalIssues` | `src/pages/admin/components/CriticalIssues.tsx` | 자동 감지 이슈 (OpenAI, Auth, Analytics, Payment, Mobile) |
| `FounderToday` | `src/pages/admin/components/FounderToday.tsx` | 창업자용 액션 아이템 (긴급/오늘/곧) |
| `ErrorCenter` | `src/pages/admin/components/ErrorCenter.tsx` | 에러 로그 센터 |
| `OpenAIDashboard` | `src/pages/admin/components/OpenAIDashboard.tsx` | OpenAI 호출 실시간 모니터링 |
| `UserManagement` | `src/pages/admin/components/UserManagement.tsx` | 회원 관리 |
| `MobileOpsDashboard` | `src/pages/admin/components/MobileOpsDashboard.tsx` | 모바일 크로스플랫폼 호환성 + FPS 모니터 |
| `FeatureControlPanel` | `src/pages/admin/components/FeatureControlPanel.tsx` | 기능 ON/OFF 토글 패널 |
| `NotificationCenter` | `src/pages/admin/components/NotificationCenter.tsx` | 실시간 알림 센터 |
| `NotificationBell` | `src/pages/admin/components/NotificationBell.tsx` | 알림 벨 (읽지 않은 개수 뱃지) |
| `ReleaseDashboard` | `src/pages/admin/components/ReleaseDashboard.tsx` | 배포/릴리스 대시보드 |
| `ComingSoonPanel` | `src/pages/admin/components/ComingSoonPanel.tsx` | 준비 중 기능 표시 패널 |
| `EventLog` | `src/pages/admin/components/EventLog.tsx` | 이벤트 로그 |
| `FormTable` | `src/pages/admin/components/FormTable.tsx` | Readdy Form 제출 데이터 |

---

## 8. Utility Components

### 8.1 MagneticButton

| 항목 | 내용 |
|---|---|
| **Props** | `onClick`, `variant`(`'primary'`\|`'secondary'`), `size`(`'sm'`\|`'md'`\|`'lg'`), `className`, `children` |
| **variant: primary** | 그라디언트 배경(`#FF6B9D→#9B59B6`), 흰색 텍스트, 글로우 박스섀도우 |
| **variant: secondary** | 투명 배경, 화이트/블랙 보더, 호버 시 채우기 |
| **마그네틱 효과** | 마우스 위치에 따라 버튼이 미세하게 이동 (CSS transform) |
| **탭 피드백** | `active:scale-[0.98]` |

---

## 9. Data Configurations

### 9.1 Experiences Data

| 파일 | 내용 |
|---|---|
| `src/pages/home/data/experiences.ts` | `ABOUT_EXPERIENCE`, `AI_EXPERIENCE`, `FOUNDER_EXPERIENCE`, `REPORT_EXPERIENCE`, `FAQ_CATEGORIES` |

### 9.2 Portfolio Data

| 파일 | 내용 |
|---|---|
| `src/pages/portfolio/data.ts` | 포트폴리오 프로젝트 데이터 |

---

## 10. Hooks

### 10.1 useAuth

| 항목 | 내용 |
|---|---|
| **파일** | `src/hooks/useAuth.ts` |
| **목적** | Supabase Auth 상태 관리 + 로그인/회원가입/소셜로그인 함수 |
| **제공값** | `isAuthenticated`, `currentUser`, `loading`, `signup()`, `login()`, `socialLogin()`, `logout()` |

### 10.2 useAnalytics

| 항목 | 내용 |
|---|---|
| **파일** | `src/hooks/useAnalytics.ts` |
| **목적** | analytics_events 테이블 조회를 위한 20+ 쿼리 함수 |
| **주요 함수** | `getTodayVisitCount`, `getConversionFunnel`, `getButtonClickStats`, `getVisitorTrend`, `getActiveNowCount` 등 |
| **반환 타입** | `ClickStat`, `PageStat`, `ActivityLogEntry`, `ConversionFunnel`, `DeviceRatio`, `VisitorProfile`, `LiveVisitor` 등 |

### 10.3 useVisitorTracker

| 항목 | 내용 |
|---|---|
| **파일** | `src/hooks/useVisitorTracker.ts` |
| **목적** | 방문자 식별 및 추적 (fingerprint + localStorage) |

### 10.4 useMusicPlayer

| 항목 | 내용 |
|---|---|
| **파일** | `src/pages/home/hooks/useMusicPlayer.ts` |
| **목적** | YouTube 오디오 플레이어 상태 관리 |

---

> **문서 승인**: 본 컴포넌트 라이브러리는 ECHO의 모든 UI 구성요소의 공식 명세입니다. Props, 상태, 사용 위치, 반응형 규칙, 애니메이션 규칙이 모두 포함되어 있습니다.