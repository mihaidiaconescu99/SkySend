-- Persistent admin incident workflow, unavailable hub state and payment snapshots.

ALTER TABLE public.operational_settings
  ADD COLUMN IF NOT EXISTS manual_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.operational_settings
  DROP CONSTRAINT IF EXISTS operational_settings_manual_status_check;
ALTER TABLE public.operational_settings
  ADD CONSTRAINT operational_settings_manual_status_check
  CHECK (manual_status IN ('active', 'maintenance', 'unavailable'));

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS payment_method_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.incident_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'archived')),
  assigned_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incident_workflows(id) ON DELETE CASCADE,
  author_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incident_workflows(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  sent_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.incident_workflows (order_id, status)
SELECT id, 'open'
FROM public.orders
WHERE status = 'failed'
ON CONFLICT (order_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_incident_workflows_status_updated
  ON public.incident_workflows(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_notes_incident_created
  ON public.incident_notes(incident_id, created_at);

DROP TRIGGER IF EXISTS set_timestamp_incident_workflows
  ON public.incident_workflows;
CREATE TRIGGER set_timestamp_incident_workflows
  BEFORE UPDATE ON public.incident_workflows
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.incident_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.incident_workflows, public.incident_notes,
  public.incident_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.incident_workflows, public.incident_notes,
  public.incident_notifications TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_workflows;
