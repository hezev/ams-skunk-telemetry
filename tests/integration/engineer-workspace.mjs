import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const platform=process.env.AMS_APP||'windows';
assert.ok(['windows','web'].includes(platform));
const root=new URL(`../../wwwroot/`,import.meta.url);
const fixtures=process.env.AMS_MAP_FIXTURES;
const lapsDir=process.env.AMS_LAP_FIXTURES;
const owner='test-pilot';
const meta={TrackID:'14',TrackDisplayName:'South Boston Speedway',TrackLength:'0.5927 km'};
let laps;
if(lapsDir){
 laps=fs.readdirSync(lapsDir).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(lapsDir,file),'utf8')))
   .map(lap=>({id:'local:'+lap.id,pilot_id:owner,simulator:lap.simulator,circuit:lap.circuit,car:lap.car,session_id:String(lap.sessionId),
     lap_number:lap.lapNumber,lap_time_ms:lap.durationMs,completed_at:lap.completedAt,telemetry:lap.telemetry}));
}else{
 laps=[0,1,2].map((n)=>({id:'local:lap-'+n,pilot_id:owner,simulator:'iRacing',circuit:meta.TrackDisplayName,car:'Test car',session_id:'south',lap_number:n+1,lap_time_ms:21000+n*1200,completed_at:'2026-10-18T15:3'+n+':00Z',
   telemetry:Array.from({length:1001},(_,i)=>{const p=i/1000,local=p%.25;return {position:p*100,sessionTime:100+p*(21+n*1.2),speed:100+15*Math.sin(i/60)-n*4,throttle:local<.16+n*.005?20:95,brake:local>=.09-n*.004&&local<.125?60:0,gear:3,steer:10,yawNorth:.2,yawRate:12,fuel:10-i*.001,...(i?{}:{_capture:{metadata:meta}})};})}));
}
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}});
 const errors=[],warnings=[];
 page.on('pageerror',error=>{errors.push(error.message);console.log('Page error:',error.message);});
 page.on('console',msg=>{if(msg.type()==='warning'){warnings.push(msg.text());console.log('Warning:',msg.text());}});
 await page.addInitScript(({laps,owner})=>{
   localStorage.setItem('ams.language','pt');
   window.fixtureLaps=laps;
   window.fixtureRequests=[];
   window.fixtureOwner=owner;
   window.AMSNativeLiveUntil=Date.now()+3600000;
 },{laps,owner});
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='ams.test'){
     const file=url.pathname==='/'?(platform==='web'?'portal.html':'index.html'):decodeURIComponent(url.pathname).slice(1);
     if(file==='js/auth.js')return route.fulfill({contentType:'text/javascript',body:`window.AMSAuth={user:{id:fixtureOwner,user_metadata:{pilot_name:'Test pilot'}},session:{access_token:'test-token',expires_at:Date.now()/1000+3600},token:async()=> 'test-token',init(){document.dispatchEvent(new CustomEvent('ams-auth-changed',{detail:{user:this.user}}));}};`});
     if(file==='js/supabase.js')return route.fulfill({contentType:'text/javascript',body:`window.AMSSupabase={getLaps:async()=>fixtureLaps.map(({telemetry,...lap})=>lap),getBestLaps:async()=>[],getLapTelemetry:async(token,id)=>fixtureLaps.find(lap=>lap.id===id),getLiveSessions:async()=>[],fresh:()=>false,samplePosition:s=>Number(s?.position)/100,request:async(url,options)=>{fixtureRequests.push({url,body:options?.body});if(url.includes('ams_is_coach'))return false;if(url.includes('ams_pilots'))return [{id:fixtureOwner,pilot_name:'Test pilot'}];if(url.includes('virtual-engineer'))return {text:JSON.stringify({lessons:options.body.report.coaching_zones.map(z=>({zone:z.zone,action:'Test coaching: aplica o acelerador progressivamente.',practice:'Repete a passagem e compara a perda.'}))}),model:'test'};return [];}};`});
     const resource=new URL(file,root);
     if(!fs.existsSync(resource))return route.fulfill({status:404,body:''});
     const contentType=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
     return route.fulfill({contentType,body:fs.readFileSync(resource)});
   }
   if(url.pathname.endsWith('iracing-tracks-metadata.json'))return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:fixtures?fs.readFileSync(path.join(fixtures,'catalogue.json'),'utf8').replace(/^\uFEFF/,''):JSON.stringify({tracks:[{svg_local_path:'Oval/southboston/14-southboston',svg_folder_url:'https://maps.test/14-southboston'}]})});
   const match=url.pathname.match(/\/(14|249|324)-[^/]+\/(active|start-finish|turns)\.svg$/);
   if(match){const [,id,layer]=match;return route.fulfill({contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'},body:fixtures?fs.readFileSync(path.join(fixtures,`${id}-${layer}.svg`),'utf8'):'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><path d="M100 100 L800 100 Q950 300 800 500 L100 500 Q0 300 100 100 Z"/></svg>'});}
   return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:''});
 });
 console.log('Starting complete Engineer workspace.');
 await page.goto('http://ams.test/',{waitUntil:'domcontentloaded'});
 if(await page.locator('#desktopEnterPortal').count())await page.locator('#desktopEnterPortal').click();
 await page.waitForFunction(()=>document.querySelector('#engineerSessionSelect')?.options.length>0,{},{timeout:60000});
 await page.locator('[data-view="engineer"]').click();
 const south=laps.find(lap=>lap.circuit==='South Boston Speedway');
 await page.locator('#engineerSessionSelect').selectOption(south.session_id);
 // Leave a deliberately different map in the historical analysis engine.
 await page.evaluate(()=>{
   AMSTrack.centerline=Array.from({length:60},(_,i)=>({x:i,y:i%3}));
   AMSTrack.reference={name:'Unrelated archived circuit',lengthM:9999};
   const detect=AMSTrack.detectCorners;
   AMSTrack.detectCorners=function(){return this===window.AMSTrack?[{p:.1,index:99,direction:'wrong',official:true}]:detect.call(this);};
   AMSRealtime.mode='native';
   document.getElementById('trackName').textContent='CURRENT LIVE CIRCUIT';
   document.getElementById('carName').textContent='CURRENT LIVE CAR';
   window.engineerEvents=[];window.addEventListener('ams-engineer-analysis',event=>engineerEvents.push(event.detail));
 });
 await page.locator('#engineerAnalyzeBtn').click();
 await page.waitForFunction(()=>!document.getElementById('engineerAnalyzeBtn').disabled,{},{timeout:120000});
 console.log('Engineer status:',await page.locator('#engineerStatus').textContent());
 console.log('Evidence rows:',await page.locator('#engineerEvidenceBody tr').count());
 console.log('Map status:',await page.locator('#engineerMapStatus').textContent());
 console.log('Best lap:',await page.locator('#engineerBestLap').textContent());
 if(process.env.AMS_ENGINEER_SCREENSHOT)await page.screenshot({path:process.env.AMS_ENGINEER_SCREENSHOT,fullPage:true});
 assert.ok(await page.locator('#engineerEvidenceBody tr').count()>0,'Engineer analysis failed to populate evidence');
 assert.equal(await page.locator('.engineer-table thead th').count(),4,'Evidence table still exposes statistical noise');
 assert.equal(await page.locator('#engineerAiOutput .engineer-coach-lesson[open]').count(),1,'Only the first practice priority should start expanded');
 assert.ok(await page.locator('#engineerAiOutput .engineer-coach-lesson').count()<=3);
 assert.notEqual(await page.locator('#engineerBestLap').textContent(),'—','Engineer best lap is empty');
 assert.ok((await page.locator('#engineerMapStatus').textContent()).includes('South Boston'),'Engineer map did not use its selected session');
 assert.ok(!(await page.locator('#engineerEvidenceBody').textContent()).includes('T99'),'Engineer corner labels used the global map');
 assert.ok(await page.locator('#engineerTrackSvg polyline').count()>0,'Engineer map did not render');
 await page.locator('#engineerAiBtn').click();
 await page.waitForFunction(()=>document.getElementById('engineerAiOutput').textContent.includes('Test coaching'));
 const ai=await page.evaluate(()=>fixtureRequests.find(request=>request.url.includes('virtual-engineer')));
 assert.equal(ai.body.context.circuit,'South Boston Speedway','AI briefing used the live track');
 assert.equal(ai.body.context.car,south.car,'AI briefing used the live car');
 assert.equal(ai.body.context.session_id,south.session_id);
 assert.equal(ai.body.report.mode,'driving_coach');
 assert.equal(ai.body.report.coaching_zones.length,Math.min(3,await page.locator('#engineerEvidenceBody tr').count()));
 assert.equal(ai.body.report.setup_influence,undefined);
 assert.ok(!(await page.locator('#engineerEvidenceBody').textContent()).includes('INCONCLUSIVE'));
 await page.evaluate(()=>AMSi18n.setLanguage('en'));
 assert.match(await page.locator('#engineerAiOutput').textContent(),/What to change/);
 assert.match(await page.locator('.engineer-table thead').textContent(),/Loss on this lap/);
 await page.setViewportSize({width:900,height:900});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Narrow Engineer view overflows horizontally');
 assert.ok(await page.locator('.engineer-table thead th').evaluateAll(cells=>cells.every(cell=>cell.scrollWidth<=cell.clientWidth+1)),'Narrow evidence headings overlap');
 assert.equal(await page.locator('#engineer>.ams-work-card').count(),0,'Duplicate statistics remained in the main driving workspace');
 if(process.env.AMS_ENGINEER_SCREENSHOT)await page.screenshot({path:process.env.AMS_ENGINEER_SCREENSHOT.replace('.png','-narrow-en.png'),fullPage:true});
 await page.setViewportSize({width:1600,height:1050});
 await page.evaluate(()=>AMSi18n.setLanguage('pt'));
 const callsBefore=await page.evaluate(()=>fixtureRequests.filter(r=>r.url.includes('virtual-engineer')).length);
 await page.evaluate(()=>{window.savedEngineerReport=AMSEngineer.currentReport;AMSEngineer.render({...savedEngineerReport,zones:[]});});
 assert.equal(await page.locator('#engineerEvidenceBody tr').count(),0);
 assert.ok(await page.locator('#engineerEvidenceEmpty').isVisible());
 assert.match(await page.locator('#engineerAiStatus').textContent(),/Sem perdas confirmadas/);
 assert.equal(await page.locator('#engineerAiOutput .engineer-coach-lesson').count(),0);
 await page.locator('#engineerAiBtn').click();
 assert.equal(await page.evaluate(()=>fixtureRequests.filter(r=>r.url.includes('virtual-engineer')).length),callsBefore,'Empty evidence caused an AI request');
 await page.evaluate(()=>AMSEngineer.render(savedEngineerReport));
 // A different global map, loaded after analysis, must not change the report map.
 const map=await page.locator('#engineerTrackSvg').innerHTML();
 await page.evaluate(()=>{AMSTrack.centerline=[];AMSTrack.reference=null;});
 assert.equal(await page.locator('#engineerTrackSvg').innerHTML(),map);
 await page.locator('#engineerReplayPanel summary').click();
 await page.locator('#engineerReplayBtn').click();
 await page.waitForFunction(()=>parseFloat(document.getElementById('engineerReplayTime').textContent)>.1);
 await page.waitForFunction(()=>document.getElementById('engineerReplayVelocity').textContent!=='—');
 assert.ok(await page.locator('#engineerReplayMap polyline').count()>0,'Engineer replay map failed');
 await page.locator('#engineerReplaySeek').fill('500');
 await page.locator('#engineerReplaySeek').dispatchEvent('input');
 assert.equal(await page.locator('#engineerTrackSvg').innerHTML(),map,'Replay changed analysis map');
 assert.equal(await page.locator('#trackName').textContent(),'CURRENT LIVE CIRCUIT','Engineer changed the live header');
 assert.equal(await page.evaluate(()=>AMSRealtime.mode),'native','Engineer changed the live mode');
 await page.evaluate(()=>{
   const request=AMSSupabase.request;
   AMSSupabase.request=(url,options)=>url.includes('virtual-engineer')?new Promise(resolve=>{window.finishOldBriefing=()=>resolve({text:'STALE BRIEFING'});}):request(url,options);
 });
 await page.locator('#engineerAiBtn').click();
 await page.waitForFunction(()=>typeof window.finishOldBriefing==='function');
 await page.locator('#engineerSessionSelect').dispatchEvent('change');
 await page.evaluate(()=>finishOldBriefing());
 await page.waitForFunction(()=>!document.getElementById('engineerAiBtn').disabled);
 assert.ok(!(await page.locator('#engineerAiOutput').textContent()).includes('STALE'),'Old AI response overwrote the new selection');
 assert.equal(await page.locator('#engineerEvidenceBody tr').count(),0,'Session change retained old evidence');
 assert.equal(await page.locator('#engineerTrackSvg polyline').count(),0,'Session change retained old map');
 assert.equal(await page.evaluate(()=>AMSEngineer.currentReport),null,'Session change retained AI context');
 assert.ok(!(await page.locator('#engineerAiOutput').textContent()).includes('Test coaching'),'Session change retained AI guidance');
 // A session change while telemetry is loading must cancel the pending report.
 await page.evaluate(()=>{
   const read=AMSSupabase.getLapTelemetry;
   AMSSupabase.getLapTelemetry=async(...args)=>{await new Promise(resolve=>{(window.pendingEngineerReads??=[]).push(resolve);});return read(...args);};
 });
 await page.locator('#engineerAnalyzeBtn').click();
 await page.waitForFunction(()=>window.pendingEngineerReads?.length===3);
 await page.locator('#engineerSessionSelect').dispatchEvent('change');
 await page.evaluate(()=>pendingEngineerReads.forEach(resolve=>resolve()));
 await page.waitForFunction(()=>!document.getElementById('engineerAnalyzeBtn').disabled);
 assert.equal(await page.locator('#engineerEvidenceBody tr').count(),0,'Cancelled analysis repopulated the selected session');
 assert.equal(await page.evaluate(()=>AMSEngineer.currentReport),null);
 assert.deepEqual(errors,[],'complete workspace raised JavaScript errors');
 console.log('PASS: full Engineer workspace, sessions, analysis, map and live isolation.');
}finally{await browser.close();}
