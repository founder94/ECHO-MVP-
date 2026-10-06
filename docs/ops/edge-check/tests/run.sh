#!/usr/bin/env bash
# edge-predeploy-check.sh 픽스처 시험: 5 케이스 (정상 / 빈 index.ts+.txt / 핸들러 없음 / 불명 모듈 / 파일 없음)
set -u; HERE="$(cd "$(dirname "$0")" && pwd)"; C="$HERE/../edge-predeploy-check.sh"; W=$(mktemp -d); trap 'rm -rf "$W"' EXIT; ok=0; ng=0
run(){ local name=$1 exp=$2; local out; out=$(bash "$C" "$W/$name" fn-test abcdefghijklmnopqrst true 2>&1); local res; res=$(printf '%s\n' "$out" | grep -o -E 'RESULT: EDGE SOURCE (OK|HOLD)'); if [ "$res" = "RESULT: EDGE SOURCE $exp" ]; then ok=$((ok+1)); echo "OK    $name → $res"; else ng=$((ng+1)); echo "NG    $name → $res (expected $exp)"; printf '%s\n' "$out" | grep FAIL; fi; }
mkdir -p "$W/good" && printf 'import { createClient } from "npm:@supabase/supabase-js@2.57.4";\nDeno.serve(async (req: Request) => new Response("ok"));\n' > "$W/good/index.ts"; run good OK
mkdir -p "$W/empty_txt" && : > "$W/empty_txt/index.ts" && printf 'Deno.serve(async (r) => new Response("ok"));\n' > "$W/empty_txt/fn_index.txt"; run empty_txt HOLD
mkdir -p "$W/nohandler" && printf 'const x = 1;\nexport {};\n' > "$W/nohandler/index.ts"; run nohandler HOLD
mkdir -p "$W/badmodule" && printf 'import { serve } from "std/http/server.ts";\nserve(async () => new Response("ok"));\n' > "$W/badmodule/index.ts"; run badmodule HOLD
mkdir -p "$W/missing"; run missing HOLD
echo "SUMMARY ok=$ok ng=$ng"; [ "$ng" = 0 ]
