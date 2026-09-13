# 결제 비활성 배포 후보 검사 로그 · 2026-09-13T09:44:32Z

소스: 래디 project-13865617 (SHA-256 9156ed5f…) + PATCH C(결제 게이트 3파일)
빌드: VITE_A_STRUCTURE_SERVER_ENABLED=true npm run build (vite build, mode production)

```
type-check exit 0 / lint exit 0 / build 성공 (✓ built in 4.60s)

 ✓ readdy-review/payment-gate/gate.test.ts (6 tests) 5ms
      Tests  6 passed (6)

PASS  Supabase URL 호스트 = 의도한 운영 ref (zyyhhxyupizcqhxqnxuu)
PASS  anon 키 형식 = sb_publishable_ (공개 키)
MODE  결제 비활성(토스 심사 대기): 주문 생성·SDK 로드·결제창·승인 요청이 게이트로 차단됨. Toss 키 미설정은 예상 상태
PASS  Toss 클라이언트 키 미설정 = 예상 상태(비활성 모드)
PASS  VITE_A_STRUCTURE_SERVER_ENABLED=true (운영 승인값과 동일)
PASS  out/index.html 존재
PASS  자산 존재: favicon.svg
PASS  자산 존재: assets/index-ClIZ7hx1.js
PASS  자산 존재: assets/index-DE6Ohtm9.css
PASS  _redirects SPA fallback
PASS  .map 파일 없음 (있으면 ZIP 생성 시 -x '*.map' 로 제외하고 재검사)
PASS  inline source map 없음
PASS  번들 내 서버 secret 패턴 0
PASS  번들 내 Supabase 호스트 = zyyhhxyupizcqhxqnxuu 만 (zyyhhxyupizcqhxqnxuu.supabase.co )
PASS  번들에 '결제 준비 중' 버튼 라벨 포함
PASS  번들에 결제 준비 중 안내 문구 포함 (게이트 상수는 번들러가 접어 문자열로 남지 않음)
PASS  잘못된 endpoint(미리보기·옛 프로젝트·로컬) 없음
RESULT: ARTIFACT VERIFIED
```
