/* AMS Race Events and Corner Explorer — observed data only; no synthetic incidents */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const create=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const panel=(heading)=>{const p=create('article','ams-work-card');p.append(create('h3','',heading));return p};
const dash=$('#dashboard'),compare=$('#compare'),eng=$('#engineer');
if(!dash||!compare||!eng)return;
const eventPanel=panel('Race Events · Session Feed'),feed=create('div','ams-event-feed');
const eDesc=create('div','ams-event-hint','Observações locais a partir dos indicadores de sessão. Não são incidentes oficiais do simulador.');
const clear=create('button','ams-secondary','Limpar histórico');clear.type='button';
clear.addEventListener('click',()=>{feed.replaceChildren();history.length=0;});
eventPanel.append(eDesc,feed,clear);
const insertAfter=(view,node)=>{const last=view.querySelector('.ams-enhancement-grid')||view.querySelector('.dashboard-lower')||view.querySelector('.metrics');if(last)last.insertAdjacentElement('afterend',node);else view.append(node)};
insertAfter(dash,eventPanel);
const history=[];
const add=(type,title,description)=>{
 const item={type,title,description,time:new Date()};
 if(history.length&&history[0].type===type&&history[0].description===description)return;
 history.unshift(item);history.splice(24);
 feed.replaceChildren();
 history.forEach(x=>{
   const row=create('div','ams-event-row');
   const time=create('time','',x.time.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
   const info=create('div');info.append(create('strong','',x.title),create('span','',x.description));
   const tag=create('b','ams-event-type '+x.type,x.type==='attention'?'ATENÇÃO':'DADOS');
   row.append(time,info,tag);feed.append(row);
 });
};
let previous={};
const obs=['connectionText','position','classPosition','lastLap','fuel','sessionTime','trackChip'];
const read=(id)=>($('#'+id)?.textContent||'').trim();
const snapshot=()=>{
 obs.forEach(id=>{
  const next=read(id);
  if(!next||next==='—'||next===previous[id]){previous[id]=next;return;}
  if(previous[id]!==undefined){
   const labels={connectionText:'Ligação à telemetria',position:'Posição alterada',classPosition:'Posição na classe',lastLap:'Nova volta',fuel:'Combustível atualizado',sessionTime:'Tempo de sessão',trackChip:'Estado do circuito'};
   if(id==='sessionTime'||id==='fuel')return void(previous[id]=next); // too frequent for event feed
   add(id==='connectionText'&&/ERROR|OFFLINE|DISCONNECT/i.test(next)?'attention':'data',labels[id],next);
  }
  previous[id]=next;
 });
};
obs.forEach(id=>{const e=$('#'+id);if(!e)return;new MutationObserver(snapshot).observe(e,{subtree:true,childList:true,characterData:true})});
snapshot();
const box=panel('Corner Explorer · Focus & Replay');
const note=create('p','ams-event-hint','Seleciona uma zona do traçado para mover o cursor do replay. Os dados exibidos são os da comparação selecionada.');
const buttons=create('div','ams-corner-grid');
for(let i=0;i<20;i++){
 const b=create('button','ams-corner-btn','Z'+String(i+1).padStart(2,'0'));b.type='button';
 b.dataset.progress=String((i+.5)/20);
 b.title='Ir para a zona '+(i+1)+' do replay';
 b.addEventListener('click',()=>{
   buttons.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
   const seek=$('#compareReplaySeek');
   if(seek){
     const p=Number(b.dataset.progress),min=Number(seek.min||0),max=Number(seek.max||1000);
     seek.value=String(min+p*(max-min));seek.dispatchEvent(new Event('input',{bubbles:true}));
     boxStatus.textContent='Zona '+(i+1)+' de 20 · cursor de replay posicionado';
   } else boxStatus.textContent='Carrega uma comparação antes de navegar pelas zonas.';
 });
 buttons.append(b);
}
const boxStatus=create('div','ams-event-hint','20 zonas equidistantes em progresso. Não são curvas identificadas nem mini-setores medidos.');
const strip=create('div','ams-corner-status');
[['Delta','compareFocusDelta'],['Distância entre linhas','compareFocusSeparation'],['Coaching','compareFocusCoach']].forEach(([label,id])=>{
 const item=create('div');item.append(create('span','',label));const value=create('strong','','—');item.append(value);
 const target=$('#'+id);
 if(target){const update=()=>{value.textContent=(target.textContent||'').trim()||'—'};new MutationObserver(update).observe(target,{subtree:true,childList:true,characterData:true});update()}
 strip.append(item);
});
box.append(note,buttons,boxStatus,strip);insertAfter(compare,box);
const evidence=panel('Engineering Evidence · Session Notes');
const info=create('p','ams-event-hint','Resumo dos resultados de análise existentes; sem interpretações simuladas.');
const dat=create('div','ams-corner-status');
[['Melhor volta','engineerBestLap'],['Ritmo consistente','engineerPace'],['Volta alcançável','engineerAchievable'],['Confiança setup','engineerSetupConfidence']].forEach(([label,id])=>{
 const item=create('div');item.append(create('span','',label));const val=create('strong','','—');item.append(val);
 const source=$('#'+id);if(source){const fn=()=>{val.textContent=(source.textContent||'').trim()||'—'};new MutationObserver(fn).observe(source,{childList:true,subtree:true,characterData:true});fn()}
 dat.append(item);
});
evidence.append(info,dat);insertAfter(eng,evidence);
})();
