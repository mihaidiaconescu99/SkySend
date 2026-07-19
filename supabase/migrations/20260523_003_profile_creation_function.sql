

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
  v_role TEXT;
BEGIN

  IF p_clerk_user_id IS NULL OR p_clerk_user_id = '' THEN
    RAISE EXCEPTION 'clerk_user_id required';
  END IF;

  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  SELECT id INTO v_profile_id
  FROM profiles
  WHERE clerk_user_id = p_clerk_user_id;

  IF v_profile_id IS NULL THEN

    v_role := CASE
      WHEN LOWER(p_email) = 'admin@skysend.com' THEN 'admin'
      WHEN LOWER(p_email) = 'operator@skysend.com' THEN 'operator'
      WHEN LOWER(p_email) = 'suport@skysend.com' THEN 'suport'
      ELSE 'client'
    END;

    INSERT INTO profiles (clerk_user_id, email, full_name, role)
    VALUES (p_clerk_user_id, p_email, p_full_name, v_role)
    RETURNING id INTO v_profile_id;

    INSERT INTO audit_events (
      actor_profile_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      changes
    ) VALUES (
      v_profile_id,
      v_role,
      'profile_created',
      'profiles',
      v_profile_id::TEXT,
      jsonb_build_object(
        'clerk_user_id', p_clerk_user_id,
        'email', p_email,
        'auto_assigned_role', v_role
      )
    );
  ELSE

    UPDATE profiles
    SET
      email = p_email,
      full_name = COALESCE(p_full_name, full_name)
    WHERE id = v_profile_id
      AND (email IS DISTINCT FROM p_email OR full_name IS DISTINCT FROM p_full_name);
  END IF;

  RETURN v_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists TO authenticated;

COMMENT ON FUNCTION public.ensure_profile_exists IS
  'Asigură existența unui profile Supabase pentru un user Clerk. Apelată din /api/auth/sync-profile.';
