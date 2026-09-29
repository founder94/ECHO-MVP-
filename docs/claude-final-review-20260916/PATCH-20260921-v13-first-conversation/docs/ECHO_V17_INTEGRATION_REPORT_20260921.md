# v17 기준 소스 비교 · 통합 수정안 · 검사 결과 (2026-09-21)

**원본·기존 작업본·DB·Auth·Secret·모델·운영 데이터·배포 변경 0건.** 모든 작업은 별도 복사본(`check-v17`, `check-v17-limit`)에서 했다.

## 0. 기준 소스 수령 확인

| 항목 | 값 |
|---|---|
| 파일 | `ECHO-DOIT-CORE-SOURCE-20260921-v17.zip` (1,199,229 bytes) |
| SHA-256 | `612def1f26b3d9295acd060e00ec733c4f453fb11a15367abc1f8b832b2631b7` — **대표 제시값과 일치** |
| 내용 | 363 파일. 기존 작업본(ENTRY 체크포인트 20260920) 대비 신규 36 · 변경 36 · 삭제 0 |
| 의존성 | package.json 의존성 = 기존 작업본과 동일(차이 0) → 기존 node_modules 로 검사 가능 |
| v17 자체 상태(수정 전) | type-check PASS · lint PASS · v17 동봉 QA 테스트 35/35 PASS · 사진 계약 테스트 36/36 PASS |

**결론: v17 이 기준 소스다.** 2판 패치(EchoTalk 계열)는 v17 에 없는 동작만 이식했고, 나머지는 v17 을 그대로 쓴다. 파일 삭제 없음.

## 1. 파일별 비교표 (v17 ↔ 2판 패치 r2)

| 구성 | v17 | 2판 패치(r2) | 판정 | 통합안에서 |
|---|---|---|---|---|
| 프로필 저장 `profileSave.ts` | UPDATE(id 제외)→INSERT→23505 재시도 + 세션 확인 + 반환 행 검증 | UPDATE→INSERT→23505 재시도 | **동일 원인·동일 해법**(v17 이 더 엄격) | **v17 채택**, r2 폐기 |
| 대화 화면 | `CoreConversation.tsx`(179줄) + `conversation/page.tsx` + 라우트 `/doit/conversation` | `EchoTalk.tsx`(624줄), start-journey 안 step | v17 = 열린 대화(길이 제한 없음, 후보 1개씩 표시), r2 = 5응답 예산 | **v17 채택** |
| API 계층 | `coreConversation.ts`(포트+응답 검증) | `echoTalkApi.ts` | v17 이 응답 형식 검증까지 함 | **v17 채택** |
| 첫 진입 선택 | start-journey `conversation-choice`(대화 / 먼저 프로필) + `?edit=profile\|photos` | `shouldOfferTalk()` 서버 판정 + '나중에' 표시 | v17 = 사용자가 고른다, r2 = 서버 상태로 자동 판정 | **v17 채택**(선택권이 명확) |
| STALE_CONTEXT | 보관 requestId 폐기 후 **사용자 재시도** | 폐기 후 **자동 1회 재시도** | r2 가 한 단계 더 | **r2 이식** (write 포트 1곳) |
| 직접 설명 | 거절 → `insight_self`(origin=self) — 편집기 상태(메모리)에 `rejected` 표시 | 거절 → self + **세션 예약(pendingSelf)** 으로 새로고침 뒤 복구 | v17 은 새로고침하면 설명 유실 | **r2 이식** (`conversationRecovery.ts` 신규 + 3곳) |
| 복원 | 서버 목록으로 후보 복원, 후보 0이면 "다시 살펴보기"(서버 캐시 → AI 재호출 0) | `talkStatus()` 로 처음/진행/완료 판정 | v17 은 열린 대화라 '완료' 개념 없음 | v17 채택, `talkStatus` 불필요 |
| 다음 질문 | `VITE_ECHO_FOLLOWUP_ENABLED` 빌드 스위치 + "이어서 이야기하기" **버튼**(사용자가 누름) | 후보 처리 끝나면 **자동** 생성 | v17 = AI 비용·의도 통제(재무 기준 "자동 반복 AI 호출 줄임"과 일치) | **v17 채택** |
| 후보 수 제한 | 없음 | `limit` 제안 | — | **별도 수정안**(§3) |
| 서버 함수 `doit-understanding` | v17 동봉본에 followup·begin/finish·provider 진단 있음(= v8 기능). 모델 보정 없음(`OPENAI_MODEL` 그대로) | — | 운영 v8 과 바이트 동일 여부는 **미확인**(번들 해시만 비교 가능) | **별도 수정안**(§2) |
| DB 초안 | `PENDING_20260921_doit_followup.sql`, `doit_revision_lock.sql` + 격리 SQL 테스트·리뷰 문서 | — | 운영에 적용된 마이그레이션 `20260920180917` 의 원본으로 추정(확인 불가) | 참고 |
| EchoTalk 에서 재사용한 것 | — | STALE 자동 재시도 로직, pendingSelf 저장 모듈, 브라우저 모의 하네스(모의 서버·조작 수 카운터) | — | 3가지 이식, 나머지는 보관(폐기 아님, 적용 안 함) |

## 2. 모델 이름 보정 — 단독 수정안 (변경 없음, r2 §1 과 동일)

`supabase/doit-understanding-v9-model-resolve.patch.md`. **확인 사실:** v17 동봉 함수도 운영 v8 과 같이 `OPENAI_MODEL` 을 보정 없이 쓴다(702행). B 는 `resolveModel()` 로 보정한다. **실제 오류 해결 여부는 보정 배포 후 실AI 검사로만 판정.** Secret·키 요구·변경 없음.

## 3. 후보 수 제한 — 별도 수정안 (v17 기준으로 다시 작성)

- 서버: `supabase/doit-understanding-v9b-candidate-limit.patch.md` (r2 와 동일: 생성→검사→서버가 자름→저장=반환=캐시, `limit` 없으면 v8 동작, 0개 허용).
- 클라이언트(v17 기준, 선택): `optional-candidate-limit/CLIENT-limit-v17.diff` (+8 −3). `coreConversation.generate(recordId, limit?)`, CoreConversation 이 첫 이야기 `limit:1`, 이후 `limit:3` 전달. 서버가 v8 이면 무시.
- 모의 검사(limit 변형 빌드): 첫 이야기 `limit:1` 전달 → 서버 1개 저장·반환 → 화면 1개 / 두 번째 `limit:3` 전달, 후보 0(구제) 허용. 5/5.

## 4. 통합 수정안 — 실제 변경 (v17 기준)

| # | 파일 | 종류 | 규모 | 내용 |
|---|---|---|---|---|
| 1 | `src/doit/lib/conversationRecovery.ts` | 신규 | 49줄 | pendingSelf 저장/읽기/삭제(사용자별 sessionStorage) |
| 2 | `src/doit/components/feature/CoreConversation.tsx` | 수정 | +25 −10 (3곳) | ① write 포트 STALE_CONTEXT 1회 자동 재시도 ② load 시 예약된 설명으로 편집기 복원(자동 저장 없음) ③ 거절 직후 예약, 저장 성공 시 해제 |
| 3 | `qa/core-conversation-question-state.test.mjs` | 수정 | +91 −6 | 하네스에 새 모듈·전송 주입 등록 + 검사 4건 추가 |

통합 diff: `docs/CoreConversation.integrated.diff`. 그 밖의 v17 파일은 **무변경**. r2 의 7개 파일은 통합안에 포함하지 않는다(r2 ZIP 은 대조용으로 별도 첨부).

## 5. 검사 결과 — 종류별 분리

### 5.1 정적 (v17 + 통합안)
| 검사 | 결과 |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | PASS |
| `eslint src --max-warnings 0` | PASS |
| `vite build` 스위치 OFF / ON(+FOLLOWUP ON) | PASS / PASS |
| limit 변형: type-check · lint · build ON | PASS · PASS · PASS |

### 5.2 모의 — v17 동봉 QA 테스트(node:test, 실제 소스를 메모리 포트로 실행)
| 묶음 | 수정 전(v17 원본) | 통합안 | 비고 |
|---|---|---|---|
| core-conversation-contract | 22/22 | 22/22 | 무변경 |
| core-conversation-question-state | 13/13 | **17/17** (13 유지 + 신규 4) | 신규: 예약 복원 · 실패 시 예약 유지 · STALE 1회 재시도 · 2회째는 보고. 신규 검사 작성 중 실패 2회는 검사 고정값 문제(vm 렌름 프로토타입 비교, 거절 뒤 서버 목록 미반영)였고 컴포넌트 결함이 아님 |
| profile-photo / recent-photo 계약 | 36/36 | 36/36 | 무변경 |
| **합계** | 71/71 | **75/75** (limit 변형 복사본도 75/75) | |

### 5.3 모의 — 브라우저 흐름(가짜 서버·가짜 세션, 실제 AI·DB 호출 0) · 하네스 `docs/mock-flow-test.core.mjs`
| 모드 | 통합안 빌드 | limit 변형 빌드 | 확인한 것 |
|---|---|---|---|
| talk | **17/17** | (2건 N/A — 후보 1개라 "다음 후보" 검사 대상 아님) | 선택 화면 → 대화 → 후보 1개씩·4버튼 → 입력창 잠김 → 맞아요/그게 아니에요 → rejected·ai_text 보존 → "이어서 이야기하기" → STALE 1회 자동 재시도(새 requestId) → 서버 질문 표시 → 거절 문장 없음 → "모르겠어요" 기록 + 구제 → 프로필 입력 |
| explain | **12/12** | **12/12** | 직접 설명 → 거절 성공 + 저장 1회 실패 → 입력 유지·예약 → **새로고침** → 편집기 복원("이전 AI 해석은 제외했어요") → 자동 저장·AI 호출 없음 → 저장 → self 행 1, 같은 requestId, 재거절 0, 예약 해제 |
| resume | **4/4** | **4/4** | 서버에만 기록+후보 → 표시, AI 재호출 0 |
| limit | — | **5/5** | §3 |
| **합계** | **33/33** | **21/21** | 기존 r2 60/60 은 EchoTalk 빌드 결과이며 통합안과 별개로 보관 |

### 5.4 조작 수·호출 수 실측 (통합안 talk 모드)
| 항목 | 값 |
|---|---|
| 탭 | 7 (선택 1 · 보내기 2 · 맞아요 1 · 그게 아니에요 1 · 이어서 이야기하기 1 · 프로필 준비 1) |
| 글 입력 | 2 |
| 모의 AI 실행(생성 요청) | 3 (insight_generate 2 · followup_generate 1 성공분) |
| 캐시 재생 | 0 |
| 직접 설명 1건 추가 비용 | 탭 +2(직접 설명할게요·저장) + 글 +1, 실패 시 재시도 탭 +1 |
| 단가 | v17 은 후보를 **한 번에 1개씩** 보여 주므로, 후보 N개 = 탭 N(맞아요/아니에요) 또는 2N+글 N(고침/직접 설명) |

v8 무제한(기록당 최대 9개) 2회 대화 최악: 탭 1+4+18×2+2 = **43**, 글 2+18 = **20**. v9b 제한(1+3) 최악: 탭 1+4+4×2+2 = **15**, 글 6. 최선(1+1, 맞아요): 탭 9, 글 2.

### 5.5 실AI · 실기기 · 운영 집계
| 종류 | 결과 |
|---|---|
| 실AI 후보 생성·다음 질문 | **확인 불가** (실행 0회; 모델 보정 배포 전) |
| 실기기 390px·재로그인·다른 기기 | **확인 불가** (실행 0회) |
| 운영 이벤트(09-20 18:30~18:45 UTC) | insight_generate 요청 5 = 실AI 실행 3 + 캐시 재생 2 · 내부 모델 호출 수 로그 없음(코드상 상한 9) · 후보 성공 0 |

## 6. 남은 확인·승인 항목

| # | 항목 | 필요 이유 | 대상 / 복구 |
|---|---|---|---|
| ① | v9 모델 보정 코드 적용 승인(배포 별개) | 실AI 3/3 실패 원인 1순위 | Edge v8→v9 / v8 재배포 |
| ② | 통합안 3파일 작업본(v17) 적용 승인 | 설명 유실·STALE 수동 재시도 개선 | 클라이언트만 / v17 원본 복귀 |
| ③ | v9b 후보 제한 채택 여부 | 최악 조작 43→15 | Edge + 선택 diff / v8 |
| ④ | QA 사이트 ON 빌드(`VITE_A_STRUCTURE_SERVER_ENABLED=true`, `VITE_ECHO_FOLLOWUP_ENABLED=true`) 배포 승인 → 0423doit@gmail.com 으로 실AI 검사 | 실AI 0회 해소 | GPT 배포 / 이전 QA ZIP |
| ⑤ | 운영 v8 ↔ v17 동봉 함수 바이트 대조 | 동일 여부 미확인 | 읽기 전용 |
| ⑥ | 591행 출처 | 미확인 유지 | 조회만 |
