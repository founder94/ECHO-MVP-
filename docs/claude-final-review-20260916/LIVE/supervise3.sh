#!/bin/bash
# 최종 100회 v3 감독: 워커 재시작·프로세스 종료로 끊겨도 같은 동결 코드로 이어 돌린다.
# 상태 파일(시작 시각)이 보존되므로 이어 돌려도 서버 시작 제한을 넘지 않는다.
cd "$(dirname "$0")"
OUT=${OUT_FILE:-final100v3-results.jsonl}
for attempt in $(seq 1 60); do
  n=$(wc -l < "$OUT" 2>/dev/null || echo 0)
  [ "$n" -ge 100 ] && break
  echo "[supervise3] attempt=$attempt rows=$n $(date -u +%H:%M:%S)" >> final100v3-supervise.log
  OUT_FILE="$OUT" PROG_FILE=final100v3-progress.log RUNS=100 node run100v3.mjs >> final100v3-run.log 2>&1
  sleep 5
done
echo "[supervise3] done rows=$(wc -l < "$OUT") $(date -u +%H:%M:%S)" >> final100v3-supervise.log
