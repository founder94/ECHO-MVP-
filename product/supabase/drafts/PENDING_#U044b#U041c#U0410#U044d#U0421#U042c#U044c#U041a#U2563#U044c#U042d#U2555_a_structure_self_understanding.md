# A구조 핵심 자기이해 자산 스키마 제출 — 대표 승인 대기 · STOP

> 이 파일은 **초안**이다. 어떤 DDL·RLS도 실행하지 않았다.
> 대표가 아래 "변경 원문 / 충돌 검사 / 접근 권한 / 관리자 권한 / 영향 범위 / 복구 SQL"을
> 확인하고 별도 승인하기 전까지 실행 금지(STOP).
> 작성일: 2026-09-09. 대상: A구조(DO IT)의 "자기이해 자산" 영속화.
>
> B구조·기존 13개 테이블·기존 정책은 **수정하지 않는다**. 신규 테이블 2개 + 신규 정책만 대상.

---

## 0. 배경

A구조 7화면(첫 기록 → 확인·수정 → 홈 → 타임라인 → 가치 → 패턴 → 선택 기억)의
핵심 데이터는 현재 `useUnderstanding.tsx`가 **localStorage**에 임시 저장한다.
서버 저장이 없어 새로고침·기기 변경·로그인 사용자 간에 실제 데이터 흐름이 성립하지 않는다.

확정된 ECHO A+B 통합 설계도의 핵심 데이터 규칙은 다음과 같다.

- `confirmed` = 사용자가 확인한 값
- `corrected` = 사용자가 수정한 값
- `candidate`/`unconfirmed` = 가능성으로만 유지(사실로 확정 금지)
- `rejected` = 이후 질문·리포트·장기 프로필에서 재사용 금지
- 사용자 원문 근거를 모든 장기 자산에 연결
- 단일 세션 데이터를 반복 패턴으로 확정 금지
- 사용자가 검토하기 전 AI 생성값을 장기 자기이해 사실로 확정 금지

이를 서버 레벨에서 보장하기 위해 아래 2개 테이블을 신설한다.

---

## 1. 충돌 검사 결과 (읽기 전용 실측 완료)

| 검사 대상 | 결과 |
|---|---|
| `public` 스키마의 `doit_records` / `doit_insights` 테이블 존재 여부 | **없음** (충돌 0) |
| 동명 routine/function 존재 여부 | **없음** (충돌 0) |
| 동명 trigger 존재 여부 | **없음** (충돌 0) |
| 동명 sequence 존재 여부 | **없음** (충돌 0) |
| `is_admin()` 함수 존재 여부 | **있음** (기존 정책 `audit_logs_select_admin` 등이 사용 중 → 재사용, 신규 생성 안 함) |

**신규 테이블명·정책명은 기존 객체와 충돌하지 않는다.**

기존 FK 실측: 활성 테이블은 `user_id uuid`를 FK 없이 두고 RLS(`auth.uid() = user_id`)로
보호한다. 내부 FK만 존재(messages→conversations, emotions→conversations, spaces→purposes).
→ 아래 초안도 동일하게 **`user_id`에 `auth.users` FK를 걸지 않는다**(기존 활성 패턴과 일치).

---

## 2. 변경 원문 (DDL)

```sql
-- ① 첫 자기이해 기록. 원문(original_text)을 항상 보존해 장기 자산의 근거로 삼는다.
create table if not exists public.doit_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,                          -- FK 없음(기존 패턴), RLS로 보호
  original_text text not null,                          -- 사용자가 처음 남긴 원문(근거)
  text          text not null,                          -- 최종(수정본 또는 원문)
  emotion       text,                                   -- 감정 태그(미선택 시 null)
  status        text not null default 'confirmed'
                check (status in ('confirmed','corrected','rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ② 가치·패턴·선택 기억(이해 항목). 원문 근거(source)를 연결하고 상태를 분리한다.
create table if not exists public.doit_insights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,                        -- FK 없음(기존 패턴), RLS로 보호
  category        text not null
                  check (category in ('value','pattern','memory')),
  text            text not null,                        -- 표시 텍스트(corrected=수정본, self=직접 설명)
  ai_text         text,                                 -- AI 후보 원문(corrected·rejected일 때 보존)
  source_record_id uuid references public.doit_records(id) on delete set null,
  source_text     text,                                 -- 근거 원문 스냅샷(기록이 사라져도 보존)
  status          text not null default 'candidate'
                  check (status in ('candidate','confirmed','corrected','rejected')),
  origin          text not null default 'ai'
                  check (origin in ('ai','self')),      -- ai 후보 vs 사용자 직접 설명(직접 설명 우선)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

> `status='rejected'` 행은 **삭제하지 않고 보존**한다(DB 레벨에서 재사용 차단을 위해).
> "단일 세션 → 반복 패턴 확정 금지"는 서버/애플리케이션 로직에서
> `source_record_id`의 원문 기록 수·반복성을 보고 판단하도록 근거만 남긴다.

---

## 3. 접근 권한 (RLS — 사용자별)

기존 활성 테이블과 **동일한 패턴**을 그대로 적용한다.

```sql
alter table public.doit_records enable row level security;
alter table public.doit_insights enable row level security;

-- doit_records: 본인만 조회/입력/수정/삭제
create policy "doit_records_select_own" on public.doit_records
  for select using (auth.uid() = user_id);
create policy "doit_records_insert_own" on public.doit_records
  for insert with check (auth.uid() = user_id);
create policy "doit_records_update_own" on public.doit_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "doit_records_delete_own" on public.doit_records
  for delete using (auth.uid() = user_id);

-- doit_insights: 본인만 조회/입력/수정/삭제
create policy "doit_insights_select_own" on public.doit_insights
  for select using (auth.uid() = user_id);
create policy "doit_insights_insert_own" on public.doit_insights
  for insert with check (auth.uid() = user_id);
create policy "doit_insights_update_own" on public.doit_insights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "doit_insights_delete_own" on public.doit_insights
  for delete using (auth.uid() = user_id);
```

---

## 4. 관리자 권한 (RLS)

기존 `is_admin()` 함수를 재사용한다(신규 함수 생성 안 함).
관리자는 자기이해 자산을 **읽기**할 수 있고, 일반 사용자처럼 임의 수정·삭제는 허용하지 않는다.

```sql
create policy "doit_records_select_admin" on public.doit_records
  for select using (is_admin());
create policy "doit_insights_select_admin" on public.doit_insights
  for select using (is_admin());
```

---

## 5. 영향 범위

- **신규 테이블 2개**: `doit_records`, `doit_insights`
- **신규 RLS 정책 10개**(본인 8 + 관리자 2)
- **기존 테이블·정책·함수·트리거·스토리지 변경: 0건**
- **기존 13개 활성 테이블 수정: 0건**
- **결제·인증·서버 함수 배포: 0건**
- `user_id`에 `auth.users` FK를 걸지 않아 기존 테이블과의 참조 무결성 간섭 없음
- `is_admin()` 기존 함수 재사용 → 신규 객체 최소화

---

## 6. 실패 시 복구 SQL (대표가 수동 실행용)

> 순서 중요: FK를 가진 `doit_insights`를 먼저 삭제한 뒤 `doit_records` 삭제.
> RLS 정책은 테이블 삭제 시 함께 제거된다.

```sql
drop table if exists public.doit_insights;
drop table if exists public.doit_records;
```

복구 후 원상태: 신규 테이블·정책만 사라지고, 기존 13개 테이블과 정책은 그대로 유지된다.

---

## 7. 승인 후 적용 순서 (본 파일 승인 시에만 진행)

1. 위 DDL + RLS 실행
2. `useUnderstanding.tsx`의 localStorage → Supabase 조회/저장으로 교체(인증 사용자 기준, RLS)
3. B구조 `storyHandoff`(sessionStorage) → A구조 첫 기록에 "참고 정보"로 연결(확정 사실 아님)
4. 7화면 전부 상태값·저장 위치·확인/수정/거절 이벤트·원문 근거·다음 전이를 실데이터에 연결
5. `rejected`가 질문·리포트·장기 프로필에서 재사용되지 않도록 서버·프런트 모두 차단

---

## 8. 검사 조건 (승인·적용 후)

- 비로그인·타인 계정이 `doit_records`/`doit_insights` 조회·수정 시도 → RLS 차단
- `status`를 `confirmed/corrected/rejected/candidate` 외 값으로 입력 → CHECK 위반
- `category`를 `value/pattern/memory` 외 값으로 입력 → CHECK 위반
- `rejected` 행이 조회 목록·추천 전제에서 재사용되지 않음
- 원문 근거(`source_record_id`/`source_text`)가 모든 insight에 연결
- 새로고침·다른 기기·로그인 후에도 첫 기록·이해 항목이 서버에서 복원

---

## 9. STOP

본 파일의 DDL·RLS는 **대표 승인 전까지 실행하지 않는다.**
이번 제출은 "실행"이 아니라 "검토를 위한 원문·권한·영향·복구 제출"이다.