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
  fill('engineerStrengths',steady.map(z=>({title:z.label||tr('Zona','Zone'),note:tr('Variação temporal σ ','Time variation σ ')+z.timeSd.toFixed(3)+'s · '+tr('confiança ','confidence ')+z.confidence+'%'})),tr('Sem evidência suficiente de zonas consistentes.','Not enough evidence of consistent zones.'));
  fill('engineerWeaknesses',positive.map(z=>({title:z.label||'Zona',note:tr('Perda média ','Average loss ')+fmt(z.avgLoss)+' · '+(z.diagnosis||tr('por determinar','undetermined'))})),tr('Sem perdas relevantes confirmadas nas zonas analisadas.','No significant losses confirmed in the analyzed zones.'));
  const priorities=Array.isArray(report.priorities)?report.priorities.slice(0,3):[];
  fill('engineerDrills',priorities.map(p=>({title:p.label||tr('Prioridade','Priority'),note:p.advice||tr('Sem recomendação específica','No specific recommendation')})),tr('Não foram identificadas prioridades suficientes para sugerir exercícios.','Not enough priorities identified to suggest drills.'));
  set('engineerScoreConsistency',Number.isFinite(report.consistency)?report.consistency+'/100':'—');
  set('engineerScoreVariance',Number.isFinite(report.lapStdDev)?report.lapStdDev.toFixed(3)+'s':'—');
  set('engineerScoreDriver',Number.isFinite(report.driverShare)?(report.driverShare*100).toFixed(0)+'%':'—');
  set('engineerScoreZones',String(zones.length));
 }
};
