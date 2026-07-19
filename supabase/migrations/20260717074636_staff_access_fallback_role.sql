ALTER TABLE public.staff_access_assignments
  ADD COLUMN fallback_role TEXT NOT NULL DEFAULT 'client'
  CHECK (fallback_role IN ('client', 'operator'));

COMMENT ON COLUMN public.staff_access_assignments.fallback_role IS
  'Rolul restaurat după expirarea sau revocarea unei elevări Admin temporare.';
