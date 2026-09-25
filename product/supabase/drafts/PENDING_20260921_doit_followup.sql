-- REVIEW DRAFT ONLY. NOT EXECUTED IN PRODUCTION. Requires explicit DB + Edge deployment approval.
-- Prerequisite: PENDING_20260921_doit_revision_lock.sql, applied in the same release.
-- Existing RLS/table grants and model/secret configuration remain unchanged.
-- Additive storage: exact accepted question + context version + short AI ownership lease.
-- Run SQL parser/isolated PostgreSQL contract tests before any operating deployment.
BEGIN;
DO $lock_preflight$
DECLARE
  v_function record;
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('doit_apply_insight_generate', 'doit_apply_insight_transition',
      'doit_apply_insight_self', 'doit_apply_record_create', 'doit_apply_record_update')) <> 6 THEN
    RAISE EXCEPTION 'expected six captured mutation signatures';
  END IF;
  FOR v_function IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('doit_apply_insight_generate', 'doit_apply_insight_transition',
      'doit_apply_insight_self', 'doit_apply_record_create', 'doit_apply_record_update') LOOP
    IF position('pg_advisory_xact_lock(hashtext(p_user_id::text), 0)' IN pg_get_functiondef(v_function.oid)) = 0 THEN
      RAISE EXCEPTION 'revision lock prerequisite missing: %', v_function.proname;
    END IF;
  END LOOP;
END;
$lock_preflight$;

ALTER TABLE public.doit_request_events
  ADD COLUMN IF NOT EXISTS response_payload jsonb,
  ADD COLUMN IF NOT EXISTS context_hash text,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

-- Internal only. All context is loaded from this user's database rows, never client claims.
CREATE OR REPLACE FUNCTION public.doit_followup_context(p_user_id uuid, p_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_record jsonb;
  v_insights jsonb;
  v_purpose_id text;
  v_purpose jsonb;
  v_context jsonb;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT to_jsonb(r) INTO v_record FROM public.doit_records r
    WHERE r.user_id = p_user_id AND r.id = p_record_id;
  IF v_record IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); END IF;
  IF v_record->>'status' = 'rejected' THEN RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATE'); END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.updated_at DESC, i.id), '[]'::jsonb)
    INTO v_insights FROM public.doit_insights i WHERE i.user_id = p_user_id;
  -- Purpose comes from the owned profile and active canonical catalog, never browser-supplied labels.
  -- Brief share locks order the final acceptance with concurrent purpose/catalog changes.
  SELECT p.purpose_id INTO v_purpose_id FROM public.profiles p WHERE p.id = p_user_id FOR SHARE;
  IF v_purpose_id IS NOT NULL THEN
    SELECT CASE WHEN p.is_active = true THEN jsonb_build_object('id', p.id, 'label', p.label) ELSE NULL END INTO v_purpose
      FROM public.purposes p WHERE p.id = v_purpose_id FOR SHARE;
  END IF;
  v_context := jsonb_build_object('record', v_record, 'insights', v_insights, 'purpose', v_purpose);
  -- Internal version fingerprint, not an authentication credential or security digest.
  RETURN v_context || jsonb_build_object('ok', true, 'context_hash', md5(v_context::text));
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_begin_followup(
  p_user_id uuid, p_record_id uuid, p_request_id uuid, p_payload_hash text, p_lease_token uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_context jsonb;
  v_evt public.doit_request_events%ROWTYPE;
  v_cached jsonb;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_request_id IS NULL OR p_lease_token IS NULL OR COALESCE(p_payload_hash, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), 0);
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));
  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF v_evt.id IS NOT NULL AND
    (v_evt.action IS DISTINCT FROM 'followup_generate' OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
  END IF;
  v_context := public.doit_followup_context(p_user_id, p_record_id);
  IF v_context->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_context; END IF;
  IF EXISTS (SELECT 1 FROM public.doit_insights WHERE user_id = p_user_id
    AND source_record_id = p_record_id AND status = 'candidate') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PENDING_INSIGHTS');
  END IF;
  IF v_evt.status = 'applied' THEN
    IF v_evt.context_hash IS DISTINCT FROM v_context->>'context_hash' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'STALE_CONTEXT');
    END IF;
    IF v_evt.response_payload->'question' IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'question', v_evt.response_payload->'question');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  END IF;
  -- Concurrent clicks using a different UUID must not start another AI call for this record.
  IF EXISTS (SELECT 1 FROM public.doit_request_events WHERE user_id = p_user_id
    AND action IN ('followup_generate', 'insight_generate') AND target_id = p_record_id AND status = 'pending'
    AND lease_expires_at > clock_timestamp()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IN_FLIGHT');
  END IF;
  SELECT response_payload->'question' INTO v_cached FROM public.doit_request_events
    WHERE user_id = p_user_id AND target_id = p_record_id AND action = 'followup_generate'
      AND status = 'applied' AND context_hash = v_context->>'context_hash'
      AND response_payload->'question' IS NOT NULL
    ORDER BY updated_at DESC LIMIT 1;
  IF v_cached IS NOT NULL THEN
    -- Record the replay's UUID too, so reusing that UUID for another payload is a conflict.
    IF v_evt.id IS NULL THEN
      INSERT INTO public.doit_request_events(user_id, request_id, action, target_id, payload_hash,
        status, context_hash, response_payload)
      VALUES(p_user_id, p_request_id, 'followup_generate', p_record_id, p_payload_hash,
        'applied', v_context->>'context_hash', jsonb_build_object('question', v_cached));
    ELSE
      UPDATE public.doit_request_events SET status = 'applied', context_hash = v_context->>'context_hash',
        response_payload = jsonb_build_object('question', v_cached), error_code = NULL,
        lease_token = NULL, lease_expires_at = NULL WHERE id = v_evt.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'question', v_cached);
  END IF;
  IF v_evt.id IS NULL THEN
    INSERT INTO public.doit_request_events(user_id, request_id, action, target_id, payload_hash,
      status, context_hash, lease_token, lease_expires_at)
    VALUES(p_user_id, p_request_id, 'followup_generate', p_record_id, p_payload_hash,
      'pending', v_context->>'context_hash', p_lease_token, clock_timestamp() + interval '90 seconds');
  ELSE
    UPDATE public.doit_request_events SET status = 'pending', target_id = p_record_id,
      context_hash = v_context->>'context_hash', lease_token = p_lease_token,
      lease_expires_at = clock_timestamp() + interval '90 seconds', response_payload = NULL, error_code = NULL
      WHERE id = v_evt.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'lease_token', p_lease_token, 'context', v_context);
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_finish_followup(
  p_user_id uuid, p_record_id uuid, p_request_id uuid, p_payload_hash text,
  p_lease_token uuid, p_context_hash text, p_question text, p_error_code text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_context jsonb;
  v_evt public.doit_request_events%ROWTYPE;
  v_question jsonb;
  v_code text;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), 0);
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));
  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF v_evt.id IS NULL OR v_evt.action IS DISTINCT FROM 'followup_generate'
    OR v_evt.target_id IS DISTINCT FROM p_record_id OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
  END IF;
  v_context := public.doit_followup_context(p_user_id, p_record_id);
  IF v_evt.status = 'applied' THEN
    IF v_context->>'ok' IS DISTINCT FROM 'true' OR v_evt.context_hash IS DISTINCT FROM v_context->>'context_hash' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'STALE_CONTEXT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'question', v_evt.response_payload->'question');
  END IF;
  IF v_evt.status <> 'pending' OR v_evt.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IN_FLIGHT');
  END IF;
  IF v_evt.lease_expires_at IS NULL OR v_evt.lease_expires_at <= clock_timestamp() THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'STALE_CONTEXT',
      lease_token = NULL, lease_expires_at = NULL WHERE id = v_evt.id;
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_CONTEXT');
  END IF;
  IF v_context->>'ok' IS DISTINCT FROM 'true' OR v_evt.context_hash IS DISTINCT FROM p_context_hash
    OR p_context_hash IS DISTINCT FROM v_context->>'context_hash' THEN
    v_code := 'STALE_CONTEXT';
  ELSIF EXISTS(SELECT 1 FROM public.doit_insights WHERE user_id = p_user_id
    AND source_record_id = p_record_id AND status = 'candidate') THEN
    v_code := 'PENDING_INSIGHTS';
  ELSIF p_error_code IS NOT NULL OR COALESCE(btrim(p_question), '') = '' OR char_length(p_question) > 200 THEN
    v_code := 'AI_ERROR';
  END IF;
  IF v_code IS NOT NULL THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = v_code,
      lease_token = NULL, lease_expires_at = NULL, response_payload = NULL WHERE id = v_evt.id;
    RETURN jsonb_build_object('ok', false, 'code', v_code);
  END IF;
  v_question := jsonb_build_object('text', btrim(p_question), 'sourceRecordId', p_record_id);
  UPDATE public.doit_request_events SET status = 'applied', error_code = NULL,
    lease_token = NULL, lease_expires_at = NULL, response_payload = jsonb_build_object('question', v_question)
    WHERE id = v_evt.id;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'question', v_question);
END;
$function$;

-- Read-only restore. Stale questions disappear after a correction or any relevant record change.
CREATE OR REPLACE FUNCTION public.doit_get_followup(p_user_id uuid, p_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_context jsonb;
  v_question jsonb;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), 0);
  v_context := public.doit_followup_context(p_user_id, p_record_id);
  IF v_context->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_context; END IF;
  IF EXISTS(SELECT 1 FROM public.doit_insights WHERE user_id = p_user_id
    AND source_record_id = p_record_id AND status = 'candidate') THEN
    RETURN jsonb_build_object('ok', true, 'question', NULL);
  END IF;
  SELECT response_payload->'question' INTO v_question FROM public.doit_request_events
    WHERE user_id = p_user_id AND target_id = p_record_id AND action = 'followup_generate'
      AND status = 'applied' AND context_hash = v_context->>'context_hash'
    ORDER BY updated_at DESC LIMIT 1;
  RETURN jsonb_build_object('ok', true, 'question', v_question);
END;
$function$;

-- v5 candidate generation now uses the same claim-before-AI discipline.
-- The existing apply RPC remains the single place that inserts candidate insights.
CREATE OR REPLACE FUNCTION public.doit_begin_insight_generate(
  p_user_id uuid, p_record_id uuid, p_request_id uuid, p_payload_hash text, p_lease_token uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_context jsonb;
  v_evt public.doit_request_events%ROWTYPE;
  v_cached jsonb;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_request_id IS NULL OR p_lease_token IS NULL OR COALESCE(p_payload_hash, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), 0);
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));
  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF v_evt.id IS NOT NULL AND
    (v_evt.action IS DISTINCT FROM 'insight_generate' OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
  END IF;
  v_context := public.doit_followup_context(p_user_id, p_record_id);
  IF v_context->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_context; END IF;
  IF v_evt.status = 'applied' THEN
    -- Old v5 events have no exact response snapshot. Never pay for AI again to guess that response.
    IF v_evt.response_payload IS NULL OR v_evt.context_hash IS DISTINCT FROM v_context->>'context_hash' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'STALE_CONTEXT');
    END IF;
    RETURN v_evt.response_payload || jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.doit_request_events WHERE user_id = p_user_id
    AND action IN ('insight_generate', 'followup_generate') AND target_id = p_record_id
    AND status = 'pending' AND lease_expires_at > clock_timestamp()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IN_FLIGHT');
  END IF;
  SELECT response_payload INTO v_cached FROM public.doit_request_events
    WHERE user_id = p_user_id AND target_id = p_record_id AND action = 'insight_generate'
      AND status = 'applied' AND context_hash = v_context->>'context_hash' AND response_payload IS NOT NULL
    ORDER BY updated_at DESC LIMIT 1;
  IF v_cached IS NOT NULL THEN
    IF v_evt.id IS NULL THEN
      INSERT INTO public.doit_request_events(user_id, request_id, action, target_id, payload_hash,
        status, context_hash, response_payload)
      VALUES(p_user_id, p_request_id, 'insight_generate', p_record_id, p_payload_hash,
        'applied', v_context->>'context_hash', v_cached);
    ELSE
      UPDATE public.doit_request_events SET status = 'applied', context_hash = v_context->>'context_hash',
        response_payload = v_cached, error_code = NULL, lease_token = NULL, lease_expires_at = NULL
        WHERE id = v_evt.id;
    END IF;
    RETURN v_cached || jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.doit_insights WHERE user_id = p_user_id
    AND source_record_id = p_record_id AND status = 'candidate') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PENDING_INSIGHTS');
  END IF;
  IF v_evt.id IS NULL THEN
    INSERT INTO public.doit_request_events(user_id, request_id, action, target_id, payload_hash,
      status, context_hash, lease_token, lease_expires_at)
    VALUES(p_user_id, p_request_id, 'insight_generate', p_record_id, p_payload_hash,
      'pending', v_context->>'context_hash', p_lease_token, clock_timestamp() + interval '90 seconds');
  ELSE
    UPDATE public.doit_request_events SET status = 'pending', target_id = p_record_id,
      context_hash = v_context->>'context_hash', lease_token = p_lease_token,
      lease_expires_at = clock_timestamp() + interval '90 seconds', response_payload = NULL, error_code = NULL
      WHERE id = v_evt.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'lease_token', p_lease_token, 'context', v_context);
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_finish_insight_generate(
  p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_record_id uuid,
  p_source_text text, p_lease_token uuid, p_context_hash text,
  p_candidates jsonb, p_rescue jsonb, p_trace jsonb, p_error_code text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_context jsonb;
  v_evt public.doit_request_events%ROWTYPE;
  v_out jsonb;
  v_response jsonb;
  v_code text;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), 0);
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));
  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
  IF v_evt.id IS NULL OR p_action IS DISTINCT FROM 'insight_generate'
    OR v_evt.action IS DISTINCT FROM p_action OR v_evt.target_id IS DISTINCT FROM p_record_id
    OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
  END IF;
  v_context := public.doit_followup_context(p_user_id, p_record_id);
  IF v_evt.status = 'applied' THEN
    IF v_evt.response_payload IS NULL OR v_context->>'ok' IS DISTINCT FROM 'true'
      OR v_evt.context_hash IS DISTINCT FROM v_context->>'context_hash' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'STALE_CONTEXT');
    END IF;
    RETURN v_evt.response_payload || jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_evt.status <> 'pending' OR v_evt.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IN_FLIGHT');
  END IF;
  IF v_evt.lease_expires_at IS NULL OR v_evt.lease_expires_at <= clock_timestamp()
    OR v_context->>'ok' IS DISTINCT FROM 'true' OR v_evt.context_hash IS DISTINCT FROM p_context_hash
    OR p_context_hash IS DISTINCT FROM v_context->>'context_hash' THEN
    v_code := 'STALE_CONTEXT';
  ELSIF p_source_text IS DISTINCT FROM v_context->'record'->>'text' THEN
    v_code := 'BAD_REQUEST';
  ELSIF p_error_code IS NOT NULL THEN
    v_code := 'AI_ERROR';
  ELSIF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' THEN
    v_code := 'BAD_REQUEST';
  ELSIF jsonb_array_length(p_candidates) > 9 THEN
    v_code := 'BAD_REQUEST';
  END IF;
  IF v_code IS NULL AND jsonb_array_length(p_candidates) = 0 THEN
    IF p_rescue IS NULL OR jsonb_typeof(p_rescue) <> 'object'
      OR COALESCE(p_rescue->>'kind', '') NOT IN ('ai_question','quoted_question','generic_question')
      OR COALESCE(btrim(p_rescue->>'text'), '') = '' OR char_length(p_rescue->>'text') > 200 THEN
      v_code := 'AI_ERROR';
    END IF;
  END IF;
  IF v_code IS NOT NULL THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = v_code,
      lease_token = NULL, lease_expires_at = NULL, response_payload = NULL WHERE id = v_evt.id;
    RETURN jsonb_build_object('ok', false, 'code', v_code);
  END IF;
  IF jsonb_array_length(p_candidates) > 0 THEN
    -- Same transaction and reentrant locks: checking context and inserting candidates are atomic.
    v_out := public.doit_apply_insight_generate(p_user_id, p_request_id, p_action,
      p_payload_hash, p_record_id, p_source_text, p_candidates);
    IF v_out->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_out; END IF;
    v_response := jsonb_build_object('insights', v_out->'insights', 'trace', p_trace);
  ELSE
    v_response := jsonb_build_object('insights', '[]'::jsonb, 'rescued', true, 'rescue', p_rescue, 'trace', p_trace);
  END IF;
  -- Candidate insertion itself changes the context. Cache the post-commit version, not the input version.
  v_context := public.doit_followup_context(p_user_id, p_record_id);
  UPDATE public.doit_request_events SET status = 'applied', error_code = NULL,
    context_hash = v_context->>'context_hash', response_payload = v_response,
    lease_token = NULL, lease_expires_at = NULL WHERE id = v_evt.id;
  RETURN v_response || jsonb_build_object('ok', true, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.doit_followup_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_begin_followup(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_finish_followup(uuid, uuid, uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_get_followup(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doit_followup_context(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_begin_followup(uuid, uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_finish_followup(uuid, uuid, uuid, text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_get_followup(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.doit_begin_insight_generate(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doit_finish_insight_generate(uuid, uuid, text, text, uuid, text, uuid, text, jsonb, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doit_begin_insight_generate(uuid, uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.doit_finish_insight_generate(uuid, uuid, text, text, uuid, text, uuid, text, jsonb, jsonb, jsonb, text) TO service_role;
COMMIT;

-- Default rollback: disable v6 UI gates, restore Edge v5, KEEP revision locks and additive columns.
-- ROLLBACK_20260921_doit_revision_lock.sql is an emergency-only captured-definition restore;
-- it removes new concurrency safeguards and must not run as part of a routine rollback.
-- Retain all accepted question/candidate data. No production data deletion is part of rollback.
