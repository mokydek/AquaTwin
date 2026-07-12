-- AquaTwin database schema.
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Idempotent where reasonable: safe to run more than once.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sensors (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type text not null check (
    type in ('ph', 'water_temp', 'dissolved_oxygen', 'ammonia', 'nitrite', 'nitrate')
  ),
  unit text not null,
  warn_low double precision,
  warn_high double precision,
  crit_low double precision,
  crit_high double precision,
  created_at timestamptz not null default now(),
  unique (farm_id, type)
);

create table if not exists public.readings (
  id bigint generated always as identity primary key,
  sensor_id uuid not null references public.sensors (id) on delete cascade,
  value double precision not null,
  recorded_at timestamptz not null default now()
);
create index if not exists readings_sensor_recorded_idx
  on public.readings (sensor_id, recorded_at desc);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type text not null check (
    type in ('main_pump', 'backup_pump', 'aerator', 'feeder', 'grow_light', 'heater')
  ),
  is_on boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (farm_id, type)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  sensor_type text not null,
  kind text not null check (kind in ('threshold', 'prediction')),
  severity text not null check (severity in ('warning', 'critical')),
  value double precision,
  threshold double precision,
  eta_minutes integer,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists alerts_farm_created_idx
  on public.alerts (farm_id, created_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  sensor_type text not null,
  condition text not null check (condition in ('above', 'below')),
  threshold double precision not null,
  device_type text not null,
  action text not null check (action in ('turn_on', 'turn_off')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_events (
  id bigint generated always as identity primary key,
  farm_id uuid not null references public.farms (id) on delete cascade,
  device_type text not null,
  action text not null,
  triggered_by text not null check (triggered_by in ('rule', 'manual')),
  rule_id uuid references public.automation_rules (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists automation_events_farm_created_idx
  on public.automation_events (farm_id, created_at desc);

-- ============================================================
-- Row level security
-- ============================================================

alter table public.farms enable row level security;
alter table public.sensors enable row level security;
alter table public.readings enable row level security;
alter table public.devices enable row level security;
alter table public.alerts enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_events enable row level security;

-- farms: owner only, all four operations
drop policy if exists farms_select on public.farms;
create policy farms_select on public.farms
  for select using (owner_id = auth.uid());

drop policy if exists farms_insert on public.farms;
create policy farms_insert on public.farms
  for insert with check (owner_id = auth.uid());

drop policy if exists farms_update on public.farms;
create policy farms_update on public.farms
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists farms_delete on public.farms;
create policy farms_delete on public.farms
  for delete using (owner_id = auth.uid());

-- sensors: farm owned by the current user
drop policy if exists sensors_select on public.sensors;
create policy sensors_select on public.sensors
  for select using (
    exists (select 1 from public.farms f where f.id = sensors.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists sensors_insert on public.sensors;
create policy sensors_insert on public.sensors
  for insert with check (
    exists (select 1 from public.farms f where f.id = sensors.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists sensors_update on public.sensors;
create policy sensors_update on public.sensors
  for update using (
    exists (select 1 from public.farms f where f.id = sensors.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = sensors.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists sensors_delete on public.sensors;
create policy sensors_delete on public.sensors
  for delete using (
    exists (select 1 from public.farms f where f.id = sensors.farm_id and f.owner_id = auth.uid())
  );

-- readings: the farm of the reading's sensor is owned by the current user
drop policy if exists readings_select on public.readings;
create policy readings_select on public.readings
  for select using (
    exists (
      select 1 from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = readings.sensor_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists readings_insert on public.readings;
create policy readings_insert on public.readings
  for insert with check (
    exists (
      select 1 from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = readings.sensor_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists readings_update on public.readings;
create policy readings_update on public.readings
  for update using (
    exists (
      select 1 from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = readings.sensor_id and f.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = readings.sensor_id and f.owner_id = auth.uid()
    )
  );

drop policy if exists readings_delete on public.readings;
create policy readings_delete on public.readings
  for delete using (
    exists (
      select 1 from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = readings.sensor_id and f.owner_id = auth.uid()
    )
  );

-- devices: farm owned by the current user
drop policy if exists devices_select on public.devices;
create policy devices_select on public.devices
  for select using (
    exists (select 1 from public.farms f where f.id = devices.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists devices_insert on public.devices;
create policy devices_insert on public.devices
  for insert with check (
    exists (select 1 from public.farms f where f.id = devices.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists devices_update on public.devices;
create policy devices_update on public.devices
  for update using (
    exists (select 1 from public.farms f where f.id = devices.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = devices.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists devices_delete on public.devices;
create policy devices_delete on public.devices
  for delete using (
    exists (select 1 from public.farms f where f.id = devices.farm_id and f.owner_id = auth.uid())
  );

-- alerts: farm owned by the current user
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts
  for select using (
    exists (select 1 from public.farms f where f.id = alerts.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts
  for insert with check (
    exists (select 1 from public.farms f where f.id = alerts.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts
  for update using (
    exists (select 1 from public.farms f where f.id = alerts.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = alerts.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts
  for delete using (
    exists (select 1 from public.farms f where f.id = alerts.farm_id and f.owner_id = auth.uid())
  );

-- automation_rules: farm owned by the current user
drop policy if exists automation_rules_select on public.automation_rules;
create policy automation_rules_select on public.automation_rules
  for select using (
    exists (select 1 from public.farms f where f.id = automation_rules.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists automation_rules_insert on public.automation_rules;
create policy automation_rules_insert on public.automation_rules
  for insert with check (
    exists (select 1 from public.farms f where f.id = automation_rules.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists automation_rules_update on public.automation_rules;
create policy automation_rules_update on public.automation_rules
  for update using (
    exists (select 1 from public.farms f where f.id = automation_rules.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = automation_rules.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists automation_rules_delete on public.automation_rules;
create policy automation_rules_delete on public.automation_rules
  for delete using (
    exists (select 1 from public.farms f where f.id = automation_rules.farm_id and f.owner_id = auth.uid())
  );

-- automation_events: farm owned by the current user
drop policy if exists automation_events_select on public.automation_events;
create policy automation_events_select on public.automation_events
  for select using (
    exists (select 1 from public.farms f where f.id = automation_events.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists automation_events_insert on public.automation_events;
create policy automation_events_insert on public.automation_events
  for insert with check (
    exists (select 1 from public.farms f where f.id = automation_events.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists automation_events_update on public.automation_events;
create policy automation_events_update on public.automation_events
  for update using (
    exists (select 1 from public.farms f where f.id = automation_events.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = automation_events.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists automation_events_delete on public.automation_events;
create policy automation_events_delete on public.automation_events
  for delete using (
    exists (select 1 from public.farms f where f.id = automation_events.farm_id and f.owner_id = auth.uid())
  );

-- ============================================================
-- Realtime publication (guarded so re-runs do not error)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'readings'
  ) then
    alter publication supabase_realtime add table public.readings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'devices'
  ) then
    alter publication supabase_realtime add table public.devices;
  end if;
end $$;
