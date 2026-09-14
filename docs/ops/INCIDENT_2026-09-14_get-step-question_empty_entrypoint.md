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
