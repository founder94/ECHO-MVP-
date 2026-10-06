# DO IT — KEY LEDGER P1 · 격리 테스트 실행 런북 (RUNBOOK)

> 기준일 2026-09-13 · 회사모드 · 운영 DB 적용/실거래는 대표 별도 승인 전 STOP.
> 이 문서는 "격리된" PostgreSQL 환경에서 테스트 SQL을 실제 실행하기 위한 절차와 최소 의존성을 명시한다.

---

## 0. 안전 경고 (반드시 먼저)

- **운영 Supabase(연결된 프로젝트)·운영 키·운영 데이터는 절대 사용 금지.** 테스트는 완전히 별도로 띄운 격리 DB에서만 실행한다.
- 테스트 SQL은 각 케이스를 `begin; … rollback;` 으로 감싸므로 격리 DB조차 오염시키지 않는다.
- apply SQL은 `begin; … commit;` 으로 감싸 실패 시 아무것도 반영되지 않는다(원자적).

---

## 1. 최소 의존성

| 항목 | 요구 | 비고 |
|---|---|---|
| PostgreSQL | **17.x** (운영 실DB 17.6 과 동일 권장) | 14+ 가능하나 17 권장 |
| 확장 | `pgcrypto` (→ `extensions` 스키마에 설치) | `extensions.digest()` 사용 때문 |
| `gen_random_uuid()` | 내장(PG 13+) | 별도 설치 불필요 |
| 클라이언트 | `psql` | |
| 역할 | `postgres`(superuser), `anon`, `authenticated`, `service_role` | 수동 생성 |
| 기타 확장 | **불필요** | dblink 없이 동시성은 두 세션으로 수행 |

> `digest()` 는 반드시 `extensions` 스키마에 두어야 한다(코드가 `extensions.digest(...)` 로 참조).

---

## 2. 환경 준비 (3가지 방법 중 택1)

### A. Docker (가장 간단)

```bash
docker run --name key-ledger-test \
  -e POSTGRES_PASSWORD=test \
  -p 5433:5432 \
  -d postgres:17

docker exec -it key-ledger-test psql -U postgres
```

### B. Supabase Local CLI (운영과 유사한 환경)

```bash
supabase init
supabase start
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

### C. Neon / 별도 무료 Postgres (격리 프로젝트)

- 운영 프로젝트와 다른, 새로 만든 프로젝트에 연결.

---

## 3. 사전 설정 (setup — apply 실행 전)

아래를 순서대로 실행한다. (파일 `supabase/drafts/PENDING_대표승인_economy_p1_key_ledger_setup.sql` 로 저장해 두는 것을 권장)

```sql
-- 1) pgcrypto 를 extensions 스키마에 설치
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2) 테스트 역할 생성
create role anon;
create role authenticated;
create role service_role;
-- (postgres 는 superuser 라 set role 가능. 명시하려면 아래 주석 해제)
-- grant anon, authenticated, service_role to postgres;

-- 3) auth.uid() mock (RLS 정책이 auth.uid() 를 참조하므로 사전 생성)
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
```

> **중요**: `auth.uid()` mock 을 **apply SQL 실행 전에** 만들어 둔다. RLS 정책의 `using (auth.uid() = user_id)` 가 DDL 시점에 함수 존재를 검사하는 환경도 있기 때문.

---

## 4. 실행 절차

```bash
# 1) setup 실행
psql "postgresql://postgres:test@localhost:5433/postgres" -f PENDING_대표승인_economy_p1_key_ledger_setup.sql

# 2) 적용 SQL 실행 (테이블/함수/권한 생성)
psql "postgresql://postgres:test@localhost:5433/postgres" -f PENDING_대표승인_economy_p1_key_ledger.sql

# 3) 읽기 전용 검증 (객체/권한/잔액 대조 확인)
psql "postgresql://postgres:test@localhost:5433/postgres" -f PENDING_대표승인_economy_p1_key_ledger_verify.sql

# 4) 격리 테스트 실행 (성공 시 출력 없음, 실패 시 ASSERT_FAIL)
psql "postgresql://postgres:test@localhost:5433/postgres" -v ON_ERROR_STOP=0 -f PENDING_대표승인_economy_p1_key_ledger_test.sql
```

### 결과 해석

- 테스트는 `test_assert(조건, 메시지)` 가 실패할 때 `ASSERT_FAIL: <메시지>` 예외를 던진다.
- **성공 = 해당 테스트 구간에서 오류 없음.** 실패 메시지만 grep 하면 된다:

```bash
psql ... -f test.sql 2>&1 | grep -E "ASSERT_FAIL|ERROR"
```

- `ON_ERROR_STOP=0`(기본)으로 두어 한 테스트가 실패해도 나머지가 계속 실행된다.
- 각 테스트는 `begin; … rollback;` 이라 **다음 테스트에 영향 없음**.

---

## 5. 역할·권한 테스트에서 SET ROLE 주의

PL/pgSQL `DO` 블록 **안**에서 `SET ROLE` 을 직접 쓰면 안 된다. 테스트 파일은 `SET LOCAL ROLE` 을 **SQL 문장 레벨(DO 블록 바깥)** 에 둔다:

```sql
begin;
  set local role service_role;   -- SQL 레벨 (정상)
  do $$ ... function calls ... $$;
rollback;                        -- rollback 이 SET LOCAL role 도 원복
```

필요시 PL/pgSQL 안에서 역할 변경할 때는 `perform set_config('role','service_role',true);` 를 사용한다.

### 역할 모델 — TEST FIXTURE 는 postgres 로

Production 권한 모델을 테스트 때문에 약화시키지 않는다. 역할 구분:

- `postgres`(superuser) = **TEST ONLY** 고장 상태(fixture/corruption) 직접 생성 (key_balances 직접 UPDATE/DELETE 등)
- `service_role` = 실제 서버 RPC 실행 권한 모델 검증 (key_charge_revenue / key_grant_reward / key_reverse)
- `authenticated` = 일반 사용자
- `anon` = 비로그인

T21(잔액 캐시 손상)·T25(음수 잔액)는:
1. `service_role` 로 정상 RPC 실행 → 잔액/원장 생성
2. `reset role;`(postgres superuser 복귀) → TEST ONLY 손상 상태 직접 생성
3. `set local role service_role;` → 서버가 `BALANCE_CACHE_CORRUPTED` / `REVERSAL_INSUFFICIENT_BALANCE` 를 정확히 감지하는지 검사

운영 SQL 의 service_role 테이블 권한은 늘리지 않는다.

---

## 6. 동시성 테스트 (T17 / T19 / T23) 수동 병렬 실행

단일 psql 로는 진짜 동시성을 검증할 수 없다. **두 개의 psql 세션**을 열어 아래 패턴으로 실행한다.

### T17 — 같은 원인 동시 지급 (한 번만 성공)

```text
SESSION A:  begin; select pg_sleep(0.2);
            select public.key_charge_revenue('<userA>','<reqA>',100,'toss','order_dup');
            commit;
SESSION B:  begin; select pg_sleep(0.1);
            select public.key_charge_revenue('<userA>','<reqB>',100,'toss','order_dup');
            commit;
```

기대: 한 세션만 성공, 다른 한 세션은 `CAUSE_ALREADY_APPLIED` 또는 `unique_violation`(key_ledger_cause_uniq). 최종 원장에 `order_dup` 행 1개.

### T19 — 동시 과소잔액 차감

전제: userA revenue 잔액 50. 두 세션에서 동시에 `key_spend`(정책 테이블이 있는 테스트 환경에서) 또는 charge 후 reverse 를 60씩 시도 → 한쪽만 성공, 합계가 잔액 초과하지 않음.

### T23 — 동시 over-reversal

원거래 100에 두 세션에서 각 -60 reversal → 한쪽은 `OVER_REVERSAL`.

---

## 7. 테스트–기대결과 매핑표

| # | 테스트명 | 기대 결과 |
|---|---|---|
| T1 | anon 차감 거부 | `insufficient_privilege` |
| T2 | A가 B 잔액 못 읽음 | A 조회 시 본인 행 1개만 |
| T3 | authenticated charge/grant/reverse 거부 | `insufficient_privilege` |
| T4 | 직접 원장/요청 테이블 쓰기 거부 | `insufficient_privilege` |
| T5 | 인증 없이 spend | `UNAUTHORIZED` |
| T6 | 정책 없음 → 차단 | `FEATURE_POLICY_MISSING` |
| T7 | Reward 허용 → Reward만 | reward=30, revenue=0 |
| T8 | 혼합 차감 | reward=100, revenue=20 |
| T9 | Reward 금지 → Revenue만 | reward=0, revenue=50 |
| T10 | Revenue-only 부족 → Reward 대체 금지 | `INSUFFICIENT_REVENUE` |
| T11 | 결제 전용 → 차단 | `PAYMENT_REQUIRED` |
| T12 | 예상비용 불일치 | `COST_MISMATCH` |
| T13 | 재전송 → 원장 추가 0 | result_json 동일, 행 1개 |
| T14 | 같은 요청 다른 payload | `REQUEST_CONFLICT` |
| T15 | 후속거래 후 재전송 | 최초 result_json, balance=100(첫거래 직후) |
| T16 | 같은 원인 다른 request_id | `CAUSE_ALREADY_APPLIED` |
| T17 | 같은 원인 동시 요청 | 한 번만 지급 (병렬) |
| T18 | source_id NULL/빈값 | `INVALID_SOURCE_ID` |
| T19 | 동시 과소잔액 차감 | 과차감 없음 (병렬) |
| T21 | 잔액 캐시 손상 | `BALANCE_CACHE_CORRUPTED` |
| T22 | 부분 reversal 2건 합계 한도 내 | 허용 |
| T23 | over-reversal | `OVER_REVERSAL` (병렬/순차) |
| T24 | 타인 원거래·같은 부호 | `FORBIDDEN` / `INVALID_REVERSAL_DIRECTION` |
| T25 | 취소 후 음수 잔액 | `REVERSAL_INSUFFICIENT_BALANCE` |
| T26 | 정수 범위 초과 | `AMOUNT_OVERFLOW` |
| T27 | 미승인 만료일 지급 | `EXPIRY_POLICY_UNDECIDED` |
| T28 | 원장 SUM = 잔액 캐시 | 일치 |

> T7~T12 는 **격리 환경 전용** `key_feature_policies` + `key_spend_test` 로 분기 로직을 검증한다(운영 SQL 에는 반영 안 됨). T17/T19/T23 은 병렬 세션 필요.
> T21/T25 는 손상 상태를 `postgres`(TEST ONLY) 로 생성하고 감지 검증은 `service_role` 로 수행한다(운영 service_role 테이블 권한 불변).

---

## 8. 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| `function extensions.digest(unknown) does not exist` | pgcrypto 가 `extensions` 스키마에 설치 안 됨 → setup 1단계 확인 |
| `function auth.uid() does not exist` | auth.uid() mock 미생성 → setup 3단계 확인 |
| `role "service_role" does not exist` | 역할 미생성 → setup 2단계 확인 |
| `permission denied to set role` | postgres 가 superuser 아님 / role 미생성 |
| ASSERT_FAIL | 해당 테스트 로직 실패 → 운영 SQL 수정 검토(재현·수정 후 재실행) |

---

## 9. 절대 금지

- 운영 Supabase 프로젝트에 setup/apply/test SQL 실행.
- 실제 JWT/키/데이터를 테스트에 사용.
- 테스트 DB 에서 `DROP TABLE` 후 롤백 대신 사용.
- "로컬에서 실행한 검사 완료" 이상의 표현(예: 전체 버그 없음, 100% 완성)으로 과장 보고.