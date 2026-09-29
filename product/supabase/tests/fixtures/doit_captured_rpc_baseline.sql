-- TEST BASELINE ONLY. Six exact captured pg_get_functiondef definitions.
-- Extracted from the reviewed emergency rollback, not an instruction to roll back production.
-- No user data, credentials, production grants or RLS included.

CREATE OR REPLACE FUNCTION public.doit_apply_insight_generate(p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_record_id uuid, p_source_text text, p_candidates jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_evt record;
  v_list jsonb;
  v_i int;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden: owner mismatch';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_evt.action IS DISTINCT FROM p_action OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    END IF;
    IF v_evt.status = 'applied' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb) INTO v_list
        FROM public.doit_insights t
        WHERE t.user_id = p_user_id AND t.request_id = p_request_id;
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'insights', v_list);
    END IF;
  ELSE
    INSERT INTO public.doit_request_events(user_id, request_id, action, payload_hash, status)
      VALUES (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  END IF;

  IF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'BAD_REQUEST'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(p_candidates) - 1 LOOP
    INSERT INTO public.doit_insights(
      user_id, category, text, ai_text, source_record_id, source_text, status, origin, request_id
    ) VALUES (
      p_user_id,
      p_candidates->v_i->>'category',
      p_candidates->v_i->>'text',
      p_candidates->v_i->>'text',
      p_record_id,
      p_source_text,
      'candidate',
      'ai',
      p_request_id
    );
  END LOOP;

  UPDATE public.doit_request_events
    SET status = 'applied', target_id = p_record_id, error_code = NULL
    WHERE user_id = p_user_id AND request_id = p_request_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb) INTO v_list
    FROM public.doit_insights t
    WHERE t.user_id = p_user_id AND t.request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'insights', v_list);
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_apply_insight_self(p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_record_id uuid, p_category text, p_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_evt record;
  v_rec record;
  v_source text;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden: owner mismatch';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_evt.action IS DISTINCT FROM p_action OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    END IF;
    IF v_evt.status = 'applied' THEN
      SELECT * INTO v_rec FROM public.doit_insights
        WHERE user_id = p_user_id AND request_id = p_request_id
        LIMIT 1;
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'insight', CASE WHEN v_rec.id IS NULL THEN NULL ELSE to_jsonb(v_rec) END);
    END IF;
  ELSE
    INSERT INTO public.doit_request_events(user_id, request_id, action, payload_hash, status)
      VALUES (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  END IF;

  IF p_record_id IS NOT NULL THEN
    SELECT text INTO v_source FROM public.doit_records
      WHERE id = p_record_id AND user_id = p_user_id;
    IF NOT FOUND THEN
      UPDATE public.doit_request_events SET status = 'failed', error_code = 'FORBIDDEN'
        WHERE user_id = p_user_id AND request_id = p_request_id;
      RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    END IF;
  END IF;

  INSERT INTO public.doit_insights(user_id, category, text, source_record_id, source_text, status, origin, request_id)
    VALUES (p_user_id, p_category, p_text, p_record_id, v_source, 'confirmed', 'self', p_request_id)
    RETURNING * INTO v_rec;

  UPDATE public.doit_request_events
    SET status = 'applied', target_id = v_rec.id, applied_revision = 1, error_code = NULL
    WHERE user_id = p_user_id AND request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'insight', to_jsonb(v_rec));
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_apply_insight_transition(p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_insight_id uuid, p_expected_revision integer, p_new_status text, p_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_evt record;
  v_ins record;
  v_cur_status text;
  v_cur_rev integer;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden: owner mismatch';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_evt.action IS DISTINCT FROM p_action OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    END IF;
    IF v_evt.status = 'applied' THEN
      SELECT * INTO v_ins FROM public.doit_insights
        WHERE id = p_insight_id AND user_id = p_user_id;
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'insight', CASE WHEN v_ins.id IS NULL THEN NULL ELSE to_jsonb(v_ins) END);
    END IF;
  ELSE
    INSERT INTO public.doit_request_events(user_id, request_id, action, payload_hash, status)
      VALUES (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  END IF;

  SELECT status, revision INTO v_cur_status, v_cur_rev FROM public.doit_insights
    WHERE id = p_insight_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'FORBIDDEN'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF v_cur_status = 'rejected' THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'INVALID_STATE'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  END IF;
  IF v_cur_rev IS DISTINCT FROM p_expected_revision THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'STALE_REVISION'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_REVISION');
  END IF;

  UPDATE public.doit_insights
    SET status = p_new_status,
        revision = revision + 1,
        text = CASE WHEN p_text IS NOT NULL AND btrim(p_text) <> '' THEN p_text ELSE text END,
        request_id = p_request_id
    WHERE id = p_insight_id AND user_id = p_user_id
    RETURNING * INTO v_ins;

  IF v_ins.id IS NULL THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'STALE_REVISION'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_REVISION');
  END IF;

  UPDATE public.doit_request_events
    SET status = 'applied', target_id = p_insight_id,
        prev_revision = p_expected_revision, applied_revision = p_expected_revision + 1, error_code = NULL
    WHERE user_id = p_user_id AND request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'insight', to_jsonb(v_ins));
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_apply_record_create(p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_text text, p_emotion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_evt record;
  v_rec record;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden: owner mismatch';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_evt.action IS DISTINCT FROM p_action OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    END IF;
    IF v_evt.status = 'applied' THEN
      SELECT * INTO v_rec FROM public.doit_records
        WHERE user_id = p_user_id AND request_id = p_request_id;
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'record', CASE WHEN v_rec.id IS NULL THEN NULL ELSE to_jsonb(v_rec) END);
    END IF;
  ELSE
    INSERT INTO public.doit_request_events(user_id, request_id, action, payload_hash, status)
      VALUES (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  END IF;

  INSERT INTO public.doit_records(user_id, original_text, text, emotion, status, request_id)
    VALUES (p_user_id, p_text, p_text, p_emotion, 'confirmed', p_request_id)
    RETURNING * INTO v_rec;

  UPDATE public.doit_request_events
    SET status = 'applied', target_id = v_rec.id, applied_revision = 1, error_code = NULL
    WHERE user_id = p_user_id AND request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'record', to_jsonb(v_rec));
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_apply_record_create(p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_text text, p_original_text text, p_emotion text, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_evt record;
  v_rec record;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden: owner mismatch';
    END IF;
  END IF;

  IF p_status NOT IN ('confirmed','corrected','rejected') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_evt.action IS DISTINCT FROM p_action OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    END IF;
    IF v_evt.status = 'applied' THEN
      SELECT * INTO v_rec FROM public.doit_records
        WHERE user_id = p_user_id AND request_id = p_request_id;
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'record', CASE WHEN v_rec.id IS NULL THEN NULL ELSE to_jsonb(v_rec) END);
    END IF;
  ELSE
    INSERT INTO public.doit_request_events(user_id, request_id, action, payload_hash, status)
      VALUES (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  END IF;

  INSERT INTO public.doit_records(user_id, original_text, text, emotion, status, request_id)
    VALUES (p_user_id, p_original_text, p_text, p_emotion, p_status, p_request_id)
    RETURNING * INTO v_rec;

  UPDATE public.doit_request_events
    SET status = 'applied', target_id = v_rec.id, applied_revision = 1, error_code = NULL
    WHERE user_id = p_user_id AND request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'record', to_jsonb(v_rec));
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.doit_apply_record_update(p_user_id uuid, p_request_id uuid, p_action text, p_payload_hash text, p_record_id uuid, p_expected_revision integer, p_text text, p_emotion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_evt record;
  v_rec record;
  v_cur_rev integer;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden: owner mismatch';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_request_id::text));

  SELECT * INTO v_evt FROM public.doit_request_events
    WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_evt.action IS DISTINCT FROM p_action OR v_evt.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CONFLICT');
    END IF;
    IF v_evt.status = 'applied' THEN
      SELECT * INTO v_rec FROM public.doit_records
        WHERE id = p_record_id AND user_id = p_user_id;
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'record', CASE WHEN v_rec.id IS NULL THEN NULL ELSE to_jsonb(v_rec) END);
    END IF;
  ELSE
    INSERT INTO public.doit_request_events(user_id, request_id, action, payload_hash, status)
      VALUES (p_user_id, p_request_id, p_action, p_payload_hash, 'pending');
  END IF;

  SELECT revision INTO v_cur_rev FROM public.doit_records
    WHERE id = p_record_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'FORBIDDEN'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF v_cur_rev IS DISTINCT FROM p_expected_revision THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'STALE_REVISION'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_REVISION');
  END IF;

  UPDATE public.doit_records
    SET text = p_text,
        emotion = p_emotion,
        revision = revision + 1
    WHERE id = p_record_id AND user_id = p_user_id
    RETURNING * INTO v_rec;

  IF v_rec.id IS NULL THEN
    UPDATE public.doit_request_events SET status = 'failed', error_code = 'STALE_REVISION'
      WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_REVISION');
  END IF;

  UPDATE public.doit_request_events
    SET status = 'applied', target_id = p_record_id,
        prev_revision = p_expected_revision, applied_revision = p_expected_revision + 1, error_code = NULL
    WHERE user_id = p_user_id AND request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'record', to_jsonb(v_rec));
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$function$;
