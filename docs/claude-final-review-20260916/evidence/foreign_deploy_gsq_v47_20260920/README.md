# 운영 get-step-question v47 — 이 세션이 배포하지 않은 버전 (2026-09-20 03:05:22 UTC)

- 이 세션의 마지막 배포: v46 (01:53 UTC, 파일 3개 ai.ts/rules.ts/index.ts, 기준점 02:54:54 에 운영=로컬=저장소 SHA 5/5 확인)
- 03:05:22 UTC 에 v47 로 바뀜. index.ts 단일 파일(380줄, sha256 bd7ffc58bb5e7676…), std@0.168 serve, gpt-4o-mini, anon 키 클라이언트로 INSERT.
- DB 권한: conversations 에 authenticated 역할은 SELECT 만 있음 → v47 의 start INSERT 가 "permission denied for table conversations"(postgres 로그 03:05:44) → 사용자에게 {"ok":false,"code":"ERROR","error":"대화를 시작하지 못했어요."} (03:11 실측).
- 결과: 최종 100회 v3 가 9회차(i=9)부터 시작 실패. 검사기 정지(03:09:37, 14행). 제품·DB 변경 없음.
- 래디 내보내기 zip 5종·과거 운영본 스냅샷과 sha 불일치(구조만 동일). 배포 주체는 이 세션 도구로 확인 불가.
