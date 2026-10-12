/* Real mini-sector comparison: computed from actual telemetry, never fake laps. */
(()=>{
'use strict';
const parent=document.getElementById('compare');if(!parent)return;
const container=document.createElement('article');container.className='ams-work-card ams-mini-explorer';
const heading=document.createElement('h3');heading.textContent='Mini-sector Performance Explorer';
const status=document.createElement('p');status.className='ams-event-hint';status.textContent='Seleciona duas voltas compatíveis e clica em Comparar para calcular 20 mini-setores reais.';
const bar=document.createElement('div');bar.className='ams-mini-summary';
const table=document.createElement('div');table.className='ams-mini-table-wrap';
container.append(heading,status,bar,table);
const corner=parent.querySelector('.ams-work-card');if(corner)corner.insertAdjacentElement('afterend',container);else parent.append(container);
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
const fmt=v=>Number.isFinite(v)?v.toFixed(3)+' s':'—';
document.addEventListener('ams-compare-data',event=>{
 const {lapA,lapB,circuit,car}=event.detail||{};
 if(!lapA?.samples?.length||!lapB?.samples?.length){status.textContent='As voltas não contêm amostras suficientes.';return;}
 const zones=window.AMSAnalysis?.zones(lapA,lapB,20)||[];
 const valid=zones.filter(z=>Number.isFinite(z.delta));
 if(!valid.length){status.textContent='Sem tempos válidos por posição para calcular mini-setores.';return;}
 const slow=[...valid].sort((a,b)=>b.delta-a.delta)[0];
 const fast=[...valid].sort((a,b)=>a.delta-b.delta)[0];
 status.textContent=(circuit||'Circuito')+' · '+(car||'Veículo')+' · '+valid.length+'/20 setores medidos por progresso normalizado. Não equivale a deteção automática de curvas.';
 bar.replaceChildren();
 [['Maior perda','Z'+slow.index+' +'+fmt(slow.delta)],['Maior ganho','Z'+fast.index+' '+fmt(fast.delta)],['Analisados',String(valid.length)+' / 20']].forEach(([k,v])=>{
  const item=document.createElement('div');item.append(text('span',k),text('strong',v));bar.append(item);
 });
 const t=document.createElement('table');t.className='ams-mini-table';
 const thead=document.createElement('thead'),hr=document.createElement('tr');
 ['Zona','Intervalo','Tempo A','Referência','Δ A − Ref','Vel. mín A','Vel. mín Ref','Pico travão'].forEach(x=>hr.append(text('th',x)));thead.append(hr);t.append(thead);
 const body=document.createElement('tbody');
 zones.forEach(z=>{
  const tr=document.createElement('tr');if(Number.isFinite(z.delta))tr.className=z.delta>0.04?'ams-loss':z.delta<-.04?'ams-gain':'';
  const pct=p=>Math.round(p*100)+'%';
  const vals=['Z'+String(z.index).padStart(2,'0'),pct(z.start)+'–'+pct(z.end),fmt(z.a?.time),fmt(z.b?.time),Number.isFinite(z.delta)?(z.delta>0?'+':'')+fmt(z.delta):'—',Number.isFinite(z.a?.minSpeed)?z.a.minSpeed.toFixed(1):'—',Number.isFinite(z.b?.minSpeed)?z.b.minSpeed.toFixed(1):'—',Number.isFinite(z.a?.peakBrake)?z.a.peakBrake.toFixed(1):'—'];
  vals.forEach(v=>tr.append(text('td',v)));
  tr.tabIndex=0;tr.title='Ir para esta zona do replay';const go=()=>{
    const seek=document.getElementById('compareReplaySeek');if(!seek)return;
    const min=Number(seek.min||0),max=Number(seek.max||1000);
    seek.value=String(min+(z.start+z.end)/2*(max-min));
    seek.dispatchEvent(new Event('input',{bubbles:true}));
  };
  tr.addEventListener('click',go);tr.addEventListener('keydown',e=>{if(e.key==='Enter'){go()}});
  body.append(tr);
 });t.append(body);table.replaceChildren(t);
});
})();
