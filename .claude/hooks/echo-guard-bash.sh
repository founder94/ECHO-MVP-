#!/usr/bin/env bash
# ECHO 자동 작업 안전 잠금(PreToolUse · Bash). Codex↔Claude 자동 왕복 중에도 사람 승인 없이 넘으면 안 되는 선을 막는다.
# 막음(deny): 배포·Secret·DB 구조 변경·보호 브랜치 push·강제 push. 결과는 JSON 한 줄(값 출력 0).
set -u
cmd="$(jq -r '.tool_input.command // ""')"
deny() { jq -cn --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }
# 1) Supabase 배포·비밀값·DB 구조 — 대표 승인 대상(STOP 기준)
if grep -Eq '(^|[;&|(]|\bdo|\bthen|\belse)[[:space:]]*(npx[[:space:]]+)?supabase[[:space:]]+(functions[[:space:]]+deploy|secrets[[:space:]]+(set|unset)|db[[:space:]]+(push|reset)|migration[[:space:]]+(up|repair|squash)|link)\b' <<<"$cmd"; then
  deny "ECHO 잠금: Supabase 배포·Secret·DB 구조 변경은 대표 승인 대상이라 자동 실행하지 않습니다. 승인안을 만들어 보고하세요."
fi
# 2) git push: 강제·삭제·미러 금지, 보호 브랜치(main · echo-qa · master · prod*) 직접 push 금지
if grep -Eq '(^|[;&|(]|\bdo|\bthen|\belse)[[:space:]]*git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push\b' <<<"$cmd"; then
  # push 명령 조각만 본다(커밋 메시지·heredoc 글자는 보지 않음)
  seg="$(grep -Eo 'git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push[^;&|'"'"'"]*' <<<"$cmd")"
  if grep -Eq '[[:space:]](--force|-f|--force-with-lease|--mirror|--delete|-d)([[:space:]=]|$)|[[:space:]]\+[^[:space:]]+' <<<"$seg"; then
    deny "ECHO 잠금: 강제·삭제·미러 push 는 자동 왕복에서 금지입니다."
  fi
  if grep -Eq '[[:space:]](origin[[:space:]]+)?([^[:space:]]*:)?(main|master|echo-qa|prod[[:alnum:]_-]*)([[:space:]]|$)' <<<"$seg"; then
    deny "ECHO 잠금: 보호 브랜치(main·echo-qa·master·prod)로 직접 push 하지 않습니다. 작업 브랜치 → PR 로만."
  fi
fi
# 3) GitHub 쪽 병합·워크플로 실행(gh api) — 사람 승인 대상
if grep -Eq '(^|[;&|(]|\bdo|\bthen|\belse)[[:space:]]*gh[[:space:]]+api\b.*(/merge([[:space:]"'"'"']|$)|/dispatches|/rerun|-X[[:space:]]*(DELETE|PUT))' <<<"$cmd"; then
  deny "ECHO 잠금: gh api 로 병합·워크플로 실행·삭제를 하지 않습니다(대표 승인 대상)."
fi
exit 0
