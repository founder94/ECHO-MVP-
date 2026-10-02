# ECHO v3 작업 마감 — 2026-10-02 r3

새 명세가 아닌 현재 제출 단위 검수 기록이다. 제출 기준 echo-qa `1da42948348dc674e6863563351ec65d7598c52c`. 원래 보존 기준 `cf53197` / 커밋 `ce8590e`, 후속 보존 `1e10dfb198b29b2b9b8f52a86c96a19bf3356fa0`.

## 원인과 수정
A/B 각각 저장된 세션은 Auth HTTP403 bad_jwt, 함수 HTTP401 UNAUTHORIZED_ASYMMETRIC_JWT였다. 같은 계정의 password login과 getUser 검증 후 양쪽 모두 HTTP200/ok=true/eligible=true, missing=[], Agent ready 3/3, 사진3, 후보1. 프로필·CONFIRMED·차단 기록을 수정하지 않았고 실AI 추가 호출도 없었다. 최초 자격 assertion은 실패 응답을 자격 데이터로 해석한 검사 결함도 포함했다. 이전 CA 오류와 현재 인증 실패는 별개다.

검수 overlay에서 fail(code,error,status,origin)를 실제 정의대로 사용하여 QA_FIXTURE_ONLY/HTTP403을 반환한다. getUser 주체 기준이며 body user_id를 신뢰하지 않는다. fixtureClient는 허용 A/B의 profile·pair·connection·event·safety rows와 asset path로 service client를 제한한다. 전역 Auth listUsers 대신 허용 두 사용자 getUserById만 호출한다. 관리자 요청은 QA_ADMIN_DISABLED/403. 공유 제품 파일에는 allowlist나 overlay import를 넣지 않았다.

## 증거와 검사
- 과거 전체83 파일: 완료 PASS83/fail0; 종료 코드 미회수. 과거72 code/mock 검사: PASS72/fail0. 실서버 결과와 합산하지 않는다.
- v1 실제30 PASS는 v1 증거다. v2 재시도는 unauthorized PASS 후 A/B eligibility FAIL로 종료했다.
- 격리 v3 실제47 PASS/fail0, 종료 코드0 확인. 기존 승인 A/B를 재로그인해 후보→YES A/B→Mutual→Connection→첫질문/답변→현재full gate→양방향중복안전message→Outcome→신고/차단→재접속거부. requestId 다른내용/다른actor409, 관리자5요청403, 존재하지않는 대상4쓰기404도 포함한다. 상세 로그와 대상 해시는 evidence/V3_MANIFEST.json에 연결한다.
- 실제 저장 read-only 확인: A/B connection1, message2, report1, block1. 계정·데이터 삭제0.
- 새 격리 모의6 PASS/fail0, 종료 코드0. C 입구403과 A의 외부 candidate/connection/answer/message/outcome/report 및 asset scope를 분리해 검사했다.
- 최신 제출 기준 전체87 test FILES PASS/fail0/cancel0/skip0/TODO0, 약219초. 완료 로그는 회수했으나 실행 세션 종료 코드는 미회수다. 최초 최신 전체검사는 fake DB의 range 미지원으로 실패(종료1)했고 이를 고친 후 검사한 결과다. 원래 보존 코드 조합 전체84 파일 PASS/종료0은 다른 코드 조합이며 합산하지 않는다.
- lint/type-check와 배포 생성본 Deno check 종료0 확인. 마지막 실행 중 테스트 프로세스 없음. 새 검사를 재시작하지 않는다.

## 배포 소스 대응
격리 함수 v3 JWT verification=true. package hash 및 index/fixtureScope/agentSource/agent/lifecycle 다섯 모듈 sha256을 manifest에 기록했다. 실제 배포 소스 다섯 파일과 배포 입력이 각각 정확히 일치함을 확인했다. v2는 제품 index에 상수/후보filter/caller gate 세 격리 처리를 붙인 배포물이며 원래 제품 코드와 완전 동일하지 않았다. v3는 별도 fixtureScope module과 wrapper를 사용한다.

제출 기준은 최신 QA HEAD다. v3는 보존 branch의 기존 server 보완을 포함하므로 최신 공유 QA와 동일하지 않다. 제출 diff는 QA 도구·모의검사·문서·증거만이다. dependency builder는 실제 import가 있을 때만 lifecycle/meetGate를 포함하며 공유 서버에 오래된72h 정책을 복원하지 않는다. 모의 query range 지원은 Claude 최신 페이지 조회 계약에 맞춘 검사 도구 수정이다. A/B47을 최신 공유 QA나 핵심 제품 전체 PASS로 확대하지 않는다.

## 보류와 위험
실제 로그인한 비허용 C 검사: 계정 추가 승인 대기. 생성0/allowlist확대0. 존재하지 않는 ID404와 실제 제3자 방·사진 거부는 별개이며 후자는 자료·승인 부족 HOLD. Mock 검사는 실제 타인 자료 검사로 승격하지 않는다.
선택/차단/메시지 사이 원자성, 영속72h 응답대기 정책, partial derivatives/철회, 영상·각자만남의사·관리자 전체·실기기 미완료. signedURL의600초는 이미 다운로드된 bytes/cache/in-flight를 회수하는 상한이 아니다.
이번 제출 마감은 제품100%가 아니다. shared QA/PROD/DB/RLS/Storage/Auth구조/Secret 변경0. Claude 직접 수신 증거 없어 HANDOFF_PENDING.
