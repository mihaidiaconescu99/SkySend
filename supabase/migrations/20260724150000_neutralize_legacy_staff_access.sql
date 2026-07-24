BEGIN;

ALTER TABLE public.staff_access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_access_sync_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_access_assignments FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_access_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_mfa_credentials FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_mfa_recovery_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.staff_access_sync_jobs FROM anon, authenticated;

DROP POLICY IF EXISTS staff_access_assignments_select_own
  ON public.staff_access_assignments;
DROP POLICY IF EXISTS admin_access_requests_select_own
  ON public.admin_access_requests;
DROP POLICY IF EXISTS admin_access_requests_insert_own_operator
  ON public.admin_access_requests;
DROP POLICY IF EXISTS admin_access_requests_cancel_own_pending
  ON public.admin_access_requests;
DROP POLICY IF EXISTS admin_mfa_credentials_deny_clients
  ON public.admin_mfa_credentials;
DROP POLICY IF EXISTS admin_mfa_recovery_codes_deny_clients
  ON public.admin_mfa_recovery_codes;
DROP POLICY IF EXISTS staff_access_sync_jobs_deny_clients
  ON public.staff_access_sync_jobs;

REVOKE EXECUTE ON FUNCTION public.refresh_profile_staff_role(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_clerk_user_id TEXT;
BEGIN
  v_clerk_user_id := auth.jwt() ->> 'sub';

  IF v_clerk_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE clerk_user_id = v_clerk_user_id
  ) THEN
    RETURN 'anonymous';
  END IF;

  RETURN 'client';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role()
  TO authenticated, service_role;

COMMENT ON TABLE public.staff_access_assignments IS
  'Istoric neautoritativ. Rolurile interne sunt administrate exclusiv in organizatia Clerk SkySend.';
COMMENT ON TABLE public.admin_access_requests IS
  'Istoric neautoritativ. Cererile de rol din aplicatie sunt dezactivate.';
COMMENT ON FUNCTION public.current_user_role() IS
  'Compatibilitate RLS pentru acces client propriu; nu acorda roluri operator sau admin.';

COMMIT;
