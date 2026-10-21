import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const platform=process.env.AMS_APP||'windows',root=new URL(`../../wwwroot/`,import.meta.url);
const owner='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
let team=null,plan=null,revision=0,invites=[],requests=[],holdPeer=false,pendingPeer;
const roster=[{id:owner,pilot_name:'AMS Owner'},{id:peer,pilot_name:'\t=1+1 <img src=x onerror="window.injected=true">'}];
const laps=[owner,peer].flatMap((pilot,i)=>[0,1].map(n=>({id:`${i? 'peer':'own'}-${n}`,pilot_id:pilot,local_lap_id:`${i}-${n}`,simulator:'iRacing',circuit:'Test Circuit',car:'GT3 Test',session_id:'same-session-id',lap_number:n+1,lap_time_ms:120000+i*1000+n*500,completed_at:`2026-10-21T09:0${i+n}:00Z`,telemetry:Array.from({length:101},(_,j)=>({position:j,speed:150,throttle:85,brake:0,gear:4,fuel:50-j*.03,sessionTime:100+j*1.2}))})));
const snapshot=()=>({team:team?{...team,members:team.members.map(id=>roster.find(m=>m.id===id)),invites,plan,plan_revision:revision}:null});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',error=>{errors.push(error.message);console.log('Page error:',error.message);});
 page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(()=>localStorage.setItem('ams.language','pt'));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='ams.test'){
   const file=url.pathname==='/'?(platform==='web'?'portal.html':'index.html'):url.pathname.slice(1);
   if(file==='js/config.js')return route.fulfill({contentType:'text/javascript',body:`window.AMS_CONFIG={supabaseUrl:'http://backend.test',publishableKey:'fixture',liveFreshnessMs:10000,lapPollMs:1000000};`});
   if(file==='js/auth.js')return route.fulfill({contentType:'text/javascript',body:`window.AMSAuth={user:{id:'${owner}',user_metadata:{pilot_name:'AMS Owner'}},session:{access_token:'fixture-token',expires_at:Date.now()/1000+3600},token:async()=> 'fixture-token',init(){document.dispatchEvent(new CustomEvent('ams-auth-changed',{detail:{user:this.user}}));}};`});
   const resource=new URL(file,root);if(!fs.existsSync(resource))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(resource)});
  }
  if(url.hostname==='backend.test'){
   const pathname=url.pathname,body=route.request().postDataJSON();requests.push({pathname,body});
   let data=[];
   if(pathname.endsWith('/rpc/ams_team')){
    const {action,payload}=body;
    if(action==='create')team={id:'team-id',name:payload.name,owner_id:owner,members:[owner]};
    if(action==='invite')invites=[{id:'invite-id',expires_at:'2026-10-28T12:00:00Z'}];
    if(action==='accept'){
     if(payload.code!=='b'.repeat(64))return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'TEAM_INVITE_INVALID'})});
     team={id:'team-id',name:'Accepted endurance team',owner_id:peer,members:[peer,owner]};
    }
    if(action==='cancel_invite')invites=invites.filter(i=>i.id!==payload.id);
    if(action==='save_plan'){
     if(payload.revision!==revision)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'TEAM_PLAN_CHANGED'})});
     plan=payload.plan;revision++;
    }
    if(action==='remove'){team.members=team.members.filter(id=>id!==payload.pilot_id);plan=null;revision++;}
    if(action==='leave'||action==='disband'){team=null;plan=null;}
    data=snapshot();if(action==='invite')data={...data,code:'a'.repeat(64),expires_at:'2026-10-28T12:00:00Z'};
   }else if(pathname.endsWith('/rpc/ams_is_coach'))data=false;
   else if(pathname.endsWith('/ams_pilots'))data=[roster[0]];
   else if(pathname.endsWith('/ams_laps')){
    const detailId=url.searchParams.get('id')?.replace(/^eq\./,'');
    if(detailId){
     const lap=laps.find(l=>l.id===detailId);
     const permitted=lap&&(lap.pilot_id===owner||team?.members.includes(peer));
     if(holdPeer&&lap?.pilot_id===peer){await new Promise(resolve=>pendingPeer=resolve);}
     data=permitted?[lap]:[];
    }else{
     const own=url.searchParams.get('pilot_id')==='eq.'+owner;
     data=laps.filter(l=>own?l.pilot_id===owner:l.pilot_id===peer&&team?.members.includes(peer)).map(({telemetry,...lap})=>lap);
    }
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:''});
 });
 await page.goto('http://ams.test/',{waitUntil:'domcontentloaded'});
 if(await page.locator('#desktopEnterPortal').count())await page.locator('#desktopEnterPortal').click();
 await page.waitForFunction(()=>document.querySelectorAll('#teamSharedLaps tr').length===2);
 await page.locator('[data-view="team"]').click();
 await page.locator('#teamCreate input').fill('AMS Endurance');
 await page.locator('#teamCreate button').click();
 await page.waitForSelector('[data-team-action="invite"]');
 await page.locator('[data-team-action="invite"]').click();
 await page.waitForFunction(()=>document.querySelector('#teamInviteCode')?.value.length===64);
 assert.equal(invites.length,1);
 // Simulate the invited pilot accepting on their own authenticated device.
 team.members.push(peer);invites=[];
 await page.evaluate(()=>AMSTeams.refresh());
 await page.waitForFunction(()=>document.querySelectorAll('#teamSharedLaps tr').length===4);
 assert.equal(await page.locator('#teamManagement .team-member').count(),2);
 assert.equal(await page.evaluate(()=>window.injected),undefined,'Peer names must remain plain text');
 assert.equal(await page.locator('#engineerSessionSelect option').count(),2,'Session IDs from different pilots must not merge');
 assert.equal(await page.locator('#compareLapB option').evaluateAll(options=>options.some(o=>o.value.startsWith('peer'))),true,'Shared laps available as comparison references');
 await page.locator('#teamPilotFilter').selectOption(peer);
 assert.equal(await page.locator('#teamSharedLaps tr').count(),2);
 await page.locator('#teamSharedLaps [data-team-action="open_lap"]').first().click();
 await page.waitForFunction(()=>document.querySelector('#telemetry').classList.contains('active'));
 assert.equal(await page.locator('#telemetryLapSelect').inputValue(),'peer-0');
 assert.equal(await page.evaluate(()=>AMSCharts.telemetry.length),101);
 const liveBefore=await page.evaluate(()=>({mode:AMSRealtime.mode,track:document.getElementById('trackName').textContent}));
 await page.locator('[data-view="strategy"]').click();
 await page.locator('#enduranceContext').selectOption(JSON.stringify(['iRacing','Test Circuit','GT3 Test']));
 assert.equal(await page.locator('#enduranceRoster [data-pace]').first().inputValue(),'120.250');
 await page.locator('#enduranceRoster [data-move="1"]').first().click();
 assert.equal(await page.locator('#enduranceRoster [data-driver]').first().getAttribute('data-driver'),peer,'Driver rotation order is editable');
 await page.locator('#enduranceRoster [data-move="-1"]').nth(1).click();
 for(const [name,value] of Object.entries({raceMinutes:360,tankLitres:100,startLitres:100,reserveLitres:5,litresPerLap:3,maxStintMinutes:60,tyreLaps:50,pitLossSeconds:25,refuelLitresPerSecond:2,tyreSeconds:30,swapSeconds:20}))await page.locator(`[name="${name}"]`).fill(String(value));
 await page.locator('#enduranceParallel').check();
 await page.locator('#enduranceForm [type="submit"]').click();
 await page.waitForSelector('#enduranceResult tbody tr');
 assert.ok(await page.locator('#enduranceResult tbody tr').count()>2);
 await page.locator('#enduranceSave').click();
 await page.waitForFunction(()=>document.querySelector('#enduranceStatus').textContent.includes('guardado'));
 assert.equal(plan.version,1);assert.equal(plan.input.drivers.length,2);
 assert.equal(plan.input.drivers[0].id,owner);
 await page.locator('[name="raceMinutes"]').fill('300');
 assert.equal(await page.locator('#enduranceSave').isDisabled(),true,'Editing inputs invalidates the old result');
 await page.locator('#enduranceLoad').click();
 await page.waitForFunction(()=>document.querySelector('#enduranceStatus').textContent.includes('carregado'));
 assert.equal(await page.locator('[name="raceMinutes"]').inputValue(),'360');
 revision++;await page.locator('#enduranceSave').click();
 await page.waitForFunction(()=>document.querySelector('#enduranceStatus').textContent.includes('Outro membro'));
 await page.locator('#enduranceLoad').click();
 await page.waitForFunction(()=>document.querySelector('#enduranceStatus').textContent.includes('carregado'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#enduranceExport').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'AMS-endurance-stints.csv');
 assert.match(fs.readFileSync(await download.path(),'utf8'),/"'\t=1\+1/,'CSV must escape formula-like driver names including leading whitespace');
 await page.evaluate(()=>AMSi18n.setLanguage('en'));
 assert.match(await page.locator('#strategy h1').textContent(),/Endurance strategy/);
 assert.equal(await page.locator('[name="raceMinutes"]').inputValue(),'360','Language change preserves inputs');
 assert.equal(await page.locator('#enduranceResult tbody tr').count()>0,true,'Language change preserves results');
 if(process.env.AMS_TEAM_SCREENSHOT)await page.screenshot({path:process.env.AMS_TEAM_SCREENSHOT,fullPage:true});
 await page.setViewportSize({width:900,height:900});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Strategy overflows narrow view');
 await page.locator('[data-view="team"]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Team overflows narrow view');
 assert.deepEqual(await page.evaluate(()=>({mode:AMSRealtime.mode,track:document.getElementById('trackName').textContent})),liveBefore,'Team and planning must not alter live telemetry');
 // Revocation during an outstanding peer telemetry request must not render stale data.
 holdPeer=true;await page.locator('#teamPilotFilter').selectOption(peer);
 await page.locator('#teamSharedLaps [data-team-action="open_lap"]').first().click();
 await new Promise(resolve=>setTimeout(resolve,100));assert.ok(pendingPeer);
 team.members=[owner];plan=null;revision++;
 const lateResponse=page.waitForResponse(response=>response.url().includes('id=eq.peer-0'));
 await page.evaluate(()=>AMSTeams.refresh());pendingPeer();holdPeer=false;await lateResponse;
 await page.waitForFunction(()=>!Array.from(document.querySelector('#telemetryLapSelect').options).some(o=>o.value.startsWith('peer')));
 await page.waitForTimeout(100);
 assert.ok(!(await page.locator('#telemetryLapSelect').inputValue()).startsWith('peer'),'A response started before revocation cannot restore peer telemetry');
 assert.equal(await page.locator('#teamManagement .team-member').count(),1);
 assert.equal(await page.locator('#enduranceRoster [data-driver]').count(),1);
 assert.equal(await page.locator('#enduranceResult tbody tr').count(),0);
 await page.evaluate(()=>{AMSAuth.user=null;AMSAuth.session=null;document.dispatchEvent(new CustomEvent('ams-auth-changed',{detail:{user:null}}));});
 assert.equal(await page.evaluate(()=>AMSCharts.telemetry.length),0);
 assert.equal(await page.locator('#teamSharedLaps [data-team-action="open_lap"]').count(),0);
 assert.equal(await page.locator('#enduranceRoster [data-driver]').count(),0);
 team=null;
 await page.evaluate(owner=>{AMSAuth.user={id:owner,user_metadata:{pilot_name:'AMS Owner'}};AMSAuth.session={access_token:'fixture-token',expires_at:Date.now()/1000+3600};AMSAuth.init();},owner);
 if(await page.locator('#desktopEnterPortal').isVisible())await page.locator('#desktopEnterPortal').click();
 await page.locator('[data-view="team"]').click();
 await page.waitForSelector('#teamAccept');
 await page.locator('#teamAccept input').fill('a'.repeat(64));await page.locator('#teamAccept button').click();
 await page.waitForFunction(()=>document.querySelector('#teamStatus').textContent.includes('invalid'));
 await page.locator('#teamAccept input').fill('b'.repeat(64));await page.locator('#teamAccept button').click();
 await page.waitForSelector('[data-team-action="leave"]');
 assert.equal(await page.locator('[data-team-action="invite"]').count(),0,'Regular members cannot invite');
 await page.locator('[data-team-action="leave"]').click();
 await page.waitForSelector('#teamCreate');
 assert.deepEqual(errors,[]);
 console.log(`PASS ${platform}: create/invite, shared laps/telemetry, pilot session isolation, GT3 endurance, plan save/load/conflict/CSV, PT/EN, narrow view, live isolation, in-flight revocation and logout.`);
}finally{await browser.close();}
