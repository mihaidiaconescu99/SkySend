CREATE TABLE parcel_ai_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_draft_id UUID NOT NULL REFERENCES delivery_drafts(id) ON DELETE CASCADE,
  uploaded_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (0, 1)),
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  r2_original_key TEXT UNIQUE NOT NULL,
  r2_normalized_key TEXT UNIQUE,
  normalized_content_type TEXT,
  normalized_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'ready', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (delivery_draft_id, slot)
);

CREATE INDEX idx_parcel_ai_images_draft ON parcel_ai_images(delivery_draft_id);
CREATE INDEX idx_parcel_ai_images_expiry ON parcel_ai_images(expires_at);

CREATE TRIGGER set_timestamp_parcel_ai_images
  BEFORE UPDATE ON parcel_ai_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE parcel_ai_images ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON parcel_ai_images FROM anon, authenticated;
GRANT ALL ON parcel_ai_images TO service_role;
