#!/usr/bin/env bash
# ECHO 테스트 쪽 합치기(대표 승인 2026-10-05 16:56 KST 「모든거 다 너가해 병합도 테스트 권한 다 승인 줬자나」).
# Claude 가 PR 을 테스트 가지(echo-qa)에 합칠 때 쓰는 유일한 길. 운영 가지(main 등)로의 합치기는 하지 않는다(대표만).
# 합치는 조건(모두): ① 대상 가지 = echo-qa ② 같은 저장소의 가지 ③ 열려 있고 충돌 없음(mergeable_state=clean)
#   ④ Codex 가 지금 머리 커밋(head SHA)에 「큰 문제 없음」을 남김 ⑤ 지금 머리 커밋으로만 합침(그 사이 새 push 가 오면 GitHub 가 거절).
# 사용: bash .claude/hooks/echo-qa-merge.sh <PR 번호>
set -euo pipefail
REPO="founder94/echo-mvp-"
n="${1:-}"
[[ "$n" =~ ^[0-9]{1,6}$ ]] || { echo "STOP: PR 번호가 아닙니다"; exit 2; }
pr="$(gh api "repos/$REPO/pulls/$n")"
base="$(jq -r '.base.ref' <<<"$pr")"; state="$(jq -r '.state' <<<"$pr")"; ms="$(jq -r '.mergeable_state' <<<"$pr")"
head_sha="$(jq -r '.head.sha' <<<"$pr")"; head_repo="$(jq -r '.head.repo.full_name // ""' <<<"$pr" | tr '[:upper:]' '[:lower:]')"
[[ "$base" == "echo-qa" ]] || { echo "STOP: 대상 가지가 echo-qa 가 아닙니다($base) — 운영 쪽 합치기는 대표만"; exit 3; }
[[ "$head_repo" == "${REPO,,}" ]] || { echo "STOP: 다른 저장소에서 온 PR 입니다"; exit 3; }
[[ "$state" == "open" ]] || { echo "STOP: 열려 있지 않습니다($state)"; exit 3; }
[[ "$ms" == "clean" ]] || { echo "STOP: 바로 합칠 수 없습니다(mergeable_state=$ms)"; exit 4; }
short="${head_sha:0:10}"
pass="$(gh api "repos/$REPO/issues/$n/comments?per_page=100" --jq "[.[] | select(.user.login == \"chatgpt-codex-connector[bot]\") | select(.body | contains(\"Didn't find any major issues\")) | select(.body | contains(\"$short\"))] | length")"
[[ "$pass" -ge 1 ]] || { echo "STOP: 지금 머리 커밋($short)에 대한 Codex 통과 기록이 없습니다"; exit 5; }
gh api -X PUT "repos/$REPO/pulls/$n/merge" -f merge_method=merge -f sha="$head_sha" --jq '.merged'
