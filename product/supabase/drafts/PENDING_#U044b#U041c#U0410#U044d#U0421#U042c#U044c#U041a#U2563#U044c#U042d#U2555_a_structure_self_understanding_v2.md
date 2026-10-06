# A구조 자기이해 자산 — 실행 전 최종 초안 (V406 보완)

> 상태: **대표 승인 대기(STOP)**. 이 문서에 포함된 어떤 DDL·RLS·RPC·Edge Function·마이그레이션도 실행하지 않았고, 실행하지 않는다.
> 승인 문구: `V407 SQL·RLS 원문 검수 완료, 실행 승인` 을 받기 전까지 STOP 유지.

---

## 0. 실측 결과 정정 (기존 V403 초안 대비)

이번 실측으로 기존 초안의 **오류 1건과 미확인 2건**이 밝혀졌다. 아래를 근거로 최종 초안을 다시 작성했다.

| # | 항목 | 기존 초안 주장 | 실제 실측 결과 | 판정 |
|---|---|---|---|---|
| 1 | `user_id` FK | "FK 없음(RLS만)" | **모든 테이블이 `user_id → auth.users(id)` FK 보유** (대부분 `ON DELETE CASCADE`, 일부 `SET NULL`) | ❌ 오류 → 정정 |
| 2 | 서버 상태머신 위치 | "RPC 필요" (암시) | 비즈니스 상태머신은 **DB RPC가 아니라 Edge Function**(`echo-journey`, `get-step-question`)에 존재. DB 함수는 트리거(`handle_new_user`, `pa_profiles_role_lock`)·보조(`is_admin`, `openai_rate_limit_allow`)뿐 | ⚠️ 정정 |
| 3 | `is_admin()` 안전성 | 미확인 | `SECURITY DEFINER` + `SET search_path TO 'public'` (**`''` 아님**) | ⚠️ 취약점 보고 |

### 0-1. 실측한 기존 객체 (전수)
- **함수(public)**: `handle_new_user`(trigger, SECDEF, `search_path=public`), `is_admin`(sql, STABLE SECDEF, `search_path=public`), `openai_rate_limit_allow`(plpgsql, SECDEF, `search_path=public`), `pa_profiles_role_lock`(trigger, SECDEF, `search_path=''` ← 유일하게 안전)
- **트리거**: `profiles`의 `pa_profiles_role_lock_insert_trg` / `_update_trg` (BEFORE). `updated_at` 자동갱신 트리거는 **존재하지 않음**(echo-journey가 수동 `now()` 갱신).
- **`reports` 컬럼**: `id(uuid, gen_random_uuid)`, `user_id`, `conversation_id`(UNIQUE), `title`, `summary`, `content(jsonb)`, `model`, `created_at`. **`updated_at` 없음**. RLS는 `reports_select_own`(SELECT만) → 리포트는 service role만 기록.
- **`conversations` 컬럼**: `id`, `user_id`, `status`, `current_step`, `created_at`, `updated_at`, `request_token`, `request_action`.
- **`understanding_results`**: ECHO(B) 이해체크 단계 테이블(`conversation_id → conversations` FK). A구조 자산 테이블 **아님** → 신규 테이블 필요 확정.
- **FK 전수**: `conversations/emotions/messages/payments/profiles/reports/understanding_results/blocks/spaces/user_reports/audit_logs` 모두 `user_id(또는 owner_id 등) → auth.users(id)` FK. `emotions/messages/understanding_results`는 `conversation_id → conversations(id) ON DELETE CASCADE`.

### 0-2. B→A handoff FK 적용 가능 여부
- `doit_records.source_conversation_id → conversations(id)` : **가능** (conversations.id 존재, PK).
- `doit_records.source_report_id → reports(id)` : **가능** (reports.id 존재, PK; reports.conversation_id는 UNIQUE라 대화당 리포트 1건).
- 원문은 `emotions.mind_text`(ECHO 원문)에 남고, A구조는 `source_conversation_id`로 역참조 → **원문 복사 없이 근거 연결 가능**.

### 0-3. 서버 상태머신 구현 방식 결정
- 기존 정본은 **Edge Function**(Deno)이 상태머신·멱등(`request_token` 선점/commit)·LLM 후보 생성을 전담한다. DB plpgsql RPC는 비즈니스에 쓰이지 않는다.
- A구조도 **LLM 후보 생성(가치/패턴/선택 기억) + 거절 의미 재사용 차단**이 필요하므로 plpgsql로는 부적합. → **Edge Function `doit-understanding`** 채택 (echo-journey 패턴과 동일). 신규 DB RPC는 만들지 않는다(트리거 `set_doit_updated_at`만 신설).

---

## 1. 사전 충돌 검사 SQL (읽기 전용)

```sql
-- 실행 전 충돌 검사 (DDL 없음, 조회만)
select
  to_regclass('public.doit_records')  is not null as doit_records_exists,
  to_regclass('public.doit_insights') is not null as doit_insights_exists;

-- 신규 함수/트리거 이름 충돌
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_doit_updated_at');

select trg.tgname as trigger_name, tbl.relname as table_name
from pg_trigger trg
join pg_class tbl on tbl.oid = trg.tgrelid
join pg_namespace n on n.oid = tbl.relnamespace
where n.nspname = 'public'
  and trg.tgname in ('doit_records_updated_at_trg','doit_insights_updated_at_trg');
```

> 모두 비어있어야(또는 `false`) 안전. 하나라도 존재하면 즉시 중단.

---

## 2. 테이블·인덱스·제약조건 SQL

- 변경 대상: 신규 테이블 2(`doit_records`, `doit_insights`) + 신규 트리거 함수 1(`set_doit_updated_at`) + 트리거 2.
- 기존 구조 영향: 기존 테이블·정책·함수·트리거·스토리지·결제·인증 **변경 0**.
- 보안 영향: `user_id → auth.users(id) ON DELETE CASCADE` (기존 패턴과 동일, 탈퇴 시 개인정보 연쇄 삭제). `source_*`는 `ON DELETE SET NULL`(근거 원본 삭제돼도 A기록 유지).
- 실패 조건: 이름 충돌 시 `raise exception`으로 전체 롤백.
- 복구 방법: §6의 전체 복구 SQL.

```sql
begin;

do $$
begin
  if to_regclass('public.doit_records') is not null then
    raise exception '충돌: public.doit_records 이미 존재';
  end if;
  if to_regclass('public.doit_insights') is not null then
    raise exception '충돌: public.doit_insights 이미 존재';
  end if;
end $$;

-- ① 첫 자기이해 기록
create table public.doit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_conversation_id uuid null references public.conversations(id) on delete set null,
  source_report_id uuid null references public.reports(id) on delete set null,
  original_text text not null,
  text text not null,
  emotion text not null default '',
  status text not null default 'confirmed',
  revision integer not null default 1,
  request_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doit_records_status_check check (status in ('confirmed','corrected','rejected')),
  constraint doit_records_original_not_empty check (char_length(btrim(original_text)) > 0),
  constraint doit_records_text_not_empty check (char_length(btrim(text)) > 0),
  constraint doit_records_request_id_key unique (user_id, request_id)
);

create index doit_records_user_created_idx on public.doit_records (user_id, created_at desc);
create index doit_records_source_conversation_idx on public.doit_records (source_conversation_id) where source_conversation_id is not null;
create index doit_records_source_report_idx on public.doit_records (source_report_id) where source_report_id is not null;

-- ② 가치·패턴·선택 기억(이해 항목)
create table public.doit_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  text text not null,
  ai_text text null,
  source_record_id uuid null references public.doit_records(id) on delete set null,
  source_text text null,
  status text not null default 'candidate',
  origin text not null default 'ai',
  revision integer not null default 1,
  request_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doit_insights_category_check check (category in ('value','pattern','memory')),
  constraint doit_insights_status_check check (status in ('candidate','confirmed','corrected','rejected')),
  constraint doit_insights_origin_check check (origin in ('ai','self')),
  constraint doit_insights_text_not_empty check (char_length(btrim(text)) > 0),
  constraint doit_insights_request_id_key unique (user_id, request_id)
);

create index doit_insights_user_created_idx on public.doit_insights (user_id, created_at desc);
create index doit_insights_user_category_idx on public.doit_insights (user_id, category);
create index doit_insights_user_status_idx on public.doit_insights (user_id, status);
create index doit_insights_source_record_idx on public.doit_insights (source_record_id) where source_record_id is not null;

-- ③ updated_at 실제 갱신 (트리거)
create or replace function public.set_doit_updated_at()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger doit_records_updated_at_trg
  before update on public.doit_records
  for each row execute function public.set_doit_updated_at();

create trigger doit_insights_updated_at_trg
  before update on public.doit_insights
  for each row execute function public.set_doit_updated_at();

commit;
```

### 2-1. 무결성 요구 충족표
| 요구 | 구현 |
|---|---|
| UUID 기본값 | `default gen_random_uuid()` |
| created_at 기본값 | `default now()` |
| updated_at 실제 갱신 | `set_doit_updated_at()` 트리거 (BEFORE UPDATE) |
| status CHECK | `doit_records_status_check` / `doit_insights_status_check` |
| category CHECK | `doit_insights_category_check` |
| origin CHECK | `doit_insights_origin_check` |
| 빈 문자열 방지 | `char_length(btrim(...)) > 0` |
| user_id NOT NULL | `not null` + FK |
| source_record_id 소유자 일치 | Edge Function에서 검증(§4) + 필요시 방어 트리거(선택) |
| 인덱스 | user_id+created_at, category, status, source_* |
| 멱등 키 | `(user_id, request_id)` UNIQUE |
| 동시 수정 방지 | `revision` 정수 + `expectedRevision` 비교(§4) |
| anon/PUBLIC 차단 | §3 REVOKE |
| authenticated 직접 쓰기 차단 | §3 (SELECT만 GRANT) |
| is_admin search_path | §0-3 기존 취약점 보고(이번 STOP에서 미수정) |
| 충돌 시 즉시 중단 | `do` 가드 블록 + 단일 트랜잭션 |
| 부분 실패 롤백 | 전체를 하나의 `begin ... commit`으로 |

---

## 3. RLS·REVOKE·GRANT SQL

- 변경 대상: 신규 테이블 2개에 RLS/권한 부여.
- 기존 구조 영향: 기존 정책·권한 **변경 0**.
- 보안 영향: anon·PUBLIC 모든 권한 차단, authenticated는 SELECT(자기 것)만, 쓰기는 service role(Edge Function) 전용. DELETE 정책 **없음** → rejected 영구 보존.
- 실패 조건: 정책명 충돌 시 롤백.
- 복구: §6.

```sql
begin;

alter table public.doit_records  enable row level security;
alter table public.doit_insights enable row level security;

-- anon / authenticated / public 모든 권한 회수
revoke all on public.doit_records  from public, anon, authenticated;
revoke all on public.doit_insights from public, anon, authenticated;

-- authenticated 에게 SELECT(자기 것)만 허용
grant select on public.doit_records  to authenticated;
grant select on public.doit_insights to authenticated;

-- 사용자: 자기 데이터 SELECT만
create policy doit_records_select_own
  on public.doit_records
  for select to authenticated
  using (auth.uid() = user_id);

create policy doit_insights_select_own
  on public.doit_insights
  for select to authenticated
  using (auth.uid() = user_id);

-- 관리자: SELECT만(읽기 전용). UPDATE/DELETE/INSERT 없음
create policy doit_records_select_admin
  on public.doit_records
  for select to authenticated
  using (is_admin());

create policy doit_insights_select_admin
  on public.doit_insights
  for select to authenticated
  using (is_admin());

-- 의도적으로 INSERT/UPDATE/DELETE 정책 미생성 → 직접 쓰기 전면 차단
-- (사용자 DELETE 정책 없음 → rejected 삭제 불가)

commit;
```

> 계정 탈퇴에 따른 개인정보 삭제는 `user_id → auth.users(id) ON DELETE CASCADE`가 담당한다. 일반 DELETE 정책으로 처리하지 않으며, 별도 관리자 승인 절차와 분리됨(추가 필요 시 별도 초안으로 제출).

---

## 4. RPC 또는 서버 함수 (Edge Function `doit-understanding`)

- 변경 대상: **신규 Edge Function 1개** (`supabase/drafts/PENDING_대표승인_doit_understanding/index.ts`, 초안).
- 기존 구조 영향: 기존 Edge Function(`echo-journey` 등) 변경 0. 신규 DB RPC 0.
- 보안 영향: `getUser()` 실검증 + `auth.uid()` 소유권 + service role 쓰기(RLS 우회는 서버만) + revision 낙관 잠금 + request_id 멱등.
- 실패 조건: 인증 실패→UNAUTHORIZED, 소유권 불일치→FORBIDDEN, 잘못된 전이→INVALID_STATE, revision 불일치→STALE_REVISION, 중복 request_id→DUPLICATE_REQUEST(멱등 반환).
- 복구: 함수 미배포 상태(초안)이므로 복구 불필요. 배포는 승인 후.

**10개 필수 동작 → action 매핑:**

| # | 필수 동작 | action | 결과 |
|---|---|---|---|
| 1 | 첫 기록 생성 | `record_create` | doit_records INSERT (idempotent) |
| 2 | 자기 기록 조회 | `record_list` | doit_records SELECT(own) |
| 3 | AI 후보 저장 | `insight_generate` | LLM 후보 → doit_insights INSERT(candidate) |
| 4 | 맞아요 처리 | `insight_confirm` | candidate → confirmed |
| 5 | 조금 달라요 처리 | `insight_correct` | candidate → corrected(+수정문) |
| 6 | 그게 아니에요 처리 | `insight_reject` | candidate → rejected(보존) |
| 7 | 직접 설명 처리 | `insight_self` | origin=self INSERT(confirmed) |
| 8 | 가치·패턴·선택 기억 조회 | `insight_list` | doit_insights SELECT(own, category 필터) |
| 9 | 거절 의미 재사용 차단 | (generate 내부) | rejected 텍스트·키 유사도 차단 |
| 10 | 동일 요청 중복 저장 방지 | (전 action) | (user_id, request_id) UNIQUE 멱등 |
| + | B→A handoff | `handoff` | §8 |

**고정 오류 코드:** `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `INVALID_STATE`, `STALE_REVISION`, `DUPLICATE_REQUEST`, `NO_CANDIDATE`, `AI_NOT_CONFIGURED`, `AI_ERROR`, `ERROR`.

**상태 전이 규칙(서버만 결정):**
- `record`: `confirmed → corrected`(수정) / `confirmed → rejected`(거절). `rejected → confirmed` 금지(재사용 차단).
- `insight`: `candidate → {confirmed, corrected, rejected}`. `confirmed → corrected` 허용. `rejected → confirmed` 금지. `origin=self`는 생성 시 `confirmed`(사용자 직접 설명 우선).

전체 TypeScript 초안은 `supabase/drafts/PENDING_대표승인_doit_understanding/index.ts` 참조. 핵심 보안 계약만 여기 적는다.

```typescript
// 핵심 계약 (요약)
// 1) 모든 요청: sb.auth.getUser() → 없으면 UNAUTHORIZED(401)
// 2) 읽기: 사용자 범위 클라이언트(Authorization: 사용자 JWT) → RLS가 소유권 이중 보장
// 3) 쓰기: service role 클라이언트(BYPASSRLS) + 반드시 user_id = auth.uid() 필터
// 4) 멱등: (user_id, request_id) UNIQUE. 기존 row 있으면 DUPLICATE_REQUEST(완료 결과 반환)
// 5) 낙관 잠금: update ... where id = X and revision = :expectedRevision
//    → 0 row면 STALE_REVISION
// 6) 상태 전이: 서버 화이트리스트 검사. 위반 시 INVALID_STATE
// 7) 거절 차단: rejected insight의 text·ai_text·의미키를 bigram/overlap으로 비교
// 8) 프론트는 완료 상태를 만들 수 없음(INSERT/UPDATE 권한 자체가 없음)
```

---

## 5. 로컬 검사용 SQL (승인·실행 후 검증)

- 변경 대상: 없음(검증 쿼리).
- 기존 구조 영향: 없음(읽기 전용).
- 보안 영향: 없음.
- 실패 조건: 기대값과 불일치 시 재점검.
- 복구: 해당 없음.

```sql
-- 1) RLS 활성화 확인
select relname, relrowsecurity from pg_class
where oid in ('public.doit_records'::regclass, 'public.doit_insights'::regclass);

-- 2) 정책 확인 (SELECT only, DELETE 없음)
select tablename, policyname, cmd from pg_policies
where schemaname='public' and tablename in ('doit_records','doit_insights')
order by tablename, cmd;

-- 3) 권한 확인 (authenticated=SELECT만, anon 없음)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('doit_records','doit_insights')
order by grantee, table_name, privilege_type;

-- 4) CHECK 제약 확인
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid in ('public.doit_records'::regclass,'public.doit_insights'::regclass)
  and contype='c' order by conname;

-- 5) FK 확인
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid in ('public.doit_records'::regclass,'public.doit_insights'::regclass)
  and contype='f' order by conname;

-- 6) updated_at 트리거 확인
select event_object_table, trigger_name from information_schema.triggers
where trigger_schema='public'
  and event_object_table in ('doit_records','doit_insights');
```

---

## 6. 전체 복구 SQL

- 변경 대상: 신규 객체 전부.
- 기존 구조 영향: 기존 13개 테이블·정책·함수 무영향(신규 객체만 drop).
- 보안 영향: 없음.
- 실패 조건: drop 순서 의존(FK 가진 insights 먼저 → records → 함수/트리거).
- 복구 방법: 이 SQL 실행이 곧 복구.

```sql
begin;
drop trigger if exists doit_insights_updated_at_trg on public.doit_insights;
drop trigger if exists doit_records_updated_at_trg  on public.doit_records;
drop function if exists public.set_doit_updated_at();
drop table if exists public.doit_insights;
drop table if exists public.doit_records;
commit;
```

---

## 7. 프론트 연결 계약

> DB 승인 전까지 `useUnderstanding.tsx`를 실제 DB 구조로 **교체하지 않는다**. 지금은 계약(타입·인터페이스·상태·플래그·마이그레이션 계획)만 준비한다.

### 7-1. 타입 정의 (테이블과 1:1)
```typescript
export type RecordStatus = "confirmed" | "corrected" | "rejected";
export type InsightStatus = "candidate" | "confirmed" | "corrected" | "rejected";
export type Category = "value" | "pattern" | "memory";
export type Origin = "ai" | "self";

export interface DoitRecord {
  id: string;
  sourceConversationId: string | null;
  sourceReportId: string | null;
  originalText: string;
  text: string;
  emotion: string;
  status: RecordStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DoitInsight {
  id: string;
  category: Category;
  text: string;
  aiText: string | null;
  sourceRecordId: string | null;
  sourceText: string | null;
  status: InsightStatus;
  origin: Origin;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

### 7-2. RPC 클라이언트 인터페이스 (Edge Function 호출)
```typescript
interface DoitApi {
  recordCreate(input: { text: string; emotion: string; requestId: string }): Promise<Result<DoitRecord>>;
  recordList(): Promise<Result<DoitRecord[]>>;
  insightGenerate(input: { recordId: string; requestId: string }): Promise<Result<DoitInsight[]>>;
  insightConfirm(input: { id: string; expectedRevision: number; requestId: string }): Promise<Result<DoitInsight>>;
  insightCorrect(input: { id: string; text: string; expectedRevision: number; requestId: string }): Promise<Result<DoitInsight>>;
  insightReject(input: { id: string; expectedRevision: number; requestId: string }): Promise<Result<DoitInsight>>;
  insightSelf(input: { category: Category; text: string; recordId: string; requestId: string }): Promise<Result<DoitInsight>>;
  insightList(input?: { category?: Category }): Promise<Result<DoitInsight[]>>;
}
// Result<ok, data?, code?, error?> — code는 §4 고정 코드와 1:1
```

### 7-3. 로딩·오류·재시도
- 모든 호출은 `try/catch/finally` + `loading` 플래그. 실패 시 `error` 문자열(렌더링 가능) + `retry()` 노출. 무한 스피너 금지.

### 7-4. 미로그인 처리
- `auth.getSession()` 결과 없으면 A구조 데이터 화면은 `/login`(returnPath 보존)으로 안내. 로컬 데이터를 서버 데이터로 위장하지 않음.

### 7-5. 서버 미적용 기능 플래그
```typescript
export const A_STRUCTURE_SERVER_ENABLED = false; // DB·Edge Function 승인·배포 전까지 false
```
- `false` 동안은 기존 localStorage 경로 유지(읽기 전용). `true`로 바꾸는 시점은 승인·배포 후.

### 7-6. localStorage 읽기 전용 마이그레이션 계획
- **지금**: `doit:understanding:v1` 키를 읽기만 한다. 삭제·덮어쓰기 금지.
- **승인·배포 후**: 일회성 마이그레이션(서버 action 또는 관리 도구)으로 localStorage → 서버 업로드. 이때 `request_id`를 새로 발급하고 `source_*`는 null. 기존 키는 마이그레이션 성공 확인 후에만 백업·제거. 사용자 데이터 유실 0.

---

## 8. B→A handoff 계약

### 8-1. 최종 방식
1. **트리거**: 사용자가 리포트 화면에서 `DO IT으로 이어가기`(showDoitDoor)를 직접 누를 때만.
2. **서버 검증**(`doit-understanding`의 `handoff` action): `getUser()` → `conversation_id`가 현재 사용자 소유인지(`conversations.user_id = auth.uid()`) → 해당 `report_id`가 존재하고 소유인지(`reports.user_id = auth.uid()`) 확인. 불일치 시 `FORBIDDEN`.
3. **원문 비복사**: `doit_records`에 `source_conversation_id` + `source_report_id`만 기록. 원문 전체(`emotions.mind_text`)는 복사하지 않는다. `original_text`/`text`는 리포트 `title`(짧은 라벨)로 채운다(전문 복사 아님).
4. **자동 전환 금지**: `handoff`는 서버에 근거 링크를 남길 뿐, 화면 이동은 하지 않는다. 이후 이동은 기존 사용자 선택 흐름(`/do-it/intro` → ...)을 따른다.
5. **복구**: 새로고침·다른 기기에서 `source_conversation_id`/`source_report_id`로 서버에서 재조회 가능. sessionStorage 의존 제거.
6. **접근 차단**: 다른 사용자 데이터 접근 불가(RLS + service role 소유권 필터 이중).
7. **ECHO만 사용자**: `handoff`를 부르지 않으면(버튼 미노출 + mode=echo) A 데이터 미생성. 추가로 `handoff` action은 `mode`는 보지 않지만, 버튼이 `both`에서만 노출되므로 사실상 차단.

### 8-2. 변경 대상
- `src/lib/echo/storyHandoff.ts`(sessionStorage 전달)는 **DB 승인 후** 서버 handoff 호출로 교체. 지금은 수정하지 않는다.
- `doit_records.source_conversation_id` / `source_report_id` 컬럼(§2).

### 8-3. 임의 컬럼명 미확정
- `conversations`/`reports`의 기존 컬럼명은 그대로 사용(`id`, `user_id`, `conversation_id`). 신규 FK 대상 컬럼명은 위 `source_*`로 확정하되, 대표 검수 시 변경 가능(§0-2에서 실측한 실제 컬럼 기준).

---

## 9. 검사 기준 자체 평가 (실행 전 초안 기준)

| 검사 | 판정 | 근거 |
|---|---|---|
| SQL 문법 | ⚠️ 확인 불가(실행 전) | 초안 문법 검토 완료 |
| 기존 객체 충돌 | ✅ 충돌 0 | §1 실측: `doit_records`/`doit_insights`/`set_doit_updated_at` 없음 |
| anon 접근 0 | ✅ 초안 기준 | §3 REVOKE all from anon/public |
| 다른 사용자 SELECT/INSERT/UPDATE/DELETE 0 | ✅ 초안 기준 | RLS `auth.uid()=user_id` + service role 소유권 필터 |
| 사용자 테이블 직접 쓰기 0 | ✅ 초안 기준 | INSERT/UPDATE/DELETE 정책·GRANT 없음 |
| 관리자 SELECT 가능 | ✅ 초안 기준 | `is_admin()` SELECT 정책 |
| 관리자 임의 수정·삭제 0 | ✅ 초안 기준 | UPDATE/DELETE 정책 없음 |
| rejected 삭제 불가 | ✅ 초안 기준 | DELETE 정책 없음 |
| 중복 request_id 중복 반영 불가 | ✅ 초안 기준 | `(user_id, request_id)` UNIQUE |
| 잘못된 revision 반영 불가 | ✅ 초안 기준 | `where revision=:expectedRevision` |
| B→A 소유권 위조 불가 | ✅ 초안 기준 | getUser + 소유권 검증 + FK |
| ECHO만 A 데이터 생성 불가 | ✅ 초안 기준 | 버튼 both 전용 + handoff 검증 |

> **실행하지 않은 검사(타입·린트·RLS 실제 시뮬레이션·모바일 실기기)는 "통과"가 아니라 "확인 불가"로 남긴다.** 위 표의 "✅ 초안 기준"은 SQL/RPC 계약을 정적으로 검토한 결과이며, 실제 DDL 실행 후 검증(§5)이 필요하다.

---

## 10. STOP 확인

- DDL 실행 0, RLS 실행 0, RPC 생성 0, 마이그레이션 실행 0, Edge Function 배포 0, 결제 변경 0, 파일 삭제 0, 운영 배포 0.
- `useUnderstanding.tsx`는 여전히 localStorage 임시 기록이며, **어떤 DB 교체도 하지 않았다.**
- 대표 승인 문구 `V407 SQL·RLS 원문 검수 완료, 실행 승인` 수신 전까지 STOP 유지.