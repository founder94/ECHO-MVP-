-- SYNTHETIC, IN-MEMORY TEST FIXTURE ONLY. Never apply this file to a hosted database.
-- Minimum structural contract based on the 2026-09-21 read-only schema review.
-- Real Auth, RLS policies, production grants, extensions and network are NOT simulated.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE TABLE public.purposes (id text PRIMARY KEY, label text NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, purpose_id text);
INSERT INTO public.purposes(id,label) VALUES ('romance', '연애로 이어질 만남을 원해요'), ('friendship', '편하게 함께할 친구를 원해요');
INSERT INTO public.profiles(id,purpose_id) VALUES
  ('11111111-1111-4111-8111-111111111111', 'romance'),
  ('22222222-2222-4222-8222-222222222222', 'friendship');

CREATE TABLE public.doit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  original_text text NOT NULL CHECK (char_length(btrim(original_text)) > 0),
  text text NOT NULL CHECK (char_length(btrim(text)) > 0),
  emotion text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','corrected','rejected')),
  revision integer NOT NULL DEFAULT 1,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, request_id)
);
CREATE TABLE public.doit_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('value','pattern','memory')),
  text text NOT NULL CHECK (char_length(btrim(text)) > 0),
  ai_text text,
  source_record_id uuid,
  source_text text,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','confirmed','corrected','rejected')),
  origin text NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai','self')),
  revision integer NOT NULL DEFAULT 1,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_record_id, user_id) REFERENCES public.doit_records(id, user_id)
);
CREATE TABLE public.doit_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(btrim(action)) > 0),
  target_id uuid,
  payload_hash text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','failed')),
  prev_revision integer,
  applied_revision integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);
CREATE FUNCTION public.set_doit_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER fixture_records_updated BEFORE UPDATE ON public.doit_records
  FOR EACH ROW EXECUTE FUNCTION public.set_doit_updated_at();
CREATE TRIGGER fixture_insights_updated BEFORE UPDATE ON public.doit_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_doit_updated_at();
CREATE TRIGGER fixture_events_updated BEFORE UPDATE ON public.doit_request_events
  FOR EACH ROW EXECUTE FUNCTION public.set_doit_updated_at();
