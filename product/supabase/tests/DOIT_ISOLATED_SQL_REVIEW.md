# DO IT 격리 SQL 실행 검사

이 검사는 실제 SQL 초안을 로컬 인메모리 PostgreSQL 엔진에서 실행합니다. 모든 계정·문장·목적·AI 응답은 합성 자료입니다. 운영 Supabase, 실제 사용자 데이터, 실제 AI에는 접속하지 않습니다.

최종 로컬 실행 결과: **31개 시나리오 통과**. Node 집계는 상위 그룹 1개를 포함해 **32/32, exit 0**입니다. JSON 형태의 service role claim만 있는 환경에서 후보 완료가 실패하는 문제를 이 검사에서 재현했고, 6개 기존 RPC의 호환 처리가 수정된 뒤 같은 검사가 통과했습니다.

## 실행

검사 전용 경로에 `@electric-sql/pglite@0.5.8`을 준비한 뒤 실행합니다. 앱의 의존성이나 잠금 파일을 바꿀 필요는 없습니다.

```sh
PGLITE_MODULE=/absolute/path/to/node_modules/@electric-sql/pglite/dist/index.js \
  node --test supabase/tests/doit_isolated_sql.test.mjs
```

작업 공간 기본 검사 경로가 있으면 `PGLITE_MODULE`을 생략할 수 있습니다. 검사 종료 시 인메모리 DB가 닫히며 파일 DB나 외부 연결을 만들지 않습니다.

## 검사 대상과 순서

1. `fixtures/doit_isolated_schema.sql`의 최소 합성 스키마를 생성합니다.
2. `fixtures/doit_captured_rpc_baseline.sql`의 기존 RPC 6개를 설치합니다. 캡처된 `pg_get_functiondef`와 배포 전제 MD5 6개가 모두 일치해야 합니다.
3. `PENDING_20260921_doit_revision_lock.sql`을 전제 검사까지 그대로 실행합니다.
4. `PENDING_20260921_doit_followup.sql`을 전제 검사·권한 설정까지 그대로 실행합니다.
5. 소유권, 요청 중복, 응답 복원, 변경된 맥락, 만료된 작업, 사용자 정정과 원문 보존을 SQL 질의로 검사합니다.
6. 마지막에만 격리 DB에서 emergency rollback 초안을 실행하여 MD5와 기존 자료 보존을 확인합니다. 반복 rollback 거절을 확인하고 revision 안전장치를 다시 적용합니다.

## 확인하는 동작

- 같은 요청과 다른 요청 UUID의 생성 중복 차단, 완료된 실제 응답 재사용.
- 새 UUID로 재사용한 응답도 요청 내용이 바뀌면 충돌 처리.
- 질문과 후보 생성이 같은 기록에서 동시에 진행되지 않도록 claim 상태 검사.
- 후보를 사용자가 확인하기 전 질문 진행 차단.
- 사용자 직접 설명·정정·목적 변경 뒤 옛 질문 복원 차단.
- 생성 도중 사용자 설명 또는 목적이 바뀌면 옛 맥락의 질문·후보 저장 거절.
- 90초 작업 기한이 지난 A 뒤에 B가 시작했을 때 A 저장 거절, B 저장 허용.
- 질문·후보·rescue의 저장된 응답을 그대로 복원.
- v5의 응답 스냅샷 없는 완료 요청은 새 AI 작업으로 되살리지 않음.
- 다른 사용자 기록 접근·결과 완료 거절, 같은 UUID의 사용자별 독립성.
- anon/authenticated SQL 역할의 신규 RPC 실행권한 부재. 가짜 role claim으로도 실행권한을 넘지 못함.
- 정정 시 revision 증가, 오래된 revision 거절, AI 원문과 사용자 최초 원문 보존, 거절 상태 되돌리기 차단.
- 정확히 검토한 함수 버전에만 적용되는 배포·rollback 전제 검사.

## 결과의 한계

PGlite 0.5.8은 이 작업 공간에서 PostgreSQL 18.3으로 실행됐습니다. **단일 연결에서 순서대로 실행하는 검사**이므로 다중 세션 동시성, 운영 PostgreSQL 버전 호환성, 실제 advisory lock 경합, 운영 RLS, Auth/JWT, 실제 AI 품질이나 전체 운영 배포를 검증한 결과가 아닙니다.

합성 fixture는 검토에 필요한 열·제약·timestamp trigger 동작을 재현하며, 운영 스키마 전체의 복제본이 아닙니다. `auth.uid()`도 합성 session setting만 읽는 검사 전용 구현입니다. 프로필은 목적 관련 최소 열만 포함하고 실사용자 데이터와 Auth 사용자 FK는 포함하지 않습니다.

별도 담당자가 운영 `pg_get_constraintdef`를 읽기 전용으로 확인한 CHECK 9개를 fixture에 반영했습니다. 기록은 status와 두 원문 열의 공백 금지, 해석은 category/origin/status/text 공백 금지, 요청 이력은 status와 action 공백 금지입니다. 요청 action은 고정 열거형이 아니므로 `followup_generate`가 허용됩니다. 실제 records/insights에는 revision CHECK가 없어 fixture에도 임의로 추가하지 않았습니다. 이 대조는 CHECK 범위에 한정되며 전체 권한·RLS·스키마 동일성을 뜻하지 않습니다.

이 검사 통과를 운영 DB 변경 승인이나 운영 검증 완료로 해석하면 안 됩니다. 테스트 수에는 Node의 상위 그룹 1개가 포함됩니다.
