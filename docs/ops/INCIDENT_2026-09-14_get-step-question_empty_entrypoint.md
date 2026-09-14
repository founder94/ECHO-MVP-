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
