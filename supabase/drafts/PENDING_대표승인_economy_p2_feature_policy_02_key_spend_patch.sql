-- ============================================================
-- NEWLY AUTHORED · 2026-09-13 · 과거 원문 회수본 아님 · 운영 미적용 · 검사 결과 별도(p2_local/TEST_LOG)
-- ECONOMY P2 · 02 · public.key_spend 정책 연결 패치
-- 기준: 운영 key_spend 원문(2026-09-13 실측, md5 0f9be9333eaeba16c9a609bd78df96b4) 대비 변경은 아래 3곳뿐.
--   (a) v_policy := null  →  key_feature_policies 실제 조회 (enabled 별도 판정)
--   (b) 정책 disabled → FEATURE_DISABLED (정책 없음 FEATURE_POLICY_MISSING 과 구분. 코드명은 대표/전략본부 확정 대상)
--   (c) 성공한 spend 원장 행에 policy_version 기록 + 응답에 policyVersion 포함
-- 보존: replay(result_json 그대로 반환) · advisory lock · payload_hash(action, amount, feature) · 원자성 · 잔액 캐시 손상 감지 · 차감 분기 규칙
-- 선행: 01_schema 적용 후에만 실행(테이블 없으면 컴파일은 되지만 실행 시 오류).
-- ============================================================
CREATE OR REPLACE FUNCTION public.key_spend(p_request_id uuid, p_amount integer, p_feature text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_uid              uuid := auth.uid();
  v_payload_hash     text;
  v_evt              public.key_request_events%rowtype;
  v_policy           public.key_feature_policies%rowtype;
  v_reward_allowed   boolean;
  v_revenue_only     boolean;
  v_payment_required boolean;
  v_server_cost      integer;
  v_policy_version   text;
  v_reward_bal       integer;
  v_revenue_bal      integer;
  v_from_reward      integer;
  v_from_revenue     integer;
  v_result           jsonb;
begin
  -- (1) 인증
  if v_uid is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  -- (2) 입력 검증
  if p_request_id is null then raise exception 'INVALID_REQUEST_ID' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = '22023'; end if;
  if p_feature is null or btrim(p_feature) = '' then raise exception 'INVALID_FEATURE' using errcode = '22023'; end if;
  -- (3) command-level advisory lock
  perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(p_request_id::text));
  -- (4) 서버 결정 payload hash (P1 r2 와 동일 — replay 호환)
  v_payload_hash := encode(extensions.digest(jsonb_build_object('action','key_spend','amount',p_amount,'feature',p_feature)::text, 'sha256'), 'hex');
  -- (5) idempotency + 응답 무결성
  select * into v_evt from public.key_request_events where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_evt.action is distinct from 'key_spend' then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.payload_hash is distinct from v_payload_hash then raise exception 'REQUEST_CONFLICT' using errcode = '40900'; end if;
    if v_evt.status = 'applied' then
      if v_evt.result_json is null or v_evt.applied_at is null then raise exception 'CORRUPTED_REQUEST_STATE' using errcode = 'P0001'; end if;
      return v_evt.result_json;
    end if;
    raise exception 'CORRUPTED_PENDING_REQUEST' using errcode = 'P0001';
  else
    insert into public.key_request_events (user_id, request_id, action, payload_hash, status)
      values (v_uid, p_request_id, 'key_spend', v_payload_hash, 'pending') returning * into v_evt;
  end if;

  -- (6) feature 정책 — 서버 저장소 조회 (P2). 프론트 값 신뢰 금지.
  select * into v_policy from public.key_feature_policies p where p.feature = p_feature;
  if not found then raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001'; end if;
  if not v_policy.enabled then raise exception 'FEATURE_DISABLED' using errcode = 'P0001'; end if;

  v_reward_allowed   := v_policy.reward_allowed;
  v_revenue_only     := v_policy.revenue_only;
  v_payment_required := v_policy.payment_required;
  v_server_cost      := v_policy.cost;
  v_policy_version   := v_policy.policy_version;
  if v_server_cost is null or v_server_cost <= 0 then raise exception 'FEATURE_POLICY_MISSING' using errcode = 'P0001'; end if;
  if v_server_cost <> p_amount then raise exception 'COST_MISMATCH' using errcode = 'P0001'; end if;
  if v_payment_required then raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001'; end if;

  -- (7) 잔액 행 확보 + 캐시 손상 감지 + FOR UPDATE (P1 r2 동일)
  if not exists (select 1 from public.key_balances where user_id = v_uid) then
    if exists (select 1 from public.key_ledger where user_id = v_uid) then raise exception 'BALANCE_CACHE_CORRUPTED' using errcode = 'P0001'; end if;
    insert into public.key_balances (user_id) values (v_uid) on conflict (user_id) do nothing;
  end if;
  select reward_key, revenue_key into v_reward_bal, v_revenue_bal from public.key_balances where user_id = v_uid for update;

  -- (8) 차감 분기 (P1 r2 동일)
  if v_revenue_only or not v_reward_allowed then
    if v_revenue_bal < p_amount then raise exception 'INSUFFICIENT_REVENUE' using errcode = 'P0001'; end if;
    v_from_reward := 0; v_from_revenue := p_amount;
  else
    if (v_reward_bal::bigint + v_revenue_bal::bigint) < p_amount then raise exception 'INSUFFICIENT' using errcode = 'P0001'; end if;
    v_from_reward := least(v_reward_bal, p_amount); v_from_revenue := p_amount - v_from_reward;
  end if;

  -- (9) 원장 append — policy_version 기록 (P2 추가)
  if v_from_reward > 0 then
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, policy_version, reason)
      values (v_uid, p_request_id, 'spend', 'reward', -v_from_reward, p_feature, v_policy_version, 'spend');
  end if;
  if v_from_revenue > 0 then
    insert into public.key_ledger (user_id, request_id, type, bucket, amount, source, policy_version, reason)
      values (v_uid, p_request_id, 'spend', 'revenue', -v_from_revenue, p_feature, v_policy_version, 'spend');
  end if;

  -- (10) 잔액 갱신 (원자)
  update public.key_balances set reward_key = reward_key - v_from_reward, revenue_key = revenue_key - v_from_revenue, updated_at = now() where user_id = v_uid;

  -- (11) 응답 + result_json 저장 (policyVersion 추가, 그 외 P1 r2 동일 형태)
  v_result := jsonb_build_object('ok', true, 'requestId', p_request_id, 'policyVersion', v_policy_version,
    'spent', jsonb_build_object('reward', v_from_reward, 'revenue', v_from_revenue),
    'balance', jsonb_build_object('reward', v_reward_bal - v_from_reward, 'revenue', v_revenue_bal - v_from_revenue));
  update public.key_request_events set status = 'applied', result_json = v_result, applied_at = now() where id = v_evt.id;
  return v_result;
exception when others then raise;
end;
$function$;
-- 권한은 P1 r2 그대로(authenticated EXECUTE). 변경 없음.
-- [복구] 운영 원문(md5 0f9be933…)으로 CREATE OR REPLACE. 원문은 pg_get_functiondef 로 적용 직전 백업할 것.
