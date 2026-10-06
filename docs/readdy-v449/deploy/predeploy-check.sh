#!/usr/bin/env bash
# 배포 전 로컬 검증 (Claude 작업공간 전용 · 운영 앱 소스 변경 없음)
# 사용: SRC=<래디 소스 폴더> INTENDED_REF=zyyhhxyupizcqhxqnxuu bash predeploy-check.sh
#  1) 빌드 입력 검사: Supabase URL 호스트 = 의도한 운영 ref, anon 키 = 공개 키 형식, Toss 클라이언트 키 = 비어 있지 않고 test_ck_/live_ck_/test_gck_/live_gck_ 형식
#  2) 산출물 검사: 자산 참조 존재, _redirects, .map 없음, 서버 secret 패턴 없음, 번들 내 Supabase 호스트 1개 = 의도한 ref
# 값은 출력하지 않는다(종류·길이만).
# 2026-09-13 교정: 번들 패턴 검사를 scan_js 로 통일. JS 파일이 1개일 때 `grep -c 파일들 | awk -F: '{s+=$2}'` 가
#  파일명 접두 없이 숫자만 받아 검출값을 0 으로 잘못 합산(거짓 PASS)하던 결함 수정. 파일 0개·읽기 불가·grep 오류는 모두 HOLD.
set -u
SRC="${SRC:?SRC 필요}"; REF="${INTENDED_REF:?INTENDED_REF 필요}"; OUT="${OUT:-$SRC/out}"; fail=0
say(){ printf '%s\n' "$*"; }
chk(){ if [ "$1" = 0 ]; then say "PASS  $2"; else say "FAIL  $2"; fail=1; fi; }
# scan_js <ERE>: out/assets/*.js 전체에서 패턴 일치 줄 수를 파일별 grep -c 로 합산해 stdout 에 숫자만 출력.
#  파일 0개 → ERR_NOFILES, 읽기 불가 → ERR_UNREADABLE:<파일명>, grep 실패(rc 2) → ERR_GREP:<파일명>. 일치 내용은 절대 출력하지 않는다.
scan_js(){
  local re="$1" f c rc n=0 files=()
  shopt -s nullglob; files=("$OUT"/assets/*.js); shopt -u nullglob
  [ "${#files[@]}" -gt 0 ] || { printf 'ERR_NOFILES'; return 0; }
  for f in "${files[@]}"; do
    [ -f "$f" ] && [ -r "$f" ] || { printf 'ERR_UNREADABLE:%s' "$(basename "$f")"; return 0; }
    c=$(grep -c -E -- "$re" "$f" 2>/dev/null); rc=$?
    [ "$rc" = 2 ] && { printf 'ERR_GREP:%s' "$(basename "$f")"; return 0; }
    case "$c" in ''|*[!0-9]*) printf 'ERR_GREP:%s' "$(basename "$f")"; return 0;; esac
    n=$((n + c))
  done
  printf '%s' "$n"
}
# chk_zero <scan_js 결과> <라벨>: 숫자 0 만 PASS. 검출(>0)·오류(ERR_*) 는 모두 FAIL(HOLD).
chk_zero(){ case "$1" in 0) chk 0 "$2 (검출 0)";; ERR_*) chk 1 "$2 → 검사 불가($1)";; *) chk 1 "$2 → 검출 ${1}건";; esac; }
# ── 1) 빌드 입력 (환경변수 우선, 없으면 .env)
val(){ v="${!1:-}"; if [ -z "$v" ] && [ -f "$SRC/.env" ]; then v=$(grep -E "^$1=" "$SRC/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"); fi; printf '%s' "$v" | tr -d '[:space:]'; }
U=$(val VITE_PUBLIC_SUPABASE_URL); K=$(val VITE_PUBLIC_SUPABASE_ANON_KEY); T=$(val VITE_PUBLIC_TOSS_CLIENT_KEY); F=$(val VITE_A_STRUCTURE_SERVER_ENABLED)
[ "$U" = "https://$REF.supabase.co" ]; chk $? "Supabase URL 호스트 = 의도한 운영 ref ($REF)"
case "$K" in sb_publishable_*) chk 0 "anon 키 형식 = sb_publishable_ (공개 키)";; eyJ*) chk 0 "anon 키 형식 = JWT (role 은 별도 확인)";; *) chk 1 "anon 키 형식 미확인/비어 있음 (len=${#K})";; esac
case "$K" in sb_secret_*) chk 1 "anon 자리에 sb_secret_ 키 → 즉시 중단";; esac
# 결제 개통 게이트(src/lib/echo/toss.ts PAYMENT_GATE)로 검사 모드를 나눈다. A 서버 플래그와 무관.
GATE=$(grep -o -E "PAYMENT_GATE: PaymentGate = '[a-z_]+'" "$SRC/src/lib/echo/toss.ts" 2>/dev/null | grep -o -E "'[a-z_]+'" | tr -d "'")
case "$T" in test_sk_*|live_sk_*) chk 1 "Toss 시크릿 키가 클라이언트 자리에 있음 → 즉시 중단";; esac
if [ "$GATE" = "review_pending" ]; then
  say "MODE  결제 비활성(토스 심사 대기): 주문 생성·SDK 로드·결제창·승인 요청이 게이트로 차단됨. Toss 키 미설정은 예상 상태"
  if [ -z "$T" ]; then chk 0 "Toss 클라이언트 키 미설정 = 예상 상태(비활성 모드)"; else chk 0 "Toss 클라이언트 키 존재하지만 게이트가 review_pending → 자동 활성화 없음 (len=${#T})"; fi
elif [ "$GATE" = "enabled" ]; then
  say "MODE  결제 활성: 키 누락·종류·환경 검사 적용"
  case "$T" in test_ck_*|live_ck_*|test_gck_*|live_gck_*) chk 0 "Toss 클라이언트 키 형식 OK (${T:0:8}…, len=${#T})";; "") chk 1 "Toss 클라이언트 키 비어 있음 → 배포 금지";; *) chk 1 "Toss 클라이언트 키 형식 불일치 (len=${#T})";; esac
else
  chk 1 "PAYMENT_GATE 를 소스에서 찾지 못함(값: '$GATE') → 배포 금지"
fi
[ "$F" = "true" ]; chk $? "VITE_A_STRUCTURE_SERVER_ENABLED=true (운영 승인값과 동일)"
# ── 2) 산출물
[ -f "$OUT/index.html" ]; chk $? "out/index.html 존재"
for a in $(grep -o -E '(src|href)="/[^"]+"' "$OUT/index.html" | sed -E 's/.*="\/([^"]+)"/\1/'); do [ -f "$OUT/$a" ]; chk $? "자산 존재: $a"; done
[ -f "$OUT/_redirects" ] && grep -q "/index.html" "$OUT/_redirects"; chk $? "_redirects SPA fallback"
[ "$(find "$OUT" -name '*.map' | wc -l)" = 0 ]; chk $? ".map 파일 없음 (있으면 ZIP 생성 시 -x '*.map' 로 제외하고 재검사)"
chk_zero "$(scan_js 'sourceMappingURL=data:')" "inline source map 없음"
SECRET_RE='sb_secret_|service_role|sk_live|sk_test|test_sk_|live_sk_|postgres(ql)?://|OPENAI_API_KEY'
chk_zero "$(scan_js "$SECRET_RE")" "번들 내 서버 secret 패턴 0"
# 2026-09-16 교정: 코드 분할 빌드(JS 여러 개)에서 grep 이 파일명을 접두로 붙여 오판하던 문제 → -h 로 파일명 생략
H=$(grep -o -h -E "[a-z]{20}\.supabase\.co" "$OUT"/assets/*.js | sort -u | tr '\n' ' '); [ "$H" = "$REF.supabase.co " ]; chk $? "번들 내 Supabase 호스트 = $REF 만 ($H)"
if [ "$GATE" = "review_pending" ]; then
  grep -q -F "결제 준비 중" "$OUT"/assets/*.js; chk $? "번들에 '결제 준비 중' 버튼 라벨 포함"
  grep -q -F "현재 결제 서비스를 준비하고 있어요" "$OUT"/assets/*.js; chk $? "번들에 결제 준비 중 안내 문구 포함 (게이트 상수는 번들러가 접어 문자열로 남지 않음)"
elif [ -n "$T" ]; then grep -q -F "${T:0:12}" "$OUT"/assets/*.js 2>/dev/null; chk $? "번들에 Toss 클라이언트 키가 실제로 포함됨"; else chk 1 "번들 Toss 키 포함 여부: 입력이 비어 검사 불가"; fi
chk_zero "$(scan_js 'readdy\.ai/preview|ixxrjb\.ready\.co|127\.0\.0\.1|zrgbatwuzhkuogbeoptt|asqxduoorrsdaixflqgo')" "잘못된 endpoint(미리보기·옛 프로젝트·로컬) 없음"
[ $fail = 0 ] && say "RESULT: ARTIFACT VERIFIED" || say "RESULT: ARTIFACT HOLD"
exit $fail
