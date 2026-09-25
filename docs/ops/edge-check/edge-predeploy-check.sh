#!/usr/bin/env bash
# Edge Function 배포 전 로컬 검사 (Claude 작업공간 전용 · 배포 자체는 하지 않음)
# 사용: bash edge-predeploy-check.sh <함수 폴더> <슬러그> <프로젝트 ref> <verify_jwt: true|false>
#  차단 조건: 진입 파일(index.ts) 없음/0바이트/공백만 · 코드가 .txt 에만 있음 · Deno.serve/serve 핸들러 없음 ·
#            원격 모듈 지정자 불명(npm:/jsr:/https: 아님) · 슬러그 규칙 위반 · ref 길이 20 아님 · verify_jwt 값 불명
#  통과 시 원본 SHA-256 을 출력해 배포 후 대조에 쓴다(deploy 결과의 ezbr_sha256 과는 다른 값 — 파일 해시).
set -u
DIR="${1:?함수 폴더}"; SLUG="${2:?슬러그}"; REF="${3:?프로젝트 ref}"; VJ="${4:?verify_jwt}"; fail=0
say(){ printf '%s\n' "$*"; }; chk(){ if [ "$1" = 0 ]; then say "PASS  $2"; else say "FAIL  $2"; fail=1; fi; }
E="$DIR/index.ts"
[ -f "$E" ]; chk $? "진입 파일 존재: index.ts"
[ -f "$E" ] && [ "$(tr -d '[:space:]' < "$E" | wc -c)" -gt 0 ]; chk $? "진입 파일 내용 있음(공백 제외 0바이트 아님)"
TXT=$(ls "$DIR"/*.txt 2>/dev/null | head -1); if [ -n "$TXT" ] && [ -f "$E" ] && [ "$(tr -d '[:space:]' < "$E" | wc -c)" -eq 0 ] && grep -q -E "Deno\.serve\(|serve\(" "$TXT"; then chk 1 "코드가 .txt 에만 있고 index.ts 는 비어 있음 → 차단(2026-09-14 장애 유형)"; else chk 0 ".txt 전용 코드 상태 아님"; fi
[ -f "$E" ] && grep -q -E "Deno\.serve\(|^\s*serve\(" "$E"; chk $? "HTTP 핸들러 연결(Deno.serve 또는 serve) 존재"
BAD=$( [ -f "$E" ] && grep -o -E "from ['\"][^'\"]+['\"]" "$E" | sed -E "s/from ['\"]//; s/['\"]$//" | grep -v -E '^(npm:|jsr:|https://|\./|\.\./)' || true ); [ -z "$BAD" ]; chk $? "필요 모듈 지정자 확인(npm:/jsr:/https:/상대경로만) ${BAD:+→ 불명: $BAD}"
for m in $( [ -f "$E" ] && grep -o -E "from ['\"]\.\.?/[^'\"]+['\"]" "$E" | sed -E "s/from ['\"]//; s/['\"]$//" ); do [ -f "$DIR/$m" ] || [ -f "$DIR/$m.ts" ]; chk $? "상대 모듈 존재: $m"; done
echo "$SLUG" | grep -q -E '^[a-z0-9][a-z0-9-]{1,62}$'; chk $? "슬러그 형식: $SLUG"
[ "${#REF}" = 20 ] && echo "$REF" | grep -q -E '^[a-z]{20}$'; chk $? "대상 프로젝트 ref 형식(20자): $REF"
[ "$VJ" = true ] || [ "$VJ" = false ]; chk $? "verify_jwt 값 명시: $VJ"
if [ -f "$E" ]; then H=$(sha256sum "$E" | cut -c1-64); say "INFO  원본 SHA-256(index.ts): $H  bytes=$(wc -c < "$E")"; fi
[ $fail = 0 ] && say "RESULT: EDGE SOURCE OK (배포는 대표 승인 후)" || say "RESULT: EDGE SOURCE HOLD"
exit $fail
