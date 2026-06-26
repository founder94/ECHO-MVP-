# ECHO — Supabase Production Migration Report

> **STATUS**: FINAL LOCK  
> **DATE**: 2026-06-26  
> **PHASE**: Phase 2 — Supabase Production Migration  
> **PRODUCTION DOMAIN**: `echo.do-it.company`

---

## 1. Supabase 인스턴스 정보

| 항목 | 값 | 상태 |
|---|---|---|
| Supabase Project URL | `https://omtg545xfkajrq51eaon.helloreaddy.com/` | ✅ 정상 |
| Anon Key | `sb_publishable_WUgp0bCln5yk8KmZrZxwISLO5Kq66jzg` | ✅ 환경변수 주입 |
| Service Role Key | Supabase Secret에 저장 (브라우저 미노출) | ✅ 보안 |
| Edge Function Domain | `omtg545xfkajrq51eaon.helloreaddy.com` | ✅ 정상 호출 |

---

## 2. Authentication 설정 (Dashboard 확인 필요)

> ⚠️ 아래 항목은 Supabase Dashboard → Authentication → Settings에서 Production Domain 기준으로 설정

| 설정 항목 | 현재 값 (추정) | Production 값 | 확인 |
|---|---|---|---|
| Site URL | Readdy 임시 도메인 | `https://echo.do-it.company` | 🔧 변경 필요 |
| Redirect URLs | Readdy 임시 도메인 | `https://echo.do-it.company/**` | 🔧 변경 필요 |
| Email Redirect | 기본값 | `https://echo.do-it.company/auth` | 🔧 확인 필요 |
| Password Reset Redirect | 기본값 | `https://echo.do-it.company/auth?mode=login` | 🔧 확인 필요 |
| Magic Link Redirect | 기본값 | `https://echo.do-it.company/auth` | 🔧 확인 필요 |

### 변경 방법
1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. Authentication → URL Configuration
3. Site URL을 `https://echo.do-it.company`로 변경
4. Redirect URLs에 `https://echo.do-it.company/**` 추가
5. 저장 후 1~2분 내 반영

---

## 3. Edge Function 검증

| 항목 | 상태 | 비고 |
|---|---|---|
| `echo-ai-analysis` 배포 | ✅ 정상 | Deno Deploy |
| CORS 설정 | ✅ `Access-Control-Allow-Origin: *` | 모든 Production Origin 허용 |
| JWT 인증 | ✅ Authorization 헤더 필수 | 401 반환 |
| OpenAI API Key | ✅ `Deno.env.get("OPENAI_API_KEY")` | Supabase Secret |
| Safety Detection | ✅ 14개 위험 키워드 감지 | 안전 안내 우선 |
| Error Handling | ✅ 6개 에러 코드 분기 | API_KEY / AUTH / RATE_LIMIT / TIMEOUT / EMPTY / INTERNAL |
| AI Log 기록 | ✅ `ai_logs` 테이블 | Supabase DB |

### CORS 상세
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```
JWT 인증이 필수이므로 CORS `*`는 Production에서도 보안 리스크 없음.

---

## 4. Database (RLS) 검증

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | ✅ auth.uid() | ✅ auth.uid() | ✅ auth.uid() | ❌ 금지 |
| `analytics_events` | ✅ anon/authenticated | ✅ anon/authenticated | ❌ | ❌ |
| `ai_logs` | ❌ (Edge Function only) | ✅ Edge Function | ❌ | ❌ |
| `product_categories` | ✅ anon | ❌ anon | ❌ anon | ❌ anon |
| `product_items` | ✅ anon | ❌ anon | ❌ anon | ❌ anon |
| `order_headers` | ✅ | ✅ | ✅ | ❌ |
| `order_items` | ✅ | ✅ | ✅ | ❌ |

**RLS 정책 검증 완료**: 모든 테이블에 적절한 Row Level Security 적용됨. Service Key는 RLS 우회 가능 (Edge Function 전용).

---

## 5. Environment Variables

| 변수 | 위치 | 노출 여부 | 상태 |
|---|---|---|---|
| `VITE_PUBLIC_SUPABASE_URL` | `.env` (클라이언트) | ✅ 공개 허용 | 정상 |
| `VITE_PUBLIC_SUPABASE_ANON_KEY` | `.env` (클라이언트) | ✅ 공개 허용 | 정상 |
| `OPENAI_API_KEY` | Supabase Secret (Edge Function) | 🔒 비공개 | 정상 |
| `SUPABASE_URL` | Edge Function `Deno.env` | 🔒 비공개 | 정상 |
| `SUPABASE_ANON_KEY` | Edge Function `Deno.env` | 🔒 비공개 | 정상 |

**Secret 노출 검증 통과**: API Key는 브라우저에 절대 노출되지 않음. 모든 Secret은 Supabase Secrets 또는 Deno.env로 관리.

---

## 6. Authentication QA 체크리스트

> ⚠️ Site URL 변경 후 실제 테스트 필요

| 테스트 항목 | 예상 결과 | 실제 확인 |
|---|---|---|
| 이메일 회원가입 | profiles INSERT + 이메일 인증 메일 발송 | ⬜ |
| 이메일 인증 | 인증 완료 후 로그인 | ⬜ |
| 로그인 | JWT 세션 생성 + profiles SELECT | ⬜ |
| 로그아웃 | 세션 종료 + UI 상태 초기화 | ⬜ |
| 재로그인 | 동일 계정으로 정상 로그인 | ⬜ |
| 새로고침 | 세션 유지 (persistSession) | ⬜ |
| 비밀번호 변경 | Supabase Auth 비밀번호 변경 | ⬜ |
| 비밀번호 재설정 | Password Reset 이메일 → 새 비밀번호 설정 | ⬜ |
| 탈퇴 | Supabase Auth 사용자 삭제 | ⬜ |
| 재가입 | 동일 이메일로 재가입 가능 | ⬜ |

---

## 7. Session QA (크로스 플랫폼)

| 플랫폼 | 브라우저 | 세션 유지 확인 |
|---|---|---|
| Desktop (Mac) | Chrome | ⬜ |
| Desktop (Mac) | Safari | ⬜ |
| Desktop (Windows) | Chrome | ⬜ |
| Desktop (Windows) | Edge | ⬜ |
| Desktop (Windows) | Firefox | ⬜ |
| Tablet (iPad) | Safari | ⬜ |
| Tablet (Android) | Chrome | ⬜ |
| Phone (iPhone) | Safari | ⬜ |
| Phone (iPhone) | Chrome | ⬜ |
| Phone (Android) | Chrome | ⬜ |
| Phone (Android) | Samsung Internet | ⬜ |
| Phone (Android) | Firefox | ⬜ |

---

## 8. 결론

**코드 레벨 Production 준비**: ✅ 완료  
**Dashboard 설정 필요**: Site URL + Redirect URLs → Production Domain으로 변경 필요  
**Edge Function**: ✅ Production Ready  
**RLS**: ✅ 모든 테이블 보안 정책 정상  
**Secret 관리**: ✅ API Key 브라우저 미노출  

---

*본 문서는 ECHO Infrastructure Master Final Lock v1.0의 Phase 2 산출물입니다.*