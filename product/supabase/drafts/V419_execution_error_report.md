# V419 — V418 권한 회수문 실제 실행 거부 기록

- 실행 시각: 2026-09-11
- 대상 파일: `supabase/drafts/V418_revoke_doit_write_grants.sql`
- 실행 방법: SQL 도구(execute_sql) 정상 절차로 1회 실행, SQL 변형·우회 없음
- 결과: 거부됨 (미실행)

## 플랫폼 SQL 도구가 반환한 오류 원문 (그대로)

```
SQL execution is prohibited to protect data security: begin;

REVOKE ALL ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_record_update(uuid, uuid, text, text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_insight_generate(uuid, uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_insight_self(uuid, uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_insight_transition(uuid, uuid, text, text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_apply_handoff(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_record_create(uuid, uuid, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_record_update(uuid, uuid, text, text, uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_insight_generate(uuid, uuid, text, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_insight_self(uuid, uuid, text, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_insight_transition(uuid, uuid, text, text, uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_apply_handoff(uuid, uuid, text, text, uuid) TO service_role;

commit;
```

## 결론

- 도구가 `REVOKE/GRANT`(DDL 권한 변경)를 "데이터 보호" 사유로 차단했습니다.
- 오류 원문은 위 그대로 확보·보존했습니다.
- 차단을 다른 SQL 형태나 다른 도구로 우회하지 않았습니다.
- 정식 해소 경로는 Supabase 대시보드 → SQL Editor에서 `V418_revoke_doit_write_grants.sql` 수동 실행뿐입니다.