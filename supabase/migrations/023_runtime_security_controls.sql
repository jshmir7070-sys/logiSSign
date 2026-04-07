create table if not exists public.rate_limit_counters (
  counter_key text not null,
  window_bucket bigint not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (counter_key, window_bucket)
);

create index if not exists idx_rate_limit_counters_reset_at
  on public.rate_limit_counters (reset_at);

create or replace function public.check_rate_limit(
  p_counter_key text,
  p_max_requests integer,
  p_window_ms integer
)
returns table (
  allowed boolean,
  current_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_bucket bigint := floor(v_now_ms::numeric / p_window_ms);
  v_reset_at timestamptz := to_timestamp(((v_bucket + 1) * p_window_ms)::numeric / 1000.0);
  v_count integer;
begin
  insert into public.rate_limit_counters (
    counter_key,
    window_bucket,
    count,
    reset_at
  )
  values (
    p_counter_key,
    v_bucket,
    1,
    v_reset_at
  )
  on conflict (counter_key, window_bucket)
  do update
    set count = public.rate_limit_counters.count + 1,
        reset_at = excluded.reset_at,
        updated_at = timezone('utc', now())
  returning public.rate_limit_counters.count into v_count;

  delete from public.rate_limit_counters
  where reset_at < timezone('utc', now()) - interval '1 day';

  return query
  select
    v_count <= p_max_requests,
    v_count,
    v_reset_at;
end;
$$;

revoke all on public.rate_limit_counters from anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
