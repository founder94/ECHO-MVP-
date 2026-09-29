#!/bin/bash
# 100회 도중 운영 함수(get-step-question·echo-journey)의 버전/ezbr_sha256 이 시작 기준과 달라지면 즉시 검사를 멈춘다.
cd "$(dirname "$0")"
OUT=${OUT_FILE:-final100v4-results.jsonl}; BASE=${BASE_FILE:-final100v4-functions-baseline.txt}; LOG=integrity-watch.log
list() { ../bin/supabase functions list --project-ref zyyhhxyupizcqhxqnxuu 2>/dev/null | python3 -c "
import sys,json
for f in sorted(json.load(sys.stdin)['functions'], key=lambda x: x['slug']):
  if f['slug'] in ('get-step-question','echo-journey'): print(f['slug'], 'v'+str(f['version']), f['status'], 'jwt='+str(f['verify_jwt']), f['ezbr_sha256'])"; }
[ -f "$BASE" ] || list > "$BASE"
echo "[watch] 기준: $(tr '\n' ' ' < "$BASE") $(date -u +%T)" >> $LOG
while [ ! -f "$OUT.STOP" ] && [ "$(wc -l < "$OUT" 2>/dev/null || echo 0)" -lt 100 ]; do
  sleep 300
  now=$(list); if [ -z "$now" ]; then echo "[watch] 목록 조회 실패(무시) $(date -u +%T)" >> $LOG; continue; fi
  if [ "$now" != "$(cat "$BASE")" ]; then
    echo "운영 함수 변경 감지 $(date -u +%FT%TZ): $(echo "$now" | tr '\n' ' ')" > "$OUT.STOP"
    echo "[watch] STOP: 운영 함수 변경 감지 $(date -u +%T)" >> $LOG
    for p in $(ps -eo pid,args | awk '$2=="node" && $3=="run100v3.mjs"{print $1}'); do kill $p; done
    exit 1
  fi
  echo "[watch] 동일 $(date -u +%T) rows=$(wc -l < "$OUT" 2>/dev/null || echo 0)" >> $LOG
done
echo "[watch] 종료 $(date -u +%T)" >> $LOG
