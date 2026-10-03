#!/usr/bin/env bash
# ECHO 자동 작업 안전 잠금(PreToolUse · MCP). 병합·배포·DB 쓰기·워크플로 실행은 자동 왕복에서 사람 확인(ask) 또는 금지(deny).
set -u
in="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$in")"
out() { jq -cn --arg d "$1" --arg r "$2" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'; exit 0; }
case "$tool" in
  mcp__github__merge_pull_request|mcp__github__enable_pr_auto_merge)
    out ask "ECHO 잠금: PR 병합은 대표 지시가 있을 때만입니다. 지시 근거를 확인하세요." ;;
  mcp__github__actions_run_trigger)
    out ask "ECHO 잠금: 워크플로 실행(배포·실제 호출 포함 가능)은 대표 승인 대상입니다." ;;
  mcp__Supabase__deploy_edge_function|mcp__Supabase__apply_migration|mcp__Supabase__merge_branch|mcp__Supabase__reset_branch|mcp__Supabase__delete_branch|mcp__Supabase__pause_project|mcp__Supabase__restore_project|mcp__Supabase__create_project|mcp__Supabase__create_branch|mcp__Supabase__rebase_branch)
    out deny "ECHO 잠금: Supabase 배포·DB 구조·프로젝트 변경은 자동 왕복에서 금지입니다(대표 승인 대상)." ;;
  mcp__Supabase__execute_sql)
    q="$(jq -r '.tool_input.query // ""' <<<"$in" | tr '[:upper:]' '[:lower:]' | sed -E 's/--[^\n]*//g')"
    # 읽기 전용(select · with … select · explain)만 통과. 쓰기·구조 변경·권한 변경은 금지.
    if grep -Eq '\b(insert|update|delete|merge|upsert|alter|drop|create|truncate|grant|revoke|comment[[:space:]]+on|copy|call|do|vacuum|refresh|reindex|cluster|lock|set[[:space:]]+role|security[[:space:]]+definer)\b' <<<"$q"; then
      out deny "ECHO 잠금: SQL 은 읽기 전용(SELECT)만 자동 실행합니다. 쓰기·구조·권한 변경은 대표 승인 대상입니다."
    fi ;;
esac
exit 0
