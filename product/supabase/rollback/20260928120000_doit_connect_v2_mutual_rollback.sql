-- 되돌리기: doit_connect_v2_mutual — 새로 더한 표 2개만 지운다(기존 표 영향 0). 후보·결과 기록이 사라진다(대표 확인 후 실행).
drop table if exists public.doit_match_outcomes;
drop table if exists public.doit_match_candidates;
