-- PENDING · 대표 승인 전 실행 금지 (초안 2026-09-21)
-- 목적: ① 프로필 사진 AI 판별 결과를 사진 행에 남긴다(doit-photo-check 함수가 칸이 있을 때만 기록)
--       ② profile_photos 에 anon 역할이 가진 과도한 권한(TRUNCATE 등)을 회수한다. RLS 는 TRUNCATE 를 막지 못한다.
-- 슬롯 = 사진 종류(1 전신, 2 패션, 3 취미, 4~6 자유). 종류 칸은 따로 두지 않는다.
-- 롤백: alter table public.profile_photos drop column if exists check_status, drop column if exists check_category,
--       drop column if exists check_reasons, drop column if exists checked_at;

alter table public.profile_photos
  add column if not exists check_status   text check (check_status in ('ok', 'review', 'rejected')),
  add column if not exists check_category text,
  add column if not exists check_reasons  text[] not null default '{}',
  add column if not exists checked_at     timestamptz;

comment on column public.profile_photos.check_status is 'AI 판별 결과(서버 함수만 기록). 본인 여부·촬영일 확인이 아니다.';

-- 사용자는 자기 판별 결과를 읽기만 한다. 기록은 service_role(서버 함수)만.
revoke update (check_status, check_category, check_reasons, checked_at) on public.profile_photos from authenticated;

-- 보안 정리: anon 은 프로필 사진 표를 건드릴 이유가 없다. (2026-09-21 실측: anon 에 SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 전부 부여돼 있었음)
revoke all on public.profile_photos from anon;
revoke truncate, references, trigger on public.profile_photos from authenticated;
