# 운영판 에이전트(echo-agent-v3.5) 재생 — 실제 AI(gemini)

- agent.ts SHA-256 33824d09ac106790… · test-flows 95c59a923c84adc9… · Golden 3100d5d461a49795… · 사전 등록 일치: 예
- 모델: gemini:gemini-3.5-flash-lite · temperature 0.2 · top_p 0.9 · max_tokens 768 · json_object · 한 턴 상한 2(+마칠 때 1) · 첫 질문 = 목적 타일(고정)

## 합계

| 항목 | gemini:gemini-3.5-flash-lite |
|---|---|
| runs | 4 |
| turns | 34 |
| calls | 16 |
| http_errors | 13 |
| errors | 32 |
| retries | 33 |
| input_tokens | 3874 |
| output_tokens | 206 |
| served_models | gemini-3.5-flash-lite |
| max_core_questions | 2 |
| over_5 | 0 |
| max_clarify | 0 |
| finished_runs | 0 |
| questions_after_finish | 0 |
| complaint_saved | 0 |
| help_turns | 0 |
| help_classified | 0 |
| help_saved | 0 |
| help_counted | 0 |
| questions_with_hint | 0/1 |
| hint_max_len | 0 |
| abstract_questions | 0 |
| question_len_p50 | 33 |
| ask_added_question | 0 |
| tone_mismatch_turns | 0 |
| sample_copy | 0 |
| repeated_reply | 0 |
| same_question_again | 0 |
| recovered_turns | 0 |
| f2_boundaries_confirmed | 0/0 |
| id_leak | 0 |
| banned | 0 |
| confirmed_items | 1 |
| inferred_items | 0 |
| intro_ready | 0/0 |
| intro_status | none,none,none,none |
| intro_dropped | {} |
| intro_chars_max | 0 |
| intro_self_claim | 0 |
| heavy_questions | 0 |
| example_copy | 0 |
| questions_total | 1 |
| evaluative_ack | 0 |
| stiff_word_reply_intro | 0 |
| correction_lead_missed | 0 |
| intro_has_superseded | 0 |
| f5_old_value_active | 0 |
| emotion_assumption_ack | 0 |
| correction_to_stop | 0 |
| superseded_in_intro | 0 |
| f6_old_value_active | 0 |
| empty_profile | 0 |
| already_answered_reask | 0 |
| correction_lead_missed_v29 | 0 |
| correction_raw_lost | 0 |
| reask_after_correction | 0 |
| recovery_turns | 0 |
| recovery_calls | 0 |
| max_recovery_per_run | 0 |
| unnecessary_after_calls | 0 |
| after_calls_total | 0 |
| f7_recovered | 0/0 |
| content_bridge_shown | 0/0 |
| content_result_as_fact | 0 |
| content_in_intro | 0 |
| content_matching | 0 |
| rebuttal_reappearance | 0 |
| rebuttal_user_words_kept | 0/0 |
| latest_correction_missing_in_intro | 0 |
| cached_input_tokens | 0 |
| retry_reasons | {"provider":32,"speak_provider":1} |
| cost_same_set | {"runs":4,"turns":34,"calls":16,"retries":33,"input_tokens":3874,"cached_tokens":0,"output_tokens":206} |
| rebuttal2_reappearance | 0 |
| rebuttal2_user_words_kept | 0/0 |
| covered_reask | 0 |
| intro_overwrite | 0 |
| raw_verbatim_leak | 0 |
| intro_casual_line | 0 |
| semantic_reask | 0 |
| ack_question_completion | 0 |
| unconfirmed_fact_ack | 0 |
| early_finish_runs | 0 |
| question_banned_words | 0 |
| ack_example_copy | 0 |
| unconfirmed_fact_ack_v213 | 0 |
| early_finish_v213 | 0 |
| redirect_turns | 0 |
| complaint_forced_question | 0 |
| redirect_finish | 0 |
| meta_saved_as_fact | 0 |
| post_redirect_answer_lost | 0 |
| redirect_empty_reply | 0 |
| rich_answer_padding | 0 |
| input_types | {"NORMAL_ANSWER":1,"-":32,"SKIP":1} |
| actions | {"ASK_GAP":2,"-":32} |
| speak_fallback_turns | 0 |
| blank_turns | 0 |
| generic_listen_lines | 1 |
| generic_listen_after_redirect | 1 |
| speak_recovery_types | {"PARSE_FAILURE:server":1} |
| salvaged_questions | 0 |
| salvage_dropped | 0 |
| skip_closed | 0 |
| superseded_stale_in_intro | 0 |
| listen_answer_lost | 1 |
| raw_kept_unconfirmed | 0 |
| raw_kept_promoted | 0 |
| redirect_saved | 0 |
| server_emptied_reply | {} |
| recovery_calls_v31 | 0 |
| intro_rebuild_calls | 0 |
| emotion_assumption_v32 | 0 |
| early_finish_v32 | 0 |
| double_question_turns | 0 |
| after_close_question_acts | 0 |
| fatigue_continued | 0 |
| close_complaint_generic | 0 |
| role_reversal_in_intro | 0 |
| router | on |
| router_calls_by_provider | {"gemini:ok":3,"gemini:error":13} |
| router_roles | {"PRIMARY":3} |
| router_fallbacks | 0 |
| router_real_calls_non_openai | 3 |
| router_server_rejected | 0 |
| provider_errors | {"http_429:429:429:RESOURCE_EXHAUSTED":13} |
| provider_retry_attempts | {"http_429:429:429":79} |
| format_failures | 0 |
| ending_dominated_runs | 0 |
| ending_family_ratio | 50% |
| question_only_streak_turns | 0 |
| label_copy_questions | 0 |
| unsupported_thanks | 0 |
| speaker_in_reply | 0 |
| rejected_restated | 0 |
| echo_replies | 0 |
| turn_ms_p50 | 0 |
| turn_ms_p95 | 239600 |

## gemini:gemini-3.5-flash-lite · F1 · 말투 polite · 핵심 질문 2 · 되묻기 0 · 안 끝남

| # | 사용자 | 종류·저장 | 출력 |
|---|---|---|---|
| 1 | 친구같이 편한사람 | answer·저장·core:attraction_comfort | 💬 친구처럼 편한 사이가 가장 좋군요. / ❓ 그렇게 편한 사이가 되면 주로 어떤 이야기를 나누게 되나요? |
| 2 | 깉이 있을때 어색하지않는 | - | ⚠️ PROVIDER |
| 3 | 다음질문으로 넘어가 잘문이 너무 무겁다 | skip·복구:PARSE_FAILURE:server | 💬 네, 이어서 편하게 말해 주세요. |
| 4 | 아 어렵네 | - | ⚠️ PROVIDER |
| 5 | 외롭진 않지 | - | ⚠️ PROVIDER |
| 6 | 웅 | - | ⚠️ PROVIDER |
| 7 | 그건 나도 잘몰라 | - | ⚠️ PROVIDER |
| 8 | 응 | - | ⚠️ PROVIDER |
| 9 | 느낌 근데 질문이 왜케 많아? | - | ⚠️ PROVIDER |

## gemini:gemini-3.5-flash-lite · F1 · 말투 formal · 핵심 질문 1 · 되묻기 0 · 안 끝남

| # | 사용자 | 종류·저장 | 출력 |
|---|---|---|---|
| 1 | 친구같이 편한사람 | - | ⚠️ PROVIDER |
| 2 | 깉이 있을때 어색하지않는 | - | ⚠️ PROVIDER |
| 3 | 다음질문으로 넘어가 잘문이 너무 무겁다 | - | ⚠️ PROVIDER |
| 4 | 아 어렵네 | - | ⚠️ PROVIDER |
| 5 | 외롭진 않지 | - | ⚠️ PROVIDER |
| 6 | 웅 | - | ⚠️ PROVIDER |
| 7 | 그건 나도 잘몰라 | - | ⚠️ PROVIDER |
| 8 | 응 | - | ⚠️ PROVIDER |
| 9 | 느낌 근데 질문이 왜케 많아? | - | ⚠️ PROVIDER |

## gemini:gemini-3.5-flash-lite · F1 · 말투 casual · 핵심 질문 1 · 되묻기 0 · 안 끝남

| # | 사용자 | 종류·저장 | 출력 |
|---|---|---|---|
| 1 | 친구같이 편한사람 | - | ⚠️ PROVIDER |
| 2 | 깉이 있을때 어색하지않는 | - | ⚠️ PROVIDER |
| 3 | 다음질문으로 넘어가 잘문이 너무 무겁다 | - | ⚠️ PROVIDER |
| 4 | 아 어렵네 | - | ⚠️ PROVIDER |
| 5 | 외롭진 않지 | - | ⚠️ PROVIDER |
| 6 | 웅 | - | ⚠️ PROVIDER |
| 7 | 그건 나도 잘몰라 | - | ⚠️ PROVIDER |
| 8 | 응 | - | ⚠️ PROVIDER |
| 9 | 느낌 근데 질문이 왜케 많아? | - | ⚠️ PROVIDER |

## gemini:gemini-3.5-flash-lite · FLOW1 · 말투 polite · 핵심 질문 1 · 되묻기 0 · 안 끝남

| # | 사용자 | 종류·저장 | 출력 |
|---|---|---|---|
| 1 | 가볍게 우선 사람을 알아가고 싶어 | - | ⚠️ PROVIDER |
| 2 | 나 진심이라고 적은거 같은데 | - | ⚠️ PROVIDER |
| 3 | 마음이지머 | - | ⚠️ PROVIDER |
| 4 | 행동으로 보여줄때 | - | ⚠️ PROVIDER |
| 5 | 적었자네 | - | ⚠️ PROVIDER |
| 6 | 몇번째 같은말이야!! | - | ⚠️ PROVIDER |
| 7 | 행동이라고!! | - | ⚠️ PROVIDER |