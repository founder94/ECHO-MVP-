#!/bin/bash
# 준비: 빈 로컬 DB 에 qa-sql/meet-gate-B-stub.sql → supabase/drafts/PENDING_20261002_meet_gate_B.sql 적용 뒤 실행. 실제 Supabase(QA·PROD)에 쓰지 않는다.
# 로컬 Postgres 16 · 대용 스키마 · PENDING_20261002_meet_gate_B.sql 동작·경합 검사 (QA·PROD 0)
Q="psql ${PGARGS:--h /tmp/echo-pg -p 55432 -U postgres} -d ${PGDB:-echo_b} -q -At"
A=10000000-0000-4000-8000-00000000000a; B=20000000-0000-4000-8000-00000000000b; C=30000000-0000-4000-8000-00000000000c
V=$(printf 'ab%.0s' {1..32}); V2=$(printf 'cd%.0s' {1..32})
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 · 기대=[$3] 실제=[$2]"; fail=$((fail+1)); fi; }
err() { $Q -c "$1" 2>&1 | grep -o 'ERROR:  [A-Z_]*' | head -1 | sed 's/ERROR:  //'; }
reset() {
  $Q -c "truncate public.doit_meet_plans, public.doit_meet_intents, public.doit_meet_checks, public.doit_video_participation, public.doit_video_sessions, public.blocks, public.user_reports, public.doit_matches cascade" >/dev/null
  M=$($Q -c "insert into public.doit_matches (user_a,user_b,status) values ('$A','$B','approved') returning id" | head -1)
  S=$($Q -c "insert into public.doit_video_sessions (match_id,provider,provider_session_ref,context_version) values ('$M','prov','room-1','$V') returning id" | head -1)
}
ev() { echo "{\"provider\":\"prov\",\"provider_session_ref\":\"room-1\",\"context_version\":\"$1\",\"ended_at\":\"2026-10-02T00:10:00Z\",\"participants\":[{\"user_id\":\"$2\",\"joined_at\":\"2026-10-02T00:00:00Z\",\"left_at\":\"2026-10-02T00:09:00Z\",\"camera_on_seconds\":${3:-300}},{\"user_id\":\"$A\",\"joined_at\":\"2026-10-02T00:00:00Z\",\"left_at\":\"2026-10-02T00:09:00Z\",\"camera_on_seconds\":300}]}"; }
ready() { # 영상 확정 + 양쪽 확인 + 양쪽 yes
  $Q -c "select public.doit_finalize_video_evidence('$(ev $V $B)'::jsonb)" >/dev/null
  $Q -c "insert into public.doit_meet_checks (session_id,user_id) values ('$S','$A'),('$S','$B')" >/dev/null
  $Q -c "insert into public.doit_meet_intents (session_id,user_id,intent,request_id) values ('$S','$A','yes',gen_random_uuid()),('$S','$B','yes',gen_random_uuid())" >/dev/null
}
plan() { $Q -c "select public.doit_create_meet_plan('$M','$S','${1:-$A}','${2:-60000000-0000-4000-8000-00000000000f}')" 2>&1 | sed 's/.*ERROR:  \([A-Z_]*\).*/\1/' | head -1; }

# ── 영상 근거 ──
reset
ok "없는 방(서버가 만들지 않은 ref) = 저장 0" "$(err "select public.doit_finalize_video_evidence('{\"provider\":\"prov\",\"provider_session_ref\":\"nope\",\"context_version\":\"$V\",\"participants\":[]}'::jsonb)")" "VIDEO_SESSION_UNKNOWN"
ok "고정 판 다름 = 저장 0" "$(err "select public.doit_finalize_video_evidence('$(ev $V2 $B)'::jsonb)")" "VIDEO_CONTEXT_MISMATCH"
ok "연결 밖 사람 = 저장 0" "$(err "select public.doit_finalize_video_evidence('$(ev $V $C)'::jsonb)")" "VIDEO_PARTICIPANT_INVALID"
ok "실패 뒤 참여 줄 0 · 확정 0" "$($Q -c "select count(*)||'/'||coalesce(finalized_at::text,'none') from public.doit_video_participation, public.doit_video_sessions where id='$S' group by finalized_at" | head -1)" ""
ok "정상 근거 = saved · replayed false" "$($Q -c "select public.doit_finalize_video_evidence('$(ev $V $B)'::jsonb)->>'replayed'")" "false"
ok "같은 근거 다시 = replayed true · 줄 2개 그대로" "$($Q -c "select public.doit_finalize_video_evidence('$(ev $V $B)'::jsonb)->>'replayed'")/$($Q -c "select count(*) from public.doit_video_participation")" "true/2"
ok "다른 근거 = 충돌(덮어쓰기 0)" "$(err "select public.doit_finalize_video_evidence('$(ev $V $B 10)'::jsonb)")" "VIDEO_EVIDENCE_CONFLICT"
ok "확정 뒤 판·근거 바꾸기 = 막힘" "$(err "update public.doit_video_sessions set context_version='$V2' where id='$S'")" "VIDEO_SESSION_FROZEN"
ok "확정 뒤 서명 표시 내리기 = 막힘" "$(err "update public.doit_video_sessions set signature_verified=false where id='$S'")" "VIDEO_EVIDENCE_FINAL"
ok "authenticated 는 근거 함수 실행 권한 0" "$($Q -c "select has_function_privilege('authenticated','public.doit_finalize_video_evidence(jsonb)','execute')")/$($Q -c "select has_function_privilege('anon','public.doit_create_meet_plan(uuid,uuid,uuid,uuid)','execute')")" "f/f"

# ── 약속 허용 조건 ──
reset; $Q -c "select public.doit_finalize_video_evidence('$(ev $V $B)'::jsonb)" >/dev/null
$Q -c "insert into public.doit_meet_checks (session_id,user_id) values ('$S','$A')" >/dev/null
ok "한쪽만 모습 확인 = 약속 0" "$(plan)" "MEET_PLAN_UNAVAILABLE"
$Q -c "insert into public.doit_meet_checks (session_id,user_id) values ('$S','$B')" >/dev/null
$Q -c "insert into public.doit_meet_intents (session_id,user_id,intent,request_id) values ('$S','$A','yes',gen_random_uuid())" >/dev/null
ok "한쪽만 yes = 약속 0" "$(plan)" "MEET_PLAN_UNAVAILABLE"
$Q -c "insert into public.doit_meet_intents (session_id,user_id,intent,request_id) values ('$S','$B','yes',gen_random_uuid())" >/dev/null
ok "남(C)의 연결로 약속 = 없음" "$(plan $C)" "MEET_PLAN_NOT_FOUND"
ok "넷 다 있으면 약속 1개 · 영수증에 요청한 연결 번호(match_id)" "$($Q -c "select (r->>'status')||'/'||(r->>'match_id') from (select public.doit_create_meet_plan('$M','$S','$A','60000000-0000-4000-8000-00000000000f') r) x")" "active/$M"
ok "같은 요청 다시 = 같은 줄(replayed)" "$($Q -c "select (r->>'replayed')||'/'||(select count(*) from public.doit_meet_plans) from (select public.doit_create_meet_plan('$M','$S','$A','60000000-0000-4000-8000-00000000000f') r) x")" "true/1"
ok "상대가 따로 요청해도 살아 있는 약속은 1개" "$($Q -c "select (r->>'existing')||'/'||(select count(*) from public.doit_meet_plans) from (select public.doit_create_meet_plan('$M','$S','$B','60000000-0000-4000-8000-0000000000f2') r) x")" "true/1"
ok "같은 요청 id 에 다른 세션 = 충돌" "$($Q -c "select public.doit_create_meet_plan('$M',gen_random_uuid(),'$A','60000000-0000-4000-8000-00000000000f')" 2>&1 | grep -o 'REQUEST_CONFLICT')" "REQUEST_CONFLICT"
$Q -c "insert into public.doit_meet_intents (session_id,user_id,intent,request_id) values ('$S','$B','not_now',gen_random_uuid())" >/dev/null
ok "상대가 아직으로 바꾸면 약속 취소(intent_changed)" "$($Q -c "select status||'/'||cancel_reason from public.doit_meet_plans")" "cancelled/intent_changed"
ok "취소 뒤 같은 요청 다시 = 지난 성공으로 권한 부활 0(allowed_now false)" "$($Q -c "select (r->>'replayed')||'/'||(r->>'allowed_now')||'/'||(r->>'status') from (select public.doit_create_meet_plan('$M','$S','$A','60000000-0000-4000-8000-00000000000f') r) x")" "true/false/cancelled"

reset; $Q -c "select public.doit_finalize_video_evidence('$(ev $V $B)'::jsonb)" >/dev/null
$Q -c "insert into public.doit_meet_checks (session_id,user_id) values ('$S','$A'),('$S','$B')" >/dev/null
$Q -c "insert into public.doit_meet_intents (session_id,user_id,intent,request_id,created_at) values ('$S','$A','yes',gen_random_uuid(),'2026-10-02T01:00:00Z'),('$S','$B','yes',gen_random_uuid(),'2026-10-02T01:00:00Z'),('$S','$B','no',gen_random_uuid(),'2026-10-02T01:00:00Z')" >/dev/null
ok "같은 시각에 다른 의사 둘(순서 불명) = yes 로 보지 않음 · 약속 0" "$(plan)" "MEET_PLAN_UNAVAILABLE"

# ── 경합(두 세션 · 실제 잠금) ──
reset; ready
( $Q -c "begin; insert into public.blocks (blocker_id,blocked_user_id) values ('$B','$A'); select pg_sleep(1.5); commit;" >/dev/null 2>&1 ) &
sleep 0.4; R=$(plan); wait
ok "차단이 먼저 확정(잠금 보유) → 뒤 약속 요청은 기다렸다가 거절 · 약속 0" "$R/$($Q -c "select count(*) from public.doit_meet_plans")" "MEET_PLAN_UNAVAILABLE/0"

reset; ready
( $Q -c "begin; select public.doit_create_meet_plan('$M','$S','$A','60000000-0000-4000-8000-00000000000f'); select pg_sleep(1.5); commit;" >/dev/null 2>&1 ) &
sleep 0.4; $Q -c "insert into public.blocks (blocker_id,blocked_user_id) values ('$B','$A')" >/dev/null 2>&1; wait
ok "약속이 먼저(잠금 보유) → 뒤 차단이 기다렸다가 그 약속 취소(blocked)" "$($Q -c "select status||'/'||cancel_reason from public.doit_meet_plans")" "cancelled/blocked"

reset; ready
( $Q -c "begin; select public.doit_create_meet_plan('$M','$S','$A','60000000-0000-4000-8000-00000000000f'); select pg_sleep(1.5); commit;" >/dev/null 2>&1 ) &
sleep 0.4; $Q -c "insert into public.doit_meet_intents (session_id,user_id,intent,request_id) values ('$S','$B','no',gen_random_uuid())" >/dev/null 2>&1; wait
ok "약속과 상대 철회(no)가 동시에 → 철회가 약속을 취소" "$($Q -c "select status||'/'||cancel_reason from public.doit_meet_plans")" "cancelled/intent_changed"

reset; ready
( $Q -c "begin; insert into public.doit_meet_intents (session_id,user_id,intent,request_id) values ('$S','$B','no',gen_random_uuid()); select pg_sleep(1.5); commit;" >/dev/null 2>&1 ) &
sleep 0.4; R=$(plan); wait
ok "철회가 먼저(잠금 보유) → 약속 요청은 거절 · 약속 0" "$R/$($Q -c "select count(*) from public.doit_meet_plans")" "MEET_PLAN_UNAVAILABLE/0"

reset; ready
( plan $A 60000000-0000-4000-8000-0000000000a1 >/dev/null ) & ( plan $B 60000000-0000-4000-8000-0000000000b1 >/dev/null ) & wait
ok "양쪽이 동시에 약속 요청 → 살아 있는 약속 1개" "$($Q -c "select count(*) from public.doit_meet_plans where status='active'")" "1"

reset; ready; plan >/dev/null
$Q -c "update public.doit_matches set status='closed' where id='$M'" >/dev/null
ok "연결 종료 → 약속 취소(connection_closed)" "$($Q -c "select status||'/'||cancel_reason from public.doit_meet_plans")" "cancelled/connection_closed"

reset; ready; $Q -c "insert into public.user_reports (reporter_id,target_user_id) values ('$B','$A')" >/dev/null
ok "미처리 신고 사이 = 약속 0" "$(plan)" "MEET_PLAN_UNAVAILABLE"
echo "SQL LOCAL: $pass PASS / $fail FAIL"
