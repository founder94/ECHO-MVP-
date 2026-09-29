import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());
const read = (path) => readFile(resolve(root, path), 'utf8');

test('server transition, payment gate, and report entitlement contracts are present', async () => {
  const [step, journey, payment] = await Promise.all([
    Promise.all(['rules.ts','ai.ts','index.ts'].map((f) => read(`supabase/functions/get-step-question/${f}`))).then((xs) => xs.join('\n')),
    read('supabase/functions/echo-journey/index.ts'),
    read('supabase/functions/echo-payment/index.ts'),
  ]);

  assert.match(step, /commitState\(sb, conversationId, token, "choose", "step3"\)/);
  assert.match(step, /canCompleteFreeStage\(\{/);
  assert.match(step, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(step, /m === "gpt-40-mini"[\s\S]*DEFAULT_OPENAI_MODEL/);
  assert.match(step, /message_kind: messageKind/);
  assert.match(step, /"understanding_summary"/);
  assert.match(step, /"understanding_choice"/);

  assert.match(journey, /stepOf\(s\) < 7[\s\S]*REPORT_READY/);
  assert.match(journey, /답변을 먼저 저장하고 상태를 확정한다/);
  assert.match(journey, /conv\.status !== REPORT_READY && conv\.status !== REPORT_DONE/);
  assert.match(journey, /hasPaidReportAccess\(sb, user\.id, conv\.id\)/);
  assert.match(journey, /reportEntitled: false/);
  assert.match(journey, /\.eq\("status", "paid"\)/);
  assert.match(journey, /completedConversationIds/);
  assert.match(journey, /restoreLegacyWhiteDoor/);
  assert.match(journey, /model === "gpt-40-mini"/);
  // 2026-09-17: 열린 턴 판정으로 이름이 바뀌었다(질문 턴 + 사용자의 물음에 답만 한 턴).
  assert.match(journey, /latestOpenJourneyTurn\(/);
  assert.match(journey, /askedBack.*isUserQuestion|isUserQuestion\(answer\)/);
  assert.match(journey, /"journey_question"/);
  assert.match(journey, /userEvidenceText/);
  assert.doesNotMatch(journey, /STEP_THEMES/);

  assert.match(payment, /const PRICE_KRW = 4900/);
  assert.match(payment, /const PAYABLE_STATUS = "report_ready"/);
  assert.match(payment, /const PAYMENT_MODE = "review_pending"/);
  assert.match(payment, /loadPaidByConversation/);
  assert.match(payment, /reportEntitled: true/);
  assert.doesNotMatch(payment, /current_step: 3/);

  const modeGuard = payment.indexOf('PAYMENT_MODE !== "enabled"');
  const readyOrderLookup = payment.indexOf('.eq("status", "ready")', modeGuard);
  const orderInsert = payment.indexOf('.from("payments").insert', modeGuard);
  assert.ok(modeGuard >= 0 && readyOrderLookup > modeGuard && orderInsert > modeGuard, 'review_pending must block before ready-order lookup and order insertion');
});

test('frontend routes, copy, and review-pending gate match the server contract', async () => {
  const [api, paymentPage, toss, success, report, whiteDoor, weather] = await Promise.all([
    read('src/lib/echo/api.ts'),
    read('src/pages/do-it/payment/page.tsx'),
    read('src/lib/echo/toss.ts'),
    read('src/pages/do-it/payment/success/page.tsx'),
    read('src/pages/do-it/report/page.tsx'),
    read('src/pages/do-it/white-door/page.tsx'),
    read('src/pages/do-it/weather-check/page.tsx'),
  ]);

  assert.match(api, /case 'white_door_ready':[\s\S]*return '\/white-door'/);
  assert.match(api, /case 'report_ready':[\s\S]*return '\/white-door'/);
  assert.match(api, /case 'report_done':[\s\S]*return '\/report'/);
  assert.match(api, /state\.status === 'white_door_ready'[\s\S]*resumeJourney/);

  assert.match(paymentPage, /\['report_ready'\]/);
  assert.match(paymentPage, /자기이해 리포트 · 1회/);
  assert.match(paymentPage, /대화는 무료예요\. 리포트를 선택할 때만 한 번 결제해요\./);
  assert.match(paymentPage, /자동 결제나 구독은 없어요\./);
  assert.match(toss, /PAYMENT_GATE: PaymentGate = 'review_pending'/);
  assert.match(toss, /결제 준비 중/);
  assert.match(toss, /현재 결제 서비스를 준비하고 있어요\.[\s\S]*결제는 아직 진행되지 않습니다\./);
  // 2026-09-16: 승인 뒤에는 리포트로 곧바로 연결한다(White Door·STEP 3 되돌림 없음). 재결제 유도 문구·재조회 없음.
  assert.match(success, /navigate\(`\/report\?c=\$\{encodeURIComponent\(confirmedConversationId\)\}`, \{ replace: true \}\)/);
  assert.doesNotMatch(success, /getPaymentStatus|routeWithConversation\(latest\.status|\/step\/3/);
  assert.match(report, /if \(!state\.reportEntitled\)/);
  assert.match(report, /navigate\(`\/payment\?c=/);
  assert.match(whiteDoor, /state\.status !== 'report_ready'/);
  assert.match(whiteDoor, /일곱 단계 이야기를/);
  assert.match(weather, /1~7단계 대화는 무료예요\. 최종 자기이해 리포트는 원할 때 4,900원에 열 수 있어요\./);
});

test('production build is blocked when required public Supabase settings are missing', async () => {
  const viteConfig = await read('vite.config.ts');
  assert.match(viteConfig, /loadEnv\(mode/);
  assert.match(viteConfig, /mode === "production"/);
  assert.match(viteConfig, /VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY are required/);
});

test('first screen renders without a blank lazy-loading gap', async () => {
  const [html, routes, router] = await Promise.all([
    read('index.html'),
    read('src/router/config.tsx'),
    read('src/router/index.ts'),
  ]);

  assert.match(html, /class="echo-boot"/);
  assert.match(html, /화면을 준비하고 있어요\./);
  assert.match(routes, /import Home from '@\/pages\/home\/page'/);
  assert.doesNotMatch(routes, /const Home = lazy/);
  assert.match(router, /role: "status"/);
  assert.match(router, /화면을 준비하고 있어요\./);
});

test('review-only SQL separates browser writes and paid completed report reads', async () => {
  const sql = await readFile(resolve(root, 'supabase/drafts/PENDING_20260914_step7_report_entitlement.sql'), 'utf8');
  assert.match(sql, /REVIEW ONLY \/ SERVER_NOT_DEPLOYED \/ DO NOT RUN/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger[\s\S]*from authenticated/);
  assert.match(sql, /reports_select_paid_completed_own/);
  assert.match(sql, /c\.status in \('report_ready', 'report_done'\)/);
  assert.match(sql, /p\.status = 'paid'/);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /conversations_user_request_token_unique/);
  assert.match(sql, /where request_token is not null/);
});
