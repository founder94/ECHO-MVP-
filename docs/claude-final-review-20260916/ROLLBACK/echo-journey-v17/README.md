# echo-journey v17 복구본 (운영에서 그대로 내려받은 것)

2026-09-17, Supabase 프로젝트 `zyyhhxyupizcqhxqnxuu` 의 운영 Edge Function
`echo-journey` version 17 을 서버에서 조회해 **한 글자도 바꾸지 않고** 저장한 것이다.
사람이 손으로 옮겨 적은 사본이 아니다.

| 파일 | 크기 | SHA-256 |
|---|---|---|
| index.ts | 63,057 B | 44fb5b0ac22e161717421b8a3a38afeb9c5601475c378280d30b2cbebcb74270 |
| question-quality.ts | 28,550 B | 4776fbf297366532fabd7fb36e5518f0fe8d7d184fa568f89558b5c693a3f9ff |

## 쓰는 때
v18 을 올린 뒤 문제가 생겨 v17 로 되돌려야 할 때, 이 두 파일을 그대로 다시 배포한다.
되돌린 뒤에는 위 SHA-256 두 개가 서버에서 다시 나와야 한다.

## 쓰지 않는 때
이 폴더는 복구 전용이다. 여기 있는 파일을 고치거나, 개발의 기준으로 삼지 않는다.
개발 기준은 `../../PATCH/supabase/functions/echo-journey/` 다.

## 확인 명령
    sha256sum index.ts question-quality.ts
