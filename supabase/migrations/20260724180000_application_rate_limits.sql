create table if not exists public.application_rate_limits (
  key_hash text not null,
  bucket text not null,
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (key_hash, bucket)
);

alter table public.application_rate_limits enable row level security;

revoke all on table public.application_rate_limits from public;
revoke all on table public.application_rate_limits from anon;
revoke all on table public.application_rate_limits from authenticated;
grant select, insert, update, delete on table public.application_rate_limits to service_role;

create index if not exists application_rate_limits_expires_at_idx
  on public.application_rate_limits (expires_at);

create or replace function public.consume_application_rate_limit(
  p_key_hash text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_expires_at timestamptz;
begin
  if
    p_key_hash is null or length(p_key_hash) < 32 or length(p_key_hash) > 128
    or p_bucket is null or length(p_bucket) < 1 or length(p_bucket) > 120
    or p_limit < 1 or p_limit > 100000
    or p_window_seconds < 1 or p_window_seconds > 86400
  then
    raise exception 'invalid_rate_limit_arguments';
  end if;

  insert into public.application_rate_limits (
    key_hash,
    bucket,
    request_count,
    window_started_at,
    expires_at
  )
  values (
    p_key_hash,
    p_bucket,
    1,
    v_now,
    v_now + make_interval(secs => p_window_seconds)
  )
  on conflict (key_hash, bucket) do update
  set
    request_count = case
      when public.application_rate_limits.expires_at <= v_now then 1
      else least(public.application_rate_limits.request_count + 1, p_limit + 1)
    end,
    window_started_at = case
      when public.application_rate_limits.expires_at <= v_now then v_now
      else public.application_rate_limits.window_started_at
    end,
    expires_at = case
      when public.application_rate_limits.expires_at <= v_now
        then v_now + make_interval(secs => p_window_seconds)
      else public.application_rate_limits.expires_at
    end
  returning
    application_rate_limits.request_count,
    application_rate_limits.expires_at
  into v_count, v_expires_at;

  return query
  select
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer);
end;
$$;

revoke all on function public.consume_application_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_application_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.consume_application_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.consume_application_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.purge_expired_application_rate_limits()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_deleted integer;
begin
  delete from public.application_rate_limits
  where expires_at < clock_timestamp() - interval '5 minutes';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_application_rate_limits() from public;
revoke all on function public.purge_expired_application_rate_limits() from anon;
revoke all on function public.purge_expired_application_rate_limits() from authenticated;
grant execute on function public.purge_expired_application_rate_limits() to service_role;
