# 롤백 복구본 (운영에서 그대로 내려받은 것)

각 폴더는 그 시점 운영 Edge Function 을 **한 글자도 바꾸지 않고** 저장한 것이다.
사람이 손으로 옮겨 적은 사본이 아니다. 되돌릴 때는 이 파일들을 그대로 다시 배포한다.

| 폴더 | 함수 | 시점 | 파일 / SHA-256 |
|---|---|---|---|
| `echo-journey-v17/` | echo-journey | v17 | index.ts `44fb5b0a…` · question-quality.ts `4776fbf2…` |
| `echo-journey-v18/` | echo-journey | v18 | index.ts `7aadfa2e…` · question-quality.ts `4776fbf2…` |
| `get-step-question-v32/` | get-step-question | v32 | index.ts `b79390f7…` · rules.ts `e41272e3…` · ai.ts `2e39eb28…` |

## 되돌리는 법
해당 폴더를 `supabase/functions/<함수이름>/` 구조로 두고

    supabase functions deploy <함수이름> --project-ref zyyhhxyupizcqhxqnxuu --use-api

되돌린 뒤 서버에서 파일을 다시 받아 위 SHA-256 이 그대로 나오는지 반드시 대조한다.

## 쓰지 않는 때
복구 전용이다. 여기 파일을 고치거나 개발 기준으로 삼지 않는다.
개발 기준은 `../PATCH/supabase/functions/` 다.
