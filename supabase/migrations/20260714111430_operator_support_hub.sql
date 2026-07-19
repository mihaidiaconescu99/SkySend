CREATE TABLE assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_email TEXT,
  contact_name TEXT,
  title TEXT NOT NULL DEFAULT 'Conversație SkySend',
  mode TEXT NOT NULL DEFAULT 'ai_active'
    CHECK (mode IN ('ai_active', 'human_requested', 'human_active', 'resolved', 'closed')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (profile_id IS NOT NULL OR contact_email IS NOT NULL)
);

CREATE TABLE assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL
    CHECK (author_type IN ('client', 'assistant', 'operator', 'system')),
  author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID UNIQUE NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('ai_handoff', 'contact_form')),
  client_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  linked_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('parcel_data', 'delivery_tracking', 'billing', 'account', 'technical', 'general')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'waiting_customer', 'resolved', 'closed')),
  assigned_operator_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_assistant_conversations_profile_last_message
  ON assistant_conversations(profile_id, last_message_at DESC);
CREATE INDEX idx_assistant_conversations_expires_at
  ON assistant_conversations(expires_at);
CREATE INDEX idx_assistant_messages_conversation_created
  ON assistant_messages(conversation_id, created_at);
CREATE INDEX idx_support_tickets_queue
  ON support_tickets(status, assigned_operator_profile_id, updated_at DESC);
CREATE INDEX idx_support_tickets_client
  ON support_tickets(client_profile_id, updated_at DESC);
CREATE INDEX idx_support_tickets_order
  ON support_tickets(linked_order_id);

CREATE TRIGGER set_timestamp_assistant_conversations
  BEFORE UPDATE ON assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_support_tickets
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON assistant_conversations TO authenticated;
GRANT SELECT, INSERT ON assistant_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;

CREATE POLICY "assistant_conversations_select_owner_or_support" ON assistant_conversations
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      profile_id = (SELECT public.current_user_profile_id())
      OR (SELECT public.current_user_role()) IN ('operator', 'suport')
    )
  );

CREATE POLICY "assistant_conversations_insert_owner" ON assistant_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT public.current_user_profile_id())
    AND contact_email IS NULL
  );

CREATE POLICY "assistant_conversations_update_owner_or_support" ON assistant_conversations
  FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport')
  )
  WITH CHECK (
    profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport')
  );

CREATE POLICY "assistant_messages_select_via_conversation" ON assistant_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assistant_conversations conversation
      WHERE conversation.id = assistant_messages.conversation_id
        AND conversation.expires_at > now()
        AND (
          conversation.profile_id = (SELECT public.current_user_profile_id())
          OR (SELECT public.current_user_role()) IN ('operator', 'suport')
        )
    )
  );

CREATE POLICY "assistant_messages_insert_client_or_support" ON assistant_messages
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
      AND (SELECT public.current_user_role()) IN ('operator', 'suport')
    )
  );

CREATE POLICY "support_tickets_select_owner_or_support" ON support_tickets
  FOR SELECT TO authenticated
  USING (
    client_profile_id = (SELECT public.current_user_profile_id())
    OR (SELECT public.current_user_role()) IN ('operator', 'suport')
  );

CREATE POLICY "support_tickets_update_support" ON support_tickets
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('operator', 'suport'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('operator', 'suport'));
