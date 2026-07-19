

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'client'
    CHECK (role IN ('client', 'operator', 'admin', 'suport')),
  notification_preferences JSONB NOT NULL
    DEFAULT '{"popup": true, "email": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT,
  formatted_address TEXT NOT NULL,
  city TEXT,
  county TEXT,
  country TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_profile_id ON addresses(profile_id);
CREATE INDEX idx_addresses_profile_id_is_saved
  ON addresses(profile_id, is_saved);

CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declared_weight_kg NUMERIC(5, 2),
  declared_dimensions_cm JSONB,
  estimated_weight_range TEXT,
  contents_description TEXT NOT NULL,
  packaging_type TEXT
    CHECK (
      packaging_type IS NULL OR packaging_type IN (
        'soft_pouch',
        'plastic_bag',
        'boxed',
        'insulated',
        'fragile_protective',
        'heavy_duty'
      )
    ),
  approximate_size TEXT
    CHECK (
      approximate_size IS NULL OR approximate_size IN (
        'extra_small',
        'small',
        'medium',
        'large'
      )
    ),
  fragility_level TEXT NOT NULL DEFAULT 'low'
    CHECK (fragility_level IN ('low', 'moderate', 'high')),
  thermal_protection TEXT NOT NULL DEFAULT 'none'
    CHECK (thermal_protection IN ('none', 'passive', 'active')),
  security_module TEXT NOT NULL DEFAULT 'standard'
    CHECK (security_module IN ('standard', 'secure', 'secure_plus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_order_id TEXT UNIQUE NOT NULL,
  public_tracking_code TEXT UNIQUE NOT NULL,
  recipient_tracking_token TEXT UNIQUE NOT NULL,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  pickup_address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  dropoff_address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  fulfillment_status TEXT,
  dispatch_timing TEXT NOT NULL DEFAULT 'standard'
    CHECK (dispatch_timing IN ('standard', 'priority', 'scheduled', 'critical')),
  scheduled_at TIMESTAMPTZ,
  drone_class TEXT NOT NULL,
  delivery_configuration_id TEXT NOT NULL,
  eta_min_minutes INTEGER,
  eta_max_minutes INTEGER,
  total_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RON',
  pricing_snapshot JSONB NOT NULL,
  handoff_points_snapshot JSONB,
  selected_pickup_handoff_point JSONB,
  selected_dropoff_handoff_point JSONB,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN (
      'pending',
      'paid',
      'failed',
      'refunded',
      'refund_pending'
    )),
  refund_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_sender_profile_id ON orders(sender_profile_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_local_order_id ON orders(local_order_id);
CREATE INDEX idx_orders_public_tracking_code ON orders(public_tracking_code);
CREATE INDEX idx_orders_recipient_tracking_token
  ON orders(recipient_tracking_token);

CREATE INDEX idx_orders_pickup_address_id ON orders(pickup_address_id);
CREATE INDEX idx_orders_dropoff_address_id ON orders(dropoff_address_id);
CREATE INDEX idx_orders_parcel_id ON orders(parcel_id);

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  current_status TEXT NOT NULL DEFAULT 'mission_created'
    CHECK (current_status IN (
      'mission_created',
      'preflight_checks',
      'drone_dispatched',
      'en_route_to_pickup',
      'arrived_at_pickup',
      'awaiting_sender_position_confirmation',
      'pickup_safety_check',
      'locker_descending_pickup',
      'awaiting_pickup_pin',
      'awaiting_parcel_load',
      'locker_ascending_pickup',
      'payload_verification',
      'parcel_secured',
      'en_route_to_dropoff',
      'arrived_at_dropoff',
      'awaiting_recipient_position_confirmation',
      'dropoff_safety_check',
      'locker_descending_dropoff',
      'awaiting_recipient_pin',
      'awaiting_parcel_collection',
      'locker_ascending_dropoff',
      'delivery_completed',
      'proof_generated',
      'mission_closed',
      'returning_to_hub',
      'returned_to_hub',
      'mission_failed',
      'fallback_required'
    )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  drone_telemetry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  pickup_pin TEXT,
  dropoff_pin TEXT,
  pickup_pin_attempts INTEGER NOT NULL DEFAULT 0,
  dropoff_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pickup_pin_verified_at TIMESTAMPTZ,
  dropoff_pin_verified_at TIMESTAMPTZ,
  fallback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_missions_current_status ON missions(current_status);

CREATE TABLE mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mission_events_mission_id ON mission_events(mission_id);
CREATE INDEX idx_mission_events_mission_id_occurred_at
  ON mission_events(mission_id, occurred_at);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('order', 'mission', 'payment', 'system')),
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_profile_id ON notifications(profile_id);
CREATE INDEX idx_notifications_profile_id_read
  ON notifications(profile_id, read);

CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RON',
  type TEXT NOT NULL
    CHECK (type IN ('payment', 'refund', 'partial_refund')),
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX idx_payment_records_profile_id ON payment_records(profile_id);

CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'archived')),
  read_at TIMESTAMPTZ,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  changes JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_actor_profile_id
  ON audit_events(actor_profile_id);
CREATE INDEX idx_audit_events_entity_type_entity_id
  ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_occurred_at ON audit_events(occurred_at);

CREATE TABLE operational_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_singleton BOOLEAN GENERATED ALWAYS AS (true) STORED UNIQUE,
  service_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 6,
  base_price_minor INTEGER NOT NULL DEFAULT 990,
  price_per_km_minor INTEGER NOT NULL DEFAULT 220,
  confirmation_timer_minutes INTEGER NOT NULL DEFAULT 10,
  loading_timer_minutes INTEGER NOT NULL DEFAULT 10,
  unloading_timer_minutes INTEGER NOT NULL DEFAULT 10,
  hub_latitude DOUBLE PRECISION NOT NULL DEFAULT 44.8565,
  hub_longitude DOUBLE PRECISION NOT NULL DEFAULT 24.8692,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_saved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_settings_last_saved_by
  ON operational_settings(last_saved_by);

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_addresses
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_missions
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_notifications
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_contact_messages
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_operational_settings
  BEFORE UPDATE ON operational_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

INSERT INTO operational_settings DEFAULT VALUES;
