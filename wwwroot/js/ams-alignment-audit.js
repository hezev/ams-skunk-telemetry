/* Track / trajectory alignment audit. Read-only quality indicators, never remaps track points. */
(()=>{
"use strict";
const root=document.getElementById("compare");if(!root)return;
const card=document.createElement("article");card.className="ams-work-card ams-alignment-audit";
const title=document.createElement("h3");title.textContent="Trajectory Alignment · Data Quality Audit";
const summary=document.createElement("p");summary.className="ams-event-hint";summary.textContent="Compara duas voltas compatíveis para analisar a qualidade da sobreposição.";
const grid=document.createElement("div");grid.className="ams-corner-status";
const note=document.createElement("p");note.className="ams-event-hint";note.textContent="O diagnóstico verifica consistência entre traçado e trajetórias, mas não certifica coordenadas GPS reais.";
card.append(title,summary,grid,note);
const anchor=root.querySelector(".ams-phase-panel")||root.querySelector(".ams-geometry-corners");if(anchor)anchor.after(card);else root.append(card);
const metric=(label,value)=>{const n=document.createElement("div"),a=document.createElement("span"),b=document.createElement("strong");a.textContent=label;b.textContent=value;n.append(a,b);grid.append(n);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fmt=(n,s="")=>Number.isFinite(n)?n.toFixed(2)+s:"—";
document.addEventListener("ams-compare-data",()=>{
 grid.replaceChildren();
 // renderFocusedCompare is called before this event is published by app.js.
 const t=window.AMSTrack,data=t?.focusedCompare,ref=t?.reference;
 if(!data?.a?.points?.length||!data?.ref?.points?.length||!t?.centerline?.length){
  summary.textContent="Trajetórias ou mapa indisponíveis; não é possível verificar o alinhamento.";return;
 }
 const a=data.a,b=data.ref,quality=Boolean(a.realGps&&b.realGps);
 const units=Number(t.viewUnitsToMeters?.());
 const center=typeof t.localPoint==="function"?p=>t.localPoint(p):()=>null;
 const rows=[];
 for(let i=0;i<=100;i++){
  const p=i/100,pointA=t.trajectoryPoint?.(a.points,p),pointB=t.trajectoryPoint?.(b.points,p);
  const mid=center(p);
  if(pointA&&pointB&&mid){
   rows.push({offA:dist(pointA,mid),offB:dist(pointB,mid),separation:dist(pointA,pointB)});
  }
 }
 const avg=(key)=>rows.length?rows.reduce((sum,r)=>sum+r[key],0)/rows.length:null;
 const max=(key)=>rows.length?Math.max(...rows.map(r=>r[key])):null;
 const meters=Number.isFinite(units)&&units>0?units:null;
 const show=(n)=>meters!==null?fmt(n*meters," m"):fmt(n," unid. mapa");
 summary.textContent=(quality?"GPS registado em ambas as voltas":"Pelo menos uma trajetória é estimada")+
  " · "+rows.length+" posições comparadas · traçado: "+(ref?.lengthM?"referência "+Math.round(Number(ref.lengthM))+" m":"sem comprimento confirmado");
 metric("Modo",quality?"GPS ambas":"Estimado / misto");
 metric("Desvio médio A ao centro",show(avg("offA")));
 metric("Desvio médio Ref ao centro",show(avg("offB")));
 metric("Separação média A / Ref",show(avg("separation")));
 metric("Separação máxima",show(max("separation")));
 metric("Cobertura comparável",rows.length+"/101");
 note.textContent="Desvio ao eixo central NÃO é erro de localização: uma trajetória válida pode estar afastada do centro. Para medir precisão absoluta são necessários margens calibradas e GPS de referência.";
});
})();