

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM profiles
  WHERE clerk_user_id = (auth.jwt() ->> 'sub');

  RETURN COALESCE(v_role, 'anonymous');
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_profile_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM profiles
  WHERE clerk_user_id = (auth.jwt() ->> 'sub');

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_profile_id() TO anon, authenticated;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_staff" ON profiles FOR SELECT
USING (
  clerk_user_id = (auth.jwt() ->> 'sub')
  OR current_user_role() IN ('admin', 'operator', 'suport')
);

CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
WITH CHECK (
  clerk_user_id = (auth.jwt() ->> 'sub')
);

CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
USING (
  clerk_user_id = (auth.jwt() ->> 'sub')
  OR current_user_role() = 'admin'
)
WITH CHECK (
  clerk_user_id = (auth.jwt() ->> 'sub')
  OR current_user_role() = 'admin'
);

CREATE POLICY "profiles_delete_admin_only" ON profiles FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses_select_own_or_staff" ON addresses FOR SELECT
USING (
  profile_id = current_user_profile_id()
  OR profile_id IS NULL
  OR current_user_role() IN ('admin', 'operator', 'suport')
);

CREATE POLICY "addresses_insert_own_or_anon" ON addresses FOR INSERT
WITH CHECK (
  profile_id = current_user_profile_id()
  OR profile_id IS NULL
);

CREATE POLICY "addresses_update_own" ON addresses FOR UPDATE
USING (
  profile_id = current_user_profile_id()
  OR current_user_role() = 'admin'
)
WITH CHECK (
  profile_id = current_user_profile_id()
  OR current_user_role() = 'admin'
);

CREATE POLICY "addresses_delete_own" ON addresses FOR DELETE
USING (
  profile_id = current_user_profile_id()
  OR current_user_role() = 'admin'
);

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcels_select_via_order" ON parcels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.parcel_id = parcels.id
      AND (
        orders.sender_profile_id = current_user_profile_id()
        OR current_user_role() IN ('admin', 'operator', 'suport')
      )
  )
);

CREATE POLICY "parcels_insert_authenticated" ON parcels FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'sub') IS NOT NULL
);

CREATE POLICY "parcels_update_admin_only" ON parcels FOR UPDATE
USING (current_user_role() = 'admin');

CREATE POLICY "parcels_delete_admin_only" ON parcels FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own_or_staff" ON orders FOR SELECT
USING (
  sender_profile_id = current_user_profile_id()
  OR current_user_role() IN ('admin', 'operator', 'suport')
);

CREATE POLICY "orders_insert_own" ON orders FOR INSERT
WITH CHECK (
  sender_profile_id = current_user_profile_id()
);

CREATE POLICY "orders_update_own_active_or_staff" ON orders FOR UPDATE
USING (
  (
    sender_profile_id = current_user_profile_id()
    AND status NOT IN ('completed', 'cancelled', 'failed')
  )
  OR current_user_role() IN ('admin', 'operator')
)
WITH CHECK (
  (
    sender_profile_id = current_user_profile_id()
    AND status NOT IN ('completed', 'cancelled', 'failed')
  )
  OR current_user_role() IN ('admin', 'operator')
);

CREATE POLICY "orders_delete_admin_only" ON orders FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_select_via_order" ON missions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = missions.order_id
      AND (
        orders.sender_profile_id = current_user_profile_id()
        OR current_user_role() IN ('admin', 'operator', 'suport')
      )
  )
);

CREATE POLICY "missions_insert_staff_only" ON missions FOR INSERT
WITH CHECK (
  current_user_role() IN ('admin', 'operator')
);

CREATE POLICY "missions_update_staff_only" ON missions FOR UPDATE
USING (current_user_role() IN ('admin', 'operator'))
WITH CHECK (current_user_role() IN ('admin', 'operator'));

CREATE POLICY "missions_delete_admin_only" ON missions FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_events_select_via_mission" ON mission_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM missions
    INNER JOIN orders ON orders.id = missions.order_id
    WHERE missions.id = mission_events.mission_id
      AND (
        orders.sender_profile_id = current_user_profile_id()
        OR current_user_role() IN ('admin', 'operator', 'suport')
      )
  )
);

CREATE POLICY "mission_events_insert_staff_only" ON mission_events FOR INSERT
WITH CHECK (
  current_user_role() IN ('admin', 'operator')
);

CREATE POLICY "mission_events_delete_admin_only" ON mission_events FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own_or_admin" ON notifications FOR SELECT
USING (
  profile_id = current_user_profile_id()
  OR profile_id IS NULL
  OR current_user_role() = 'admin'
);

CREATE POLICY "notifications_insert_self_or_staff" ON notifications FOR INSERT
WITH CHECK (
  profile_id = current_user_profile_id()
  OR current_user_role() IN ('admin', 'operator')
);

CREATE POLICY "notifications_update_own_read_status" ON notifications FOR UPDATE
USING (
  profile_id = current_user_profile_id()
  OR current_user_role() = 'admin'
)
WITH CHECK (
  profile_id = current_user_profile_id()
  OR current_user_role() = 'admin'
);

CREATE POLICY "notifications_delete_own_or_admin" ON notifications FOR DELETE
USING (
  profile_id = current_user_profile_id()
  OR current_user_role() = 'admin'
);

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_records_select_own_or_admin" ON payment_records FOR SELECT
USING (
  profile_id = current_user_profile_id()
  OR current_user_role() IN ('admin', 'suport')
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_messages_select_admin_only" ON contact_messages FOR SELECT
USING (current_user_role() IN ('admin', 'suport'));

CREATE POLICY "contact_messages_insert_anyone" ON contact_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "contact_messages_update_admin_only" ON contact_messages FOR UPDATE
USING (current_user_role() IN ('admin', 'suport'))
WITH CHECK (current_user_role() IN ('admin', 'suport'));

CREATE POLICY "contact_messages_delete_admin_only" ON contact_messages FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_select_admin_only" ON audit_events FOR SELECT
USING (current_user_role() IN ('admin', 'suport'));

CREATE POLICY "audit_events_delete_admin_only" ON audit_events FOR DELETE
USING (current_user_role() = 'admin');

ALTER TABLE operational_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operational_settings_select_authenticated" ON operational_settings FOR SELECT
USING ((auth.jwt() ->> 'sub') IS NOT NULL);

CREATE POLICY "operational_settings_update_admin_only" ON operational_settings FOR UPDATE
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');
