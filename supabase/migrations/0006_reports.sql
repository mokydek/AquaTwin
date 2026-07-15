-- AquaTwin migration 0006: reporting aggregates.
-- Apply this in the Supabase SQL editor BEFORE deploying the matching code.
-- Idempotent: create or replace, so it is safe to run more than once.
--
-- Both functions are `security invoker` (the default, stated for clarity): they
-- execute as the calling user, so the existing row level security on readings
-- and sensors keeps a user's queries scoped to farms they own. No SECURITY
-- DEFINER, no service role, no bypass.

-- ============================================================
-- Per sensor statistics over a time range
-- ============================================================
-- Classifies every reading against its sensor's own warn and crit bounds with
-- the same precedence as the app (computeStatus in shared/lib/status.ts):
-- critical wins over warning wins over ok. A null bound means no limit on that
-- side. Percentages are the share of samples in each status; hardware_share is
-- the share of rows that came from real hardware rather than the simulator.
create or replace function public.report_sensor_stats(
  p_farm uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  sensor_type text,
  avg_value double precision,
  min_value double precision,
  max_value double precision,
  pct_ok double precision,
  pct_warning double precision,
  pct_critical double precision,
  samples bigint,
  hardware_share double precision
)
language sql
stable
security invoker
as $$
  select
    s.type as sensor_type,
    avg(r.value) as avg_value,
    min(r.value) as min_value,
    max(r.value) as max_value,
    100.0 * count(*) filter (where cls.status = 'ok') / nullif(count(*), 0) as pct_ok,
    100.0 * count(*) filter (where cls.status = 'warning') / nullif(count(*), 0) as pct_warning,
    100.0 * count(*) filter (where cls.status = 'critical') / nullif(count(*), 0) as pct_critical,
    count(*) as samples,
    100.0 * count(*) filter (where r.source = 'hardware') / nullif(count(*), 0) as hardware_share
  from public.readings r
  join public.sensors s on s.id = r.sensor_id
  cross join lateral (
    select case
      when (s.crit_low is not null and r.value < s.crit_low)
        or (s.crit_high is not null and r.value > s.crit_high) then 'critical'
      when (s.warn_low is not null and r.value < s.warn_low)
        or (s.warn_high is not null and r.value > s.warn_high) then 'warning'
      else 'ok'
    end as status
  ) cls
  where s.farm_id = p_farm
    and r.recorded_at >= p_from
    and r.recorded_at < p_to
  group by s.type
  order by s.type;
$$;

-- ============================================================
-- Hourly average series per sensor over a time range
-- ============================================================
create or replace function public.report_hourly_series(
  p_farm uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  sensor_type text,
  bucket timestamptz,
  avg_value double precision
)
language sql
stable
security invoker
as $$
  select
    s.type as sensor_type,
    date_trunc('hour', r.recorded_at) as bucket,
    avg(r.value) as avg_value
  from public.readings r
  join public.sensors s on s.id = r.sensor_id
  where s.farm_id = p_farm
    and r.recorded_at >= p_from
    and r.recorded_at < p_to
  group by s.type, date_trunc('hour', r.recorded_at)
  order by s.type, bucket;
$$;

-- PostgREST exposes these as RPC endpoints. Execute is granted to the signed in
-- role; RLS still gates which rows the query can read.
grant execute on function public.report_sensor_stats(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.report_hourly_series(uuid, timestamptz, timestamptz) to authenticated;
