#!/usr/bin/env bash
# ECHO 「검사 후 전달」 잠금(PreToolUse · Bash · git push 때만).
# push 할 커밋이 product/ 를 바꾸면: type-check · lint · 바뀐 곳에 맞는 단위 검사를 돌리고, 실패하면 push 를 막는다(검수 대상이 깨진 채 Codex 로 가지 않게).
# 검사 도구가 없으면 막지 않고 「확인 불가」로 알린다(PASS 라 하지 않음).
set -u
in="$(cat)"
cmd="$(jq -r '.tool_input.command // ""' <<<"$in")"
grep -Eq '(^|[;&|(]|\bdo|\bthen|\belse)[[:space:]]*git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push\b' <<<"$cmd" || exit 0
note() { jq -cn --arg m "$1" '{systemMessage:$m}'; exit 0; }
deny() { jq -cn --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }
# 어느 저장소의 push 인가: git -C <dir> > 명령 앞의 cd <dir> > 프로젝트 폴더
dir="$(grep -Eo 'git[[:space:]]+-C[[:space:]]+[^[:space:]]+' <<<"$cmd" | head -1 | awk '{print $3}')"
[ -z "$dir" ] && dir="$(grep -Eo '(^|&&|;)[[:space:]]*cd[[:space:]]+[^[:space:];&]+' <<<"$cmd" | tail -1 | sed -E 's/.*cd[[:space:]]+//')"
[ -z "$dir" ] && dir="${CLAUDE_PROJECT_DIR:-$PWD}"
dir="${dir/#\~/$HOME}"
cd "$dir" 2>/dev/null || note "ECHO 검사 잠금: 저장소 위치($dir)를 찾지 못해 push 전 검사를 확인 불가로 둡니다."
root="$(git rev-parse --show-toplevel 2>/dev/null)" || note "ECHO 검사 잠금: git 저장소가 아니라 검사 확인 불가."
cd "$root"
br="$(git branch --show-current)"
base="$(git rev-parse --verify -q "@{u}" || git rev-parse --verify -q "origin/$br" || git merge-base HEAD origin/echo-qa 2>/dev/null || true)"
[ -z "$base" ] && note "ECHO 검사 잠금: 비교 기준을 찾지 못해 push 전 검사 확인 불가."
changed="$(git diff --name-only "$base"...HEAD -- product/ 2>/dev/null)"
[ -z "$changed" ] && exit 0
[ -d product/node_modules ] || note "ECHO 검사 잠금: product/node_modules 가 없어 push 전 검사를 돌리지 못했습니다(확인 불가 · PASS 아님)."
cd product
log="$(mktemp)"
run() { echo "\$ $*" >>"$log"; "$@" >>"$log" 2>&1 || { deny "ECHO 검사 잠금: push 전 검사 실패 — $* (종료 $?). 고친 뒤 다시 push 하세요. 마지막 출력:
$(tail -25 "$log")"; }; }
src_changed="$(grep -Ev '^product/(docs/|.*\.md$)' <<<"$changed" || true)"
[ -z "$src_changed" ] && exit 0
run npm run -s type-check
run npm run -s lint
tests=()
grep -q '^product/supabase/functions/doit-agent/' <<<"$changed" && tests+=(qa/agent-server.test.mjs qa/agent-run.test.mjs qa/ai-provider-router.test.mjs $(ls qa/codex-*.test.mjs 2>/dev/null))
grep -q '^product/supabase/functions/doit-connect/' <<<"$changed" && tests+=($(ls qa/connect-*.test.mjs qa/*meet*.test.mjs 2>/dev/null))
while read -r f; do case "$f" in product/qa/*.test.mjs|product/qa/*.test.ts) [ -f "${f#product/}" ] && tests+=("${f#product/}");; esac; done <<<"$changed"
if [ ${#tests[@]} -gt 0 ]; then
  mapfile -t uniq < <(printf '%s\n' "${tests[@]}" | sort -u)
  run node --test "${uniq[@]}"
fi
if command -v deno >/dev/null 2>&1; then
  for fn in $(grep -Eo '^product/supabase/functions/[^/]+/' <<<"$changed" | sort -u); do
    [ -f "${fn#product/}index.ts" ] && run deno check --no-config --no-lock --node-modules-dir=none "${fn#product/}index.ts"
  done
  msg="ECHO 검사 잠금 통과: type-check · lint · 단위 ${#tests[@]}파일 · deno check."
else
  msg="ECHO 검사 잠금 통과: type-check · lint · 단위 ${#tests[@]}파일(deno check 는 이 환경에 deno 가 없어 확인 불가)."
fi
note "$msg"
