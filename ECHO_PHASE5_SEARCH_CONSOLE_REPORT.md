# ECHO — Google Search Console Registration Guide

> **STATUS**: FINAL LOCK  
> **DATE**: 2026-06-26  
> **PHASE**: Phase 5 — Google Search Console  
> **PRODUCTION DOMAIN**: `https://echo.do-it.company`

---

## 1. 등록 절차

### Step 1 — 도메인 소유권 인증
Readdy에서 제공하는 Google Search Console 등록 기능 사용:

<readdy-link page="seo-submit-gsc">Google Search Console 등록</readdy-link>

Readdy가 자동으로 DNS TXT 레코드 또는 HTML 파일 업로드 방식으로 소유권을 인증합니다.

### Step 2 — Sitemap 제출
소유권 인증 완료 후 Sitemap 제출:

```
https://echo.do-it.company/sitemap.xml
```

### Step 3 — URL Inspection
대표 페이지 색인 요청:

| 페이지 | URL | 우선순위 |
|---|---|---|
| 홈페이지 | `https://echo.do-it.company/` | 🔴 최우선 |
| About | `https://echo.do-it.company/about` | 🟡 |
| FAQ 섹션 | `https://echo.do-it.company/#faq` | 🟡 |
| Auth | `https://echo.do-it.company/auth` | 🟢 |
| Report | `https://echo.do-it.company/report` | 🟢 |
| Portfolio | `https://echo.do-it.company/portfolio` | 🟢 |

> ⚠️ `/admin`은 검색 엔진 색인에서 제외 권장 (noindex)

---

## 2. Index Coverage 모니터링

Search Console 등록 후 확인할 항목:

| 상태 | 설명 | 대응 |
|---|---|---|
| 색인 완료 (Indexed) | 정상 색인 | ✅ |
| 오류 (Error) | 색인 실패 | 원인 분석 → 수정 → 재요청 |
| 경고 (Warning) | 색인되었으나 문제 있음 | 경고 내용 확인 → 개선 |
| 제외 (Excluded) | 색인 제외 (noindex, canonical 등) | 의도된 제외인지 확인 |

---

## 3. Performance (Search Console)

초기 1~2주 데이터 수집 후 확인할 지표:

| 지표 | 설명 | 초기 기준 |
|---|---|---|
| Total Impressions | 검색 결과 노출 횟수 | 0에서 시작 → 증가 추세 |
| Total Clicks | 검색 결과 클릭 횟수 | 0에서 시작 → 증가 추세 |
| Average CTR | 클릭률 (Clicks/Impressions) | 2~5% 목표 |
| Average Position | 평균 검색 순위 | 50위 이내 진입 목표 |

### 세분화 분석

| 차원 | 확인 항목 |
|---|---|
| Device | Desktop / Mobile / Tablet 비율 |
| Country | 국가별 트래픽 (주타겟: KR) |
| Page | 페이지별 노출/클릭 (홈페이지 최우선) |
| Search Query | 검색어별 노출/클릭 (ECHO, 관계 분석, AI 등) |

---

## 4. AI SEO 진단

등록 후 AI 기반 SEO 진단 실행:

<readdy-link page="seo-site-diagnosis">AI SEO 자동 진단</readdy-link>

진단 항목:
- 메타태그 완전성
- 구조화 데이터 유효성
- 모바일 최적화
- 페이지 로딩 속도
- 콘텐츠 품질
- 키워드 최적화

---

## 5. SEO 설정 페이지

추가 SEO 설정이 필요한 경우:

<readdy-link page="seo">SEO 설정</readdy-link>

- 메타태그 수정
- 소셜 미디어 미리보기
- 구조화 데이터 커스터마이징

---

## 6. 예상 타임라인

| 기간 | 마일스톤 |
|---|---|
| 등록 직후 | 소유권 인증 완료, Sitemap 제출 |
| 1~3일 | 최초 크롤링 시작, 일부 페이지 색인 |
| 1~2주 | 대부분 페이지 색인 완료, Search Console 데이터 축적 |
| 2~4주 | 검색 결과 노출 시작, 초기 성과 데이터 확보 |
| 1~3개월 | 안정적 색인, 검색 순위 상승, 트래픽 증가 |

---

## 7. 체크리스트

| 항목 | 상태 |
|---|---|
| 도메인 소유권 인증 | ⬜ |
| Sitemap 제출 | ⬜ |
| 홈페이지 URL Inspection + 색인 요청 | ⬜ |
| About 페이지 색인 요청 | ⬜ |
| FAQ 색인 요청 | ⬜ |
| Index Coverage 오류 확인 | ⬜ |
| Performance 초기 데이터 확인 (1주 후) | ⬜ |
| AI SEO 진단 실행 | ⬜ |

---

*본 문서는 ECHO Infrastructure Master Final Lock v1.0의 Phase 5 산출물입니다.*