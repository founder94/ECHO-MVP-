# ECHO — Production Checklist

> **STATUS**: FINAL LOCK  
> **DATE**: 2026-06-26  
> **PHASE**: Production Launch Readiness  
> **PRODUCTION DOMAIN**: `https://echo.do-it.company`

---

## 인프라 체크리스트

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | Production Domain 연결 | ✅ 완료 | `echo.do-it.company` |
| 2 | SSL 인증서 발급 | ✅ Readdy 자동 | Let's Encrypt |
| 3 | HTTPS 강제 적용 | ✅ Readdy CDN | 자동 리다이렉트 |
| 4 | www → non-www Redirect | 🔧 | 도메인 설정 확인 |
| 5 | Canonical Domain 확정 | ✅ | `https://echo.do-it.company` |

---

## Supabase 체크리스트

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 6 | Site URL → Production Domain | 🔧 | Dashboard 변경 필요 |
| 7 | Redirect URLs → Production Domain | 🔧 | Dashboard 변경 필요 |
| 8 | Email Redirect URL | 🔧 | Dashboard 확인 |
| 9 | Password Reset Redirect | 🔧 | Dashboard 확인 |
| 10 | Edge Function 정상 호출 | ✅ | CORS `*`, JWT 인증 |
| 11 | RLS 정책 정상 | ✅ | 모든 테이블 |
| 12 | Environment Variables | ✅ | Secret 미노출 |

---

## 인증 체크리스트

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 13 | 이메일 회원가입 | ⬜ | Site URL 변경 후 테스트 |
| 14 | 이메일 인증 | ⬜ | 인증 메일 수신 확인 |
| 15 | 로그인 | ⬜ | JWT 세션 생성 확인 |
| 16 | 로그아웃 | ⬜ | 세션 종료 확인 |
| 17 | 세션 유지 (새로고침) | ⬜ | persistSession 확인 |
| 18 | 비밀번호 재설정 | ⬜ | Password Reset Flow |
| 19 | Google OAuth | ⬜ | Provider 활성화 후 테스트 |
| 20 | Google OAuth 회원 자동 생성 | ⬜ | profiles INSERT 확인 |
| 21 | Google OAuth Member Gate 통과 | ⬜ | 인증 필요 페이지 접근 |

---

## SEO 체크리스트

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 22 | Title 태그 | ✅ | 59자 |
| 23 | Meta Description | ✅ | 158자 |
| 24 | Canonical URL | ✅ | Production Domain |
| 25 | Open Graph (og:*) | ✅ | 이미지 포함 |
| 26 | Twitter Card | ✅ | summary_large_image |
| 27 | JSON-LD Organization | ✅ | Schema.org |
| 28 | JSON-LD WebSite | ✅ | SearchAction 포함 |
| 29 | JSON-LD SoftwareApplication | ✅ | |
| 30 | JSON-LD FAQPage | ✅ | 6개 Q&A |
| 31 | Geo Tags | ✅ | KR-11, Seoul |
| 32 | robots.txt | 🔧 | Readdy 자동 생성 |
| 33 | sitemap.xml | 🔧 | Readdy 자동 생성 |

---

## Search Console 체크리스트

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 34 | 도메인 소유권 인증 | ⬜ | Google Search Console |
| 35 | Sitemap 제출 | ⬜ | |
| 36 | 홈페이지 색인 요청 | ⬜ | URL Inspection |
| 37 | 서브 페이지 색인 요청 | ⬜ | about, faq 등 |
| 38 | Index Coverage 확인 | ⬜ | 오류 0 확인 |

---

## AI / 기능 체크리스트

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 39 | AI 분석 (Edge Function) | ⬜ | JWT 인증 + 실제 호출 |
| 40 | Report 페이지 | ⬜ | 분석 결과 표시 |
| 41 | White Door | ⬜ | Report 마지막 단계 |
| 42 | Admin Dashboard | ⬜ | analytics_events 데이터 |
| 43 | Safety Detection | ✅ | Edge Function 내 14개 키워드 |
| 44 | AI Log 기록 | ✅ | ai_logs 테이블 |

---

## 크로스 플랫폼 QA 체크리스트

| # | 플랫폼 | 브라우저 | 상태 |
|---|---|---|---|
| 45 | Desktop (Mac) | Chrome | ⬜ |
| 46 | Desktop (Mac) | Safari | ⬜ |
| 47 | Desktop (Windows) | Chrome | ⬜ |
| 48 | Desktop (Windows) | Edge | ⬜ |
| 49 | Desktop (Windows) | Firefox | ⬜ |
| 50 | Tablet (iPad) | Safari | ⬜ |
| 51 | Tablet (Android) | Chrome | ⬜ |
| 52 | Phone (iPhone) | Safari | ⬜ |
| 53 | Phone (iPhone) | Chrome | ⬜ |
| 54 | Phone (Android) | Chrome | ⬜ |
| 55 | Phone (Android) | Samsung Internet | ⬜ |
| 56 | Phone (Android) | Firefox | ⬜ |

---

## 성능 체크리스트

| # | 항목 | 목표 | 상태 |
|---|---|---|---|
| 57 | FPS | 60 | ⬜ |
| 58 | Lighthouse Desktop | 90+ | ⬜ |
| 59 | Lighthouse Mobile | 90+ | ⬜ |
| 60 | LCP | < 2.5s | ⬜ |
| 61 | CLS | < 0.1 | ⬜ |
| 62 | INP | < 200ms | ⬜ |
| 63 | Console Error | 0 | ✅ |
| 64 | Build | Success | ✅ |

---

## 완료 조건

| 항목 | 상태 |
|---|---|
| Production Domain 정상 | ✅ |
| SSL 정상 | ✅ |
| Supabase 정상 | 🔧 Site URL 변경 필요 |
| Google OAuth 정상 | 🔧 Provider 활성화 필요 |
| AI 분석 정상 | ⬜ |
| Report 정상 | ⬜ |
| White Door 정상 | ⬜ |
| Admin 정상 | ⬜ |
| SEO 완료 | ✅ 코드 레벨 |
| Search Console 등록 완료 | ⬜ |
| 모바일(iOS/Android) 정상 | ⬜ |
| Console Error 0 | ✅ |
| Build Success | ✅ |
| 배포 완료 | ⬜ Publish 필요 |

---

## 완료율

- **코드 레벨**: 18 / 22 (81.8%)
- **Dashboard 설정**: 0 / 8 (0%)
- **실제 테스트**: 0 / 30 (0%)

**전체 완료율**: 18 / 64 (28.1%) — Dashboard 설정 + 실제 QA 진행 필요

---

*본 문서는 ECHO Infrastructure Master Final Lock v1.0의 Production Checklist입니다.*