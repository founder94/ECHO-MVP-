# ECHO — Authentication & OAuth Report

> **STATUS**: FINAL LOCK  
> **DATE**: 2026-06-26  
> **PHASE**: Phase 3 — Google OAuth + Authentication

---

## 1. 인증 아키텍처

```
┌──────────────────────────────────────────────────┐
│                  ECHO Frontend                    │
│  src/pages/auth/page.tsx                          │
│  ┌─────────────┐  ┌──────────────┐               │
│  │ Email Signup │  │ Email Login  │               │
│  └──────┬───────┘  └──────┬───────┘               │
│         │                  │                       │
│  ┌──────┴──────────────────┴───────┐               │
│  │       src/hooks/useAuth.ts       │               │
│  │  signup() / login() / logout()   │               │
│  │  socialLogin(provider)           │               │
│  │  onAuthStateChange()             │               │
│  └──────────────┬───────────────────┘               │
│                 │                                    │
│  ┌──────────────┴───────────────────┐               │
│  │     src/lib/supabase.ts          │               │
│  │  createClient(url, anonKey)      │               │
│  └──────────────┬───────────────────┘               │
└─────────────────┼────────────────────────────────────┘
                  │
┌─────────────────┴────────────────────────────────────┐
│              Supabase Auth                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Email    │  │ Google   │  │ Apple    │           │
│  │ Provider │  │ OAuth    │  │ (준비중) │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────────────────────────────────┐            │
│  │         JWT Session Management        │            │
│  └──────────────────────────────────────┘            │
└──────────────────────────────────────────────────────┘
```

---

## 2. 이메일 인증 플로우

### 회원가입 (`signup()`)
```
사용자 입력 (email, password, name, ageGroup, answers)
        │
        ▼
supabase.auth.signUp({ email, password })
        │
        ▼
이메일 인증 메일 발송
        │
        ▼
profiles 테이블 INSERT
  ├── id: user.id (auth.uid())
  ├── email: 사용자 이메일
  ├── name: 닉네임 (없으면 email@ 앞부분)
  ├── age_group: 연령대
  └── onboarding_answers: STEP1~2 선택값 배열
        │
        ▼
analytics_events: auth_signup 기록
```

### 로그인 (`login()`)
```
사용자 입력 (email, password)
        │
        ▼
supabase.auth.signInWithPassword({ email, password })
        │
        ├── 성공 → JWT 세션 생성 → profiles SELECT → 상태 업데이트
        │                                    │
        │                          analytics_events: auth_login 기록
        │                                    │
        │                          visitor → user 연결 (linkVisitorToUser)
        │
        ├── "Email not confirmed" → 이메일 인증 필요 메시지
        ├── "Invalid login credentials" → 이메일/비밀번호 불일치 메시지
        └── 기타 오류 → 일반 오류 메시지
```

### 로그아웃 (`logout()`)
```
사용자 클릭
        │
        ▼
analytics_events: auth_logout 기록
        │
        ▼
supabase.auth.signOut()
        │
        ▼
onAuthStateChange → currentUser: null, profile: null
```

---

## 3. Google OAuth 플로우

### 현재 구현 상태

| 항목 | 상태 | 비고 |
|---|---|---|
| Google OAuth 코드 | ✅ 구현 완료 | `useAuth.ts` → `socialLogin('google')` |
| Redirect URL | ✅ `window.location.origin + pathPrefix + '/'` | Production Domain 자동 적용 |
| Provider 활성화 | 🔧 Dashboard 필요 | Supabase Auth → Providers → Google |
| Client ID / Secret | 🔧 Dashboard 입력 필요 | Google Cloud Console에서 발급 |
| Authorized Redirect URI | 🔧 Dashboard 확인 필요 | Supabase Callback URL |

### OAuth 코드 상세 (`useAuth.ts`)
```typescript
const socialLogin = useCallback(async (provider: AuthProviderType) => {
  const basePath = (window as any).__BASE_PATH__ || '';
  const pathPrefix = basePath ? `/${basePath.split('/').filter(Boolean).join('/')}` : '';
  const redirectTo = `${window.location.origin}${pathPrefix}/`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  if (error) return { success: false, error: error.message };
  return { success: true, url: data.url };
}, []);
```

**핵심**: `redirectTo`가 `window.location.origin`을 사용하므로 Production Domain으로 자동 적용됨.

### Google OAuth Provider 활성화 가이드

#### Step 1: Google Cloud Console
1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 선택
2. APIs & Services → Credentials
3. OAuth 2.0 Client ID 생성
   - Application Type: Web application
   - Authorized JavaScript Origins: `https://echo.do-it.company`
   - Authorized Redirect URIs: `https://omtg545xfkajrq51eaon.helloreaddy.com/auth/v1/callback`

#### Step 2: Supabase Dashboard
1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트
2. Authentication → Providers → Google
3. Google Provider → **Enabled** (ON)
4. Client ID: Google Cloud Console에서 발급받은 값 입력
5. Client Secret: Google Cloud Console에서 발급받은 값 입력
6. 저장

---

## 4. Google Login QA 체크리스트

> ⚠️ Provider 활성화 후 실제 테스트 필요

| 단계 | 예상 결과 | 확인 |
|---|---|---|
| Google 로그인 버튼 클릭 | Google OAuth 페이지로 리다이렉트 | ⬜ |
| Google 계정 선택 | OAuth 권한 승인 화면 | ⬜ |
| OAuth 승인 완료 | Production Domain(`echo.do-it.company`)으로 복귀 | ⬜ |
| 회원 자동 생성 | `profiles` 테이블에 INSERT | ⬜ |
| Session 생성 | JWT 토큰 발급 + 쿠키 저장 | ⬜ |
| Member Gate 통과 | 인증 필요 페이지 접근 가능 | ⬜ |
| AI 사용 가능 | Edge Function 호출 시 JWT 인증 통과 | ⬜ |
| 새로고침 | 세션 유지 (persistSession) | ⬜ |
| 로그인 유지 | 페이지 이탈 후 재방문 시 자동 로그인 | ⬜ |
| 로그아웃 | 세션 종료 + `currentUser: null` | ⬜ |

---

## 5. Apple / Kakao OAuth (준비 상태)

| Provider | 코드 상태 | Provider | 비고 |
|---|---|---|---|
| Apple | 버튼 UI ✅ / 인증 ❌ | 미활성화 | "설정 중" 메시지 표시 |
| Kakao | 버튼 UI ✅ / 인증 ❌ | 미활성화 | "설정 중" 메시지 표시 |

### Apple OAuth 활성화 조건
- Apple Developer Program 가입 ($99/년)
- App ID에 "Sign in with Apple" Capability 활성화
- Services ID 생성 및 Return URL 설정
- Supabase Providers → Apple에 Client ID / Secret 등록

### Kakao OAuth 활성화 조건
- [Kakao Developers](https://developers.kakao.com/) 앱 등록
- REST API 키 발급
- Redirect URI에 Supabase Callback URL 등록
- Supabase Providers → Kakao에 Client ID / Secret 등록

---

## 6. OAuth Security

| 보안 메커니즘 | 구현 여부 | 비고 |
|---|---|---|
| State 파라미터 | ✅ Supabase SDK 내장 | CSRF 방지 |
| PKCE (Proof Key for Code Exchange) | ✅ Supabase SDK 내장 | Authorization Code Interception 방지 |
| Nonce | ✅ Supabase SDK 내장 | ID Token Replay 방지 |
| Redirect URI 검증 | ✅ Supabase Auth 서버 측 | Whitelist 기반 |
| Token 저장 | ✅ Supabase SDK httpOnly 쿠키 | XSS 방지 |
| Session Refresh | ✅ autoRefreshToken: true | 자동 갱신 |
| Sign Out | ✅ signOut() → 세션 + 쿠키 제거 | 완전 종료 |
| 재사용 공격 방지 | ✅ JWT exp + signature 검증 | 토큰 만료 |

---

## 7. 결론

| 항목 | 상태 |
|---|---|
| 이메일 회원가입/로그인 코드 | ✅ Production Ready |
| Google OAuth 코드 | ✅ Production Ready (`window.location.origin` 자동 대응) |
| Google OAuth Provider | 🔧 Supabase Dashboard에서 활성화 필요 |
| Apple OAuth | ⬜ 준비 상태 (문서화 완료) |
| Kakao OAuth | ⬜ 준비 상태 (문서화 완료) |
| OAuth Security | ✅ PKCE + State + Nonce + Redirect 검증 |
| Session 관리 | ✅ autoRefresh + persistSession + httpOnly |

---

*본 문서는 ECHO Infrastructure Master Final Lock v1.0의 Phase 3 산출물입니다.*