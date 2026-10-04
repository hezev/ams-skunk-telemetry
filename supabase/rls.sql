-- AMS Skunk Telemetry - security baseline
-- Ajustar estas policies quando Auth/equipas forem ligadas.

alter table public.drivers enable row level security;
alter table public.sessions enable row level security;
alter table public.laps enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_drivers enable row level security;

-- Intencionalmente sem policies permissivas nesta fase.
-- O sistema deve falhar fechado até definirmos os papéis piloto/equipa/admin.
