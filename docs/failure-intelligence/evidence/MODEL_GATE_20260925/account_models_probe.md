<!-- 출처: GitHub Actions echo-ab-real run 36107887216(job 107984489310, commit 809c3cd) 「계정 모델 확인」 단계 로그를 줄 앞 시각만 빼고 옮김. 키 없음(로그에서 ***). -->
# MODEL GATE 1단계 — 계정 모델 확인

- 조회 시각(UTC): 2026-09-25T07:29:38.581Z
- 계정에서 보이는 모델 132개 · 후보 규칙에 맞아 시험한 모델 10개
- 시험 조건 = B-1.0 과 같은 파라미터(temperature 0.2 · top_p 0.9 · max_tokens · json_object), max_tokens 만 32 로 줄임(짧은 확인용)

| 요청 모델 | 같은 파라미터로 됨 | HTTP | 응답의 실제 세부판 | 오류 코드 | 문제 파라미터 | 입력 토큰 | 출력 토큰 | 지연 ms |
|---|---|---|---|---|---|---|---|---|
| gpt-4.1 | 예 | 200 | gpt-4.1-2025-04-14 | - | - | 24 | 5 | 1331 |
| gpt-4.1-mini | 예 | 200 | gpt-4.1-mini-2025-04-14 | - | - | 24 | 5 | 750 |
| gpt-4.1-nano | 예 | 200 | gpt-4.1-nano-2025-04-14 | - | - | 24 | 5 | 331 |
| gpt-4o | 예 | 200 | gpt-4o-2024-08-06 | - | - | 24 | 5 | 618 |
| gpt-4o-mini | 예 | 200 | gpt-4o-mini-2024-07-18 | - | - | 24 | 5 | 340 |
| gpt-5 | 아니오 | 400 | - | unsupported_parameter | max_tokens | - | - | 70 |
| gpt-5-mini | 아니오 | 400 | - | unsupported_parameter | max_tokens | - | - | 93 |
| gpt-5-nano | 아니오 | 400 | - | unsupported_parameter | max_tokens | - | - | 329 |
| gpt-5.1 | 아니오 | 400 | - | unsupported_parameter | max_tokens | - | - | 348 |
| gpt-5.2 | 아니오 | 400 | - | unsupported_parameter | max_tokens | - | - | 72 |

- 시험 상한 10개에 걸려 o3·o3-mini·o4-mini·gpt-5.4·gpt-5.5 등은 시험하지 않았다(목록에는 있음) — 같은 파라미터로 되는지 **확인 안 함**.

## 계정에서 보이는 모델 전체(이름만)

babbage-002 · chat-latest · chatgpt-image-latest · davinci-002 · gpt-3.5-turbo · gpt-3.5-turbo-0125 · gpt-3.5-turbo-1106 · gpt-3.5-turbo-16k · gpt-3.5-turbo-instruct · gpt-3.5-turbo-instruct-0914 · gpt-4 · gpt-4-0613 · gpt-4-turbo · gpt-4-turbo-2024-04-09 · gpt-4.1 · gpt-4.1-2025-04-14 · gpt-4.1-mini · gpt-4.1-mini-2025-04-14 · gpt-4.1-nano · gpt-4.1-nano-2025-04-14 · gpt-4o · gpt-4o-2024-05-13 · gpt-4o-2024-08-06 · gpt-4o-2024-11-20 · gpt-4o-mini · gpt-4o-mini-2024-07-18 · gpt-4o-mini-search-preview · gpt-4o-mini-search-preview-2025-03-11 · gpt-4o-mini-transcribe · gpt-4o-mini-transcribe-2025-03-20 · gpt-4o-mini-transcribe-2025-12-15 · gpt-4o-mini-tts · gpt-4o-mini-tts-2025-03-20 · gpt-4o-mini-tts-2025-12-15 · gpt-4o-search-preview · gpt-4o-search-preview-2025-03-11 · gpt-4o-transcribe · gpt-4o-transcribe-diarize · gpt-5 · gpt-5-2025-08-07 · gpt-5-chat-latest · gpt-5-codex · gpt-5-mini · gpt-5-mini-2025-08-07 · gpt-5-nano · gpt-5-nano-2025-08-07 · gpt-5-pro · gpt-5-pro-2025-10-06 · gpt-5-search-api · gpt-5-search-api-2025-10-14 · gpt-5.1 · gpt-5.1-2025-11-13 · gpt-5.1-chat-latest · gpt-5.1-codex · gpt-5.1-codex-max · gpt-5.1-codex-mini · gpt-5.2 · gpt-5.2-2025-12-11 · gpt-5.2-chat-latest · gpt-5.2-codex · gpt-5.2-pro · gpt-5.2-pro-2025-12-11 · gpt-5.3-chat-latest · gpt-5.3-codex · gpt-5.4 · gpt-5.4-2026-03-05 · gpt-5.4-mini · gpt-5.4-mini-2026-03-17 · gpt-5.4-nano · gpt-5.4-nano-2026-03-17 · gpt-5.4-pro · gpt-5.4-pro-2026-03-05 · gpt-5.5 · gpt-5.5-2026-04-23 · gpt-5.5-pro · gpt-5.5-pro-2026-04-23 · gpt-5.6-luna · gpt-5.6-sol · gpt-5.6-terra · gpt-6-astra · gpt-6-luna · gpt-6-sol · gpt-audio · gpt-audio-1.5 · gpt-audio-2025-08-28 · gpt-audio-mini · gpt-audio-mini-2025-10-06 · gpt-audio-mini-2025-12-15 · gpt-image-1 · gpt-image-1-mini · gpt-image-1.5 · gpt-image-2 · gpt-image-2-2026-04-21 · gpt-image-2.5-flare · gpt-image-2.5-flare-2026-09-08 · gpt-image-2.5-sunburst · gpt-image-2.5-sunburst-2026-09-08 · gpt-live-1 · gpt-live-transcribe · gpt-realtime · gpt-realtime-1.5 · gpt-realtime-2 · gpt-realtime-2.1 · gpt-realtime-2.1-mini · gpt-realtime-2025-08-28 · gpt-realtime-mini · gpt-realtime-mini-2025-12-15 · gpt-realtime-translate · gpt-realtime-whisper · gpt-transcribe · o1 · o1-2024-12-17 · o1-pro · o1-pro-2025-03-19 · o3 · o3-2025-04-16 · o3-mini · o3-mini-2025-01-31 · o4-mini · o4-mini-2025-04-16 · omni-moderation-2024-09-26 · omni-moderation-latest · sora-2 · sora-2-pro · text-embedding-3-large · text-embedding-3-small · text-embedding-ada-002 · tts-1 · tts-1-1106 · tts-1-hd · tts-1-hd-1106 · whisper-1
