# Agent v1 서버 배포 — 차단 기록 (2026-09-24)

근거: 대표 승인 「Agent v1 서버 배포 승인한다」(범위 = doit-understanding 운영 배포 + 지문·부팅·인증·오류 로그 검증).

## 결과: 배포 안 됨 (운영 그대로 = 버전 26 / v15.2 / fd2e1eee…)

1. 배포 전 확인
   - Supabase 연결 도구(MCP)로 운영 파일을 내려받았다.
   - SHA-256 `fd2e1eee80ccf5648822245a074b935a6566ce831fd2c4933a163172cd3ffedd`(186,093바이트)로, 되돌리기 파일과 같았다.
   - 이것으로 **배포 후 글자 단위 대조 경로가 동작한다**는 것도 확인했다.
2. 막힌 곳
   - v15.2 배포에 쓴 Supabase 관리 API 토큰(환경 변수 `SUPABASE_ACCESS_TOKEN`)이 지금은 `/v1/projects` 요청에도 **401 Unauthorized** 를 돌려준다. 만료되었거나 폐기된 것으로 보인다.
   - 이 환경에 다른 Supabase 인증 수단은 없다.
3. 하지 않은 것
   - 연결 도구(MCP)로 227,650바이트 파일 내용을 옮겨 적어 올리는 방법은 쓰지 않았다.
   - 이 방법은 과거 두 번 옮겨 적기 오류를 냈다(v14.2 「왜」→「왕」, doit-connect 빈 줄 누락).
   - 이번에도 파일을 나눠 읽는 동안 조각 순서를 한 번 헷갈렸다.
   - PDF §13 은 지문이 다르면 PASS 를 금지한다.

## 풀 방법 (대표)

- 권장: Supabase 대시보드 편집기에 GitHub 의 후보 파일을 그대로 붙여 넣고 「Deploy updates」.
  - 대시보드 편집 경로는 Supabase 공식 문서에 있다: supabase.com/docs/guides/functions/quickstart-dashboard 「update the deployed function code … click Deploy updates」.
  - GitHub 의 「Copy raw file」은 글자 그대로 복사한다.
  - 붙여 넣은 뒤 내가 연결 도구로 내려받아 SHA-256 을 대조한다.
- 대안: 새 Supabase 개인 토큰을 발급해 환경 변수 `SUPABASE_ACCESS_TOKEN` 을 교체한다.
  - 새 세션부터 적용된다.
  - 대표 계정에서 환경 편집이 막혔던 기록이 있다(2026-09-24).
