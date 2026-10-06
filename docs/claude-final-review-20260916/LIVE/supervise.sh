#!/bin/bash
# 워커 재시작으로 검사가 끊겨도 같은 동결 코드로 이어 돌린다. 결과 파일은 이어붙인다.
cd "$(dirname "$0")"
for attempt in $(seq 1 40); do
  n=$(wc -l < final100-results.jsonl 2>/dev/null || echo 0)
  [ "$n" -ge 100 ] && break
  echo "[supervise] attempt=$attempt start=$n $(date -u +%H:%M:%S)" >> final100-supervise.log
  START="$n" OUT_FILE=final100-results.jsonl PROG_FILE=final100-progress.log RUNS=100 node run100v2.mjs >> final100-run.log 2>&1
  sleep 5
done
echo "[supervise] done lines=$(wc -l < final100-results.jsonl) $(date -u +%H:%M:%S)" >> final100-supervise.log
