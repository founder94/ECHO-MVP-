// 관리자 "AI 대화 기록" 화면 계약.
// 목적: 대표가 SQL 없이 대화 기록을 보되, 못 읽은 것을 0건으로 착각하지 않게 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(root, p), 'utf8');

test('관리자 메뉴에 AI 대화 기록이 등록되고 화면에 연결된다', async () => {
  const [meta, shell] = await Promise.all([
    read('src/doit/pages/do-it/admin/meta.ts'),
    read('src/doit/pages/do-it/admin/components/AdminShell.tsx'),
  ]);

  assert.match(meta, /key: "conversation-logs"/);
  assert.match(meta, /label: "AI 대화 기록"/);
  // 연결한 실제 표 이름을 메뉴에 적어 둔다(어디서 나온 숫자인지 화면에서 확인 가능해야 한다).
  assert.match(meta, /doit_records \+ doit_insights \+ doit_request_events/);
  // 전체가 보이는 것처럼 "real" 로 적지 않는다. 본인 줄만 보이므로 partial 이다.
  assert.match(meta, /key: "conversation-logs"[^}]*kind: "partial"/);

  assert.match(shell, /import ConversationLogs from "\.\.\/views\/ConversationLogs";/);
  assert.match(shell, /case "conversation-logs":/);
  assert.match(shell, /<ConversationLogs period=\{period\} \/>/);
});

test('조회 훅은 권한 차단과 실제 0건을 구분한다', async () => {
  const hook = await read('src/doit/pages/do-it/admin/hooks/useConversationLogs.ts');

  // 테이블 없음(missing) 과 권한 막힘(blocked) 을 따로 판정한다.
  assert.match(hook, /return missing \? "missing" : "blocked";/);
  // 오류가 났을 때 0건으로 채우지 않는다.
  assert.match(hook, /status: blocked, total: null/);
  // 실제 0건일 때만 empty 로 본다.
  assert.match(hook, /status: total === 0 \? "empty" : "success"/);
  // 세 표를 모두 조회한다.
  for (const table of ['doit_records', 'doit_insights', 'doit_request_events']) {
    assert.ok(hook.includes(`.from("${table}")`), `${table} 조회 없음`);
  }
  // 화면에서는 읽기만 한다 — 쓰기 호출이 없어야 한다.
  assert.doesNotMatch(hook, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
});

test('화면은 보이는 범위를 먼저 밝히고 원문을 기본으로 가린다', async () => {
  const view = await read('src/doit/pages/do-it/admin/views/ConversationLogs.tsx');

  // 본인 줄만 보인다는 사실을 화면에 적는다.
  assert.match(view, /로그인한 계정\(대표님\)의 기록만/); // 대표 2026-09-25 쉬운 말로 바꿈
  // 승인 전 실행 금지인 초안 파일 이름을 화면에서 알려 준다.
  assert.match(view, /PENDING_20260922_admin_read_doit_conversation\.sql/);
  assert.match(view, /대표 승인 전에는 켜지 않아요/);

  // 원문은 기본으로 가린다(눌러야 보인다).
  assert.match(view, /useState\(false\)/);
  assert.match(view, /showRaw \? .+ : maskText\(/s);
  // 원문을 콘솔 등으로 흘리지 않는다.
  assert.doesNotMatch(view, /console\./);

  // 4버튼 결과를 사용자가 실제로 누른 말로 보여 준다.
  for (const label of ['맞아요', '조금 달라요', '그게 아니에요']) {
    assert.ok(view.includes(label), `${label} 표시 없음`);
  }
});

test('관리자 조회 정책 초안은 실행 금지 표시와 되돌리기를 함께 갖는다', async () => {
  const sql = await read('supabase/drafts/PENDING_20260922_admin_read_doit_conversation.sql');

  assert.match(sql, /REVIEW ONLY \/ NOT EXECUTED \/ DO NOT RUN/);
  assert.match(sql, /대표 승인 전 실행 금지/);

  // 조회(select)만 연다. 쓰기 정책은 만들지 않는다.
  assert.match(sql, /for select/);
  assert.doesNotMatch(sql, /for (insert|update|delete)\b/);
  // 권한 자체가 없던 표는 grant 도 함께 다루되 쓰기 권한은 회수한다.
  assert.match(sql, /grant select on public\.doit_request_events to authenticated;/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger/);
  // 되돌리는 방법을 같이 적는다(막는 규칙에는 빠져나갈 문을 함께 둔다).
  assert.match(sql, /되돌리기/);
  assert.match(sql, /drop policy if exists doit_records_admin_select/);
});
