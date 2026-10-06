#!/usr/bin/env bash
# predeploy-check.sh 회귀시험 (합성 산출물 · 가짜 마커만 사용 · 배포 ZIP 과 무관)
# 사용: bash predeploy-check.regression.sh   → 5 케이스 중 "clean 1파일" 만 PASS/VERIFIED, 나머지는 FAIL/HOLD 여야 통과
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; CHECK="$HERE/../predeploy-check.sh"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
REF=abcdefghijklmnopqrst   # 20자 가짜 ref (운영 ref 아님)
MARK='FAKE_sb_secret_MARKER_FOR_TEST'   # 가짜 마커: sb_secret_ 패턴에 걸리지만 실제 키 아님
ok=0; ng=0
fixture(){ # $1 = 케이스 폴더
  local d="$1"; mkdir -p "$d/src/lib/echo" "$d/out/assets"
  printf 'VITE_PUBLIC_SUPABASE_URL=https://%s.supabase.co\nVITE_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_FAKE_TEST_ONLY\nVITE_PUBLIC_TOSS_CLIENT_KEY=\nVITE_A_STRUCTURE_SERVER_ENABLED=true\n' "$REF" > "$d/.env"
  printf "export const PAYMENT_GATE: PaymentGate = 'review_pending';\n" > "$d/src/lib/echo/toss.ts"
  printf '<script type="module" src="/assets/app.js"></script>' > "$d/out/index.html"
  printf '/* /index.html 200\n' > "$d/out/_redirects"
}
clean_js(){ printf 'const h="https://%s.supabase.co";const a="결제 준비 중";const b="현재 결제 서비스를 준비하고 있어요";\n' "$REF"; }
run(){ # $1 케이스명 $2 기대 secret 라인 접두(PASS|FAIL) $3 기대 RESULT
  local name="$1" exp_line="$2" exp_res="$3" d="$WORK/$1" out line res
  out=$(SRC="$d" INTENDED_REF="$REF" bash "$CHECK" 2>&1)
  line=$(printf '%s\n' "$out" | grep -F '번들 내 서버 secret 패턴 0' | head -1)
  res=$(printf '%s\n' "$out" | grep -o -E 'RESULT: ARTIFACT (VERIFIED|HOLD)')
  if [ "${line%% *}" = "$exp_line" ] && [ "$res" = "RESULT: ARTIFACT $exp_res" ]; then ok=$((ok+1)); printf 'OK    %-22s %s | %s\n' "$name" "$line" "$res"
  else ng=$((ng+1)); printf 'NG    %-22s got: [%s] [%s]  expected: %s/%s\n' "$name" "$line" "$res" "$exp_line" "$exp_res"; fi
}
# 1) clean 1파일 → PASS / VERIFIED
fixture "$WORK/clean_1file"; clean_js > "$WORK/clean_1file/out/assets/app.js"
run clean_1file PASS VERIFIED
# 2) 마커 1파일(JS 1개) → FAIL / HOLD  (구 검사기가 0 으로 오판하던 케이스)
fixture "$WORK/marked_1file"; { clean_js; printf 'const k="%s";\n' "$MARK"; } > "$WORK/marked_1file/out/assets/app.js"
run marked_1file FAIL HOLD
# 3) 여러 파일 중 하나만 마커 → FAIL / HOLD
fixture "$WORK/multi_one_match"; clean_js > "$WORK/multi_one_match/out/assets/app.js"; printf 'const x=1;\n' > "$WORK/multi_one_match/out/assets/b.js"; printf 'const k="%s";\n' "$MARK" > "$WORK/multi_one_match/out/assets/c.js"
run multi_one_match FAIL HOLD
# 4) JS 파일 없음(assets 비어 있음) → FAIL(ERR_NOFILES) / HOLD
fixture "$WORK/missing_js"; rm -f "$WORK/missing_js/out/assets/"*.js
run missing_js FAIL HOLD
# 5) 읽기 오류 강제: *.js 자리에 깨진 심볼릭 링크 + (비root 인 경우) 권한 000 파일 → FAIL(ERR_UNREADABLE) / HOLD
fixture "$WORK/read_error"; clean_js > "$WORK/read_error/out/assets/app.js"
ln -s "$WORK/read_error/does-not-exist.js" "$WORK/read_error/out/assets/broken.js"
if [ "$(id -u)" != 0 ]; then printf 'x' > "$WORK/read_error/out/assets/noperm.js"; chmod 000 "$WORK/read_error/out/assets/noperm.js"; fi
run read_error FAIL HOLD
printf '\nSUMMARY  ok=%s ng=%s (uid=%s)\n' "$ok" "$ng" "$(id -u)"
[ "$ng" = 0 ]
