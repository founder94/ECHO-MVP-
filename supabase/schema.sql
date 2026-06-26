-- ============================================================
-- ECHO MVP Production — Database Schema Reference
-- Supabase PostgreSQL
-- ============================================================

-- ============================================================
-- 1. profiles — 사용자 프로필
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  age_group TEXT,
  onboarding_answers JSONB DEFAULT '[]'::jsonb,
  role TEXT DEFAULT 'user',
  payment_status TEXT DEFAULT 'free',  -- 'free' | 'paid'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. analytics_events — 방문자 분석 이벤트
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,           -- 'pageview' | 'click' | 'scroll' 등
  event_name TEXT NOT NULL,           -- 이벤트 상세명
  page_path TEXT,
  button_name TEXT,
  section_name TEXT,
  referrer TEXT,
  device_type TEXT,                   -- 'desktop' | 'mobile' | 'tablet'
  browser TEXT,
  os TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. ai_logs — AI 분석 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  report_id TEXT,
  model TEXT DEFAULT 'gpt-4o-mini',
  status TEXT DEFAULT 'success',      -- 'success' | 'error' | 'safety_blocked'
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  response_time_ms INT DEFAULT 0,
  total_time_ms INT DEFAULT 0,
  estimated_cost NUMERIC DEFAULT 0,
  error_message TEXT,
  safety_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. order_headers — 주문 헤더
-- ============================================================
CREATE TABLE IF NOT EXISTS order_headers (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT,                   -- Supabase auth.uid() (NULL = guest)
  status TEXT DEFAULT 'pending_payment',
  customer_notes TEXT,
  admin_notes TEXT,
  tracking_number TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  shipping_total NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  subtotal_items NUMERIC(12,2) DEFAULT 0,
  discount_price NUMERIC(12,2) DEFAULT 0,
  payment_provider TEXT NOT NULL,     -- 'stripe' | 'toss'
  checkout_session_id TEXT,           -- Stripe cs_xxx / Toss orderId
  payment_id TEXT,                    -- Stripe pi_xxx / Toss paymentKey
  recipient JSONB NOT NULL DEFAULT ''::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- order_items — 주문 아이템
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES order_headers(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku_id TEXT,
  sku_label TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  final_price NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. Product Tables — 상품 관리
-- ============================================================

-- product_categories — 상품 카테고리
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_items — 상품 아이템 (id starts at 100000)
CREATE TABLE IF NOT EXISTS product_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES product_categories(id),
  status TEXT NOT NULL DEFAULT 'draft',     -- 'active' | 'inactive' | 'draft'
  description TEXT,
  pricing_mode INT DEFAULT 0,               -- 0=same price, 1=per-variant
  currency TEXT NOT NULL DEFAULT 'USD',
  price NUMERIC(12,2) DEFAULT 0,
  stock INT DEFAULT 0,
  discount_enabled BOOLEAN NOT NULL DEFAULT false,
  discount_price NUMERIC(12,2),
  media JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{"url":"...","type":"image"}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_variants — 상품 옵션 그룹 (e.g. Size, Color)
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES product_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["S","M","L"]
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_skus — SKU 단위 (옵션 조합)
CREATE TABLE IF NOT EXISTS product_skus (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES product_items(id) ON DELETE CASCADE,
  label TEXT,                                   -- "Large / Red"
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(12,2) DEFAULT 0,
  stock INT DEFAULT 0,
  discount_enabled BOOLEAN NOT NULL DEFAULT false,
  discount_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_custom_fields — 커스텀 필드 정의
CREATE TABLE IF NOT EXISTS product_custom_fields (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',  -- 'text'|'date'|'datetime'|'dropdown'|'number'
  options JSONB DEFAULT '[]'::jsonb,        -- dropdown options
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_custom_values — 커스텀 필드 값
CREATE TABLE IF NOT EXISTS product_custom_values (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES product_items(id) ON DELETE CASCADE,
  field_id BIGINT NOT NULL REFERENCES product_custom_fields(id) ON DELETE CASCADE,
  value TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, field_id)
);

-- ============================================================
-- Edge Functions
-- ============================================================
-- supabase/functions/create-echo-checkout/   → Stripe Checkout Session 생성
-- supabase/functions/stripe-echo-webhook/    → Stripe Webhook (결제 완료 → paid)
-- supabase/functions/confirm-echo-toss-payment/ → Toss 결제 승인
-- supabase/functions/create-echo-toss-checkout/  → Toss 결제 요청
-- supabase/functions/echo-ai-analysis/        → OpenAI AI 분석

-- ============================================================
-- 6. Row Level Security (RLS) Policies
-- ============================================================

-- Helper: admin role check
CREATE OR REPLACE FUNCTION public.is_echo_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── profiles ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT USING (auth.uid() = id OR public.is_echo_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── analytics_events ──
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_insert_all" ON analytics_events;
CREATE POLICY "analytics_events_insert_all" ON analytics_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "analytics_events_update_own_visitor" ON analytics_events;
CREATE POLICY "analytics_events_update_own_visitor" ON analytics_events
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "analytics_events_select_admin" ON analytics_events;
CREATE POLICY "analytics_events_select_admin" ON analytics_events
  FOR SELECT USING (public.is_echo_admin());

-- ── ai_logs ──
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_logs_select_admin" ON ai_logs;
CREATE POLICY "ai_logs_select_admin" ON ai_logs
  FOR SELECT USING (public.is_echo_admin());

-- Inserts from Edge Functions use service_role (bypasses RLS)

-- ── order_headers ──
ALTER TABLE order_headers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_headers_select_own_or_admin" ON order_headers;
CREATE POLICY "order_headers_select_own_or_admin" ON order_headers
  FOR SELECT USING (
    customer_id = auth.uid()::text OR public.is_echo_admin()
  );

DROP POLICY IF EXISTS "order_headers_insert_own" ON order_headers;
CREATE POLICY "order_headers_insert_own" ON order_headers
  FOR INSERT WITH CHECK (customer_id = auth.uid()::text);

-- Updates from stripe-echo-webhook use service_role (bypasses RLS)

-- ── order_items ──
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON order_items;
CREATE POLICY "order_items_select_own_or_admin" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_headers oh
      WHERE oh.id = order_items.order_id
        AND (oh.customer_id = auth.uid()::text OR public.is_echo_admin())
    )
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_headers oh
      WHERE oh.id = order_items.order_id
        AND oh.customer_id = auth.uid()::text
    )
  );