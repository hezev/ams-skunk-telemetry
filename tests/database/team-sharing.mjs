import fs from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(import.meta.url)(process.env.AMS_PGLITE_PATH||'@electric-sql/pglite');
const db=new PGlite();
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
await db.exec(`create role authenticated; create role anon; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
create table public.ams_pilots(id uuid primary key references auth.users,pilot_name text);
create table public.ams_laps(id integer primary key,pilot_id uuid references auth.users,telemetry jsonb);
create table public.ams_best_laps(id integer primary key,pilot_id uuid references auth.users,shared boolean default false);
create table public.ams_live_sessions(pilot_id uuid primary key references auth.users);
create table public.ams_setup_snapshots(id integer primary key,pilot_id uuid references auth.users);
grant select on all tables in schema public to authenticated;
grant update on public.ams_laps to authenticated;
alter table public.ams_pilots enable row level security;
alter table public.ams_laps enable row level security;
alter table public.ams_best_laps enable row level security;
alter table public.ams_live_sessions enable row level security;
alter table public.ams_setup_snapshots enable row level security;
create policy "AMS pilots: read permitted profiles" on public.ams_pilots for select to authenticated using(id=auth.uid());
create policy ams_laps_owner_read on public.ams_laps for select to authenticated using(pilot_id=auth.uid());
create policy own_write on public.ams_laps for update to authenticated using(pilot_id=auth.uid()) with check(pilot_id=auth.uid());
create policy "AMS laps: read own or shared" on public.ams_best_laps for select to authenticated using(pilot_id=auth.uid() or shared);
create policy ams_live_sessions_owner_select on public.ams_live_sessions for select to authenticated using(pilot_id=auth.uid());
create policy ams_setup_snapshots_owner_select on public.ams_setup_snapshots for select to authenticated using(pilot_id=auth.uid());`);
for(let i=0;i<ids.length;i++){
 await db.query('insert into auth.users values ($1)',[ids[i]]);
 await db.query('insert into ams_pilots values ($1,$2)',[ids[i],`Pilot ${i+1}`]);
 await db.query('insert into ams_laps values ($1,$2,$3)',[i+1,ids[i],JSON.stringify([{fuel:40}])]);
 await db.query('insert into ams_best_laps(id,pilot_id) values ($1,$2)',[i+1,ids[i]]);
 await db.query('insert into ams_live_sessions values ($1)',[ids[i]]);
 await db.query('insert into ams_setup_snapshots values ($1,$2)',[i+1,ids[i]]);
}
await db.exec(fs.readFileSync(new URL('../../supabase/migrations/20261021093207_team_endurance_sharing.sql',import.meta.url),'utf8'));
async function as(id,fn){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
 await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}
}
const command=(action,payload={})=>db.query('select public.ams_team($1,$2) as result',[action,payload]).then(r=>r.rows[0].result);
const visible=table=>db.query(`select count(*)::integer n from public.${table}`).then(r=>r.rows[0].n);
const reject=async(fn,pattern)=>assert.rejects(fn,pattern);
try{
 await as(ids[0],async()=>{
  assert.equal(await visible('ams_laps'),1);
  assert.equal((await command('snapshot')).team,null);
  const created=await command('create',{name:'Endurance test'});assert.equal(created.team.members.length,1);
  assert.equal(created.team.owner_id,ids[0]);
 });
 const invitation=await as(ids[0],()=>command('invite'));
 assert.match(invitation.code,/^[0-9a-f]{64}$/);
 const hashes=await db.query('select code_hash from ams_team_private.invites');assert.notEqual(hashes.rows[0].code_hash,invitation.code);
 await as(ids[2],async()=>{assert.equal(await visible('ams_laps'),1);await reject(()=>command('remove',{pilot_id:ids[0]}),/TEAM_OWNER_REQUIRED/);await reject(()=>command('save_plan',{plan:{version:1},revision:0}),/TEAM_NOT_MEMBER/);});
 await as(ids[1],async()=>{
  assert.equal((await command('accept',{code:invitation.code})).team.members.length,2);
  for(const table of ['ams_laps','ams_best_laps','ams_live_sessions','ams_pilots','ams_setup_snapshots'])assert.equal(await visible(table),2,table);
  assert.equal((await db.query("update ams_laps set telemetry='[]' where pilot_id=$1 returning id",[ids[0]])).rows.length,0,'Members cannot update another pilot');
  await reject(()=>db.query('select * from ams_team_private.members'),/permission denied/);
  await reject(()=>command('invite'),/TEAM_OWNER_REQUIRED/);
  await reject(()=>command('remove',{pilot_id:ids[0]}),/TEAM_OWNER_REQUIRED/);
  assert.equal((await command('save_plan',{revision:0,plan:{version:1,input:{raceMinutes:360}}})).team.plan_revision,1);
  await reject(()=>command('save_plan',{revision:0,plan:{version:1}}),/TEAM_PLAN_CHANGED/);
 });
 await as(ids[2],()=>reject(()=>command('accept',{code:invitation.code}),/TEAM_INVITE_INVALID/));
 await as(ids[0],async()=>{
  assert.equal(await visible('ams_laps'),2);
  await reject(()=>command('leave'),/TEAM_OWNER_CANNOT_LEAVE/);
  await command('remove',{pilot_id:ids[1]});assert.equal(await visible('ams_laps'),1);
  assert.equal((await command('snapshot')).team.plan,null);
 });
 await as(ids[1],async()=>{assert.equal(await visible('ams_laps'),1);await reject(()=>command('save_plan',{revision:2,plan:{version:1}}),/TEAM_NOT_MEMBER/);});
 const expired=await as(ids[0],()=>command('invite'));
 await db.exec("update ams_team_private.invites set expires_at=now()-interval '1 second'");
 await as(ids[1],()=>reject(()=>command('accept',{code:expired.code}),/TEAM_INVITE_INVALID/));
 const cancelled=await as(ids[0],()=>command('invite'));
 await as(ids[0],()=>command('cancel_invite',{id:cancelled.team.invites[0].id}));
 await as(ids[1],()=>reject(()=>command('accept',{code:cancelled.code}),/TEAM_INVITE_INVALID/));
 const again=await as(ids[0],()=>command('invite'));
 await as(ids[1],()=>command('accept',{code:again.code}));
 await as(ids[1],()=>command('leave'));
 await as(ids[0],async()=>{assert.equal(await visible('ams_laps'),1);await command('disband');assert.equal((await command('snapshot')).team,null);});
 await db.exec('update ams_best_laps set shared=true where id=3');
 await as(ids[0],async()=>{
  assert.equal(await visible('ams_best_laps'),2,'Existing public reference visibility is preserved');
  assert.equal(await visible('ams_pilots'),2,'Existing shared-reference profile visibility is preserved');
  assert.equal(await visible('ams_laps'),1,'Sharing a best lap does not expose the private archive');
 });
 await as(null,()=>reject(()=>command('snapshot'),/TEAM_LOGIN_REQUIRED/));
 await db.exec('set role anon');await reject(()=>command('snapshot'),/permission denied/);await db.exec('reset role');
 assert.equal((await db.query('select count(*)::integer n from ams_laps')).rows[0].n,4,'Original laps preserved');
 console.log('PASS: invitation acceptance, mutual RLS, outsider isolation, read-only sharing, single-use/expiry/cancellation, removal/leave, plan conflicts, anon denial, original data preserved.');
}finally{await db.close();}
