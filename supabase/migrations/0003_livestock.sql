-- AquaTwin migration 0003: livestock ledger.
-- Apply this in the Supabase SQL editor BEFORE deploying the matching code.
-- Idempotent: safe to run more than once.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.fish_batches (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  node_id uuid null references public.farm_nodes (id) on delete set null,
  species text not null check (species in ('tilapia', 'trout', 'sturgeon', 'carp', 'catfish')),
  initial_count integer not null check (initial_count > 0),
  avg_weight_g double precision not null check (avg_weight_g > 0),
  stocked_at date not null default current_date,
  note text null,
  created_at timestamptz not null default now()
);
create index if not exists fish_batches_farm_idx on public.fish_batches (farm_id);

create table if not exists public.fish_events (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.fish_batches (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  type text not null check (type in ('mortality', 'harvest', 'restock', 'weighing')),
  count integer null check (count is null or count >= 0),
  avg_weight_g double precision null,
  note text null,
  created_at timestamptz not null default now()
);
create index if not exists fish_events_farm_created_idx on public.fish_events (farm_id, created_at desc);

-- ============================================================
-- Row level security
-- ============================================================

alter table public.fish_batches enable row level security;
alter table public.fish_events enable row level security;

-- fish_batches: farm owned by the current user
drop policy if exists fish_batches_select on public.fish_batches;
create policy fish_batches_select on public.fish_batches
  for select using (
    exists (select 1 from public.farms f where f.id = fish_batches.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists fish_batches_insert on public.fish_batches;
create policy fish_batches_insert on public.fish_batches
  for insert with check (
    exists (select 1 from public.farms f where f.id = fish_batches.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists fish_batches_update on public.fish_batches;
create policy fish_batches_update on public.fish_batches
  for update using (
    exists (select 1 from public.farms f where f.id = fish_batches.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = fish_batches.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists fish_batches_delete on public.fish_batches;
create policy fish_batches_delete on public.fish_batches
  for delete using (
    exists (select 1 from public.farms f where f.id = fish_batches.farm_id and f.owner_id = auth.uid())
  );

-- fish_events: farm owned by the current user
drop policy if exists fish_events_select on public.fish_events;
create policy fish_events_select on public.fish_events
  for select using (
    exists (select 1 from public.farms f where f.id = fish_events.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists fish_events_insert on public.fish_events;
create policy fish_events_insert on public.fish_events
  for insert with check (
    exists (select 1 from public.farms f where f.id = fish_events.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists fish_events_update on public.fish_events;
create policy fish_events_update on public.fish_events
  for update using (
    exists (select 1 from public.farms f where f.id = fish_events.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = fish_events.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists fish_events_delete on public.fish_events;
create policy fish_events_delete on public.fish_events
  for delete using (
    exists (select 1 from public.farms f where f.id = fish_events.farm_id and f.owner_id = auth.uid())
  );
