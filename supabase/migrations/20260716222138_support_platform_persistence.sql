
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

UPDATE support_tickets
SET status = 'closed', closed_at = COALESCE(closed_at, resolved_at, updated_at)
WHERE status = 'resolved';

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'assigned', 'waiting_customer', 'closed'));

UPDATE assistant_conversations
SET mode = 'closed'
WHERE mode = 'resolved';

ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE contact_messages
  ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('new', 'read', 'replied', 'archived'));
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE TABLE delivery_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'submitted', 'cancelled')),
  current_step TEXT NOT NULL DEFAULT 'route'
    CHECK (current_step IN ('route', 'parcel', 'options', 'review')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_delivery_drafts_one_active_per_profile
  ON delivery_drafts(profile_id)
  WHERE status = 'active';
CREATE INDEX idx_delivery_drafts_profile_updated
  ON delivery_drafts(profile_id, updated_at DESC);

CREATE TABLE parcel_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_draft_id UUID NOT NULL REFERENCES delivery_drafts(id) ON DELETE CASCADE,
  client_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_operator_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'in_review', 'waiting_customer', 'customer_replied',
      'finalized', 'cancelled'
    )),
  initial_description TEXT NOT NULL CHECK (char_length(trim(initial_description)) > 0),
  parcel_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate_trace JSONB,
  weight_kg NUMERIC(7,2),
  length_cm NUMERIC(8,2),
  width_cm NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  warnings TEXT[] NOT NULL DEFAULT '{}',
  assigned_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  client_applied_at TIMESTAMPTZ,
  client_final_view_id UUID,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    status <> 'finalized'
    OR (
      weight_kg > 0 AND length_cm > 0 AND width_cm > 0 AND height_cm > 0
      AND finalized_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX idx_parcel_evaluations_one_active_per_draft
  ON parcel_evaluations(delivery_draft_id)
  WHERE status NOT IN ('finalized', 'cancelled');
CREATE INDEX idx_parcel_evaluations_queue
  ON parcel_evaluations(status, updated_at DESC);
CREATE INDEX idx_parcel_evaluations_client
  ON parcel_evaluations(client_profile_id, updated_at DESC);

CREATE TABLE parcel_evaluation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES parcel_evaluations(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('client', 'operator', 'admin', 'system')),
  author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message_kind TEXT NOT NULL DEFAULT 'note'
    CHECK (message_kind IN ('request', 'question', 'answer', 'note', 'system')),
  reply_to_message_id UUID REFERENCES parcel_evaluation_messages(id) ON DELETE SET NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(trim(body)) > 0 OR message_kind = 'system')
);

CREATE INDEX idx_parcel_evaluation_messages_timeline
  ON parcel_evaluation_messages(evaluation_id, created_at);

CREATE TABLE contact_message_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  sent_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resend_email_id TEXT UNIQUE,
  internet_message_id TEXT,
  in_reply_to TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'bounced', 'received')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_message_emails_thread
  ON contact_message_emails(contact_message_id, created_at);

CREATE TABLE file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_message_id UUID REFERENCES assistant_messages(id) ON DELETE CASCADE,
  evaluation_message_id UUID REFERENCES parcel_evaluation_messages(id) ON DELETE CASCADE,
  contact_email_id UUID REFERENCES contact_message_emails(id) ON DELETE CASCADE,
  uploaded_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  r2_object_key TEXT UNIQUE NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    num_nonnulls(assistant_message_id, evaluation_message_id, contact_email_id) = 1
  )
);

CREATE INDEX idx_file_attachments_expiry ON file_attachments(expires_at);
CREATE INDEX idx_file_attachments_assistant_message ON file_attachments(assistant_message_id);
CREATE INDEX idx_file_attachments_evaluation_message ON file_attachments(evaluation_message_id);
CREATE INDEX idx_file_attachments_contact_email ON file_attachments(contact_email_id);

CREATE TRIGGER set_timestamp_delivery_drafts
  BEFORE UPDATE ON delivery_drafts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_parcel_evaluations
  BEFORE UPDATE ON parcel_evaluations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE delivery_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_evaluation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_message_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON delivery_drafts, parcel_evaluations, parcel_evaluation_messages,
  contact_message_emails, file_attachments FROM anon;
GRANT SELECT, INSERT, UPDATE ON delivery_drafts, parcel_evaluations,
  parcel_evaluation_messages, contact_message_emails, file_attachments TO authenticated;
GRANT ALL ON delivery_drafts, parcel_evaluations, parcel_evaluation_messages,
  contact_message_emails, file_attachments TO service_role;

DROP POLICY IF EXISTS "contact_messages_insert_anyone" ON contact_messages;
REVOKE INSERT ON contact_messages FROM anon;

DROP POLICY IF EXISTS "assistant_conversations_select_owner_or_support" ON assistant_conversations;
CREATE POLICY "assistant_conversations_select_owner_or_staff" ON assistant_conversations
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      profile_id = (SELECT public.current_user_profile_id())
      OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
    )
  );

DROP POLICY IF EXISTS "assistant_conversations_update_owner_or_support" ON assistant_conversations;
CREATE POLICY "assistant_conversations_update_owner_or_staff" ON assistant_conversations
  FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  )
  WITH CHECK (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  );

DROP POLICY IF EXISTS "assistant_messages_select_via_conversation" ON assistant_messages;
CREATE POLICY "assistant_messages_select_via_conversation" ON assistant_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assistant_conversations conversation
      WHERE conversation.id = assistant_messages.conversation_id
        AND conversation.expires_at > now()
        AND (
          conversation.profile_id = (SELECT public.current_user_profile_id())
          OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "assistant_messages_insert_client_or_support" ON assistant_messages;
CREATE POLICY "assistant_messages_insert_client_or_staff" ON assistant_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      author_type = 'client'
      AND author_profile_id = (SELECT public.current_user_profile_id())
      AND EXISTS (
        SELECT 1 FROM assistant_conversations conversation
        WHERE conversation.id = assistant_messages.conversation_id
          AND conversation.profile_id = (SELECT public.current_user_profile_id())
          AND conversation.expires_at > now()
      )
    )
    OR (
      author_type IN ('operator', 'system')
      AND (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
    )
  );

DROP POLICY IF EXISTS "support_tickets_select_owner_or_support" ON support_tickets;
CREATE POLICY "support_tickets_select_owner_or_staff" ON support_tickets
  FOR SELECT TO authenticated
  USING (
    client_profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  );

DROP POLICY IF EXISTS "support_tickets_update_support" ON support_tickets;
CREATE POLICY "support_tickets_update_staff" ON support_tickets
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('operator', 'suport', 'admin'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('operator', 'suport', 'admin'));

CREATE POLICY "delivery_drafts_owner_or_staff_select" ON delivery_drafts
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  );
CREATE POLICY "delivery_drafts_owner_insert" ON delivery_drafts
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY "delivery_drafts_owner_or_admin_update" ON delivery_drafts
  FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) = 'admin'
  )
  WITH CHECK (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) = 'admin'
  );

CREATE POLICY "parcel_evaluations_owner_or_staff_select" ON parcel_evaluations
  FOR SELECT TO authenticated
  USING (
    client_profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  );
CREATE POLICY "parcel_evaluations_owner_insert" ON parcel_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (client_profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY "parcel_evaluations_owner_or_staff_update" ON parcel_evaluations
  FOR UPDATE TO authenticated
  USING (
    client_profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  )
  WITH CHECK (
    client_profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
  );

CREATE POLICY "parcel_evaluation_messages_via_evaluation_select" ON parcel_evaluation_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parcel_evaluations evaluation
      WHERE evaluation.id = parcel_evaluation_messages.evaluation_id
        AND (
          evaluation.client_profile_id = (SELECT public.current_user_profile_id())
          OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
        )
    )
  );
CREATE POLICY "parcel_evaluation_messages_via_evaluation_insert" ON parcel_evaluation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_profile_id = (SELECT public.current_user_profile_id())
    AND EXISTS (
      SELECT 1 FROM parcel_evaluations evaluation
      WHERE evaluation.id = parcel_evaluation_messages.evaluation_id
        AND (
          evaluation.client_profile_id = (SELECT public.current_user_profile_id())
          OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
        )
    )
  );

CREATE POLICY "contact_message_emails_staff_only" ON contact_message_emails
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('operator', 'suport', 'admin'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('operator', 'suport', 'admin'));

CREATE POLICY "file_attachments_authorized_select" ON file_attachments
  FOR SELECT TO authenticated
  USING (
    uploaded_by_profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport', 'admin')
    OR EXISTS (
      SELECT 1
      FROM assistant_messages message
      JOIN assistant_conversations conversation ON conversation.id = message.conversation_id
      WHERE message.id = file_attachments.assistant_message_id
        AND conversation.profile_id = (SELECT public.current_user_profile_id())
    )
  );
CREATE POLICY "file_attachments_uploader_insert" ON file_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by_profile_id = (SELECT public.current_user_profile_id()));
