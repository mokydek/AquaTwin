-- AquaTwin migration 0007: public demo cleanup.
-- Apply this in the Supabase SQL editor. Idempotent: create or replace plus an
-- unschedule-then-schedule DO block, so it is safe to run more than once.
--
-- DESTRUCTIVE FUNCTION. cleanup_demo_farms() permanently deletes data. It must
-- only ever touch ANONYMOUS demo users. Every statement below filters strictly
-- on auth.users.is_anonymous = true; a permanent account (is_anonymous = false
-- or null) is never matched, so real users and their farms are never affected.

create or replace function public.cleanup_demo_farms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete the farms of anonymous users older than 7 days first. The farm level
  -- ON DELETE CASCADE removes their sensors, readings, devices, alerts, rules,
  -- events, nodes, edges, batches and api keys.
  delete from public.farms f
  using auth.users u
  where f.owner_id = u.id
    and u.is_anonymous = true
    and u.created_at < now() - interval '7 days';

  -- Then delete the anonymous user rows themselves.
  delete from auth.users u
  where u.is_anonymous = true
    and u.created_at < now() - interval '7 days';
end;
$$;

-- The function runs with the privileges of its owner; postgres owns it so it can
-- reach auth.users.
alter function public.cleanup_demo_farms() owner to postgres;

-- Schedule a daily run at 03:00. pg_cron must be enabled for this to take effect;
-- if it is not, the block is a no op and the developer can enable pg_cron and
-- rerun this migration. No secrets are involved, so this lives in the migration.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'aquatwin-demo-cleanup') then
      perform cron.unschedule('aquatwin-demo-cleanup');
    end if;
    perform cron.schedule(
      'aquatwin-demo-cleanup',
      '0 3 * * *',
      $job$select public.cleanup_demo_farms();$job$
    );
  end if;
end $$;
