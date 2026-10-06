-- PENDING · 실행 금지 (대표 승인 + 실제 운영 제약 확인 뒤에만)
-- 2026-10-06 대표 「다섯 장 기본 · 여섯 번째부터 추가 사진 65/35 · 스토리 잠금 · KEY 로 열기」 2단계용 초안.
-- 1단계(화면만, DB 변경 0)는 이미 앱 코드에 있다: 6번 칸 = 첫 추가 사진, 스토리 버튼 자물쇠, 「KEY n개로 열기 · 준비 중」.
-- 이 파일은 2단계(실제로 열리게)에 필요한 것만 모았다. 앞선 초안 「economy_p1_key_ledger」(key_balances·key_ledger·key_feature_policies)가 먼저 적용돼 있어야 한다.
-- 적용 전 확인: profile_photos 의 실제 slot 제약 이름(운영 읽기 전용으로 pg_constraint 조회) — 아래 이름은 추정이다.

begin;

-- 1) 추가 사진: 7번째 칸부터 받기(최대 12칸 · 7~12 = 추가). 기존 1~6 칸 의미는 그대로.
alter table public.profile_photos drop constraint if exists profile_photos_slot_check;
alter table public.profile_photos add constraint profile_photos_slot_check check (slot between 1 and 12);

-- 2) 스토리: 본인만 쓰고, 연 사람만 읽는다(읽기는 서버 함수가 잠금 확인 뒤 돌려줌 → 직접 SELECT 정책 0).
create table if not exists public.doit_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  photo_path text,
  created_at timestamptz not null default now()
);
alter table public.doit_stories enable row level security;
create policy doit_stories_owner_rw on public.doit_stories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3) 누가 무엇을 열었는지(같은 것을 두 번 사지 않게 · 탈퇴 시 함께 삭제).
create table if not exists public.doit_unlocks (
  viewer_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('story','extra_photo')),
  photo_slot int,
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (viewer_id, owner_id, kind, photo_slot)
);
alter table public.doit_unlocks enable row level security;
revoke all on public.doit_unlocks from anon, authenticated; -- 서버 함수만 쓴다

-- 4) 값(대표 확인 필요): 스토리 30 · 추가 사진 1장 20. 앱 src/doit/lib/unlockPrices.ts 와 같아야 한다(다르면 서버가 COST_MISMATCH).
insert into public.key_feature_policies (feature, cost, reward_allowed, revenue_only)
values ('story_unlock', 30, true, false), ('extra_photo_unlock', 20, true, false)
on conflict (feature) do nothing;

commit;

-- 되돌리기(연 기록·스토리 삭제됨 — 대표 확인 필요)
-- begin;
-- delete from public.key_feature_policies where feature in ('story_unlock','extra_photo_unlock');
-- drop table if exists public.doit_unlocks;
-- drop table if exists public.doit_stories;
-- delete from public.profile_photos where slot > 6;
-- alter table public.profile_photos drop constraint if exists profile_photos_slot_check;
-- alter table public.profile_photos add constraint profile_photos_slot_check check (slot between 1 and 6);
-- commit;
