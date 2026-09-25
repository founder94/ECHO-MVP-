# A구조 서버 인계물 — 클로드 담당 (대표 승인 대기 · STOP)

> 이 파일은 **초안**이다. 어떤 SQL·RLS·함수도 실행하지 않았다.
> 대표가 각 항목의 "변경 원문 / 영향 / 복구 방법"을 확인하고 별도 승인하기 전까지 STOP.
> 기준일: 2026-09-08. 활성 DB(SaaS Supabase) public 테이블 13개는 이미 존재(profiles, spaces,
> purposes, conversations, messages, blocks, user_reports, audit_logs, reports, payments,
> understanding_results, emotions, openai_rate_limits).
>
> 아래는 **누락된 A전용 구조**만 대상으로 한다. B구조·공유 테이블은 수정하지 않는다.

---

## 1. KEY 원장 (보상 KEY / 수익 KEY 분리)

### 1-1. 변경 원문 (DDL)

```sql
-- KEY 잔액. 보상(reward)·수익(revenue)을 분리. 클라이언트 직접 증가 금지.
create table if not exists public.key_balances (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  reward_key   integer not null default 0 check (reward_key >= 0),
  revenue_key  integer not null default 0 check (revenue_key >= 0),
  updated_at   timestamptz not null default now()
);

-- KEY 거래 원장. 같은 사건은 request_id 로 딱 한 번만 반영(멱등).
create table if not exists public.key_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  request_id     text not null,
  type           text not null check (type in ('earn','spend','charge','adjust')),
  bucket         text not null check (bucket in ('reward','revenue')),
  amount         integer not null,
  reason         text not null,
  policy_version text not null,
  created_at     timestamptz not null default now(),
  unique (user_id, request_id)
);
```

### 1-2. 변경 원문 (RPC — 보상 우선 차감, 멱등, 트랜잭션)

```sql
create or replace function public.key_deduct(
  p_user_id uuid,
  p_request_id text,
  p_amount integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  bal public.key_balances%rowtype;
begin
  -- 중복 요청 차단
  if exists (select 1 from public.key_ledger where user_id = p_user_id and request_id = p_request_id) then
    return jsonb_build_object('success', false, 'reason', 'duplicate');
  end if;

  select * into bal from public.key_balances where user_id = p_user_id for update;
  if bal.user_id is null then
    insert into public.key_balances(user_id) values (p_user_id) returning * into bal;
  end if;

  if bal.reward_key + bal.revenue_key < p_amount then
    return jsonb_build_object('success', false, 'reason', 'insufficient',
      'remaining', bal.reward_key + bal.revenue_key);
  end if;

  -- 보상 우선 차감, 부족분만 수익 차감
  perform public.key_ledger_deduct(p_user_id, p_request_id, p_amount);
  return jsonb_build_object('success', true,
    'remaining', bal.reward_key + bal.revenue_key - p_amount);
end;
$$;
```

> 주의: `key_ledger_deduct` 내부에서 실제 원장 insert + 잔액 update 를 원자적으로 수행해야 한다
> (reward→revenue 순서로 분할 차감 기록). 위는 골격이며 클로드가 세부 구현·검증한다.

### 1-3. RLS (일반 사용자는 자기 잔액·원장만 읽기, 쓰기는 RPC 경유)

```sql
alter table public.key_balances enable row level security;
alter table public.key_ledger enable row level security;

create policy "read own balance" on public.key_balances
  for select using (auth.uid() = user_id);
create policy "read own ledger" on public.key_ledger
  for select using (auth.uid() = user_id);
-- insert/update/delete 는 사용자 직접 금지(RPC만 허용)
```

### 1-4. 영향
- KEY 지급·차감이 서버 원장으로 이동, 클라이언트 조작 불가.
- 결제 확인 없이 KEY 지급 금지 → `echo-payment` 성공 시에만 `charge` 기록.

### 1-5. 복구 방법
- 롤백 SQL: `drop table public.key_ledger; drop table public.key_balances; drop function public.key_deduct;`
- 잔액은 결제·보상 이력에서 재계산 가능해야 하므로 원장을 먼저 백업.

### 1-6. 검사 조건
- 같은 request_id 재전송 → 잔액 2회 차감 없음.
- reward 부족 시 revenue 에서만 부족분 차감.
- 클라이언트에서 `update key_balances` 시도 → RLS 차단.
- 결제 실패/재시도 → KEY 미지급 또는 1회만 지급.

---

## 2. 등급 (Red→Silver→Gold→Perfume→Platinum→Black)

### 2-1. 변경 원문 (DDL)

```sql
create table if not exists public.grade_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  factor      text not null,           -- 약속이행/신고차단/배려/미션/일관성/피드백/기여/권한악용
  delta       integer not null,        -- 양수/음수
  evidence    text,                    -- 근거 행동·완료 증거(민감 원문은 제외)
  policy_version text not null,
  created_at  timestamptz not null default now()
);
```

### 2-2. 변경 원문 (RPC — 서버 판정, 산식 미확정 시 null 반환)

```sql
create or replace function public.grade_current(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  -- 산식 미확정: 임의 승급·점수를 만들지 않는다. 정책 버전이 없으면 "미설정" 반환.
  return jsonb_build_object('grade', null, 'status', 'policy_not_set');
end;
$$;
```

### 2-3. 영향
- 등급은 서버 이벤트 누적으로만 판정. 돈 구매·클라이언트 조작 차단.
- 산식(승급/강등 점수·혜택)이 대표 승인 전이므로 현재는 `policy_not_set`만 반환.

### 2-4. 복구 방법
- `drop table public.grade_events; drop function public.grade_current;`

### 2-5. 검사 조건
- 클라이언트에서 등급 문자열 직접 조작 → 서버 값과 불일치.
- 미확정 상태에서 화면은 "정책 미설정"만 표시(가짜 현재 등급 없음).

---

## 3. 프로필 사진 6장 (앱 내 촬영·자연 보정·본인 확인)

### 3-1. 변경 원문 (DDL + Storage)

```sql
create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  slot         text not null check (slot in ('full','style','hobby','activity','charm','lifestyle')),
  storage_path text not null,          -- private 버킷 경로(공개 URL 아님)
  rotation     integer not null default 0,
  brightness   numeric not null default 1,
  is_primary   boolean not null default false,
  verify_state text not null default 'unverified',  -- unverified/reviewing/verified/failed
  created_at   timestamptz not null default now(),
  unique (user_id, slot)
);
```

> Storage: private 버킷에 저장. 원본은 공개 주소에 두지 않는다. 다운로드는 서명 URL 또는
> RLS 보호된 `get_photo` 함수를 통해서만 제공. 얼굴 동일성 확인은 별도 서버 검증 절차.

### 3-2. 영향
- 촬영·보정은 기기(클라이언트)에서, 저장·본인 확인은 서버에서 분리.
- 갤러리 외부 입력 우회 금지 유지. 원본 공개 노출 차단.

### 3-3. 복구 방법
- `drop table public.profile_photos;` + private 버킷에서 해당 경로 삭제.

### 3-4. 검사 조건
- 비로그인·타인 계정이 `profile_photos` 원본 경로 접근 → 차단.
- 카메라 거부·취소·기기 미지원 → 오류 표시, 성공으로 위장 금지.
- 촬영 완료 ≠ 본인 확인 완료(verify_state 분리).

---

## 4. 방탈출형 공간·미션 상태머신

### 4-1. 변경 원문 (DDL)

```sql
create table if not exists public.missions (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  title       text not null,
  description text not null,
  seq         integer not null,
  status      text not null default 'locked',  -- locked/active/completed
  deadline    timestamptz
);

create table if not exists public.space_members (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  state      text not null default 'joined',  -- joined/left/blocked
  joined_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table if not exists public.member_selections (
  mission_id  uuid not null references public.missions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  response    jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);
```

### 4-2. 변경 원문 (RPC — 서버 승인 후 다음 공간 개방)

```sql
create or replace function public.mission_submit(
  p_mission_id uuid,
  p_response jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  mine record;
  all_done boolean;
begin
  insert into public.member_selections(mission_id, user_id, response)
  values (p_mission_id, auth.uid(), p_response)
  on conflict (mission_id, user_id) do update set response = excluded.response,
    submitted_at = now();

  -- 양측 응답 + 완료 조건을 서버가 검증(클라이언트 버튼만으로 다음 방 개방 금지)
  select count(*) = (select count(*) from public.space_members sm
                      join public.missions m on m.space_id = sm.space_id
                      where m.id = p_mission_id and sm.state = 'joined')
         and count(*) = (select count(*) from public.space_members sm
                          join public.missions m on m.space_id = sm.space_id
                          where m.id = p_mission_id and sm.state = 'joined')
    into all_done
  from public.member_selections ms
  where ms.mission_id = p_mission_id;

  if all_done then
    update public.missions set status = 'completed' where id = p_mission_id;
    -- 다음 seq 미션 active 로, 이전 미션은 완료 후에만 개방
    update public.missions set status = 'active'
    where space_id = (select space_id from public.missions where id = p_mission_id)
      and seq = (select seq + 1 from public.missions where id = p_mission_id);
  end if;

  return jsonb_build_object('success', true, 'completed', all_done);
end;
$$;
```

### 4-3. 영향
- 한쪽만 완료 → 다음 방 개방 불가. 새로고침·재접속 후 서버 상태 복구.
- 미션/대화 기록 분리, 신고·나가기·차단 별도 처리.

### 4-4. 복구 방법
- `drop table public.member_selections; drop table public.space_members; drop table public.missions;`

### 4-5. 검사 조건
- 두 독립 사용자 정상 완료 / 한쪽 미응답 / 거절 / 보류 / 철회 / 신고 시나리오.
- 중복 클릭·재전송 → 중복 보상·중복 방 없음. 브라우저 시계 조작으로 개방 불가.

---

## 5. 사주 엔진

### 5-1. 변경 원문 (Edge Function 골격)

```
function name: saju-calc
input: { birth_date, birth_time, is_lunar, calendar, gender, birthplace }
output: { pillars: [{label, heavenly, earthly}], elements, note }  // 점수 아님
permission: verify_jwt=true (로그인 필요, 익명 금지)
failure: 400 잘못된 입력 / 503 엔진 미연결 — 가짜 명식 반환 금지
```

### 5-2. 영향 / 복구 / 검사
- 실제 천간·지지·오행 산출만. 미래·건강·법률 단정 금지.
- 롤백: 함수 삭제.
- 검사: 시간 모름 입력 → 시주 제외 명시. 음력/윤달 정합성. 지역 시차 보정.

---

## 6. A 관리자 (한글 운영센터)

### 6-1. 변경 원문 (RLS — 관리자 전용, 일반 계정 차단)

```sql
-- profiles.is_admin (이미 존재 시 생략) 사용. 관리자만 A 통계·원장·신고 조회.
create policy "admin read key ledger" on public.key_ledger
  for select using (exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true));
```

### 6-2. 영향 / 복구 / 검사
- 일반 계정이 관리자 주소·API 직접 호출 → 자료 0건. 관리자 자기 승격·잔액 임의 변경 금지.
- 롤백: policy drop.
- 검사: `role === 'admin'`(또는 is_admin) 보호 유지. 0건/조회실패/권한없음/연결안됨 구분 표시.

---

## 7. 공통 금지(전 항목)

- KEY·신뢰·특정인 접근권·강제 연결을 KEY로 구매 금지.
- 사용자 간 KEY 거래 금지. 클라이언트 잔액 직접 증가 금지.
- AI가 보상량·관계 성립을 직접 결정 금지. 서버 규칙 경유.
- 질문 하드코딩 배열·상대 자동 응답·임의 점수 금지.
- 65/35·스토리 잠금은 공개 비율 정책이 대표 확정 전이므로 숫자를 잠금값으로 구현하지 않는다.
  (잠긴 원본 선전달 + CSS blur 위장 금지 — 서버가 미리보기/권한 분리 제공)

---

## 8. 담당·순서

| 항목 | 담당 | 선행 승인 |
|---|---|---|
| KEY 원장·차감 RPC | 클로드(서버) | 대표: 원장 정책·멱등키 |
| 등급 판정 산식 | 클로드 | 대표: 승급/강등/혜택 산식 |
| 사진 저장·본인 확인 | 클로드 | 대표: 개인정보·생체 처리 정책 |
| 공간·미션 상태머신 | 클로드 | 대표: 방 정원·완료 조건·72h 규칙 |
| 사주 엔진 | 클로드 | 대표: 엔진 선정·비용 |
| A 관리자 RLS | 클로드 | 대표: 관리자 권한 |