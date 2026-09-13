# Publish 게이트 기록 · 2026-09-13 (갱신 2차, 16:35 KST 보고 이후 최신 근거)

## 1. 소스와 배포물 연결
| 항목 | 값 |
|---|---|
| 검사 소스 ZIP | 래디 재내보내기 project-13865617 · SHA-256 9156ed5fb5a609ef0c46ec6efd6fd5e07f059401319bf271a4acbeb15dc054dd |
| 검사 결과(이 소스 그대로) | type-check exit 0 · lint exit 0 · build 성공 |
| build 명령·mode | `VITE_A_STRUCTURE_SERVER_ENABLED=true npm run build` (vite build, mode production, outDir out) |
| 배포 ZIP | docs/readdy-v449/deploy/doit-company_netlify-deploy_2026-09-13.zip · SHA-256 d53a601bdfca66c52fd0653d0c0e598bfcbc7a9d63fc08e231f0da85d98161f4 |
| 배포 ZIP 파일 목록 | index.html · _redirects · favicon.svg · assets/index-B-6Kb6Ko.js · assets/index-DE6Ohtm9.css (6항목, .map 제외) |
| 자산 참조 | index.html 이 참조하는 3개 자산 모두 ZIP 안에 존재 |
| SPA fallback | _redirects `/* /index.html 200` 포함 → /admin/mobile·/auth/callback 직접 진입 가능 |
| 소스맵 | .map 파일 0개. JS 끝의 sourceMappingURL 주석 1개 남음(파일 없음 → 무해) |
| 잘못된 endpoint | localhost/127/스테이징 ref/readdy 미리보기/ready.co 검색: `localhost:9999` 1건 = supabase auth-js 라이브러리 기본 상수(GOTRUE_URL), 앱 endpoint 아님. 그 외 0건 |
| Supabase 대상 | 번들 내 host = zyyhhxyupizcqhxqnxuu.supabase.co (운영 프로젝트) 1개 |

## 2. 비밀값 실제 종류 검토 (값·해시 미출력)
| 항목 | 결과 |
|---|---|
| VITE_PUBLIC_SUPABASE_ANON_KEY | `sb_publishable_` 접두 공개 키(값 종류 확인). 번들 내 sb_publishable_ 1건 |
| sb_secret_ / service_role JWT | 번들 내 0건. JWT 형태 토큰 0건 |
| OpenAI/DB 비밀번호/기타 secret 패턴 | 0건 |
| **VITE_PUBLIC_TOSS_CLIENT_KEY** | **ZIP .env 에서 빈 값(길이 0)** → 이 조건으로 빌드된 배포 ZIP 은 토스 클라이언트 키 없이 굳음. src/lib/echo/toss.ts 의 getTossClientKey() 가 '' 를 돌려주고 isValidClientKey 가 false → B 4,900원 결제 위젯 초기화 불가(회귀). 번들의 live_ck_/test_ck_ 문자열은 형식 검사 코드이지 키가 아님 |
| VITE_A_STRUCTURE_SERVER_ENABLED | 플래그(비밀 아님). 아래 4절 |

## 3. 판정
**ARTIFACT HOLD.** 검사·소스 동일성·비밀값 노출은 통과했으나, 토스 클라이언트 키가 비어 있어 이 정적 ZIP 은 B 결제를 깨뜨린다. Netlify 대시보드 환경변수는 정적 ZIP 내부에 들어가지 않는다.
해제 조건: 대표가 Netlify 환경변수(또는 토스 개발자센터)의 **클라이언트 키**를 전달 → 같은 소스를 `VITE_PUBLIC_TOSS_CLIENT_KEY=<클라이언트키> VITE_A_STRUCTURE_SERVER_ENABLED=true npm run build` 로 재빌드 → 재검사(번들 내 키 종류 확인) → 새 ZIP 해시 기록.
(대안: Netlify 가 소스에서 직접 빌드하는 경로(래디 Publish 등)는 대시보드 환경변수를 쓰므로 키가 들어가지만, 그 산출물은 Claude 가 사전 검증할 수 없다.)

## 4. 기능 플래그 VITE_A_STRUCTURE_SERVER_ENABLED
- 사용처: src/doit/lib/understandingApi.ts → `A_STRUCTURE_SERVER_ENABLED` → doit-understanding Edge Function(운영 v4 ACTIVE) 호출 경로. P2/KEY 와 무관, A 자기이해 서버 저장 기능.
- 운영 승인값: netlify.toml `[context.production.environment] VITE_A_STRUCTURE_SERVER_ENABLED="true"` (2026-09-05 A·B 통합본) → 현재 운영 배포 조건 true
- ZIP .env 값: true · 검사 시 값: true · 배포 ZIP build 값: true → 새 활성화 없음, 기존과 동일

## 5. 색상 변경 3파일 · 날씨/A 보존
- 대표 확인: 의도한 변경(B 바탕을 히어로 색감으로 통일). '색상 미승인' 분류 해제.
- src/pages/do-it/weather/components/WeatherBackdrop.tsx: 장식 바탕만 브랜드 단일 팔레트. 날씨 표현(비·눈·구름·안개·천둥)은 WeatherEffect.tsx 가 담당하며 **V449 와 바이트 동일**, weather/page.tsx 에서 계속 사용(2곳). 날씨 의미색 복구 불필요.
- src/pages/home/components/WeatherBackdrop.tsx: 날씨별 팔레트 유지, 색값만 초록·노랑 톤.
- src/pages/do-it/start/page.tsx: 블롭·'둘 다' 카드 색값만. 선택 로직·라우팅 변경 0.
- A구조: src/doit/** 및 src/pages/do-it/** (위 2파일 제외) V449 와 차이 0.
- 화면 증거: docs/readdy-v449/evidence/{before,after}_{home,start,weather,doit-landing}.png (390px, 헤드리스 크롬, 외부 이미지·폰트는 프록시 차단으로 미표시).

## 6. 배포 대상·상태
- Netlify project echo-mvp-doit · site 7a4934db-aff3-437d-815a-ffbf49d4b819 · do-it.company (지시서 기재값. Claude 는 Netlify 접근 도구 없음 → 실측 불가)
- **DEPLOY NOT RUN.** 이 ZIP 은 업로드하지 말 것(HOLD).
