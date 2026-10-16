/* Live Pitwall map: reuses the calibrated AMS track centerline and live session positions. */
(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg';
const root=document.getElementById('liveRaceMap');
if(!root)return;
const map=document.createElementNS(NS,'svg');
map.setAttribute('viewBox','0 0 1000 700');
map.setAttribute('role','img');
map.setAttribute('aria-label','Live race positions on track');
root.appendChild(map);
const status=document.getElementById('liveMapStatus');
const count=document.getElementById('liveMapCount');
const tr=(pt,en)=>window.AMSi18n?.getLanguage?.()==='en'?en:pt;
function message(text){if(status)status.textContent=text;}
function svgEl(tag,attrs){const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));return el;}
function render(rows){
 map.replaceChildren();
 const own=window.AMSAuth?.user?.id;
 const reference=window.AMSTrack;
 const points=reference?.centerline;
 if(!Array.isArray(points)||points.length<3){message(tr('A carregar mapa da pista…','Loading track map…'));if(count)count.textContent='0';return;}
 const good=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(good.length<3){message(tr('Traçado indisponível','Track layout unavailable'));return;}
 const xs=good.map(p=>p.x),ys=good.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(900/Math.max(1,maxX-minX),600/Math.max(1,maxY-minY));
 const tx=x=>500+(x-(minX+maxX)/2)*scale,ty=y=>350+(y-(minY+maxY)/2)*scale;
 const path=good.map((p,i)=>(i?'L':'M')+tx(p.x).toFixed(2)+' '+ty(p.y).toFixed(2)).join(' ')+' Z';
 map.appendChild(svgEl('path',{d:path,stroke:'#34465e','stroke-width':17,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'}));
 map.appendChild(svgEl('path',{d:path,stroke:'#a4b3c4','stroke-width':3,fill:'none','stroke-linejoin':'round'}));
 const candidates=(rows||[]).filter(row=>row&&row.sample);
 const circuit=String(candidates.find(r=>r.pilot_id===own)?.circuit||candidates[0]?.circuit||'');
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
 message(countValid?tr('Posições da corrida em direto','Live race positions'):tr('Sem posições em direto','No live positions'));
}
window.AMSLiveMap={render,clear(){render([]);}};
document.addEventListener('ams:languagechange',()=>render(window.AMSRealtime?.liveRows||[]));
document.addEventListener('ams-live-update',e=>render(e.detail?.rows||[]));
document.addEventListener('ams-pitwall-replay-position',e=>{
 const d=e.detail||{},progress=Number(d.progress);
 if(!Number.isFinite(progress))return;
 render([{pilot_id:d.pilotId,circuit:d.circuit,sample:{
   position:Math.max(0,Math.min(1,progress))*100,
   driverName:d.driver||'Replay'
 }}]);
 message(tr('Replay · posição do piloto','Replay · driver position'));
});
render([]);
})();