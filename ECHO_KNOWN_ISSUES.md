# ECHO — Known Issues

> **STATUS**: FINAL LOCK  
> **DATE**: 2026-06-26

---

## 현재 알려진 이슈

### 1. Apple / Kakao OAuth 미구현
- **심각도**: 낮음 (Low)
- **영향**: Apple/Kakao 로그인 버튼 클릭 시 "설정 중" 메시지 표시
- **원인**: Provider 미활성화 (의도된 상태)
- **해결 방안**: 각 Provider Developer Console 등록 + Supabase Dashboard 활성화
- **예상 해결 시기**: Phase 6 이후

### 2. Supabase Site URL 미변경
- **심각도**: 높음 (High)
- **영향**: 이메일 인증 메일의 Redirect 링크가 Readdy 임시 도메인으로 발송됨
- **원인**: Production Domain 연결 후 Dashboard 설정 미변경
- **해결 방안**: Supabase Dashboard → Authentication → URL Configuration → Site URL 변경
- **예상 해결 시기**: 즉시 (5분 소요)

### 3. Stripe 결제 미연동
- **심각도**: 중간 (Medium)
- **영향**: 결제 플로우 없음 (MVP Phase 6 예정)
- **원인**: Phase 6 작업 대기
- **해결 방안**: Stripe 연동 → Checkout + Webhook 구현
- **예상 해결 시기**: Phase 6

### 4. CSP Header 미설정
- **심각도**: 낮음 (Low)
- **영향**: 이론적 XSS 공격 벡터 (React 19가 실질적 방어)
- **원인**: Readdy CDN 수준 설정 필요
- **해결 방안**: Readdy CDN에 CSP Header 추가
- **예상 해결 시기**: Phase 9

### 5. Google Analytics 미연결
- **심각도**: 낮음 (Low)
- **영향**: GA4 기반 트래픽 분석 불가 (Readdy Analytics + 자체 Admin으로 커버)
- **원인**: Phase 7 작업 대기
- **해결 방안**: <readdy-link integration="googleAnalytic">Google Analytics 연결</readdy-link>
- **예상 해결 시기**: Phase 7

### 6. 서브 페이지 SEO 미최적화
- **심각도**: 중간 (Medium)
- **영향**: `/about`, `/auth`, `/report`, `/portfolio` 페이지의 개별 SEO 메타태그 부재
- **원인**: SPA 구조 — 모든 페이지가 동일한 index.html 메타태그 공유
- **해결 방안**: React Helmet (또는 React 19 Head API)으로 페이지별 동적 메타태그 적용
- **예상 해결 시기**: Phase 9

### 7. PWA 미지원
- **심각도**: 낮음 (Low)
- **영향**: 오프라인 접근, 홈 화면 추가, 푸시 알림 불가
- **원인**: Readdy는 React SPA, PWA 미지원
- **해결 방안**: 추후 Next.js 마이그레이션 시 PWA 적용
- **예상 해결 시기**: Next.js 전환 이후

---

## 해결된 이슈

| # | 이슈 | 해결일 |
|---|---|---|
| 1 | 모바일 Safe Area 미대응 | 2026-06-25 |
| 2 | 삼성 Internet backdrop-filter 미지원 | 2026-06-25 |
| 3 | iOS Input Zoom 문제 | 2026-06-25 |
| 4 | Admin Analytics 대시보드 부재 | 2026-06-25 |
| 5 | FPS 모니터링 부재 | 2026-06-25 |
| 6 | Cross-browser QA 대시보드 부재 | 2026-06-25 |
| 7 | Critical Issues 감지 부재 | 2026-06-25 |
| 8 | Founder Today 대시보드 부재 | 2026-06-25 |
| 9 | Edge Function Safety Detection 부재 | 2026-06-26 |
| 10 | AI Log 기록 부재 | 2026-06-26 |
| 11 | SEO 구조화 데이터 부재 | 2026-06-26 |

---

## 우선순위

| 우선순위 | 이슈 | 액션 |
|---|---|---|
| 🔴 P0 | Supabase Site URL 미변경 | Dashboard 즉시 변경 |
| 🟡 P1 | 서브 페이지 SEO 미최적화 | Phase 9 |
| 🟡 P1 | Stripe 결제 미연동 | Phase 6 |
| 🟢 P2 | Apple/Kakao OAuth 미구현 | 요청 시 활성화 |
| 🟢 P2 | Google Analytics 미연결 | Phase 7 |
| 🟢 P3 | CSP Header 미설정 | Phase 9 |
| 🟢 P3 | PWA 미지원 | Next.js 이후 |

---

*본 문서는 ECHO Infrastructure Master Final Lock v1.0의 Known Issues 산출물입니다.*