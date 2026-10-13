-- AMS Setup Lab v39: owner-only iRacing SDK garage snapshots.
-- Already applied to AMS Telemetry Supabase project via additive migration.
create table if not exists public.ams_setup_snapshots (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references auth.users(id) on delete cascade,
  client_capture_id uuid not null default gen_random_uuid(),
  simulator text not null default 'iRacing' check (simulator = 'iRacing'),
  circuit text not null check (length(circuit) between 1 and 120),
  car text not null check (length(car) between 1 and 120),
  session_id text not null check (length(session_id) between 1 and 240),
  source text not null check (source in ('irsdk_session_info','session_info_json_import')),
  car_setup jsonb not null check (
    jsonb_typeof(car_setup) = 'object'
    and octet_length(car_setup::text) between 3 and 262144
  ),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (pilot_id, client_capture_id)
);
create index if not exists ams_setup_snapshots_owner_context_idx
  on public.ams_setup_snapshots(pilot_id, simulator, car, captured_at desc);
alter table public.ams_setup_snapshots enable row level security;
revoke all on table public.ams_setup_snapshots from public, anon;
grant select, insert, delete on table public.ams_setup_snapshots to authenticated;
drop policy if exists ams_setup_snapshots_owner_select on public.ams_setup_snapshots;
create policy ams_setup_snapshots_owner_select on public.ams_setup_snapshots
  for select to authenticated using (pilot_id = (select auth.uid()));
drop policy if exists ams_setup_snapshots_owner_insert on public.ams_setup_snapshots;
create policy ams_setup_snapshots_owner_insert on public.ams_setup_snapshots
  for insert to authenticated with check (pilot_id = (select auth.uid()));
drop policy if exists ams_setup_snapshots_owner_delete on public.ams_setup_snapshots;
create policy ams_setup_snapshots_owner_delete on public.ams_setup_snapshots
  for delete to authenticated using (pilot_id = (select auth.uid()));
