ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_source_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_source_check
  CHECK (source IN ('ai_handoff', 'contact_form', 'direct'));

CREATE TABLE IF NOT EXISTS order_communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('confirmation', 'scheduled_reminder')),
  locale TEXT NOT NULL DEFAULT 'ro' CHECK (locale IN ('ro', 'en')),
  in_app_completed_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  email_attempt_count INTEGER NOT NULL DEFAULT 0,
  email_sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_order_communication_events_pending
  ON order_communication_events(email_status, event_type, created_at);

CREATE TRIGGER set_timestamp_order_communication_events
  BEFORE UPDATE ON order_communication_events
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE order_communication_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON order_communication_events FROM anon, authenticated;
GRANT ALL ON order_communication_events TO service_role;
