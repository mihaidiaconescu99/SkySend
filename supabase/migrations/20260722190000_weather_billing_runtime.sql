-- Weather availability, secure billing snapshots and generated documents.

ALTER TABLE public.operational_settings
  ADD COLUMN IF NOT EXISTS manual_status TEXT NOT NULL DEFAULT 'active'
    CHECK (manual_status IN ('active', 'maintenance'));

UPDATE public.operational_settings
SET manual_status = CASE WHEN is_active THEN 'active' ELSE 'maintenance' END;

CREATE TABLE public.weather_runtime_state (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  level TEXT CHECK (level IN ('safe', 'warning', 'suspended')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_observed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_valid_at TIMESTAMPTZ,
  check_status TEXT NOT NULL DEFAULT 'never'
    CHECK (check_status IN ('never', 'success', 'failed')),
  last_error TEXT,
  evaluated_hour TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.weather_runtime_state (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.platform_override_state (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  forced_status TEXT CHECK (forced_status IN ('active')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    forced_status IS NULL OR
    (started_at IS NOT NULL AND expires_at = started_at + interval '24 hours')
  )
);

INSERT INTO public.platform_override_state (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.activate_platform_override(p_actor_profile_id UUID)
RETURNS public.platform_override_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row public.platform_override_state;
BEGIN
  INSERT INTO public.platform_override_state (
    id, forced_status, started_at, expires_at, created_by,
    cancelled_at, cancelled_by
  ) VALUES (
    'default', 'active', v_now, v_now + INTERVAL '24 hours',
    p_actor_profile_id, NULL, NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    forced_status = 'active',
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    created_by = EXCLUDED.created_by,
    cancelled_at = NULL,
    cancelled_by = NULL
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_platform_override(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_platform_override(UUID) TO service_role;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'pending', 'paid', 'failed', 'partially_refunded', 'refunded', 'refund_pending'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_unique
  ON public.orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_stripe_refund_unique
  ON public.payment_records(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_payment_intent_payment_unique
  ON public.payment_records(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL AND type = 'payment';

CREATE TABLE public.order_billing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('individual', 'company')),
  full_name TEXT,
  company_legal_name TEXT,
  tax_identifier TEXT,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (char_length(country_code) = 2),
  postal_code TEXT,
  invoice_email TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ro' CHECK (locale IN ('ro', 'en')),
  privacy_acknowledged_at TIMESTAMPTZ NOT NULL,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (customer_type = 'individual' AND char_length(trim(COALESCE(full_name, ''))) > 0)
    OR
    (customer_type = 'company'
      AND char_length(trim(COALESCE(company_legal_name, ''))) > 0
      AND char_length(trim(COALESCE(tax_identifier, ''))) > 0)
  )
);

CREATE TYPE public.billing_document_type AS ENUM ('invoice', 'credit_note');
CREATE TYPE public.billing_generation_status AS ENUM (
  'pending', 'generating', 'retry_scheduled', 'ready', 'failed'
);

CREATE TABLE public.billing_document_counters (
  document_year INTEGER NOT NULL,
  document_type public.billing_document_type NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_year, document_type)
);

CREATE TABLE public.billing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  billing_snapshot_id UUID NOT NULL REFERENCES public.order_billing_snapshots(id) ON DELETE RESTRICT,
  document_type public.billing_document_type NOT NULL,
  document_number TEXT UNIQUE NOT NULL,
  original_document_id UUID REFERENCES public.billing_documents(id) ON DELETE RESTRICT,
  stripe_refund_id TEXT UNIQUE,
  refund_kind TEXT CHECK (refund_kind IS NULL OR refund_kind IN ('full', 'partial')),
  refund_reason TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  line_items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_method_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generation_status public.billing_generation_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'invoice-generator.com',
  pdf_object_key TEXT UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code TEXT,
  last_error_message TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (document_type = 'invoice' AND original_document_id IS NULL AND stripe_refund_id IS NULL)
    OR
    (document_type = 'credit_note' AND original_document_id IS NOT NULL AND stripe_refund_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_billing_documents_one_invoice_per_order
  ON public.billing_documents(order_id)
  WHERE document_type = 'invoice';
CREATE INDEX idx_billing_documents_due
  ON public.billing_documents(generation_status, next_attempt_at);
CREATE INDEX idx_billing_documents_order
  ON public.billing_documents(order_id, issued_at);

CREATE TABLE public.stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  object_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing', 'processed', 'failed')),
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  requested_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  stripe_refund_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS operational_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS operational_held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operational_hold_remaining_seconds INTEGER
    CHECK (operational_hold_remaining_seconds IS NULL OR operational_hold_remaining_seconds >= 0);

CREATE OR REPLACE FUNCTION public.create_billing_document(
  p_order_id UUID,
  p_billing_snapshot_id UUID,
  p_document_type public.billing_document_type,
  p_amount_minor INTEGER,
  p_currency TEXT,
  p_line_items JSONB,
  p_payment_method JSONB DEFAULT '{}'::jsonb,
  p_original_document_id UUID DEFAULT NULL,
  p_stripe_refund_id TEXT DEFAULT NULL,
  p_refund_kind TEXT DEFAULT NULL,
  p_refund_reason TEXT DEFAULT NULL
)
RETURNS public.billing_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_sequence INTEGER;
  v_number TEXT;
  v_document public.billing_documents;
BEGIN
  INSERT INTO billing_document_counters(document_year, document_type, last_number)
  VALUES (v_year, p_document_type, 1)
  ON CONFLICT (document_year, document_type)
  DO UPDATE SET last_number = billing_document_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_sequence;

  v_number := CASE WHEN p_document_type = 'invoice' THEN 'SS-' ELSE 'SS-CN-' END
    || v_year::TEXT || '-' || lpad(v_sequence::TEXT, 6, '0');

  INSERT INTO billing_documents(
    order_id, billing_snapshot_id, document_type, document_number,
    original_document_id, stripe_refund_id, refund_kind, refund_reason,
    amount_minor, currency, line_items_snapshot, payment_method_snapshot
  ) VALUES (
    p_order_id, p_billing_snapshot_id, p_document_type, v_number,
    p_original_document_id, p_stripe_refund_id, p_refund_kind, p_refund_reason,
    p_amount_minor, upper(p_currency), p_line_items, p_payment_method
  )
  RETURNING * INTO v_document;

  RETURN v_document;
END;
$$;

CREATE TRIGGER set_timestamp_weather_runtime_state
  BEFORE UPDATE ON public.weather_runtime_state
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_platform_override_state
  BEFORE UPDATE ON public.platform_override_state
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_order_billing_snapshots
  BEFORE UPDATE ON public.order_billing_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE OR REPLACE FUNCTION public.prevent_locked_billing_snapshot_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'billing_snapshot_locked' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_locked_billing_snapshot_update
  BEFORE UPDATE ON public.order_billing_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_billing_snapshot_update();
CREATE TRIGGER set_timestamp_billing_documents
  BEFORE UPDATE ON public.billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_refund_requests
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.weather_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_override_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_billing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_document_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weather_runtime_state, public.platform_override_state,
  public.order_billing_snapshots, public.billing_document_counters,
  public.billing_documents, public.stripe_events, public.refund_requests
  FROM anon, authenticated;
GRANT ALL ON public.weather_runtime_state, public.platform_override_state,
  public.order_billing_snapshots, public.billing_document_counters,
  public.billing_documents, public.stripe_events, public.refund_requests
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_billing_document(
  UUID, UUID, public.billing_document_type, INTEGER, TEXT, JSONB, JSONB,
  UUID, TEXT, TEXT, TEXT
) TO service_role;
