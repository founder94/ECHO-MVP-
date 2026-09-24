# Agent v1 서버 운영 대조 (2026-09-24 22:46 KST 무렵 · 실제 서버 기준)

대표가 Supabase 대시보드 편집기에서 「Deploy updates」를 눌러 직접 배포했다. 나는 운영 파일을 Supabase 연결 도구(MCP)로 내려받아 대조했다(쓰기 0).

| 항목 | 결과 | 판정 |
|---|---|---|
| 운영 버전 | doit-understanding **버전 27** · ACTIVE (전 26) | 확인 |
| SHA-256 | 운영 `1aab64236bb7c9a41aa40459f0c320abca296e1c928fd76007de2d26b790c450`(227,649바이트) ≠ 승인 후보 `113e3738…`(227,650바이트) | **불일치 → PASS 금지** |
| 불일치 내용 | `cmp`: 후보 파일 맨 끝 줄바꿈 1바이트만 없다. 후보의 앞 227,649바이트와 운영 파일은 글자 단위로 같다(`head -c 227649 후보 | cmp - 운영` = 같음). 대시보드 편집기가 파일 끝 줄바꿈을 지운 것으로 보인다. | 코드 내용 차이 0, 지문은 다름 |
| verify_jwt | true | PASS |
| 무인증 요청 | 401 `UNAUTHORIZED_NO_AUTH_HEADER` | PASS |
| 가짜 토큰 | 401 `UNAUTHORIZED_INVALID_JWT_FORMAT` | PASS |
| anon 키(비로그인) | 401 — 새 코드가 직접 `{"code":"UNAUTHORIZED","error":"로그인이 필요해요."}` 로 답함 | PASS |
| 부팅 | 함수 로그 `booted (time: 24ms)` (13:47:31Z) | PASS |
| 배포 후 오류 로그 | 13:40Z 이후 함수 로그 = 내 검사 요청 401 4건 + booted 1건, 오류 0 | PASS |
| 다른 함수 9개 | 버전·수정 시각 그대로 | PASS |

- 대표 지시: 「하나라도 불일치하면 PASS 금지하고 앱·홈페이지 배포도 중단」
  → **SERVER DEPLOY = FAIL(지문 불일치)**, 앱 ZIP `a8d4e790…`·홈페이지 ZIP `061f7397…` **전달 안 함**.
- 운영 파일 사본: `prod/doit-understanding.v27.prod.ts`
- 되돌리기: `PATCH-20260924-v16-conversation/rollback/doit-understanding.v26.ts`(`fd2e1eee…`)
- 영향:
  - 운영 서버는 이미 Agent v1 코드다(줄바꿈 하나만 다름).
  - 운영 앱(43차)이 쓰는 옛 동작은 서버에 그대로 남아 있어 옛 앱과 함께 동작한다.
  - 새 동작 `turn` 은 44차 앱을 올려야 쓰인다.
- DB·RLS·Auth·Secret·모델·결제·가격·KEY 변경 0.
