BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_source_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_source_check
  CHECK (source IN ('ai_handoff', 'contact_form', 'direct'));

CREATE TABLE IF NOT EXISTS public.order_communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('confirmation', 'scheduled_reminder')),
  locale TEXT NOT NULL DEFAULT 'ro' CHECK (locale IN ('ro', 'en')),
  in_app_completed_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  email_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (email_attempt_count >= 0),
  email_sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_order_communication_events_pending
  ON public.order_communication_events(email_status, event_type, created_at);
DROP TRIGGER IF EXISTS set_timestamp_order_communication_events
  ON public.order_communication_events;
CREATE TRIGGER set_timestamp_order_communication_events
  BEFORE UPDATE ON public.order_communication_events
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DO $$
DECLARE
  expected_tables CONSTANT TEXT[] := ARRAY[
    'addresses',
    'admin_access_requests',
    'admin_mfa_credentials',
    'admin_mfa_recovery_codes',
    'application_rate_limits',
    'assistant_conversations',
    'assistant_messages',
    'audit_events',
    'billing_document_counters',
    'billing_documents',
    'contact_message_emails',
    'contact_messages',
    'delivery_checkout_sessions',
    'delivery_drafts',
    'file_attachments',
    'mission_events',
    'missions',
    'notifications',
    'operational_settings',
    'order_billing_snapshots',
    'order_communication_events',
    'order_tracking_links',
    'orders',
    'parcel_ai_images',
    'parcel_evaluation_messages',
    'parcel_evaluations',
    'parcels',
    'payment_records',
    'platform_override_state',
    'profile_billing_details',
    'profiles',
    'refund_requests',
    'staff_access_assignments',
    'staff_access_sync_jobs',
    'stripe_events',
    'support_tickets',
    'weather_runtime_state'
  ];
  actual_tables TEXT[];
  missing_tables TEXT[];
  unexpected_tables TEXT[];
  missing_columns TEXT[];
BEGIN
  SELECT pg_catalog.array_agg(table_name ORDER BY table_name)
  INTO actual_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

  SELECT pg_catalog.array_agg(expected.table_name ORDER BY expected.table_name)
  INTO missing_tables
  FROM pg_catalog.unnest(expected_tables) AS expected(table_name)
  WHERE NOT (expected.table_name = ANY(actual_tables));

  SELECT pg_catalog.array_agg(actual.table_name ORDER BY actual.table_name)
  INTO unexpected_tables
  FROM pg_catalog.unnest(actual_tables) AS actual(table_name)
  WHERE NOT (actual.table_name = ANY(expected_tables));

  IF missing_tables IS NOT NULL OR unexpected_tables IS NOT NULL THEN
    RAISE EXCEPTION
      'stage_five_schema_mismatch missing=% unexpected=%',
      COALESCE(missing_tables, ARRAY[]::TEXT[]),
      COALESCE(unexpected_tables, ARRAY[]::TEXT[])
      USING ERRCODE = 'P0001';
  END IF;

  WITH required_columns(table_name, column_name) AS (
    VALUES
      ('profiles', 'id'),
      ('profiles', 'clerk_user_id'),
      ('profiles', 'role'),
      ('addresses', 'profile_id'),
      ('orders', 'sender_profile_id'),
      ('notifications', 'profile_id'),
      ('payment_records', 'profile_id'),
      ('operational_settings', 'id'),
      ('billing_documents', 'order_id')
  )
  SELECT pg_catalog.array_agg(
    required.table_name || '.' || required.column_name
    ORDER BY required.table_name, required.column_name
  )
  INTO missing_columns
  FROM required_columns AS required
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS existing
    WHERE existing.table_schema = 'public'
      AND existing.table_name = required.table_name
      AND existing.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'stage_five_required_columns_missing %',
      missing_columns
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  table_column RECORD;
BEGIN
  FOR table_column IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.%2$I FROM PUBLIC, anon, authenticated',
      table_column.column_name,
      table_column.table_name
    );
  END LOOP;
END;
$$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  table_name TEXT;
  policy_record RECORD;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );
  END LOOP;

  FOR policy_record IN
    SELECT tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_record.policyname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_profile_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  profile_id UUID;
  clerk_user_id TEXT := auth.jwt() ->> 'sub';
BEGIN
  IF clerk_user_id IS NULL OR clerk_user_id = '' THEN
    RETURN NULL;
  END IF;

  SELECT profile.id
  INTO profile_id
  FROM public.profiles AS profile
  WHERE profile.clerk_user_id = clerk_user_id;

  RETURN profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  clerk_user_id TEXT := auth.jwt() ->> 'sub';
BEGIN
  IF clerk_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.clerk_user_id = clerk_user_id
  ) THEN
    RETURN 'anonymous';
  END IF;

  RETURN 'client';
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
  p_clerk_user_id TEXT,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  profile_id UUID;
  normalized_clerk_user_id TEXT := pg_catalog.btrim(p_clerk_user_id);
  normalized_email TEXT := pg_catalog.lower(pg_catalog.btrim(p_email));
  normalized_full_name TEXT := NULLIF(pg_catalog.btrim(p_full_name), '');
BEGIN
  IF normalized_clerk_user_id IS NULL
    OR normalized_clerk_user_id = ''
    OR pg_catalog.char_length(normalized_clerk_user_id) > 255 THEN
    RAISE EXCEPTION 'invalid_clerk_user_id' USING ERRCODE = '22023';
  END IF;
  IF normalized_email IS NULL
    OR normalized_email = ''
    OR pg_catalog.char_length(normalized_email) > 320
    OR pg_catalog.strpos(normalized_email, '@') <= 1 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF normalized_full_name IS NOT NULL
    AND pg_catalog.char_length(normalized_full_name) > 200 THEN
    RAISE EXCEPTION 'invalid_full_name' USING ERRCODE = '22023';
  END IF;

  SELECT profile.id
  INTO profile_id
  FROM public.profiles AS profile
  WHERE profile.clerk_user_id = normalized_clerk_user_id;

  IF profile_id IS NULL THEN
    INSERT INTO public.profiles (clerk_user_id, email, full_name, role)
    VALUES (
      normalized_clerk_user_id,
      normalized_email,
      normalized_full_name,
      'client'
    )
    RETURNING id INTO profile_id;

    INSERT INTO public.audit_events (
      actor_profile_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      changes
    )
    VALUES (
      profile_id,
      'client',
      'profile_created',
      'profiles',
      profile_id::TEXT,
      pg_catalog.jsonb_build_object(
        'clerk_user_id',
        normalized_clerk_user_id,
        'email',
        normalized_email
      )
    );
  ELSE
    UPDATE public.profiles AS profile
    SET
      email = normalized_email,
      full_name = COALESCE(normalized_full_name, profile.full_name)
    WHERE profile.id = profile_id
      AND (
        profile.email IS DISTINCT FROM normalized_email
        OR (
          normalized_full_name IS NOT NULL
          AND profile.full_name IS DISTINCT FROM normalized_full_name
        )
      );
  END IF;

  RETURN profile_id;
END;
$$;

DO $$
DECLARE
  function_signature REGPROCEDURE;
BEGIN
  FOR function_signature IN
    SELECT procedure.oid::REGPROCEDURE
    FROM pg_catalog.pg_proc AS procedure
    INNER JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public',
      function_signature
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_profile_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT, TEXT, TEXT)
  TO service_role;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.addresses TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications
  TO authenticated;
GRANT SELECT ON TABLE public.payment_records TO authenticated;
GRANT SELECT ON TABLE public.operational_settings TO authenticated;
GRANT SELECT ON TABLE public.billing_documents TO authenticated;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY addresses_select_own
  ON public.addresses
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY addresses_insert_own
  ON public.addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY addresses_update_own
  ON public.addresses
  FOR UPDATE
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()))
  WITH CHECK (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY addresses_delete_own
  ON public.addresses
  FOR DELETE
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()));

CREATE POLICY orders_select_own
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (sender_profile_id = (SELECT public.current_user_profile_id()));

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY notifications_insert_own
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()))
  WITH CHECK (profile_id = (SELECT public.current_user_profile_id()));
CREATE POLICY notifications_delete_own
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()));

CREATE POLICY payment_records_select_own
  ON public.payment_records
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT public.current_user_profile_id()));

CREATE POLICY operational_settings_select_authenticated
  ON public.operational_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'sub') IS NOT NULL);

CREATE POLICY billing_documents_select_own
  ON public.billing_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders AS owned_order
      WHERE owned_order.id = billing_documents.order_id
        AND owned_order.sender_profile_id =
          (SELECT public.current_user_profile_id())
    )
  );

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL (
        ARRAY[
          'profiles',
          'addresses',
          'orders',
          'notifications',
          'payment_records',
          'operational_settings',
          'billing_documents'
        ]
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY direct_access_denied ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_name
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.current_user_role() IS
  'Client-only compatibility projection for direct RLS. Clerk organization membership remains authoritative for operator and admin access.';

DO $$
DECLARE
  rls_disabled_tables TEXT[];
  unexpected_authenticated_privileges TEXT[];
  missing_authenticated_privileges TEXT[];
  missing_deny_policies TEXT[];
BEGIN
  SELECT pg_catalog.array_agg(relation.relname ORDER BY relation.relname)
  INTO rls_disabled_tables
  FROM pg_catalog.pg_class AS relation
  INNER JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND NOT relation.relrowsecurity;

  IF rls_disabled_tables IS NOT NULL THEN
    RAISE EXCEPTION
      'stage_five_rls_verification_failed %',
      rls_disabled_tables
      USING ERRCODE = 'P0001';
  END IF;

  SELECT pg_catalog.array_agg(
    privilege.table_name || ':' || privilege.privilege_type
    ORDER BY privilege.table_name, privilege.privilege_type
  )
  INTO unexpected_authenticated_privileges
  FROM information_schema.table_privileges AS privilege
  WHERE privilege.table_schema = 'public'
    AND privilege.grantee = 'authenticated'
    AND NOT (
      (privilege.table_name = 'profiles'
        AND privilege.privilege_type = 'SELECT')
      OR
      (privilege.table_name = 'addresses'
        AND privilege.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
      OR
      (privilege.table_name = 'orders'
        AND privilege.privilege_type = 'SELECT')
      OR
      (privilege.table_name = 'notifications'
        AND privilege.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
      OR
      (privilege.table_name = 'payment_records'
        AND privilege.privilege_type = 'SELECT')
      OR
      (privilege.table_name = 'operational_settings'
        AND privilege.privilege_type = 'SELECT')
      OR
      (privilege.table_name = 'billing_documents'
        AND privilege.privilege_type = 'SELECT')
    );

  IF unexpected_authenticated_privileges IS NOT NULL THEN
    RAISE EXCEPTION
      'stage_five_unexpected_authenticated_privileges %',
      unexpected_authenticated_privileges
      USING ERRCODE = 'P0001';
  END IF;

  WITH expected_privileges(table_name, privilege_type) AS (
    VALUES
      ('profiles', 'SELECT'),
      ('addresses', 'SELECT'),
      ('addresses', 'INSERT'),
      ('addresses', 'UPDATE'),
      ('addresses', 'DELETE'),
      ('orders', 'SELECT'),
      ('notifications', 'SELECT'),
      ('notifications', 'INSERT'),
      ('notifications', 'UPDATE'),
      ('notifications', 'DELETE'),
      ('payment_records', 'SELECT'),
      ('operational_settings', 'SELECT'),
      ('billing_documents', 'SELECT')
  )
  SELECT pg_catalog.array_agg(
    expected.table_name || ':' || expected.privilege_type
    ORDER BY expected.table_name, expected.privilege_type
  )
  INTO missing_authenticated_privileges
  FROM expected_privileges AS expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.table_privileges AS actual
    WHERE actual.table_schema = 'public'
      AND actual.table_name = expected.table_name
      AND actual.grantee = 'authenticated'
      AND actual.privilege_type = expected.privilege_type
  );

  IF missing_authenticated_privileges IS NOT NULL THEN
    RAISE EXCEPTION
      'stage_five_missing_authenticated_privileges %',
      missing_authenticated_privileges
      USING ERRCODE = 'P0001';
  END IF;

  SELECT pg_catalog.array_agg(table_info.table_name ORDER BY table_info.table_name)
  INTO missing_deny_policies
  FROM information_schema.tables AS table_info
  WHERE table_info.table_schema = 'public'
    AND table_info.table_type = 'BASE TABLE'
    AND table_info.table_name <> ALL (
      ARRAY[
        'profiles',
        'addresses',
        'orders',
        'notifications',
        'payment_records',
        'operational_settings',
        'billing_documents'
      ]
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policies AS policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = table_info.table_name
        AND policy.policyname = 'direct_access_denied'
        AND policy.permissive = 'RESTRICTIVE'
    );

  IF missing_deny_policies IS NOT NULL THEN
    RAISE EXCEPTION
      'stage_five_deny_policy_verification_failed %',
      missing_deny_policies
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
