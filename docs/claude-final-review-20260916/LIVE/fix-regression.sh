#!/bin/bash
cd "$(dirname "$0")"
echo "=== A #58 x10 시작 $(date -u +%T)"
ONLY='#58' REPS=10 OUT_FILE=repro-58-fix.jsonl node repro-p0.mjs
echo "=== B NO_CANDIDATE 5종 x3 시작 $(date -u +%T)"
sleep 66
ONLY='#10,#14,#24,#41,#96' REPS=3 OUT_FILE=repro-nc-fix.jsonl node repro-p0.mjs
echo "=== C 캐너리 SPREAD=1 RUNS=10 시작 $(date -u +%T)"
sleep 66
SPREAD=1 RUNS=10 OUT_FILE=canary15-results.jsonl PROG_FILE=canary15-progress.log node run100v2.mjs
echo "=== 끝 $(date -u +%T)"
