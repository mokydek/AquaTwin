-- AquaTwin migration 0005: hardware ingestion bridge.
-- Apply this in the Supabase SQL editor BEFORE deploying the matching code and
-- functions. Idempotent: safe to run more than once.

-- ============================================================
-- API keys (only the SHA-256 hash and a short prefix are stored)
-- ============================================================

create table if not exists public.farm_api_keys (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  revoked boolean not null default false
);
create index if not exists farm_api_keys_farm_idx on public.farm_api_keys (farm_id);

alter table public.farm_api_keys enable row level security;

drop policy if exists farm_api_keys_select on public.farm_api_keys;
create policy farm_api_keys_select on public.farm_api_keys
  for select using (
    exists (select 1 from public.farms f where f.id = farm_api_keys.farm_id and f.owner_id = auth.uid())
  );

drop policy if exists farm_api_keys_insert on public.farm_api_keys;
create policy farm_api_keys_insert on public.farm_api_keys
  for insert with check (
    exists (select 1 from public.farms f where f.id = farm_api_keys.farm_id and f.owner_id = auth.uid())
  );

-- Revocation is an update, so no delete policy is needed.
drop policy if exists farm_api_keys_update on public.farm_api_keys;
create policy farm_api_keys_update on public.farm_api_keys
  for update using (
    exists (select 1 from public.farms f where f.id = farm_api_keys.farm_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.farms f where f.id = farm_api_keys.farm_id and f.owner_id = auth.uid())
  );

-- ============================================================
-- Reading source: simulation (default) or hardware
-- ============================================================

alter table public.readings
  add column if not exists source text not null default 'simulation'
  check (source in ('simulation', 'hardware'));
