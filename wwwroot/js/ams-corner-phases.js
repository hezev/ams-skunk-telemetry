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
const disclaimer=document.createElement("p");disclaimer.className="ams-event-hint";disclaimer.textContent="Fases estimadas a partir da geometria, não apex oficial. Os valores são calculados da telemetria carregada.";
pane.append(heading,status,chooser,chart,disclaimer);
const original=root.querySelector(".ams-geometry-corners");if(original)original.after(pane);else root.append(pane);
const fmt=(value,digits=2,suffix="")=>Number.isFinite(value)?value.toFixed(digits)+suffix:"—";
const create=(tag,txt,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=txt;return el};
let dataset=[];
const seek=(p)=>{const input=document.getElementById("compareReplaySeek");if(!input)return;const min=Number(input.min||0),max=Number(input.max||1000);input.value=String(min+p*(max-min));input.dispatchEvent(new Event("input",{bubbles:true}));};
const show=index=>{
 const item=dataset[index];chart.replaceChildren();if(!item)return;
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
  const boundaries=[corner.entry,corner.entry+len/3,corner.entry+2*len/3,corner.exit];
  const parts=["Entrada","Apex (zona central)","Saída"].map((name,i)=>{
   const start=boundaries[i],end=boundaries[i+1],a=analysis.segmentStats(lapA,start,end),b=analysis.segmentStats(lapB,start,end);
   return {name,a,b,mid:(start+end)/2,delta:Number.isFinite(a.time)&&Number.isFinite(b.time)?a.time-b.time:null};
  });
  dataset.push({corner,parts});
  const option=document.createElement("option");option.value=String(dataset.length-1);option.textContent="Curva "+corner.index+" · "+(corner.direction||"");chooser.append(option);
 }
 if(!dataset.length){status.textContent="A geometria não forneceu intervalos válidos.";return;}
 status.textContent=(circuit||"Circuito")+" · "+dataset.length+" curvas, 3 fases por curva, comparação com amostras reais";
 chooser.value="0";show(0);
});
})();