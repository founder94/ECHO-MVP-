# 기억하는 AI · 사주·타로 정정 반영 · 유료 자유 대화 — 완료 보고 (2026-10-06)

근거: 대표 승인 지시 「ECHO 최종 지시 · 기억하는 AI + 사주타로 정정 매칭 + 유료 자유 대화 · 대표 승인 2026-10-06」.
상태: **작업 가지 `claude/memory-receipt-freechat-20261006` 에만 있다.** 운영·QA 서버 배포 0 · 운영 DB/RLS/Migration/Secret/모델/결제/가격 변경 0 · main 병합 0.

## 바뀐 파일
- 서버 `supabase/functions/doit-agent/`: `memory.ts`(새) · `free-talk.ts`(새) · `reference-talk.ts`(정정 뽑기) · `agent.ts`(지시 한 줄 latest_may_fix · 지운 값 재등장 차단 · 지운 값은 거절 뜻에서 뺌 · free_talk 종류) · `index.ts`(영수증 · agent_memory · agent_memory_forget · agent_ref_fix · agent_free · agent_free_status · admin_free_summary)
- 앱: `lib/agentApi.ts` · `AgentConversation.tsx`(영수증 · 자유 대화 안내 · 「ECHO가 아는 나」 링크) · `RefTalk.tsx`(+css · 반영 확인) · 새 화면 `pages/do-it/known/` · `pages/do-it/free-talk/` · `routes.tsx`
- 관리자: 앱 안 `/doit/admin/mobile` 대화 에이전트 → 「기억·자유 대화」 탭 · 턴마다 「기억 영수증」 표시 / 관리자 사이트 `src/admin/views/Revenue.tsx` 에 자유 대화 이번 달 AI 비용
- 검사: `qa/memory-freechat-20261006.test.mjs`(21개) · `qa/agent-server.test.mjs`(가짜 DB 보강) · `qa/ref-talk-client-20261005.test.mjs`(영수증 줄 1개 늘어난 것 반영)
- 문서: `docs/release/LEGAL_DRAFTS_MEMORY_FREECHAT_20261006.md`(법무 초안 · 처리방침 확인 결과)

## 검사 숫자
- 가짜 AI·가짜 DB 기준: 새 검사 21/21 · 일부러 망가뜨리기 10/10 잡음 · 전체 1428개 중 1423 통과 / 0 실패 / 미확정 5(전부터 있던 목록) · 화면 자료형 검사 0 · 문법 검사 0 · 서버 deno check 0
- 실제 AI(R&D 시험 키 · QA 서버 아님 · 같은 지시문·같은 파라미터 · Actions run 37454243150): 36회 중 답 모양 OK 36 · gpt-4o-mini-2024-07-18

## 턴당 비용 실측(실제 AI · 36회)
| 값 | 결과 |
|---|---|
| 평균 | **0.16원** |
| 최대 | **0.21원**(앞 줄 8개) |
| 입력/출력 토큰 평균 | 537 / 56 |
| 지연 p50 / p95 | 1.1초 / 2.1초 |
기준: gpt-4o-mini 입력 0.15·출력 0.60 달러/1백만 토큰(2024-07 발표값 — 대표 확인 필요) × 1,400원/달러(가정).

### 상한 추천 3안(한 사람 기준 · 최대 금액 = 하루 상한 × 31일 × 0.21원)
| 안 | 하루 | 한 달 금액 상한 | 한 사람 한 달 최대 실제 비용 |
|---|---|---|---|
| A 보수 | 20회 | 1,000원 | 약 130원 |
| **B 권장(지금 기본값)** | **30회** | **5,000원** | **약 200원** |
| C 여유 | 60회 | 5,000원 | 약 390원 |
금액 상한은 안전망이고, 실제로는 하루 횟수가 먼저 닿는다. QA 회사 상한 10,000원 ≈ 4만 8천 턴.

## 캡처(가짜 서버 기준 · 실제 AI 아님)
21 정정 → 영수증 + 다음 질문이 고친 말을 짚음 · 22 「ECHO가 아는 나」 · 24 사주 정정 → 「반영할게요」 → 반영 · 25 범위 밖 질문 → 맛보기 안내 · 26 맛보기 다 씀 → 이용권 안내.

## 못 한 것 · 한계
1. QA 서버 실호출 0 — 자유 대화 스위치는 지시대로 기본 끔이고, 켜려면 QA 서버 비밀값(ECHO_FREE_CHAT · COMPANY_AI_KRW_PER_USD · 단가) 설정 = 대표 승인. 비용은 같은 지시문으로 R&D 시험 키에서 쟀다.
2. 테스트 사이트 미반영 — Codex 검수 한도(토요일 07:41 풀림) 때문에 echo-qa 합치기 불가.
3. 후보 추천 이유의 「고쳐 주신 대로 ~」 한 줄(A-3 후반)은 연결 서버(doit-connect) 변경이 필요해 이번에 안 함.
4. 「범위 밖 이야기」는 서버가 말 종류 ask(ECHO에게 묻는 말)로 본 경우로 잡았다 — 서비스 질문에도 안내가 뜰 수 있다(휴리스틱).
5. 동시 요청 상한: 한 사람 안에서는 잠금으로 0, 회사 전체 상한은 여러 사람이 동시에 보내면 요청 몇 개만큼 넘을 수 있다.
6. 결제(이용권)는 연결하지 않았다 — 가격·결제 = 대표 승인. 지금 이용권 표시는 테스트 계정 목록(ECHO_FREE_CHAT_TEST_USERS) 또는 서버만 쓰는 칸(app_metadata.doit_free_chat).
