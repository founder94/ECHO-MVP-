# Netlify 저장 설정 vs 이번 빌드 입력 (변경안 · 미실행 · 2026-09-13)
대상: echo-mvp-doit · site 7a4934db-aff3-437d-815a-ffbf49d4b819 · do-it.company (전략본부 읽기 전용 조회값)

| 항목 | Netlify 저장값(전략본부 조회) | 이번 검증 빌드 입력 | 현재 라이브 번들(추정 근거) |
|---|---|---|---|
| VITE_PUBLIC_SUPABASE_URL | 옛 MVP ref asqxduoorrsdaixflqgo | zyyhhxyupizcqhxqnxuu | do-it.company 발 로그인이 zyyhhxyupizcqhxqnxuu 인증 로그에 기록됨(07:27 UTC) → 라이브 번들은 새 프로젝트. 즉 라이브는 Netlify 환경변수로 빌드된 것이 아니라 정적 산출물 업로드(래디 경로)로 추정. 확정은 라이브 번들 실측 필요(프록시 차단으로 NOT RUN) |
| VITE_PUBLIC_TOSS_CLIENT_KEY | 없음 | 비어 있음(HOLD 원인) | 라이브도 비어 있을 가능성 큼(같은 .env 경로). 미확정 |
| VITE_A_STRUCTURE_SERVER_ENABLED | production context true (netlify.toml) | true | 동일 |

## 위험
- 지금 Netlify 에서 "소스 재빌드(Trigger deploy / Git push 빌드)" 를 누르면 저장된 옛 Supabase URL 로 번들이 만들어져 **옛 DB 를 가리키는 사이트가 배포**된다. 검증 없이 자동 재빌드 금지.
- 수동 폴더 업로드는 Netlify 환경변수를 쓰지 않으므로, 업로드 ZIP 자체가 모든 값을 담아야 한다.

## 권장 변경안 (대표 승인 후 대표가 Netlify 화면에서 실행 · 이번 회차 미실행)
1. VITE_PUBLIC_SUPABASE_URL → https://zyyhhxyupizcqhxqnxuu.supabase.co
2. VITE_PUBLIC_SUPABASE_ANON_KEY → 같은 프로젝트의 publishable 키 (다른 프로젝트 키 혼합 금지)
3. VITE_PUBLIC_TOSS_CLIENT_KEY → 테스트 클라이언트 키(test_ck_) 추가
4. 변경 후에도 자동 재빌드는 하지 않는다. 다음 정식 빌드 경로가 확정될 때까지 수동 업로드 유지.
영향 범위: 이 사이트(echo-mvp-doit)만. 모바일 프로젝트(doitmobile / echo.do-it.company) 무관.
복구: 변경 전 값(옛 ref)을 기록해 두고 되돌리기.
