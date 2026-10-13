/* AMS Race Events and Corner Explorer — observed data only; no synthetic incidents */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const create=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const panel=(heading)=>{const p=create('article','ams-work-card');p.append(create('h3','',heading));return p};
const dash=$('#dashboard'),compare=$('#compare'),eng=$('#engineer');
if(!dash||!compare||!eng)return;
// Dashboard Race Events removed; Corner Explorer and Engineer panels retained.
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
