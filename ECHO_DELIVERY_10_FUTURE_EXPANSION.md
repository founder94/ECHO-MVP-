# ECHO — 납품 문서 #10: 향후 확장 문서

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY

---

## 1. 결제 (Payment)

### 1.1 Stripe 연동

| 항목 | 내용 |
|---|---|
| **현재 상태** | Stripe 미연동 (CriticalIssues에서 info로 감지) |
| **필요 작업** | Supabase Edge Function `create-stripe-checkout` 생성 |
| **결제 흐름** | 회원가입 → 온보딩 → 결제 → AI 분석 (유료 플랜) |
| **구현 방식** | `<action>connect_stripe</action>` → Stripe Checkout Session |
| **가격 모델** | 월 구독 또는 건당 결제 |

### 1.2 Toss Payments

| 항목 | 내용 |
|---|---|
| **현재 상태** | 미구현 (project_plan.md에 명시) |
| **필요 작업** | Toss Payments SDK 연동 + 서버 webhook 검증 |
| **적용 대상** | 한국 사용자 대상 로컬 결제 |

---

## 2. Plan A (프리미엄 플랜)

| 플랜 | 기능 | 가격 |
|---|---|---|
| **Free** | 기본 분석 리포트 1회, FAQ 열람 | 무료 |
| **Pro** | 무제한 AI 분석, White Door, 패턴 트래킹 | 월 $9.99 |
| **Enterprise** | 팀 분석, API 액세스, 전용 대시보드 | 협의 |

**필요 작업:**
- `subscriptions` 테이블 (Supabase)
- Stripe Subscription API 연동
- 플랜별 기능 게이트 (Feature Flag)

---

## 3. KEY (API / 개발자 생태계)

| 항목 | 내용 |
|---|---|
| **ECHO API** | REST API — 관계 데이터 분석 API 외부 제공 |
| **인증** | API Key 발급 + JWT |
| **레이트 리밋** | 플랜별 차등 |
| **문서화** | OpenAPI (Swagger) 명세 |

---

## 4. Social (소셜 기능)

| 기능 | 설명 |
|---|---|
| **관계 타임라인** | 사용자의 관계 여정을 시각화한 개인 피드 |
| **커뮤니티** | 익명 기반 관계 경험 공유 |
| **공유 카드** | 분석 결과를 소셜 미디어용 카드로 생성 |
| **DM** | ECHO 내 1:1 메시지 (관계 컨텍스트 기반) |

---

## 5. Notification (알림 시스템)

| 유형 | 채널 |
|---|---|
| **Push** | Firebase Cloud Messaging (FCM) + APNs |
| **Email** | Resend 연동 → 분석 완료, 주간 리포트 |
| **In-App** | Admin Console Notification Center 확장 |
| **SMS** | 중요 알림 (결제, 보안) |

**필요 작업:**
- `notifications` 테이블
- FCM/APNs 토큰 관리
- Resend 통합 (`<readdy-link integration="resend">Resend</readdy-link>`)

---

## 6. CMS (콘텐츠 관리)

| 항목 | 내용 |
|---|---|
| **목적** | 마케팅 페이지, FAQ, 블로그 콘텐츠를 코드 변경 없이 관리 |
| **도구** | Readdy Database + 커스텀 Admin 패널 |
| **데이터** | `content_pages` 테이블 → 마크다운 + 메타데이터 |

---

## 7. Multi Language (다국어 지원)

| 언어 | 우선순위 | 상태 |
|---|---|---|
| 한국어 (ko) | 1 | ✅ 현재 지원 |
| 영어 (en) | 2 | 번역 필요 |
| 일본어 (ja) | 3 | 번역 필요 |
| 중국어 간체 (zh-CN) | 4 | 번역 필요 |

**필요 작업:**
- `src/i18n/local/`에 언어별 네임스페이스 파일 생성
- 모든 하드코딩 텍스트를 `t('key')`로 마이그레이션
- `react-i18next` LanguageDetector 설정

---

## 8. 기술 부채 해소

### 8.1 Next.js 마이그레이션

| 항목 | 내용 |
|---|---|
| **현재** | React 19 + Vite (SPA) |
| **목표** | Next.js (App Router) + React 18 |
| **사유** | project_plan.md에 명시된 기술 스택 |
| **영향** | 라우팅, SSR/SSG, 이미지 최적화 |
| **접근** | 점진적 마이그레이션 (Readdy 검증 완료 후) |

### 8.2 FastAPI 백엔드 구축

| 항목 | 내용 |
|---|---|
| **현재** | Supabase Edge Function 기반 (단일 함수) |
| **목표** | FastAPI (Python 3.11+) + 비동기 |
| **이점** | 프로덕션 수준 API, 레이트 리밋, 복잡한 AI 파이프라인 |
| **시기** | MVP 검증 완료 후 |

### 8.3 데이터 모델 확장

| 테이블 | 목적 | project_plan 참조 |
|---|---|---|
| `users` | 사용자 프로필 통합 | ✅ |
| `relationships` | 두 유저 간 관계 상태 | ✅ |
| `sessions` | 세션 기록 | ✅ |
| `answers` | STEP1~7 응답 | ✅ |
| `reports` | 신고/차단 | ✅ |
| `payments` | 결제 기록 | ✅ |
| `white_doors` | White Door 상태 추적 | ✅ |

---

## 9. AI 고도화

### 9.1 모델 업그레이드

| 현재 | 목표 |
|---|---|
| GPT-4o-mini | GPT-4o (정확도 향상) |
| 단일 프롬프트 | 멀티턴 대화 (관계 코칭) |
| 동기 응답 | Streaming 응답 (실시간 UI) |

### 9.2 AI 기능 확장

| 기능 | 설명 |
|---|---|
| **관계 예측** | 과거 데이터 기반 미래 관계 패턴 예측 |
| **매칭 추천** | AI 기반 관계 매칭 (STEP6) |
| **감정 분석** | 텍스트 감정 톤 실시간 분석 |
| **안전 라우팅** | 위기 감지 → 전문기관 연결 (1393, 1577-0199) |

### 9.3 Readdy Agent 연결

- `<action>connect_agent</action>` → ECHO AI 어시스턴트
- 안전 키워드 감지 구현 (`project_plan.md` §추후 보완 필요 항목 참조)
- 24시간 사용자 응대

---

## 10. 보안 강화

| 항목 | 현재 | 목표 |
|---|---|---|
| 인증 | Supabase Auth | + MFA(2단계 인증) |
| 데이터 암호화 | TLS 전송 | + 저장 데이터 암호화 |
| RLS | analytics_events | 전 테이블 `user_id = auth.uid()` |
| API 보안 | JWT | + API Key rotation |
| 감사 로그 | ai_logs | + 전체 감사 트레일 |

---

## 11. 인프라 확장

| 항목 | 현재 | 목표 |
|---|---|---|
| 프론트 배포 | Readdy (Vite) | Vercel (Next.js) |
| CI/CD | Readdy 내장 | GitHub Actions |
| 분석 | analytics_events | PostHog (제품 분석) |
| 에러 추적 | ErrorCenter | Sentry |
| 모니터링 | ServiceHealthScore | Datadog / Grafana |

---

## 12. 우선순위 로드맵

| 우선순위 | 항목 | 예상 시기 | 의존성 |
|---|---|---|---|
| P0 | Stripe 결제 연동 | 즉시 | Supabase Connect |
| P0 | Google OAuth Provider 설정 | 즉시 | Supabase Dashboard |
| P1 | 다국어 지원 (영어) | 1개월 내 | i18n 마이그레이션 |
| P1 | Push 알림 | 2개월 내 | FCM + APNs |
| P2 | AI 모델 업그레이드 (GPT-4o) | 2개월 내 | OpenAI |
| P2 | FastAPI 백엔드 구축 | 3개월 내 | MVP 검증 완료 |
| P3 | Next.js 마이그레이션 | 3개월 내 | Readdy 검증 완료 |
| P3 | 커뮤니티 기능 | 6개월 내 | 회원 기반 확보 |
| P4 | API 생태계 (KEY) | 6개월 내 | 백엔드 구축 완료 |

---

> **문서 승인**: 본 문서는 ECHO의 향후 확장 방향을 정의합니다. 우선순위와 의존성을 고려하여 단계적으로 구현하십시오.