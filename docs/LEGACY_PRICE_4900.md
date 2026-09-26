# 폐기된 옛 가격 4,900원 — 과거 기록 목록 (legacy / old structure)

2026-09-26 대표 결정: **4,900원은 폐기된 옛 구조다. 현재 가격은 미확정이다.**

아래 파일들은 과거 시점의 코드·검사 결과 스냅숏이라 본문을 고치면 기록이 깨진다. 그래서 수정·삭제하지 않고 이 목록으로만 "옛 가격"임을 표시한다. 이 파일들의 4,900 / 4900 은 현재 가격이 아니다.

## 코드·검사 스냅숏 (수정하지 않음)

- `docs/claude-final-review-20260916/LIVE/regression50.mjs`
- `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/qa/legal-consent.test.mjs`
- `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/qa/step7-contract.test.mjs`
- `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/src/lib/legal/documents.ts`
- `docs/claude-final-review-20260916/PATCH-20260923-connect-v1/src/lib/legal/documents.ts`
- `docs/claude-final-review-20260916/PATCH/qa/full-flow-edge-simulation.test.mjs`
- `docs/claude-final-review-20260916/PATCH/qa/step7-contract.test.mjs`
- `docs/claude-final-review-20260916/PATCH/src/lib/echo/api.ts`
- `docs/claude-final-review-20260916/PATCH/src/pages/do-it/payment/page.tsx`
- `docs/claude-final-review-20260916/PATCH/src/pages/do-it/weather-check/page.tsx`
- `docs/claude-final-review-20260916/SOURCE_MANIFEST.json`
- `docs/claude-final-review-20260916/evidence/final100v3_stopped_20260920/state.json`
- `docs/claude-final-review-20260916/evidence/regression50-result.txt`
- `docs/readdy-v449/deploy/tests/browser/payment-gate.browser.mjs`
- `docs/readdy-v449/deploy/tests/browser/payment-pending_browser_report.json`

## 머리말을 붙인 문서 (본문 보존)

- `docs/agency-review/REVIEW_2026-09-14_agency_docs_20260813.md`
- `docs/claude-final-review-20260916/BACKEND_MASTER_AUDIT_PHASE1_20260920.md`
- `docs/claude-final-review-20260916/CLAUDE_ARCHITECTURE_OPINION.md`
- `docs/claude-final-review-20260916/CODEX_HANDOFF.md`
- `docs/claude-final-review-20260916/DECISION_LOG_20260916.md`
- `docs/claude-final-review-20260916/DEPLOYMENT_PLAN_STOP.md`
- `docs/claude-final-review-20260916/FIELD_DEFECTS_20260917.md`
- `docs/claude-final-review-20260916/FINAL_COMPLETION_REPORT_20260919.md`
- `docs/claude-final-review-20260916/FINAL_ONE_PASTE_20260917.md`
- `docs/claude-final-review-20260916/FINAL_RELEASE_GATE_20260920.md`
- `docs/claude-final-review-20260916/FINAL_STATE_20260917.md`
- `docs/claude-final-review-20260916/PATCH-20260921-v13-first-conversation/docs/ECHO_GPT_HANDOFF_20260922.md`
- `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_ConversationP0_최종보고_v15.1_20260924.md`
- `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_Conversation_Orchestrator_대조_v15.1_20260924.md`
- `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/ECHO_MASTER_CODE_최종대조_v15_20260924.md`
- `docs/claude-final-review-20260916/PATCH-20260924-ai-conversation-v15/LEGACY_ISSUES.md`
- `docs/claude-final-review-20260916/PATCH-20260924-withdrawal-design/ECHO_회원탈퇴_구조설계_20260924.md`
- `docs/claude-final-review-20260916/PRICING_STRATEGY_20260916.md`
- `docs/claude-final-review-20260916/SERVER_CORE_INVENTORY_20260918.md`
- `docs/readdy-v449/PUBLISH_GATE_2026-09-13.md`
- `docs/readdy-v449/deploy/CHECK_LOG_payment-pending_2026-09-13.md`
- `docs/readdy-v449/deploy/DEPLOY_HANDOVER_2026-09-13.md`
- `docs/store-prep/STORE_PREP_2026-09-14.md`
- `reports/economy_p1/READONLY_MEASUREMENT_2026-09-13.md`

## 현재 코드 상태 (2026-09-26 결제 잠금 적용)

- 서버 `product/supabase/functions/echo-payment/index.ts`: `PRICE_KRW = null`(가격 미확정). 주문 생성·승인 모두 `PRICE_NOT_SET` 으로 거절하고 Toss 를 부르지 않는다.
- 화면 `product/src/lib/echo/api.ts`: `REPORT_PRICE_KRW = null`. `isPaymentEnabled()` 가 가격 미확정이면 false → 결제 화면은 「결제 준비 중」만 보이고 결제 버튼은 잠긴다.
- 새 가격은 대표 승인 뒤에만 두 상수에 같은 값으로 넣는다.
- 남은 옛 표기: `product/supabase/drafts/PENDING_*.sql` 주석(실행 전 DB 초안, 이번 작업에서 DB 파일은 건드리지 않음).
