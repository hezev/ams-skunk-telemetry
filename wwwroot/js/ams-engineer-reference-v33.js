/* v35: Engineer map tied to the completed session report, never stale global track state.
   Overlay colors measure within-session median-vs-best segment losses, not invented gains. */
(()=>{'use strict';
const svg=document.getElementById('engineerTrackSvg');
const empty=document.getElementById('engineerMapEmpty');
const status=document.getElementById('engineerMapStatus');
const legend=document.getElementById('engineerMapLegend');
if(!svg||!empty||!status)return;
const ns='http://www.w3.org/2000/svg';
const element=(tag,attrs,parent=svg)=>{
 const el=document.createElementNS(ns,tag);
 Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
 parent.append(el);return el;
};
let snapshot=null,report=null;
const clear=()=>{
 svg.replaceChildren();
 svg.setAttribute('viewBox','0 0 1000 600');
 empty.hidden=false;
 status.textContent='SEM ANÁLISE';
 if(legend)legend.hidden=true;
};
const station=(pts,progress)=>{
 const n=pts.length,p=((Number(progress)%1)+1)%1,u=p*n,i=Math.floor(u)%n,j=(i+1)%n,t=u-Math.floor(u);
 return {x:pts[i].x+(pts[j].x-pts[i].x)*t,y:pts[i].y+(pts[j].y-pts[i].y)*t};
};
function render(){
 if(!snapshot||!report?.ok||snapshot.points.length<50){clear();return;}
 const pts=snapshot.points;
 svg.replaceChildren();
 const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const spread=Math.max(maxX-minX,maxY-minY,1),pad=spread*.06;
 const view=[minX-pad,minY-pad,maxX-minX+2*pad,maxY-minY+2*pad];
 svg.setAttribute('viewBox',view.map(x=>x.toFixed(2)).join(' '));
 svg.setAttribute('preserveAspectRatio','xMidYMid meet');
 const trace=pts.filter((_,i)=>i%3===0);
 trace.push(pts[0]);
 const coords=trace.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
 const width=Math.max(.8,spread*.0045),shadow=Math.max(3,spread*.014);
 element('polyline',{points:coords,fill:'none',stroke:'#16364b','stroke-width':shadow,'stroke-linejoin':'round'});
 element('polyline',{points:coords,fill:'none',stroke:'#7896aa','stroke-width':width,'stroke-linejoin':'round'});
 const zones=window.AMSEngineerCoaching.zones(report).filter(z=>Number.isFinite(z.start)&&Number.isFinite(z.end)&&z.end>z.start);
 const maxLoss=Math.max(0,...zones.map(z=>z.drivingEvidence.loss));
 for(const z of zones){
  const samples=[];
  const steps=Math.max(14,Math.ceil((z.end-z.start)*700));
  for(let i=0;i<=steps;i++)samples.push(station(pts,z.start+(z.end-z.start)*i/steps));
  const relative=maxLoss>0.004?z.drivingEvidence.loss/maxLoss:0;
  const color=relative>=.68?'#ee4b5b':relative>=.31?'#e9b947':'#23bd81';
  const shape=element('polyline',{points:samples.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' '),
   fill:'none',stroke:color,'stroke-width':Math.max(2.8,spread*.008),
   'stroke-linecap':'round','stroke-linejoin':'round'});
  element('title',{},shape).textContent=window.AMSEngineerCoaching.tr('Zona ','Zone ')+z.index+' · +'+z.drivingEvidence.loss.toFixed(3)+'s';
 }
 for(const c of snapshot.turns){
  const p=station(pts,c.p),r=Math.max(10,spread*.014);
  element('circle',{cx:p.x,cy:p.y,r,fill:'#0b1925',stroke:'#63b8f1','stroke-width':Math.max(1.6,spread*.002)});
  const t=element('text',{x:p.x,y:p.y+Math.max(3,spread*.0045),'text-anchor':'middle',fill:'#eef8ff','font-size':Math.max(10,spread*.013),'font-weight':'800'});
  t.textContent=String(c.index);
 }
 empty.hidden=true;
 if(legend)legend.hidden=zones.length===0;
 status.textContent=(snapshot.name||'Traçado')+(snapshot.turns.length?' · '+snapshot.turns.length+' curvas oficiais':' · curvas não validadas');
}
window.addEventListener('ams-engineer-analysis',e=>{
 report=e.detail?.report||null;
 snapshot=report?.map||null;
 render();
});
document.getElementById('engineerSessionSelect')?.addEventListener('change',()=>{
 snapshot=null;report=null;clear();
 window.AMSEngineer?.render({ok:false,reason:'Analisa a sessão selecionada para atualizar os indicadores.'});
});
clear();
})();
