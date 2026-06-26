# 🌐 크로스 플랫폼 품질 기준 — ECHO v1.0 (2026-06-26 확정)

> ECHO는 특정 운영체제나 기기를 기준으로 설계하지 않는다. iOS와 Android 모두 동일한 우선순위로 지원한다.

---

## 지원 대상

### iOS
- iPhone SE (1st/2nd/3rd Gen)
- iPhone Mini (12/13)
- iPhone 기본 모델 (12/13/14/15/16)
- iPhone Plus (14/15/16)
- iPhone Pro (12/13/14/15/16)
- iPhone Pro Max (12/13/14/15/16)
- iPad / iPad Air / iPad Pro (all generations)
- Safari · Chrome

### Android
- Samsung Galaxy S Series (S21~S25)
- Samsung Galaxy Z Fold (3/4/5/6)
- Samsung Galaxy Z Flip (3/4/5/6)
- Samsung Galaxy A Series (A34/A54/A55)
- Google Pixel (6/7/8/9)
- 기타 Android 표준 기기
- Samsung Internet · Chrome · Firefox · Edge

---

## 반응형 기준

| 폼팩터 | Breakpoint | 대표 기기 |
|---|---|---|
| Desktop | 1024px+ | 모든 데스크톱 브라우저 |
| Tablet Landscape | 768px ~ 1023px | iPad, Android Tablet |
| Tablet Portrait | 768px | iPad Mini, Galaxy Tab |
| Phone Landscape | 640px ~ 767px | iPhone SE, Galaxy A |
| Phone Portrait | 320px ~ 639px | 모든 스마트폰 |
| Fold (접힘) | 280px ~ 359px | Galaxy Z Fold 커버 디스플레이 |
| Flip (접힘) | 320px ~ 399px | Galaxy Z Flip 커버 디스플레이 |

---

## Safe Area 대응

- 모든 fixed 요소는 `env(safe-area-inset-*)`를 사용해 Notch / Dynamic Island / Android Camera Hole 영역을 회피
- `viewport-fit=cover` 적용으로 전체 화면 활용
- iOS Home Indicator · Android Navigation Bar · 삼성 One UI Navigation Bar 영역 확보

---

## 브라우저 호환성

### Desktop
- Chrome (latest 2 versions)
- Edge (latest 2 versions)
- Safari (latest 2 versions)
- Firefox (latest 2 versions)

### Mobile
- iOS Safari (iOS 15+)
- iOS Chrome (latest)
- Android Chrome (latest 2 versions)
- Samsung Internet (latest 2 versions)
- Android Firefox (latest)
- Android Edge (latest)

---

## 성능 기준 (전 플랫폼)

- ✅ 60FPS (rAF 기반 FPS 측정)
- ✅ Console Error 0
- ✅ Build Success
- ✅ Layout Shift 없음 (CLS < 0.1)
- ✅ Text Overflow 없음
- ✅ Button 잘림 없음 (최소 터치 영역 44px iOS / 48dp Android)
- ✅ 입력창 가림 없음 (Visual Viewport API)
- ✅ 가로 스크롤 없음
- ✅ Animation 깨짐 없음

---

## 모바일 QA 체크리스트

각 화면마다 아래 항목을 확인:

| 항목 | iOS | Android |
|---|---|---|
| Safe Area | ✅ env() 변수 | ✅ env() 변수 |
| Notch / Dynamic Island | ✅ safe-inset-top | — |
| Camera Hole | — | ✅ safe-inset-top |
| Gesture Navigation | ✅ | ✅ |
| 삼성 Navigation Bar | — | ✅ safe-inset-bottom |
| iOS Home Indicator | ✅ safe-inset-bottom | — |
| 삼성 One UI | — | ✅ 대응 |
| 화면 회전 | ✅ Orientation API | ✅ Orientation API |
| 키보드 입력 | ✅ Visual Viewport | ✅ Visual Viewport |
| 버튼 터치 | ✅ 44px min | ✅ 48dp min |
| 스크롤 | ✅ smooth | ✅ smooth |
| Modal / Overlay | ✅ fixed position | ✅ fixed position |
| Bottom Sheet | — | — |
| Dialog | ✅ | ✅ |

---

## 구현 상태

| 항목 | 상태 | 비고 |
|---|---|---|
| viewport-fit=cover | ✅ 적용 | index.html |
| safe-area-inset CSS 변수 | ✅ 적용 | src/index.css |
| Fixed 요소 Safe Area | ✅ 적용 | SequenceOverlay 닫기 버튼 |
| 삼성 Internet 대응 | ✅ 적용 | backdrop-filter fallback |
| Firefox -moz- prefix | ✅ 적용 | @-moz-document |
| iOS/Android Input Zoom 방지 | ✅ 적용 | font 16px+ 기준 |
| 가로 스크롤 방지 | ✅ 적용 | body overflow-x: hidden |
| 44px 최소 터치 영역 | ✅ 적용 | 모든 버튼 |
| 크로스브라우저 QA 대시보드 | ✅ 적용 | MobileOpsDashboard |
| 크로스플랫폼 이슈 감지 | ✅ 적용 | CriticalIssues |
| Founder Today QA 항목 | ✅ 적용 | 크로스플랫폼 모바일 QA |

---

# 🔒 ECHO READDY AI HOMEPAGE MASTER FINAL LOCK v1.0 — 반영 완료 (2026-06-26)

---

# ECHO Project Plan

## Project Overview
ECHO — AI를 통해 사람의 관계 데이터를 자산으로 만드는 회사.

> "잃어버린 나의 정체성을 다시 찾아가는 여정"

---

# ✅ 확정된 MVP 기술 스택 — 7개 레이어

> 세계급 팀이 그대로 빌드 들어갈 수 있는 기준. 2026-06-25 확정.

---

## 1. 프론트엔드

| 항목 | 선택 |
|---|---|
| 프레임워크 | React 19 + Vite (Readdy SPA) |
| 언어 | TypeScript (strict 모드) |
| 스타일링 | Tailwind CSS |
| 서버 상태 | TanStack Query |
| 폼·검증 | React Hook Form + Zod |
| 폰트 | Noto Serif KR · Noto Sans KR |
| 컬러 | 다크 전용 (#1C1E22, CTA #4F98A3) |

---

## 2. 백엔드 · API

| 항목 | 선택 |
|---|---|
| 플랫폼 | Supabase Edge Functions (Deno + TypeScript) |
| AI 분석 | echo-ai-analysis Edge Function |
| API 스타일 | REST (Edge Function HTTP endpoints + JWT) |

---

## 3. 데이터베이스 · 데이터 모델

| 항목 | 선택 |
|---|---|
| DBMS | PostgreSQL (Supabase 호스팅) |
| 테이블 | profiles · analytics_events · ai_logs · product_* · order_* |
| 추가 | 이벤트 로그 테이블 (분석 + YUT-KEY 원천 데이터) |

---

## 4. 인증 · 보안 (RLS)

| 항목 | 선택 |
|---|---|
| 인증 | Supabase Auth (이메일/Google OAuth) + JWT 세션 + PKCE |
| 데이터 보호 | Row Level Security: 전 테이블 auth.uid() 기준 |
| 전송 | TLS/HTTPS |
| 시크릿 | Supabase Secrets + Deno.env.get() (Edge Function) |
| 민감정보 | 감정 데이터 = 민감정보 → 암호화·접근 최소화 |
| Admin 보안 | Supabase Auth + Role('admin') + RLS 기반 접근 제어 |

---

## 5. 결제

| 항목 | 선택 |
|---|---|
| PG | Stripe (9,900원 결제) |
| 구현 | Stripe Checkout Session + Supabase Edge Function |
| 게이트 | STEP2 → STEP3 결제 |

---

## 6. AI 엔진 (LLM)

| 항목 | 선택 |
|---|---|
| 모델 | OpenAI API (GPT-4o-mini) |
| 방식 | 프롬프트·플로우 (트레이닝된 ML 아님) |
| 안전장치 | Safety Detection (14개 키워드 한/영) + 안전 안내 자동 전환 |
| 호출 | Supabase Edge Function 서버측 호출 (키 노출 금지) |
| 로깅 | ai_logs 테이블 (success/error/safety_triggered) |

---

## 7. 인프라 · 배포 · 관측

| 항목 | 선택 |
|---|---|
| 프론트 배포 | Readdy (자동 HTTPS + 도메인 + 즉시 배포) |
| 백엔드 배포 | Supabase Edge Functions |
| CI/CD | Readdy 자동 빌드 + 즉시 배포 |
| 분석 | Admin Analytics (Supabase 기반) + Google Analytics (연동 가능) |
| 에러 추적 | Admin ErrorCenter + Edge Function 로깅 |

---

## 확정 완료 — 추가 선택지 없음

모든 기술 선택은 구현 완료되었으며 추가 확정이 필요한 선택지는 없습니다.

---

## 잠긴 코어 (변경 불가)

React 19 · Vite · TypeScript · Tailwind / Supabase · PostgreSQL · Edge Functions / Readdy · OpenAI · Stripe

## 동반 라이브러리 (세계 표준 기본값)

TanStack Query · React Hook Form · Zod — 이 스택의 세계 표준 기본값

---

# 왜 이 스택인가 (Supabase + Edge Functions + Readdy 전환 근거)

1. **Supabase가 인증·DB·RLS·Edge Function을 한 번에**: 이전 스택은 PostgreSQL + Redis 따로, 인증 직접 구현. Supabase는 Auth + JWT + RLS + Edge Functions + 실시간 내장. MVP에서 인증 시스템 직접 구축하는 건 시간 낭비.

2. **Edge Function으로 AI 연동**: ECHO의 핵심은 OpenAI API. Supabase Edge Function(Deno/TypeScript)에서 안전하게 API 키 관리 + Safety Detection + 로깅까지 한 번에 구현.

3. **단일 언어로 충분**: TypeScript 하나로 프론트(React) + 백엔드(Edge Function) + DB 접근까지 단일 생태계로 커버.

4. **Readdy가 배포를 자동화**: 커스텀 도메인, HTTPS, 빌드, 배포까지 Readdy가 처리. Vercel + AWS 조합보다 운영 부담이 훨씬 낮음.

---

# MVP 범위

## 반드시 포함할 기능
- 회원가입/로그인 (이메일, 소셜) — Supabase Auth
- 프로필 관리
- 온보딩 (관계 목적, 상태 입력) — STEP1~2
- AI 성향 분석 — STEP3~5
- 매칭 후보 생성 및 추천 — STEP6
- 결제 게이트 — STEP2 → STEP3 (Stripe 9,900원)
- 관계 상태 관리 (수락/거절/종료)
- 채팅 (실시간 메시지)
- 미션/보상 시스템
- 피드/스토리
- 신고/차단
- 푸시 알림
- 관리자 대시보드

## MVP 이후로 미뤄도 되는 기능
- 실시간 위치 기반 매칭
- 채팅 분석/번역
- Kafka 도입
- Go WebSocket 분리 (트래픽 증가 시)
- AI Worker 분리

---

# 데이터 모델 (실제 운영 중)

| 테이블 | 설명 |
|---|---|
| profiles | 사용자 기본 정보, 프로필, 온보딩 데이터, role |
| analytics_events | 모든 사용자 이벤트 (page_view, button_click, auth 등) |
| ai_logs | AI 분석 로그 (success/error/safety_triggered) |
| product_* | 상품/주문 관리 (Shop 기능 연동) |
| order_* | 주문 헤더/아이템 (Stripe 연동) |

---

# 개발 단계 (Production 진행 중)

### Phase 1~4. ✅ 완료
프로젝트 기반 구축, Supabase Auth, AI Analysis (Edge Function), Admin Dashboard

### Phase 5. ⏳ Stripe 결제 연동 (현재 단계)
Stripe Checkout Session + Supabase Edge Function + 주문 저장

### Phase 6~9. 📋 MVP 이후
채팅, 미션/보상, 피드/스토리, 신고/차단 등

---

# ⚠️ Production Architecture (확정)

현재 프론트엔드는 Readdy(React 19 + Vite)에서 운영 중.
백엔드는 Supabase(Auth + Database + Edge Functions)로 통합.
→ Readdy + Supabase 조합이 최종 Production 아키텍처로 확정되었습니다.
→ Next.js 마이그레이션은 예정되어 있지 않으며, Readdy SPA가 Canonical입니다.

---

# ⚠️ 추후 보완 필요 항목

> 현재 작업에서는 기존 구조를 절대 변경하지 않는다.
> 아래 항목은 지금 당장 완성 기능으로 강제 구현하지 말고, 추후 Supabase 및 Readdy Agent 연결 단계에서 반드시 구현할 보완 항목으로 명시한다.

---

## 1. Readdy Agent 연결 시 안전 키워드 감지 구현 필요

추후 AI Agent 또는 OpenAI API 연결 시 아래 위험 신호를 반드시 감지한다.

**감지 대상:**
- 자해
- 죽고 싶다
- 극단적 선택
- 폭력
- 협박
- 스토킹
- 성폭력
- 불법촬영
- 감금
- 강요
- 범죄 피해
- 보복
- 위협

**감지 시 동작:** 일반 AI 응답을 중단하고 안전 안내 화면을 우선 표시한다.

**안전 안내 문구:**
> 지금은 자기이해보다 안전이 우선입니다.
> 현재 상황이 위급하거나 위험하다고 느껴진다면 즉시 112, 119 또는 전문기관에 도움을 요청해 주세요.
> 혼자 판단하지 말고 가까운 사람, 전문기관, 공공기관에 도움을 요청해 주세요.
> ECHO는 위급 상황을 직접 해결하는 서비스가 아닙니다.

---

## 2. Supabase 연결 시 소셜 로그인 연동 필요

추후 Supabase Auth 연결 단계에서 아래 소셜 로그인을 연동한다.

| 소셜 로그인 | 상태 |
|---|---|
| Google 로그인 | ✅ 코드 완료 / Provider 활성화 대기 |
| Apple 로그인 | 🟡 버튼 UI 표시 완료 / 설정 준비 중 |
| 카카오 로그인 | 🟡 버튼 UI 표시 완료 / 설정 준비 중 |

현재 화면에는 버튼 UI만 먼저 표시되어 있다.
실제 인증 기능은 Supabase 연결 단계에서 구현한다.

---

## 3. 현재 단계 처리 기준

현재 Readdy 작업에서는 아래까지 구현 완료:

- [x] 로그인 / 회원가입 (Supabase Auth)
- [x] Google OAuth (코드 완료, Provider 활성화 필요)
- [x] 약관 체크박스 표시
- [x] 법적 고지 표시
- [x] 소셜 로그인 버튼 UI 표시
- [x] 안전 고지 문구 표시
- [x] AI 분석 (Edge Function + Safety Detection)
- [x] Admin Dashboard (Supabase Auth + Role 기반)

진행 중:

- [ ] Stripe 결제 연동
- [ ] Google Analytics 연결
- [ ] Search Console 등록

---

## 4. 절대 조건

이 보완 항목을 추가하면서 기존 홈페이지 구조를 변경하지 않는다.

**변경 금지 구조:**
- Hero
- Mission
- Our Approach
- White Door
- FAQ
- Footer
- Admin (Supabase Auth + Role 기반 보안 적용 완료)

현재 작업은 구조 변경이 아니라 추후 구현 기준을 명확히 남기는 작업이다.

---

## 5. Admin Analytics Dashboard (2026-06-25 완료)

Supabase 기반 실시간 행동 분석 대시보드로 고도화 완료.

**데이터 인프라**
- `analytics_events` 테이블 (Supabase): 모든 사용자 이벤트 저장
- 로컬 큐 + debounce flush 방식으로 프론트 성능에 영향 없음
- RLS 정책: anon/authenticated INSERT + SELECT 허용

**트래킹 이벤트**
- page_view: 페이지 방문
- button_click: 버튼 클릭 (시작하기, 회원가입, 로그인 등)
- section_enter / section_exit: 섹션 진입/이탈 + 체류 시간
- auth_signup / auth_login / auth_logout: 인증 이벤트
- google_form: Google Form 이동
- white_door_enter: White Door 진입

**어드민 대시보드 기능**
- 기간 필터 (오늘/어제/7일/30일/전체)
- 실시간 접속자 수 (최근 5분)
- 방문자 추이 라인 차트 (SVG)
- 전환 퍼널 차트 (방문자 → 시작하기 → Auth → 회원가입 → 로그인)
- 버튼 클릭 바 차트 (SVG)
- 디바이스 비율 도넛 차트 (SVG)
- 유입 경로 분석
- 섹션 체류 시간 분석
- 방문자 프로필 (디바이스/브라우저/OS)
- 고도화된 활동 로그 (시간/방문자/활동/페이지/디바이스/브라우저/유입경로)
- 자동 새로고침 5초

**수정 파일**
- `supabase`: analytics_events 테이블 생성 + RLS
- `src/hooks/useAnalytics.ts`: Supabase 기반 전면 재작성
- `src/components/feature/AnalyticsProvider.tsx`: 섹션 추적 + 이벤트 위임
- `src/pages/admin/page.tsx`: 분석 대시보드로 고도화
- `src/hooks/useAuth.ts`: 인증 이벤트 analytics 연결

---

# 참고: 이전 백엔드 검토안 (Spring Boot + Go — 아카이브)

> 2026-06-25 이전 검토되었던 Spring Boot + Go + Redis 기반 아키텍처.
> MVP 스택이 FastAPI + Supabase로 확정되면서 아카이브 처리.
> 원본 Notion: https://equable-pleasure-2cb.notion.site/1-MVP-3670d989af9580a98dfdf87429d5ef06

<details>
<summary>펼쳐서 보기</summary>

### 백엔드 기술 선택 (이전)
- Core API: Java / Spring Boot
- Realtime Chat: Go
- AI Worker: Python (FastAPI)
- PostgreSQL + Redis
- AWS: ECS Fargate

### 왜 분리 구조였나
- Core API: 도메인 규칙, 트랜잭션, 데이터 정합성 → Spring Boot
- Chat: 동시성, WebSocket → Go
- AI: 분석·추천 → Python

### Phase 계획 (이전)
1. 프로젝트 기반 구축 (Spring Boot + PostgreSQL)
2. Auth / User / Profile / Onboarding
3. AI Analysis
4. Matching / Relationship
5. Go Chat Service
6. Mission / Reward
7. Feed / Story
8. Block / Report / Safety
9. MVP Stabilization

</details>