/* Live geometry is bound to the active session, independent of archive/compare geometry. */
(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg';
const panels=[['liveRaceMap','liveMapStatus','liveMapCount'],['raceControlMap','raceControlMapStatus',null]].map(([rootId,statusId,countId])=>{
 const root=document.getElementById(rootId);if(!root)return null;
 const map=document.createElementNS(NS,'svg');
 map.setAttribute('viewBox','0 0 1000 700');map.setAttribute('role','img');map.setAttribute('aria-label','Live race positions on track');
 map.style.cssText='width:100%;height:100%';root.appendChild(map);
 return {map,status:document.getElementById(statusId),count:countId?document.getElementById(countId):null};
}).filter(Boolean);
if(!panels.length)return;
let liveTrack=null,requestedTrack=null,lastRows=[];
const tr=(pt,en)=>window.AMSi18n?.getLanguage?.()==='en'?en:pt;
function message(text){for(const {status} of panels)if(status)status.textContent=text;}
function svgEl(tag,attrs){const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));return el;}
function render(rows){
 lastRows=rows||[];
 for(const panel of panels)draw(panel,lastRows);
}
function draw({map,status,count},rows){
 const message=text=>{if(status)status.textContent=text;};
 map.replaceChildren();
 delete map.dataset.trackId;delete map.dataset.circuit;
 const own=window.AMSAuth?.user?.id;
 const candidates=(rows||[]).filter(row=>row&&row.sample);
 const circuit=String(candidates.find(r=>r.pilot_id===own)?.circuit||candidates[0]?.circuit||'');
 const reference=liveTrack;
 const points=reference?.centerline;
 if(!Array.isArray(points)||points.length<3||(circuit&&reference.circuit!==circuit)){
   message(tr('A carregar mapa da pista…','Loading track map…'));if(count)count.textContent='0';return;
 }
 map.dataset.trackId=reference.trackId||'';
 map.dataset.circuit=reference.circuit||'';
 const good=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(good.length<3){message(tr('Traçado indisponível','Track layout unavailable'));return;}
 const xs=good.map(p=>p.x),ys=good.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(900/Math.max(1,maxX-minX),600/Math.max(1,maxY-minY));
 const tx=x=>500+(x-(minX+maxX)/2)*scale,ty=y=>350+(y-(minY+maxY)/2)*scale;
 const path=good.map((p,i)=>(i?'L':'M')+tx(p.x).toFixed(2)+' '+ty(p.y).toFixed(2)).join(' ')+' Z';
 map.appendChild(svgEl('path',{d:path,stroke:'#34465e','stroke-width':17,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'}));
 map.appendChild(svgEl('path',{d:path,stroke:'#a4b3c4','stroke-width':3,fill:'none','stroke-linejoin':'round'}));
 const finish=reference.alignment?.startAligned&&reference.alignment.startFinish;
 if(finish){
   const attrs={x1:tx(finish.a.x),y1:ty(finish.a.y),x2:tx(finish.b.x),y2:ty(finish.b.y)};
   map.appendChild(svgEl('line',{...attrs,stroke:'#071019','stroke-width':7}));
   const mark=svgEl('line',{...attrs,stroke:'#fff','stroke-width':3,'data-role':'start-finish'});
   const title=svgEl('title',{});title.textContent=tr('Linha de partida/meta','Start/finish line');mark.appendChild(title);map.appendChild(mark);
   const label=svgEl('text',{x:attrs.x2+7,y:attrs.y2,fill:'#fff','font-size':12});label.textContent='S/F';map.appendChild(label);
   if(reference.alignment.directionSource!=='unknown'){
     const i=Math.max(2,Math.round(points.length*.018)),p=points[i],before=points[i-2],after=points[(i+2)%points.length];
     const dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,x=tx(p.x),y=ty(p.y);
     map.appendChild(svgEl('polygon',{points:[[x+ux*10,y+uy*10],[x-ux*7-uy*6,y-uy*7+ux*6],[x-ux*7+uy*6,y-uy*7-ux*6]].map(p=>p.join(',')).join(' '),fill:'#fff',stroke:'#071019','stroke-width':1,'data-role':'track-direction'}));
   }
 }
 let countValid=0;
 for(const row of candidates){
   if(circuit&&row.circuit&&row.circuit!==circuit)continue;
   const progress=window.AMSSupabase?.samplePosition?.(row.sample);
   if(!Number.isFinite(progress))continue;
   const normalized=((progress%1)+1)%1;
   const at=normalized*points.length,i=Math.floor(at)%points.length,frac=at-Math.floor(at),a=points[i],b=points[(i+1)%points.length];
   if(!a||!b)continue;
   const x=tx(a.x+(b.x-a.x)*frac),y=ty(a.y+(b.y-a.y)*frac);
   const isOwn=row.pilot_id===own;
   const circle=svgEl('circle',{cx:x,cy:y,r:isOwn?10:7,fill:isOwn?'#ff3045':'#32c6ff',stroke:'#071019','stroke-width':2});
   const p=row.sample,number=p.carNumber??p.car_number??p.number??'';
   const name=p.driverName??p.driver_name??p.name??(isOwn?tr('Tu','You'):tr('Piloto','Driver'));
   const title=svgEl('title',{});title.textContent=(number?'#'+String(number).replace('#','')+' · ':'')+name;
   circle.appendChild(title);map.appendChild(circle);countValid++;
   if(number){const label=svgEl('text',{x:x+10,y:y-9,fill:'#f0f6ff','font-size':16,'font-weight':'bold'});label.textContent=String(number).replace('#','');map.appendChild(label);}
 }
 if(count)count.textContent=String(countValid);
 const label=[reference.circuit,reference.trackId?'ID '+reference.trackId:''].filter(Boolean).join(' · ');
 message(label+' · '+(countValid?tr('Posições da corrida em direto','Live race positions'):tr('Sem posições em direto','No live positions')));
}
window.AMSLiveMap={
 render,
 beginTrack(identity){
   requestedTrack=identity;liveTrack=null;render(lastRows);
 },
 setTrack(track,key){
   if(requestedTrack&&key!==requestedTrack.key)return false;
   if(requestedTrack&&String(track?.trackId||'')!==String(requestedTrack.trackId||''))return false;
   liveTrack=track?{...track,centerline:track.centerline.map(p=>({...p}))}:null;
   render(lastRows);return true;
 },
 failTrack(key){
   if(requestedTrack?.key!==key)return;
   liveTrack=null;render(lastRows);message(tr('Mapa indisponível para esta pista','Map unavailable for this track'));
 },
 clear(){render([]);}
};
document.addEventListener('ams:languagechange',()=>render(window.AMSRealtime?.liveRows||[]));
document.addEventListener('ams-live-update',e=>render(e.detail?.rows||[]));
document.addEventListener('ams-track-loaded',e=>{
 // Cloud-only sessions can use a matching completed load; native sessions are
 // pinned explicitly and must never be replaced by a recorded lap.
 if(!requestedTrack&&e.detail?.context==='live'){liveTrack=e.detail?.map||null;render(lastRows);}
});
render([]);
})();
