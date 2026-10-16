/* Engineer v34: panels populated only from an analyzed real session report. */
window.AMSEngineerMockupPanels={
 render(report){
  const tr=(pt,en)=>window.AMSi18n?.getLanguage?.()==="en"?en:pt;
  const set=(id,value)=>{const n=document.getElementById(id);if(n)n.textContent=value;};
  const fill=(id,rows,empty)=>{const host=document.getElementById(id);if(!host)return;host.replaceChildren();if(!rows.length){host.textContent=empty;return;}for(const z of rows){const item=document.createElement('div');item.className='engineer-finding-row';const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=z.title;detail.textContent=z.note;item.append(title,detail);host.append(item);}};
  if(!report?.ok){
    for(const id of ["engineerStrengths","engineerWeaknesses","engineerDrills"])fill(id,[],tr("Analisa uma sessão para obter evidência.","Analyze a session to see evidence."));
    for(const id of ["engineerScoreConsistency","engineerScoreVariance","engineerScoreDriver","engineerScoreZones"])set(id,"—");
    return;
  }
  const zones=Array.isArray(report.zones)?report.zones.filter(z=>z&&Number.isFinite(z.avgLoss)):[];
  const fmt=n=>Number.isFinite(n)?((n>=0?'+':'')+n.toFixed(3)+'s'):'—';
  const positive=[...zones].filter(z=>z.avgLoss>0.003).sort((a,b)=>b.avgLoss-a.avgLoss).slice(0,3);
  const steady=[...zones].filter(z=>Number.isFinite(z.timeSd)&&z.confidence>=45).sort((a,b)=>a.timeSd-b.timeSd).slice(0,3);
  fill('engineerStrengths',steady.map(z=>({title:z.label||'Zona',note:'Variação temporal σ '+z.timeSd.toFixed(3)+'s · confiança '+z.confidence+'%'})),'Sem evidência suficiente de zonas consistentes.');
  fill('engineerWeaknesses',positive.map(z=>({title:z.label||'Zona',note:'Perda média '+fmt(z.avgLoss)+' · '+(z.diagnosis||'por determinar')})),'Sem perdas relevantes confirmadas nas zonas analisadas.');
  const priorities=Array.isArray(report.priorities)?report.priorities.slice(0,3):[];
  fill('engineerDrills',priorities.map(p=>({title:p.label||'Prioridade',note:p.advice||'Sem recomendação específica'})),'Não foram identificadas prioridades suficientes para sugerir exercícios.');
  set('engineerScoreConsistency',Number.isFinite(report.consistency)?report.consistency+'/100':'—');
  set('engineerScoreVariance',Number.isFinite(report.lapStdDev)?report.lapStdDev.toFixed(3)+'s':'—');
  set('engineerScoreDriver',Number.isFinite(report.driverShare)?(report.driverShare*100).toFixed(0)+'%':'—');
  set('engineerScoreZones',String(zones.length));
 }
};
