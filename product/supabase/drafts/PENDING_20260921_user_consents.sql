-- PENDING · 대표 승인 전 실행 금지 (초안 2026-09-21)
-- 목적: 약관 동의 이력을 항목·버전·시각 단위로 남긴다(법적 증빙). 현재 화면은 profiles.consent_version(기존 칸)만 쓰고
--       시각·마케팅 선택은 인증 메타데이터에 두므로, 이 표가 생기기 전에도 동작한다. 이 표는 "증빙 보강"이다.
-- 실행 순서: 1) 스테이징에서 실행 2) 화면 코드에 insert 1줄 추가(별도 패치) 3) 운영 실행.
-- 롤백: drop table if exists public.user_consents;

create table if not exists public.user_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  doc         text not null check (doc in ('terms', 'privacy', 'age14', 'marketing')),
  version     text not null,
  agreed      boolean not null,
  agreed_at   timestamptz not null default now(),
  user_agent  text
);

comment on table public.user_consents is '약관 동의 이력. 원문·비밀값 없음. 회원 본인만 쓰고 읽는다(수정·삭제 불가).';

create index if not exists user_consents_user_doc_idx on public.user_consents (user_id, doc, agreed_at desc);

alter table public.user_consents enable row level security;

-- 본인 행만 추가·조회. 수정·삭제 정책은 두지 않는다(이력 보존).
create policy user_consents_insert_own on public.user_consents
  for insert to authenticated with check (auth.uid() = user_id);

create policy user_consents_select_own on public.user_consents
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.user_consents from anon;
grant select, insert on public.user_consents to authenticated;

-- 선택: 동의 시각을 profiles 에도 두고 싶으면(조회 편의). 필수 아님.
-- alter table public.profiles add column if not exists consented_at timestamptz;
