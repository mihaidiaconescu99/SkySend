drop policy if exists "admin_mfa_credentials_deny_clients" on public.admin_mfa_credentials;
create policy "admin_mfa_credentials_deny_clients"
on public.admin_mfa_credentials
for all
to authenticated
using (false)
with check (false);

drop policy if exists "admin_mfa_recovery_codes_deny_clients" on public.admin_mfa_recovery_codes;
create policy "admin_mfa_recovery_codes_deny_clients"
on public.admin_mfa_recovery_codes
for all
to authenticated
using (false)
with check (false);

drop policy if exists "staff_access_sync_jobs_deny_clients" on public.staff_access_sync_jobs;
create policy "staff_access_sync_jobs_deny_clients"
on public.staff_access_sync_jobs
for all
to authenticated
using (false)
with check (false);

create index if not exists admin_access_requests_assignment_idx
  on public.admin_access_requests (assignment_id)
  where assignment_id is not null;

create index if not exists admin_access_requests_reviewer_idx
  on public.admin_access_requests (reviewed_by_profile_id)
  where reviewed_by_profile_id is not null;

create index if not exists staff_access_assignments_granter_idx
  on public.staff_access_assignments (granted_by_profile_id)
  where granted_by_profile_id is not null;

create index if not exists staff_access_assignments_revoker_idx
  on public.staff_access_assignments (revoked_by_profile_id)
  where revoked_by_profile_id is not null;

create index if not exists staff_access_sync_jobs_assignment_idx
  on public.staff_access_sync_jobs (assignment_id)
  where assignment_id is not null;

create index if not exists staff_access_sync_jobs_profile_idx
  on public.staff_access_sync_jobs (profile_id);
