# 장애 기록 — 마음 날씨 저장 무한 로딩 (2026-09-14 · KST 03:14 대표 실기기 보고)

## 증상
/weather-check 에서 마음 기록 저장("저장 중...") 이 끝나지 않음. do-it.company · Android Chrome.

## 원인 (확정)
- 운영 Edge 함수 `get-step-question` v10 의 진입 파일 `index.ts` 가 **0바이트**. 실제 코드는 `get-step-question_index.txt` 에만 존재(실행 안 됨).
- 로그(18:13~18:16 UTC): 로그인 정상 → 함수 `booted` 3회 → 응답 기록 0 → `shutdown`. 지난 24h 이 함수 응답 0건.
- 대조군 echo-journey 는 index.ts 에 코드 정상.
- 클라이언트 `supabase.functions.invoke` 에 타임아웃 없음 → 무한 "저장 중" 표시(별도 개선 항목, 미수정).

## 조치
- 대표 지시("지금 서버 함수 재배포가 먼저야") = 승인으로 기록.
- 배포된 .txt 의 v10 코드를 **내용 변경 없이** `index.ts` 로 재배포 → **v11** (2026-09-14 · ezbr sha256 c83a0c80…, verify_jwt true 유지). 레포 사본: `supabase/functions/get-step-question/index.ts` (문법검사 0).
- 재배포 후 get_edge_function 재조회: index.ts 에 전체 코드 존재 확인.
- 부수 변화: 함수 표시 이름이 "ECHO 대화 상태머신" → "get-step-question"(슬러그 동일, 동작 무관).

## 미확인 / 대표 확인 필요
- 실제 start 요청 성공(OPENAI_API_KEY·OPENAI_MODEL 비밀값 존재 여부는 Claude 가 읽을 수 없음). 대표가 do-it.company 에서 마음 날씨 저장 1회 재시도 → Claude 가 로그로 응답 코드 확인.
- 래디·Netlify·DB 변경 없음. 결제 비활성 ZIP 0fce51a0… 무관.

## 재배포 후 첫 실기기 시도 (2026-09-14 02:45 UTC · KST 11:45 · iPhone Safari)
- v10 시절 마지막 요청: `OPTIONS | 546 | 150,073 ms` (18:19:35 UTC) → 진입 파일 비어 150초 후 게이트웨이 타임아웃. 원인 재확인.
- v11: `OPTIONS | 200 | 2.3 s` → `POST | 200 | 4.9 s` (02:45:05). **서버는 응답함.** 대표 스크린샷(11:45, 저장 중)은 이 7초 안에 찍힌 것으로 추정.
- 그러나 DB 에 conversations/emotions/messages 신규 행 0 (프로젝트 전체 conversations 0건 = 운영에서 start 가 성공한 적 없음) → 200 본문은 `ok:false` 실패 코드. 후보: AI_NOT_CONFIGURED(비밀값 없음) / AI_ERROR(키·모델 오류) / NO_CANDIDATE(생성 실패). 처리 4.9 s 는 OpenAI 호출이 실제로 시도된 쪽(AI_ERROR·NO_CANDIDATE)에 가깝다.
- Claude 는 Edge 비밀값(OPENAI_API_KEY·OPENAI_MODEL)을 읽을 수 없음 → 대표가 화면 오류 문구 + Supabase Secrets 존재 여부 확인.

## 2026-09-14 후속
- v12(진단 로그 4줄) 배포 후 대표 재시도 **0건**(04:30 UTC 까지 함수 로그 없음) → 실패 코드 미확정. 재시도 대기.
- v11 실제 응답 판정: POST 200(4.9s) 이지만 conversations 0건 → 응답 본문 ok:false. "OPTIONS/부팅/200" 만으로 성공 처리하지 않음.
- 재발 방지: `docs/ops/edge-check/edge-predeploy-check.sh` (진입 파일 존재·내용·.txt 전용 차단·핸들러·모듈 지정자·슬러그·ref·verify_jwt·원본 SHA-256) + 픽스처 5/5. 현재 레포 index.ts 검사 OK. 이 검사 때문에 재배포하지 않음.
- 03:31 UTC 재확인: v12 이후 함수 로그 0건 → 대표 재시도 아직 없음. 실제 오류 코드 확인이 최우선(재배포·키 변경 없이 대기).

## 2026-09-14 Supabase 직접 진단 (Claude)
Claude 가 Supabase 에 직접 접속해 확인한 사실(Edge 비밀값 자체는 SQL 로 볼 수 없음 — 아래는 그 외 전부):
- vault.decrypted_secrets 에 OPENAI_* 없음(정상 — Edge secret 은 플랫폼 저장소, Postgres vault 아님). JWT secret·pg_net 접근 불가 → Claude 가 함수를 인증 요청으로 직접 호출할 수 없음(로그를 스스로 만들 수 없음).
- conversations 0건 · auth.users 3명. 운영에서 start 성공 이력 0.
- **오류 코드 분리(중요):** 화면 문구 "AI 응답을 받지 못했어요." = 서버 코드상 AI_ERROR 또는 NO_CANDIDATE. **AI_NOT_CONFIGURED 아님** → 서버 env 의 OPENAI_API_KEY·OPENAI_MODEL 은 **둘 다 비어 있지 않다**(값 존재 확정, 값 내용은 미확인).
- **지연 4.9s 해석:** 잘못된 키면 OpenAI 가 401 을 ~0.3s 에 돌려줌(빠름). 4.9s 는 OpenAI 호출이 실제로 여러 번(생성 3회 재시도) 실행됐다는 뜻 → genSingleQuestion 이 3회 반복. 이는 **호출은 성공하지만 결과가 검증(비어 있음/길이/금지어)에서 3회 탈락 → NO_CANDIDATE** 패턴에 부합. 특히 "빈 content" 는 reasoning 계열 모델(o1/o3/gpt-5 reasoning 등)이 chat.completions 에서 visible content 를 안 주거나, temperature/top_p/response_format 파라미터와 안 맞을 때 발생.
- **결론(Supabase 측):** 설정 누락·DB·네트워크 문제 아님. **OPENAI_MODEL 값이 현재 코드의 호출 방식과 맞지 않는 모델일 가능성이 가장 높다**(존재하지 않는 이름 또는 이 방식 미지원 모델). 확정은 (a) v12 진단 로그 1줄 또는 (b) GPT 의 OpenAI 측 검증으로.
- Claude 자체 OpenAI API 시험은 지시(#5)대로 하지 않음. 키 값 미출력·미변경.

## 2026-09-14 실행 증거 확보 — 원인 확정 (읽기 전용 로그 조회)
- 조회 가능: 예. 범위 = v12 배포(2026-09-14T02:54:29Z) ~ 2026-09-14T05:07:00Z.
- v12 POST 존재: 예(다수). 03:55:35 / 04:15:54 / 04:16:02 / 04:16:13 UTC.
- 동일 요청 실제 기록(예, 첫 건 03:55 UTC):
  - OPTIONS 200 (03:55:31.200Z) → 함수 로그 `[gsq] openai_http status=404 code=model_not_found model=gpt-40-mini` (03:55:35.154Z) → POST 200 exec 3858ms (03:55:35.170Z).
  - Edge HTTP 200 이지만 본문은 ok:false code=AI_ERROR(OPENAI_HTTP → catch → AI_ERROR). "200=성공" 아님.
- **원인 확정:** OPENAI_MODEL = `gpt-40-mini` (오타, 숫자 40). OpenAI 404 model_not_found. 올바른 값 `gpt-4o-mini`(알파벳 o).
- 정정: 이전 문서의 "4.9s→3회 호출/빈 content/NO_CANDIDATE" 추정은 실제 로그로 **반증됨**. 실제는 단일 404(HTTP 오류 경로, 재시도 없음). 추정을 확정 근거로 쓰지 않음.
- 최소 조치(1): Edge Secrets 의 OPENAI_MODEL 을 `gpt-4o-mini` 로 수정(즉시 반영, 재배포·코드 변경 불필요). 키 미변경. v13 미생성.

## 2026-09-14 05:20 UTC 수정 완료 (대표 지시: "다 고치고 완성")
- 확인: Supabase MCP 에는 Edge 시크릿(OPENAI_MODEL) 값을 편집하는 도구가 없음(로그·SQL·함수 배포만 가능). 시크릿 자체는 콘솔에서만 변경 가능.
- 조치: 시크릿에 의존하지 않도록 **함수 코드에서 방어**. `resolveModel()` 추가 — OPENAI_MODEL 이 비어 있거나 확인된 오타 `gpt-40-mini` 이면 `gpt-4o-mini` 로 보정, 그 외 값은 그대로 사용(대표 지정값 우선).
- 배포: get-step-question **v13** (2026-09-14T05:19 UTC, ezbr f9d84210…). get_edge_function 재조회로 배포본에 resolveModel + `const model = resolveModel(...)` 반영 확인. verify_jwt=true 유지. DB/RLS/RPC/결제/KEY/Netlify 변경 없음. 키 미변경.
- 한계(정직): Claude 는 인증된 사용자 요청을 스스로 만들 수 없어(JWT secret·pg_net 없음) **엔드투엔드 실행 확인은 대표 저장 1회 필요**. 배포 자체(코드에 gpt-4o-mini 반영)는 확인됨.
- 권장: 대표가 콘솔 Secrets 에서 OPENAI_MODEL 을 `gpt-4o-mini` 로 바로잡으면 코드 보정과 무관하게 깔끔(선택).

## 2026-09-14 실행 증거 최종 보고 (읽기 전용 · GPT 지시 "실행 증거 1건 확보")
① 로그 조회: 가능. 조회 범위 = 2026-09-14T02:54:29Z(v12 배포) ~ 06:30:00Z. 소스 function_edge_logs(OPTIONS/POST 구분)·function_logs([gsq]).
② v12 POST 존재: 있음 — 03:55:35 / 04:15:54 / 04:16:02 / 04:16:13 UTC(KST 12:55 / 13:15 / 13:16 / 13:16). v11 의 02:45 요청은 v12 로 쓰지 않음. v13(05:19:49Z 배포) 이후 요청: 0건(05:19~06:30 조회).
③ 동일 요청 실제 기록(첫 건, 실행 ID 없음 → 시각 연속성으로만 연결): OPTIONS 200 03:55:31.200Z → [gsq] openai_http status=404 code=model_not_found model=gpt-40-mini 03:55:35.154Z → POST 200 exec 3858ms 03:55:35.170Z. 응답 본문 ok/code 는 로그에 기록되지 않으나 코드 경로상 OPENAI_HTTP → AI_ERROR(HTTP 200). 다른 세 건도 동일 [gsq] 문자열.
④ 원인: **확정** — OPENAI_MODEL 시크릿 값 gpt-40-mini(존재하지 않는 모델) → OpenAI 404.
⑤ 최소 조치 1가지: 시크릿 OPENAI_MODEL 을 gpt-4o-mini 로 수정(콘솔, 재배포 불필요). ※ 지시 도착 전 대표 직접 지시로 v13(코드 보정) 이미 배포됨 — 되돌리지 않음. v13 실행 증거는 아직 0건(대표 저장 1회 필요).
