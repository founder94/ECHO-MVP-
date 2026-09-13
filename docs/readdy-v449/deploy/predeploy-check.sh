#!/usr/bin/env bash
# 배포 전 로컬 검증 (Claude 작업공간 전용 · 운영 앱 소스 변경 없음)
# 사용: SRC=<래디 소스 폴더> INTENDED_REF=zyyhhxyupizcqhxqnxuu bash predeploy-check.sh
#  1) 빌드 입력 검사: Supabase URL 호스트 = 의도한 운영 ref, anon 키 = 공개 키 형식, Toss 클라이언트 키 = 비어 있지 않고 test_ck_/live_ck_/test_gck_/live_gck_ 형식
#  2) 산출물 검사: 자산 참조 존재, _redirects, .map 없음, 서버 secret 패턴 없음, 번들 내 Supabase 호스트 1개 = 의도한 ref
# 값은 출력하지 않는다(종류·길이만).
set -u
SRC="${SRC:?SRC 필요}"; REF="${INTENDED_REF:?INTENDED_REF 필요}"; OUT="$SRC/out"; fail=0
say(){ printf '%s\n' "$*"; }
chk(){ if [ "$1" = 0 ]; then say "PASS  $2"; else say "FAIL  $2"; fail=1; fi; }
# ── 1) 빌드 입력 (환경변수 우선, 없으면 .env)
val(){ v="${!1:-}"; if [ -z "$v" ] && [ -f "$SRC/.env" ]; then v=$(grep -E "^$1=" "$SRC/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"); fi; printf '%s' "$v" | tr -d '[:space:]'; }
U=$(val VITE_PUBLIC_SUPABASE_URL); K=$(val VITE_PUBLIC_SUPABASE_ANON_KEY); T=$(val VITE_PUBLIC_TOSS_CLIENT_KEY); F=$(val VITE_A_STRUCTURE_SERVER_ENABLED)
[ "$U" = "https://$REF.supabase.co" ]; chk $? "Supabase URL 호스트 = 의도한 운영 ref ($REF)"
case "$K" in sb_publishable_*) chk 0 "anon 키 형식 = sb_publishable_ (공개 키)";; eyJ*) chk 0 "anon 키 형식 = JWT (role 은 별도 확인)";; *) chk 1 "anon 키 형식 미확인/비어 있음 (len=${#K})";; esac
case "$K" in sb_secret_*) chk 1 "anon 자리에 sb_secret_ 키 → 즉시 중단";; esac
case "$T" in test_ck_*|live_ck_*|test_gck_*|live_gck_*) chk 0 "Toss 클라이언트 키 형식 OK (${T:0:8}…, len=${#T})";; "") chk 1 "Toss 클라이언트 키 비어 있음 → 배포 금지";; *) chk 1 "Toss 클라이언트 키 형식 불일치 (len=${#T})";; esac
case "$T" in test_sk_*|live_sk_*) chk 1 "Toss 시크릿 키가 클라이언트 자리에 있음 → 즉시 중단";; esac
[ "$F" = "true" ]; chk $? "VITE_A_STRUCTURE_SERVER_ENABLED=true (운영 승인값과 동일)"
# ── 2) 산출물
[ -f "$OUT/index.html" ]; chk $? "out/index.html 존재"
for a in $(grep -o -E '(src|href)="/[^"]+"' "$OUT/index.html" | sed -E 's/.*="\/([^"]+)"/\1/'); do [ -f "$OUT/$a" ]; chk $? "자산 존재: $a"; done
[ -f "$OUT/_redirects" ] && grep -q "/index.html" "$OUT/_redirects"; chk $? "_redirects SPA fallback"
[ "$(find "$OUT" -name '*.map' | wc -l)" = 0 ]; chk $? ".map 파일 없음 (있으면 ZIP 생성 시 -x '*.map' 로 제외하고 재검사)"
! grep -q -E "sourceMappingURL=data:" "$OUT"/assets/*.js; chk $? "inline source map 없음"
[ "$(grep -c -E 'sb_secret_|service_role|sk_live|sk_test|test_sk_|live_sk_|postgres(ql)?://|OPENAI_API_KEY' "$OUT"/assets/*.js | awk -F: '{s+=$2} END {print s}')" = 0 ]; chk $? "번들 내 서버 secret 패턴 0"
H=$(grep -o -E "[a-z]{20}\.supabase\.co" "$OUT"/assets/*.js | sort -u | tr '\n' ' '); [ "$H" = "$REF.supabase.co " ]; chk $? "번들 내 Supabase 호스트 = $REF 만 ($H)"
if [ -n "$T" ]; then grep -q -F "${T:0:12}" "$OUT"/assets/*.js 2>/dev/null; chk $? "번들에 Toss 클라이언트 키가 실제로 포함됨"; else chk 1 "번들 Toss 키 포함 여부: 입력이 비어 검사 불가"; fi
! grep -q -E "readdy\.ai/preview|ixxrjb\.ready\.co|127\.0\.0\.1|zrgbatwuzhkuogbeoptt|asqxduoorrsdaixflqgo" "$OUT"/assets/*.js; chk $? "잘못된 endpoint(미리보기·옛 프로젝트·로컬) 없음"
[ $fail = 0 ] && say "RESULT: ARTIFACT VERIFIED" || say "RESULT: ARTIFACT HOLD"
exit $fail
