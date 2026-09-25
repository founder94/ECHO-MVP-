# ECHO AGENT v1.1 · FAIL #3 FIX REPORT (2026-09-24)

- 근거: 대표 「ECHO Relationship Agent v1.1 · LEVEL 3 FAIL #3 · ROOT CAUSE FIX · 코드수정 승인(로컬 구현 + 검사)」
- **운영 배포 0**
  - Supabase Edge 0 · Netlify 0
  - DB·Migration·RLS·Auth·Secret·모델·결제·가격·KEY 변경 0
- **검사는 모두 가짜 AI·가짜 DB 기준이다.** 실제 OpenAI 로 돌린 검사는 0회다.
- 판정: **Conversation P0 = FAIL 유지.** 이번 단계는 전략본부 검수 대기다.

## 1. 변경 파일

| 파일 | 내용 |
|---|---|
| `supabase/functions/doit-understanding/index.ts` | V16_SYSTEM 프롬프트 · 한 턴 입력(remaining 제거 · hot_context · rejected_directions) · 규칙 강제 축소 · 기억 3층 · 방향 거절 검사 · 관측 로그 · `recentOf` · `wordHeads`/`relevantToNow` · followup_skip 에 버린 방향 기록 |
| `src/doit/lib/coreConversation.ts` | `CoreRecentTurn` · 한 턴 요청에 `recent` 전달 |
| `src/doit/components/feature/CoreConversation.tsx` | 최근 대화 3줄 기억(`recentTurns`, 저장 안 한 말 포함) · 「처음부터 시작하기」 시 비움 |
| `qa/conversation-v16.test.mjs` | 기존 4개 새 기준으로 수정 + 새 검사 7개(FAIL #3 흐름 등) |
| `qa/core-conversation-question-state.test.mjs` | 새 검사 1개(앱이 저장 안 한 말을 recent 로 보냄) |
| `qa/conversation-rules.test.mjs` · `qa/conversation-continuity.test.mjs` | 코드 모양 검사 2곳 갱신(규칙 사용 횟수 14→16, `api.turn` 호출에 `recent`) |

- 바꾸지 않은 것:
  - RULES 블록(서버·앱·doit-connect 세 복사본 동일 유지) · doit-connect(9c2bac14…)
  - 홈페이지 · 디자인 · 날씨 화면 · 앱 아이콘
  - 옛 TOPICS·CHANGE_DIRECTION·no_bridge·anchor 복구 없음. 옛 관문 호출 0 — 검사로 확인.

## 2. 짧은 물음표 규칙 Before / After

- Before
  - `serverKind = ruleKind(text)` 가 강제였다.
  - `/^[^\s?]{1,6}\?+$/` 때문에 「취미생활?」·「활동?」·「왜?」·「그래서?」가 모두 **meta 로 확정**됐고, LLM 은 바꿀 수 없었다.
  - 「왜 그걸 물어봐?」는 ask 규칙으로 **ask 확정**이었다(= 같은 질문 유지).
- After
  - 한 턴 경로에서 규칙의 **meta·ask 판정은 강제하지 않는다.** LLM 이 last_question·hot_context 와 함께 뜻으로 가른다.
  - 규칙이 본 값은 로그 `rule` 로만 남는다.
- 그대로 강제(서버 HARD RULE):
  - 저장 금지 입력(연락처·식별번호·링크·성적 표현)
  - 지친 말(LLM 0번)
  - 설명 없는 「그게 아니에요」(LLM 0번)
  - 「모르겠어요」(unsure)
  - 분명한 불만 문장(complaint)
- 규칙 함수 자체(RULES 블록)는 바꾸지 않았다. 옛 앱 경로와 연결 자격 계산은 그대로다.

## 3. HOT CONTEXT Before / After

- Before
  - LLM 이 받는 최근 대화 = **저장된 답(doit_records)만** 최근 3개였다(`hot_memory`).
  - 저장 안 한 「취미생활?」·「너가 어떤 취미가 있냐고…」는 **다음 턴에 0**이었다.
- After(`hot_context`)
  - 앱이 매 요청에 이번 대화의 최근 3줄을 실어 보낸다: {AI가 물은 질문, 사용자가 한 말, 저장 여부, 말의 종류}.
  - 저장 안 한 말도 `saved:false` 로 들어간다.
  - 서버는 **DB 에 저장하지 않는다**. 길이 자르기·저장 금지 입력 거르기·최근 3줄만 다시 자른다.
  - 앱이 안 보내면(옛 44차 앱·새로고침) 저장된 답으로 만든다. 로그 `hot_from: client|records`.
- 프롬프트: 「saved 가 false 인 말은 사실로 쓰지 않지만, 사용자가 방금 무엇을 문제 삼았는지 알려 주므로 반드시 읽는다.」

## 4. Repair First Before / After

- Before
  - meta 지시 = 「last_question 과 같은 것을 훨씬 쉬운 말로 다시 묻는다」.
  - complaint 정의에 "다르게 물어 달라는 제안"이 없어, 그 말이 ask 로 가서 같은 질문이 유지됐다.
  - 문제제기 뒤 출발점은 직전 정상 답뿐이었다. 사용자가 제안한 방향(user_text)의 단서는 떨어졌다.
- After
  - complaint 정의에 추가: "질문 방향 자체를 문제 삼는 말, 그걸 묻는 게 아니라, 이렇게 물어봐야 하지 않냐처럼 다른 질문을 제안하는 말".
  - ask 정의에 추가: "직전 질문을 문제 삼거나 다르게 물어 달라는 말은 ask 가 아니라 complaint".
  - 짧은 물음표 판단 기준(뜻으로): 질문의 낱말을 되받아 당황하면 complaint·meta, 자기 답을 망설이며 내놓으면 answer.
  - complaint 처리 = REPAIR FIRST 5단계:
    - ① last_question 방향 폐기 ② 마지막 정상 답으로 돌아감
    - ③ 사용자가 원하는 방향을 말했으면 따르고, 아니면 다른 단서 ④ 필요하면 짧게 인정 ⑤ 새 질문 하나
  - 「같은 질문을 말만 쉽게 바꿔 다시 묻지 않는다」.
  - 서버: 문제제기의 출발점 = 마지막 정상 답 + 지금 말(user_text). 예시 질문 하드코딩 0.

## 5. Rejected Question Direction 구조

- AI **해석** 거절(기존): doit_insights rejected · 대화 중 「그게 아니에요」(followup_reject). 차단 목록 `rejected`.
- **질문 방향** 거절(신규)은 해석 거절과 따로 둔다: `rejected_directions`(이번 회차).
  - 출처 ①: 문제제기 턴이면 그때 문제 삼은 직전 질문. 기존 `followup_skip` 기록의 JSON(response_payload)에 `rejected_direction` 키로 남긴다(AI 문장이지 사용자 원문 아님 · **새 표·칸·Migration 0**).
  - 출처 ②: 앱이 보낸 최근 대화 가운데 kind=complaint 인 줄의 질문.
  - 출처 ③: 이 턴이 문제제기면 지금의 last_question.
- 검사(`checkV16Question`)는 둘 중 하나면 `rejected_direction` 으로 떨어뜨리고 1번 다시 만든다.
  - 거의 같은 문장: 이미 물은 질문과 같은 기준 `repeatsAsked`, 새 숫자 없음.
  - LLM 이 스스로 `repeats_rejected_direction:true` 로 표시.
- 뜻 수준 방향 판단은 LLM 몫이다(프롬프트: "낱말을 바꿔서도 같은 방향으로 다시 묻지 않는다").
- 특정 낱말(「활동」) 금지는 하지 않았다.
- 한계(확인 불가): 뜻은 같고 글자가 다른 재질문을 LLM 이 표시하지 않으면 서버는 못 잡는다. 판정 LLM 을 따로 부르지 않는 것은 1턴 1호출 원칙 때문이다.

## 6. remaining 제거 확인

- LLM 입력에서 `remaining`·`answered_count` 를 삭제했다. 검사 2곳으로 확인했다: 입력에 없음 + 한 턴 함수 코드에 없음.
- 역검사: `remaining` 을 되살리면 검사 3개가 실패한다.
- 다섯 칸 끝 판정은 서버에 그대로 있다(`willFinish`·`roundFinished`).

## 7. Memory Contract (3층)

| 층 | 내용 | 규칙 |
|---|---|---|
| A. HOT CONTEXT | 이번 대화 최근 3줄(저장 여부 무관) | 위 3 |
| B. RELEVANT CONFIRMED | 이번 회차 확인은 전부 · **지난 회차 확인은 사용자가 지금 같은 낱말을 다시 꺼냈을 때만** · 미확인 후보는 이번 회차 것만 | [휴리스틱] `relevantToNow`: 띄어 쓴 말의 앞 두 글자가 겹치는지(문장 끝 서술어 제외) |
| C. CORRECTION / REJECTION | 정정(corrected)·거절(rejected)·정정 전 문장(superseded)·대화 중 거절 | 회차 무관 전부 · 최우선 |

- 「처음부터 시작하기」는 장기 기억을 지우지 않는다(DB 삭제 0). 지난 확인 12개를 매번 전부 넣지도 않는다.
- 내 실수(개발 중 발견):
  - 처음에는 기존 글자쌍 겹침 기준(`overlapStats ≥ CONNECT_MIN`)을 썼다.
  - 그런데 「좋아해요」 같은 어미만 겹쳐도 「조용한 카페를 좋아해요」가 「테니스 치는 걸 좋아해요」와 관련 있다고 나왔다. 그래서 낱말 기준으로 바꿨다.
  - 이 기준도 휴리스틱이다(예: 「사람」처럼 흔한 낱말이면 넓게 들어간다) → **[휴리스틱 / 추가 검증 필요]**.
- 관측 로그: `confirmed_in`(넣은 수)·`confirmed_all`(전체)·`unconfirmed`·`hot_context`·`hot_unsaved`·`directions`.

## 8. Prompt 변경 원문

- 전문: `V16_SYSTEM_v1.1_원문.txt`
- 줄 단위 비교: `server_diff_v27_to_v1.1.patch`
- 주요 변경:
  - 삭제: 「활동·측면·가치관·내면 같은 딱딱한 낱말 대신 일상 말을 쓴다」 → 「일상에서 쓰는 쉬운 말로 묻는다」. 프롬프트에 「활동」 0 — 검사로 확인.
  - 우선순위 6: 「새로 알게 되는 것: 가장 마지막이다. 빈칸을 채우거나 정보를 모으려고 묻지 않는다.」
  - 긍정 원칙 추가: 「좋은 질문은 방금 사용자 말에서 출발하고, 그 안에서 가장 흥미로운 단서 하나를 골라, 사람이 실제로 궁금해할 법한 말로 한 단계만 나아간다. 정보 수집보다 대화가 이어지는 것이 먼저다.」
  - 우선순위 순서는 그대로 잠금(LOCK): 1 이어짐 → 2 궁금함 → 3 사람다움 → 4 가벼움 → 5 한 걸음 → 6 정보. 검사로 순서를 고정했다.
  - ask·meta·complaint 정의, 짧은 물음표 판단, REPAIR FIRST 5단계, rejected_directions·repeats_rejected_direction, hot_context·saved=false.
  - 고정 질문 예시 추가: 0.

## 9. LLM Calls (가짜 AI 기준)

- 정상 턴: 1회.
- 예외: 서버 필수 검사 탈락 시 1회 더 → 최대 2회(`V16_ATTEMPTS = 2` 그대로). 무한 재생성 없음.
- LLM 0회 경로는 그대로다: 지친 말 · 설명 없는 정정 · 다섯 번째 답(규칙이 종류를 정한 경우).
- 탈락 이유 코드(로그 `retry_reason`):
  - 기존: `no_question`·`multi`·`fixed_line`·`unsafe`·`self_flag`·`repeat`(= duplicate_question)·`rejected`·`clue`(= invalid_anchor)·`kind`·`parse`·`timeout`·`budget`
  - 신규: `rejected_direction`
  - 사용자 원문·질문 문장은 로그에 없다(검사로 확인).

## 10. FAIL #3 동일 흐름 결과 — 가짜 AI 기준 PASS

- 검사: `v1.1 FAIL #3 흐름`(qa/conversation-v16.test.mjs). 가짜 AI 는 운영에서 실제로 나간 문장을 그대로 흉내 낸다.

| 단계 | 확인한 것 | 결과 |
|---|---|---|
| ① 「이상이던 동성이던 편한친구 찾고 싶어」 | 저장 · 칸 1 · LLM 입력에 remaining·answered_count·direction·hints·topic 없음 | PASS |
| ② 「취미생활?」 | 서버가 meta 로 강제하지 않음(`server_turn_type` 없음, `rule:"meta"` 관측만) · 저장 0 · 칸 0 · 이해 0 | PASS |
| ③ 「너가 어떤 취미가 있냐고…」 | 저장 안 한 「취미생활?」이 `hot_context` 에 `saved:false` 로 있음 · last_answer = 첫 답 · complaint · 문제 삼은 질문을 또 내면 `rejected_direction` 으로 탈락 → 다시 만든 질문 · 버린 방향을 기록에 남김 | PASS |
| ④ 「싸이클 테니스 골프」 | 저장 · 칸 2 · hot_context 3줄(저장 안 한 2줄 포함) · rejected_directions 에 버린 질문 포함 · 첫 질문 되풀이(운영 실패 모양)면 `repeat` 로 탈락 → 2번째 후보로 **질문 생성** · 이 턴 LLM 2번 | PASS |

- 「활동」 점프 자체(①의 질문 품질)는 **가짜 AI 가 운영 문장을 그대로 흉내 냈으므로 이 검사로 판정하지 못한다.** 실제 OpenAI + 대표 LEVEL 3 로만 판정한다.

## 11. FAIL #1 / #2 회귀 — 가짜 AI 기준 PASS

- FAIL #1 「그냥 편한친구 부담없이」(v16 A·A-2·A-3): 통과.
- FAIL #2 「활동?갑자기?」(v16 B·B-2·B-2b·B-2c·화면↔서버): 통과. 문제제기 저장 0·칸 0, 버린 방향 재질문 탈락.
- 추가 회귀 13항목:

| 항목 | 결과 | 검사 |
|---|---|---|
| 「활동?갑자기?」 | PASS | v16 B·B-2 |
| 「왜 그걸 물어봐?」 | PASS — 강제 분류 0 | v1.1 짧은 물음표·F |
| 「모르겠어요」 | PASS — unsure 규칙 유지 | v16 E·v1.1 |
| 「그게 아니에요」 | PASS — LLM 0 | v16 G·v1.1 |
| 정정 설명 | PASS | v16 G-2 |
| 짧은 정상 답 | PASS | v16 C |
| 긴 정상 답 | PASS | v16 D |
| 질문 | PASS — ANSWER FIRST | v16 F·Agent v1 |
| 문제제기 | PASS | v16 B·v1.1 B-2c |

- 새로고침 뒤 버린 방향 유지: PASS(`v1.1 새로고침 뒤`).

## 12. 전체 검사

| 항목 | 결과 |
|---|---|
| 전체 검사(가짜 AI·가짜 DB) | **525개 중 520 통과 / 실패 0 / 미확정 5**(전과 같은 목록: 휴리스틱 공격 2 · 옛 STEP 흐름 3, LEGACY-01 포함) |
| v16·v1.1 서버 검사 | 36/36 |
| 화면 검사(대화 상태) | 36/36 |
| 역검사(장치 7개를 하나씩 되돌림) | **7/7 잡음** — M1 규칙 강제 복구(3) · M2 앱 최근대화 무시(1) · M3 방향 검사 제거(3) · M4 remaining 복구(3) · M5 지난 회차 전부(1) · M6 방향 기록 안 함(3) · M7 문제제기 출발점 축소(2). 끝난 뒤 원본 지문 `c8c0cf85…` 복구 확인 |
| type-check | 0 |
| lint | 0 |
| build:app · build:brand | 0 · 0 |
| 서버 엄격 타입(doit-understanding · doit-connect) | 0 · 0 |
| npm audit | 취약점 0 |
| 앱 화면 18개(360·390·430 × 6경로, 로그아웃 상태) | 18/18 |

- 내 실수(검사 중):
  - ① 기억 검사의 시각 문자열을 `10:00:00:00` 으로 잘못 만들어, 회차가 무효가 된 채 실패했다 → 검사를 고쳤다.
  - ② 화면 검사에서 다른 실행 공간의 배열을 그대로 비교해 같은 값인데 실패했다 → 값 비교로 고쳤다.
  - ③ 역검사 M7 을 처음엔 줄바꿈 기호를 잘못 옮겨 적용하지 못했다 → 따로 다시 돌려 2개가 잡히는 것을 확인했다.

## 13. 확인 불가

- 실제 OpenAI 가 새 프롬프트·맥락으로 만드는 질문 품질: 「활동」 점프가 사라지는지, 방향 거절을 스스로 표시하는지, 「취미생활?」을 answer 로 볼지 문제제기로 볼지.
- 실제 지연시간: 입력이 조금 길어졌다(hot_context·rejected_directions).
- iPhone·Galaxy 실기기.
- 새로고침 뒤 저장 안 한 말은 앱이 기억하지 못한다(DB 저장 0 원칙) → 버린 방향은 서버 기록으로 남지만, 저장 안 한 말 원문은 맥락에서 빠진다.

## 14. 위험

- 규칙 강제를 풀었다 → 진짜 되물음을 LLM 이 answer 로 저장할 수 있다(FAIL #2 재발 가능).
  - 막는 것: 프롬프트 정의 · 「이 말은 답으로 남길게요」의 반대 방향 빠져나갈 문은 없음. 실AI 확인 필요.
- 앱이 보낸 최근 대화는 사용자 입력이다 → 길이·저장 금지 거르기를 적용했다. 사실로 저장하지 않는다.
- 문제제기 턴의 출발점에 user_text 를 더했다 → 「활동?」처럼 문제 삼은 낱말을 단서로 다시 물을 수 있다. 방향 검사(거의 같은 문장·자기 표시)로 막지만, 뜻만 같은 재질문은 LLM 의존이다.
- 지난 회차 기억 선택은 휴리스틱이다(흔한 낱말이면 넓게, 다른 말로 같은 주제면 빠짐).
- 입력 토큰이 소폭 늘었다(최근 3줄 + 방향 목록) — 지연 영향 미측정.

## 15. 운영 배포 필요 대상 (승인 시 · 순서대로)

1. Supabase `doit-understanding`(현재 버전 27 → 새 버전)
2. Netlify `doitmobile` 앱 45차 ZIP

- 홈페이지·doit-connect: 대상 아님.
- 새 서버는 옛 앱(44차)과 호환된다(recent 가 없으면 저장된 답으로 맥락을 만든다). 앱만 먼저 올려도 서버는 recent 를 무시하지 않지만, 설계대로 **서버 먼저**.

## 16. 후보 SHA-256

`CANDIDATES_SHA256.txt` 참고.

- 서버: `c8c0cf85efb9c2cf9a8a39fcf6fe1f26385d3df433f9f4c3d11a0d69ea503f9e`(236,895바이트)
- 앱 ZIP: `725cc5a64ed9aab3ce76b8cf368fb124209cb25315fc8c9f97cb6049c7142cda`(149개)
- 되돌리기: `rollback/doit-understanding.v27.ts`(`1aab6423…`)

## 대표용 세 문장

1. **활동 점프**: AI에게 "남은 칸 수"를 더는 주지 않고, 정보 모으기를 우선순위 맨 끝으로 못 박았습니다. 방금 대표님 말의 핵심에서 한 걸음만 가도록 원칙을 다시 적어서, 칸 채우기용 질문으로 건너뛸 이유를 없앴습니다(실제 AI로 확인 전).
2. **취미생활 반복**: 짧은 「취미생활?」을 서버가 "질문 뜻 모름"으로 강제 판정하지 않고 AI가 뜻으로 가르게 했습니다. 저장하지 않은 말도 다음 턴 AI에게 그대로 전달합니다. 「이렇게 물어봐야지」는 문제제기로 받아 그 질문 방향을 버리고 새로 묻게 했습니다.
3. **질문 실패**: 이제 AI가 대화 흐름(저장 안 한 두 말 포함)과 버린 질문 방향을 함께 보고 질문을 만듭니다. 같은 질문 틀을 되풀이하면 이유를 알려 주고 한 번만 다시 만들게 했고, 이 흐름을 그대로 재현한 검사에서 질문이 나왔습니다(가짜 AI 기준).
