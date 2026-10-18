/* Engineer playback owns its clock, telemetry and map. Never publishes live samples. */
(()=>{
 'use strict';
 const select=document.getElementById('engineerReplayLapSelect');if(!select)return;
 const q=id=>document.getElementById(id),set=(id,text)=>{const el=q(id);if(el)el.textContent=text;};
 const state={rows:[],detail:null,lap:null,map:null,marker:null,timer:null,time:0,revision:0};
 const ns='http://www.w3.org/2000/svg';
 const make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
 const pause=()=>{if(state.timer)clearInterval(state.timer);state.timer=null;set('engineerReplayBtn','▶ Replay');};
 const duration=()=>Math.max(.001,state.lap?.lapTimeSec||0);
 function renderTime(time){
   state.time=Math.max(0,Math.min(duration(),time));
   const lap=state.lap;if(!lap)return;
   const progress=AMSAnalysis.progressAtTime(lap,state.time);
   set('engineerReplayTime',state.time.toFixed(1)+'s / '+duration().toFixed(1)+'s');
   q('engineerReplaySeek').value=String(Math.round(state.time/duration()*1000));
   for(const [id,key,suffix] of [['Velocity','speed',' km/h'],['Throttle','throttle','%'],['Brake','brake','%'],['Gear','gear','']]){
     const value=AMSAnalysis.interpolate(lap,progress,key);
     set('engineerReplay'+id,Number.isFinite(value)?Math.round(value)+suffix:'—');
   }
   const points=state.map?.centerline;
   if(state.marker&&points?.length){
     const station=progress*(points.length-1),i=Math.floor(station),fraction=station-i;
     const a=points[i],b=points[Math.min(points.length-1,i+1)];
     state.marker.setAttribute('cx',a.x+(b.x-a.x)*fraction);
     state.marker.setAttribute('cy',a.y+(b.y-a.y)*fraction);
   }
 }
 function renderMap(){
   const root=q('engineerReplayMap');root.replaceChildren();state.marker=null;
   const points=state.map?.centerline;if(!points?.length){root.textContent='Mapa indisponível para esta volta';return;}
   const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys);
   const width=Math.max(1,Math.max(...xs)-minX),height=Math.max(1,Math.max(...ys)-minY),pad=Math.max(width,height)*.05;
   const svg=make('svg',{viewBox:[minX-pad,minY-pad,width+pad*2,height+pad*2].join(' '),role:'img','aria-label':'Replay Engineer'});
   svg.style.cssText='width:100%;height:100%';
   svg.appendChild(make('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),stroke:'#a4b3c4','stroke-width':Math.max(width,height)*.005,fill:'none'}));
   state.marker=make('circle',{r:Math.max(width,height)*.012,fill:'#ff8a00',stroke:'#fff','stroke-width':Math.max(width,height)*.002});
   svg.appendChild(state.marker);root.appendChild(svg);
 }
 async function load(){
   const id=select.value;if(!id)return false;
   if(state.detail?.id===id&&state.lap)return true;
   const revision=++state.revision;pause();
   set('engineerReplayStatus','A carregar volta…');
   try{
     const token=id.startsWith('local:')?null:await AMSAuth.token();
     const detail=await AMSSupabase.getLapTelemetry(token,id);
     if(revision!==state.revision||select.value!==id)return false;
     if(!detail?.telemetry?.length)throw Error('Volta sem telemetria');
     const lap=AMSAnalysis.prepareLap(detail);
     if(!lap.samples.length)throw Error('Volta sem amostras válidas');
     const engine=window.AMSEngineerReplayTrack||(window.AMSEngineerReplayTrack=AMSTrack.createContext('engineerReplay'));
     const result=await engine.load(detail.circuit||'','',detail.telemetry);
     if(revision!==state.revision||select.value!==id)return false;
     state.detail={...detail,id};state.lap=lap;state.map=result?.map||null;state.time=0;
     renderMap();renderTime(0);
     set('engineerReplayStatus',(detail.circuit||'—')+' · '+(detail.car||'—'));
     return true;
   }catch(error){if(revision===state.revision)set('engineerReplayStatus',String(error.message||error));return false;}
 }
 async function play(){
   if(state.timer){pause();return;}
   if(!await load())return;
   if(state.time>=duration()-.001)renderTime(0);
   set('engineerReplayBtn','■ Parar');let previous=performance.now();
   state.timer=setInterval(()=>{
     const now=performance.now(),elapsed=Math.min(.25,(now-previous)/1000);previous=now;
     renderTime(state.time+elapsed*(Number(q('engineerReplaySpeed').value)||1));
     if(state.time>=duration())pause();
   },33);
 }
 function reset(){
   pause();state.revision++;state.detail=null;state.lap=null;state.map=null;state.marker=null;state.time=0;
   q('engineerReplayMap').replaceChildren();q('engineerReplaySeek').value='0';set('engineerReplayTime','0.0s');
   for(const id of ['Velocity','Throttle','Brake','Gear'])set('engineerReplay'+id,'—');
   set('engineerReplayStatus',select.value?'Pronto para replay':'Seleciona uma volta');
 }
 window.AMSEngineerReplay={
   setLaps(rows){
     const previous=select.value;
     state.rows=[...rows].sort((a,b)=>Date.parse(b.completed_at||0)-Date.parse(a.completed_at||0));
     select.replaceChildren();
     for(const lap of state.rows){
       const option=document.createElement('option');option.value=String(lap.id);
       option.textContent='#'+(lap.lap_number??'—')+' · '+(Number(lap.lap_time_ms)/1000).toFixed(3)+'s · '+(lap.circuit||'');select.appendChild(option);
     }
     if(state.rows.some(row=>String(row.id)===previous))select.value=previous;
     if(select.value!==previous||!state.rows.length)reset();
   },pause
 };
 select.addEventListener('change',reset);
 q('engineerReplayBtn').addEventListener('click',()=>void play());
 q('engineerReplaySeek').addEventListener('input',async e=>{
   const ratio=Number(e.target.value)/1000;pause();if(await load())renderTime(ratio*duration());
 });
})();
