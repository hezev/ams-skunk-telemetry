/* Circuit geometry corner explorer. Uses active track centerline and actual compared telemetry. */
(()=>{
'use strict';
const root=document.getElementById('compare');if(!root)return;
const box=document.createElement('article');box.className='ams-work-card ams-geometry-corners';
box.innerHTML='<h3>Corner Explorer · Geometria + Telemetria</h3><p id="amsCornerState" class="ams-event-hint">Seleciona duas voltas compatíveis e clica em Comparar.</p><div class="ams-geometry-grid" id="amsGeometryGrid"></div>';
const next=root.querySelector('.ams-mini-explorer');if(next)next.after(box);else root.append(box);
const state=box.querySelector('#amsCornerState'),grid=box.querySelector('#amsGeometryGrid');
const fmt=(v,n=3)=>Number.isFinite(v)?Number(v).toFixed(n):'—';
const td=(title,value)=>{const el=document.createElement('div');const a=document.createElement('span'),b=document.createElement('strong');a.textContent=title;b.textContent=value;el.append(a,b);return el;};
const seek=(p)=>{const input=document.getElementById('compareReplaySeek');if(!input)return;const min=Number(input.min||0),max=Number(input.max||1000);input.value=String(min+p*(max-min));input.dispatchEvent(new Event('input',{bubbles:true}));};
document.addEventListener('ams-compare-data',e=>{
 const {lapA,lapB,circuit}=e.detail||{};
 grid.replaceChildren();
 if(!lapA?.samples?.length||!lapB?.samples?.length){state.textContent='Telemetria insuficiente para analisar curvas.';return;}
 const track=window.AMSTrack,analysis=window.AMSAnalysis;
 const corners=track?.detectCorners?.()||[];
 if(!corners.length||!Array.isArray(track?.centerline)||track.centerline.length<50){
  state.textContent='Sem geometria validada suficiente para identificar curvas. Mantém-se disponível a análise por 20 zonas.';return;
 }
 const valid=corners.filter(c=>Number.isFinite(c.p)&&Number.isFinite(c.entry)&&Number.isFinite(c.exit)&&c.exit>c.entry);
 if(!valid.length){state.textContent='Não foi possível localizar curvas nesta configuração.';return;}
 state.textContent=(circuit||'Circuito')+' · '+valid.length+(valid.every(c=>c.official)?' curvas numeradas a partir do turns.svg da configuração iRacing. Posições aproximadas ao eixo da pista.':' curvas estimadas pela geometria. Numeração não oficial.');
 valid.forEach(c=>{
  const a=analysis.segmentStats(lapA,c.entry,c.exit),b=analysis.segmentStats(lapB,c.entry,c.exit);
  const delta=Number.isFinite(a.time)&&Number.isFinite(b.time)?a.time-b.time:null;
  const node=document.createElement('button');node.type='button';node.className='ams-corner-insight';
  const h=document.createElement('h4');h.textContent='Curva '+c.index+' · '+(c.direction||'Geometria');node.append(h);
  const data=document.createElement('div');data.className='ams-corner-numbers';
  data.append(td('Progresso',Math.round(c.p*1000)/10+'%'),td('Δ tempo',Number.isFinite(delta)?(delta>=0?'+':'')+fmt(delta)+'s':'—'),td('Vel. mín A',fmt(a.minSpeed,1)+' km/h'),td('Vel. mín ref.',fmt(b.minSpeed,1)+' km/h'),td('Pico travão A',fmt(a.peakBrake,1)),td('Pico travão ref.',fmt(b.peakBrake,1)));
  node.append(data);node.addEventListener('click',()=>{grid.querySelectorAll('button').forEach(n=>n.classList.remove('selected'));node.classList.add('selected');seek(c.p);});grid.append(node);
 });
});
})();
