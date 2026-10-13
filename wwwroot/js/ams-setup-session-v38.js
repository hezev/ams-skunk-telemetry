/* v38 — Read-only real session context for Setup Lab.
   Metadata comes from authenticated Supabase laps already fetched by app.js.
   NO simulated car setup is imported or claimed, NO extra vehicle ranges inferred. */
(()=>{
'use strict';
const page=document.getElementById('setup-lab');
if(!page||!page.dataset.workstationReady)return;
const ctxStrip=page.querySelector('.setup-context-strip');
if(!ctxStrip)return;
let sessions=[],selectedId='',inFlightId='';
const el=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
const fmtLap=ms=>{
 const n=Number(ms);
 if(!Number.isFinite(n)||n<=0)return '—';
 const min=Math.floor(n/60000),sec=(n-min*60000)/1000;
 return min+':'+sec.toFixed(3).padStart(6,'0');
};
const getSelected=()=>sessions.find(s=>s.id===selectedId)||null;
window.AMSSetupSessionContext={getSelected};
const wrapper=el('div','setup-real-session-workspace');
const header=el('div','setup-real-session-head');
header.append(el('strong','','CONTEXTO REAL DO SETUP'),el('small','','Metadados da sessão gravada no Supabase'));
wrapper.append(header);
const controls=el('div','setup-real-session-controls');
const selectorLabel=el('label','setup-session-picker','Sessão');
const selector=el('select','setup-session-select');
selector.id='setupSessionSelect';
selector.setAttribute('aria-label','Selecionar sessão real de telemetria');
selectorLabel.append(selector);
const button=el('button','setup-real-analyze','Analisar sessão');
button.type='button';
const status=el('span','setup-real-status','A aguardar sessões autenticadas…');
status.setAttribute('role','status');
controls.append(selectorLabel,button,status);
wrapper.append(controls);
const values=el('div','setup-session-facts');
const fields=[
 ['Simulador','simulator'],['Carro','car'],['Pista','track'],
 ['Voltas','lapCount'],['Melhor volta','bestLapMs'],['Última sessão','lastAt']
];
const refs={};
for(const [label,id] of fields){
 const item=el('div','setup-session-fact');
 item.append(el('span','',label));
 const value=el('strong','','—');value.dataset.sessionFact=id;
 refs[id]=value;item.append(value);values.append(item);
}
wrapper.append(values);
const warning=el('p','setup-session-warning','Parâmetros de setup apresentados são genéricos. Não são uma leitura da garagem do iRacing nem valores calibrados para o carro.');
wrapper.append(warning);
ctxStrip.insertAdjacentElement('afterend',wrapper);
function render(){
 const current=getSelected();
 selector.replaceChildren();
 if(!sessions.length){
  const opt=el('option','','Nenhuma sessão gravada disponível');
  opt.value='';selector.append(opt);selector.disabled=true;button.disabled=true;
  status.textContent='Inicia sessão para obter as tuas voltas e o carro.';
 }else{
  for(const s of sessions){
   const label=[s.car||'Carro não identificado',s.track||'Pista não identificada',
    String(s.lapCount)+' voltas'].join(' · ');
   const opt=el('option','',label);opt.value=s.id;selector.append(opt);
  }
  selector.disabled=false;selector.value=selectedId;
  button.disabled=!current||current.lapCount<2;
  status.textContent=current
    ?current.lapCount>=2?'Sessão disponível para análise':'São necessárias pelo menos 2 voltas'
    :'Seleciona uma sessão';
 }
 for(const [id,node] of Object.entries(refs)){
  let value=current?.[id]??null;
  if(id==='bestLapMs')value=fmtLap(value);
  else if(id==='lastAt'){
   const d=value?new Date(value):null;
   value=d&&Number.isFinite(d.getTime())?d.toLocaleDateString('pt-PT'):'—';
  }
  node.textContent=value!==null&&value!==''?String(value):'—';
 }
}
function normalizedSessions(raw){
 if(!Array.isArray(raw))return [];
 return raw.slice(0,300).filter(x=>x&&typeof x.id==='string'&&x.id.length<300)
  .map(x=>({
   id:x.id,simulator:String(x.simulator||'').slice(0,120),
   car:String(x.car||'').slice(0,120),track:String(x.track||'').slice(0,120),
   lapCount:Math.max(0,Math.min(20000,Math.floor(Number(x.lapCount)||0))),
   bestLapMs:typeof x.bestLapMs==='number'&&Number.isFinite(x.bestLapMs)&&x.bestLapMs>0?x.bestLapMs:null,
   lastAt:typeof x.lastAt==='string'?x.lastAt:null
  }));
}
document.addEventListener('ams-setup-sessions',e=>{
 const received=normalizedSessions(e.detail?.sessions);
 sessions=received;
 if(!sessions.some(s=>s.id===selectedId))selectedId=sessions[0]?.id||'';
 inFlightId='';
 render();
 document.dispatchEvent(new CustomEvent('ams-setup-context-change',{detail:{context:getSelected()}}));
});
selector.addEventListener('change',()=>{
 selectedId=selector.value;inFlightId='';render();
 document.dispatchEvent(new CustomEvent('ams-setup-context-change',{detail:{context:getSelected()}}));
});
button.addEventListener('click',()=>{
 const s=getSelected();if(!s||s.lapCount<2)return;
 const original=document.getElementById('engineerSessionSelect');
 const analyze=document.getElementById('engineerAnalyzeBtn');
 if(!original||!analyze||![...original.options].some(o=>o.value===s.id)){
  status.textContent='Sessão indisponível no Engineer. Atualiza as voltas.';return;
 }
 original.value=s.id;
 original.dispatchEvent(new Event('change',{bubbles:true}));
 inFlightId=s.id;
 status.textContent='A analisar a sessão no Engineer…';
 analyze.click();
});
document.addEventListener('ams-setup-engineer-evidence',e=>{
 if(!inFlightId||inFlightId!==getSelected()?.id||e.detail?.sessionId!==inFlightId)return;
 status.textContent=e.detail?.report?.ok
  ?'Análise recebida · ver recomendações Track-Specific'
  :'Não foi possível concluir a análise da sessão.';
 inFlightId='';
});
render();
document.dispatchEvent(new Event('ams-setup-request-sessions'));
})();