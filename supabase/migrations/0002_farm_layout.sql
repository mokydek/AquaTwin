-- AquaTwin migration 0002: editable farm layout.
-- Apply this in the Supabase SQL editor BEFORE deploying the matching code.
-- Idempotent: safe to run more than once.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.farm_nodes (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type text not null check (type in ('fish_tank', 'grow_bed', 'biofilter', 'sump', 'pump')),
  label text not null,
  x integer not null,
  y integer not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists farm_nodes_farm_idx on public.farm_nodes (farm_id);

create table if not exists public.farm_edges (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  source_node uuid not null references public.farm_nodes (id) on delete cascade,
  target_node uuid not null references public.farm_nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (source_node <> target_node),
  unique (farm_id, source_node, target_node)
);
create index if not exists farm_edges_farm_idx on public.farm_edges (farm_id);

alter table public.sensors
  add column if not exists node_id uuid null references public.farm_nodes (id) on delete set null;

-- ============================================================
-- Row level security
-- ============================================================

alter table public.farm_nodes enable row level security;
alter table public.farm_edges enable row level security;

-- farm_nodes: farm owned by the current user
drop policy if exists farm_nodes_select on public.farm_nodes;
create policy farm_nodes_select on public.farm_nodes
  for select using (
    exists (select 1 from public.farms f where f.id = farm_nodes.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_nodes_insert on public.farm_nodes;
create policy farm_nodes_insert on public.farm_nodes
  for insert with check (
    exists (select 1 from public.farms f where f.id = farm_nodes.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_nodes_update on public.farm_nodes;
create policy farm_nodes_update on public.farm_nodes
  for update using (
    exists (select 1 from public.farms f where f.id = farm_nodes.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = farm_nodes.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_nodes_delete on public.farm_nodes;
create policy farm_nodes_delete on public.farm_nodes
  for delete using (
    exists (select 1 from public.farms f where f.id = farm_nodes.farm_id and f.owner_id = auth.uid())
  );

-- farm_edges: farm owned by the current user
drop policy if exists farm_edges_select on public.farm_edges;
create policy farm_edges_select on public.farm_edges
  for select using (
    exists (select 1 from public.farms f where f.id = farm_edges.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_edges_insert on public.farm_edges;
create policy farm_edges_insert on public.farm_edges
  for insert with check (
    exists (select 1 from public.farms f where f.id = farm_edges.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_edges_update on public.farm_edges;
create policy farm_edges_update on public.farm_edges
  for update using (
    exists (select 1 from public.farms f where f.id = farm_edges.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = farm_edges.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_edges_delete on public.farm_edges;
create policy farm_edges_delete on public.farm_edges
  for delete using (
    exists (select 1 from public.farms f where f.id = farm_edges.farm_id and f.owner_id = auth.uid())
  );
