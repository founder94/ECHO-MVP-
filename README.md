# ECHO MVP — Production Project

ECHO는 AI를 통해 사람의 관계 데이터를 자산으로 만드는 기업입니다.  
"진짜 나를 찾아줘" — 나를 다시 만나는 모든 순간을 위해.

## 기술 스택

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite (SPA) |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 3.4 |
| Animation | GSAP 3.12 + Three.js 0.179 |
| Backend | Supabase (Auth / Database / Edge Functions) |
| AI | OpenAI GPT-4o-mini (Edge Function 기반) |
| Payment | Stripe / Toss Payments |
| Router | React Router v7 |
| i18n | i18next 25 |

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 Supabase 및 API 키를 입력하세요

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000

# 4. Production 빌드
npm run build
npm run preview
```

## 환경 변수 (.env)

| 변수 | 설명 | 필수 |
|---|---|---|
| `VITE_PUBLIC_SUPABASE_URL` | Supabase Project URL | ✅ |
| `VITE_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon/Public Key | ✅ |
| `VITE_PUBLIC_SITE_URL` | Production 사이트 URL | 권장 |
| `OPENAI_API_KEY` | OpenAI API Key (Supabase Secret) | ✅ (AI 기능) |
| `STRIPE_SECRET_KEY` | Stripe Secret Key (Supabase Secret) | ✅ (결제) |
| `TOSS_PAYMENTS_SECRET_KEY` | Toss Payments Secret Key | 선택 |

> ⚠️ Secret Key는 절대 `.env`에 직접 작성하지 말고 Supabase Secrets에 저장하세요. Edge Function 내에서 `Deno.env.get()`으로 접근합니다.

## 프로젝트 구조

```
ECHO_MVP_PRODUCTION/
├── index.html                    # HTML 엔트리 포인트
├── package.json
├── vite.config.ts                # Vite 설정 + 경로 alias (@/)
├── tailwind.config.ts            # Tailwind 설정
├── tsconfig.json
├── tsconfig.app.json
├── postcss.config.ts
├── eslint.config.ts
├── .env.example                  # 환경 변수 템플릿
├── public/                       # 정적 파일
├── supabase/
│   ├── functions/                # Supabase Edge Functions
│   │   ├── create-echo-checkout/ # Stripe 결제 세션 생성
│   │   ├── confirm-echo-toss-payment/ # Toss 결제 승인
│   │   └── echo-ai-analysis/     # OpenAI AI 분석
│   └── schema.sql                # 데이터베이스 스키마 레퍼런스
└── src/
    ├── main.tsx                  # 앱 엔트리
    ├── App.tsx                   # Root 컴포넌트 + Router
    ├── index.css                 # 글로벌 스타일 + 애니메이션
    ├── lib/
    │   └── supabase.ts           # Supabase 클라이언트 (싱글톤)
    ├── router/
    │   ├── index.ts              # BrowserRouter + AppRoutes
    │   └── config.tsx            # 라우트 설정
    ├── components/
    │   ├── base/                 # 공통 컴포넌트
    │   │   └── MagneticButton.tsx
    │   └── feature/              # 기능 컴포넌트
    │       ├── AnalyticsProvider.tsx
    │       ├── FPSDiveProvider.tsx
    │       └── FPSOverlay.tsx
    ├── hooks/
    │   ├── useAuth.ts            # 인증 상태 관리
    │   ├── useAnalytics.ts       # 분석 이벤트 추적
    │   └── useVisitorTracker.ts  # 방문자 추적
    ├── i18n/                     # 다국어
    │   └── local/
    └── pages/
        ├── home/                 # 메인 랜딩 페이지
        │   ├── page.tsx
        │   ├── hooks/
        │   ├── data/
        │   └── components/       # 30+ 섹션 컴포넌트
        ├── auth/                 # 회원가입/로그인
        ├── admin/                # 관리자 대시보드
        ├── about/                # About 페이지
        ├── portfolio/            # 포트폴리오
        ├── report/               # AI 분석 리포트
        └── thank-you/            # 결제 완료 페이지
```

## 주요 페이지 (Routes)

| Path | 페이지 | 설명 |
|---|---|---|
| `/` | Home | 메인 랜딩 (Hero + 20+ 섹션) |
| `/auth` | Auth | 회원가입 / 로그인 |
| `/about` | About | ECHO 소개 |
| `/portfolio` | Portfolio | 포트폴리오 |
| `/report` | Report | AI 분석 리포트 |
| `/admin` | Admin | 관리자 대시보드 |
| `/thank-you` | Thank You | 결제 완료 |

## Supabase 연결

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. Project Settings → API에서 `URL`과 `anon/public key` 복사
3. `.env` 파일에 입력:
   ```
   VITE_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Supabase CLI로 Edge Functions 배포:
   ```bash
   npx supabase functions deploy create-echo-checkout
   npx supabase functions deploy echo-ai-analysis
   ```
5. Supabase Secrets 설정:
   ```bash
   npx supabase secrets set OPENAI_API_KEY=sk-...
   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   ```

## 인증 (Authentication)

- Supabase Auth 기반
- 이메일 회원가입 / 로그인
- 이메일 인증 (Magic Link)
- Google OAuth 소셜 로그인
- 세션 유지 (Supabase onAuthStateChange)
- `MemberGateModal` → 비로그인 접근 차단
- `PaymentGateModal` → 미결제 접근 차단

## AI 분석 플로우

```
Landing → 회원가입 → 온보딩 → AI Analysis → Report → White Door
```

- OpenAI GPT-4o-mini 기반
- Edge Function에서 호출 (API Key 서버 보관)
- Safety Detection 내장
- `ai_logs` 테이블에 토큰/비용/응답시간 기록

## 결제 (Payment)

- **Stripe Checkout**: `create-echo-checkout` Edge Function
- **Toss Payments**: `create-echo-toss-checkout` / `confirm-echo-toss-payment`
- 9,900원 MVP 가격
- `PaymentGateModal` → 결제 완료 전 AI Report 차단
- 주문 정보: `order_headers` + `order_items` 테이블
- 결제 상태: `pending_payment` → `paid` (Webhook 연동)

## 관리자 (Admin Dashboard)

`/admin` 페이지에서 확인 가능:

- KPI Dashboard (방문자, 가입, 결제 전환율)
- Live Visitor Panel
- User Management
- AI Logs (OpenAI 사용량/비용)
- Error Center
- Notification System
- Release Dashboard
- Feature Control Panel
- Mobile Ops Dashboard
- Founder Dashboard

## 데이터베이스 스키마

전체 스키마는 `supabase/schema.sql` 파일을 참조하세요.

주요 테이블:
- `profiles` — 사용자 프로필
- `ai_logs` — AI 분석 로그
- `analytics_events` — 방문자 분석 이벤트
- `order_headers` / `order_items` — 주문 정보
- `product_*` — 상품 관리 (카테고리, 아이템, SKU, 커스텀 필드)

## Production 배포

### Netlify
```bash
npm run build
# dist/ 폴더를 Netlify에 드래그 앤 드롭
```

### Vercel
```bash
npm install -g vercel
vercel --prod
```

### 빌드 명령어
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 20+

## 라이선스

Private — DO IT COMPANY. All rights reserved.