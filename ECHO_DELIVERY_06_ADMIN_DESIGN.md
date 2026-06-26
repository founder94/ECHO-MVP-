# ECHO — 납품 문서 #6: 관리자(Admin) 설계서

> 버전: v1.0 FINAL LOCK
> 작성일: 2026-06-26
> 대상: ECHO by DO IT COMPANY

---

## 1. Admin 접근

| 항목 | 내용 |
|---|---|
| **URL** | `/admin` |
| **인증 방식** | 비밀번호 입력 (기본값: `0000`) |
| **인증 상태** | `useState` 로컬 (세션 없음, 새로고침 시 재인증) |
| **보안** | 비밀번호 오류 시 "접근 권한이 없습니다" 표시 |
| **UI** | 다크 테마 전용 (`bg-[#0A0A0A]`) |

---

## 2. Dashboard Overview

### 2.1 레이아웃

```
┌─────────────────────────────────────────────────┐
│ ECHO ADMIN   [알림벨] [LIVE] [날짜] [로그아웃]     │
├─────────────────────────────────────────────────┤
│ [오늘] [어제] [7일] [30일] [전체]                   │
├─────────────────────────────────────────────────┤
│ P0: Service Health Score (전체 너비)              │
├──────────────────────┬──────────────────────────┤
│ Critical Issues      │ Founder Today            │
├──────────────────────┴──────────────────────────┤
│ 탭: Overview | KPI | Funnel | 방문자 | 실시간 |    │
│      Analytics | 버튼 | 활동로그 | OpenAI |       │
│      오류 | 회원 | 모바일 | 기능 | 알림 | 배포     │
├─────────────────────────────────────────────────┤
│ [선택된 탭 콘텐츠]                                 │
└─────────────────────────────────────────────────┘
```

### 2.2 통계 카드 (5개)

| 카드 | 지표 | 색상 |
|---|---|---|
| 방문자 | `todayCount` | Gold `#F5D4A1` |
| 누적 방문자 | `totalVisitors` | Silver `#A0A0B0` |
| 현재 접속 | `activeNow` | Pink `#D4A0B8` |
| 회원가입 | `signupCount` | Gold |
| 로그인 | `loginCount` | Silver |

---

## 3. KPI Dashboard

| KPI | 설명 | 산출 방식 |
|---|---|---|
| 신규 가입 | 기간 내 `auth_signup` 이벤트 수 | `analytics_events` COUNT |
| 로그인 | 기간 내 `auth_login` 이벤트 수 | `analytics_events` COUNT |
| 전환율 | 방문자→회원가입 비율 | `signupCount / visitorCount * 100` |
| 평균 체류 시간 | 방문당 평균 세션 시간 | `analytics_events` 시간차 평균 |
| White Door | White Door 진입 수 | `analytics_events` COUNT |
| 신규 vs 재방문 | 첫 방문 vs 재방문 비율 | visitor_id 기준 구분 |
| 총 클릭 | 모든 버튼 클릭 합계 | `analytics_events` SUM |
| Google Form | 폼 제출 수 | `analytics_events` COUNT |

---

## 4. Funnel (전환 퍼널)

### 4.1 기본 Funnel (Overview)

| 단계 | 이벤트 |
|---|---|
| 방문자 | `page_view` (unique visitor_id) |
| 시작하기 | `button_click` (시작하기) |
| Auth 진입 | `/auth` 페이지 뷰 |
| 회원가입 | `auth_signup` |
| 로그인 | `auth_login` |

### 4.2 Enhanced Funnel (Funnel 탭)

AARRR 프레임워크 기반:
- **Acquisition**: 방문자
- **Activation**: 시작하기 → Auth 진입
- **Retention**: 재방문율
- **Revenue**: (Stripe 미연동, 준비 중)
- **Referral**: 유입 경로 분석

---

## 5. AI (OpenAI Dashboard)

### 5.1 OpenAIDashboard

| 항목 | 내용 |
|---|---|
| **목적** | OpenAI Edge Function 호출 실시간 모니터링 |
| **데이터 소스** | `ai_logs` 테이블 |
| **표시 정보** | 호출 수, 성공률, 평균 응답 시간, Safety Trigger 횟수 |
| **모델** | GPT-4o-mini |

### 5.2 Edge Function: echo-ai-analysis

| 항목 | 내용 |
|---|---|
| **파일** | `supabase/functions/echo-ai-analysis/index.ts` |
| **인증** | JWT verify |
| **입력** | `{ answers: string[], contactInfo: { name, email }, userId: string }` |
| **출력** | `{ report, model_used, tokens_used, response_time_ms, total_time_ms, safety_triggered, generated_at }` |
| **안전** | Safety 키워드 감지, 30초 타임아웃, 에러 로깅 |
| **로깅** | `ai_logs` 테이블 (성공/에러/안전트리거 전부 기록) |

---

## 6. Supabase

### 6.1 ServiceHealthScore (서비스 건강 점수)

7개 시스템 가중 평균 점수 (100점 만점):

| 시스템 | 가중치 | 체크 방식 | 상태 표시 |
|---|---|---|---|
| Supabase DB | 20 | `analytics_events` 쿼리 응답 시간 | <3s=100, <8s=60, fail=0 |
| 인증 시스템 | 15 | `auth.getSession()` 호출 | 성공=100, 실패=50 |
| OpenAI 분석 | 25 | Edge Function health_check 호출 | 성공=100, API키미설정=50, 실패=0 |
| 이벤트 수집 | 10 | 최근 1시간 이벤트 쿼리 | 성공=100, 실패=40 |
| 프론트엔드 | 15 | 항상 정상 (도달 가능) | 100 |
| 모바일 호환성 | 10 | 최근 7일 모바일 방문 수 | 있음=90, 없음=60 |
| 배포 상태 | 5 | 정상 가정 | 100 |

### 6.2 건강 점수 등급

| 점수 | 등급 | 색상 |
|---|---|---|
| 90~100 | Stable | Emerald `#6EE7B7` |
| 70~89 | Watch | Amber `#FBBF24` |
| 50~69 | Risk | Gold `#F5D4A1` |
| 0~49 | Critical | Danger `#F87171` |

---

## 7. Security

### 7.1 CriticalIssues (자동 감지)

6개 영역 실시간 모니터링 (60초 간격):

| 감지 영역 | 심각도 | 감지 방식 |
|---|---|---|
| OpenAI API Key 미설정 | Critical | Edge Function health_check → "API key" 포함 |
| Edge Function 응답 실패 | Critical | fetch 예외 발생 |
| Google OAuth 미설정 | Warning | 설정 상태 추론 |
| 분석 데이터 조회 실패 | Warning | `analytics_events` 쿼리 오류 |
| 결제 미연동 | Info | Stripe 연결 상태 |
| iOS Safari 접속 없음 | Info | 최근 7일 모바일 브라우저 분포 |

### 7.2 ErrorCenter

| 항목 | 내용 |
|---|---|
| **목적** | 콘솔 에러 + 네트워크 에러 중앙 집중화 |
| **실시간** | 30초 간격 스캔 |

---

## 8. Deploy (배포)

### 8.1 ReleaseDashboard

| 항목 | 내용 |
|---|---|
| **버전** | v4.0 기준 |
| **배포 히스토리** | Readdy 빌드 버전별 변경사항 |
| **롤백** | `get_history_version_code` 지원 |

### 8.2 FeatureControlPanel

| 목적 | 기능별 ON/OFF 토글 |
|---|---|
| **제어 대상** | 기능 플래그, A/B 테스트, 점진적 배포 |

---

## 9. Founder Mode

### 9.1 FounderToday

자동 생성 액션 아이템 (2분 간격 갱신):

| 카테고리 | 예시 액션 | 우선순위 |
|---|---|---|
| AI | OpenAI API Key 설정, 분석 테스트 실행 | 긴급/오늘 |
| Auth | Google OAuth Provider 확인 | 오늘 |
| Growth | 회원가입 전환율 점검, 최근 가입자 리뷰 | 오늘 |
| QA | 크로스플랫폼 모바일 QA 실행 | 오늘 |
| Deploy | 도메인 연결 확인 | 곧 |
| Payment | Stripe 결제 연동 준비 | 곧 |
| Growth | SEO 메타태그 확인 | 곧 |
| Infra | Edge Function 상태 확인 | 긴급 |

### 9.2 MobileOpsDashboard

| 기능 | 설명 |
|---|---|
| FPS Monitor | rAF 기반 실시간 FPS 측정 + 30초 히스토리 바 차트 |
| 호환성 체크 | 15개 항목 (Safe Area, Flexbox, Backdrop, WebGL, Viewport, Touch 등) |
| 크로스 브라우저 | `detectBrowser()` — Safari/Chrome/Samsung Internet/Firefox/Edge 실시간 감지 |
| 크로스 OS | `detectOS()` — iOS/Android/Desktop 구분 |
| Samsung Internet | `backdrop-filter` solid fallback 감지 |
| Firefox | `@-moz-document` 접두사 지원 확인 |
| Edge | Chromium Edge 호환성 확인 |

---

## 10. Admin 탭 완전 목록

| # | 탭 | 컴포넌트 | 데이터 소스 | 갱신 |
|---|---|---|---|---|
| 1 | Overview | Charts + Stats | `analytics_events` | 5s |
| 2 | KPI | `<KPIDashboard />` | `analytics_events` | 5s |
| 3 | Funnel | `<FunnelSection />` | `analytics_events` | 5s |
| 4 | 방문자 | Table + Mobile Cards | `analytics_events` | 5s |
| 5 | 실시간 | `<LiveVisitorPanel />` | `analytics_events` (5분) | 5s |
| 6 | Analytics | BarChart + Funnel + Pages | `analytics_events` | 5s |
| 7 | 버튼 | `<ButtonDetailPanel />` | `analytics_events` | 5s |
| 8 | 활동 로그 | Table + Activity Cards | `analytics_events` (150건) | 5s |
| 9 | OpenAI | `<OpenAIDashboard />` | `ai_logs` | 5s |
| 10 | 오류 | `<ErrorCenter />` | 에러 로그 | 30s |
| 11 | 회원 | `<UserManagement />` | `profiles` | 수동 |
| 12 | 모바일 | `<MobileOpsDashboard />` | 실시간 + `analytics_events` | 15s |
| 13 | 기능 | `<FeatureControlPanel />` | 설정 | 수동 |
| 14 | 알림 | `<NotificationCenter />` | 알림 데이터 | 5s |
| 15 | 배포 | `<ReleaseDashboard />` | 빌드 정보 | 수동 |

---

## 11. 차트 컴포넌트

| 차트 | 유형 | 구현 | 용도 |
|---|---|---|---|
| `LineChart` | SVG | `polyline` + `polygon` area fill | 방문자 추이 |
| `BarChart` | SVG | `rect` + rotated labels | 버튼 클릭 |
| `FunnelChart` | SVG | 가로 막대 + 라벨 | 전환 퍼널 |
| `DonutChart` | SVG | `path` arc segments | 디바이스 비율 |
| FPS Bar | div | `div` 높이 동적 변경 | FPS 히스토리 |

---

> **문서 승인**: 본 문서는 ECHO Admin Console의 전체 설계 명세입니다. 15개 탭, 7개 시스템 건강 점수, 6개 이슈 감지 영역, 8개 Founder 액션 카테고리가 포함되어 있습니다.