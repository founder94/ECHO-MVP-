# A구조 자기이해 자산 — V408 실행 전 최종본

> 상태: **Codex 검수 대기(STOP)**. 이 문서에 포함된 어떤 DDL·RLS·트리거·Edge Function·마이그레이션도 실행하지 않았고, 실행하지 않는다.
> 실행 조건: `V407 SQL·RLS 원문 검수 완료, 실행 승인` 이후, 별도로 `V408 원문 검수 완료, 실행 승인` 문구를 받기 전까지 STOP 유지.

---

## V408 2차 정정 (V408-2)

| # | 지적 | 조치 |
|---|---|---|
| 1 | `source_record_id` NULL 허용 ↔ `MATCH FULL` 모순 | `match full` → `match simple` |
| 2 | handoff가 동일 소유의 서로 다른 대화·리포트 연결 가능 | 검증 트리거에 `reports.conversation_id = source_conversation_id` 일치 검사 추가 |
| 3 | `ON DELETE SET NULL` ↔ `has_source` CHECK 충돌 | 두 source FK `set null` → `cascade`(원본 삭제 시 handoff 삭제) |
| 4 | 함수 덮어쓰기 위험 | `create or replace` → `create function`(동명 함수 시 전체 롤백) |

---

## 0. V407 → V408 변경 요약

| # | V407 문제 | V408 조치 |
|---|---|---|
| 1 | 테이블 생성/RLS/GRANT 분리 실행 | **단일 트랜잭션 원자 실행**(가드+테이블+제약+인덱스+트리거+RLS+REVOKE+GRANT 전부) |
| 2 | `source_record_id` 소유권 서버검사만 | **복합 FK** `(source_record_id,user_id)→doit_records(id,user_id)` |
| 2 | `source_conversation_id/report_id` 소유권 서버검사만 | **검증 트리거** `doit_handoffs_owner_check` (SECDEF, `search_path=''`, `public.` 완전 표기) |
| 3 | 리포트 `title`을 `original_text`로 저장(원문 훼손) | **`doit_handoffs` 기술 테이블 분리**, `original_text`는 사용자 직접 입력만 |
| 4 | `request_id` UNIQUE만으로 UPDATE 재시도 미차단 | **`doit_request_events`** 이벤트 테이블 + action/payload 해시 비교 |
| 5 | revision 컬럼만 생성 | Edge Function **조건부 갱신**(`where revision=expected`) 실구현 |
| 6 | `is_admin()`(search_path='public') 재사용 | **관리자 직접 SELECT 정책 미생성**, `admin_read` action(서버 `role='admin'`) |
| 7 | 글자 겹침만으로 '같은 뜻' 차단 보고 | bigram(1단계) + **LLM 의미 판정(2단계)** 이중 + 한계·10+ 검사례 보고 |

---

## 1) 단일 사전검사 SQL (읽기 전용, DDL 없음)

```sql
-- 충돌 검사: 4개 테이블 + 3개 함수/트리거. 모두 비어야 안전.
select
  to_regclass('public.doit_records')        is not null as doit_records_exists,
  to_regclass('public.doit_insights')       is not null as doit_insights_exists,
  to_regclass('public.doit_handoffs')       is not null as doit_handoffs_exists,
  to_regclass('public.doit_request_events') is not null as doit_request_events_exists;

select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_doit_updated_at','doit_handoffs_owner_check');

select trg.tgname, tbl.relname
from pg_trigger trg join pg_class tbl on tbl.oid = trg.tgrelid
where trg.tgname in (
  'doit_records_updated_at_trg','doit_insights_updated_at_trg',
  'doit_request_events_updated_at_trg','doit_handoffs_owner_trg');
```

> 전부 `false` / 0건이어야 한다. 하나라도 존재하면 즉시 중단.

---

## 2) 단일 적용 SQL (원자적, 하나의 트랜잭션)

**변경 대상**: 신규 테이블 4 + 신규 함수 2(`set_doit_updated_at`, `doit_handoffs_owner_check`) + 트리거 4 + RLS/권한.
**기존 구조 영향**: 기존 테이블·정책·함수·트리거 **변경 0** (신규 객체만 생성). `conversations`/`reports`는 참조만 하고 변경하지 않음.
**보안 영향**: anon/PUBLIC/authenticated 직접 쓰기 0. service_role(Edge Function)만 쓰기. 관리자 직접 SELECT 정책 0.
**실패 조건**: 한 항목이라도 실패 시 `begin` 블록 전체가 롤백 → "테이블만 생성되고 RLS가 빠진 상태"가 남지 않음.

```sql
begin;

-- 가드: 이름 충돌 시 즉시 예외 → 전체 롤백
do $$
begin
  if to_regclass('public.doit_records') is not null then raise exception '충돌: doit_records'; end if;
  if to_regclass('public.doit_insights') is not null then raise exception '충돌: doit_insights'; end if;
  if to_regclass('public.doit_handoffs') is not null then raise exception '충돌: doit_handoffs'; end if;
  if to_regclass('public.doit_request_events') is not null then raise exception '충돌: doit_request_events'; end if;
end $$;

-- ── ① doit_records: 첫 자기이해 기록 ──
create table public.doit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  constraint doit_records_request_id_key unique (user_id, request_id),
  constraint doit_records_id_user_uniq unique (id, user_id)
);
create index doit_records_user_created_idx on public.doit_records (user_id, created_at desc);

-- ── ② doit_insights: 가치·패턴·선택 기억(이해 항목) ──
create table public.doit_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  text text not null,
  ai_text text null,
  source_record_id uuid null,
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
  -- 복합 FK: source_record_id는 반드시 같은 user_id의 기록만 참조
  constraint doit_insights_source_record_fk
    foreign key (source_record_id, user_id)
    references public.doit_records (id, user_id) match simple on delete cascade
);
create index doit_insights_user_created_idx on public.doit_insights (user_id, created_at desc);
create index doit_insights_user_category_idx on public.doit_insights (user_id, category);
create index doit_insights_user_status_idx on public.doit_insights (user_id, status);
create index doit_insights_source_record_idx on public.doit_insights (source_record_id) where source_record_id is not null;
create index doit_insights_request_id_idx on public.doit_insights (user_id, request_id) where request_id is not null;

-- ── ③ doit_handoffs: B→A 기술 연결(원문 비복사) ──
create table public.doit_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_conversation_id uuid null references public.conversations(id) on delete cascade,
  source_report_id uuid null references public.reports(id) on delete cascade,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint doit_handoffs_request_id_key unique (user_id, request_id),
  constraint doit_handoffs_has_source check (source_conversation_id is not null or source_report_id is not null)
);
create index doit_handoffs_user_created_idx on public.doit_handoffs (user_id, created_at desc);
create index doit_handoffs_source_conversation_idx on public.doit_handoffs (source_conversation_id) where source_conversation_id is not null;
create index doit_handoffs_source_report_idx on public.doit_handoffs (source_report_id) where source_report_id is not null;

-- ── ④ doit_request_events: 멱등·감사 기술 테이블 ──
create table public.doit_request_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  target_id uuid null,
  payload_hash text not null default '',
  status text not null default 'pending',
  prev_revision integer null,
  applied_revision integer null,
  error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doit_request_events_status_check check (status in ('pending','applied','failed')),
  constraint doit_request_events_action_not_empty check (char_length(btrim(action)) > 0),
  constraint doit_request_events_user_request_uniq unique (user_id, request_id)
);
create index doit_request_events_user_created_idx on public.doit_request_events (user_id, created_at desc);

-- ── ⑤ updated_at 실제 갱신 트리거 ──
create function public.set_doit_updated_at()
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

create trigger doit_records_updated_at_trg before update on public.doit_records for each row execute function public.set_doit_updated_at();
create trigger doit_insights_updated_at_trg before update on public.doit_insights for each row execute function public.set_doit_updated_at();
create trigger doit_request_events_updated_at_trg before update on public.doit_request_events for each row execute function public.set_doit_updated_at();

-- ── ⑥ 검증 트리거: handoff 소유권 (SECURITY DEFINER, search_path='') ──
create function public.doit_handoffs_owner_check()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_owner uuid;
  v_report_conversation_id uuid;
begin
  if new.source_conversation_id is not null then
    select user_id into v_owner from public.conversations where id = new.source_conversation_id;
    if v_owner is distinct from new.user_id then
      raise exception '소유권 위반: source_conversation_id';
    end if;
  end if;
  if new.source_report_id is not null then
    select user_id, conversation_id into v_owner, v_report_conversation_id
      from public.reports where id = new.source_report_id;
    if v_owner is distinct from new.user_id then
      raise exception '소유권 위반: source_report_id';
    end if;
    if new.source_conversation_id is not null
       and v_report_conversation_id is distinct from new.source_conversation_id then
      raise exception '연결 불일치: 리포트 conversation_id와 source_conversation_id가 다름';
    end if;
  end if;
  return new;
end;
$$;

create trigger doit_handoffs_owner_trg before insert or update on public.doit_handoffs for each row execute function public.doit_handoffs_owner_check();

-- ── ⑦ RLS 활성화 + 권한 회수 + SELECT 정책 + 서버 전용 권한 ──
alter table public.doit_records enable row level security;
alter table public.doit_insights enable row level security;
alter table public.doit_handoffs enable row level security;
alter table public.doit_request_events enable row level security;

revoke all on public.doit_records from public, anon, authenticated;
revoke all on public.doit_insights from public, anon, authenticated;
revoke all on public.doit_handoffs from public, anon, authenticated;
revoke all on public.doit_request_events from public, anon, authenticated;

-- authenticated: 자기 데이터 SELECT만 (records, insights)
grant select on public.doit_records to authenticated;
grant select on public.doit_insights to authenticated;

create policy doit_records_select_own on public.doit_records for select to authenticated using (auth.uid() = user_id);
create policy doit_insights_select_own on public.doit_insights for select to authenticated using (auth.uid() = user_id);

-- handoffs / request_events: authenticated 에게 SELECT 조차 없음(서버 전용)
-- 관리자 직접 SELECT 정책 미생성(요구 6). INSERT/UPDATE/DELETE 정책 전면 미생성.

-- 서버 전용 권한(service_role = Edge Function 쓰기 전용, RLS 우회)
grant select, insert, update, delete on public.doit_records to service_role;
grant select, insert, update, delete on public.doit_insights to service_role;
grant select, insert, update, delete on public.doit_handoffs to service_role;
grant select, insert, update, delete on public.doit_request_events to service_role;

-- 트리거 함수 PUBLIC/anon 실행 권한 회수
revoke all on function public.set_doit_updated_at() from public, anon;
revoke all on function public.doit_handoffs_owner_check() from public, anon;

commit;
```

### 무결성 요구 충족표
| 요구 | 구현 |
|---|---|
| UUID 기본값 | `default gen_random_uuid()` |
| created_at 기본값 | `default now()` |
| updated_at 실제 갱신 | `set_doit_updated_at()` (BEFORE UPDATE) |
| status/category/origin CHECK | 각 `*_check` 제약 |
| 빈 문자열 방지 | `char_length(btrim(...)) > 0` |
| user_id NOT NULL | `not null` + FK |
| source_record_id 소유자 일치 | **복합 FK** `(source_record_id,user_id)→doit_records(id,user_id)` |
| source_conv/report 소유자 + 대화↔리포트 일치 | **검증 트리거** `doit_handoffs_owner_check` |
| 인덱스 | user_id+created_at, category, status, source_*, request_id |
| 멱등 키 | `doit_request_events(user_id,request_id)` UNIQUE + `doit_records/doit_handoffs` UNIQUE |
| 동시 수정 방지 | `revision` + `where revision=expected` |
| anon/PUBLIC 차단 | `revoke all from public, anon` |
| authenticated 직접 쓰기 차단 | INSERT/UPDATE/DELETE 정책·GRANT 없음 |
| 충돌 시 중단 / 부분 실패 롤백 | 단일 `begin…commit` + `do` 가드 |

---

## 3) 전체 복구 SQL

**변경 대상**: 신규 객체 전부(함수/트리거/테이블).
**기존 구조 영향**: 기존 테이블·정책·함수 무영향(신규 객체만 drop). `conversations`/`reports`에 걸린 신규 FK는 신규 테이블이 삭제되며 같이 사라짐.
**복구 순서**: 트리거 → 함수 → 테이블(FK 의존: insights/events/handoffs → records). `doit_insights`가 `doit_records`를 복합 FK로 참조하므로 records를 가장 마지막에 drop.

```sql
begin;
drop trigger if exists doit_request_events_updated_at_trg on public.doit_request_events;
drop trigger if exists doit_insights_updated_at_trg on public.doit_insights;
drop trigger if exists doit_records_updated_at_trg on public.doit_records;
drop trigger if exists doit_handoffs_owner_trg on public.doit_handoffs;
drop function if exists public.doit_handoffs_owner_check();
drop function if exists public.set_doit_updated_at();
drop table if exists public.doit_request_events;
drop table if exists public.doit_insights;
drop table if exists public.doit_handoffs;
drop table if exists public.doit_records;
commit;
```

---

## 4) 적용 후 권한 검사 SQL

```sql
-- RLS 활성화
select relname, relrowsecurity from pg_class
where oid in ('public.doit_records'::regclass,'public.doit_insights'::regclass,
              'public.doit_handoffs'::regclass,'public.doit_request_events'::regclass);

-- 정책 (SELECT만, INSERT/UPDATE/DELETE 없음)
select tablename, policyname, cmd from pg_policies
where schemaname='public' and tablename in ('doit_records','doit_insights','doit_handoffs','doit_request_events')
order by tablename, cmd;

-- 권한 (authenticated: records/insights SELECT만, handoffs/events 없음)
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('doit_records','doit_insights','doit_handoffs','doit_request_events')
order by grantee, table_name, privilege_type;

-- 복합 FK / CHECK 확인
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid in ('public.doit_records'::regclass,'public.doit_insights'::regclass)
  and contype in ('f','c') order by conname;

-- 트리거 확인
select event_object_table, trigger_name from information_schema.triggers
where trigger_schema='public' and event_object_table like 'doit_%';
```

---

## 5) 다른 사용자 접근 차단 시험 (실행 후 수동)

| # | 시험 | 예상 결과 |
|---|---|---|
| 1 | 사용자 B가 A의 `doit_records`를 SELECT | RLS → 0건 |
| 2 | B가 A의 `doit_insights`를 SELECT | RLS → 0건 |
| 3 | B가 A의 `doit_records`에 INSERT/UPDATE/DELETE | 권한 없음(서비스 롤 제외) |
| 4 | service role로 A 기록에 `source_record_id` = B 기록 삽입 | **복합 FK 위반** → 23503 실패 |
| 5 | service role로 handoff에 `source_conversation_id` = B 대화 삽입 | **검증 트리거 예외** → 실패 |
| 6 | service role로 handoff에 `source_report_id` = B 리포트 삽입 | **검증 트리거 예외** → 실패 |

---

## 6) 중복 요청 시험 (실행 후 수동)

| # | 시험 | 예상 결과 |
|---|---|---|
| 1 | 동일 `request_id`+동일 action+payload 재요청 | 이전 결과 재반환(`duplicate:true`) |
| 2 | 동일 `request_id`+다른 action | `REQUEST_CONFLICT` |
| 3 | 동일 `request_id`+같은 action+다른 본문 | `REQUEST_CONFLICT` |
| 4 | 처리 중 동일 요청 재진입 | `IN_FLIGHT`(재시도 가능) |
| 5 | 실패(`failed`) 후 재요청 | 재시도 허용(`pending` 재선점) |

---

## 7) revision 충돌 시험 (실행 후 수동)

| # | 시험 | 예상 결과 |
|---|---|---|
| 1 | `expectedRevision` = 현재 revision | 갱신 성공, `revision+1` |
| 2 | `expectedRevision` ≠ 현재 revision | 0건 갱신 → `STALE_REVISION` |
| 3 | STALE 후 프론트 재조회 → 최신 revision으로 재시도 | 성공 |

---

## 8) B→A 소유권 위조 차단 시험 (실행 후 수동)

| # | 시험 | 예상 결과 |
|---|---|---|
| 1 | B가 A의 `conversation_id`로 `handoff` 호출 | `FORBIDDEN`(getUser 소유권 불일치) |
| 2 | B가 A의 `report_id`로 `handoff` 호출 | `FORBIDDEN` |
| 3 | service role이 `source_conversation_id`를 타인 대화로 직접 INSERT | 검증 트리거 예외 |
| 4 | ECHO만 사용자(버튼 미노출) → handoff 미호출 | A 데이터 미생성(클라이언트 게이트) |

---

## 9) Edge Function 전체 코드

전체 원문은 `supabase/drafts/PENDING_대표승인_doit_understanding/index.ts` (V408). 검토 항목 매핑:

| 확인 항목 | 구현 |
|---|---|
| CORS 허용 주소 | `CORS_ALLOWED_ORIGINS` 환경변수 allowlist(미설정 시 `*` 폴백, 운영 반드시 등록) |
| OPTIONS 처리 | `OPTIONS` → preflight 200 |
| 요청 크기 제한 | `content-length > 64KB` → `TOO_LARGE` 413 |
| 허용 HTTP 방식 | `POST`만, 그 외 405 |
| JSON 검증 | `req.json().catch(null)` + 객체·배열 검사 |
| action 화이트리스트 | `ACTIONS` Set, 미등록 → 400 |
| getUser() 실검증 | `sb.auth.getUser()` → 실패 시 `UNAUTHORIZED` |
| service_role 키 노출 방지 | `Deno.env` 서버 전용, 응답·로그 미포함 |
| 사용자 소유권 검사 | 모든 읽기/쓰기 `.eq("user_id", userId)` |
| 요청 횟수 제한 | 메모리 버킷 60회/분(콜드스타트 초기화 한계 명시) |
| 멱등 | `doit_request_events` + payload 해시 |
| revision 검사 | `where revision=expected` → 불일치 `STALE_REVISION` |
| 상태 전이 규칙 | `INSIGHT_TRANSITIONS` 화이트리스트 |
| LLM 실패 처리 | `AI_ERROR`/`NO_CANDIDATE`, 의미판정 실패 시 1단계 fallback |
| 로그에 원문·토큰·키 미기록 | `catch`는 상세 없이 일반 오류만 |
| 고정 오류 코드 | `CODES` 상수 |
| 안전한 응답 | 모든 분기 `json()`/`fail()` 종료 |

---

## 10) 프론트 연결 변경안

> DB 승인 전까지 `useUnderstanding.tsx`를 실제 DB 구조로 **교체하지 않는다**. 아래는 계약(변경안)이며 실행은 승인·배포 후.

1. **타입**: `DoitRecord`(`originalText`=사용자 직접 입력만, `sourceHandoff` 없음), `DoitInsight`, `DoitHandoff`.
2. **RPC 인터페이스**: `recordList/recordCreate/insightList/insightGenerate/insightConfirm/insightCorrect/insightReject/insightSelf/handoff`.
3. **STALE_REVISION 처리**: 프론트가 `STALE_REVISION` 수신 시 `insight_list`로 최신 재조회 → 재조회 없이 사용자 입력 덮어쓰지 않음.
4. **로딩·오류·재시도**: `try/catch/finally` + `error` 문자열 + `retry`.
5. **미로그인**: `/login`(returnPath 보존).
6. **플래그**: `A_STRUCTURE_SERVER_ENABLED = false` (승인·배포 전 false).
7. **localStorage 마이그레이션**: 읽기 전용. 승인·배포 후 일회성 업로드(신규 `request_id` 발급, `source_*` null). 기존 키는 성공 확인 후 백업·제거.
8. **handoff 트리거**: 리포트 화면 `DO IT으로 이어가기` 직접 클릭 시만 `handoff` 호출. `storyHandoff.ts`(sessionStorage)는 승인 후 교체.

---

## 11) 영향 범위

- **신규 객체**: 테이블 4, 함수 2, 트리거 4, RLS 정책 2, GRANT/REVOKE.
- **기존 변경 0**: 기존 테이블(`conversations`/`reports`/`profiles` 포함)·정책·함수·트리거·스토리지·결제·인증·B구조.
- **기존 `is_admin()` 수정 0** (별도 승인 항목 유지).
- **프론트 소스 변경 0** (계약 문서만, 실제 교체는 승인 후).

## 12) 복구 순서

1. `drop trigger` 4개(records/insights/request_events updated_at, handoffs owner)
2. `drop function` 2개(owner_check, set_doit_updated_at)
3. `drop table` request_events → insights → handoffs → records
4. 전체를 단일 `begin…commit`(§3)

---

## STOP 확인

DDL 0 · RLS 0 · 트리거 0 · 마이그레이션 0 · Edge Function 배포 0 · 프론트 서버 전환 0 · localStorage 삭제 0 · 파일 삭제 0 · 운영 배포 0 · 결제 0.

**실행하지 않은 검사(§5~§8의 수동 시험, SQL 문법, 타입·린트, RLS 실시뮬레이션, 모바일 실기기)는 "확인 불가"로 표시.** 정적 초안 검토 기준으로만 ✅. `V408 원문 검수 완료, 실행 승인` 수신 전까지 STOP 유지.