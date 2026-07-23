ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatch_starts_at TIMESTAMPTZ;

ALTER TABLE public.billing_documents
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  ADD COLUMN IF NOT EXISTS delivery_attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (delivery_attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.profile_billing_details (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.delivery_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_draft_id UUID REFERENCES public.delivery_drafts(id) ON DELETE SET NULL,
  local_order_id TEXT UNIQUE NOT NULL,
  public_tracking_code TEXT UNIQUE NOT NULL,
  recipient_tracking_token TEXT UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  pricing_result JSONB NOT NULL,
  order_pricing_snapshot JSONB NOT NULL,
  handoff_points_snapshot JSONB,
  selected_pickup_handoff_point JSONB,
  selected_dropoff_handoff_point JSONB,
  total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  locale TEXT NOT NULL DEFAULT 'ro' CHECK (locale IN ('ro', 'en')),
  billing_data JSONB,
  privacy_acknowledged_at TIMESTAMPTZ,
  current_step TEXT NOT NULL DEFAULT 'summary'
    CHECK (current_step IN ('summary', 'billing', 'payment')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active', 'payment_processing', 'finalizing', 'finalized',
      'expired', 'cancelled', 'finalization_failed'
    )),
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  selected_payment_method_id TEXT,
  save_payment_method BOOLEAN NOT NULL DEFAULT false,
  order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  dispatch_starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 minutes'),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_checkout_one_active_profile
  ON public.delivery_checkout_sessions(profile_id)
  WHERE status IN ('active', 'payment_processing', 'finalizing', 'finalization_failed');
CREATE INDEX IF NOT EXISTS idx_delivery_checkout_expiry
  ON public.delivery_checkout_sessions(expires_at)
  WHERE status IN ('active', 'payment_processing');

DROP TRIGGER IF EXISTS set_timestamp_profile_billing_details
  ON public.profile_billing_details;
CREATE TRIGGER set_timestamp_profile_billing_details
  BEFORE UPDATE ON public.profile_billing_details
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
DROP TRIGGER IF EXISTS set_timestamp_delivery_checkout_sessions
  ON public.delivery_checkout_sessions;
CREATE TRIGGER set_timestamp_delivery_checkout_sessions
  BEFORE UPDATE ON public.delivery_checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.profile_billing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_billing_details, public.delivery_checkout_sessions
  FROM anon, authenticated;
GRANT ALL ON public.profile_billing_details, public.delivery_checkout_sessions
  TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_paid_delivery_checkout(
  p_session_id UUID,
  p_payment_intent_id TEXT,
  p_charge_id TEXT,
  p_paid_at TIMESTAMPTZ
)
RETURNS TABLE(order_id UUID, local_order_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.delivery_checkout_sessions%ROWTYPE;
  v_pickup_id UUID;
  v_dropoff_id UUID;
  v_parcel_id UUID;
  v_order_id UUID;
  v_payload JSONB;
  v_billing JSONB;
  v_dispatch_base TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_session
  FROM public.delivery_checkout_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'checkout_session_not_found'; END IF;
  IF v_session.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id THEN
    RAISE EXCEPTION 'checkout_payment_intent_mismatch';
  END IF;
  IF v_session.order_id IS NOT NULL THEN
    RETURN QUERY SELECT v_session.order_id, v_session.local_order_id;
    RETURN;
  END IF;
  IF v_session.billing_data IS NULL OR v_session.privacy_acknowledged_at IS NULL THEN
    RAISE EXCEPTION 'checkout_billing_missing';
  END IF;

  v_payload := v_session.payload;
  v_billing := v_session.billing_data;
  UPDATE public.delivery_checkout_sessions
    SET status = 'finalizing', paid_at = p_paid_at, last_error = NULL
    WHERE id = v_session.id;

  INSERT INTO public.addresses(
    profile_id, formatted_address, city, county, country, postal_code,
    latitude, longitude, is_saved
  ) VALUES (
    v_session.profile_id,
    v_payload #>> '{pickupAddress,formattedAddress}',
    v_payload #>> '{pickupAddress,city}',
    v_payload #>> '{pickupAddress,county}',
    v_payload #>> '{pickupAddress,country}',
    NULLIF(v_payload #>> '{pickupAddress,postalCode}', ''),
    (v_payload #>> '{pickupAddress,location,latitude}')::DOUBLE PRECISION,
    (v_payload #>> '{pickupAddress,location,longitude}')::DOUBLE PRECISION,
    false
  ) RETURNING id INTO v_pickup_id;

  INSERT INTO public.addresses(
    profile_id, formatted_address, city, county, country, postal_code,
    latitude, longitude, is_saved
  ) VALUES (
    v_session.profile_id,
    v_payload #>> '{dropoffAddress,formattedAddress}',
    v_payload #>> '{dropoffAddress,city}',
    v_payload #>> '{dropoffAddress,county}',
    v_payload #>> '{dropoffAddress,country}',
    NULLIF(v_payload #>> '{dropoffAddress,postalCode}', ''),
    (v_payload #>> '{dropoffAddress,location,latitude}')::DOUBLE PRECISION,
    (v_payload #>> '{dropoffAddress,location,longitude}')::DOUBLE PRECISION,
    false
  ) RETURNING id INTO v_dropoff_id;

  INSERT INTO public.parcels(
    contents_description, fragility_level, packaging_type, approximate_size,
    declared_weight_kg, estimated_weight_range, declared_dimensions_cm,
    thermal_protection, security_module
  ) VALUES (
    v_payload #>> '{parcel,contentDescription}',
    COALESCE(v_payload #>> '{parcel,fragilityLevel}', 'low'),
    NULLIF(v_payload #>> '{parcel,packaging}', ''),
    NULLIF(v_payload #>> '{parcel,approximateSize}', ''),
    NULLIF(v_payload #>> '{parcel,weightKg}', '')::NUMERIC,
    NULLIF(v_payload #>> '{parcel,estimatedWeightRange}', ''),
    CASE WHEN NULLIF(v_payload #>> '{parcel,lengthCm}', '') IS NOT NULL
      AND NULLIF(v_payload #>> '{parcel,widthCm}', '') IS NOT NULL
      AND NULLIF(v_payload #>> '{parcel,heightCm}', '') IS NOT NULL
      THEN jsonb_build_object(
        'lengthCm', (v_payload #>> '{parcel,lengthCm}')::NUMERIC,
        'widthCm', (v_payload #>> '{parcel,widthCm}')::NUMERIC,
        'heightCm', (v_payload #>> '{parcel,heightCm}')::NUMERIC
      ) ELSE NULL END,
    CASE v_payload #>> '{selectedDeliveryConfiguration,protection,temperatureProtection}'
      WHEN 'passive_insulated' THEN 'passive'
      WHEN 'active_thermal' THEN 'active'
      ELSE 'none'
    END,
    CASE v_payload #>> '{selectedDeliveryConfiguration,protection,securityLevel}'
      WHEN 'secure_plus' THEN 'secure_plus'
      WHEN 'secure' THEN 'secure'
      ELSE 'standard'
    END
  ) RETURNING id INTO v_parcel_id;

  v_dispatch_base := GREATEST(
    p_paid_at,
    COALESCE(NULLIF(v_payload ->> 'scheduledAt', '')::TIMESTAMPTZ, p_paid_at)
  );

  INSERT INTO public.orders(
    local_order_id, public_tracking_code, recipient_tracking_token,
    sender_profile_id, pickup_address_id, dropoff_address_id, parcel_id,
    status, fulfillment_status, dispatch_timing, scheduled_at, drone_class,
    delivery_configuration_id, eta_min_minutes, eta_max_minutes,
    total_amount_minor, currency, pricing_snapshot, handoff_points_snapshot,
    selected_pickup_handoff_point, selected_dropoff_handoff_point,
    stripe_payment_intent_id, stripe_charge_id, paid_at, dispatch_starts_at,
    payment_status
  ) VALUES (
    v_session.local_order_id, v_session.public_tracking_code,
    v_session.recipient_tracking_token, v_session.profile_id,
    v_pickup_id, v_dropoff_id, v_parcel_id,
    'in_progress', 'active_mission',
    COALESCE(v_payload ->> 'urgency', 'standard'),
    NULLIF(v_payload ->> 'scheduledAt', '')::TIMESTAMPTZ,
    v_payload ->> 'recommendedDroneClass',
    COALESCE(v_payload #>> '{selectedDeliveryConfiguration,id}', 'default'),
    NULLIF(v_payload #>> '{estimatedEta,minMinutes}', '')::INTEGER,
    NULLIF(v_payload #>> '{estimatedEta,maxMinutes}', '')::INTEGER,
    v_session.total_amount_minor, v_session.currency,
    v_session.order_pricing_snapshot, v_session.handoff_points_snapshot,
    v_session.selected_pickup_handoff_point,
    v_session.selected_dropoff_handoff_point,
    p_payment_intent_id, p_charge_id, p_paid_at, v_dispatch_base + interval '7 seconds',
    'paid'
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_billing_snapshots(
    order_id, customer_type, full_name, company_legal_name, tax_identifier,
    address_line, city, region, country_code, postal_code, invoice_email,
    locale, privacy_acknowledged_at, locked_at
  ) VALUES (
    v_order_id, v_billing ->> 'customerType', NULLIF(v_billing ->> 'fullName', ''),
    NULLIF(v_billing ->> 'companyLegalName', ''), NULLIF(v_billing ->> 'taxIdentifier', ''),
    v_billing ->> 'addressLine', v_billing ->> 'city', v_billing ->> 'region',
    upper(v_billing ->> 'countryCode'), NULLIF(v_billing ->> 'postalCode', ''),
    lower(v_billing ->> 'invoiceEmail'), COALESCE(v_billing ->> 'locale', 'ro'),
    v_session.privacy_acknowledged_at, p_paid_at
  );

  UPDATE public.delivery_checkout_sessions
    SET status = 'finalized', order_id = v_order_id, paid_at = p_paid_at,
        dispatch_starts_at = v_dispatch_base + interval '7 seconds', last_error = NULL
    WHERE id = v_session.id;

  RETURN QUERY SELECT v_order_id, v_session.local_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_paid_delivery_checkout(UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_delivery_checkout(UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_predispatch_cancellation(
  p_order_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_mission_status TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND sender_profile_id = p_profile_id
    FOR UPDATE;
  IF NOT FOUND OR v_order.payment_status <> 'paid' OR v_order.status <> 'in_progress' THEN
    RETURN false;
  END IF;

  SELECT current_status INTO v_mission_status FROM public.missions
    WHERE order_id = v_order.id
    FOR UPDATE;
  IF v_mission_status IS NOT NULL
    AND v_mission_status NOT IN ('mission_created', 'preflight_checks') THEN
    RETURN false;
  END IF;

  UPDATE public.orders SET
    status = 'cancelled', fulfillment_status = 'canceled',
    payment_status = 'refund_pending', refund_status = 'pending',
    notes = 'Anulată de client înainte de dispatch.'
  WHERE id = v_order.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_predispatch_cancellation(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_predispatch_cancellation(UUID, UUID)
  TO service_role;

-- Called only by scripts/cleanup-legacy-unpaid-orders.mjs after Stripe confirms
-- that every supplied PaymentIntent is uncaptured and cancelled.
CREATE OR REPLACE FUNCTION public.cleanup_legacy_unpaid_orders(p_order_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids UUID[];
  v_address_ids UUID[];
  v_parcel_ids UUID[];
  v_deleted INTEGER := 0;
BEGIN
  SELECT array_agg(id), array_agg(pickup_address_id) || array_agg(dropoff_address_id),
         array_agg(parcel_id)
    INTO v_order_ids, v_address_ids, v_parcel_ids
  FROM public.orders
  WHERE id = ANY(p_order_ids)
    AND paid_at IS NULL
    AND payment_status IN ('pending', 'failed')
    AND stripe_charge_id IS NULL;

  IF v_order_ids IS NULL THEN RETURN 0; END IF;

  DELETE FROM public.order_communication_events WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_tracking_links WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.mission_events WHERE mission_id IN (
    SELECT id FROM public.missions WHERE order_id = ANY(v_order_ids)
  );
  DELETE FROM public.missions WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.billing_documents WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.refund_requests WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_billing_snapshots WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.payment_records WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.orders WHERE id = ANY(v_order_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  DELETE FROM public.addresses address
    WHERE address.id = ANY(v_address_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.orders remaining
        WHERE remaining.pickup_address_id = address.id OR remaining.dropoff_address_id = address.id
      );
  DELETE FROM public.parcels parcel
    WHERE parcel.id = ANY(v_parcel_ids)
      AND NOT EXISTS (SELECT 1 FROM public.orders remaining WHERE remaining.parcel_id = parcel.id);
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_legacy_unpaid_orders(UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_legacy_unpaid_orders(UUID[])
  TO service_role;

-- Make newly-created checkout tables and RPCs immediately visible to PostgREST.
NOTIFY pgrst, 'reload schema';
