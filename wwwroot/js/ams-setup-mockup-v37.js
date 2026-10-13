/* Setup Lab v37. Enhances the dynamic concept screen after ams-concepts.js mounts it.
   Move existing input nodes, never clone: all original save/load/import/export handlers survive.
   No invented lap time, predicted grip, recommendations or cloud catalog. */
(()=>{
'use strict';
const page=document.getElementById('setup-lab');
if(!page||page.dataset.workstationReady)return;
const grid=page.querySelector('.ams-premium-grid');
const cards=[...grid?.children||[]];
if(cards.length!==3||!cards.every(x=>x.classList.contains('ams-concept-card')))return;
page.dataset.workstationReady='true';
grid.classList.add('setup-workstation');
const [sheet,recommendations,catalogCard]=cards;
sheet.classList.add('setup-sheet-v37');
recommendations.classList.add('setup-recommend-v37');
catalogCard.classList.add('setup-catalog-v37');
recommendations.querySelector('h3').textContent='2. Recommendation Engine';
catalogCard.querySelector('h3').textContent='3. Tune Catalog';
const el=(tag,cls,text)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=String(text);
 return n;
};
const control=(text,cls,action)=>{
 const b=el('button',cls||'',text);
 b.type='button';b.addEventListener('click',action);return b;
};
const title=page.querySelector('.titlebar');
const actions=el('div','setup-header-actions');
const badge=el('span','setup-badge','LOCAL · NÃO SINCRONIZADO');
actions.append(badge,
 control('Guardar setup','setup-action-primary',()=>page.querySelector('#setupSave')?.click()),
 control('Exportar JSON','setup-action-secondary',()=>page.querySelector('#setupExport')?.click()),
 control('Importar JSON','setup-action-secondary',()=>page.querySelector('#setupImport')?.click()));
title.append(actions);
const intro=el('div','setup-context-strip');
intro.append(el('span','','PARAMETER WORKSTATION · 8 AJUSTES DISPONÍVEIS'),
 el('span','','Comparação com a referência · sem estimativas de ganhos por volta'),
 el('span','','Catálogo: este navegador'));
title.insertAdjacentElement('afterend',intro);

// Group real original slider labels in mockup-like setup sheet: no changes to IDs.
const controls=[...sheet.querySelectorAll('.ams-setup-row')];
const groups=[
 {name:'AERODYNAMICS',indices:[0]},
 {name:'BRAKES & TYRES',indices:[1,2,3]},
 {name:'SUSPENSION',indices:[4,5,6,7]}
];
const first=controls[0];const grouping=el('div','setup-category-stack');
first.parentElement.insertBefore(grouping,first);
for(const group of groups){
 const category=el('section','setup-category');
 const header=el('div','setup-category-head');
 header.append(el('strong','',group.name),el('span','',group.indices.length+' parâmetros'));
 category.append(header);
 for(const index of group.indices){
  const row=controls[index];if(!row)continue;
  row.classList.add('setup-control-row');
  const label=row.querySelector('span');if(label)label.classList.add('setup-control-name');
  category.append(row);
 }
 grouping.append(category);
}
const note=el('details','setup-not-supported');
note.append(el('summary','','Mais categorias do mockup (sem parâmetros suportados)'),
 el('p','','Dampers, diferencial, alinhamento e outras regulações exigem os canais e limites específicos de cada carro. Não foram criados controlos fictícios.'));
grouping.append(note);
sheet.querySelector('#setupName')?.classList.add('setup-name-v37');

// Rearrange the original comparison panel as a real, expandable baseline table.
const compare=page.querySelector('#setupCompare');
const comparePanel=el('details','setup-baseline-panel');comparePanel.open=true;
comparePanel.append(el('summary','','BASELINE VS CURRENT SETUP'));
compare.parentElement.insertBefore(comparePanel,compare);
comparePanel.append(compare);
recommendations.querySelector('.ams-concept-note')?.remove();
const recTitle=el('div','setup-pane-intro');
recTitle.append(el('strong','','Testes e evidência'),
 el('span','','Sem previsão de delta de volta, confiança ou simulação fictícia.'));
recommendations.insertBefore(recTitle,comparePanel);
const recTabs=el('div','setup-recommend-tabs');
const recModes=[['track','Track-Specific'],['style','Driving Style'],['conditions','Conditions'],['strategy','Race Strategy']];
let mode='track',lastReport=null;
const recContent=el('div','setup-recommendation-list');
for(const [id,label] of recModes){
 const b=control(label,id===mode?'is-active':'',()=>{mode=id;updateRecommendations();});
 b.dataset.recMode=id;recTabs.append(b);
}
recommendations.insertBefore(recTabs,comparePanel);
recommendations.insertBefore(recContent,comparePanel);
function currentComparison(){
 const results=[];
 for(const row of compare.children){
  const name=row.querySelector('span')?.textContent?.trim()||'';
  const value=row.querySelector('strong')?.textContent||'';
  const match=value.match(/^\s*(-?\d+(?:\.\d+)?)\s*→\s*(-?\d+(?:\.\d+)?)/);
  if(!match)continue;
  const before=Number(match[1]),after=Number(match[2]);
  if(!Number.isFinite(before)||!Number.isFinite(after))continue;
  results.push({name,before,after,changed:Math.abs(before-after)>0.00001});
 }
 return results;
}
function appendNote(host,heading,content,extraClass){
 const article=el('div','setup-test-card '+(extraClass||''));
 article.append(el('strong','',heading),el('p','',content));host.append(article);return article;
}
function applyParameter(index,direction){
 const input=page.querySelector('[data-setup-param="'+index+'"]');
 if(!input)return;
 const step=Number(input.step)||1,min=Number(input.min),max=Number(input.max);
 const next=Number((Number(input.value)+direction*step).toFixed(4));
 if(!Number.isFinite(next)||next<min||next>max){
  page.querySelector('#setupMessage').textContent='O limite de regulação deste parâmetro já foi atingido.';return;
 }
 input.value=String(next);input.dispatchEvent(new Event('input',{bubbles:true}));
 page.querySelector('#setupMessage').textContent='Parâmetro alterado para teste: guarda o perfil quando estiveres satisfeito.';
}
function updateRecommendations(){
 [...recTabs.children].forEach(b=>b.classList.toggle('is-active',b.dataset.recMode===mode));
 recContent.replaceChildren();
 const differences=currentComparison().filter(x=>x.changed);
 if(mode==='track'){
  if(lastReport?.ok&&Array.isArray(lastReport.priorities)&&lastReport.priorities.length){
   const p=lastReport.priorities[0];
   appendNote(recContent,'Prioridade da última sessão: '+(p.label||'zona analisada'),p.advice||'Existem dados de sessão, mas sem recomendação específica.','with-evidence');
   appendNote(recContent,'Fonte: Engineer','Este relatório não prova que um parâmetro de setup seja a causa da perda. Compara stints A/B antes de concluir.');
  }else appendNote(recContent,'Sem dados específicos da pista','Analisa uma sessão no Engineer para obter evidência. Não são estimados ganhos ou níveis de confiança sem telemetria comparável.');
 }else if(mode==='style'){
  appendNote(recContent,'Testes de sensibilidade controlados','Experimenta uma única alteração de cada vez; estas sugestões não são recomendações calibradas para o carro.');
  const experiments=[{index:0,label:'Asa traseira',direction:1,display:'+1 passo'},{index:1,label:'Distribuição de travagem',direction:-1,display:'−1 passo'},{index:2,label:'Pressão dianteira',direction:1,display:'+1 passo'}];
  for(const e of experiments){
   const card=appendNote(recContent,'Teste: '+e.label,'Alteração de '+e.display+' e nova medição do comportamento.');
   card.append(control('Aplicar ao setup','setup-small-apply',()=>applyParameter(e.index,e.direction)));
  }
 }else if(mode==='conditions'){
  appendNote(recContent,'Condições ambientais indisponíveis','Não existe uma medição validada de temperatura, humidade, chuva e composto associada ao perfil. Não é possível recomendar pressões específicas.');
 }else{
  appendNote(recContent,'Estratégia de stint indisponível','A análise de impacto exige dados comparáveis de combustível, degradação de pneus e duração de stint. Mantém o setup como hipótese de teste.');
 }
 const summary=appendNote(recContent,'Alterações relativamente à referência',differences.length+' de 8 parâmetros alterados.');
 summary.classList.add('setup-test-summary');
 if(differences.length){
  for(const diff of differences.slice(0,4)){
   const item=el('div','setup-change-row');
   item.append(el('span','',diff.name),el('strong','',diff.before+' → '+diff.after));
   const ix=controls.findIndex(row=>row.querySelector('span')?.textContent?.trim()===diff.name);
   if(ix>=0)item.append(control('Repor referência','setup-small-secondary',()=>{
    const input=page.querySelector('[data-setup-param="'+ix+'"]');
    if(!input)return;input.value=String(diff.before);
    input.dispatchEvent(new Event('input',{bubbles:true}));
   }));
   summary.append(item);
  }
 }
}
const compareObserver=new MutationObserver(()=>{updateRecommendations();refreshImpact();});
compareObserver.observe(compare,{childList:true});
window.addEventListener('ams-engineer-analysis',e=>{lastReport=e.detail?.report?.ok?e.detail.report:null;updateRecommendations();});

// Turn the existing local catalog into a searchable active panel.
const searchBar=el('div','setup-catalog-toolbar');
const search=el('input','setup-catalog-search');search.type='search';search.placeholder='Procurar setups guardados…';search.setAttribute('aria-label','Pesquisar setups locais');
const count=el('span','setup-catalog-count','');
searchBar.append(search,count);
const catalog=page.querySelector('#setupCatalog');
catalog.parentElement.insertBefore(searchBar,catalog);
let filterMode='mine';
const catalogTabs=el('div','setup-catalog-tabs');
const modes=[['mine','My Setups'],['community','Community'],['official','AMS Official']];
for(const [id,label] of modes){
 const b=control(label,id===filterMode?'is-active':'',()=>{filterMode=id;updateCatalogVisibility();});
 b.dataset.catalogMode=id;catalogTabs.append(b);
}
searchBar.parentElement.insertBefore(catalogTabs,searchBar);
const catalogUnavailable=el('p','setup-catalog-unavailable','');
catalog.insertAdjacentElement('afterend',catalogUnavailable);
function updateCatalogVisibility(){
 [...catalogTabs.children].forEach(b=>b.classList.toggle('is-active',b.dataset.catalogMode===filterMode));
 const connected=filterMode==='mine';
 catalog.hidden=!connected;
 searchBar.hidden=!connected;
 catalogUnavailable.hidden=connected;
 if(!connected)catalogUnavailable.textContent=filterMode==='community'
  ?'Catálogo da comunidade indisponível: não existe sincronização autenticada ou catálogo público associado.'
  :'Catálogo AMS Official indisponível: ainda não existem perfis oficiais publicados neste serviço.';
 if(!connected)return;
 const q=search.value.trim().toLocaleLowerCase('pt-PT');
 let shown=0,total=0;
 for(const row of catalog.querySelectorAll('.ams-saved-row')){
  total++;
  const name=row.querySelector('span')?.textContent?.toLocaleLowerCase('pt-PT')||'';
  row.hidden=!!q&&!name.includes(q);
  if(!row.hidden)shown++;
 }
 count.textContent=q?shown+' / '+total:total+' guardados';
 if(!total)count.textContent='Sem perfis';
}
const catalogObserver=new MutationObserver(updateCatalogVisibility);
catalogObserver.observe(catalog,{childList:true});
search.addEventListener('input',updateCatalogVisibility);
updateCatalogVisibility();

// Bottom lane visually mirrors mockup; actual parameter counts but NO performance predictions.
const impact=el('section','setup-impact-panel');
const impactHead=el('div','setup-impact-heading');
impactHead.append(el('h3','','4. SIMULATED IMPACT'),el('span','','SEM MODELO DE DESEMPENHO · COMPARAÇÃO REAL DE PARÂMETROS'));
impact.append(impactHead);
const impactGrid=el('div','setup-impact-grid');
const metricSpecs=[
 ['Lap time (est.)','setupImpactLap','Necessita de modelo validado'],
 ['Top speed','setupImpactSpeed','Não é possível prever'],
 ['Braking stability','setupImpactBrake','Necessita de stints A/B'],
 ['Rotation','setupImpactRotation','Sem previsão calibrada'],
 ['Traction','setupImpactTraction','Sem dados por setup'],
 ['Tyre wear','setupImpactTyres','Necessita de histórico'],
 ['Parameters changed','setupImpactChanged','Comparação local verificável']
];
for(const [label,id,subtitle] of metricSpecs){
 const tile=el('div','setup-impact-tile');
 tile.append(el('span','',label));
 const val=el('strong','',id==='setupImpactChanged'?'0 / 8':'—');val.id=id;
 tile.append(val,el('small','',subtitle));impactGrid.append(tile);
}
impact.append(impactGrid);
grid.insertAdjacentElement('afterend',impact);
function refreshImpact(){
 const changed=currentComparison().filter(x=>x.changed).length;
 const target=document.getElementById('setupImpactChanged');
 if(target)target.textContent=changed+' / 8';
}
refreshImpact();updateRecommendations();
})();
