ALTER TABLE parcel_evaluations
  ADD COLUMN IF NOT EXISTS client_final_view_id UUID;
