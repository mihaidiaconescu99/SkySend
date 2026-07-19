ALTER TABLE parcel_evaluations
  ADD COLUMN IF NOT EXISTS client_applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_final_view_id UUID;

ALTER TABLE parcel_evaluations
  DROP CONSTRAINT IF EXISTS parcel_evaluations_client_applied_after_finalize;
ALTER TABLE parcel_evaluations
  ADD CONSTRAINT parcel_evaluations_client_applied_after_finalize
  CHECK (client_applied_at IS NULL OR status = 'finalized');
