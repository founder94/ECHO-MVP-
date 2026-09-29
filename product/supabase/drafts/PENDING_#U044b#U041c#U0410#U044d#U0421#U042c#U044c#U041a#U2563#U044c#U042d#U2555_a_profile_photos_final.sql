-- =====================================================================
-- PENDING_대표승인  A구조(DO IT) profile_photos 최종 권장 초안
-- 작성일: 2026-09-11
-- 상태: 초안(DRAFT). 대표 승인 전 절대 실행 금지(STOP).
--
-- 이 파일은 기존 두 초안을 대조한 뒤, 충돌을 해소해 낸 "단일 권장안"이다.
--   - 기존 초안 1: PENDING_대표승인_a_structure_db.sql
--   - 기존 초안 2: PENDING_대표승인_a_structure_server_handoff.md
-- 이 파일은 위 두 파일을 수정하지 않고 별도로 작성했다.
--
-- 아래 SQL은 전부 CREATE TABLE / RLS / Storage policy / bucket 생성을 포함하므로
-- 대표 승인(STOP) 항목이다. 승인 전까지 어떤 SQL도 실행하지 않는다.
--
-- 범위 원칙(이번 PHASE):
--   - 사진 6장 저장·복원·교체·대표사진·순서 유지에 필요한 최소 구조만.
--   - A-ESCAPE 공개 정책(is_locked/unlock_state)은 넣지 않는다.
--   - 35/65 정책은 기본 6장에 적용하지 않는다.
--   - 본인확인(verify_state)은 SERVER REQUIRED 별도 PHASE, 여기 넣지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Storage bucket (private)
--    Supabase Storage 콘솔에서 생성. public=false(비공개).
--    공개 URL 없음. 접근은 signed URL + RLS/권한 확인으로만.
-- ---------------------------------------------------------------------
-- bucket name : profile-photos   (1-63 소문자, 문자/숫자/.-_)
-- public      : false

-- ---------------------------------------------------------------------
-- 2. profile_photos 테이블
--    - slot 은 두 초안 공통의 의미 라벨 6개를 그대로 유지.
--      (full/style/hobby/activity/charm/lifestyle = 전신/스타일/취미/활동/매력/생활)
--    - rotation/brightness 는 제외: 현재 클라이언트가 correctBlob 으로
--      회전·밝기를 "이미 적용된 Blob"으로 만들고 그대로 저장하므로,
--      DB에 회전/밝기 메타를 별도 저장할 필요가 없음(재편집은 재촬영으로).
--    - is_locked/unlock_state 제외: 공개 정책은 별도 PHASE.
--    - verify_state 제외: 본인확인 벤더 미확정(SERVER REQUIRED), 별도 PHASE.
--      촬영 완료 ≠ 본인 확인 완료. profiles.verification_status='pending' 유지.
-- ---------------------------------------------------------------------
create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  slot         text not null check (slot in ('full','style','hobby','activity','charm','lifestyle')),
  storage_path text not null,               -- private bucket 내 경로(공개 URL 아님)
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, slot)                     -- 사용자당 슬롯 1장
);

-- 대표사진은 사용자당 1장만. 부분 유니크 인덱스로 강제.
create unique index if not exists profile_photos_one_primary
  on public.profile_photos (user_id) where is_primary = true;

-- ---------------------------------------------------------------------
-- 3. object path 규칙
--    {user_id}/{slot}/{captureId}.jpg
--    - user_id : auth.uid() 기준(브라우저 입력 아님)
--    - slot    : 6개 라벨 중 하나
--    - captureId : 촬영마다 새 UUID. 교체 시 경로가 달라져
--      "새 업로드 → DB 반영 → 구 object 삭제" 순서가 안전하게 성립.
--    - 다른 사용자와 경로 충돌 없음(user_id 폴더 분리).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 4. RLS (자기 사진만 INSERT/SELECT/UPDATE/DELETE)
-- ---------------------------------------------------------------------
alter table public.profile_photos enable row level security;

create policy "select own photos" on public.profile_photos
  for select using (auth.uid() = user_id);

create policy "insert own photos" on public.profile_photos
  for insert with check (auth.uid() = user_id);

create policy "update own photos" on public.profile_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own photos" on public.profile_photos
  for delete using (auth.uid() = user_id);

-- 관리자 SELECT 정책은 기존 관리자 정책을 실측하지 않았으므로
-- 이번 migration에 임의 추가하지 않는다(별도 승인).

-- ---------------------------------------------------------------------
-- 5. Storage policy (private bucket, 자기 폴더만 접근)
--    폴더 1번째 세그먼트가 auth.uid()::text 와 일치해야 접근 가능.
-- ---------------------------------------------------------------------
-- (아래는 storage.objects 정책. bucket_id = 'profile-photos')

create policy "owner read" on storage.objects
  for select using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner insert" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner update" on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner delete" on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 6. 교체(사진 교체) 순서 — 안전 순서(구 파일 먼저 삭제 금지)
--    1) 새 파일 업로드  → storage.from('profile-photos').upload(newPath, blob)
--    2) DB 행 갱신     → update profile_photos set storage_path=newPath,
--                        updated_at=now() where user_id=... and slot=...
--    3) 성공 확인      → 행 갱신 성공 확인
--    4) 구 object 삭제 → storage.from('profile-photos').remove([oldPath])
--    중간 실패 시 구 사진 유지(2~4 중 어디서 실패해도 1번만 신규 object 존재).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 7. migration 실행 순서
--    1) Storage 콘솔: bucket 'profile-photos' 생성(public=false)
--    2) DDL 실행: create table profile_photos + partial unique index
--    3) RLS 활성화 + 4개 정책
--    4) storage.objects 4개 정책
--    5) (별도 PHASE) 본인확인 Edge Function — 이번 아님
--    6) (별도 PHASE) 프론트 Storage adapter + start-journey 통합
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 8. rollback SQL (대표 승인 후 문제 시)
-- ---------------------------------------------------------------------
-- drop table if exists public.profile_photos;
-- -- Storage 콘솔에서 'profile-photos' 버킷 삭제(내부 객체 포함)
-- -- 위 정책들은 테이블/버킷 삭제 시 함께 제거됨.

-- =====================================================================
-- 끝. 본 파일은 초안이며, 승인 전 실행 금지(STOP).
-- =====================================================================