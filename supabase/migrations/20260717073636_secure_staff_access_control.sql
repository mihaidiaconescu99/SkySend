
UPDATE public.profiles
SET role = 'operator'
WHERE role = 'suport';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'operator', 'admin'));

CREATE TABLE public.staff_access_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('operator', 'admin')),
  access_kind TEXT NOT NULL CHECK (access_kind IN ('permanent', 'temporary')),
  status TEXT NOT NULL DEFAULT 'pending_sync'
    CHECK (status IN ('pending_sync', 'active', 'revoked', 'expired', 'failed')),
  source TEXT NOT NULL DEFAULT 'direct'
    CHECK (source IN ('direct', 'request', 'bootstrap')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  granted_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_reason TEXT,
  external_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_access_assignments_duration_check CHECK (
    (access_kind = 'permanent' AND expires_at IS NULL)
    OR
    (access_kind = 'temporary' AND expires_at IS NOT NULL AND expires_at > starts_at)
  )
);

CREATE UNIQUE INDEX staff_access_assignments_one_current_per_profile
  ON public.staff_access_assignments(profile_id)
  WHERE status IN ('pending_sync', 'active');
CREATE INDEX staff_access_assignments_profile_status_idx
  ON public.staff_access_assignments(profile_id, status);
CREATE INDEX staff_access_assignments_expiry_idx
  ON public.staff_access_assignments(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE TABLE public.admin_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_duration_minutes INTEGER NOT NULL
    CHECK (requested_duration_minutes IN (60, 240, 1440, 10080)),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 20 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'revoked')),
  reviewed_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note TEXT,
  assignment_id UUID REFERENCES public.staff_access_assignments(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_access_requests_one_pending_per_requester
  ON public.admin_access_requests(requester_profile_id)
  WHERE status = 'pending';
CREATE INDEX admin_access_requests_status_created_idx
  ON public.admin_access_requests(status, created_at DESC);

CREATE TABLE public.admin_mfa_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  locked_until TIMESTAMPTZ,
  last_used_step BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.admin_mfa_credentials(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credential_id, code_hash)
);
CREATE INDEX admin_mfa_recovery_codes_credential_idx
  ON public.admin_mfa_recovery_codes(credential_id)
  WHERE used_at IS NULL;

CREATE TABLE public.staff_access_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.staff_access_assignments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation TEXT NOT NULL
    CHECK (operation IN ('activate', 'change_role', 'revoke', 'expire', 'reconcile')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX staff_access_sync_jobs_pending_idx
  ON public.staff_access_sync_jobs(status, available_at)
  WHERE status IN ('pending', 'failed');

CREATE TRIGGER set_timestamp_staff_access_assignments
  BEFORE UPDATE ON public.staff_access_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_admin_access_requests
  BEFORE UPDATE ON public.admin_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_admin_mfa_credentials
  BEFORE UPDATE ON public.admin_mfa_credentials
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_staff_access_sync_jobs
  BEFORE UPDATE ON public.staff_access_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

INSERT INTO public.staff_access_assignments (
  profile_id, role, access_kind, status, source, reason, activated_at
)
SELECT
  id,
  CASE WHEN role = 'admin' THEN 'admin' ELSE 'operator' END,
  'permanent',
  'active',
  'bootstrap',
  'Migrare controlată a accesului existent',
  now()
FROM public.profiles
WHERE role IN ('admin', 'operator')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_profile_staff_role(p_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.staff_access_assignments
  WHERE profile_id = p_profile_id
    AND status = 'active'
    AND starts_at <= now()
    AND (access_kind = 'permanent' OR expires_at > now())
  ORDER BY CASE role WHEN 'admin' THEN 2 ELSE 1 END DESC, created_at DESC
  LIMIT 1;

  v_role := COALESCE(v_role, 'client');
  UPDATE public.profiles SET role = v_role WHERE id = p_profile_id AND role IS DISTINCT FROM v_role;
  RETURN v_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_profile_staff_role(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_staff_role(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_profile_id UUID;
  v_role TEXT;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE clerk_user_id = (auth.jwt() ->> 'sub');

  IF v_profile_id IS NULL THEN
    RETURN 'anonymous';
  END IF;

  SELECT role INTO v_role
  FROM public.staff_access_assignments
  WHERE profile_id = v_profile_id
    AND status = 'active'
    AND starts_at <= now()
    AND (access_kind = 'permanent' OR expires_at > now())
  ORDER BY CASE role WHEN 'admin' THEN 2 ELSE 1 END DESC, created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_role, 'client');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
  p_clerk_user_id TEXT,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF p_clerk_user_id IS NULL OR btrim(p_clerk_user_id) = '' THEN
    RAISE EXCEPTION 'clerk_user_id required';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE clerk_user_id = p_clerk_user_id;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (clerk_user_id, email, full_name, role)
    VALUES (p_clerk_user_id, lower(btrim(p_email)), p_full_name, 'client')
    RETURNING id INTO v_profile_id;

    INSERT INTO public.audit_events (
      actor_profile_id, actor_role, action, entity_type, entity_id, changes
    ) VALUES (
      v_profile_id, 'client', 'profile_created', 'profiles', v_profile_id::TEXT,
      jsonb_build_object('clerk_user_id', p_clerk_user_id, 'email', lower(btrim(p_email)))
    );
  ELSE
    UPDATE public.profiles
    SET email = lower(btrim(p_email)), full_name = COALESCE(p_full_name, full_name)
    WHERE id = v_profile_id
      AND (email IS DISTINCT FROM lower(btrim(p_email)) OR full_name IS DISTINCT FROM p_full_name);
  END IF;

  RETURN v_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT, TEXT, TEXT) TO service_role;

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (email, full_name, notification_preferences, updated_at)
  ON TABLE public.profiles TO authenticated;

ALTER TABLE public.staff_access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_access_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_access_assignments_select_own
  ON public.staff_access_assignments FOR SELECT TO authenticated
  USING (profile_id = public.current_user_profile_id());

CREATE POLICY admin_access_requests_select_own
  ON public.admin_access_requests FOR SELECT TO authenticated
  USING (requester_profile_id = public.current_user_profile_id());
CREATE POLICY admin_access_requests_insert_own_operator
  ON public.admin_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_profile_id = public.current_user_profile_id()
    AND public.current_user_role() = 'operator'
    AND status = 'pending'
  );
CREATE POLICY admin_access_requests_cancel_own_pending
  ON public.admin_access_requests FOR UPDATE TO authenticated
  USING (
    requester_profile_id = public.current_user_profile_id()
    AND status = 'pending'
  )
  WITH CHECK (
    requester_profile_id = public.current_user_profile_id()
    AND status = 'cancelled'
  );

REVOKE ALL ON TABLE public.staff_access_assignments FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_access_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_mfa_credentials FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_mfa_recovery_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.staff_access_sync_jobs FROM anon, authenticated;

GRANT SELECT ON TABLE public.staff_access_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.admin_access_requests TO authenticated;
GRANT ALL ON TABLE public.staff_access_assignments TO service_role;
GRANT ALL ON TABLE public.admin_access_requests TO service_role;
GRANT ALL ON TABLE public.admin_mfa_credentials TO service_role;
GRANT ALL ON TABLE public.admin_mfa_recovery_codes TO service_role;
GRANT ALL ON TABLE public.staff_access_sync_jobs TO service_role;

COMMENT ON TABLE public.staff_access_assignments IS
  'Sursa de adevăr pentru rolurile interne și durata lor; Clerk și Cloudflare sunt oglinzi sincronizate.';
COMMENT ON TABLE public.admin_mfa_credentials IS
  'Secrete TOTP criptate server-side. Accesibile exclusiv prin service_role.';
