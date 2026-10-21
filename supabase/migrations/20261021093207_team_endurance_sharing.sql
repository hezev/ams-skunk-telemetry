-- Additive: explicit, read-only sharing after both pilots join the same team.
-- Existing records and write policies stay intact; read policies retain owner/public sharing.
create schema ams_team_private;
revoke all on schema ams_team_private from public, anon, authenticated;
grant usage on schema ams_team_private to authenticated;

create table ams_team_private.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  plan jsonb,
  plan_revision integer not null default 0,
  created_at timestamptz not null default now()
);
create index teams_owner_idx on ams_team_private.teams(owner_id);
create table ams_team_private.members (
  pilot_id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references ams_team_private.teams(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index members_team_idx on ams_team_private.members(team_id, pilot_id);
create table ams_team_private.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references ams_team_private.teams(id) on delete cascade,
  code_hash text unique not null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index invites_team_idx on ams_team_private.invites(team_id);
alter table ams_team_private.teams enable row level security;
alter table ams_team_private.members enable row level security;
alter table ams_team_private.invites enable row level security;
revoke all on all tables in schema ams_team_private from public, anon, authenticated;
create policy deny_direct_access on ams_team_private.teams to authenticated using(false) with check(false);
create policy deny_direct_access on ams_team_private.members to authenticated using(false) with check(false);
create policy deny_direct_access on ams_team_private.invites to authenticated using(false) with check(false);

-- Deliberately privileged lookup over private membership, never user_metadata.
create function ams_team_private.peer_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select peer.pilot_id from ams_team_private.members me
  join ams_team_private.members peer on peer.team_id = me.team_id
  where me.pilot_id = (select auth.uid()) and (select auth.uid()) is not null;
$$;
revoke all on function ams_team_private.peer_ids() from public, anon;
grant execute on function ams_team_private.peer_ids() to authenticated;

-- One SELECT policy per table avoids scanning duplicate permissive policies.
alter policy ams_laps_owner_read on public.ams_laps
  using (pilot_id=(select auth.uid()) or pilot_id in (select ams_team_private.peer_ids()));
alter policy "AMS laps: read own or shared" on public.ams_best_laps
  using (pilot_id=(select auth.uid()) or shared=true or pilot_id in (select ams_team_private.peer_ids()));
alter policy "AMS pilots: read permitted profiles" on public.ams_pilots
  using (id=(select auth.uid()) or id in (select ams_team_private.peer_ids()) or exists(
    select 1 from public.ams_best_laps lap where lap.pilot_id=ams_pilots.id and lap.shared=true));
alter policy ams_live_sessions_owner_select on public.ams_live_sessions
  using (pilot_id=(select auth.uid()) or pilot_id in (select ams_team_private.peer_ids()));
alter policy ams_setup_snapshots_owner_select on public.ams_setup_snapshots
  using (pilot_id=(select auth.uid()) or pilot_id in (select ams_team_private.peer_ids()));

-- All mutations serialize on the team row. Direct table access stays forbidden.
create function ams_team_private.command(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := auth.uid();
  tid uuid; owner uuid; title text; code text; inv ams_team_private.invites;
  response jsonb; snapshot jsonb; target uuid;
begin
  if who is null then raise exception 'TEAM_LOGIN_REQUIRED' using errcode='42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text)>65536
    then raise exception 'TEAM_INVALID_PAYLOAD'; end if;
  select m.team_id into tid from ams_team_private.members m where m.pilot_id=who;
  if tid is not null then
    select t.owner_id into owner from ams_team_private.teams t where t.id=tid for update;
    -- Membership may have been revoked while waiting for the team lock.
    if not exists(select 1 from ams_team_private.members m where m.team_id=tid and m.pilot_id=who) then
      tid := null; owner := null;
    end if;
  end if;

  case action
  when 'create' then
    if tid is not null then raise exception 'TEAM_ALREADY_MEMBER'; end if;
    title := btrim(payload->>'name');
    if title is null or char_length(title) not between 1 and 80 then raise exception 'TEAM_INVALID_NAME'; end if;
    insert into ams_team_private.teams(owner_id,name) values(who,title) returning id into tid;
    insert into ams_team_private.members(pilot_id,team_id) values(who,tid);
    owner := who;
  when 'invite' then
    if owner is distinct from who then raise exception 'TEAM_OWNER_REQUIRED' using errcode='42501'; end if;
    delete from ams_team_private.invites where team_id=tid and expires_at<=now();
    if (select count(*) from ams_team_private.invites where team_id=tid)>=10 then raise exception 'TEAM_INVITE_LIMIT'; end if;
    code := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into ams_team_private.invites(team_id,code_hash)
      values(tid,encode(sha256(convert_to(code,'UTF8')),'hex')) returning * into inv;
    response := jsonb_build_object('code',code,'expires_at',inv.expires_at);
  when 'accept' then
    if tid is not null then raise exception 'TEAM_ALREADY_MEMBER'; end if;
    code := lower(btrim(payload->>'code'));
    if code is null or code !~ '^[0-9a-f]{64}$' then raise exception 'TEAM_INVITE_INVALID'; end if;
    -- Find without locking first, then lock team before invite: same order as owner actions.
    select i.team_id into tid from ams_team_private.invites i
      where i.code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') and i.expires_at>now();
    if tid is null then raise exception 'TEAM_INVITE_INVALID'; end if;
    select t.owner_id into owner from ams_team_private.teams t where t.id=tid for update;
    select * into inv from ams_team_private.invites i where i.team_id=tid
      and i.code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') and i.expires_at>now() for update;
    if inv.id is null then raise exception 'TEAM_INVITE_INVALID'; end if;
    if (select count(*) from ams_team_private.members m where m.team_id=tid)>=16 then raise exception 'TEAM_MEMBER_LIMIT'; end if;
    insert into ams_team_private.members(pilot_id,team_id) values(who,tid);
    delete from ams_team_private.invites where id=inv.id;
  when 'cancel_invite' then
    if owner is distinct from who then raise exception 'TEAM_OWNER_REQUIRED' using errcode='42501'; end if;
    delete from ams_team_private.invites where id=(payload->>'id')::uuid and team_id=tid;
  when 'remove' then
    if owner is distinct from who then raise exception 'TEAM_OWNER_REQUIRED' using errcode='42501'; end if;
    target := (payload->>'pilot_id')::uuid;
    if target=owner then raise exception 'TEAM_OWNER_CANNOT_LEAVE'; end if;
    delete from ams_team_private.members where pilot_id=target and team_id=tid;
    update ams_team_private.teams set plan=null,plan_revision=plan_revision+1 where id=tid;
  when 'leave' then
    if tid is null then raise exception 'TEAM_NOT_MEMBER'; end if;
    if owner=who then raise exception 'TEAM_OWNER_CANNOT_LEAVE'; end if;
    delete from ams_team_private.members where pilot_id=who;
    update ams_team_private.teams set plan=null,plan_revision=plan_revision+1 where id=tid;
    tid := null; owner := null;
  when 'disband' then
    if owner is distinct from who then raise exception 'TEAM_OWNER_REQUIRED' using errcode='42501'; end if;
    delete from ams_team_private.teams where id=tid;
    tid := null; owner := null;
  when 'save_plan' then
    if tid is null then raise exception 'TEAM_NOT_MEMBER' using errcode='42501'; end if;
    if jsonb_typeof(payload->'plan') is distinct from 'object' then raise exception 'TEAM_INVALID_PLAN'; end if;
    update ams_team_private.teams set plan=payload->'plan',plan_revision=plan_revision+1
      where id=tid and plan_revision=(payload->>'revision')::integer;
    if not found then raise exception 'TEAM_PLAN_CHANGED'; end if;
  when 'snapshot' then null;
  else raise exception 'TEAM_UNKNOWN_ACTION';
  end case;

  select jsonb_build_object('id',t.id,'name',t.name,'owner_id',t.owner_id,
    'plan',t.plan,'plan_revision',t.plan_revision,
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.pilot_id,
      'pilot_name',coalesce(p.pilot_name,'Piloto AMS'),'joined_at',m.joined_at)
      order by m.joined_at,m.pilot_id) from ams_team_private.members m
      left join public.ams_pilots p on p.id=m.pilot_id where m.team_id=t.id),'[]'::jsonb),
    'invites',case when t.owner_id=who then coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'expires_at',i.expires_at) order by i.created_at) from ams_team_private.invites i
      where i.team_id=t.id and i.expires_at>now()),'[]'::jsonb) else '[]'::jsonb end)
  into snapshot from ams_team_private.teams t where t.id=tid;
  return jsonb_build_object('team',snapshot) || coalesce(response,'{}'::jsonb);
end;
$$;
revoke all on function ams_team_private.command(text,jsonb) from public, anon;
grant execute on function ams_team_private.command(text,jsonb) to authenticated;

create function public.ams_team(action text default 'snapshot',payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select ams_team_private.command(action,payload);
$$;
revoke all on function public.ams_team(text,jsonb) from public, anon;
grant execute on function public.ams_team(text,jsonb) to authenticated;
comment on function public.ams_team(text,jsonb) is
  'Team membership, single-use invitations and shared endurance inputs; authenticated pilots only.';
