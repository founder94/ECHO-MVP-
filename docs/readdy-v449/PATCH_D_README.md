# PATCH D — 마음 날씨 저장 무한 대기 방지 (로컬 구현·검사 완료 · 2026-09-14 · 운영 미반영)
대상 파일 2개: 신규 `src/lib/echo/startSave.ts`, 수정 `src/pages/do-it/weather-check/page.tsx` (diff: `PATCH_D_weather_save_timeout.diff`). 다른 화면·공용 인증·A 네트워크 미접촉.
- 라이브러리 계약: `@supabase/functions-js` 2.4.6 `invoke()` 는 AbortSignal 을 받지 않음 → 화면에서 30초 경쟁(race)으로 대기만 끝내고, 진행 중 fetch 는 그대로 둔다(서버 취소 아님).
- 유한 대기 30초 근거: 실측 성공 4.9초(콜드 2초 포함). 서버 실패 최악 25초×3=75초, 게이트웨이 상한 150초.
- 입력 보존: textarea 값·세션 임시 저장 유지. 성공/실패/취소(화면 이탈)/시간 초과 모두 `submitting=false`.
- 늦은 응답 무시: 이탈 후 도착 → `stale`. 시간 초과 후 도착 → 화면 변경 없음(컨트롤러만 in-flight 해제).
- 중복 방지: 요청 토큰은 성공 전까지 동일. 이전 요청이 서버에서 끝나기 전 재클릭 → `busy`(새 요청 0). 끝난 뒤 재시도 → 같은 토큰 → 서버가 기존 대화를 돌려줌. 새 토큰은 성공 뒤에만.
- 검사: type-check 0 / lint 0 / build 통과 · vitest 7/7(`readdy-review/weather-save/startSave.test.ts`) · 실제 화면 Playwright 5/5(`deploy/tests/browser/weather-save.browser.mjs`, 서버 무응답 모킹 → 30초 문구·입력 보존·busy·늦은 응답 무시·같은 토큰 재시도 성공 이동).
- 운영 반영 안 함(Publish·Edge·DB 변경 0). 래디 적용은 대표 승인 후 diff 그대로.
- 참고: 운영 DB `conversations` 에 `(user_id, request_token)` 유니크 인덱스 없음 → 서버측 최종 중복 방지는 `supabase/drafts/PENDING_대표승인_conversations_request_token_unique.sql` 초안(미실행).
