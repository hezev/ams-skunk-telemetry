/* Geometric corner phase analysis. Approximate thirds of each detected corner.
   Values only from valid lap samples and canonical AMSAnalysis; no fabricated GPS. */
(()=>{
"use strict";
const root=document.getElementById("compare");if(!root)return;
const pane=document.createElement("article");pane.className="ams-work-card ams-phase-panel";
const heading=document.createElement("h3");heading.textContent="Corner Phases · Entry / Apex / Exit";
const status=document.createElement("p");status.className="ams-event-hint";status.textContent="A aguardar comparação de voltas compatíveis com geometria de pista.";
const chooser=document.createElement("select");chooser.className="ams-control ams-phase-select";chooser.setAttribute("aria-label","Selecionar curva");
const chart=document.createElement("div");chart.className="ams-phase-grid";
const disclaimer=document.createElement("p");disclaimer.className="ams-event-hint";disclaimer.textContent="Apex estimado por velocidade mínima, direção e proximidade à curva geométrica. Não equivale ao apex físico confirmado por GPS.";
pane.append(heading,status,chooser,chart,disclaimer);
const original=root.querySelector(".ams-geometry-corners");if(original)original.after(pane);else root.append(pane);
const fmt=(value,digits=2,suffix="")=>Number.isFinite(value)?value.toFixed(digits)+suffix:"—";
const create=(tag,txt,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=txt;return el};
let dataset=[];
const apexEstimate=(lap,corner)=>{
 const list=(lap?.samples||[]).filter(s=>s._p>=corner.entry&&s._p<=corner.exit&&Number.isFinite(Number(s.speed)));
 if(list.length<5)return null;
 const speeds=list.map(s=>Number(s.speed));
 const low=Math.min(...speeds),high=Math.max(...speeds),spread=high-low;
 if(spread<3)return null;
 const mid=corner.p,half=Math.max(.0001,(corner.exit-corner.entry)/2);
 const options=list.map((s,i)=>{
   const sp=(Number(s.speed)-low)/Math.max(spread,1);
   const positionPenalty=Math.abs(s._p-mid)/half;
   const steer=Number(s.steer);
   const steering=Number.isFinite(steer)?Math.min(1,Math.abs(steer)/180):0;
   const score=.75*sp+.2*positionPenalty-.05*steering;
   return {p:s._p,score,hasSteer:Number.isFinite(steer)};
 }).sort((a,b)=>a.score-b.score);
 if(!options.length)return null;
 return {p:options[0].p,source:options.some(x=>x.hasSteer)?'velocidade + direção':'velocidade'};
};
const seek=(p)=>{const input=document.getElementById("compareReplaySeek");if(!input)return;const min=Number(input.min||0),max=Number(input.max||1000);input.value=String(min+p*(max-min));input.dispatchEvent(new Event("input",{bubbles:true}));};
const show=index=>{
 const item=dataset[index];chart.replaceChildren();if(!item)return;
 disclaimer.textContent=item.estimate?'Apex estimado por '+item.estimate.source+' e geometria. Não é um ponto GPS confirmado.':'Sem sinal suficiente para estimar apex: zona central geométrica apresentada.';
 for(const part of item.parts){
  const card=document.createElement("button");card.type="button";card.className="ams-phase-card";
  card.append(create("h4",part.name),create("span","Δ A − Ref: "+(Number.isFinite(part.delta)?(part.delta>0?"+":"")+fmt(part.delta,3,"s"):"—"),"ams-phase-delta"));
  const metrics=[
   ["Tempo A",fmt(part.a.time,3,"s")],["Tempo Ref",fmt(part.b.time,3,"s")],
   ["Vel. mínima A",fmt(part.a.minSpeed,1," km/h")],["Vel. mínima Ref",fmt(part.b.minSpeed,1," km/h")],
   ["Travagem A",fmt(part.a.peakBrake,1)],["Travagem Ref",fmt(part.b.peakBrake,1)],
   ["Acelerador A",fmt(part.a.avgThrottle,1)],["Acelerador Ref",fmt(part.b.avgThrottle,1)]
  ];
  const list=document.createElement("div");list.className="ams-phase-measures";
  for(const [k,v] of metrics){const div=document.createElement("div");div.append(create("small",k),create("strong",v));list.append(div);}
  card.append(list);card.addEventListener("click",()=>seek(part.mid));chart.append(card);
 }
};
chooser.addEventListener("change",()=>show(Number(chooser.value)));
document.addEventListener("ams-compare-data",e=>{
 dataset=[];chooser.replaceChildren();chart.replaceChildren();
 const {lapA,lapB,circuit}=e.detail||{},track=window.AMSTrack,analysis=window.AMSAnalysis;
 if(!lapA?.samples?.length||!lapB?.samples?.length||!analysis?.segmentStats){status.textContent="Dados de comparação insuficientes.";return;}
 const corners=track?.detectCorners?.()||[];
 if(!corners.length){status.textContent="Sem curvas identificáveis nesta configuração do circuito.";return;}
 for(const corner of corners){
  if(!Number.isFinite(corner.entry)||!Number.isFinite(corner.exit)||corner.exit<=corner.entry)continue;
  const len=corner.exit-corner.entry;
  const estimate=apexEstimate(lapA,corner);
  const apex=estimate?.p??corner.p;
  const halfWidth=len/6;
  const left=Math.max(corner.entry,Math.min(corner.exit-2*halfWidth,apex-halfWidth));
  const right=Math.min(corner.exit,Math.max(corner.entry+2*halfWidth,apex+halfWidth));
  if(!(left>corner.entry&&right>left&&corner.exit>right))continue;
  const boundaries=[corner.entry,left,right,corner.exit];
  const parts=["Entrada",estimate?"Apex estimado":"Zona central (sem apex medido)","Saída"].map((name,i)=>{
   const start=boundaries[i],end=boundaries[i+1],a=analysis.segmentStats(lapA,start,end),b=analysis.segmentStats(lapB,start,end);
   return {name,a,b,mid:(start+end)/2,delta:Number.isFinite(a.time)&&Number.isFinite(b.time)?a.time-b.time:null};
  });
  dataset.push({corner,parts,estimate});
  const option=document.createElement("option");option.value=String(dataset.length-1);option.textContent="Curva "+corner.index+" · "+(corner.direction||"");chooser.append(option);
 }
 if(!dataset.length){status.textContent="A geometria não forneceu intervalos válidos.";return;}
 status.textContent=(circuit||"Circuito")+" · "+dataset.length+" curvas, 3 fases por curva, comparação com amostras reais";
 chooser.value="0";show(0);
});
})();