// doit_understanding — 중복 저장 방지 통합 검사 (V412, 실제 구현 호출)
//
// 이 스크립트는 서버 전용 DB 함수(doit_apply_*)를 "실제로 호출"하여 아래 6개 시나리오를 검증한다.
// 실행 전제: apply_functions.sql 이 승인·적용되어 함수가 존재하고, doit_* 4개 테이블이 존재해야 한다.
//
// ⚠️ 실행 상태: 확인 불가 (Claude 인계용)
//   - 이 저장소에는 실행 도구가 없어 이 스크립트를 실제 실행하지 못했다.
//   - 현재 DB 에 doit_* 테이블·doit_apply_* 함수가 아직 배포되지 않았으므로(승인 STOP),
//     본 검사는 "실행 불가 · 확인 불가"로 표기하고, Claude(또는 실행 권한 보유자)가 승인·배포 후
//     아래를 실행해 실제 반영 횟수와 결과를 확인해야 한다.
//
// 실행 방법(승인·배포 후):
//   deno run --allow-env --allow-net supabase/drafts/PENDING_대표승인_doit_understanding/check.ts
//   필요 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// 각 시나리오는 실제 반영 행 수(count)와 이벤트 상태를 조회해 기대값과 비교한다.

// deno-lint-ignore no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!url || !serviceKey) {
  console.error("[check] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요");
  Deno.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const uuid = () => crypto.randomUUID();
let passCount = 0;
let failCount = 0;

function report(name: string, ok: boolean, detail: string) {
  if (ok) { passCount++; console.log(`✅ PASS  ${name} — ${detail}`); }
  else { failCount++; console.log(`❌ FAIL  ${name} — ${detail}`); }
}

// 실제 반영 행 수 + 이벤트 상태를 반환하는 공용 헬퍼
async function countRecords(userId: string, requestId: string) {
  const { data } = await admin.from("doit_records").select("id").eq("user_id", userId).eq("request_id", requestId);
  return data?.length ?? 0;
}
async function countInsights(userId: string, requestId: string) {
  const { data } = await admin.from("doit_insights").select("id").eq("user_id", userId).eq("request_id", requestId);
  return data?.length ?? 0;
}
async function eventStatus(userId: string, requestId: string) {
  const { data } = await admin.from("doit_request_events")
    .select("status, applied_revision").eq("user_id", userId).eq("request_id", requestId).maybeSingle();
  return data ? { status: data.status, applied_revision: data.applied_revision } : null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  // 테스트 사용자 1명 생성 (doit_records/insights 의 user_id FK 충족)
  const email = `doit-check-${uuid().slice(0, 8)}@example.com`;
  const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (uErr || !u?.user) {
    console.error("[check] 테스트 사용자 생성 실패:", uErr?.message);
    Deno.exit(1);
  }
  const userId = u.user.id;
  console.log(`[check] 테스트 사용자: ${userId} (${email})\n`);

  // ════════════════════════════════════════════════════════════════
  // 시나리오 1: 동일 요청 2개 동시 실행 → 반영 1회
  // ════════════════════════════════════════════════════════════════
  {
    const requestId = uuid();
    const action = "record_create";
    const payloadHash = await sha256("record_create|동시실행");
    const args = { p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash, p_text: "동시 실행 테스트 기록", p_emotion: "" };
    const [r1, r2] = await Promise.all([
      admin.rpc("doit_apply_record_create", args),
      admin.rpc("doit_apply_record_create", args),
    ]);
    const applied = [r1, r2].filter((r) => r.data && (r.data as { ok: boolean }).ok && !(r.data as { duplicate?: boolean }).duplicate).length;
    const replays = [r1, r2].filter((r) => r.data && (r.data as { duplicate?: boolean }).duplicate).length;
    const count = await countRecords(userId, requestId);
    report("1. 동일 요청 2개 동시 실행", applied === 1 && replays === 1 && count === 1,
      `적용 ${applied}회, replay ${replays}회, 실제 기록 ${count}건 (기대: 1/1/1)`);
  }

  // ════════════════════════════════════════════════════════════════
  // 시나리오 2: 원래 요청이 늦게 끝나는 동안 재시도 → 반영 1회 (replay)
  // ════════════════════════════════════════════════════════════════
  {
    const requestId = uuid();
    const action = "record_create";
    const payloadHash = await sha256("record_create|늦게끝남");
    const args = { p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash, p_text: "지연 재시도 테스트", p_emotion: "" };
    // 재시도(2차)가 먼저 반영, 이후 원래 요청(1차)이 뒤늦게 도착 → replay
    const first = await admin.rpc("doit_apply_record_create", args);
    const retry = await admin.rpc("doit_apply_record_create", args);
    const count = await countRecords(userId, requestId);
    const ok = (first.data as { ok: boolean }).ok && (retry.data as { duplicate?: boolean }).duplicate === true && count === 1;
    report("2. 원래 요청 지연 중 재시도", ok, `기록 ${count}건 (기대 1), 재시도 duplicate=${(retry.data as { duplicate?: boolean }).duplicate}`);
  }

  // ════════════════════════════════════════════════════════════════
  // 시나리오 3: 실패 요청 2개 동시 재시도 → 반영 1회
  // ════════════════════════════════════════════════════════════════
  {
    const requestId = uuid();
    const action = "record_create";
    const payloadHash = await sha256("record_create|실패재시도");
    const args = { p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash, p_text: "실패 후 재시도 테스트", p_emotion: "" };
    // 첫 호출을 일부러 실패시키기 위해 존재하지 않는 케이스를 만들 수 없으므로,
    // failed 상태를 직접 만들어 동시 재시도가 한 번만 반영되는지 확인한다.
    await admin.from("doit_request_events").insert({ user_id: userId, request_id: requestId, action, payload_hash: payloadHash, status: "failed" });
    const [r1, r2] = await Promise.all([
      admin.rpc("doit_apply_record_create", args),
      admin.rpc("doit_apply_record_create", args),
    ]);
    const applied = [r1, r2].filter((r) => r.data && (r.data as { ok: boolean }).ok && !(r.data as { duplicate?: boolean }).duplicate).length;
    const replays = [r1, r2].filter((r) => r.data && (r.data as { duplicate?: boolean }).duplicate).length;
    const count = await countRecords(userId, requestId);
    report("3. 실패 요청 2개 동시 재시도", applied === 1 && replays === 1 && count === 1,
      `적용 ${applied}회, replay ${replays}회, 기록 ${count}건 (기대: 1/1/1)`);
  }

  // ════════════════════════════════════════════════════════════════
  // 시나리오 4: 데이터 변경과 완료 기록 사이 강제 오류 → 함께 롤백 (반영 0회)
  //   - p_candidates 에 잘못된 category 를 넣어 CHECK 제약 위반으로 INSERT 실패를 유도.
  //   - 이때 events 의 applied 기록도 함께 롤백되어 "부분 반영"이 남지 않아야 한다.
  // ════════════════════════════════════════════════════════════════
  {
    const requestId = uuid();
    const action = "insight_generate";
    const payloadHash = await sha256("insight_generate|강제오류");
    const r = await admin.rpc("doit_apply_insight_generate", {
      p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
      p_record_id: uuid(), p_source_text: "강제 오류 테스트",
      p_candidates: [{ category: "invalid_category", text: "체크 제약 위반" }],
    });
    const count = await countInsights(userId, requestId);
    const evt = await eventStatus(userId, requestId);
    const failed = r.error !== null; // CHECK 위반 → 예외 → rollback
    report("4. 저장·완료 기록 사이 강제 오류", failed && count === 0 && evt === null,
      `RPC error=${r.error ? "있음" : "없음"}, insight ${count}건, 이벤트 ${evt ? evt.status : "없음(롤백)"} (기대: error 있음/0/없음)`);
  }

  // ════════════════════════════════════════════════════════════════
  // 시나리오 5: 서로 다른 요청의 revision 충돌 → 두 번째 STALE_REVISION
  // ════════════════════════════════════════════════════════════════
  {
    // candidate insight 하나를 먼저 생성
    const seedRequestId = uuid();
    const seedHash = await sha256("insight_self|seed");
    const seed = await admin.rpc("doit_apply_insight_self", {
      p_user_id: userId, p_request_id: seedRequestId, p_action: "insight_self", p_payload_hash: seedHash,
      p_record_id: uuid(), p_category: "value", p_text: "revision 충돌용 항목",
    });
    const insightId = (seed.data as { insight?: { id: string } }).insight?.id;
    const baseRev = (seed.data as { insight?: { revision: number } }).insight?.revision ?? 1;

    // 요청 A가 revision을 baseRev → baseRev+1 로 변경
    const aReq = uuid();
    const aHash = await sha256("transition|A");
    const rA = await admin.rpc("doit_apply_insight_transition", {
      p_user_id: userId, p_request_id: aReq, p_action: "insight_confirm", p_payload_hash: aHash,
      p_insight_id: insightId, p_expected_revision: baseRev, p_new_status: "confirmed", p_text: "",
    });

    // 요청 B는 "같은 baseRev"로 시도 → 이미 A가 올렸으므로 STALE_REVISION
    const bReq = uuid();
    const bHash = await sha256("transition|B");
    const rB = await admin.rpc("doit_apply_insight_transition", {
      p_user_id: userId, p_request_id: bReq, p_action: "insight_confirm", p_payload_hash: bHash,
      p_insight_id: insightId, p_expected_revision: baseRev, p_new_status: "confirmed", p_text: "",
    });
    const aOk = (rA.data as { ok: boolean }).ok;
    const bCode = (rB.data as { code?: string }).code;
    report("5. 서로 다른 요청 revision 충돌", aOk === true && bCode === "STALE_REVISION",
      `A ok=${aOk}, B code=${bCode} (기대: true / STALE_REVISION)`);
  }

  // ════════════════════════════════════════════════════════════════
  // 시나리오 6: 이해 항목 여러 개 생성 후 동일 요청 재전송 → 반영 1회 (replay)
  // ════════════════════════════════════════════════════════════════
  {
    const requestId = uuid();
    const action = "insight_generate";
    const payloadHash = await sha256("insight_generate|재전송");
    const candidates = [
      { category: "value", text: "후보1" },
      { category: "pattern", text: "후보2" },
      { category: "memory", text: "후보3" },
    ];
    const args = { p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash, p_record_id: uuid(), p_source_text: "재전송 테스트", p_candidates: candidates };
    const r1 = await admin.rpc("doit_apply_insight_generate", args);
    const r2 = await admin.rpc("doit_apply_insight_generate", args);
    const count = await countInsights(userId, requestId);
    const duplicate2 = (r2.data as { duplicate?: boolean }).duplicate === true;
    report("6. 여러 항목 생성 후 동일 요청 재전송", duplicate2 && count === 3,
      `재전송 duplicate=${duplicate2}, 실제 항목 ${count}건 (기대: true / 3)`);
  }

  console.log(`\n[check] 결과: PASS ${passCount} / FAIL ${failCount}`);
  if (failCount > 0) Deno.exit(1);
}

main().catch((e) => { console.error("[check] 실행 오류:", e); Deno.exit(1); });