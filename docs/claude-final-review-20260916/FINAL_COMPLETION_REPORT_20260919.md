# ECHO SERVER CORE — 최종완성 보고서 (2026-09-19)

실측값만 적는다. 실행하지 않은 것은 "확인 불가"로 남긴다.
아직 대표도 실사용자도 실기기로 써 보지 않았다.

---

# 1부 · 대표께 쉬운 말로

## ① 최종 결론

**B — 100회 검사 도중 결함을 찾아 고쳤고, 고친 코드로는 10회만 다시 검사했다. 최종 코드로 100회를 다시 돌려야 확정된다.**

100회 검사는 **고치기 전 코드**(gsq v42 / ej v22)로 돌렸다.
지금 운영에 올라간 코드는 **그 뒤에 고친 코드**(gsq v44 / ej v24)다.
따라서 **"최종 코드로 100회 통과"라고 쓸 수 없다.**

## ② 100회 결과 (고치기 전 코드)

100번 다 돌렸다. 71번 끝까지 갔고, 23번 중간에 멈췄다.
멈춘 이유: 질문을 못 만듦 7번, AI 응답 지연 8번, 로그인 거절 8번.

## ③ 중간에 발견된 문제

1. 사용자가 "내가 언제 그렇게 말했어?"라고 물었는데 **답 없이 질문만** 돌려준 경우 — 22번.
2. 사용자가 **정정**했는데 다음 질문이 정정을 반영 못 한 경우 — 5번.
3. STEP 3·6·7에서 **질문 후보가 전부 막혀** 대화가 끝난 경우 — 7번.
4. OpenAI가 6초 안에 답을 못 줘서 끊긴 경우 — 40번(그중 8번은 대화가 끝남).

## ④ 실제로 고친 것

1. 답을 못 만들면 **사용자가 한 말을 그대로 인용해서 먼저 답한다**. 없는 말을 지어내지 않는다.
2. 정정이 반영 안 되면 **정정 문장 하나만 보고** 다시 만들게 한다(2번째 시도부터).
3. STEP 3~7에도 **마지막 구제**를 넣었다. 단, 안전·근거·거절 규칙은 구제하지 않는다.
4. OpenAI 호출을 **남은 시간만큼**(최대 9초) 기다리게 했다. 두 서버 모두.

## ⑤ 고친 뒤 검증 결과 (10회)

- **사용자 질문 무시 0번** ← 22번이던 것이 0
- **거절한 해석 재등장 0번**, **반말 0번**, **빈 화면 0번**
- 정정 무시 1번, 대화 중단 3번(AI 지연 1 + 질문 못 만듦 2)
- **10회밖에 안 했다.** 100회가 아니다.

## ⑥ 아직 남은 문제

1. **OpenAI 응답 지연** — 가장 많은 실패 원인. 40번 발생.
2. **제 판단 하나가 틀렸다:** "화면은 실패하면 자동으로 다시 요청한다"고 했는데 **아니다.**
   화면은 **"잠시 연결이 원활하지 않아요" 오류 화면 + "다시 시도하기" 버튼**을 보여준다.
   즉 **사용자 눈에 보이는 실패**다. 외부 문제라고 빼면 안 된다.
   제가 검사도구에 넣은 자동 재시도는 화면보다 **너그럽다** → 고친 뒤 숫자는 실제보다 좋게 나왔다.
3. 정정 무시 1번, 질문 고갈 2번이 10회 중에 남아 있다.

## ⑦ 지금 Server Core를 새 ECHO에 쓸 수 있는 정도

**판정 규칙 두 파일은 바깥 의존이 0이다. 그대로 복사해 쓸 수 있다.**
- `rules.ts` 37,004바이트 · `question-quality.ts` 30,989바이트
- 둘 다 import 0 · Deno 0 · fetch 0 · DB 0

다만 **같은 규칙이 두 벌로 나뉘어 있다**(이름 겹치는 정의 71개).
이번 결함 중 **4건이 "한쪽만 고쳐져 있었다"**에서 나왔다.

## ⑧ 다음 행동 — 딱 하나

**최종 코드(gsq v44 / ej v24)로 실AI 100회를 다시 돌린다.** 약 3시간.
(검사도구의 자동 재시도는 화면과 다르므로, 재시도 횟수를 따로 세어 함께 보고한다.)

---

# 2부 · CTO 기술 상세

## 2-1. 100회가 어떤 코드로 돌았는가 (가장 중요)

| 구간 | 코드 | 시각(UTC) |
| --- | --- | --- |
| Canary Gate (P0=0) | gsq v42 / ej v22 | 09-18 11:04~11:25 |
| **실AI 본검사 100회** | **gsq v42 / ej v22 (최종 아님)** | 09-18 11:25~14:12 |
| 100회에서 나온 결함 수정 배포 | gsq v43 → v44 / ej v23 → v24 | 09-18 14:25~14:46 |
| 수정 후 재검증 (10회) | **gsq v44 / ej v24 (최종)** | 09-18 14:49~15:12 |

→ **최종 코드 기준 100회는 실행되지 않았다. 확인 불가.**

## 2-2. 항목별 최종 숫자 (수정 전 → 수정 후)

"수정 전" = 실AI 100회 (100대화) · "수정 후" = 재검증 (10대화). 표본 크기가 다르다.

| 항목 | 수정 전 (100회) | 수정 후 (10회) | 출처 |
| --- | --- | --- | --- |
| 총 실행 | **100** | **10** | 결과 파일 행 수 |
| 정상 완료(완주) | **71** | **6** | `completed=true` |
| 실패·중단 | **23** | **3** | `stuck` |
| 인증 실패 | **8** (`UNAUTHORIZED_ASYMMETRIC_JWT`) | **0** | 클라이언트 |
| 서버 오류(클라 카운터) | **10** | **1** | 클라이언트 |
| AI_ERROR (중단) | **7** | **1** | 클라이언트 |
| BAD_JSON (중단) | **1** | **0** | 클라이언트 |
| AbortError (서버) | **40** | **3** | `openai_fetch_error name=AbortError` |
| HTTP 오류 (서버) | **0** | **0** | `openai_http` |
| 빈 응답 (서버) | **0** | **0** | `openai_empty` |
| timeout (무한대기) | **0** (클라 90초 상한 1건) | **0** | 클라이언트 |
| 사용자질문무시 | **6** | **0** | 클라이언트 표시 |
| `asked_reply_failed` | **22** (전부 `basis=1`) | **5** (전부 `basis=1`) | 서버 로그 |
| `reply_without_question` | **81** | **16** | 서버 로그 |
| `correction_ignored` 차단 | **14** | **1** | 서버 로그 |
| `correction_unreflected` | **7** | **1** | 서버 로그 |
| 정정무시 (화면 기준) | **5** | **1** | 클라이언트 표시 |
| 거절 의미 재등장 | **0** | **0** | 클라이언트 표시 |
| NO_CANDIDATE (중단) | **7** | **2** | 클라이언트 |
| ├ gsq | **0** | **2** | `[gsq] no_candidate` |
| └ ej | **7** | **1** | `[ej] no_candidate` |
| `diversity_exhausted` (새 구제) | **0** (미배포) | **1** | 서버 로그 |
| `understanding_unresolved` (구제) | **8** | **1** | 서버 로그 |
| `attempts_deadline` | **114** | **26** | 서버 로그 |
| 빈 응답 (화면) | **6** | **0** | 클라이언트 표시 |
| 반말 | **0** | **0** | 클라이언트 표시 |
| 중복(반복) 질문 | **35** | **7** | 클라이언트 표시 |
| 단계 비정상 증가 | **1** | **0** | `되물음후STEP증가` |
| 맥락무시(일반론) | **428** | **61** | 클라이언트 표시 |
| 검사도구 AI 자동 재시도 | **34** | **2** | 클라이언트 카운터 |

**주의:** `사용자질문무시`(화면에 답이 안 나옴)와 `asked_reply_failed`(서버가 답 후보를 못 만듦)는 다르다.
수정 후 `asked_reply_failed`는 5건 발생했지만 **5건 모두 `basis=1`**(사용자 원문 인용으로 답함) → 화면상 **사용자질문무시 0건**.

## 2-3. 사용자 질문 우선 — 최종

| 항목 | 값 | 검증 |
| --- | --- | --- |
| 사용자질문무시 최종 | **0건** | 캐너리 2회(2026-09-18 14:17·14:49, 각 10대화, 합계 20대화) 모두 0 |
| `asked_reply_failed` 최종 | **5건 / 10대화** (전부 `basis=1`로 구제) | 서버 로그 |
| 100회 시점 | 사용자질문무시 6 · `asked_reply_failed` 22 | 서버·클라이언트 |

**검증 횟수: 실AI 20대화(10×2). 100대화 재검증은 하지 않았다 → 확인 불가.**

## 2-4. 정정 처리 — 최종

| 요구 | 검증 여부 | 근거 |
| --- | --- | --- |
| 잘못된 의미 폐기 | **모의 PASS** | `qa/scene3-rejection-chain.test.mjs` |
| 사용자 원문 보존 | **모의 PASS** | `qa/rejected-key-overblock.test.mjs` (P0-06) |
| 정정 반영 | **실AI 부분 PASS** | 수정 후 10대화 중 정정무시 1건 |
| 같은 잘못된 의미 재등장 차단 | **실AI PASS** | 100회·재검증 모두 거절재등장 **0건** |

### `correction_unreflected` 7건

| 항목 | 내용 |
| --- | --- |
| 정확한 원인 | 정정 우선 규칙(`correction_ignored`)은 14번 정상 차단했으나, "근거를 정정 문장으로 좁히는 재시도"를 **마지막(3회째) 시도**에 두어 `attempts_deadline`(11초 예산)이 먼저 걸려 사실상 실행되지 않음 |
| 수정 위치 | `supabase/functions/get-step-question/ai.ts` · `genFollowupQuestion` 루프 |
| 수정 방식 | `focusOnCorrection = attempt === GENERATION_ATTEMPTS - 1` → **`attempt > 0`** (2번째 시도부터 좁힘). 시도 횟수는 그대로라 지연 비용 증가 없음 |
| 수정 후 재검증 | 실AI **10대화 1회** |
| 최종 발생 | `correction_unreflected` **1건** · 화면 정정무시 **1건** |

## 2-5. AI_ERROR / AbortError / timeout — 근거 분리

| 항목 | 실측 |
| --- | --- |
| 발생 건수 (100회) | 서버 `openai_fetch_error` **40건**, 전부 `name=AbortError` |
| HTTP/SDK 오류 | `openai_http` **0건** · `openai_empty` **0건** · `openai_truncated` **0건** |
| timeout 시간 | 수정 전 고정 **6,000ms** / 수정 후 남은 예산만큼, 상한 **9,000ms** (`callTimeoutMs`) |
| 발생 위치 | gsq `askback:step1` 다수, ej `step3·4·5·6·7` |
| 서버 내 재시도 | 없음. 시도 예산(`DEADLINE_MS` 11초) 안에서만 다음 시도 |
| 대화 중단으로 이어진 수 | **8건** (AI_ERROR 7 + BAD_JSON 1) |

### UI 실제 동작 vs 검사도구 — **제 앞선 판단 정정**

앞서 "화면은 UI와 같이 1회 재시도한다"고 썼다. **틀렸다.** 실제 코드:

`src/pages/do-it/components/StepQuestionScreen.tsx`
- `readyState.reason === 'in_progress'` 일 때만 대기 후 재요청 (동시성 충돌 전용)
- 그 외 실패 → `setPhase('error')`
- 화면: **"잠시 연결이 원활하지 않아요."** + 버튼 **"다시 시도하기"** (233~247행)

→ **AI_ERROR는 사용자 눈에 보이는 오류 화면이다. 자동 복구가 아니라 수동 재시도다.**

**결론(근거 있음):**
- 제품 규칙 결함인가 → **아니다.** 서버 규칙이 후보를 막은 것이 아니라 외부 API가 응답하지 않았다.
- 외부 API 지연인가 → **그렇다.** `AbortError` 40 / `openai_http` 0.
- 검사도구 결함인가 → **아니다. 반대다.** 검사도구의 자동 재시도가 화면보다 **너그럽다**.
  100회에서 자동 재시도 **34회**, 재검증에서 **2회** 발생했고, 실제 화면이었다면 그만큼 오류 화면이 더 보였을 것이다.
- **따라서 AI_ERROR를 제품 결함에서 빼지 않는다.** "사용자 눈에 보이는 실패 / 원인은 외부 API 지연"으로 분류한다.

### 수정(적응형 대기)의 효과

| 회차 | 코드 | AbortError | p95 |
| --- | --- | --- | --- |
| 100회 | 수정 전 | 40 / 100대화 (0.40) | 10,569ms |
| 재검증 | 수정 후 | 3 / 10대화 (0.30) | 12,628ms |

→ 표본이 10대화뿐이고 상류 지연이 회차마다 달랐다. **효과 확인 불가.** 대기 시간은 늘었다.

## 2-6. 성능

| 회차 | 코드 | 표본 | p50 | p75 | p95 | 최대 | 10초 초과 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Canary Gate | v42/v22 | 308 | 2,379 | 5,742 | 10,055 | 12,835 | 16 |
| **실AI 100회** | **v42/v22** | **2,160** | **2,765** | **5,331** | **10,569** | **90,013** | **125 (5.8%)** |
| 재검증 | v44/v24 | 271 | 3,265 | 7,669 | 12,628 | 22,661 | 33 (12.2%) |

- v17 기준선 대비: p50 4,548 → 2,765ms (개선), p95 6,930 → 10,569ms (악화)
- 최대 90,013ms는 클라이언트 `--max-time 90` 상한에 걸린 1건
- **수정으로 인한 순수 지연 변화는 확인 불가** (상류 지연이 회차마다 달라 분리 불가)

## 2-7. gsq / ej 최종 상태 (실측)

| 항목 | get-step-question | echo-journey |
| --- | --- | --- |
| 최종 버전 | **v44** | **v24** |
| ACTIVE | **예** | **예** |
| `verify_jwt` | **true** | **true** |
| 운영 파일 수 | 3 (index·rules·ai) | 2 (index·question-quality) |
| 운영 = 로컬 SHA-256 | **3/3 일치** | **2/2 일치** |
| 최종 수정 | 근거 제시 답변 · 정정 좁히기 2회차 · 관련성 완화 · 안 쓴 근거 이동 · 적응형 대기 | 정정 우선 규칙 · 다양성 구제 · 관련성 완화 · 적응형 대기 |
| salvage 구조 | `replyOnly`(답 실패) → `replyAlone`(질문 고갈) → `correctionOnly`(정정 미반영) | `replyOnly` → `correctionOnly` → **`diversityOnly`(신규)** |
| 마지막 구제 경로 | `groundedBasisReply` — 사용자 원문 인용 | `diversity_exhausted` — 반복 규칙만 걸린 후보 |
| 정정 처리 | `pendingCorrectionText`·`reflectsCorrection`·`correction_ignored`·2회차 좁히기 | `pendingCorrectionText`·`reflectsCorrection`·`correction_ignored` |
| 사용자 질문 우선 | `followupMode()==='asked'` → 단계 진행보다 답 우선 | `asked` 모드 동일 |
| timeout 처리 | `callTimeoutMs()` 6,000~9,000ms | `callTimeoutMs()` 6,000~9,000ms (리포트 경로는 별도 상한 유지) |
| 배포 | 완료 (CLI `--use-api`) | 완료 |

운영 SHA-256(앞 16자): gsq `b79390f722295734`·`893e5d7521c5e97a`·`96abc56cbc036c2c` / ej `6f13317108db602e`·`599dad5f727b888c`
추가 파일 0 · 누락 파일 0 · 부팅 오류 0 · 인증 없음 401 · 남의 대화 403 · 정상 200

## 2-8. 변경한 실제 파일 (전부)

### 제품 코드 (운영 반영 완료)

| 파일 | 변경 이유 | 변경 내용 | 현재 역할 | 운영 |
| --- | --- | --- | --- | --- |
| `get-step-question/rules.ts` (+62) | 정정 판정·관련성 과차단 | `correctionContentWords`·`reflectsCorrection`·`wordTokens`·`questionHasContent`·`contentTokens` 추가, `replyQualityReason`에 관련성 완화 인자, `BlockReason`에 `correction_ignored` | 순수 판정 규칙 | ✅ v44 |
| `get-step-question/ai.ts` (+172) | P0-08·P0-04·질문 고갈·지연 | `groundedBasisReply`·`pendingCorrectionText`·`unusedEvidenceParts`·`callTimeoutMs` 추가, `replyAlone`·`correctionOnly` 구제, reply 서식 줄 조건화, 진단 로그 | 프롬프트 조립·OpenAI 호출·구제 | ✅ v44 |
| `echo-journey/index.ts` (+79) | 정정·구제·지연 정합 | `pendingCorrectionText`·`correctionOnly`·`diversityOnly`·`callTimeoutMs`, `BlockReason`에 `correction_ignored`, 진단 로그 | STEP 3~7 상태머신 | ✅ v24 |
| `echo-journey/question-quality.ts` (+32) | gsq와 규칙 정합 | `correctionContentWords`·`reflectsCorrection`·`questionHasContent`, 관련성 완화 인자 | 순수 판정 규칙 | ✅ v24 |

### 검사 코드 (운영 무관)

| 파일 | 변경 이유 | 운영 |
| --- | --- | --- |
| `qa/reply-relevance.test.mjs` (신규 470줄) | P0-08·P0-09·관련성·질문 고갈·지연 고정 (검사 15개) | — |
| `qa/correction-first-question.test.mjs` (신규 161줄) | P0-04 고정 (검사 3개) | — |
| `qa/companion-rules.test.mjs` (+7) | 관련성 계약 변경을 명시 (내용어 없는 물음은 관련성 판정 안 함) | — |
| `LIVE/run100v2.mjs` (+63) | E그룹 빈 내용 수정 · 정정 판정 1회로 · AI 자동 재시도 · 재로그인 | — |
| `LIVE/judge.mjs` (+9) | 401을 P0-01로 세던 오분류 정정 | — |
| `LIVE/probe-reply.mjs`, `LIVE/check-correction-rule.mjs` (신규) | 원인 추적용 | — |

**프론트엔드 소스(`PATCH/src/`)는 이번에 한 줄도 변경하지 않았다.** (`git diff` 확인)

## 2-9. 운영 상태 — STOP 항목

| 항목 | 변경 |
| --- | --- |
| DB 스키마 | **없음** |
| RLS | **없음** |
| Migration | **없음** |
| Secret / 환경변수 | **없음** |
| AI 모델 | **없음** (`gpt-4o-mini` 유지) |
| Toss | **없음** |
| 가격 | **없음** (4,900원 단건 유지) |
| Netlify | **없음** |
| Readdy 이미지 | **없음** |
| 운영 사용자 데이터 | **없음** (검사 계정 1개로만 대화 생성. 조회는 집계·해시만) |

**대표 승인 없이 변경한 STOP 항목: 없음.**
운영 Edge Function 배포는 대표가 명시 승인한 범위(gsq·ej 최소 수정)에서만 했고, 매 배포마다 롤백본·SHA·ACTIVE·Smoke를 확인했다.

## 2-10. 최종 검사표

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| Canary (수정 전 Gate) | **PASS** | P0 0건 (10대화) |
| 실AI 100회 | **FAIL** | P0 22건 / 100대화 (수정 전 코드) |
| 수정 후 후속검증 | **목표 미달** | P0 4건 / 10대화 |
| build | **확인 불가** | `VITE_PUBLIC_SUPABASE_URL`·`ANON_KEY` 없어 의도적으로 차단됨. 프론트 무변경 |
| type check (프론트) | **PASS** | `npm run type-check` exit 0 |
| lint | **PASS** | `npm run lint` exit 0 (`--max-warnings 0`) |
| Edge type check | **PASS** | `tsc --strict --noUnusedLocals` exit 0, 5파일 |
| 서버 검사(qa) | **PASS** | 87개 중 85 통과 · 0 실패 · **2 todo** |
| 운영 함수 ACTIVE | **PASS** | gsq v44 · ej v24 |
| JWT | **PASS** | `verify_jwt=true` 양쪽, 인증 없음 401 · 남의 대화 403 |
| boot error | **PASS** | 0건 |
| 실제 사용자 질문 | **PASS (표본 20대화)** | 사용자질문무시 0건 |
| 정정 | **목표 미달** | 10대화 중 1건 미반영 |
| 거절 재등장 | **PASS** | 100회·재검증 모두 0건 |
| timeout | **FAIL** | AbortError 40건(100회), 8건이 대화 중단 |
| 인증 | **PASS** | P0-01(격리 실패) 0건. 401 8건은 서버가 거절한 것 |
| SCENE 3 8/8 | **모의 PASS · 실AI 확인 불가** | `scene3-rejection-chain.test.mjs` 통과. 실AI 별도 측정 안 함 |
| P0-10 미확정 사실화 | **확인 불가** | 자동 판정 수단 없음 |

## 2-11. Server Core 재사용 자산 (실측)

두 판정 모듈은 **바깥 의존이 0**이다.

| 모듈 | 크기 | export | import | Deno | fetch | createClient |
| --- | --- | --- | --- | --- | --- | --- |
| `supabase/functions/get-step-question/rules.ts` | 37,004 B | 90 | **0** | **0** | **0** | **0** |
| `supabase/functions/echo-journey/question-quality.ts` | 30,989 B | 47 | **0** | **0** | **0** | **0** |

### A. 그대로 재사용 가능

| 기술 | 실제 파일 | 실제 함수 | 의존 |
| --- | --- | --- | --- |
| 원문 보존 | `ai.ts` / `question-quality.ts` | `userEvidenceParts`, `historyText`, `userEvidenceText` | 없음 |
| 후보 → 확인 | `rules.ts` | `parseCandidates`, `filterCandidates`, `pickCandidate`, `blockReasonFor` | 없음 |
| Correction (정정 최우선) | `ai.ts`, `rules.ts`, `ej/index.ts`, `question-quality.ts` | `pendingCorrectionText`, `reflectsCorrection`, `correctionContentWords`, `correctionBlock`, `priorityNote` | 없음 |
| Rejected Semantic Block | `ai.ts`, `rules.ts`, `ej/index.ts` | `extractRejectedKeys`/`rejectedKeysOf`, `replyRevivesRejected` | 없음 |
| Information Status | `ej/index.ts` | `sectionGrounded` | 없음 |
| 질문 우선 처리 | `ai.ts`, `rules.ts` | `followupMode`, `isUserQuestion`, `isSelfDirectedQuestion`, `pendingUserQuestion`, `groundedBasisReply` | 없음 |
| 중복(의미) 차단 | `rules.ts`, `question-quality.ts` | `looksSame`, `repeatsQuestionIntent`, `questionIntent`, `bigrams` | 없음 |
| 응답 정리 | `rules.ts` | `tidyQuestionText`, `splitQuestionCandidates`, `cleanReply`, `politeOrSame`, `toPoliteKorean`, `hasBanmal` | 없음 |
| 빠져나갈 문 | `ai.ts`, `ej/index.ts` | `replyOnly`, `replyAlone`, `correctionOnly`, `diversityOnly`, `UNDERSTANDING_FALLBACK` | 없음 |
| 멱등성 | `gsq/index.ts`, `ej/index.ts` | `isValidToken`, `commitState`, `claim`/`commit`/`release`/`rollback` | conversations 테이블 |
| 동시성 | 같음 | 같음 | conversations 테이블 |
| 안전(금지어·없는 전제) | `rules.ts`, `question-quality.ts` | `containsForbiddenTerm`/`forbidden`, `hasUnsupportedPremise`, `premiseWithoutEvidence` | 없음 |
| 지연 예산 | `ai.ts`, `ej/index.ts` | `callTimeoutMs`, `LIMITS.DEADLINE_MS` | 없음 |

### B. 공통화 후 재사용 (지금 두 벌인 것)

두 서버에 **같은 이름으로 각각 정의된 것 71개** — 상수·타입 28 / 말투 6 / 문자열 8 / 판정 16 / 모델 I/O 7 / 파싱 6.
대표적으로 `LIMITS`, `PERSONA`, `normalizeKey`, `looksSame`, `hasBanmal`, `replyQualityReason`, `callOpenAI`, `parseCandidates`.
→ `core/` 한 벌로 합치면 "한쪽만 고쳐지는" 결함(이번에 4건)이 구조적으로 사라진다.

### C. 자기이해 전용이라 분리 필요

`gsq/index.ts`의 `STATUSES`·`AI_STEP`·`nextStatusAfterAnswer`, `ej/index.ts`의 `STEP_OBJECTIVES`·`STEP_LENSES`·`nextQuestionFocus`, `PERSONA`

### D. 새 ECHO에서는 제거 후보

`ej/index.ts`의 `genReport`·`parseReport`, `restoreLegacyWhiteDoor`, `openai-chat`(사주·타로), `doit-understanding`(v4에서 멈춤)

## 2-12. Profile / SCENE 3 재사용 판정

목표 구조: **사용자 원문 → AI Profile Candidate → [맞아요/조금 달라요/그게 아니에요/직접 설명할게요] → 확정·정정·거절**

| 단계 | 재사용 가능한 실제 코드 | 판정 |
| --- | --- | --- |
| 사용자 원문 | `userEvidenceParts`, `historyText` | **A 그대로** |
| AI Profile Candidate 생성 | `parseCandidates` → `filterCandidates` → `pickCandidate` (서버가 최종 결정) | **A 그대로** |
| 버튼 4종 | `rules.ts`의 `CHOICES = ["agree","alittle","no","explain"]`, `isChoice` | **A 그대로** |
| 확정 저장 | `understanding_results` 저장 경로 + `saveConfirmedMemory` | **B 공통화** (테이블명·필드만 교체) |
| 정정 반영 | `pendingCorrectionText` → `correction_ignored` 차단 → `correctionOnly` 구제 | **A 그대로** |
| 거절 차단 | `extractRejectedKeys` → `rejected_meaning`/`rejected_text` → `replyRevivesRejected` | **A 그대로** |
| 정보 상태(확정/후보) | `sectionGrounded` | **A 그대로** |
| 사용자 되물음 | `followupMode('asked')` → `groundedBasisReply` | **A 그대로** |

**자기이해 7단계는 복사하지 않는다.** `STEP_OBJECTIVES`·`STEP_LENSES`는 C(분리)로 분류했다.
Profile에 필요한 것은 **상태머신 뼈대 + 정정·거절·원문 보존·정보 상태·중복 차단**이고, 위 표대로 전부 존재한다.

## 2-13. 최종 판정

# **B**

**100회 중 결함 발견 → 수정 → 수정 후 부분 재검증(10대화) PASS → 최종 100회 재검증 필요.**

- A가 아닌 이유: 100회는 **수정 전 코드**로 돌았다.
- C가 아닌 이유: 발견된 P0 계열(P0-08·P0-04·P0-09 코드분)은 원인 확정 후 수정·배포했다.
- D가 아닌 이유: 외부 지연은 최다 실패 원인이지만, 100회 자체는 정상 실행됐고 판정을 막지 않았다.

## 2-14. 다음 행동 (하나)

**최종 코드 gsq v44 / ej v24 로 실AI 100회 재검증.**
- 소요: 약 3시간
- 함께 보고할 것: 검사도구 자동 재시도 횟수(화면은 자동 재시도하지 않으므로, 그 수만큼 실제 사용자에겐 오류 화면이 보인다)
