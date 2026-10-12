/* Mockup fidelity v2. Read-only enrichment of existing telemetry elements. */
(()=>{
"use strict";
const $=(s,root=document)=>root.querySelector(s);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const addKpi=(parent,label,id,original)=>{const box=el('div'),name=el('span','',label),v=el('strong','ams-dynamic','—');v.dataset.mirror=id;box.append(name,v);parent.append(box);return v};
const mount=(viewId,title,subtitle,items)=>{
 const section=document.getElementById(viewId);if(!section)return;
 const header=$('.titlebar',section),anchor=$('.ams-compare-strip',section)||$('.metrics',section);if(!header||!anchor)return;
 const layout=el('div','ams-enhancement-grid');
 const left=el('section','ams-enhancement-card'),right=el('section','ams-enhancement-card');
 left.append(el('h3','',title));right.append(el('h3','','Operations & Data Quality'));
 const grid=el('div','ams-enhancement-data');left.append(grid);
 items.forEach(([label,id])=>addKpi(grid,label,id));
 const status=el('div','ams-monitor-status','Ligação à telemetria: a verificar…');
 const tip=el('p','ams-monitors-note',subtitle);
 const help=el('div','ams-band','Valores não disponíveis aparecem como —. Não são gerados dados fictícios.');
 right.append(status,tip,help);layout.append(left,right);
 anchor.insertAdjacentElement('afterend',layout);
 const sync=()=>{
   grid.querySelectorAll('[data-mirror]').forEach(node=>{
     const original=document.getElementById(node.dataset.mirror);
     if(!original)return;const value=(original.textContent||'').trim();
     if(node.textContent!==value)node.textContent=value||'—';
   });
   const live=$('#connectionText')?.textContent?.trim()||'A aguardar estado';
   const label='Ligação à telemetria: '+live;
   if(status.textContent!==label)status.textContent=label;
 };
 let raf=0;
 const observer=new MutationObserver(()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;sync()})});
 // Observe only canonical telemetry fields, not the cloned display.
 items.forEach(([,id])=>{const source=document.getElementById(id);if(source)observer.observe(source,{characterData:true,childList:true,subtree:true})});
 const conn=$('#connectionText');if(conn)observer.observe(conn,{characterData:true,childList:true,subtree:true});
 sync();
};
mount('dashboard','Race Performance Snapshot','Mapa, classificação, replay e controlo de corrida continuam ligados às fontes AMS existentes.',[
 ['Best lap','bestLap'],['Last lap','lastLap'],['Race position','position'],['Class position','classPosition'],['Fuel','fuel'],['Remaining laps','fuelLaps']
]);
mount('engineer','Engineer Evidence & Development','O veredito usa a análise de sessão existente. Os indicadores só são preenchidos após selecionar e analisar uma sessão.',[
 ['Best lap','engineerBestLap'],['Consistent pace','engineerPace'],['Achievable lap','engineerAchievable'],['Consistency','engineerConsistency']
]);
mount('compare','Lap Delta & Trajectory Workstation','As curvas de telemetria e trajetória originais permanecem sincronizadas pelo motor AMS; não é criada geometria artificial.',[
 ['Lap A','compareLapASelect'],['Reference','compareLapBSelect'],['Selected lap','selectedLapTime']
]);
const style=document.createElement('style');style.textContent=
 '.ams-enhancement-grid{animation:ams-enter .28s ease-out}@keyframes ams-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}';
document.head.append(style);
})();
