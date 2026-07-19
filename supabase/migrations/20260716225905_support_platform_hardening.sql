ALTER FUNCTION public.trigger_set_timestamp() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.current_user_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT, TEXT, TEXT)
  TO service_role;

CREATE INDEX IF NOT EXISTS idx_assistant_messages_author_profile
  ON assistant_messages(author_profile_id);
CREATE INDEX IF NOT EXISTS idx_contact_message_emails_sent_by_profile
  ON contact_message_emails(sent_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drafts_submitted_order
  ON delivery_drafts(submitted_order_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by_profile
  ON file_attachments(uploaded_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_parcel_evaluation_messages_author_profile
  ON parcel_evaluation_messages(author_profile_id);
CREATE INDEX IF NOT EXISTS idx_parcel_evaluation_messages_reply_to
  ON parcel_evaluation_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_parcel_evaluations_assigned_operator
  ON parcel_evaluations(assigned_operator_profile_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_operator
  ON support_tickets(assigned_operator_profile_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_closed_by_profile
  ON support_tickets(closed_by_profile_id);
