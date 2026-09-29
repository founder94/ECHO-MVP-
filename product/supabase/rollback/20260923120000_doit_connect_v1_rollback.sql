-- 되돌리기: doit_connect_v1 (2026-09-23). 실행하면 연결·첫 답·대화 기록이 모두 지워진다(되살릴 수 없음). 대표 승인 뒤에만.
drop table if exists public.doit_match_messages;
drop table if exists public.doit_match_answers;
drop table if exists public.doit_matches;
