/* AMS Setup Lab v39 — real iRacing garage snapshots from owner-private Supabase.
 * NEVER merges arbitrary SDK CarSetup keys into the 8 generic Setup Sheet sliders.
 * Imported JSON is user-supplied, not cryptographically verified SDK evidence. */
(()=>{
'use strict';
const page=document.getElementById('setup-lab');
if(!page?.dataset.workstationReady||!window.AMSSupabase)return;
const sheet=page.querySelector('.setup-sheet-v37');
const recommendations=page.querySelector('.setup-recommend-v37');
if(!sheet||!recommendations)return;
const node=(tag,cls,text)=>{
 const el=document.createElement(tag);if(cls)el.className=cls;
 if(text!==undefined)el.textContent=String(text);return el;
};
const btn=(label,cls,fn)=>{
 const el=node('button',cls,label);el.type='button';el.addEventListener('click',fn);return el;
};
const block=node('section','setup-garage-card');
const head=node('div','setup-garage-heading');
head.append(node('strong','','GARAGEM REAL · iRacing'),
 node('span','','Snapshots privados por piloto'));
block.append(head);
const expl=node('p','setup-garage-info',
 'Os valores abaixo são provenientes de capturas fornecidas pelo piloto ou pelo programa Windows. Não alteram automaticamente os oito controlos genéricos.');
block.append(expl);
const bar=node('div','setup-garage-actions');
const importBtn=btn('Importar CarSetup JSON','setup-garage-import',()=>fileInput.click());
const fileInput=node('input','');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;
const reloadBtn=btn('Atualizar','setup-garage-reload',()=>refresh());
bar.append(importBtn,reloadBtn,fileInput);block.append(bar);
const status=node('p','setup-garage-status','Inicia sessão e seleciona uma sessão iRacing.');
status.setAttribute('role','status');block.append(status);
const select=node('select','setup-garage-select');
select.setAttribute('aria-label','Snapshot de garagem selecionado');
block.append(select);
const facts=node('div','setup-garage-facts');block.append(facts);
const params=node('div','setup-garage-values');block.append(params);
const grouping=sheet.querySelector('.setup-category-stack');
(grouping||sheet).insertAdjacentElement('afterend',block);

const comparison=node('details','setup-garage-compare');comparison.open=false;
comparison.append(node('summary','','COMPARAÇÃO DE SNAPSHOTS REAIS'));
const compareControls=node('div','setup-garage-compare-controls');
const selectA=node('select','');selectA.setAttribute('aria-label','Snapshot A');
const selectB=node('select','');selectB.setAttribute('aria-label','Snapshot B');
compareControls.append(selectA,selectB);comparison.append(compareControls);
const deltaStatus=node('p','setup-garage-compare-note','São necessárias duas capturas do mesmo carro e pista.');
comparison.append(deltaStatus);
const table=node('div','setup-garage-diff');comparison.append(table);
const base=recommendations.querySelector('.setup-baseline-panel');
(base||recommendations).insertAdjacentElement('afterend',comparison);

let rows=[],seq=0;
const user=()=>window.AMSAuth?.user||null;
const context=()=>window.AMSSetupSessionContext?.getSelected?.()||null;
const isIracing=s=>!!s&&String(s.simulator||'').toLowerCase()==='iracing'&&!!s.car&&!!s.track&&!!s.id;
const shortDate=value=>{
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d.toLocaleString('pt-PT'):'Data não identificada';
};
const label=r=>shortDate(r.captured_at)+' · '+(r.source==='irsdk_session_info'?'Windows SDK':'JSON importado')+' · '+r.id.slice(0,6);
function flatten(value,prefix='',out=new Map(),depth=0){
 if(depth>9||out.size>600)return out;
 if(Array.isArray(value)){
  for(let i=0;i<Math.min(value.length,80);i++)flatten(value[i],prefix+'['+i+']',out,depth+1);
 }else if(value&&typeof value==='object'){
  for(const key of Object.keys(value).slice(0,150)){
   if(!/^[\w \-./()°%]+$/.test(key)||key.length>110)continue;
   flatten(value[key],prefix?prefix+' / '+key:key,out,depth+1);
  }
 }else if(value!==null&&(typeof value==='number'||typeof value==='string'||typeof value==='boolean')){
  const val=String(value);
  if(val.length<=140&&prefix)out.set(prefix,val);
 }
 return out;
}
function renderList(selected){
 const c=context(),enabled=!!user()&&isIracing(c);
 importBtn.disabled=!enabled;reloadBtn.disabled=!enabled;
 select.replaceChildren();
 if(!enabled){
  rows=[];select.disabled=true;select.append(node('option','','Sem sessão iRacing autenticada'));
  status.textContent='Seleciona uma sessão iRacing autenticada para consultar ou importar snapshots.';
  facts.replaceChildren();params.replaceChildren();renderCompare();return;
 }
 if(!rows.length){
  select.disabled=true;select.append(node('option','','Nenhum snapshot guardado'));
  facts.replaceChildren();params.replaceChildren();renderCompare();
  return;
 }
 for(const row of rows){
  const opt=node('option','',label(row));opt.value=row.id;select.append(opt);
 }
 select.disabled=false;
 select.value=rows.some(x=>x.id===selected)?selected:rows[0].id;
 renderSelection();renderCompare();
}
function renderSelection(){
 facts.replaceChildren();params.replaceChildren();
 const r=rows.find(x=>x.id===select.value);
 if(!r)return;
 const line=node('div','setup-garage-source');
 line.append(node('strong','','Origem declarada: '+(r.source==='irsdk_session_info'?'Windows iRacing SDK':'Ficheiro JSON importado')),
  node('span','',shortDate(r.captured_at)+' · '+r.car+' · '+r.circuit));
 facts.append(line);
 const leaf=flatten(r.car_setup);
 const entries=[...leaf.entries()];
 if(!entries.length){params.append(node('p','','Este snapshot não contém parâmetros de garagem legíveis.'));return;}
 for(const [path,value] of entries.slice(0,90)){
  const item=node('div','setup-garage-value');
  item.append(node('span','',path),node('strong','',value));params.append(item);
 }
 if(entries.length>90)params.append(node('p','setup-garage-info','Mostrados 90 de '+entries.length+' parâmetros. O JSON completo permanece guardado.'));
}
function renderCompare(){
 const previousA=selectA.value,previousB=selectB.value;
 selectA.replaceChildren();selectB.replaceChildren();table.replaceChildren();
 for(const r of rows){
  for(const sel of [selectA,selectB]){
   const opt=node('option','',label(r));opt.value=r.id;sel.append(opt);
  }
 }
 selectA.disabled=rows.length<2;selectB.disabled=rows.length<2;
 if(rows.length<2){
  deltaStatus.textContent='São necessárias duas capturas reais para comparar alterações de garagem.';
  return;
 }
 selectA.value=rows.some(x=>x.id===previousA)?previousA:rows[0].id;
 selectB.value=rows.some(x=>x.id===previousB)?previousB:rows[1].id;
 const a=rows.find(x=>x.id===selectA.value),b=rows.find(x=>x.id===selectB.value);
 if(!a||!b||a.id===b.id){deltaStatus.textContent='Seleciona dois snapshots diferentes.';return;}
 const old=flatten(a.car_setup),next=flatten(b.car_setup);
 const keys=[...new Set([...old.keys(),...next.keys()])].sort((x,y)=>x.localeCompare(y,'pt'));
 const changed=keys.filter(k=>old.get(k)!==next.get(k));
 deltaStatus.textContent=changed.length+' parâmetros alterados em '+keys.length+' campos comparáveis. Sem estimativa de tempo por volta.';
 if(!changed.length){table.append(node('p','','Não foram encontradas diferenças nos valores capturados.'));return;}
 for(const k of changed.slice(0,100)){
  const row=node('div','setup-garage-diff-row');
  row.append(node('span','',k),node('strong','',(old.get(k)??'—')+' → '+(next.get(k)??'—')));
  table.append(row);
 }
 if(changed.length>100)table.append(node('p','','Mais '+(changed.length-100)+' diferenças disponíveis nos snapshots completos.'));
}
async function refresh(){
 const index=++seq;const c=context(),u=user();
 rows=[];
 renderList();
 if(!u||!isIracing(c))return;
 status.textContent='A consultar snapshots privados…';
 try{
  const token=await AMSAuth.token();if(!token)throw Error('Sem autenticação válida');
  const qp=new URLSearchParams({select:'id,simulator,circuit,car,session_id,source,car_setup,captured_at',
   pilot_id:'eq.'+u.id,simulator:'eq.iRacing',car:'eq.'+c.car,circuit:'eq.'+c.track,
   order:'captured_at.desc',limit:'75'});
  const data=await AMSSupabase.request('/rest/v1/ams_setup_snapshots?'+qp,{token});
  if(index!==seq)return;
  rows=Array.isArray(data)?data:[];
  status.textContent=rows.length?rows.length+' snapshots privados encontrados para este carro e pista.':'Nenhum snapshot guardado para esta pista e carro.';
  renderList();
 }catch(e){
  if(index!==seq)return;
  status.textContent='Não foi possível consultar os snapshots: '+String(e.message||e);
  renderList();
 }
}
const maxBytes=220000;
function validateImport(data,c){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.schema!=='ams.iracing.car_setup.v1')throw Error('Formato inválido: falta schema ams.iracing.car_setup.v1.');
 const raw=data.carSetup;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Object.keys(raw).length)throw Error('CarSetup tem de ser um objeto não vazio extraído do SessionInfo.');
 if(data.simulator&&String(data.simulator).toLowerCase()!=='iracing')throw Error('O ficheiro não é do simulador iRacing.');
 for(const [src,dest] of [['car','car'],['circuit','track'],['sessionId','id']]){
  if(data[src]!=null&&String(data[src]).trim()!==String(c[dest]).trim())throw Error('O '+src+' do ficheiro não corresponde à sessão selecionada.');
 }
 const leaf=flatten(raw);
 if(!leaf.size)throw Error('CarSetup não contém parâmetros legíveis.');
 const received=Number.isFinite(Date.parse(data.capturedAt))?new Date(data.capturedAt).toISOString():new Date().toISOString();
 return {car_setup:raw,captured_at:received};
}
fileInput.addEventListener('change',async ()=>{
 const file=fileInput.files?.[0];fileInput.value='';
 if(!file)return;
 const c=context(),u=user();
 if(!isIracing(c)||!u){status.textContent='É necessária uma sessão iRacing autenticada.';return;}
 if(file.size<2||file.size>maxBytes){status.textContent='JSON inválido ou demasiado grande (máx. 220 KB).';return;}
 try{
  const data=JSON.parse(await file.text());
  const parsed=validateImport(data,c);
  const token=await AMSAuth.token();if(!token)throw Error('Inicia sessão para guardar o snapshot.');
  const body={pilot_id:u.id,simulator:'iRacing',circuit:c.track,car:c.car,session_id:c.id,
   source:'session_info_json_import',captured_at:parsed.captured_at,car_setup:parsed.car_setup};
  await AMSSupabase.request('/rest/v1/ams_setup_snapshots',{token,method:'POST',body});
  await refresh();
  status.textContent='Snapshot real importado para o teu espaço privado. Origem não verificada pelo servidor.';
 }catch(e){status.textContent='Importação rejeitada: '+String(e.message||e);}
});
select.addEventListener('change',renderSelection);
selectA.addEventListener('change',renderCompare);
selectB.addEventListener('change',renderCompare);
document.addEventListener('ams-setup-context-change',refresh);
document.addEventListener('ams-auth-changed',refresh);
refresh();
})();