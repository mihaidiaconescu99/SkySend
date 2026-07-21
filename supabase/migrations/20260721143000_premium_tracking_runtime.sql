ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_code_access_mode TEXT NOT NULL DEFAULT 'view'
    CHECK (public_code_access_mode IN ('view', 'control'));

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS state_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS step_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runtime_state JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_missions_step_expires_at
  ON public.missions(step_expires_at)
  WHERE step_expires_at IS NOT NULL AND failed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.order_tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('full', 'pickup', 'dropoff')),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_links_order_id
  ON public.order_tracking_links(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_links_token
  ON public.order_tracking_links(token);

ALTER TABLE public.order_tracking_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_tracking_links FROM anon, authenticated;
GRANT ALL ON TABLE public.order_tracking_links TO service_role;

COMMENT ON COLUMN public.orders.public_code_access_mode IS
  'Controls whether the visible SKY-PT identifier is read-only or may execute mission actions.';
COMMENT ON COLUMN public.missions.runtime_state IS
  'Server-owned mission state: meeting points, accepted points, parcel state, segment timing and terminal summary.';
COMMENT ON TABLE public.order_tracking_links IS
  'Opaque bearer links with full, pickup-only or dropoff-only mission capabilities.';
